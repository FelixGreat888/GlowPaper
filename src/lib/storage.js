const DB_NAME = 'vape-wallpaper-studio';
const STORE_NAME = 'app-cache';
const HISTORY_KEY = 'history-v2';
const FALLBACK_KEY = 'vape_wallpaper_history_v2';
const LEGACY_KEYS = ['vape_wallpaper_history_v1'];

function openDatabase() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);

    request.onerror = () => reject(request.error);
    request.onupgradeneeded = () => {
      const database = request.result;

      if (!database.objectStoreNames.contains(STORE_NAME)) {
        database.createObjectStore(STORE_NAME);
      }
    };
    request.onsuccess = () => resolve(request.result);
  });
}

function readFallbackHistory() {
  try {
    const fallbackKeys = [FALLBACK_KEY, ...LEGACY_KEYS];

    for (const key of fallbackKeys) {
      const raw = localStorage.getItem(key);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          return parsed;
        }
      }
    }

    return [];
  } catch {
    return [];
  }
}

export async function loadHistory() {
  try {
    const database = await openDatabase();

    return await new Promise((resolve, reject) => {
      const transaction = database.transaction(STORE_NAME, 'readonly');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.get(HISTORY_KEY);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        resolve(Array.isArray(request.result) ? request.result : readFallbackHistory());
      };
    });
  } catch {
    return readFallbackHistory();
  }
}

export async function saveHistory(history) {
  try {
    const database = await openDatabase();

    await new Promise((resolve, reject) => {
      const transaction = database.transaction(STORE_NAME, 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.put(history, HISTORY_KEY);

      request.onerror = () => reject(request.error);
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
    });
  } catch {
    try {
      localStorage.setItem(FALLBACK_KEY, JSON.stringify(history));
    } catch {
      // Ignore storage quota failures in the fallback path.
    }
  }
}
