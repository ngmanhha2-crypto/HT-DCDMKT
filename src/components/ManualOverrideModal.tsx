import React, { useState, useEffect, useMemo } from 'react';
import {
  Lock,
  Unlock,
  CheckCircle2,
  X,
  Search,
  Stethoscope,
  Activity,
  AlertTriangle,
  RotateCcw,
  Sparkles,
  ShieldAlert,
} from 'lucide-react';
import { MappingResult, TargetItem } from '../types';
import { auditMappingRowWithRules } from '../utils/clinicalRules';

interface ManualOverrideModalProps {
  isOpen: boolean;
  row: MappingResult | null;
  pl1Items: TargetItem[];
  pl2Items: TargetItem[];
  onClose: () => void;
  onSave: (updatedRow: MappingResult) => void;
}

export const ManualOverrideModal: React.FC<ManualOverrideModalProps> = ({
  isOpen,
  row,
  pl1Items,
  pl2Items,
  onClose,
  onSave,
}) => {
  if (!isOpen || !row) return null;

  // Local state for editing
  const [maPL1, setMaPL1] = useState<string>(row.maPL1 || '');
  const [tenPL1, setTenPL1] = useState<string>(row.tenPL1 || '');
  const [scorePL1, setScorePL1] = useState<number>(row.scorePL1 || 0);

  const [maPL2, setMaPL2] = useState<string>(row.maPL2 || '');
  const [tenPL2, setTenPL2] = useState<string>(row.tenPL2 || '');
  const [scorePL2, setScorePL2] = useState<number>(row.scorePL2 || 0);

  const [isLocked, setIsLocked] = useState<boolean>(row.isLocked ?? true);
  const [manualNote, setManualNote] = useState<string>(row.manualNote || '');

  // Search state for PL1 & PL2 picker
  const [searchPL1, setSearchPL1] = useState<string>('');
  const [showPickerPL1, setShowPickerPL1] = useState<boolean>(false);

  const [searchPL2, setSearchPL2] = useState<string>('');
  const [showPickerPL2, setShowPickerPL2] = useState<boolean>(false);

  // Sync state when row changes
  useEffect(() => {
    if (row) {
      setMaPL1(row.maPL1 || '');
      setTenPL1(row.tenPL1 || '');
      setScorePL1(row.scorePL1 || 0);
      setMaPL2(row.maPL2 || '');
      setTenPL2(row.tenPL2 || '');
      setScorePL2(row.scorePL2 || 0);
      setIsLocked(row.isLocked ?? true);
      setManualNote(row.manualNote || '');
      setSearchPL1('');
      setSearchPL2('');
      setShowPickerPL1(false);
      setShowPickerPL2(false);
    }
  }, [row]);

  // Filtered PL1 candidates for selector
  const filteredPL1 = useMemo(() => {
    if (!searchPL1.trim()) return pl1Items.slice(0, 30);
    const query = searchPL1.toLowerCase().trim();
    return pl1Items
      .filter((item) => item.code.toLowerCase().includes(query) || item.name.toLowerCase().includes(query))
      .slice(0, 50);
  }, [pl1Items, searchPL1]);

  // Filtered PL2 candidates for selector
  const filteredPL2 = useMemo(() => {
    if (!searchPL2.trim()) return pl2Items.slice(0, 30);
    const query = searchPL2.toLowerCase().trim();
    return pl2Items
      .filter((item) => item.code.toLowerCase().includes(query) || item.name.toLowerCase().includes(query))
      .slice(0, 50);
  }, [pl2Items, searchPL2]);

  // Live Audit Check of current manual choices
  const previewAudit = useMemo(() => {
    const tempRow: MappingResult = {
      ...row,
      maPL1,
      tenPL1,
      scorePL1,
      maPL2,
      tenPL2,
      scorePL2,
      isLocked,
      isManualOverride: true,
      manualNote,
    };
    return auditMappingRowWithRules(tempRow);
  }, [row, maPL1, tenPL1, scorePL1, maPL2, tenPL2, scorePL2, isLocked, manualNote]);

  const handleSelectPL1 = (item: TargetItem) => {
    setMaPL1(item.code);
    setTenPL1(item.name);
    setScorePL1(100); // Gán 100% khi người dùng đích thân chọn chỉ định
    setShowPickerPL1(false);
    setSearchPL1('');
  };

  const handleClearPL1 = () => {
    setMaPL1('');
    setTenPL1('');
    setScorePL1(0);
    setShowPickerPL1(false);
  };

  const handleSelectPL2 = (item: TargetItem) => {
    setMaPL2(item.code);
    setTenPL2(item.name);
    setScorePL2(100);
    setShowPickerPL2(false);
    setSearchPL2('');
  };

  const handleClearPL2 = () => {
    setMaPL2('');
    setTenPL2('');
    setScorePL2(0);
    setShowPickerPL2(false);
  };

  const handleResetToAuto = () => {
    if (!row) return;
    setMaPL1(row.maPL1 || '');
    setTenPL1(row.tenPL1 || '');
    setScorePL1(row.scorePL1 || 0);
    setMaPL2(row.maPL2 || '');
    setTenPL2(row.tenPL2 || '');
    setScorePL2(row.scorePL2 || 0);
    setIsLocked(false);
    setManualNote('');
  };

  const handleSave = () => {
    if (!row) return;

    const isModified =
      maPL1 !== (row.maPL1 || '') ||
      tenPL1 !== (row.tenPL1 || '') ||
      maPL2 !== (row.maPL2 || '') ||
      tenPL2 !== (row.tenPL2 || '') ||
      isLocked !== (row.isLocked || false) ||
      manualNote !== (row.manualNote || '');

    const updatedRow: MappingResult = {
      ...row,
      maPL1,
      tenPL1,
      scorePL1,
      maPL2,
      tenPL2,
      scorePL2,
      isLocked,
      isManualOverride: isModified || row.isManualOverride || isLocked,
      manualNote: manualNote.trim() || undefined,
      lockedAt: isLocked ? (row.lockedAt || new Date().toISOString()) : undefined,
    };

    // Re-audit with updated values
    updatedRow.aiAudit = auditMappingRowWithRules(updatedRow);

    onSave(updatedRow);
    onClose();
  };

  return (
    <div
      id="manual-override-modal-backdrop"
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        id="manual-override-modal-container"
        className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-2xl w-full max-h-[90vh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-150"
      >
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className={`p-2.5 rounded-xl ${isLocked ? 'bg-amber-100 text-amber-800' : 'bg-sky-100 text-sky-800'}`}>
              {isLocked ? <Lock className="w-5 h-5" /> : <Unlock className="w-5 h-5" />}
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <span>Chỉnh Sửa Thủ Công & Khóa Dòng</span>
                <span className="text-xs px-2 py-0.5 rounded-full font-mono font-semibold bg-slate-200 text-slate-700">
                  Dòng #{row.rowId}
                </span>
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Chốt tay danh mục kỹ thuật chỉ định và ngăn thuật toán tự động ghi đè khi chạy lại.
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

        {/* Modal Body */}
        <div className="p-4 sm:p-5 overflow-y-auto space-y-4 text-xs">
          {/* Box 1: Thông tin danh mục gốc */}
          <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                Danh Mục Kỹ Thuật Gốc Bệnh Viện
              </span>
              <span className="font-mono font-bold text-sky-700 px-2 py-0.5 bg-sky-100 rounded">
                Mã: {row.maGoc || 'Chưa có mã'}
              </span>
            </div>
            <div className="text-sm font-semibold text-slate-900 leading-snug">{row.tenGoc}</div>
            <div className="flex flex-wrap items-center gap-2 pt-1 text-[11px]">
              {row.chuyenKhoaGoc && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-slate-200/80 text-slate-700 font-medium">
                  <Stethoscope className="w-3 h-3 text-sky-600" />
                  {row.chuyenKhoaGoc}
                </span>
              )}
              {row.boPhanGoc && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-sky-100 text-sky-800 font-medium">
                  <Activity className="w-3 h-3 text-sky-600" />
                  {row.boPhanGoc}
                </span>
              )}
            </div>
          </div>

          {/* Box 2: Phụ lục 1 (TT23/2024/TT-BYT) */}
          <div className="p-3.5 rounded-xl border border-emerald-200 bg-emerald-50/40 space-y-2.5">
            <div className="flex items-center justify-between">
              <div className="font-bold text-emerald-900 flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-600" />
                <span>Phụ Lục 1 (Thông tư 23/2024/TT-BYT)</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="font-mono text-xs px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 font-bold">
                  {scorePL1}%
                </span>
                <button
                  type="button"
                  onClick={() => setShowPickerPL1(!showPickerPL1)}
                  className="px-2.5 py-1 rounded bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-medium transition-colors cursor-pointer"
                >
                  {showPickerPL1 ? 'Đóng tìm kiếm' : 'Chọn từ Phụ lục 1...'}
                </button>
              </div>
            </div>

            {/* Current chosen PL1 */}
            <div className="bg-white p-2.5 rounded-lg border border-emerald-200 flex items-center justify-between gap-2">
              <div className="space-y-0.5 min-w-0">
                <div className="font-mono font-bold text-emerald-700 text-xs">
                  {maPL1 || <span className="text-slate-400 italic">Chưa chọn mã</span>}
                </div>
                <div className="text-slate-800 font-medium truncate" title={tenPL1}>
                  {tenPL1 || <span className="text-slate-400 italic">Không ghép tương đương</span>}
                </div>
              </div>
              {tenPL1 && (
                <button
                  type="button"
                  onClick={handleClearPL1}
                  className="text-slate-400 hover:text-red-600 p-1 rounded hover:bg-red-50 transition-colors"
                  title="Xóa lựa chọn này (để trống)"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>

            {/* Quick Picker dropdown for PL1 */}
            {showPickerPL1 && (
              <div className="p-2 bg-white rounded-lg border border-slate-300 shadow-lg space-y-2 animate-in fade-in duration-100">
                <div className="relative">
                  <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={searchPL1}
                    onChange={(e) => setSearchPL1(e.target.value)}
                    placeholder="Tìm theo mã hoặc tên kỹ thuật trong Phụ lục 1..."
                    className="w-full pl-8 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-md focus:outline-none focus:border-emerald-500"
                    autoFocus
                  />
                </div>
                <div className="max-h-44 overflow-y-auto divide-y divide-slate-100">
                  {filteredPL1.length > 0 ? (
                    filteredPL1.map((item) => (
                      <button
                        key={`pick-pl1-${item.code}-${item.name}`}
                        type="button"
                        onClick={() => handleSelectPL1(item)}
                        className="w-full text-left p-2 hover:bg-emerald-50 rounded transition-colors flex items-start justify-between gap-2 cursor-pointer"
                      >
                        <div>
                          <div className="font-mono font-bold text-emerald-700">{item.code}</div>
                          <div className="text-slate-800 font-medium leading-tight">{item.name}</div>
                        </div>
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0 opacity-0 group-hover:opacity-100" />
                      </button>
                    ))
                  ) : (
                    <div className="p-3 text-center text-slate-400">Không tìm thấy kỹ thuật phù hợp</div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Box 3: Phụ lục 2 (TT23/2024/TT-BYT) */}
          <div className="p-3.5 rounded-xl border border-blue-200 bg-blue-50/40 space-y-2.5">
            <div className="flex items-center justify-between">
              <div className="font-bold text-blue-900 flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-blue-600" />
                <span>Phụ Lục 2 (Thông tư 23/2024/TT-BYT)</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="font-mono text-xs px-2 py-0.5 rounded bg-blue-100 text-blue-800 font-bold">
                  {scorePL2}%
                </span>
                <button
                  type="button"
                  onClick={() => setShowPickerPL2(!showPickerPL2)}
                  className="px-2.5 py-1 rounded bg-blue-600 hover:bg-blue-700 text-white text-[11px] font-medium transition-colors cursor-pointer"
                >
                  {showPickerPL2 ? 'Đóng tìm kiếm' : 'Chọn từ Phụ lục 2...'}
                </button>
              </div>
            </div>

            {/* Current chosen PL2 */}
            <div className="bg-white p-2.5 rounded-lg border border-blue-200 flex items-center justify-between gap-2">
              <div className="space-y-0.5 min-w-0">
                <div className="font-mono font-bold text-blue-700 text-xs">
                  {maPL2 || <span className="text-slate-400 italic">Chưa chọn mã</span>}
                </div>
                <div className="text-slate-800 font-medium truncate" title={tenPL2}>
                  {tenPL2 || <span className="text-slate-400 italic">Không ghép tương đương</span>}
                </div>
              </div>
              {tenPL2 && (
                <button
                  type="button"
                  onClick={handleClearPL2}
                  className="text-slate-400 hover:text-red-600 p-1 rounded hover:bg-red-50 transition-colors"
                  title="Xóa lựa chọn này (để trống)"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>

            {/* Quick Picker dropdown for PL2 */}
            {showPickerPL2 && (
              <div className="p-2 bg-white rounded-lg border border-slate-300 shadow-lg space-y-2 animate-in fade-in duration-100">
                <div className="relative">
                  <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={searchPL2}
                    onChange={(e) => setSearchPL2(e.target.value)}
                    placeholder="Tìm theo mã hoặc tên kỹ thuật trong Phụ lục 2..."
                    className="w-full pl-8 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-md focus:outline-none focus:border-blue-500"
                    autoFocus
                  />
                </div>
                <div className="max-h-44 overflow-y-auto divide-y divide-slate-100">
                  {filteredPL2.length > 0 ? (
                    filteredPL2.map((item) => (
                      <button
                        key={`pick-pl2-${item.code}-${item.name}`}
                        type="button"
                        onClick={() => handleSelectPL2(item)}
                        className="w-full text-left p-2 hover:bg-blue-50 rounded transition-colors flex items-start justify-between gap-2 cursor-pointer"
                      >
                        <div>
                          <div className="font-mono font-bold text-blue-700">{item.code}</div>
                          <div className="text-slate-800 font-medium leading-tight">{item.name}</div>
                        </div>
                        <CheckCircle2 className="w-3.5 h-3.5 text-blue-600 shrink-0 opacity-0 group-hover:opacity-100" />
                      </button>
                    ))
                  ) : (
                    <div className="p-3 text-center text-slate-400">Không tìm thấy kỹ thuật phù hợp</div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Box 4: Ghi chú thẩm định & Khóa dòng */}
          <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 space-y-3">
            <div className="flex items-center justify-between">
              <label htmlFor="manual-lock-toggle" className="flex items-center gap-2 cursor-pointer select-none">
                <input
                  id="manual-lock-toggle"
                  type="checkbox"
                  checked={isLocked}
                  onChange={(e) => setIsLocked(e.target.checked)}
                  className="w-4 h-4 text-sky-600 rounded border-slate-300 focus:ring-sky-500"
                />
                <span className="font-bold text-slate-800">
                  Khóa dòng này (Bảo vệ kết quả chốt tay khi chạy lại thuật toán)
                </span>
              </label>
              {isLocked ? (
                <span className="inline-flex items-center gap-1 text-[10px] font-bold text-amber-800 bg-amber-100 px-2 py-0.5 rounded-full border border-amber-300">
                  <Lock className="w-3 h-3" /> Đang khóa
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 text-[10px] font-medium text-slate-500 bg-slate-200 px-2 py-0.5 rounded-full">
                  <Unlock className="w-3 h-3" /> Mở tự do
                </span>
              )}
            </div>

            <div>
              <label htmlFor="manual-note-input" className="block text-[11px] font-medium text-slate-600 mb-1">
                Lý do chốt tay / Ghi chú thẩm định lâm sàng:
              </label>
              <textarea
                id="manual-note-input"
                rows={2}
                value={manualNote}
                onChange={(e) => setManualNote(e.target.value)}
                placeholder="Ví dụ: Đã hội chẩn với Bác sĩ Trưởng khoa, áp mã kỹ thuật tương đương theo quy trình..."
                className="w-full p-2 text-xs bg-white border border-slate-200 rounded-lg focus:outline-none focus:border-sky-500"
              />
            </div>
          </div>

          {/* Box 5: Live Clinical Audit Preview */}
          {previewAudit?.hasWarning ? (
            <div className="p-3 bg-amber-50 border border-amber-300 rounded-xl flex items-start gap-2.5">
              <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
              <div className="space-y-1">
                <div className="font-bold text-amber-900 text-xs">Cảnh báo quy tắc y khoa & BHYT:</div>
                <div className="text-amber-800 text-[11px] leading-relaxed">
                  {previewAudit.recommendation || previewAudit.warningMessage}
                </div>
              </div>
            </div>
          ) : (
            <div className="p-2.5 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center gap-2 text-emerald-800 text-xs font-medium">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>Đối chiếu tương thích lâm sàng và cơ quan giải phẫu an toàn.</span>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="p-4 border-t border-slate-200 bg-slate-50 flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={handleResetToAuto}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium text-slate-600 hover:text-slate-800 hover:bg-slate-200/70 transition-colors cursor-pointer"
            title="Khôi phục lại kết quả khớp mờ tự động ban đầu"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Khôi phục tự động</span>
          </button>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-lg text-xs font-medium text-slate-700 bg-white hover:bg-slate-100 border border-slate-200 transition-colors cursor-pointer"
            >
              Hủy
            </button>
            <button
              type="button"
              onClick={handleSave}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-bold text-white bg-sky-600 hover:bg-sky-700 shadow-xs transition-colors cursor-pointer"
            >
              {isLocked ? <Lock className="w-3.5 h-3.5" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
              <span>{isLocked ? 'Lưu & Khóa Dòng' : 'Lưu Thay Đổi'}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
