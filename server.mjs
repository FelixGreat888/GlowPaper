import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const distDir = path.join(__dirname, 'dist');
const publicConfig = JSON.parse(
  fs.readFileSync(path.join(__dirname, 'public', 'config.json'), 'utf8'),
);
const port = Number(process.env.PORT || 4173);

function readJsonFileIfExists(filePath) {
  if (!fs.existsSync(filePath)) {
    return {};
  }

  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function loadPrivateConfig() {
  const fileConfig = readJsonFileIfExists(path.join(__dirname, 'server.config.json'));

  return {
    deepseek: {
      base_url:
        process.env.DEEPSEEK_BASE_URL ||
        fileConfig.deepseek?.base_url ||
        'https://api.deepseek.com',
      endpoint:
        process.env.DEEPSEEK_ENDPOINT || fileConfig.deepseek?.endpoint || '/chat/completions',
      model:
        process.env.DEEPSEEK_MODEL ||
        fileConfig.deepseek?.model ||
        publicConfig.deepseek?.model ||
        'deepseek-chat',
      api_key: process.env.DEEPSEEK_API_KEY || fileConfig.deepseek?.api_key || '',
    },
    bfl: {
      api_key: process.env.BFL_API_KEY || fileConfig.bfl?.api_key || '',
    },
  };
}

const privateConfig = loadPrivateConfig();

const modelMap = new Map(publicConfig.models.map((model) => [model.id, model]));

function sendJson(response, statusCode, payload) {
  response.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
  });
  response.end(JSON.stringify(payload));
}

function sendText(response, statusCode, text) {
  response.writeHead(statusCode, {
    'Content-Type': 'text/plain; charset=utf-8',
    'Cache-Control': 'no-store',
  });
  response.end(text);
}

async function readJsonBody(request) {
  const chunks = [];

  for await (const chunk of request) {
    chunks.push(chunk);
  }

  const raw = Buffer.concat(chunks).toString('utf8');
  return raw ? JSON.parse(raw) : {};
}

function tryParseJsonText(rawText) {
  const normalized = String(rawText || '').replace(/^\uFEFF/, '').trim();
  if (!normalized) {
    return null;
  }

  const candidates = [normalized];
  const sseLines = normalized
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.startsWith('data:'))
    .map((line) => line.slice(5).trim())
    .filter((line) => line && line !== '[DONE]');

  if (sseLines.length) {
    candidates.unshift(sseLines.join(''));
    candidates.push(...sseLines);
  }

  const firstBrace = normalized.indexOf('{');
  const lastBrace = normalized.lastIndexOf('}');
  if (firstBrace !== -1 && lastBrace > firstBrace) {
    candidates.push(normalized.slice(firstBrace, lastBrace + 1));
  }

  const firstBracket = normalized.indexOf('[');
  const lastBracket = normalized.lastIndexOf(']');
  if (firstBracket !== -1 && lastBracket > firstBracket) {
    candidates.push(normalized.slice(firstBracket, lastBracket + 1));
  }

  for (const candidate of [...new Set(candidates)]) {
    try {
      return JSON.parse(candidate);
    } catch {
      // Try next candidate.
    }
  }

  return null;
}

function parseJsonOrThrow(rawText, label) {
  const parsed = tryParseJsonText(rawText);
  if (parsed !== null) {
    return parsed;
  }

  const preview = String(rawText || '').replace(/\s+/g, ' ').trim().slice(0, 160);
  throw new Error(`${label} 响应解析失败${preview ? `: ${preview}` : ''}`);
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function normalizePromptLine(line) {
  return line
    .trim()
    .replace(/^[-*]\s+/, '')
    .replace(/^\d+[\).\s-]+/, '')
    .trim();
}

