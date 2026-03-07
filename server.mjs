import crypto from 'node:crypto';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { promisify } from 'node:util';
import { Pool } from 'pg';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const distDir = path.join(__dirname, 'dist');
const publicConfig = JSON.parse(
  fs.readFileSync(path.join(__dirname, 'public', 'config.json'), 'utf8'),
);
const port = Number(process.env.PORT || 4173);

const scrypt = promisify(crypto.scrypt);
const SESSION_COOKIE_NAME = 'glowpaper_session';
const SESSION_TTL_MS = 14 * 24 * 60 * 60 * 1000;
const STARTER_CREDITS = 10;
const JSON_BODY_LIMIT = 1024 * 1024;
const EDIT_UPLOAD_LIMIT_BYTES = 10 * 1024 * 1024;
const CREDIT_COSTS = {
  generate: {
    low: 1,
    medium: 2,
    high: 3,
  },
  edit: {
    low: 2,
    medium: 3,
    high: 5,
  },
};
const ALLOWED_QUALITY = new Set(['low', 'medium', 'high']);
const ALLOWED_BACKGROUND = new Set(['transparent', 'opaque', 'auto']);
const ALLOWED_ASPECT_RATIO = new Set(['auto', 'square', 'portrait', 'landscape']);
const ALLOWED_STYLE_PARAMS = {
  style: new Set(['flat', 'line_art', 'engraving', 'linocut', 'silhouette', 'isometric', 'cartoon', 'ghibli']),
  color_mode: new Set(['full_color', 'monochrome', 'few_colors']),
  image_complexity: new Set(['icon', 'illustration', 'scene']),
  text: new Set(['', 'only_title', 'embedded_text']),
  composition: new Set(['centered_object', 'repeating_pattern', 'full_scene', 'objects_in_grid']),
};
const modelMap = new Map((publicConfig.models || []).map((model) => [model.id, model]));
const rateLimitState = new Map();

class ApiError extends Error {
  constructor(status, code, message, details = {}) {
    super(message);
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

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
    svg: {
      base_url:
        process.env.SVG_API_BASE_URL ||
        fileConfig.svg?.base_url ||
        'https://api.svgmaker.io/v1',
      api_key: process.env.SVG_API_KEY || fileConfig.svg?.api_key || '',
    },
    database: {
      connection_string:
        process.env.DATABASE_URL || fileConfig.database?.connection_string || '',
    },
    app: {
      invite_code: process.env.APP_INVITE_CODE || fileConfig.app?.invite_code || '',
      session_secret:
        process.env.SESSION_SECRET || fileConfig.app?.session_secret || '',
      bootstrap_admin_email:
        process.env.BOOTSTRAP_ADMIN_EMAIL || fileConfig.app?.bootstrap_admin_email || '',
      bootstrap_admin_password:
        process.env.BOOTSTRAP_ADMIN_PASSWORD ||
        fileConfig.app?.bootstrap_admin_password ||
        '',
    },
  };
}

const privateConfig = loadPrivateConfig();
const pool = privateConfig.database.connection_string
  ? new Pool({
      connectionString: privateConfig.database.connection_string,
      max: 10,
      idleTimeoutMillis: 30000,
      ssl:
        process.env.NODE_ENV === 'production' &&
        !/localhost|127\.0\.0\.1/.test(privateConfig.database.connection_string)
          ? { rejectUnauthorized: false }
          : undefined,
    })
  : null;

let databaseReady = false;
let databaseInitError = null;

function buildResponseHeaders(extra = {}) {
  return {
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'SAMEORIGIN',
    'Referrer-Policy': 'strict-origin-when-cross-origin',
    'Permissions-Policy': 'camera=(), microphone=(), geolocation=() ',
    'Cross-Origin-Opener-Policy': 'same-origin',
    'Cross-Origin-Resource-Policy': 'same-origin',
    ...extra,
  };
}

function sendJson(response, statusCode, payload, extraHeaders = {}) {
  response.writeHead(
    statusCode,
    buildResponseHeaders({
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
      ...extraHeaders,
    }),
  );
  response.end(JSON.stringify(payload));
}

function sendText(response, statusCode, text, extraHeaders = {}) {
  response.writeHead(
    statusCode,
    buildResponseHeaders({
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'no-store',
      ...extraHeaders,
    }),
  );
  response.end(text);
}

function sendNoContent(response, extraHeaders = {}) {
  response.writeHead(204, buildResponseHeaders(extraHeaders));
  response.end();
}

function sendApiError(response, error, extraHeaders = {}) {
  const status = error instanceof ApiError ? error.status : 500;
  const code = error instanceof ApiError ? error.code : 'INTERNAL_ERROR';
  const message =
    error instanceof ApiError
      ? error.message
      : error instanceof Error
        ? error.message
        : '服务异常';
  const details = error instanceof ApiError ? error.details : {};

  sendJson(
    response,
    status,
    {
      error: {
        code,
        message,
        ...details,
      },
    },
    extraHeaders,
  );
}

function parseCookies(headerValue) {
  if (!headerValue) {
    return {};
  }

  return String(headerValue)
    .split(';')
    .map((item) => item.trim())
    .filter(Boolean)
    .reduce((accumulator, chunk) => {
      const separatorIndex = chunk.indexOf('=');
      if (separatorIndex === -1) {
        return accumulator;
      }

      const key = chunk.slice(0, separatorIndex).trim();
      const value = chunk.slice(separatorIndex + 1).trim();
      accumulator[key] = decodeURIComponent(value);
      return accumulator;
    }, {});
}

function isSecureRequest(request) {
  const forwardedProto = String(request.headers['x-forwarded-proto'] || '').split(',')[0].trim();
  return forwardedProto === 'https' || process.env.NODE_ENV === 'production';
}

