import { urlToDataUrl } from './download.js';

async function readJson(response) {
  const raw = await response.text();
  let payload = {};

  try {
    payload = raw ? JSON.parse(raw) : {};
  } catch {
    if (response.ok) {
      throw new Error('服务返回了异常响应，请重试');
    }

    throw new Error(raw || `请求失败（${response.status}）`);
  }

  if (!response.ok) {
    throw new Error(payload?.error || `请求失败（${response.status}）`);
  }

  return payload;
}

export async function optimizePrompt(_config, prompt, count = 1) {
  const response = await fetch('/api/deepseek/optimize', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      prompt,
      count,
    }),
  });

  const payload = await readJson(response);

  return {
    positivePrompt: payload.positivePrompt || '',
    positivePrompts: Array.isArray(payload.positivePrompts)
      ? payload.positivePrompts.filter(Boolean)
      : payload.positivePrompt
        ? [payload.positivePrompt]
        : [],
    raw: '',
  };
}

export async function generateOneImage(model, params) {
  const response = await fetch('/api/flux/generate', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      modelId: model.id,
      prompt: params.prompt,
      width: params.width,
      height: params.height,
      seed: params.seed,
    }),
  });

  const payload = await readJson(response);
  let dataUrl = null;

  try {
    dataUrl = await urlToDataUrl(payload.url);
  } catch {
    dataUrl = null;
  }

  return {
    taskId: payload.taskId,
    url: payload.url,
    dataUrl,
    storageKind: dataUrl ? 'data-url' : 'proxy-url',
  };
}
