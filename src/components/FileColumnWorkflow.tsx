import React, { useState } from 'react';
import {
  Upload,
  FileSpreadsheet,
  Play,
  CheckCircle2,
  ArrowRight,
  ArrowLeft,
  Columns,
  Sparkles,
  RotateCcw,
  Check,
  Layers,
  Edit3,
  Sliders,
  Table,
  Eye,
  Info,
  Plus,
  Trash2,
  PlusCircle,
  GripVertical,
  AlertTriangle,
  ArrowUpDown,
  ChevronUp,
  ChevronDown,
} from 'lucide-react';
import { FileInspection, OutputColumnConfig, FileMappingConfig, ColumnSourceGroup, ExtraColumnDefinition } from '../types';
import { DEFAULT_OUTPUT_COLUMNS } from '../utils/excelParser';

interface FileColumnWorkflowProps {
  fileGoc: File | null;
  filePL1: File | null;
  filePL2: File | null;
  usingSampleData: boolean;
  inspectionGoc: FileInspection | null;
  inspectionPL1: FileInspection | null;
  inspectionPL2: FileInspection | null;
  columnsConfig: OutputColumnConfig[];
  setColumnsConfig: React.Dispatch<React.SetStateAction<OutputColumnConfig[]>>;
  configGoc: FileMappingConfig;
  setConfigGoc: React.Dispatch<React.SetStateAction<FileMappingConfig>>;
  configPL1: FileMappingConfig;
  setConfigPL1: React.Dispatch<React.SetStateAction<FileMappingConfig>>;
  configPL2: FileMappingConfig;
  setConfigPL2: React.Dispatch<React.SetStateAction<FileMappingConfig>>;
  extraColumnsGoc: ExtraColumnDefinition[];
  extraColumnsPL1: ExtraColumnDefinition[];
  extraColumnsPL2: ExtraColumnDefinition[];
  onAddExtraColumn: (fileType: 'SOURCE' | 'PL1' | 'PL2') => void;
  onUpdateExtraColumn: (id: string, updates: Partial<ExtraColumnDefinition>) => void;
  onRemoveExtraColumn: (id: string) => void;
  currentStep: 1 | 2 | 3;
  setCurrentStep: (step: 1 | 2 | 3) => void;
  hasResults: boolean;
  threshold: number;
  setThreshold: (val: number) => void;
  enableAnatomyFilter: boolean;
  setEnableAnatomyFilter: (val: boolean) => void;
  isProcessing: boolean;
  onFileUpload: (type: 'SOURCE' | 'PL1' | 'PL2', file: File) => Promise<void>;
  onLoadSample: () => void;
  onStartMapping: () => void;
  onReset: () => void;
}