function serializeCookie(name, value, options = {}) {
  const parts = [`${name}=${encodeURIComponent(value)}`];

  if (options.maxAge !== undefined) {
    parts.push(`Max-Age=${Math.max(0, Math.floor(options.maxAge))}`);
  }

  parts.push(`Path=${options.path || '/'}`);
  parts.push(`SameSite=${options.sameSite || 'Lax'}`);

  if (options.httpOnly !== false) {
    parts.push('HttpOnly');
  }

  if (options.secure) {
    parts.push('Secure');
  }

  if (options.expires) {
    parts.push(`Expires=${options.expires.toUTCString()}`);
  }

  return parts.join('; ');
}

function setSessionCookie(response, request, token, expiresAt) {
  response.setHeader(
    'Set-Cookie',
    serializeCookie(SESSION_COOKIE_NAME, token, {
      path: '/',
      sameSite: 'Lax',
      httpOnly: true,
      secure: isSecureRequest(request),
      maxAge: Math.floor(SESSION_TTL_MS / 1000),
      expires: expiresAt,
    }),
  );
}

function clearSessionCookie(response, request) {
  response.setHeader(
    'Set-Cookie',
    serializeCookie(SESSION_COOKIE_NAME, '', {
      path: '/',
      sameSite: 'Lax',
      httpOnly: true,
      secure: isSecureRequest(request),
      maxAge: 0,
      expires: new Date(0),
    }),
  );
}

function getClientIp(request) {
  return String(request.headers['x-forwarded-for'] || request.socket.remoteAddress || '')
    .split(',')[0]
    .trim();
}

function getAllowedOriginHosts(request) {
  const hosts = new Set();
  const primaryHost = String(request.headers.host || '').trim();
  const forwardedHost = String(request.headers['x-forwarded-host'] || '').split(',')[0].trim();

  if (primaryHost) {
    hosts.add(primaryHost);
  }

  if (forwardedHost) {
    hosts.add(forwardedHost);
  }

  hosts.add('localhost:4173');
  hosts.add('127.0.0.1:4173');
  hosts.add('localhost:5173');
  hosts.add('127.0.0.1:5173');
  return hosts;
}

function assertTrustedOrigin(request) {
  const origin = String(request.headers.origin || '').trim();
  if (!origin) {
    return;
  }

  let host;
  try {
    host = new URL(origin).host;
  } catch {
    throw new ApiError(403, 'FORBIDDEN_ORIGIN', '请求来源无效');
  }

  if (!getAllowedOriginHosts(request).has(host)) {
    throw new ApiError(403, 'FORBIDDEN_ORIGIN', '请求来源无效');
  }
}

function assertRateLimit(scope, key, limit, windowMs) {
  const bucketKey = `${scope}:${key}`;
  const now = Date.now();
  const entries = rateLimitState.get(bucketKey) || [];
  const nextEntries = entries.filter((item) => now - item < windowMs);

  if (nextEntries.length >= limit) {
    throw new ApiError(429, 'RATE_LIMITED', '请求过于频繁，请稍后再试');
  }

  nextEntries.push(now);
  rateLimitState.set(bucketKey, nextEntries);
}

async function readBodyBuffer(request, limitBytes = JSON_BODY_LIMIT) {
  const chunks = [];
  let totalLength = 0;

  for await (const chunk of request) {
    totalLength += chunk.length;
    if (totalLength > limitBytes) {
      throw new ApiError(413, 'PAYLOAD_TOO_LARGE', '请求体过大');
    }
    chunks.push(chunk);
  }

  return Buffer.concat(chunks);
}

async function readJsonBody(request, limitBytes = JSON_BODY_LIMIT) {
  const buffer = await readBodyBuffer(request, limitBytes);
  const raw = buffer.toString('utf8').trim();

  if (!raw) {
    return {};
  }

  try {
    return JSON.parse(raw);
  } catch {
    throw new ApiError(400, 'INVALID_JSON', '请求体格式不正确');
  }
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

async function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const derived = await scrypt(password, salt, 64);
  return `scrypt:${salt}:${Buffer.from(derived).toString('hex')}`;
}

async function verifyPassword(password, storedHash) {
  const [scheme, salt, digest] = String(storedHash || '').split(':');
  if (scheme !== 'scrypt' || !salt || !digest) {
    return false;
  }

  const derived = await scrypt(password, salt, 64);
  const derivedBuffer = Buffer.from(derived);
  const digestBuffer = Buffer.from(digest, 'hex');

  if (derivedBuffer.length !== digestBuffer.length) {
    return false;
  }

  return crypto.timingSafeEqual(derivedBuffer, digestBuffer);
}

function generateId(prefix) {
  return `${prefix}_${crypto.randomUUID().replace(/-/g, '')}`;
}

function hashToken(token) {
  const secret = privateConfig.app.session_secret || 'unsafe-local-session-secret';
  return crypto.createHmac('sha256', secret).update(token).digest('hex');
}

function createSessionToken() {
  return crypto.randomBytes(32).toString('base64url');
}

function normalizeEmail(value) {
  return String(value || '').trim().toLowerCase();
}

function isValidEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function buildApiKey(rawKey) {
  const value = String(rawKey || '').trim();
  if (!value) {
    throw new ApiError(503, 'SVG_API_UNAVAILABLE', 'SVG 服务尚未配置完成');
  }

  return value.startsWith('svgmaker-io') ? value : `svgmaker-io${value}`;
}

function assertDatabaseReady() {
  if (!pool) {
    throw new ApiError(503, 'DATABASE_UNAVAILABLE', '数据库尚未配置完成');
  }

  if (databaseInitError) {
    throw new ApiError(503, 'DATABASE_UNAVAILABLE', '数据库初始化失败');
  }

  if (!databaseReady) {
    throw new ApiError(503, 'DATABASE_UNAVAILABLE', '数据库正在启动，请稍后重试');
  }
}

