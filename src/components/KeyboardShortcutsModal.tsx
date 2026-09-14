import React from 'react';
import {
  X,
  Keyboard,
  Play,
  FileSpreadsheet,
  Search,
  Filter,
  Layers,
  ArrowLeftRight,
  RotateCcw,
  Sparkles,
  HelpCircle,
} from 'lucide-react';

interface KeyboardShortcutsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface ShortcutItem {
  keys: string[];
  description: string;
  category: string;
  tag?: string;
}

const SHORTCUTS: {
  category: string;
  icon: React.ComponentType<{ className?: string }>;
  items: { keys: string[]; description: string; tag?: string }[];
}[] = [
  {
    category: 'Thao tác cốt lõi (Workflow chính)',
    icon: Play,
    items: [
      {
        keys: ['Ctrl', 'Enter'],
        description: 'Bắt đầu chạy đối chiếu danh mục kỹ thuật & thẩm định AI (hoặc Cmd+Enter trên Mac)',
        tag: 'Ưu tiên',
      },
      {
        keys: ['Ctrl', 'S'],
        description: 'Xuất kết quả đối chiếu ra file Excel (.xlsx) đã tự động tô vàng các dòng cảnh báo',
        tag: 'Phổ biến',
      },
      {
        keys: ['Alt', 'M'],
        description: 'Mở Quản lý các phiên lưu trữ IndexedDB (Lưu bản chụp snapshot, khôi phục phiên)',
        tag: 'Bảo vệ dữ liệu',
      },
      {
        keys: ['Alt', 'S'],
        description: 'Nạp nhanh bộ dữ liệu mẫu 12 kỹ thuật thực tế để thử nghiệm ngay',
      },
      {
        keys: ['Ctrl', 'Shift', 'R'],
        description: 'Làm mới & đặt lại toàn bộ dữ liệu đối chiếu',
      },
    ],
  },
  {
    category: 'Tìm kiếm & Điều hướng bảng',
    icon: Search,
    items: [
      {
        keys: ['/'],
        description: 'Nhảy nhanh con trỏ vào ô tìm kiếm kỹ thuật (hoặc Ctrl + F)',
        tag: 'Nhanh',
      },
      {
        keys: ['Esc'],
        description: 'Đóng cửa sổ bật lên (Modal) hoặc hủy tiêu điểm tìm kiếm',
      },
      {
        keys: ['←', '→'],
        description: 'Chuyển trang trước / trang kế tiếp trong bảng kết quả (hoặc Alt + ← / →)',
      },
    ],
  },
  {
    category: 'Lọc nhanh trạng thái kết quả',
    icon: Filter,
    items: [
      {
        keys: ['Alt', '1'],
        description: 'Xem tất cả các dòng kỹ thuật',
      },
      {
        keys: ['Alt', '2'],
        description: 'Lọc ngay các dòng Cần lưu ý / Tô vàng (Sai lệch từ khóa, cấp độ, cảnh báo)',
        tag: 'Quan trọng',
      },
      {
        keys: ['Alt', '3'],
        description: 'Lọc các dòng khớp thành công cả 2 Phụ lục',
      },
      {
        keys: ['Alt', '4'],
        description: 'Lọc các dòng chưa khớp được với Phụ lục',
      },
    ],
  },
  {
    category: 'Trợ giúp & Giao diện',
    icon: HelpCircle,
    items: [
      {
        keys: ['?'],
        description: 'Bật / tắt bảng tra cứu phím tắt này (Shift + /)',
      },
    ],
  },
];