export const FileColumnWorkflow: React.FC<FileColumnWorkflowProps> = ({
  fileGoc,
  filePL1,
  filePL2,
  usingSampleData,
  inspectionGoc,
  inspectionPL1,
  inspectionPL2,
  columnsConfig,
  setColumnsConfig,
  configGoc,
  setConfigGoc,
  configPL1,
  setConfigPL1,
  configPL2,
  setConfigPL2,
  extraColumnsGoc,
  extraColumnsPL1,
  extraColumnsPL2,
  onAddExtraColumn,
  onUpdateExtraColumn,
  onRemoveExtraColumn,
  currentStep,
  setCurrentStep,
  hasResults,
  threshold,
  setThreshold,
  enableAnatomyFilter,
  setEnableAnatomyFilter,
  isProcessing,
  onFileUpload,
  onLoadSample,
  onStartMapping,
  onReset,
}) => {
  const [previewModalFile, setPreviewModalFile] = useState<FileInspection | null>(null);
  // Cảnh báo thứ tự cột không hợp lệ (vượt quá số cột hoặc nhỏ hơn 1)
  const [orderWarnings, setOrderWarnings] = useState<Record<string, string>>({});
  // Trạng thái kéo thả (Drag and Drop) trên bảng xem trước
  const [draggedColId, setDraggedColId] = useState<string | null>(null);
  const [dragOverColId, setDragOverColId] = useState<string | null>(null);

  const allFilesUploaded = Boolean((fileGoc && filePL1 && filePL2) || usingSampleData);

  // Cập nhật đổi tên cột
  const handleUpdateColumnTitle = (id: string, newTitle: string) => {
    setColumnsConfig((prev) =>
      prev.map((col) => (col.id === id ? { ...col, customTitle: newTitle } : col))
    );
  };

  /**
   * Cập nhật thứ tự cột thông minh (Smart Reordering & Swap):
   * 1. Cảnh báo nếu số nhập vào vượt quá số cột đang chọn hoặc nhỏ hơn 1.
   * 2. Hoán đổi thông minh: Ví dụ khi sửa cột 1 thành cột 2 thì cột 2 sẽ tự động chuyển thành cột 1.
   */
  const handleUpdateColumnOrder = (id: string, newOrderStr: string) => {
    const activeCols = columnsConfig.filter((c) => c.selected);
    const maxOrder = activeCols.length;

    if (newOrderStr.trim() === '') {
      setOrderWarnings((prev) => ({
        ...prev,
        [id]: `Nhập từ 1 đến ${maxOrder}`,
      }));
      return;
    }

    const newOrder = parseInt(newOrderStr, 10);

    // Cảnh báo nếu vượt quá số cột hiện đang chọn hoặc nhỏ hơn 1
    if (isNaN(newOrder) || newOrder < 1 || newOrder > maxOrder) {
      setOrderWarnings((prev) => ({
        ...prev,
        [id]: `Vượt quá giới hạn! Hiện chỉ có ${maxOrder} cột đang chọn (cho phép từ 1 đến ${maxOrder}).`,
      }));
      return;
    }

    // Xóa cảnh báo lỗi khi giá trị hợp lệ
    setOrderWarnings((prev) => {
      const next = { ...prev };
      delete next[id];
      return next;
    });

    setColumnsConfig((prev) => {
      const currentCol = prev.find((c) => c.id === id);
      if (!currentCol || !currentCol.selected) return prev;

      const oldOrder = currentCol.order;
      if (oldOrder === newOrder) return prev;

      // Tìm cột đang giữ số thứ tự newOrder để hoán đổi vị trí
      const conflictingCol = prev.find(
        (c) => c.selected && c.id !== id && c.order === newOrder
      );

      return prev.map((col) => {
        if (col.id === id) {
          return { ...col, order: newOrder };
        }
        if (conflictingCol && col.id === conflictingCol.id) {
          // Tự động hoán đổi: Cột 2 chuyển thành cột 1
          return { ...col, order: oldOrder };
        }
        return col;
      });
    });
  };

  // Nút tăng/giảm nhanh thứ tự (Nudge Up / Down)
  const handleNudgeOrder = (id: string, direction: 'UP' | 'DOWN') => {
    const activeCols = [...columnsConfig]
      .filter((c) => c.selected)
      .sort((a, b) => a.order - b.order);

    const currentIndex = activeCols.findIndex((c) => c.id === id);
    if (currentIndex === -1) return;

    const targetIndex = direction === 'UP' ? currentIndex - 1 : currentIndex + 1;
    if (targetIndex < 0 || targetIndex >= activeCols.length) return;

    const currentCol = activeCols[currentIndex];
    const targetCol = activeCols[targetIndex];

    setColumnsConfig((prev) =>
      prev.map((col) => {
        if (col.id === currentCol.id) return { ...col, order: targetCol.order };
        if (col.id === targetCol.id) return { ...col, order: currentCol.order };
        return col;
      })
    );

    setOrderWarnings({});
  };

  // Chuẩn hóa thứ tự tất cả các cột đang chọn liên tục 1, 2, 3, ..., N
  const handleNormalizeColumnOrders = () => {
    setColumnsConfig((prev) => {
      const active = [...prev].filter((c) => c.selected).sort((a, b) => a.order - b.order);
      const orderMap = new Map<string, number>();
      active.forEach((c, idx) => orderMap.set(c.id, idx + 1));
      return prev.map((col) =>
        orderMap.has(col.id) ? { ...col, order: orderMap.get(col.id)! } : col
      );
    });
    setOrderWarnings({});
  };

  // Bật/tắt cột kèm tự động tái lập thứ tự 1..N gọn gàng
  const handleToggleColumn = (id: string) => {
    setColumnsConfig((prev) => {
      const target = prev.find((c) => c.id === id);
      if (!target) return prev;

      if (!target.selected) {
        // Bật cột lên: Gán số thứ tự tiếp theo
        const activeCount = prev.filter((c) => c.selected).length;
        return prev.map((col) =>
          col.id === id ? { ...col, selected: true, order: activeCount + 1 } : col
        );
      } else {
        // Tắt cột đi: Dồn lại 1..N cho các cột còn lại
        const updated = prev.map((col) =>
          col.id === id ? { ...col, selected: false } : col
        );
        const remaining = updated.filter((c) => c.selected).sort((a, b) => a.order - b.order);
        const orderMap = new Map<string, number>();
        remaining.forEach((c, idx) => orderMap.set(c.id, idx + 1));
        return updated.map((col) =>
          orderMap.has(col.id) ? { ...col, order: orderMap.get(col.id)! } : col
        );
      }
    });
    setOrderWarnings({});
  };

  const handleResetDefaultColumns = () => {
    const extraCols = columnsConfig.filter((col) => col.id.startsWith('extra_'));
    setColumnsConfig([
      ...DEFAULT_OUTPUT_COLUMNS.map((col) => ({ ...col })),
      ...extraCols,
    ]);
    setOrderWarnings({});
  };

  // Xử lý kéo thả (Drag and Drop) trên bảng xem trước
  const handleDragStart = (e: React.DragEvent, id: string) => {
    setDraggedColId(id);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', id);
  };

  const handleDragOver = (e: React.DragEvent, id: string) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (dragOverColId !== id) {
      setDragOverColId(id);
    }
  };

  const handleDragEnter = (e: React.DragEvent, id: string) => {
    e.preventDefault();
    setDragOverColId(id);
  };

  const handleDragLeave = () => {
    // Để an toàn, không reset ngay nếu đang di chuyển giữa các thẻ con
  };

  const handleDrop = (e: React.DragEvent, targetId: string) => {
    e.preventDefault();
    if (!draggedColId || draggedColId === targetId) {
      setDraggedColId(null);
      setDragOverColId(null);
      return;
    }

    setColumnsConfig((prev) => {
      const active = [...prev].filter((c) => c.selected).sort((a, b) => a.order - b.order);
      const fromIdx = active.findIndex((c) => c.id === draggedColId);
      const toIdx = active.findIndex((c) => c.id === targetId);

      if (fromIdx === -1 || toIdx === -1) return prev;

      const reordered = [...active];
      const [movedItem] = reordered.splice(fromIdx, 1);
      reordered.splice(toIdx, 0, movedItem);

      const orderMap = new Map<string, number>();
      reordered.forEach((c, idx) => orderMap.set(c.id, idx + 1));

      return prev.map((col) =>
        orderMap.has(col.id) ? { ...col, order: orderMap.get(col.id)! } : col
      );
    });

    setDraggedColId(null);
    setDragOverColId(null);
    setOrderWarnings({});
  };

  const handleDragEnd = () => {
    setDraggedColId(null);
    setDragOverColId(null);
  };

  // Nhóm các cột theo từng file tải lên
  const groupLabelMap: Record<ColumnSourceGroup, { title: string; color: string; bg: string }> = {
    SOURCE: {
      title: '1. File Danh Mục Gốc (Cơ sở khám chữa bệnh)',
      color: 'text-indigo-800',
      bg: 'bg-indigo-50 border-indigo-200',
    },
    PL1: {
      title: '2. Phụ Lục 1 (Thông tư 23/2024/TT-BYT)',
      color: 'text-blue-800',
      bg: 'bg-blue-50 border-blue-200',
    },
    PL2: {
      title: '3. Phụ Lục 2 (Thông tư 23/2024/TT-BYT)',
      color: 'text-emerald-800',
      bg: 'bg-emerald-50 border-emerald-200',
    },
    SYSTEM: {
      title: '4. Thông Tin Bổ Sung & Thẩm Định AI',
      color: 'text-amber-800',
      bg: 'bg-amber-50 border-amber-200',
    },
  };

  const activeSortedColumns = [...columnsConfig]
    .filter((c) => c.selected)
    .sort((a, b) => a.order - b.order);

  return (
    <div id="file-column-workflow-container" className="bg-white rounded-xl border border-slate-200 shadow-sm mb-8 overflow-hidden">
      {/* Workflow Navigation Header */}
      <div className="border-b border-slate-200 bg-slate-50 px-6 py-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-indigo-100 text-indigo-800">
                Quy trình tương tác chuẩn Y tế
              </span>
              <span className="text-xs text-slate-500 font-medium">
                Tự động tìm dòng tiêu đề theo STT & Ghép cột tùy biến
              </span>
            </div>
            <h2 className="text-lg font-bold text-slate-900 mt-1">
              {currentStep === 1
                ? 'Bước 1: Tải File & Chọn Cột Chứa Danh Mục Cần Đối Chiếu'
                : currentStep === 2
                ? 'Bước 2: Cấu Hình Thứ Tự & Đổi Tên Cột Cho Bảng Dữ Liệu Mới'
                : 'Bước 3: Kết Quả Đối Chiếu DMKT & Thẩm Định AI'}
            </h2>
          </div>

          {/* Tab Switch Buttons */}
          <div className="flex items-center gap-2">
            <button
              type="button"
              id="tab-btn-step1"
              onClick={() => setCurrentStep(1)}
              className={`inline-flex items-center gap-2 px-3.5 py-2 text-xs font-semibold rounded-lg transition-colors ${
                currentStep === 1
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-100'
              }`}
            >
              <FileSpreadsheet className="w-4 h-4" />
              1. Tải File & Chọn Cột
              {allFilesUploaded && (
                <span className="w-2 h-2 rounded-full bg-emerald-400 inline-block ml-1"></span>
              )}
            </button>

            <button
              type="button"
              id="tab-btn-step2"
              disabled={!allFilesUploaded}
              onClick={() => setCurrentStep(2)}
              className={`inline-flex items-center gap-2 px-3.5 py-2 text-xs font-semibold rounded-lg transition-colors ${
                currentStep === 2
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : !allFilesUploaded
                  ? 'bg-slate-100 text-slate-400 border border-slate-200 cursor-not-allowed'
                  : 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-100'
              }`}
            >
              <Columns className="w-4 h-4" />
              2. Tiêu Đề Bảng & Thứ Tự
            </button>

            <button
              type="button"
              id="tab-btn-step3"
              disabled={!hasResults && !isProcessing}
              onClick={() => setCurrentStep(3)}
              className={`inline-flex items-center gap-2 px-3.5 py-2 text-xs font-semibold rounded-lg transition-colors ${
                currentStep === 3
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : !hasResults && !isProcessing
                  ? 'bg-slate-100 text-slate-400 border border-slate-200 cursor-not-allowed'
                  : 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-100'
              }`}
            >
              <Play className="w-4 h-4" />
              3. Kết Quả & Thẩm Định
              {hasResults && (
                <span className="w-2 h-2 rounded-full bg-emerald-400 inline-block ml-1"></span>
              )}
            </button>
          </div>
        </div>

        {/* Stepper Progress Bar */}
        <div className="flex flex-wrap items-center gap-3 mt-4 pt-3 border-t border-slate-200/80">
          <button
            type="button"
            onClick={() => setCurrentStep(1)}
            className="flex items-center gap-2 text-left group cursor-pointer focus:outline-hidden"
          >
            <span
              className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold transition-all ${
                currentStep === 1
                  ? 'bg-indigo-600 text-white ring-2 ring-indigo-200'
                  : allFilesUploaded
                  ? 'bg-emerald-600 text-white'
                  : 'bg-slate-200 text-slate-600'
              }`}
            >
              {allFilesUploaded && currentStep > 1 ? <Check className="w-3.5 h-3.5" /> : '1'}
            </span>
            <span className={`text-xs font-medium ${currentStep === 1 ? 'text-indigo-900 font-bold' : 'text-slate-700 group-hover:text-indigo-600'}`}>
              1. Nhận diện dòng STT & Chọn cột
            </span>
          </button>

          <div className={`h-0.5 w-8 sm:w-12 rounded transition-colors ${currentStep >= 2 ? 'bg-indigo-600' : 'bg-slate-200'}`}></div>

          <button
            type="button"
            disabled={!allFilesUploaded}
            onClick={() => allFilesUploaded && setCurrentStep(2)}
            className={`flex items-center gap-2 text-left group focus:outline-hidden ${allFilesUploaded ? 'cursor-pointer' : 'cursor-not-allowed opacity-60'}`}
          >
            <span
              className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold transition-all ${
                currentStep === 2
                  ? 'bg-indigo-600 text-white ring-2 ring-indigo-200'
                  : hasResults && currentStep > 2
                  ? 'bg-emerald-600 text-white'
                  : allFilesUploaded
                  ? 'bg-slate-200 text-slate-700'
                  : 'bg-slate-100 text-slate-400'
              }`}
            >
              {hasResults && currentStep > 2 ? <Check className="w-3.5 h-3.5" /> : '2'}
            </span>
            <span className={`text-xs font-medium ${currentStep === 2 ? 'text-indigo-900 font-bold' : 'text-slate-700 group-hover:text-indigo-600'}`}>
              2. Tiêu đề bảng & Sắp xếp thứ tự
            </span>
          </button>

          <div className={`h-0.5 w-8 sm:w-12 rounded transition-colors ${currentStep === 3 ? 'bg-indigo-600' : 'bg-slate-200'}`}></div>

          <button
            type="button"
            disabled={!hasResults && !isProcessing}
            onClick={() => (hasResults || isProcessing) && setCurrentStep(3)}
            className={`flex items-center gap-2 text-left group focus:outline-hidden ${hasResults || isProcessing ? 'cursor-pointer' : 'cursor-not-allowed opacity-60'}`}
          >
            <span
              className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold transition-all ${
                currentStep === 3
                  ? 'bg-indigo-600 text-white ring-2 ring-indigo-200'
                  : hasResults
                  ? 'bg-emerald-600 text-white'
                  : 'bg-slate-100 text-slate-400'
              }`}
            >
              {hasResults && currentStep !== 3 ? <Check className="w-3.5 h-3.5" /> : '3'}
            </span>
            <span className={`text-xs font-medium ${currentStep === 3 ? 'text-indigo-900 font-bold' : 'text-slate-500 group-hover:text-indigo-600'}`}>
              3. Đối chiếu fuzzy & Thẩm định AI
            </span>
          </button>
        </div>
      </div>

      {/* Tab 1: Upload & Inspect Columns */}
      {currentStep === 1 && (
        <div className="p-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
            <div>
              <p className="text-sm text-slate-600">
                Hệ thống tự động quét dòng tiêu đề bảng dựa theo sự hiện diện của{' '}
                <strong className="text-slate-900 font-semibold">cột STT</strong> (hoặc TT/Số TT). Sau đó hiển thị danh sách các cột để bạn chọn chính xác cột chứa danh mục kỹ thuật và mã.
              </p>
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              <button
                type="button"
                id="btn-quick-sample-data"
                onClick={onLoadSample}
                className="inline-flex items-center gap-2 px-3.5 py-2 text-xs font-semibold rounded-lg bg-indigo-50 text-indigo-700 hover:bg-indigo-100 border border-indigo-200 transition-colors"
              >
                <Sparkles className="w-4 h-4 text-indigo-600" />
                Nạp Dữ Liệu Mẫu Thực Tế (12 Kỹ thuật)
              </button>
              {(fileGoc || filePL1 || filePL2 || usingSampleData) && (
                <button
                  type="button"
                  id="btn-reset-workflow"
                  onClick={onReset}
                  className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-lg text-slate-600 hover:text-slate-900 hover:bg-slate-100 border border-slate-200 transition-colors"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  Làm mới
                </button>
              )}
            </div>
          </div>

          {/* 3 Upload / Inspection Cards */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* File 1: Danh Mục Gốc */}
            <FileInspectionCard
              fileType="SOURCE"
              title="1. File Danh Mục Gốc"
              subtitle="Danh mục kỹ thuật đang thực hiện tại BV (TT 32/2023, TT 43, TT 21)"
              themeColor="indigo"
              file={fileGoc}
              inspection={inspectionGoc}
              usingSampleData={usingSampleData}
              nameColIdx={configGoc.nameColIdx}
              codeColIdx={configGoc.codeColIdx}
              ttColIdx={configGoc.ttColIdx}
              extraColumns={extraColumnsGoc}
              onFileSelected={(file) => onFileUpload('SOURCE', file)}
              onNameColChange={(idx) => setConfigGoc((prev) => ({ ...prev, nameColIdx: idx }))}
              onCodeColChange={(idx) => setConfigGoc((prev) => ({ ...prev, codeColIdx: idx }))}
              onTTColChange={(idx) => setConfigGoc((prev) => ({ ...prev, ttColIdx: idx }))}
              onHeaderRowChange={(idx) => setConfigGoc((prev) => ({ ...prev, headerRowIdx: idx }))}
              onPreviewModalOpen={(insp) => setPreviewModalFile(insp)}
              onAddExtraColumn={() => onAddExtraColumn('SOURCE')}
              onUpdateExtraColumn={onUpdateExtraColumn}
              onRemoveExtraColumn={onRemoveExtraColumn}
            />

            {/* File 2: Phụ Lục 1 */}
            <FileInspectionCard
              fileType="PL1"
              title="2. Phụ Lục 1 (TT 23/2024)"
              subtitle="Danh mục kỹ thuật Phụ lục 1 Thông tư 23/2024/TT-BYT"
              themeColor="blue"
              file={filePL1}
              inspection={inspectionPL1}
              usingSampleData={usingSampleData}
              nameColIdx={configPL1.nameColIdx}
              codeColIdx={configPL1.codeColIdx}
              extraColumns={extraColumnsPL1}
              onFileSelected={(file) => onFileUpload('PL1', file)}
              onNameColChange={(idx) => setConfigPL1((prev) => ({ ...prev, nameColIdx: idx }))}
              onCodeColChange={(idx) => setConfigPL1((prev) => ({ ...prev, codeColIdx: idx }))}
              onHeaderRowChange={(idx) => setConfigPL1((prev) => ({ ...prev, headerRowIdx: idx }))}
              onPreviewModalOpen={(insp) => setPreviewModalFile(insp)}
              onAddExtraColumn={() => onAddExtraColumn('PL1')}
              onUpdateExtraColumn={onUpdateExtraColumn}
              onRemoveExtraColumn={onRemoveExtraColumn}
            />

            {/* File 3: Phụ Lục 2 */}
            <FileInspectionCard
              fileType="PL2"
              title="3. Phụ Lục 2 (TT 23/2024)"
              subtitle="Danh mục kỹ thuật tương đương Phụ lục 2 Thông tư 23/2024/TT-BYT"
              themeColor="emerald"
              file={filePL2}
              inspection={inspectionPL2}
              usingSampleData={usingSampleData}
              nameColIdx={configPL2.nameColIdx}
              codeColIdx={configPL2.codeColIdx}
              extraColumns={extraColumnsPL2}
              onFileSelected={(file) => onFileUpload('PL2', file)}
              onNameColChange={(idx) => setConfigPL2((prev) => ({ ...prev, nameColIdx: idx }))}
              onCodeColChange={(idx) => setConfigPL2((prev) => ({ ...prev, codeColIdx: idx }))}
              onHeaderRowChange={(idx) => setConfigPL2((prev) => ({ ...prev, headerRowIdx: idx }))}
              onPreviewModalOpen={(insp) => setPreviewModalFile(insp)}
              onAddExtraColumn={() => onAddExtraColumn('PL2')}
              onUpdateExtraColumn={onUpdateExtraColumn}
              onRemoveExtraColumn={onRemoveExtraColumn}
            />
          </div>

          {/* Bottom Action Strip */}
          <div className="mt-8 pt-6 border-t border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-2 text-xs text-slate-500">
              <Info className="w-4 h-4 text-slate-400 flex-shrink-0" />
              <span>
                {allFilesUploaded
                  ? 'Đã tải đủ 3 file và tự động trích xuất các cột. Bạn có thể nhấn Tiếp theo để đổi tên hoặc tùy biến thứ tự cột.'
                  : 'Vui lòng tải lên cả 3 file Excel hoặc bấm "Nạp Dữ Liệu Mẫu Thực Tế" để tiếp tục.'}
              </span>
            </div>

            <div className="flex items-center gap-3">
              {hasResults && (
                <button
                  type="button"
                  id="btn-goto-step3-from-step1"
                  onClick={() => setCurrentStep(3)}
                  className="inline-flex items-center gap-2 px-4 py-2.5 text-sm font-semibold rounded-lg bg-emerald-50 text-emerald-700 border border-emerald-300 hover:bg-emerald-100 transition-colors"
                >
                  <Play className="w-4 h-4" />
                  Xem Kết Quả Đối Chiếu (Bước 3) →
                </button>
              )}

              <button
                type="button"
                id="btn-next-to-step2"
                disabled={!allFilesUploaded}
                onClick={() => setCurrentStep(2)}
                className={`inline-flex items-center gap-2 px-5 py-2.5 text-sm font-semibold rounded-lg shadow-sm transition-colors ${
                  allFilesUploaded
                    ? 'bg-indigo-600 text-white hover:bg-indigo-700'
                    : 'bg-slate-200 text-slate-400 cursor-not-allowed'
                }`}
              >
                Tiếp Theo: Đổi Tên & Xếp Thứ Tự Cột
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Tab 2: Customize Output Table Columns & Ordering */}
      {currentStep === 2 && (
        <div className="p-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4">
            <div>
              <h3 className="text-base font-bold text-slate-900">
                Danh sách tiêu đề bảng chia theo từng file tải lên
              </h3>
              <p className="text-xs text-slate-500 mt-1">
                Nhập số thứ tự (STT) tương ứng số cột bạn muốn xuất hiện trong bảng dữ liệu mới, hoặc kéo thả trực tiếp ở khung xem trước phía dưới.
              </p>
            </div>

            <div className="flex items-center gap-2 flex-shrink-0">
              <button
                type="button"
                id="btn-normalize-columns-order"
                onClick={handleNormalizeColumnOrders}
                title="Tự động đánh lại thứ tự liên tục 1, 2, 3... cho các cột đang chọn, loại bỏ hoàn toàn trùng lặp"
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg text-indigo-700 hover:text-indigo-900 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 transition-colors cursor-pointer"
              >
                <ArrowUpDown className="w-3.5 h-3.5 text-indigo-600" />
                Chuẩn hóa thứ tự 1 → N
              </button>
              <button
                type="button"
                id="btn-reset-columns-default"
                onClick={handleResetDefaultColumns}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg text-slate-600 hover:text-slate-900 hover:bg-slate-100 border border-slate-200 transition-colors cursor-pointer"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                Khôi phục mặc định
              </button>
            </div>
          </div>

          {/* Quick Guidance Box */}
          <div className="mb-6 p-3 bg-blue-50/80 border border-blue-200 rounded-xl flex items-start gap-3">
            <Info className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
            <div className="text-xs text-blue-900 leading-relaxed">
              <span className="font-bold">Cải tiến sắp xếp thông minh & Kéo thả:</span>
              <ul className="list-disc list-inside mt-1 space-y-0.5 text-blue-800">
                <li>
                  <strong>Tự động hoán đổi:</strong> Khi sửa cột 1 thành cột 2, cột 2 sẽ tự động chuyển thành cột 1.
                </li>
                <li>
                  <strong>Cảnh báo tức thì:</strong> Cảnh báo màu đỏ nếu số nhập vào vượt quá số cột đang chọn (tối đa <strong>{activeSortedColumns.length} cột</strong>).
                </li>
                <li>
                  <strong>Kéo thả trực quan:</strong> Nhấn giữ và kéo thả các thẻ tiêu đề ở khung màu đen bên dưới để đổi vị trí theo ý muốn.
                </li>
              </ul>
            </div>
          </div>

          {/* Grouped Columns Table */}
          <div className="space-y-6">
            {(['SOURCE', 'PL1', 'PL2', 'SYSTEM'] as ColumnSourceGroup[]).map((groupKey) => {
              const groupCols = columnsConfig.filter((c) => c.sourceGroup === groupKey);
              const groupMeta = groupLabelMap[groupKey];

              return (
                <div key={groupKey} className="border border-slate-200 rounded-lg overflow-hidden">
                  {/* Group Header */}
                  <div className={`px-4 py-2.5 border-b font-bold text-xs uppercase tracking-wider flex items-center justify-between ${groupMeta.bg} ${groupMeta.color}`}>
                    <span className="flex items-center gap-2">
                      <Layers className="w-4 h-4" />
                      {groupMeta.title}
                    </span>
                    <span className="text-xs font-normal opacity-75">
                      {groupCols.filter((c) => c.selected).length}/{groupCols.length} cột kích hoạt
                    </span>
                  </div>

                  {/* Columns List in this group */}
                  <div className="divide-y divide-slate-100 bg-white">
                    {groupCols.map((col) => (
                      <div
                        key={col.id}
                        className={`p-4 flex flex-col md:flex-row md:items-center justify-between gap-4 transition-colors ${
                          col.selected ? 'hover:bg-slate-50' : 'bg-slate-50/50 opacity-60'
                        }`}
                      >
                        {/* Checkbox & Details */}
                        <div className="flex items-start gap-3 md:w-5/12">
                          <input
                            type="checkbox"
                            id={`col-chk-${col.id}`}
                            checked={col.selected}
                            onChange={() => handleToggleColumn(col.id)}
                            className="w-4 h-4 mt-1 text-indigo-600 border-slate-300 rounded focus:ring-indigo-500 cursor-pointer"
                          />
                          <div>
                            <label
                              htmlFor={`col-chk-${col.id}`}
                              className="text-sm font-semibold text-slate-900 cursor-pointer block"
                            >
                              {col.defaultTitle}
                            </label>
                            <span className="text-xs text-slate-500 block mt-0.5">{col.description}</span>
                          </div>
                        </div>

                        {/* Order Input with Smart Swap, Warning & Nudge Buttons */}
                        <div className="flex flex-col md:w-3/12">
                          <div className="flex items-center gap-2">
                            <label
                              htmlFor={`col-order-${col.id}`}
                              className="text-xs text-slate-500 font-medium whitespace-nowrap"
                            >
                              Số thứ tự cột:
                            </label>
                            <div className="flex items-center">
                              <input
                                type="number"
                                id={`col-order-${col.id}`}
                                min={1}
                                max={activeSortedColumns.length}
                                value={col.order}
                                disabled={!col.selected}
                                onChange={(e) => handleUpdateColumnOrder(col.id, e.target.value)}
                                className={`w-14 px-2 py-1.5 text-center text-sm font-bold border rounded-l-md focus:ring-2 disabled:bg-slate-100 disabled:text-slate-400 ${
                                  orderWarnings[col.id]
                                    ? 'border-rose-400 text-rose-700 bg-rose-50/80 focus:ring-rose-500 focus:border-rose-500'
                                    : 'border-slate-300 text-slate-800 focus:ring-indigo-500 focus:border-indigo-500'
                                }`}
                              />
                              <div className="flex flex-col border-y border-r border-slate-300 rounded-r-md overflow-hidden bg-slate-50">
                                <button
                                  type="button"
                                  disabled={!col.selected || col.order <= 1}
                                  onClick={() => handleNudgeOrder(col.id, 'UP')}
                                  title="Chuyển lên trước 1 vị trí"
                                  className="px-1.5 py-0.5 hover:bg-slate-200 disabled:opacity-30 disabled:cursor-not-allowed text-slate-600 transition-colors cursor-pointer"
                                >
                                  <ChevronUp className="w-3 h-3" />
                                </button>
                                <button
                                  type="button"
                                  disabled={!col.selected || col.order >= activeSortedColumns.length}
                                  onClick={() => handleNudgeOrder(col.id, 'DOWN')}
                                  title="Chuyển xuống sau 1 vị trí"
                                  className="px-1.5 py-0.5 hover:bg-slate-200 disabled:opacity-30 disabled:cursor-not-allowed text-slate-600 transition-colors border-t border-slate-200 cursor-pointer"
                                >
                                  <ChevronDown className="w-3 h-3" />
                                </button>
                              </div>
                            </div>
                            <span className="text-[11px] text-slate-400">/{activeSortedColumns.length}</span>
                          </div>
                          {orderWarnings[col.id] && (
                            <span className="text-[11px] font-semibold text-rose-600 flex items-center gap-1 mt-1">
                              <AlertTriangle className="w-3 h-3 shrink-0" />
                              {orderWarnings[col.id]}
                            </span>
                          )}
                        </div>

                        {/* Rename Title Input */}
                        <div className="flex items-center gap-2 md:w-4/12">
                          <label
                            htmlFor={`col-title-${col.id}`}
                            className="text-xs text-slate-500 font-medium whitespace-nowrap flex items-center gap-1"
                          >
                            <Edit3 className="w-3.5 h-3.5 text-slate-400" />
                            Tiêu đề mới:
                          </label>
                          <input
                            type="text"
                            id={`col-title-${col.id}`}
                            value={col.customTitle}
                            disabled={!col.selected}
                            placeholder={col.defaultTitle}
                            onChange={(e) => handleUpdateColumnTitle(col.id, e.target.value)}
                            className="flex-1 px-3 py-1.5 text-sm font-medium border border-slate-300 rounded-md focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 disabled:bg-slate-100 disabled:text-slate-400"
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Real-time Header Preview Strip with Drag and Drop */}
          <div className="mt-8 p-5 bg-slate-900 rounded-xl text-white shadow-md border border-slate-800">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-3">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-200 flex items-center gap-2">
                <Table className="w-4 h-4 text-indigo-400" />
                Xem trước dòng tiêu đề bảng kết quả mới ({activeSortedColumns.length} cột)
              </span>
              <div className="flex items-center gap-1.5 text-xs text-sky-300 bg-sky-950/70 px-2.5 py-1 rounded-md border border-sky-800/60">
                <GripVertical className="w-3.5 h-3.5 text-sky-400" />
                <span>Kéo thả thẻ để thay đổi thứ tự cột trực quan</span>
              </div>
            </div>

            {/* Drag & Drop Badges Container */}
            <div className="flex flex-wrap gap-2 overflow-x-auto py-2 min-h-[52px] items-center">
              {activeSortedColumns.map((col, idx) => {
                const isDragging = draggedColId === col.id;
                const isDragOver = dragOverColId === col.id;

                return (
                  <div
                    key={col.id}
                    draggable
                    onDragStart={(e) => handleDragStart(e, col.id)}
                    onDragOver={(e) => handleDragOver(e, col.id)}
                    onDragEnter={(e) => handleDragEnter(e, col.id)}
                    onDragLeave={handleDragLeave}
                    onDrop={(e) => handleDrop(e, col.id)}
                    onDragEnd={handleDragEnd}
                    title="Nhấn giữ và kéo thả thẻ này sang trái hoặc phải để thay đổi thứ tự cột"
                    className={`inline-flex items-center gap-2 px-3 py-2 rounded-lg border text-xs font-medium select-none transition-all duration-150 cursor-grab active:cursor-grabbing ${
                      isDragging
                        ? 'opacity-30 scale-95 border-indigo-500 bg-indigo-950/60 ring-2 ring-indigo-400/50'
                        : isDragOver
                        ? 'border-sky-400 bg-sky-950 text-white ring-2 ring-sky-400 scale-105 shadow-lg shadow-sky-500/20 z-10'
                        : 'bg-slate-800 border-slate-700 text-slate-200 hover:bg-slate-750 hover:border-slate-500 hover:text-white'
                    }`}
                  >
                    <GripVertical className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                    <span className="w-5 h-5 rounded-full bg-indigo-600 text-white flex items-center justify-center text-[11px] font-bold shrink-0 shadow-xs">
                      {col.order || idx + 1}
                    </span>
                    <span className="font-semibold">{col.customTitle || col.defaultTitle}</span>
                  </div>
                );
              })}
            </div>

            <div className="mt-2.5 pt-2 border-t border-slate-800 text-[11px] text-slate-400 flex flex-col sm:flex-row sm:items-center justify-between gap-1">
              <span>Sắp xếp theo thứ tự cột từ trái sang phải</span>
              <span className="italic text-sky-400">💡 Thứ tự cột được tự động đồng bộ tức thì sang file Excel xuất ra và bảng kết quả</span>
            </div>
          </div>

          {/* Algorithm Settings Box */}
          <div className="mt-6 p-4 bg-slate-50 border border-slate-200 rounded-xl">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-center gap-2">
                <Sliders className="w-4 h-4 text-slate-600" />
                <span className="text-xs font-bold text-slate-800 uppercase tracking-wide">
                  Tham số đối chiếu AI & Ngưỡng tương đồng
                </span>
              </div>

              <div className="flex flex-wrap items-center gap-6">
                <div className="flex items-center gap-2">
                  <label htmlFor="threshold-slider" className="text-xs font-medium text-slate-600">
                    Ngưỡng tin cậy:{' '}
                    <strong className="text-indigo-600 font-bold">{threshold}%</strong>
                  </label>
                  <input
                    type="range"
                    id="threshold-slider"
                    min={40}
                    max={95}
                    step={5}
                    value={threshold}
                    onChange={(e) => setThreshold(Number(e.target.value))}
                    className="w-28 accent-indigo-600 cursor-pointer"
                  />
                </div>

                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="anatomy-filter-chk"
                    checked={enableAnatomyFilter}
                    onChange={(e) => setEnableAnatomyFilter(e.target.checked)}
                    className="w-4 h-4 text-indigo-600 border-slate-300 rounded focus:ring-indigo-500 cursor-pointer"
                  />
                  <label htmlFor="anatomy-filter-chk" className="text-xs font-medium text-slate-700 cursor-pointer">
                    Khóa cơ quan giải phẫu (Chặn nhầm lẫn Dạ dày ↔ Đại tràng)
                  </label>
                </div>
              </div>
            </div>
          </div>

          {/* Navigation & Action Bar */}
          <div className="mt-8 pt-6 border-t border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <button
              type="button"
              id="btn-back-to-step1"
              onClick={() => setCurrentStep(1)}
              className="inline-flex items-center gap-2 px-4 py-2.5 text-sm font-semibold text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors cursor-pointer"
            >
              <ArrowLeft className="w-4 h-4" />
              Quay lại bước trước (Bước 1: Chọn file & cột)
            </button>

            <div className="flex items-center gap-3">
              {hasResults && (
                <button
                  type="button"
                  id="btn-goto-step3-from-step2"
                  onClick={() => setCurrentStep(3)}
                  className="inline-flex items-center gap-2 px-4 py-2.5 text-sm font-semibold rounded-lg bg-emerald-50 text-emerald-700 border border-emerald-300 hover:bg-emerald-100 transition-colors cursor-pointer"
                >
                  <Play className="w-4 h-4" />
                  Xem Lại Kết Quả Đối Chiếu (Bước 3) →
                </button>
              )}

              <button
                type="button"
                id="btn-execute-workflow-mapping"
                disabled={!allFilesUploaded || isProcessing}
                onClick={onStartMapping}
                className={`inline-flex items-center gap-2 px-6 py-2.5 text-sm font-bold rounded-lg shadow-sm transition-all ${
                  !allFilesUploaded || isProcessing
                    ? 'bg-slate-200 text-slate-400 cursor-not-allowed'
                    : 'bg-emerald-600 text-white hover:bg-emerald-700 hover:shadow cursor-pointer'
                }`}
              >
                <Play className="w-4 h-4 fill-current" />
                {isProcessing ? 'Đang Xử Lý Đối Chiếu...' : 'Bắt Đầu Đối Chiếu DMKT & Thẩm Định AI'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Step 3 Active Navigation Banner */}
      {currentStep === 3 && (
        <div className="p-4 bg-slate-50 border-t border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2 text-slate-700">
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800">
              Đang ở Bước 3
            </span>
            <span className="font-medium">
              Nội dung Bước 1 & Bước 2 đã được ẩn. Toàn bộ không gian bên dưới dành cho Bảng kết quả đối chiếu và thẩm định.
            </span>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <button
              type="button"
              id="btn-back-to-step2"
              onClick={() => setCurrentStep(2)}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-100 shadow-2xs transition-colors cursor-pointer"
              title="Quay lại tùy biến thứ tự, tên cột và ngưỡng"
            >
              <ArrowLeft className="w-3.5 h-3.5 text-slate-600" />
              Quay lại bước trước (Bước 2: Cấu hình cột)
            </button>

            <button
              type="button"
              id="btn-back-to-step1-from-step3"
              onClick={() => setCurrentStep(1)}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium text-slate-600 bg-white border border-slate-200 rounded-lg hover:bg-slate-100 shadow-2xs transition-colors cursor-pointer"
              title="Quay lại tải file hoặc chọn lại cột STT/Mã"
            >
              <RotateCcw className="w-3.5 h-3.5 text-slate-400" />
              Quay lại Bước 1 (Chọn file)
            </button>
          </div>
        </div>
      )}

      {/* Modal Preview Dòng Dữ Liệu Thực Tế Trong File Excel */}
      {previewModalFile && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-xl max-w-4xl w-full max-h-[85vh] flex flex-col shadow-2xl border border-slate-200">
            <div className="p-4 border-b border-slate-200 flex items-center justify-between bg-slate-50 rounded-t-xl">
              <div className="flex items-center gap-2">
                <FileSpreadsheet className="w-5 h-5 text-indigo-600" />
                <div>
                  <h4 className="text-sm font-bold text-slate-900">
                    Xem trước file: {previewModalFile.fileName}
                  </h4>
                  <p className="text-xs text-slate-500">
                    Dòng tiêu đề nhận diện: Dòng {previewModalFile.headerRowIndex + 1} (Cột STT: &quot;{previewModalFile.detectedSTTColumn}&quot;)
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setPreviewModalFile(null)}
                className="text-slate-400 hover:text-slate-700 p-1 rounded-lg hover:bg-slate-200 transition-colors text-sm font-bold"
              >
                ✕ Đóng
              </button>
            </div>

            <div className="p-4 overflow-auto flex-1">
              <div className="border border-slate-200 rounded-lg overflow-x-auto">
                <table className="min-w-full divide-y divide-slate-200 text-xs text-left">
                  <thead className="bg-slate-100 font-bold text-slate-800">
                    <tr>
                      <th className="px-3 py-2 border-r border-slate-200 w-12 text-center">Dòng</th>
                      {previewModalFile.headers.map((h, i) => (
                        <th key={i} className="px-3 py-2 border-r border-slate-200 whitespace-nowrap">
                          {h || `Cột ${i + 1}`}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 bg-white">
                    {previewModalFile.sampleRows.map((row, rIdx) => (
                      <tr key={rIdx} className="hover:bg-slate-50">
                        <td className="px-3 py-2 border-r border-slate-200 text-center font-mono text-slate-400">
                          {previewModalFile.headerRowIndex + 2 + rIdx}
                        </td>
                        {previewModalFile.headers.map((_, cIdx) => (
                          <td key={cIdx} className="px-3 py-2 border-r border-slate-200 whitespace-nowrap">
                            {String(row[cIdx] || '')}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="p-3 border-t border-slate-200 bg-slate-50 flex justify-end rounded-b-xl">
              <button
                type="button"
                onClick={() => setPreviewModalFile(null)}
                className="px-4 py-1.5 text-xs font-semibold bg-white border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-100"
              >
                Đóng xem trước
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

interface FileInspectionCardProps {
  fileType: 'SOURCE' | 'PL1' | 'PL2';
  title: string;
  subtitle: string;
  themeColor: 'indigo' | 'blue' | 'emerald';
  file: File | null;
  inspection: FileInspection | null;
  usingSampleData: boolean;
  nameColIdx: number;
  codeColIdx: number;
  ttColIdx?: number;
  extraColumns: ExtraColumnDefinition[];
  onFileSelected: (file: File) => void;
  onNameColChange: (idx: number) => void;
  onCodeColChange: (idx: number) => void;
  onTTColChange?: (idx: number) => void;
  onHeaderRowChange: (idx: number) => void;
  onPreviewModalOpen: (insp: FileInspection) => void;
  onAddExtraColumn: () => void;
  onUpdateExtraColumn: (id: string, updates: Partial<ExtraColumnDefinition>) => void;
  onRemoveExtraColumn: (id: string) => void;
}

const FileInspectionCard: React.FC<FileInspectionCardProps> = ({
  fileType,
  title,
  subtitle,
  themeColor,
  file,
  inspection,
  usingSampleData,
  nameColIdx,
  codeColIdx,
  ttColIdx,
  extraColumns,
  onFileSelected,
  onNameColChange,
  onCodeColChange,
  onTTColChange,
  onHeaderRowChange,
  onPreviewModalOpen,
  onAddExtraColumn,
  onUpdateExtraColumn,
  onRemoveExtraColumn,
}) => {
  const isLoaded = Boolean(file || (usingSampleData && inspection));
  const fileInputId = `upload-input-${fileType.toLowerCase()}`;

  const themeClasses = {
    indigo: {
      border: 'border-indigo-200',
      badge: 'bg-indigo-100 text-indigo-800',
      btn: 'bg-indigo-50 text-indigo-700 border-indigo-200 hover:bg-indigo-100',
      ring: 'focus:ring-indigo-500 focus:border-indigo-500',
    },
    blue: {
      border: 'border-blue-200',
      badge: 'bg-blue-100 text-blue-800',
      btn: 'bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-100',
      ring: 'focus:ring-blue-500 focus:border-blue-500',
    },
    emerald: {
      border: 'border-emerald-200',
      badge: 'bg-emerald-100 text-emerald-800',
      btn: 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100',
      ring: 'focus:ring-emerald-500 focus:border-emerald-500',
    },
  }[themeColor];

  return (
    <div className={`border rounded-xl p-5 flex flex-col justify-between transition-all ${
      isLoaded ? 'bg-white border-slate-300 shadow-sm' : 'bg-slate-50/70 border-dashed border-slate-300'
    }`}>
      <div>
        {/* Card Header */}
        <div className="flex items-start justify-between gap-2 mb-3">
          <div>
            <h4 className="text-sm font-bold text-slate-900">{title}</h4>
            <p className="text-xs text-slate-500 mt-0.5">{subtitle}</p>
          </div>
          {isLoaded && (
            <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200 flex-shrink-0">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
              Đã nhận diện
            </span>
          )}
        </div>

        {/* Upload Drop Zone / Input */}
        <div className="mb-4">
          <input
            type="file"
            id={fileInputId}
            accept=".xlsx, .xls"
            className="hidden"
            onChange={(e) => {
              if (e.target.files && e.target.files[0]) {
                onFileSelected(e.target.files[0]);
              }
            }}
          />

          {!isLoaded ? (
            <label
              htmlFor={fileInputId}
              className="flex flex-col items-center justify-center p-6 border-2 border-dashed border-slate-300 rounded-lg hover:border-indigo-400 hover:bg-indigo-50/30 cursor-pointer transition-colors text-center"
            >
              <Upload className="w-6 h-6 text-slate-400 mb-2" />
              <span className="text-xs font-bold text-slate-700">Bấm để tải file Excel (.xlsx)</span>
              <span className="text-[11px] text-slate-400 mt-1">Hệ thống sẽ tự động quét STT</span>
            </label>
          ) : (
            <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg flex items-center justify-between">
              <div className="flex items-center gap-2 truncate">
                <FileSpreadsheet className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                <div className="truncate">
                  <span className="text-xs font-semibold text-slate-900 truncate block">
                    {inspection?.fileName || file?.name || 'File đã tải'}
                  </span>
                  <span className="text-[10px] text-slate-500">
                    {inspection ? `${inspection.totalRows.toLocaleString()} dòng` : ''}
                    {file ? ` • ${(file.size / 1024).toFixed(1)} KB` : ''}
                  </span>
                </div>
              </div>
              <label
                htmlFor={fileInputId}
                className="text-[11px] font-semibold text-indigo-600 hover:text-indigo-800 hover:underline cursor-pointer flex-shrink-0 ml-2"
              >
                Đổi file
              </label>
            </div>
          )}
        </div>

        {/* Inspection Details & Column Selection */}
        {inspection && (
          <div className="space-y-3 pt-3 border-t border-slate-100">
            {/* Auto-detected Header Row Badge */}
            <div className="p-2.5 bg-slate-100/80 rounded-lg border border-slate-200 text-xs flex items-center justify-between">
              <div>
                <span className="font-semibold text-slate-700">Dòng tiêu đề:</span>{' '}
                <span className="font-bold text-indigo-600">Dòng {inspection.headerRowIndex + 1}</span>
                <span className="text-slate-500 block text-[11px] mt-0.5">
                  Phát hiện từ cột STT: &quot;<strong>{inspection.detectedSTTColumn}</strong>&quot;
                </span>
              </div>
              <button
                type="button"
                onClick={() => onPreviewModalOpen(inspection)}
                className="inline-flex items-center gap-1 text-[11px] font-semibold text-slate-600 hover:text-slate-900 bg-white px-2 py-1 rounded border border-slate-200 shadow-2xs"
              >
                <Eye className="w-3 h-3 text-slate-500" />
                Xem 5 dòng
              </button>
            </div>

            {/* Select Cột Chứa Danh Mục Kỹ Thuật (BẮT BUỘC) */}
            <div>
              <label className="block text-xs font-bold text-slate-800 mb-1">
                {fileType === 'SOURCE'
                  ? '🎯 Cột chứa danh mục gốc (Bắt buộc):'
                  : '🎯 Cột chứa danh mục để đối chiếu (Bắt buộc):'}
              </label>
              <select
                value={nameColIdx}
                onChange={(e) => onNameColChange(Number(e.target.value))}
                className={`w-full px-2.5 py-1.5 text-xs font-semibold border rounded-md bg-white ${themeClasses.ring}`}
              >
                {inspection.headers.map((h, idx) => (
                  <option key={idx} value={idx}>
                    {`[Cột ${idx + 1}] ${h || '(Trống)'}`}
                  </option>
                ))}
              </select>
            </div>

            {/* Select Cột Chứa Mã Kỹ Thuật */}
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">
                {fileType === 'SOURCE'
                  ? 'Cột chứa Mã TT 43, 21:'
                  : fileType === 'PL1'
                  ? 'Cột chứa Mã kỹ thuật (PL1):'
                  : 'Cột chứa Mã liên kết / tương đương (PL2):'}
              </label>
              <select
                value={codeColIdx}
                onChange={(e) => onCodeColChange(Number(e.target.value))}
                className="w-full px-2.5 py-1.5 text-xs border border-slate-300 rounded-md bg-white text-slate-700"
              >
                {inspection.headers.map((h, idx) => (
                  <option key={idx} value={idx}>
                    {`[Cột ${idx + 1}] ${h || '(Trống)'}`}
                  </option>
                ))}
              </select>
            </div>

            {/* Select Cột STT / TT (dành cho File Gốc để đảm bảo STT 2) */}
            {fileType === 'SOURCE' && onTTColChange && (
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">
                  Cột STT chính xác của File Gốc (STT 2):
                </label>
                <select
                  value={ttColIdx ?? 0}
                  onChange={(e) => onTTColChange(Number(e.target.value))}
                  className="w-full px-2.5 py-1.5 text-xs border border-slate-300 rounded-md bg-white text-slate-700"
                >
                  {inspection.headers.map((h, idx) => (
                    <option key={idx} value={idx}>
                      {`[Cột ${idx + 1}] ${h || '(Trống)'}`}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>
        )}

        {/* Cột bổ sung lấy từ file này vào kết quả */}
        {inspection && (
          <div className="mt-4 pt-3 border-t border-slate-200/80">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                <PlusCircle className="w-3.5 h-3.5 text-indigo-600" />
                <span>Cột bổ sung lấy vào kết quả</span>
                {extraColumns.length > 0 && (
                  <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-indigo-100 text-indigo-800 font-bold">
                    {extraColumns.length}
                  </span>
                )}
              </span>
            </div>

            {extraColumns.length > 0 && (
              <div className="space-y-2 mb-3">
                {extraColumns.map((extraCol, idx) => (
                  <div
                    key={extraCol.id}
                    className="p-2.5 bg-slate-50 border border-slate-200 rounded-lg text-xs space-y-2"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-semibold text-slate-700 text-[11px] flex items-center gap-1">
                        <Columns className="w-3 h-3 text-indigo-600" />
                        Cột bổ sung #{idx + 1}
                      </span>
                      <button
                        type="button"
                        onClick={() => onRemoveExtraColumn(extraCol.id)}
                        className="text-slate-400 hover:text-red-600 p-1 rounded hover:bg-red-50 transition-colors cursor-pointer"
                        title="Xóa cột bổ sung này"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    <div>
                      <label className="block text-[10px] text-slate-500 font-medium mb-0.5">
                        Chọn cột trích xuất từ file:
                      </label>
                      <select
                        value={extraCol.columnIndex}
                        onChange={(e) => {
                          const newColIdx = Number(e.target.value);
                          const headerName = inspection?.headers[newColIdx] || `Cột ${newColIdx + 1}`;
                          onUpdateExtraColumn(extraCol.id, {
                            columnIndex: newColIdx,
                            columnHeader: headerName,
                            customTitle: extraCol.customTitle === extraCol.columnHeader ? headerName : extraCol.customTitle,
                          });
                        }}
                        className="w-full px-2 py-1 text-xs border border-slate-300 rounded bg-white text-slate-800 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                      >
                        {inspection.headers.map((h, cIdx) => (
                          <option key={cIdx} value={cIdx}>
                            {`[Cột ${cIdx + 1}] ${h || '(Trống)'}`}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-[10px] text-slate-500 font-medium mb-0.5">
                        Tiêu đề hiển thị ở bảng kết quả / file Excel:
                      </label>
                      <input
                        type="text"
                        value={extraCol.customTitle}
                        onChange={(e) =>
                          onUpdateExtraColumn(extraCol.id, { customTitle: e.target.value })
                        }
                        placeholder={extraCol.columnHeader || 'Tên cột trong file kết quả'}
                        className="w-full px-2 py-1 text-xs border border-slate-300 rounded bg-white text-slate-800 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Nút thêm cột ở dưới cùng */}
            <button
              type="button"
              onClick={onAddExtraColumn}
              disabled={!isLoaded || !inspection}
              className="w-full py-2 px-3 rounded-lg border border-dashed border-indigo-300 hover:border-indigo-500 hover:bg-indigo-50/70 text-indigo-700 text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
              title="Lấy thêm một cột nội dung từ file Excel này để đưa vào kết quả"
            >
              <Plus className="w-3.5 h-3.5 text-indigo-600" />
              <span>Thêm cột từ file này vào kết quả</span>
            </button>
          </div>
        )}
      </div>

      {/* Footer Info */}
      <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-400">
        <span>Định dạng: Excel (.xlsx, .xls)</span>
        {inspection && (
          <span className="font-semibold text-slate-600">{inspection.headers.length} cột bảng</span>
        )}
      </div>
    </div>
  );
};