function isAuthConfigured() {
  return Boolean(pool && privateConfig.app.session_secret);
}

function assertAuthReady() {
  assertDatabaseReady();

  if (!privateConfig.app.session_secret) {
    throw new ApiError(503, 'AUTH_UNAVAILABLE', '登录系统尚未配置完成');
  }
}

async function withTransaction(handler) {
  assertDatabaseReady();
  const client = await pool.connect();

  try {
    await client.query('BEGIN');
    const result = await handler(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

async function bootstrapAdminAccount() {
  const email = normalizeEmail(privateConfig.app.bootstrap_admin_email);
  const password = String(privateConfig.app.bootstrap_admin_password || '');

  if (!email || !password) {
    return;
  }

  if (!isValidEmail(email)) {
    console.warn('BOOTSTRAP_ADMIN_EMAIL 不是有效邮箱，已跳过管理员初始化');
    return;
  }

  if (password.length < 6) {
    console.warn('BOOTSTRAP_ADMIN_PASSWORD 长度不足 6 位，已跳过管理员初始化');
    return;
  }

  await withTransaction(async (client) => {
    const existing = await client.query(
      `SELECT id, role, status, credit_balance FROM users WHERE email = $1`,
      [email],
    );

    if (existing.rowCount) {
      const user = existing.rows[0];
      if (user.role !== 'admin' || user.status !== 'active') {
        await client.query(
          `UPDATE users SET role = 'admin', status = 'active' WHERE id = $1`,
          [user.id],
        );
      }
      return;
    }

    const userId = generateId('usr');
    const passwordHash = await hashPassword(password);
    await client.query(
      `INSERT INTO users (
        id,
        email,
        password_hash,
        role,
        status,
        credit_balance,
        created_at,
        last_login_at
      ) VALUES ($1, $2, $3, 'admin', 'active', $4, NOW(), NULL)`,
      [userId, email, passwordHash, STARTER_CREDITS],
    );

    await client.query(
      `INSERT INTO credit_ledger (
        id,
        user_id,
        delta,
        balance_after,
        reason,
        meta_json,
        operator_user_id,
        created_at
      ) VALUES ($1, $2, $3, $4, $5, $6::jsonb, NULL, NOW())`,
      [
        generateId('led'),
        userId,
        STARTER_CREDITS,
        STARTER_CREDITS,
        'bootstrap_admin',
        JSON.stringify({ source: 'bootstrap' }),
      ],
    );
  });
}

async function initDatabase() {
  if (!pool) {
    console.warn('DATABASE_URL 未配置，认证与算粒系统处于禁用状态');
    return;
  }

  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      email TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'user',
      status TEXT NOT NULL DEFAULT 'active',
      credit_balance INTEGER NOT NULL DEFAULT 0,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      last_login_at TIMESTAMPTZ
    );

    CREATE TABLE IF NOT EXISTS sessions (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      token_hash TEXT NOT NULL UNIQUE,
      expires_at TIMESTAMPTZ NOT NULL,
      revoked_at TIMESTAMPTZ,
      ip TEXT,
      user_agent TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS credit_ledger (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      delta INTEGER NOT NULL,
      balance_after INTEGER NOT NULL,
      reason TEXT NOT NULL,
      meta_json JSONB NOT NULL DEFAULT '{}'::jsonb,
      operator_user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE INDEX IF NOT EXISTS sessions_user_id_idx ON sessions(user_id);
    CREATE INDEX IF NOT EXISTS sessions_token_hash_idx ON sessions(token_hash);
    CREATE INDEX IF NOT EXISTS credit_ledger_user_id_idx ON credit_ledger(user_id);
  `);

  databaseReady = true;
  databaseInitError = null;
  await bootstrapAdminAccount();
}

function serializeUser(row) {
  return {
    id: row.id,
    email: row.email,
    role: row.role,
    status: row.status,
    creditBalance: Number(row.credit_balance ?? row.creditBalance ?? 0),
    createdAt: row.created_at,
    lastLoginAt: row.last_login_at,
  };
}

async function createSessionForUser(userId, request) {
  assertAuthReady();
  const token = createSessionToken();
  const sessionId = generateId('ses');
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS);

  await pool.query(
    `INSERT INTO sessions (
      id,
      user_id,
      token_hash,
      expires_at,
      revoked_at,
      ip,
      user_agent,
      created_at
    ) VALUES ($1, $2, $3, $4, NULL, $5, $6, NOW())`,
    [
      sessionId,
      userId,
      hashToken(token),
      expiresAt,
      getClientIp(request),
      String(request.headers['user-agent'] || '').slice(0, 512),
    ],
  );

  return { token, expiresAt, sessionId };
}

async function revokeSessionByToken(token) {
  if (!token || !pool) {
    return;
  }

  await pool.query(
    `UPDATE sessions SET revoked_at = NOW() WHERE token_hash = $1 AND revoked_at IS NULL`,
    [hashToken(token)],
  );
}

async function revokeSessionById(sessionId) {
  if (!sessionId || !pool) {
    return;
  }

  await pool.query(
    `UPDATE sessions SET revoked_at = NOW() WHERE id = $1 AND revoked_at IS NULL`,
    [sessionId],
  );
}

async function touchSession(sessionId) {
  if (!sessionId || !pool) {
    return new Date(Date.now() + SESSION_TTL_MS);
  }

  const expiresAt = new Date(Date.now() + SESSION_TTL_MS);
  await pool.query(`UPDATE sessions SET expires_at = $2 WHERE id = $1`, [sessionId, expiresAt]);
  return expiresAt;
}

async function getSessionContext(request) {
  if (request.__sessionResolved) {
    return request.__sessionContext;
  }

  request.__sessionResolved = true;

  if (!pool || !databaseReady || databaseInitError || !privateConfig.app.session_secret) {
    request.__sessionContext = null;
    return null;
  }

  const cookies = parseCookies(request.headers.cookie || '');
  const token = cookies[SESSION_COOKIE_NAME];
  if (!token) {
    request.__sessionContext = null;
    return null;
  }

  const result = await pool.query(
    `SELECT
      s.id AS session_id,
      s.user_id,
      s.expires_at,
      s.revoked_at,
      u.id,
      u.email,
      u.password_hash,
      u.role,
      u.status,
      u.credit_balance,
      u.created_at,
      u.last_login_at
    FROM sessions s
    JOIN users u ON u.id = s.user_id
    WHERE s.token_hash = $1
    LIMIT 1`,
    [hashToken(token)],
  );

  if (!result.rowCount) {
    request.__sessionContext = null;
    return null;
  }

  const row = result.rows[0];
  if (row.revoked_at || new Date(row.expires_at).getTime() <= Date.now()) {
    await revokeSessionById(row.session_id);
    request.__sessionContext = null;
    return null;
  }

  request.__sessionContext = {
    token,
    sessionId: row.session_id,
    user: serializeUser(row),
  };
  return request.__sessionContext;
}

async function requireAuthenticatedUser(request, response, options = {}) {
  assertAuthReady();
  const session = await getSessionContext(request);
  if (!session) {
    clearSessionCookie(response, request);
    throw new ApiError(401, 'UNAUTHORIZED', '请先登录后再继续');
  }

  if (session.user.status !== 'active') {
    await revokeSessionById(session.sessionId);
    clearSessionCookie(response, request);
    throw new ApiError(403, 'ACCOUNT_DISABLED', '账号已被停用，请联系管理员');
  }

  if (options.admin && session.user.role !== 'admin') {
    throw new ApiError(403, 'FORBIDDEN', '无权访问该功能');
  }

  const expiresAt = await touchSession(session.sessionId);
  setSessionCookie(response, request, session.token, expiresAt);
  return session.user;
}

async function registerUser({ email, password, inviteCode }, request, response) {
  assertAuthReady();
  const normalizedEmail = normalizeEmail(email);
  const normalizedPassword = String(password || '');
  const normalizedInviteCode = String(inviteCode || '').trim();

  if (!isValidEmail(normalizedEmail)) {
    throw new ApiError(400, 'INVALID_EMAIL', '请输入有效的邮箱地址');
  }

  if (normalizedPassword.length < 6) {
    throw new ApiError(400, 'PASSWORD_TOO_SHORT', '密码至少需要 6 位');
  }

  if (!privateConfig.app.invite_code) {
    throw new ApiError(503, 'INVITE_CODE_UNAVAILABLE', '邀请码系统尚未配置完成');
  }

  if (normalizedInviteCode !== privateConfig.app.invite_code) {
    throw new ApiError(403, 'INVALID_INVITE_CODE', '邀请码不正确');
  }

  const user = await withTransaction(async (client) => {
    const existing = await client.query(`SELECT id FROM users WHERE email = $1`, [normalizedEmail]);
    if (existing.rowCount) {
      throw new ApiError(409, 'EMAIL_EXISTS', '该邮箱已经注册');
    }

    const userId = generateId('usr');
    const passwordHash = await hashPassword(normalizedPassword);
    await client.query(
      `INSERT INTO users (
        id,
        email,
        password_hash,
        role,
        status,
        credit_balance,
        created_at,
        last_login_at
      ) VALUES ($1, $2, $3, 'user', 'active', $4, NOW(), NULL)`,
      [userId, normalizedEmail, passwordHash, STARTER_CREDITS],
    );

    await client.query(
      `INSERT INTO credit_ledger (
        id,
        user_id,
        delta,
        balance_after,
        reason,
        meta_json,
        operator_user_id,
        created_at
      ) VALUES ($1, $2, $3, $4, $5, $6::jsonb, NULL, NOW())`,
      [
        generateId('led'),
        userId,
        STARTER_CREDITS,
        STARTER_CREDITS,
        'signup_bonus',
        JSON.stringify({ source: 'register' }),
      ],
    );

    const created = await client.query(`SELECT * FROM users WHERE id = $1`, [userId]);
    return serializeUser(created.rows[0]);
  });

  const session = await createSessionForUser(user.id, request);
  setSessionCookie(response, request, session.token, session.expiresAt);
  await pool.query(`UPDATE users SET last_login_at = NOW() WHERE id = $1`, [user.id]);

  return {
    authenticated: true,
    user: {
      ...user,
      lastLoginAt: new Date().toISOString(),
    },
    creditBalance: user.creditBalance,
  };
}

async function loginUser({ email, password }, request, response) {
  assertAuthReady();
  const normalizedEmail = normalizeEmail(email);
  const normalizedPassword = String(password || '');

  if (!normalizedEmail || !normalizedPassword) {
    throw new ApiError(400, 'MISSING_CREDENTIALS', '请输入邮箱和密码');
  }

  const result = await pool.query(`SELECT * FROM users WHERE email = $1 LIMIT 1`, [normalizedEmail]);
  if (!result.rowCount) {
    throw new ApiError(401, 'INVALID_CREDENTIALS', '邮箱或密码不正确');
  }

  const userRow = result.rows[0];
  if (!(await verifyPassword(normalizedPassword, userRow.password_hash))) {
    throw new ApiError(401, 'INVALID_CREDENTIALS', '邮箱或密码不正确');
  }

  if (userRow.status !== 'active') {
    throw new ApiError(403, 'ACCOUNT_DISABLED', '账号已被停用，请联系管理员');
  }

  const session = await createSessionForUser(userRow.id, request);
  setSessionCookie(response, request, session.token, session.expiresAt);
  await pool.query(`UPDATE users SET last_login_at = NOW() WHERE id = $1`, [userRow.id]);

  const user = serializeUser({
    ...userRow,
    last_login_at: new Date().toISOString(),
  });

  return {
    authenticated: true,
    user,
    creditBalance: user.creditBalance,
  };
}

async function getCurrentAuthState(request, response) {
  if (!pool || databaseInitError || !privateConfig.app.session_secret) {
    return {
      authenticated: false,
      configured: isAuthConfigured() && !databaseInitError,
      user: null,
      creditBalance: null,
    };
  }

  if (!databaseReady) {
    return {
      authenticated: false,
      configured: true,
      user: null,
      creditBalance: null,
    };
  }

  const session = await getSessionContext(request);
  if (!session) {
    clearSessionCookie(response, request);
    return {
      authenticated: false,
      configured: true,
      user: null,
      creditBalance: null,
    };
  }

  if (session.user.status !== 'active') {
    await revokeSessionById(session.sessionId);
    clearSessionCookie(response, request);
    throw new ApiError(403, 'ACCOUNT_DISABLED', '账号已被停用，请联系管理员');
  }

  const expiresAt = await touchSession(session.sessionId);
  setSessionCookie(response, request, session.token, expiresAt);
  return {
    authenticated: true,
    configured: true,
    user: session.user,
    creditBalance: session.user.creditBalance,
  };
}

async function listUsers() {
  assertDatabaseReady();
  const result = await pool.query(
    `SELECT id, email, role, status, credit_balance, created_at, last_login_at
     FROM users
     ORDER BY created_at DESC`,
  );

  return result.rows.map(serializeUser);
}

async function updateUserStatus({ operatorUserId, userId, status }) {
  assertDatabaseReady();

  return withTransaction(async (client) => {
    const target = await client.query(`SELECT * FROM users WHERE id = $1 LIMIT 1`, [userId]);
    if (!target.rowCount) {
      throw new ApiError(404, 'USER_NOT_FOUND', '用户不存在');
    }

    const targetUser = target.rows[0];
    if (targetUser.id === operatorUserId && status !== 'active') {
      throw new ApiError(400, 'CANNOT_DISABLE_SELF', '不能停用当前管理员账号');
    }

    await client.query(`UPDATE users SET status = $2 WHERE id = $1`, [userId, status]);

    if (status !== 'active') {
      await client.query(`UPDATE sessions SET revoked_at = NOW() WHERE user_id = $1 AND revoked_at IS NULL`, [userId]);
    }

    const updated = await client.query(`SELECT * FROM users WHERE id = $1`, [userId]);
    return serializeUser(updated.rows[0]);
  });
}

async function setUserCreditBalance({ operatorUserId, userId, balance }) {
  assertDatabaseReady();

  return withTransaction(async (client) => {
    const target = await client.query(
      `SELECT id, credit_balance FROM users WHERE id = $1 LIMIT 1`,
      [userId],
    );

    if (!target.rowCount) {
      throw new ApiError(404, 'USER_NOT_FOUND', '用户不存在');
    }

    const currentBalance = Number(target.rows[0].credit_balance || 0);
    const nextBalance = Number(balance);
    if (!Number.isInteger(nextBalance) || nextBalance < 0) {
      throw new ApiError(400, 'INVALID_BALANCE', '算粒余额必须是大于等于 0 的整数');
    }

    const delta = nextBalance - currentBalance;
    await client.query(`UPDATE users SET credit_balance = $2 WHERE id = $1`, [userId, nextBalance]);
    await client.query(
      `INSERT INTO credit_ledger (
        id,
        user_id,
        delta,
        balance_after,
        reason,
        meta_json,
        operator_user_id,
        created_at
      ) VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7, NOW())`,
      [
        generateId('led'),
        userId,
        delta,
        nextBalance,
        'admin_set_balance',
        JSON.stringify({ previousBalance: currentBalance }),
        operatorUserId,
      ],
    );

    const updated = await client.query(`SELECT * FROM users WHERE id = $1`, [userId]);
    return serializeUser(updated.rows[0]);
  });
}

function findValueByKeys(root, keys) {
  if (!root || typeof root !== 'object') {
    return null;
  }

  const keySet = new Set(keys);
  const queue = [root];
  const visited = new Set();

  while (queue.length) {
    const current = queue.shift();
    if (!current || typeof current !== 'object' || visited.has(current)) {
      continue;
    }

    visited.add(current);

    for (const [key, value] of Object.entries(current)) {
      if (keySet.has(key) && value !== undefined && value !== null) {
        return value;
      }

      if (typeof value === 'object') {
        queue.push(value);
      }
    }
  }

  return null;
}

function normalizePngData(value) {
  if (!value) {
    return '';
  }

  const raw = String(value).trim();
  if (!raw) {
    return '';
  }

  if (raw.startsWith('data:image/')) {
    return raw;
  }

  if (/^https?:\/\//i.test(raw)) {
    return raw;
  }

  return `data:image/png;base64,${raw.replace(/\s+/g, '')}`;
}

function normalizeSvgText(value) {
  if (!value) {
    return '';
  }

  const raw = String(value).trim();
  if (!raw) {
    return '';
  }

  if (raw.startsWith('<svg')) {
    return raw;
  }

  if (raw.startsWith('data:image/svg+xml')) {
    const commaIndex = raw.indexOf(',');
    if (commaIndex === -1) {
      return '';
    }

    const encoded = raw.slice(commaIndex + 1);
    try {
      return decodeURIComponent(encoded);
    } catch {
      return '';
    }
  }

  return raw;
}

function extractSvgResult(payload) {
  return {
    svgText: normalizeSvgText(
      findValueByKeys(payload, ['svgText', 'svg', 'svg_text', 'svgContent', 'svg_content']),
    ),
    pngDataUrl: normalizePngData(
      findValueByKeys(payload, [
        'base64Png',
        'pngBase64',
        'base64_png',
        'png_data',
        'pngData',
        'png_url',
        'pngUrl',
      ]),
    ),
  };
}

function extractUpstreamErrorMessage(payload, status) {
  const nestedError = payload?.error && typeof payload.error === 'object' ? payload.error : null;
  const candidates = [
    nestedError?.message,
    payload?.message,
    payload?.detail,
    payload?.reason,
    typeof payload?.error === 'string' ? payload.error : '',
    findValueByKeys(payload, ['message', 'detail', 'reason']),
  ];
  const message = candidates.find((value) => typeof value === 'string' && value.trim());
  return message || `SVG 服务请求失败（${status}）`;
}

function sanitizeStyleParams(rawValue = {}) {
  return {
    style: ALLOWED_STYLE_PARAMS.style.has(rawValue.style) ? rawValue.style : 'line_art',
    color_mode: ALLOWED_STYLE_PARAMS.color_mode.has(rawValue.color_mode)
      ? rawValue.color_mode
      : 'few_colors',
    image_complexity: ALLOWED_STYLE_PARAMS.image_complexity.has(rawValue.image_complexity)
      ? rawValue.image_complexity
      : 'illustration',
    text: ALLOWED_STYLE_PARAMS.text.has(rawValue.text) ? rawValue.text : '',
    composition: ALLOWED_STYLE_PARAMS.composition.has(rawValue.composition)
      ? rawValue.composition
      : 'objects_in_grid',
  };
}

function sanitizeGeneratePayload(body) {
  const prompt = String(body.prompt || '').trim();
  if (!prompt) {
    throw new ApiError(400, 'INVALID_PROMPT', '请先输入生成描述');
  }

  const quality = ALLOWED_QUALITY.has(body.quality) ? body.quality : 'medium';
  const background = ALLOWED_BACKGROUND.has(body.background) ? body.background : 'transparent';
  const aspectRatio = ALLOWED_ASPECT_RATIO.has(body.aspectRatio) ? body.aspectRatio : 'auto';

  return {
    prompt,
    quality,
    background,
    aspectRatio,
    svgText: true,
    base64Png: true,
    storage: false,
    styleParams: sanitizeStyleParams(body.styleParams),
  };
}

function getCreditCost(mode, quality) {
  const nextMode = mode === 'edit' ? 'edit' : 'generate';
  return CREDIT_COSTS[nextMode]?.[quality] ?? CREDIT_COSTS[nextMode].medium;
}

async function reserveCredits({ userId, cost, reason, meta }) {
  return withTransaction(async (client) => {
    const result = await client.query(
      `UPDATE users
       SET credit_balance = credit_balance - $2
       WHERE id = $1 AND status = 'active' AND credit_balance >= $2
       RETURNING credit_balance`,
      [userId, cost],
    );

    if (!result.rowCount) {
      throw new ApiError(402, 'INSUFFICIENT_CREDITS', '算粒不足，请联系佐糖团队充值');
    }

    const balanceAfter = Number(result.rows[0].credit_balance || 0);
    await client.query(
      `INSERT INTO credit_ledger (
        id,
        user_id,
        delta,
        balance_after,
        reason,
        meta_json,
        operator_user_id,
        created_at
      ) VALUES ($1, $2, $3, $4, $5, $6::jsonb, NULL, NOW())`,
      [
        generateId('led'),
        userId,
        -cost,
        balanceAfter,
        reason,
        JSON.stringify(meta || {}),
      ],
    );

    return balanceAfter;
  });
}

async function refundCredits({ userId, amount, reason, meta }) {
  return withTransaction(async (client) => {
    const result = await client.query(
      `UPDATE users
       SET credit_balance = credit_balance + $2
       WHERE id = $1
       RETURNING credit_balance`,
      [userId, amount],
    );

    if (!result.rowCount) {
      throw new ApiError(404, 'USER_NOT_FOUND', '用户不存在');
    }

    const balanceAfter = Number(result.rows[0].credit_balance || 0);
    await client.query(
      `INSERT INTO credit_ledger (
        id,
        user_id,
        delta,
        balance_after,
        reason,
        meta_json,
        operator_user_id,
        created_at
      ) VALUES ($1, $2, $3, $4, $5, $6::jsonb, NULL, NOW())`,
      [
        generateId('led'),
        userId,
        amount,
        balanceAfter,
        reason,
        JSON.stringify(meta || {}),
      ],
    );

    return balanceAfter;
  });
}

async function callSvgGenerate(payload) {
  const response = await fetch(`${privateConfig.svg.base_url}/generate`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': buildApiKey(privateConfig.svg.api_key),
    },
    body: JSON.stringify(payload),
  });

  const rawText = await response.text();
  const parsed = tryParseJsonText(rawText);

  if (!response.ok) {
    throw new ApiError(
      response.status >= 500 ? 502 : 400,
      'SVG_UPSTREAM_ERROR',
      parsed ? extractUpstreamErrorMessage(parsed, response.status) : `SVG 服务请求失败（${response.status}）`,
    );
  }

  if (!parsed) {
    throw new ApiError(502, 'SVG_UPSTREAM_INVALID', 'SVG 服务返回的数据无法解析');
  }

  const result = extractSvgResult(parsed);
  if (!result.svgText && !result.pngDataUrl) {
    throw new ApiError(502, 'SVG_UPSTREAM_INVALID', 'SVG 服务未返回可用的 SVG 或 PNG 数据');
  }

  return result;
}

function validateEditMultipart(buffer, contentType) {
  if (!String(contentType || '').toLowerCase().includes('multipart/form-data')) {
    throw new ApiError(400, 'INVALID_UPLOAD', '编辑请求必须上传 SVG 或 PNG 文件');
  }

  if (!buffer.length) {
    throw new ApiError(400, 'INVALID_UPLOAD', '上传内容为空');
  }

  const head = buffer.slice(0, Math.min(buffer.length, 20000)).toString('utf8');
  const hasAcceptedFileName = /filename="[^"]+\.(svg|png)"/i.test(head);
  const hasAcceptedMime = /Content-Type:\s*image\/(svg\+xml|png)/i.test(head);

  if (!hasAcceptedFileName || !hasAcceptedMime) {
    throw new ApiError(400, 'INVALID_UPLOAD', '仅支持上传 SVG 或 PNG 文件');
  }
}

async function callSvgEdit(buffer, contentType) {
  const response = await fetch(`${privateConfig.svg.base_url}/edit`, {
    method: 'POST',
    headers: {
      'Content-Type': contentType,
      'x-api-key': buildApiKey(privateConfig.svg.api_key),
    },
    body: buffer,
  });

  const rawText = await response.text();
  const parsed = tryParseJsonText(rawText);

  if (!response.ok) {
    throw new ApiError(
      response.status >= 500 ? 502 : 400,
      'SVG_UPSTREAM_ERROR',
      parsed ? extractUpstreamErrorMessage(parsed, response.status) : `SVG 服务请求失败（${response.status}）`,
    );
  }

  if (!parsed) {
    throw new ApiError(502, 'SVG_UPSTREAM_INVALID', 'SVG 服务返回的数据无法解析');
  }

  const result = extractSvgResult(parsed);
  if (!result.svgText && !result.pngDataUrl) {
    throw new ApiError(502, 'SVG_UPSTREAM_INVALID', 'SVG 服务未返回可用的 SVG 或 PNG 数据');
  }

  return result;
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

function resolveStaticFilePath(requestPath) {
  const pathname = requestPath === '/' ? '/index.html' : requestPath;
  const normalized = path.normalize(decodeURIComponent(pathname)).replace(/^([.]{2}[\\/])+/, '');
  const rewritten = normalized === '/admin' ? '/admin.html' : normalized;
  const filePath = path.join(distDir, rewritten);

  if (!filePath.startsWith(distDir)) {
    return null;
  }

  return filePath;
}

function serveFile(response, filePath) {
  if (!filePath || !fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
    return false;
  }

  const contentType = contentTypeByExt(filePath);
  const isHtml = filePath.endsWith('.html');
  response.writeHead(
    200,
    buildResponseHeaders({
      'Content-Type': contentType,
      'Cache-Control': isHtml ? 'no-store' : 'public, max-age=3600',
    }),
  );
  fs.createReadStream(filePath).pipe(response);
  return true;
}

function isProtectedApiPath(pathname) {
  return pathname.startsWith('/api/auth/') || pathname.startsWith('/api/svg/') || pathname.startsWith('/api/admin/');
}

function getUserIdFromPathname(pathname) {
  const match = pathname.match(/^\/api\/admin\/users\/([^/]+)\/(disable|enable|credits)$/);
  return match ? { userId: decodeURIComponent(match[1]), action: match[2] } : null;
}

async function handleSvgGenerate(request, response) {
  const user = await requireAuthenticatedUser(request, response);
  const payload = sanitizeGeneratePayload(await readJsonBody(request));
  const cost = getCreditCost('generate', payload.quality);

  await reserveCredits({
    userId: user.id,
    cost,
    reason: 'svg_generate_charge',
    meta: { quality: payload.quality },
  });

  try {
    const result = await callSvgGenerate(payload);
    const latestUser = await pool.query(`SELECT credit_balance FROM users WHERE id = $1`, [user.id]);
    sendJson(response, 200, {
      result,
      creditBalance: Number(latestUser.rows[0]?.credit_balance || 0),
    });
  } catch (error) {
    let refundedBalance = null;
    try {
      refundedBalance = await refundCredits({
        userId: user.id,
        amount: cost,
        reason: 'svg_generate_refund',
        meta: { quality: payload.quality },
      });
    } catch (refundError) {
      console.error('Failed to refund generate credits', refundError);
    }

    if (error instanceof ApiError) {
      if (refundedBalance !== null) {
        error.details.creditBalance = refundedBalance;
      }
      throw error;
    }

    throw error;
  }
}

async function handleSvgEdit(request, response) {
  const user = await requireAuthenticatedUser(request, response);
  const contentType = String(request.headers['content-type'] || '');
  const bodyBuffer = await readBodyBuffer(request, EDIT_UPLOAD_LIMIT_BYTES);
  validateEditMultipart(bodyBuffer, contentType);

  const qualityMatch = bodyBuffer.toString('utf8', 0, Math.min(bodyBuffer.length, 12000)).match(/name="quality"\r\n\r\n([^\r\n]+)/i);
  const quality = ALLOWED_QUALITY.has(qualityMatch?.[1]) ? qualityMatch[1] : 'medium';
  const cost = getCreditCost('edit', quality);

  await reserveCredits({
    userId: user.id,
    cost,
    reason: 'svg_edit_charge',
    meta: { quality },
  });

  try {
    const result = await callSvgEdit(bodyBuffer, contentType);
    const latestUser = await pool.query(`SELECT credit_balance FROM users WHERE id = $1`, [user.id]);
    sendJson(response, 200, {
      result,
      creditBalance: Number(latestUser.rows[0]?.credit_balance || 0),
    });
  } catch (error) {
    let refundedBalance = null;
    try {
      refundedBalance = await refundCredits({
        userId: user.id,
        amount: cost,
        reason: 'svg_edit_refund',
        meta: { quality },
      });
    } catch (refundError) {
      console.error('Failed to refund edit credits', refundError);
    }

    if (error instanceof ApiError) {
      if (refundedBalance !== null) {
        error.details.creditBalance = refundedBalance;
      }
      throw error;
    }

    throw error;
  }
}

const server = http.createServer(async (request, response) => {
  try {
    const requestUrl = new URL(request.url, `http://${request.headers.host || 'localhost'}`);
    const pathname = requestUrl.pathname;
    const method = request.method || 'GET';

    if (pathname.startsWith('/api/') && method === 'POST') {
      assertTrustedOrigin(request);
    }

    if (method === 'POST' && pathname === '/api/deepseek/optimize') {
      const body = await readJsonBody(request);
      const count = Math.max(1, Number(body.count || 1));
      const result = await optimizePrompt(body.prompt || '', count);
      sendJson(response, 200, result);
      return;
    }

    if (method === 'POST' && pathname === '/api/flux/generate') {
      const body = await readJsonBody(request);
      const result = await generateImage(body);
      sendJson(response, 200, result);
      return;
    }

    if (method === 'GET' && pathname === '/api/image') {
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

      response.writeHead(
        200,
        buildResponseHeaders({
          'Content-Type': upstream.headers.get('content-type') || 'image/png',
          'Cache-Control': 'public, max-age=3600',
        }),
      );

      if (!upstream.body) {
        response.end();
        return;
      }

      await pipeline(Readable.fromWeb(upstream.body), response);
      return;
    }

    if (['GET', 'HEAD'].includes(method) && pathname === '/healthz') {
      sendJson(response, 200, {
        ok: true,
        databaseReady,
        databaseConfigured: Boolean(pool),
      });
      return;
    }

    if (method === 'GET' && pathname === '/api/auth/me') {
      const state = await getCurrentAuthState(request, response);
      sendJson(response, 200, state, response.getHeader('Set-Cookie') ? { 'Set-Cookie': response.getHeader('Set-Cookie') } : {});
      return;
    }

    if (method === 'POST' && pathname === '/api/auth/register') {
      assertRateLimit('register', getClientIp(request), 10, 10 * 60 * 1000);
      const body = await readJsonBody(request);
      const result = await registerUser(body, request, response);
      sendJson(response, 200, result, { 'Set-Cookie': response.getHeader('Set-Cookie') });
      return;
    }

    if (method === 'POST' && pathname === '/api/auth/login') {
      assertRateLimit('login', getClientIp(request), 12, 10 * 60 * 1000);
      const body = await readJsonBody(request);
      const result = await loginUser(body, request, response);
      sendJson(response, 200, result, { 'Set-Cookie': response.getHeader('Set-Cookie') });
      return;
    }

    if (method === 'POST' && pathname === '/api/auth/logout') {
      const cookies = parseCookies(request.headers.cookie || '');
      await revokeSessionByToken(cookies[SESSION_COOKIE_NAME]);
      clearSessionCookie(response, request);
      sendNoContent(response, { 'Set-Cookie': response.getHeader('Set-Cookie') });
      return;
    }

    if (method === 'POST' && pathname === '/api/svg/generate') {
      assertRateLimit('svg', getClientIp(request), 40, 60 * 1000);
      await handleSvgGenerate(request, response);
      return;
    }

    if (method === 'POST' && pathname === '/api/svg/edit') {
      assertRateLimit('svg', getClientIp(request), 40, 60 * 1000);
      await handleSvgEdit(request, response);
      return;
    }

    if (method === 'GET' && pathname === '/api/admin/users') {
      await requireAuthenticatedUser(request, response, { admin: true });
      const users = await listUsers();
      sendJson(response, 200, { users }, response.getHeader('Set-Cookie') ? { 'Set-Cookie': response.getHeader('Set-Cookie') } : {});
      return;
    }

    if (method === 'POST') {
      const adminTarget = getUserIdFromPathname(pathname);
      if (adminTarget) {
        const operator = await requireAuthenticatedUser(request, response, { admin: true });

        if (adminTarget.action === 'disable' || adminTarget.action === 'enable') {
          const updatedUser = await updateUserStatus({
            operatorUserId: operator.id,
            userId: adminTarget.userId,
            status: adminTarget.action === 'disable' ? 'disabled' : 'active',
          });
          sendJson(response, 200, { user: updatedUser }, response.getHeader('Set-Cookie') ? { 'Set-Cookie': response.getHeader('Set-Cookie') } : {});
          return;
        }

        if (adminTarget.action === 'credits') {
          const body = await readJsonBody(request);
          const updatedUser = await setUserCreditBalance({
            operatorUserId: operator.id,
            userId: adminTarget.userId,
            balance: body.balance,
          });
          sendJson(response, 200, { user: updatedUser }, response.getHeader('Set-Cookie') ? { 'Set-Cookie': response.getHeader('Set-Cookie') } : {});
          return;
        }
      }
    }

    if (pathname.startsWith('/api/')) {
      throw new ApiError(404, 'NOT_FOUND', '接口不存在');
    }

    const filePath = resolveStaticFilePath(pathname);
    if (serveFile(response, filePath)) {
      return;
    }

    if (!path.extname(pathname)) {
      if (serveFile(response, path.join(distDir, 'index.html'))) {
        return;
      }
    }

    sendText(response, 404, 'Not found');
  } catch (error) {
    if (error instanceof ApiError) {
      sendApiError(response, error, response.getHeader('Set-Cookie') ? { 'Set-Cookie': response.getHeader('Set-Cookie') } : {});
      return;
    }

    console.error(error);
    sendApiError(response, error, response.getHeader('Set-Cookie') ? { 'Set-Cookie': response.getHeader('Set-Cookie') } : {});
  }
});

initDatabase().catch((error) => {
  databaseInitError = error;
  databaseReady = false;
  console.error('Database init failed:', error);
});

server.listen(port, '0.0.0.0', () => {
  console.log(`Server running at http://0.0.0.0:${port}`);
});

process.on('SIGTERM', async () => {
  if (pool) {
    await pool.end().catch(() => {});
  }
  process.exit(0);
});
