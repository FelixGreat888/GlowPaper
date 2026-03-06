import { GLOWPAPER_CONFIG } from '../config.js';

function buildApiKey(rawKey) {
  const value = String(rawKey || '').trim();
  if (!value) {
    throw new Error('请先在 src-v2/config.js 中填写 API Key');
  }

  return value.startsWith('svgmaker-io') ? value : `svgmaker-io${value}`;
}

function parseJsonSafely(text) {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
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

function extractCredits(payload, headers) {
  const fromHeader =
    headers.get('x-credits-remaining') ||
    headers.get('x-credit-balance') ||
    headers.get('x-credits');

  if (fromHeader !== null) {
    return String(fromHeader);
  }

  const fromBody = findValueByKeys(payload, [
    'credits',
    'credit',
    'remainingCredits',
    'creditsRemaining',
    'remaining_credits',
    'credit_balance',
  ]);

  if (fromBody === null || fromBody === undefined || fromBody === '') {
    return null;
  }

  return String(fromBody);
}

function extractResult(payload) {
  const svgText = normalizeSvgText(
    findValueByKeys(payload, ['svgText', 'svg', 'svg_text', 'svgContent', 'svg_content']),
  );

  const base64Png = normalizePngData(
    findValueByKeys(payload, [
      'base64Png',
      'pngBase64',
      'base64_png',
      'png_data',
      'pngData',
      'png_url',
      'pngUrl',
    ]),
  );

  return {
    svgText,
    pngDataUrl: base64Png,
  };
}

function buildApiError(message, response, extra = {}) {
  const error = new Error(message);
  error.status = response.status;

  Object.entries(extra).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') {
      error[key] = value;
    }
  });

  return error;
}

function extractErrorInfo(payload, response) {
  const nestedError =
    payload?.error && typeof payload.error === 'object' ? payload.error : null;

  const fallback = `请求失败（${response.status}）`;
  const messageCandidates = [
    nestedError?.message,
    payload?.message,
    payload?.detail,
    payload?.reason,
    typeof payload?.error === 'string' ? payload.error : '',
    findValueByKeys(payload, ['message', 'detail', 'reason']),
  ];

  const message = messageCandidates.find(
    (value) => typeof value === 'string' && value.trim(),
  );

  const codeCandidates = [
    nestedError?.code,
    payload?.code,
    findValueByKeys(payload, ['code', 'errorCode', 'error_code']),
  ];

  const code = codeCandidates.find(
    (value) => typeof value === 'string' && value.trim(),
  );

  const creditsRemaining = findValueByKeys(payload, [
    'creditsRemaining',
    'remainingCredits',
    'remaining_credits',
    'credit_balance',
  ]);

  return buildApiError(message || fallback, response, {
    code,
    creditsRemaining: creditsRemaining === null ? undefined : String(creditsRemaining),
  });
}

async function readApiError(response) {
  const raw = await response.text();
  if (!raw) {
    return buildApiError(`请求失败（${response.status}）`, response);
  }

  const parsed = parseJsonSafely(raw);
  if (!parsed) {
    return buildApiError(`请求失败（${response.status}）: ${raw}`, response);
  }

  return extractErrorInfo(parsed, response);
}

function getRequestHeaders() {
  return {
    'Content-Type': 'application/json',
    'x-api-key': buildApiKey(GLOWPAPER_CONFIG.apiKey),
  };
}

export async function generateSvg(requestBody) {
  const response = await fetch(`${GLOWPAPER_CONFIG.apiBaseUrl}/generate`, {
    method: 'POST',
    headers: getRequestHeaders(),
    body: JSON.stringify(requestBody),
  });

  if (!response.ok) {
    throw await readApiError(response);
  }

  const payload = await response.json();
  const result = extractResult(payload);

  if (!result.svgText && !result.pngDataUrl) {
    throw new Error('接口未返回可用的 SVG/PNG 数据');
  }

  return {
    result,
    credits: extractCredits(payload, response.headers),
  };
}

export async function editSvg(request) {
  const formData = new FormData();
  formData.append('image', request.image);
  formData.append('prompt', request.prompt);
  formData.append('quality', request.quality);
  formData.append('aspectRatio', request.aspectRatio);
  formData.append('background', request.background);
  formData.append('svgText', 'true');
  formData.append('base64Png', 'true');
  formData.append('storage', 'false');
  formData.append('styleParams', JSON.stringify(request.styleParams));

  const response = await fetch(`${GLOWPAPER_CONFIG.apiBaseUrl}/edit`, {
    method: 'POST',
    headers: {
      'x-api-key': buildApiKey(GLOWPAPER_CONFIG.apiKey),
    },
    body: formData,
  });

  if (!response.ok) {
    throw await readApiError(response);
  }

  const payload = await response.json();
  const result = extractResult(payload);

  if (!result.svgText && !result.pngDataUrl) {
    throw new Error('接口未返回可用的 SVG/PNG 数据');
  }

  return {
    result,
    credits: extractCredits(payload, response.headers),
  };
}

function triggerDownload(blob, filename) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

export function downloadSvg(svgText) {
  if (!svgText) {
    throw new Error('暂无 SVG 内容可下载');
  }

  const blob = new Blob([svgText], { type: 'image/svg+xml;charset=utf-8' });
  triggerDownload(blob, `glowpaper-${Date.now()}.svg`);
}

export async function downloadPng(pngDataUrl) {
  if (!pngDataUrl) {
    throw new Error('暂无 PNG 内容可下载');
  }

  const response = await fetch(pngDataUrl);
  if (!response.ok) {
    throw new Error('PNG 下载失败');
  }

  const blob = await response.blob();
  triggerDownload(blob, `glowpaper-${Date.now()}.png`);
}

export function createSvgPreviewDataUrl(svgText) {
  if (!svgText) {
    return '';
  }

  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svgText)}`;
}
