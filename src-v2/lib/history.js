const HISTORY_STORAGE_KEY = 'glowpaper:v2:history';
const HISTORY_LIMIT = 50;

function getSafeStorage() {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      return window.localStorage;
    }
  } catch {
    // Ignore storage access errors.
  }

  return null;
}

function sortByTimeDesc(items) {
  return [...items].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  );
}

function normalizeHistoryItem(item) {
  if (!item || typeof item !== 'object') {
    return null;
  }

  const id = String(item.id || '').trim();
  const createdAt = String(item.createdAt || '').trim();
  const prompt = String(item.prompt || '').trim();

  if (!id || !createdAt || !prompt) {
    return null;
  }

  const svgText = String(item.result?.svgText || '').trim();
  const pngDataUrl = String(item.result?.pngDataUrl || '').trim();

  if (!svgText && !pngDataUrl) {
    return null;
  }

  return {
    id,
    mode: item.mode === 'edit' ? 'edit' : 'generate',
    createdAt,
    prompt,
    sourceFileName: item.sourceFileName ? String(item.sourceFileName) : '',
    params: {
      quality: String(item.params?.quality || '').trim(),
      background: String(item.params?.background || '').trim(),
      aspectRatio: String(item.params?.aspectRatio || '').trim(),
      styleParams: {
        style: String(item.params?.styleParams?.style || '').trim(),
        color_mode: String(item.params?.styleParams?.color_mode || '').trim(),
        image_complexity: String(item.params?.styleParams?.image_complexity || '').trim(),
        text: String(item.params?.styleParams?.text || '').trim(),
        composition: String(item.params?.styleParams?.composition || '').trim(),
      },
    },
    result: {
      svgText,
      pngDataUrl,
    },
  };
}

function parseStoredHistory(rawValue) {
  if (!rawValue) {
    return [];
  }

  try {
    const parsed = JSON.parse(rawValue);
    if (!Array.isArray(parsed)) {
      return [];
    }

    const normalized = parsed
      .map(normalizeHistoryItem)
      .filter(Boolean)
      .slice(0, HISTORY_LIMIT);

    return sortByTimeDesc(normalized).slice(0, HISTORY_LIMIT);
  } catch {
    return [];
  }
}

function persistWithTrim(items) {
  const storage = getSafeStorage();
  if (!storage) {
    return items;
  }

  let next = sortByTimeDesc(items).slice(0, HISTORY_LIMIT);

  while (next.length > 0) {
    try {
      storage.setItem(HISTORY_STORAGE_KEY, JSON.stringify(next));
      return next;
    } catch {
      next = next.slice(0, -1);
    }
  }

  try {
    storage.removeItem(HISTORY_STORAGE_KEY);
  } catch {
    // Ignore remove errors.
  }

  return [];
}

export function loadHistory() {
  const storage = getSafeStorage();
  if (!storage) {
    return [];
  }

  return parseStoredHistory(storage.getItem(HISTORY_STORAGE_KEY));
}

export function saveHistory(items) {
  return persistWithTrim(items);
}

export function addHistoryRecord(items, record) {
  const merged = sortByTimeDesc([record, ...items]);
  return saveHistory(merged.slice(0, HISTORY_LIMIT));
}

function getRecordId() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }

  return `rec-${Date.now()}-${Math.floor(Math.random() * 100000)}`;
}

export function buildHistoryRecord({ mode, prompt, params, sourceFileName, result }) {
  return {
    id: getRecordId(),
    mode: mode === 'edit' ? 'edit' : 'generate',
    createdAt: new Date().toISOString(),
    prompt: String(prompt || '').trim(),
    sourceFileName: String(sourceFileName || '').trim(),
    params: {
      quality: params.quality,
      background: params.background,
      aspectRatio: params.aspectRatio,
      styleParams: {
        ...params.styleParams,
      },
    },
    result: {
      svgText: String(result.svgText || ''),
      pngDataUrl: String(result.pngDataUrl || ''),
    },
  };
}
