import { SavedSession, SavedSessionSummary } from '../types';

const DB_NAME = 'MedicalMappingAuditDB';
const DB_VERSION = 1;
const STORE_SESSIONS = 'sessions';
export const CURRENT_SESSION_ID = 'current_active_session';

/**
 * Khởi tạo hoặc kết nối tới IndexedDB
 */
function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined' || !window.indexedDB) {
      reject(new Error('IndexedDB không được hỗ trợ trên trình duyệt này.'));
      return;
    }

    const request = window.indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_SESSIONS)) {
        const store = db.createObjectStore(STORE_SESSIONS, { keyPath: 'id' });
        store.createIndex('savedAt', 'savedAt', { unique: false });
      }
    };

    request.onsuccess = () => {
      resolve(request.result);
    };

    request.onerror = () => {
      reject(request.error || new Error('Không thể mở IndexedDB.'));
    };
  });
}

/**
 * Tự động lưu phiên làm việc hiện tại vào IndexedDB (Auto-save)
 */
export async function autoSaveCurrentSession(session: SavedSession): Promise<void> {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(STORE_SESSIONS, 'readwrite');
      const store = transaction.objectStore(STORE_SESSIONS);

      const sessionToSave: SavedSession = {
        ...session,
        id: CURRENT_SESSION_ID,
        savedAt: new Date().toISOString(),
      };

      const request = store.put(sessionToSave);

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  } catch (err) {
    console.warn('Lỗi khi tự động lưu phiên vào IndexedDB:', err);
  }
}

/**
 * Nạp phiên làm việc gần nhất từ IndexedDB (để khôi phục sau khi reload/tắt tab)
 */
export async function loadCurrentSession(): Promise<SavedSession | null> {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(STORE_SESSIONS, 'readonly');
      const store = transaction.objectStore(STORE_SESSIONS);
      const request = store.get(CURRENT_SESSION_ID);

      request.onsuccess = () => {
        resolve((request.result as SavedSession) || null);
      };
      request.onerror = () => reject(request.error);
    });
  } catch (err) {
    console.warn('Lỗi khi đọc phiên từ IndexedDB:', err);
    return null;
  }
}

/**
 * Lưu một bản snapshot phiên làm việc có đặt tên (ví dụ: "Lưu mốc thẩm định đợt 1")
 */
export async function saveNamedSessionSnapshot(session: SavedSession): Promise<string> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_SESSIONS, 'readwrite');
    const store = transaction.objectStore(STORE_SESSIONS);

    const snapshotId = `snapshot_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const snapshot: SavedSession = {
      ...session,
      id: snapshotId,
      savedAt: new Date().toISOString(),
    };

    const request = store.put(snapshot);
    request.onsuccess = () => resolve(snapshotId);
    request.onerror = () => reject(request.error);
  });
}

/**
 * Lấy danh sách tóm tắt tất cả các phiên đã lưu trong IndexedDB
 */
export async function listAllSavedSessions(): Promise<SavedSessionSummary[]> {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(STORE_SESSIONS, 'readonly');
      const store = transaction.objectStore(STORE_SESSIONS);
      const request = store.getAll();

      request.onsuccess = () => {
        const list = (request.result as SavedSession[]) || [];
        const summaries: SavedSessionSummary[] = list.map((s) => ({
          id: s.id,
          savedAt: s.savedAt,
          title: s.title || (s.id === CURRENT_SESSION_ID ? 'Phiên tự động lưu gần nhất' : 'Bản lưu snapshot'),
          sourceItemCount: s.sourceItemCount || s.sourceItems?.length || 0,
          resultCount: s.resultCount || s.results?.length || 0,
          lockedCount: s.lockedCount || s.results?.filter((r) => r.isLocked)?.length || 0,
        }));

        // Sắp xếp phiên mới nhất lên đầu
        summaries.sort((a, b) => new Date(b.savedAt).getTime() - new Date(a.savedAt).getTime());
        resolve(summaries);
      };

      request.onerror = () => reject(request.error);
    });
  } catch (err) {
    console.warn('Lỗi khi liệt kê danh sách phiên từ IndexedDB:', err);
    return [];
  }
}

/**
 * Nạp chi tiết một phiên cụ thể theo ID
 */
export async function loadSessionById(id: string): Promise<SavedSession | null> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_SESSIONS, 'readonly');
    const store = transaction.objectStore(STORE_SESSIONS);
    const request = store.get(id);

    request.onsuccess = () => {
      resolve((request.result as SavedSession) || null);
    };
    request.onerror = () => reject(request.error);
  });
}

/**
 * Xóa một phiên đã lưu theo ID
 */
export async function deleteSessionById(id: string): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_SESSIONS, 'readwrite');
    const store = transaction.objectStore(STORE_SESSIONS);
    const request = store.delete(id);

    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

/**
 * Xóa toàn bộ dữ liệu phiên trong IndexedDB
 */
export async function clearAllSessions(): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_SESSIONS, 'readwrite');
    const store = transaction.objectStore(STORE_SESSIONS);
    const request = store.clear();

    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}
