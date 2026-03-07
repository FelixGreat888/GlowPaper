import { requestApi } from './http.js';

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

    try {
      return decodeURIComponent(raw.slice(commaIndex + 1));
    } catch {
      return '';
    }
  }

  return raw;
}

function normalizeResult(payload) {
  return {
    svgText: normalizeSvgText(payload?.result?.svgText),
    pngDataUrl: normalizePngData(payload?.result?.pngDataUrl),
  };
}

export async function generateSvg(requestBody) {
  const payload = await requestApi('/api/svg/generate', {
    method: 'POST',
    body: requestBody,
  });

  const result = normalizeResult(payload);
  if (!result.svgText && !result.pngDataUrl) {
    throw new Error('接口未返回可用的 SVG/PNG 数据');
  }

  return {
    result,
    credits: payload?.creditBalance ?? null,
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

  const payload = await requestApi('/api/svg/edit', {
    method: 'POST',
    body: formData,
  });

  const result = normalizeResult(payload);
  if (!result.svgText && !result.pngDataUrl) {
    throw new Error('接口未返回可用的 SVG/PNG 数据');
  }

  return {
    result,
    credits: payload?.creditBalance ?? null,
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