function extractPromptLines(content, count = 1) {
  if (!content) {
    throw new Error('DeepSeek 未返回内容');
  }

  const normalized = content
    .trim()
    .replace(/^```(?:text|json)?\s*/i, '')
    .replace(/\s*```$/, '')
    .trim();

  if (!normalized) {
    throw new Error('DeepSeek 返回为空');
  }

  if (normalized.startsWith('{')) {
    try {
      const parsed = JSON.parse(normalized);
      const candidates = [
        ...(Array.isArray(parsed.final_positive_prompts) ? parsed.final_positive_prompts : []),
        ...(Array.isArray(parsed.positive_prompts) ? parsed.positive_prompts : []),
        ...(Array.isArray(parsed.prompts) ? parsed.prompts : []),
      ]
        .map((item) => String(item || '').trim())
        .filter(Boolean);

      if (candidates.length) {
        return candidates.slice(0, Math.max(1, count));
      }

      const single =
        parsed.final_positive_prompt?.trim() ||
        parsed.positive_prompt?.trim() ||
        parsed.prompt?.trim() ||
        '';

      if (single) {
        return [single];
      }
    } catch {
      // Fall through to raw text.
    }
  }

  const lines = normalized
    .split(/\r?\n+/)
    .map((line) => normalizePromptLine(line.replace(/^["']|["']$/g, '').trim()))
    .filter(Boolean);

  if (lines.length) {
    return lines.slice(0, Math.max(1, count));
  }

  return [normalized.replace(/^["']|["']$/g, '').trim()].filter(Boolean);
}

function ensurePromptCount(prompts, count, fallbackPrompt) {
  const sanitized = prompts.map((item) => item.trim()).filter(Boolean);

  if (!sanitized.length) {
    return Array.from({ length: count }, () => fallbackPrompt);
  }

  if (sanitized.length >= count) {
    return sanitized.slice(0, count);
  }

  const padded = [...sanitized];
  while (padded.length < count) {
    padded.push(sanitized[padded.length % sanitized.length]);
  }

  return padded;
}

async function optimizePrompt(prompt, count = 1) {
  if (!privateConfig.deepseek.api_key) {
    throw new Error('DeepSeek API Key 未配置');
  }

  const response = await fetch(
    `${privateConfig.deepseek.base_url}${privateConfig.deepseek.endpoint}`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${privateConfig.deepseek.api_key}`,
      },
      body: JSON.stringify({
        model: privateConfig.deepseek.model,
        temperature: 0.7,
        messages: [
          {
            role: 'system',
            content:
              `You are a prompt rewriter. Rewrite the user input into ${count} different English text-to-image prompts for a black-background neon glow line-art sticker-style vertical wallpaper. All ${count} prompts must share the SAME core style and layout skeleton and must not drift. Style: black background, neon glow line art, clean thin outlines, high contrast, vibrant gradient neon, crisp edges, flat sticker-like illustration, minimal shading, no heavy texture. Layout: vertical wallpaper with balanced distribution, do not place all elements in the center. Reserve a small clean empty display window near the upper-middle area as a small negative space panel. Keep it empty: no text, no numbers, no logo, no buttons, no UI. Use a 3-zone structure: Top zone: multiple small decorative stickers or particles spread across left, center, and right. Mid zone: 1 to 2 main focal stickers related to the keywords, placed slightly off-center on the left or right, while keeping the display window empty. Bottom zone: a theme-matching decorative base band spanning the width, such as skyline, horizon, abstract platform, or waterfront, plus subtle reflections or light trails. Ensure both left and right sides have content with edge decorations. Variation rules: each prompt must vary in focal placement, secondary motif set with 2 to 4 small icons or particles or objects, and base band interpretation chosen from skyline, horizon, platform, or waterfront when it fits the theme. Keep the theme consistent with the user keywords and do not introduce unrelated subjects. If the input mentions a protected IP, brand, character, trademark, franchise, or copyrighted element, do not output the proper noun and do not translate it into the official English name; instead, convert it into generic visual descriptors only. Output format is strict: return exactly ${count} lines, each line one complete prompt, no numbering, no extra text, no negative prompt.`,
          },
          {
            role: 'user',
            content: `User request: ${prompt}`,
          },
        ],
      }),
    },
  );

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(
      `DeepSeek 请求失败（${response.status}）${errorText ? `: ${errorText}` : ''}`,
    );
  }

  const data = parseJsonOrThrow(await response.text(), 'DeepSeek');
  const content = data?.choices?.[0]?.message?.content;
  const positivePrompts = ensurePromptCount(
    extractPromptLines(content, count),
    Math.max(1, count),
    prompt.trim(),
  );

  return {
    positivePrompt: positivePrompts[0] || '',
    positivePrompts,
  };
}

async function submitFluxTask(model, payload) {
  if (!privateConfig.bfl.api_key) {
    throw new Error('Flux API Key 未配置');
  }

  const response = await fetch(model.endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      accept: 'application/json',
      'x-key': privateConfig.bfl.api_key,
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const message = await response.text();
    throw new Error(
      `Flux 请求失败（${response.status}）${message ? `: ${message}` : ''}`,
    );
  }

  return parseJsonOrThrow(await response.text(), 'Flux');
}

async function pollFluxResult(pollingUrl) {
  const startedAt = Date.now();

  while (Date.now() - startedAt < 120000) {
    const response = await fetch(pollingUrl, {
      headers: {
        accept: 'application/json',
        'x-key': privateConfig.bfl.api_key,
      },
    });

    if (!response.ok) {
      throw new Error(`结果轮询失败（${response.status}）`);
    }

    const result = parseJsonOrThrow(await response.text(), 'Flux 轮询');

    if (result.status === 'Ready') {
      return result;
    }

    if (['Content Moderated', 'Request Moderated'].includes(result.status)) {
      throw new Error('请求被审核拦截，请改用更通用的非 IP / 非品牌描述');
    }

    if (['Error', 'Failed'].includes(result.status)) {
      throw new Error(result.details?.message || result.status);
    }

    await sleep(1200);
  }

  throw new Error('生成超时，请稍后重试');
}

async function generateImage({ modelId, prompt, width, height, seed }) {
  const model = modelMap.get(modelId);
  if (!model) {
    throw new Error('模型不存在');
  }

  const task = await submitFluxTask(model, {
    prompt,
    width,
    height,
    seed,
    safety_tolerance: 2,
    output_format: 'png',
  });
  const result = await pollFluxResult(task.polling_url);
  const imageUrl = result?.result?.sample;

  if (!imageUrl) {
    throw new Error('未收到图片地址');
  }

  return {
    taskId: task.id,
    url: `/api/image?source=${encodeURIComponent(imageUrl)}`,
    upstreamUrl: imageUrl,
  };
}

function contentTypeByExt(filePath) {
  if (filePath.endsWith('.html')) return 'text/html; charset=utf-8';
  if (filePath.endsWith('.js')) return 'application/javascript; charset=utf-8';
  if (filePath.endsWith('.css')) return 'text/css; charset=utf-8';
  if (filePath.endsWith('.json')) return 'application/json; charset=utf-8';
  if (filePath.endsWith('.svg')) return 'image/svg+xml';
  if (filePath.endsWith('.png')) return 'image/png';
  if (filePath.endsWith('.jpg') || filePath.endsWith('.jpeg')) return 'image/jpeg';
  if (filePath.endsWith('.woff2')) return 'font/woff2';
  return 'application/octet-stream';
}

function serveFile(response, filePath) {
  if (!fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
    return false;
  }

  response.writeHead(200, {
    'Content-Type': contentTypeByExt(filePath),
  });
  fs.createReadStream(filePath).pipe(response);
  return true;
}

const server = http.createServer(async (request, response) => {
  try {
    const requestUrl = new URL(request.url, `http://${request.headers.host}`);

    if (request.method === 'POST' && requestUrl.pathname === '/api/deepseek/optimize') {
      const body = await readJsonBody(request);
      const count = Math.max(1, Number(body.count || 1));
      const result = await optimizePrompt(body.prompt || '', count);
      sendJson(response, 200, result);
      return;
    }

    if (request.method === 'POST' && requestUrl.pathname === '/api/flux/generate') {
      const body = await readJsonBody(request);
      const result = await generateImage(body);
      sendJson(response, 200, result);
      return;
    }

    if (request.method === 'GET' && requestUrl.pathname === '/api/image') {
      const source = requestUrl.searchParams.get('source');
      if (!source) {
        sendText(response, 400, '缺少 source');
        return;
      }

      const upstream = await fetch(source);
      if (!upstream.ok) {
        sendText(response, upstream.status, '图片拉取失败');
        return;
      }

      response.writeHead(200, {
        'Content-Type': upstream.headers.get('content-type') || 'image/png',
        'Cache-Control': 'public, max-age=3600',
      });
      upstream.body.pipeTo(
        new WritableStream({
          write(chunk) {
            response.write(Buffer.from(chunk));
          },
          close() {
            response.end();
          },
          abort(error) {
            response.destroy(error);
          },
        }),
      );
      return;
    }

    if (
      ['GET', 'HEAD'].includes(request.method || '') &&
      requestUrl.pathname === '/healthz'
    ) {
      sendText(response, 200, 'ok');
      return;
    }

    const safePath = requestUrl.pathname === '/' ? '/index.html' : requestUrl.pathname;
    const filePath = path.join(distDir, safePath);

    if (serveFile(response, filePath)) {
      return;
    }

    serveFile(response, path.join(distDir, 'index.html'));
  } catch (error) {
    sendJson(response, 500, {
      error: error instanceof Error ? error.message : '服务异常',
    });
  }
});

server.listen(port, '0.0.0.0', () => {
  console.log(`Server running at http://0.0.0.0:${port}`);
});
