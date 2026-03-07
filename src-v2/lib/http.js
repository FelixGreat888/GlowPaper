function parseJsonSafely(text) {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

function buildApiError(response, payload, fallbackMessage) {
  const nestedError =
    payload?.error && typeof payload.error === 'object' ? payload.error : null;

  const error = new Error(
    nestedError?.message ||
      payload?.message ||
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
      raw || `请求失败（${response.status}）`,
    );
  }

  return payload;
}