export const KeyboardShortcutsModal: React.FC<KeyboardShortcutsModalProps> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-2xl max-h-[85vh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-200"
        role="dialog"
        aria-modal="true"
        aria-labelledby="keyboard-shortcuts-title"
      >
        {/* Header */}
        <div className="p-4 sm:p-5 bg-gradient-to-r from-slate-900 via-slate-800 to-sky-950 text-white flex items-center justify-between shrink-0 border-b border-slate-700">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-sky-500/20 border border-sky-400/30 flex items-center justify-center">
              <Keyboard className="w-5 h-5 text-sky-300" />
            </div>
            <div>
              <h2 id="keyboard-shortcuts-title" className="text-base sm:text-lg font-bold flex items-center gap-2">
                Phím Tắt Bàn Phím
                <span className="text-xs px-2 py-0.5 rounded-full bg-sky-400/20 text-sky-200 font-normal border border-sky-400/30">
                  Tăng tốc thao tác y tế
                </span>
              </h2>
              <p className="text-xs text-slate-300">
                Thao tác nhanh không cần dùng chuột cho cán bộ quản lý danh mục kỹ thuật
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-300 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
            title="Đóng bảng phím tắt (Esc)"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-4 sm:p-6 overflow-y-auto space-y-6 text-sm text-slate-700">
          <div className="p-3 bg-sky-50 border border-sky-200 rounded-xl text-xs text-sky-900 flex items-start gap-2.5">
            <Sparkles className="w-4 h-4 text-sky-600 shrink-0 mt-0.5" />
            <div className="leading-relaxed">
              <span className="font-semibold text-sky-950">Mẹo làm việc nhanh:</span> Bạn có thể bấm phím{' '}
              <kbd className="px-1.5 py-0.5 rounded bg-white border border-sky-300 text-sky-800 font-mono font-bold shadow-xs">
                ?
              </kbd>{' '}
              bất cứ lúc nào để mở bảng này. Nhấn{' '}
              <kbd className="px-1.5 py-0.5 rounded bg-white border border-sky-300 text-sky-800 font-mono font-bold shadow-xs">
                Esc
              </kbd>{' '}
              để đóng lại.
            </div>
          </div>

          <div className="grid grid-cols-1 gap-5">
            {SHORTCUTS.map((group) => {
              const Icon = group.icon;
              return (
                <div key={group.category} className="space-y-2.5">
                  <div className="flex items-center gap-2 text-xs font-bold text-slate-900 uppercase tracking-wider">
                    <Icon className="w-3.5 h-3.5 text-sky-600" />
                    <span>{group.category}</span>
                  </div>

                  <div className="divide-y divide-slate-100 border border-slate-200 rounded-xl bg-slate-50/50 overflow-hidden">
                    {group.items.map((item, idx) => (
                      <div
                        key={idx}
                        className="px-3.5 py-2.5 flex items-center justify-between gap-3 hover:bg-white transition-colors"
                      >
                        <div className="flex items-center gap-2 flex-1 min-w-0">
                          <span className="text-xs text-slate-700 leading-snug">{item.description}</span>
                          {item.tag && (
                            <span className="shrink-0 px-1.5 py-0.5 rounded text-[10px] font-semibold bg-emerald-100 text-emerald-800">
                              {item.tag}
                            </span>
                          )}
                        </div>

                        <div className="flex items-center gap-1 shrink-0">
                          {item.keys.map((k, kIdx) => (
                            <React.Fragment key={kIdx}>
                              <kbd className="px-2 py-1 text-xs font-mono font-semibold bg-white border border-slate-300 text-slate-800 rounded-md shadow-xs min-w-[24px] text-center">
                                {k}
                              </kbd>
                              {kIdx < item.keys.length - 1 && (
                                <span className="text-slate-400 text-xs font-mono">+</span>
                              )}
                            </React.Fragment>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Footer */}
        <div className="p-3.5 bg-slate-100 border-t border-slate-200 flex items-center justify-between text-xs text-slate-500 shrink-0">
          <span>Hỗ trợ cả bàn phím Windows (Ctrl) và macOS (Cmd)</span>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg bg-slate-800 text-white font-medium hover:bg-slate-700 transition-colors cursor-pointer"
          >
            Đã Hiểu (Esc)
          </button>
        </div>
      </div>
    </div>
  );
};
