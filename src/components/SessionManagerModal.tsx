import React, { useState, useEffect } from 'react';
import {
  Database,
  X,
  RotateCcw,
  Trash2,
  Save,
  Clock,
  Lock,
  FileSpreadsheet,
  CheckCircle2,
  AlertCircle,
  Download,
  Upload,
} from 'lucide-react';
import { SavedSession, SavedSessionSummary } from '../types';
import {
  listAllSavedSessions,
  loadSessionById,
  deleteSessionById,
  saveNamedSessionSnapshot,
  clearAllSessions,
  CURRENT_SESSION_ID,
} from '../utils/indexedDBStorage';

interface SessionManagerModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentSessionData: SavedSession | null;
  onRestoreSession: (session: SavedSession) => void;
}

export const SessionManagerModal: React.FC<SessionManagerModalProps> = ({
  isOpen,
  onClose,
  currentSessionData,
  onRestoreSession,
}) => {
  const [sessions, setSessions] = useState<SavedSessionSummary[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [snapshotName, setSnapshotName] = useState<string>('');
  const [statusMsg, setStatusMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const fetchSessions = async () => {
    setIsLoading(true);
    try {
      const list = await listAllSavedSessions();
      setSessions(list);
    } catch (err: any) {
      setStatusMsg({ type: 'error', text: `Lỗi đọc IndexedDB: ${err.message}` });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchSessions();
      setStatusMsg(null);
      setSnapshotName(`Bản lưu_${new Date().toLocaleDateString('vi-VN')}_${new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}`);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleRestore = async (id: string) => {
    try {
      const session = await loadSessionById(id);
      if (session) {
        onRestoreSession(session);
        setStatusMsg({ type: 'success', text: `Đã khôi phục thành công phiên "${session.title}"!` });
        setTimeout(() => {
          onClose();
        }, 600);
      } else {
        setStatusMsg({ type: 'error', text: 'Không tìm thấy dữ liệu phiên cần khôi phục.' });
      }
    } catch (err: any) {
      setStatusMsg({ type: 'error', text: `Lỗi khôi phục: ${err.message}` });
    }
  };

  const handleDelete = async (id: string, title: string) => {
    if (!window.confirm(`Bạn có chắc chắn muốn xóa bản lưu "${title}"?`)) return;
    try {
      await deleteSessionById(id);
      await fetchSessions();
      setStatusMsg({ type: 'success', text: `Đã xóa bản lưu "${title}".` });
    } catch (err: any) {
      setStatusMsg({ type: 'error', text: `Lỗi xóa: ${err.message}` });
    }
  };

  const handleCreateSnapshot = async () => {
    if (!currentSessionData || currentSessionData.results.length === 0) {
      setStatusMsg({ type: 'error', text: 'Không có dữ liệu đối chiếu hiện tại để lưu snapshot.' });
      return;
    }

    try {
      const title = snapshotName.trim() || `Bản lưu ${new Date().toLocaleString('vi-VN')}`;
      await saveNamedSessionSnapshot({
        ...currentSessionData,
        title,
      });
      setStatusMsg({ type: 'success', text: `Đã lưu snapshot "${title}" vào IndexedDB!` });
      await fetchSessions();
    } catch (err: any) {
      setStatusMsg({ type: 'error', text: `Lỗi lưu snapshot: ${err.message}` });
    }
  };

  const handleClearAll = async () => {
    if (!window.confirm('CẢNH BÁO: Hành động này sẽ xóa toàn bộ các phiên đã lưu trong IndexedDB của trình duyệt. Bạn có chắc không?')) {
      return;
    }
    try {
      await clearAllSessions();
      await fetchSessions();
      setStatusMsg({ type: 'success', text: 'Đã dọn sạch bộ nhớ IndexedDB.' });
    } catch (err: any) {
      setStatusMsg({ type: 'error', text: `Lỗi dọn bộ nhớ: ${err.message}` });
    }
  };

  // Export current session to JSON file
  const handleExportJSON = () => {
    if (!currentSessionData || currentSessionData.results.length === 0) {
      setStatusMsg({ type: 'error', text: 'Chưa có kết quả đối chiếu để xuất JSON.' });
      return;
    }
    const jsonStr = JSON.stringify(currentSessionData, null, 2);
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Phien_Doi_Chieu_${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    setStatusMsg({ type: 'success', text: 'Đã xuất file JSON sao lưu phiên thành công!' });
  };

  // Import session from JSON file
  const handleImportJSON = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const parsed = JSON.parse(evt.target?.result as string) as SavedSession;
        if (parsed.results && Array.isArray(parsed.results)) {
          onRestoreSession(parsed);
          setStatusMsg({ type: 'success', text: `Đã nạp thành công phiên sao lưu từ file JSON (${parsed.results.length} dòng)!` });
          setTimeout(() => onClose(), 600);
        } else {
          setStatusMsg({ type: 'error', text: 'File JSON không đúng định dạng phiên đối chiếu.' });
        }
      } catch (err: any) {
        setStatusMsg({ type: 'error', text: `Lỗi đọc file JSON: ${err.message}` });
      }
    };
    reader.readAsText(file);
  };

  return (
    <div
      id="session-manager-modal-backdrop"
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        id="session-manager-modal-container"
        className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-2xl w-full max-h-[85vh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-150"
      >
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-sky-100 text-sky-800">
              <Database className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <span>Quản Lý Phiên Làm Việc & Bộ Nhớ IndexedDB</span>
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Bảo vệ dữ liệu đối chiếu, tự động lưu và khôi phục các dòng đã chốt tay ngay cả khi tắt trình duyệt.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-200/60 rounded-lg transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Status banner */}
        {statusMsg && (
          <div
            className={`px-4 py-2.5 text-xs font-medium flex items-center gap-2 ${
              statusMsg.type === 'success'
                ? 'bg-emerald-50 text-emerald-800 border-b border-emerald-200'
                : 'bg-red-50 text-red-800 border-b border-red-200'
            }`}
          >
            {statusMsg.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            ) : (
              <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
            )}
            <span>{statusMsg.text}</span>
          </div>
        )}

        {/* Body */}
        <div className="p-4 sm:p-5 overflow-y-auto space-y-4 text-xs">
          {/* Create new snapshot */}
          {currentSessionData && currentSessionData.results.length > 0 && (
            <div className="p-3.5 bg-sky-50/60 rounded-xl border border-sky-200 space-y-2.5">
              <div className="font-bold text-sky-900 flex items-center justify-between">
                <span className="flex items-center gap-1.5">
                  <Save className="w-4 h-4 text-sky-700" />
                  Lưu Snapshot Phiên Hiện Tại Vào IndexedDB
                </span>
                <span className="text-[11px] font-mono text-sky-700">
                  {currentSessionData.results.length.toLocaleString()} dòng (
                  {currentSessionData.results.filter((r) => r.isLocked).length} dòng đã khóa)
                </span>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={snapshotName}
                  onChange={(e) => setSnapshotName(e.target.value)}
                  placeholder="Nhập tên bản lưu (ví dụ: Chốt danh mục BV Đa khoa Đợt 1)..."
                  className="flex-1 px-3 py-2 text-xs bg-white border border-slate-200 rounded-lg focus:outline-none focus:border-sky-500"
                />
                <button
                  type="button"
                  onClick={handleCreateSnapshot}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-sky-600 hover:bg-sky-700 text-white font-semibold rounded-lg shadow-xs transition-colors cursor-pointer shrink-0"
                >
                  <Save className="w-3.5 h-3.5" />
                  Lưu Snapshot
                </button>
              </div>
            </div>
          )}

          {/* Sessions List */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="font-bold text-slate-800 uppercase tracking-wider text-[11px]">
                Các Phiên Đã Lưu Trong IndexedDB ({sessions.length})
              </span>
              {sessions.length > 0 && (
                <button
                  type="button"
                  onClick={handleClearAll}
                  className="text-[11px] text-red-600 hover:text-red-700 hover:underline cursor-pointer"
                >
                  Xóa tất cả bộ nhớ
                </button>
              )}
            </div>

            {isLoading ? (
              <div className="p-6 text-center text-slate-400">Đang đọc dữ liệu từ IndexedDB...</div>
            ) : sessions.length === 0 ? (
              <div className="p-6 bg-slate-50 border border-slate-200 rounded-xl text-center space-y-1">
                <div className="text-slate-600 font-medium">Chưa có phiên làm việc nào được lưu</div>
                <div className="text-[11px] text-slate-400">
                  Khi bạn chạy đối chiếu hoặc chốt tay, hệ thống sẽ tự động lưu phiên vào IndexedDB để tránh mất dữ liệu.
                </div>
              </div>
            ) : (
              <div className="divide-y divide-slate-200 border border-slate-200 rounded-xl overflow-hidden">
                {sessions.map((sess) => {
                  const isAuto = sess.id === CURRENT_SESSION_ID;
                  const dateFormatted = new Date(sess.savedAt).toLocaleString('vi-VN');

                  return (
                    <div
                      key={sess.id}
                      className="p-3.5 bg-white hover:bg-slate-50/80 transition-colors flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                    >
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-slate-900 text-xs">{sess.title}</span>
                          {isAuto && (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-300">
                              Tự động lưu (Auto-save)
                            </span>
                          )}
                        </div>
                        <div className="flex flex-wrap items-center gap-3 text-[11px] text-slate-500">
                          <span className="flex items-center gap-1 font-mono">
                            <Clock className="w-3 h-3 text-slate-400" />
                            {dateFormatted}
                          </span>
                          <span className="flex items-center gap-1">
                            <FileSpreadsheet className="w-3 h-3 text-emerald-600" />
                            {sess.resultCount.toLocaleString()} danh mục
                          </span>
                          {sess.lockedCount > 0 && (
                            <span className="flex items-center gap-1 font-semibold text-amber-700">
                              <Lock className="w-3 h-3 text-amber-600" />
                              {sess.lockedCount} dòng đã chốt tay
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-2 self-end sm:self-center">
                        <button
                          type="button"
                          onClick={() => handleRestore(sess.id)}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-sky-600 hover:bg-sky-700 text-white font-semibold rounded-lg shadow-xs transition-colors cursor-pointer text-xs"
                          title="Khôi phục lại phiên làm việc này vào màn hình chính"
                        >
                          <RotateCcw className="w-3.5 h-3.5" />
                          Khôi phục
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDelete(sess.id, sess.title)}
                          className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors cursor-pointer"
                          title="Xóa bản lưu này"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Backup & Restore via JSON file */}
          <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 flex flex-wrap items-center justify-between gap-3 text-[11px]">
            <div className="text-slate-600">
              <b>Sao lưu & Chuyển giao máy tính khác:</b> Bạn có thể xuất file JSON để chuyển sang máy của đồng nghiệp.
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleExportJSON}
                disabled={!currentSessionData || currentSessionData.results.length === 0}
                className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-white hover:bg-slate-100 border border-slate-200 rounded-lg text-slate-700 font-medium cursor-pointer disabled:opacity-50"
              >
                <Download className="w-3.5 h-3.5 text-slate-500" />
                Xuất file JSON
              </button>
              <label className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-white hover:bg-slate-100 border border-slate-200 rounded-lg text-slate-700 font-medium cursor-pointer">
                <Upload className="w-3.5 h-3.5 text-slate-500" />
                <span>Nạp file JSON</span>
                <input type="file" accept=".json" onChange={handleImportJSON} className="hidden" />
              </label>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-200 bg-slate-50 flex items-center justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-lg text-xs font-medium text-slate-700 bg-white hover:bg-slate-100 border border-slate-200 transition-colors cursor-pointer"
          >
            Đóng
          </button>
        </div>
      </div>
    </div>
  );
};
