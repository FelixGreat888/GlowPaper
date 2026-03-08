function parseJsonSafely(text) {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

function looksLikeHtmlDocument(text) {
  if (!text) {
    return false;
  }

  const sample = String(text).trim().slice(0, 240).toLowerCase();
  return (
    sample.startsWith('<!doctype html') ||
    sample.startsWith('<html') ||
    sample.includes('<head') ||
    sample.includes('<body') ||
    sample.includes('cloudflare')
  );
}

function getDefaultStatusMessage(status) {
  if (status === 401) {
    return '请先登录后再继续';
  }

  if (status === 402) {
    return '算粒不足，请联系佐糖团队充值';
  }

  if (status === 403) {
    return '当前账号无权执行此操作';
  }

  if (status >= 500) {
    return '服务暂时不可用，请稍后重试';
  }

  return `请求失败（${status}）`;
}

function buildApiError(response, payload, raw, fallbackMessage) {
  const nestedError =
    payload?.error && typeof payload.error === 'object' ? payload.error : null;

  const safeFallback =
    looksLikeHtmlDocument(raw) ? getDefaultStatusMessage(response.status) : raw;

  const error = new Error(
    nestedError?.message ||
      payload?.message ||
      safeFallback ||
      fallbackMessage ||
      `请求失败（${response.status}）`,
  );

  error.status = response.status;
  error.code = nestedError?.code || payload?.code || '';

  if (nestedError?.creditBalance !== undefined) {
    error.creditBalance = nestedError.creditBalance;
  }

  if (nestedError?.creditsRemaining !== undefined) {
    error.creditBalance = nestedError.creditsRemaining;
  }

  if (payload?.creditBalance !== undefined) {
    error.creditBalance = payload.creditBalance;
  }

  return error;
}

export async function requestApi(url, options = {}) {
  const headers = new Headers(options.headers || {});
  const init = {
    credentials: 'include',
    ...options,
    headers,
  };

  const hasBody =
    init.body !== undefined &&
    init.body !== null &&
    !(init.body instanceof FormData) &&
    !headers.has('Content-Type');

  if (hasBody) {
    headers.set('Content-Type', 'application/json');
    init.body = JSON.stringify(init.body);
  }

  const response = await fetch(url, init);

  if (response.status === 204) {
    return null;
  }

  const raw = await response.text();
  const payload = raw ? parseJsonSafely(raw) : null;

  if (!response.ok) {
    throw buildApiError(
      response,
      payload,
      raw,
      getDefaultStatusMessage(response.status),
    );
  }

  return payload;
}
