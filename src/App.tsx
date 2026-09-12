import React, { useState, useId, useRef, useMemo } from 'react';
import {
  FileSpreadsheet,
  Upload,
  Play,
  Download,
  AlertCircle,
  CheckCircle2,
  FileCheck2,
  Sparkles,
  Layers,
  Settings2,
  Info,
  RotateCcw,
  Search,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Globe,
  Github,
  Square,
  Timer,
  Gauge,
  Zap,
  Check,
  Activity,
  ShieldCheck,
  Stethoscope,
  AlertTriangle,
  Bot,
  HelpCircle,
  XCircle,
  BookOpen,
  Scale,
  FileText,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { SourceItem, TargetItem, MappingResult, ProcessingStats, FileInspection, OutputColumnConfig, FileMappingConfig, ExtraColumnDefinition } from './types';
import { auditMappingRowWithRules } from './utils/clinicalRules';
import {
  createTargetIndex,
  getBestMatchWithIndex,
} from './utils/fuzzyMatcher';
import {
  decomposeMedicalProcedure,
  ANATOMY_ONTOLOGY,
} from './utils/anatomyMatcher';
import {
  parseSourceFile,
  parsePL1File,
  parsePL2File,
  exportMappingToExcel,
  generateSampleExcelFiles,
  inspectExcelFile,
  getSampleFileInspection,
  DEFAULT_OUTPUT_COLUMNS,
  isNumericSTT,
} from './utils/excelParser';
import {
  getSampleSourceList,
  getSampleTargetPL1,
  getSampleTargetPL2,
} from './data/sampleMedicalData';
import { DeployGuideModal } from './components/DeployGuideModal';
import { ClinicalAuditModal } from './components/ClinicalAuditModal';
import { FileColumnWorkflow } from './components/FileColumnWorkflow';

export default function App() {
  const uploadGocId = useId();
  const uploadPL1Id = useId();
  const uploadPL2Id = useId();

  // Modal Deploy Hướng dẫn GitHub & Vercel
  const [isDeployModalOpen, setIsDeployModalOpen] = useState<boolean>(false);

  // State quản lý file
  const [fileGoc, setFileGoc] = useState<File | null>(null);
  const [filePL1, setFilePL1] = useState<File | null>(null);
  const [filePL2, setFilePL2] = useState<File | null>(null);
  const [usingSampleData, setUsingSampleData] = useState<boolean>(false);

  // Trạng thái trích xuất và chọn cột tương tác (Interactive Column Mapping Workflow)
  const [inspectionGoc, setInspectionGoc] = useState<FileInspection | null>(null);
  const [inspectionPL1, setInspectionPL1] = useState<FileInspection | null>(null);
  const [inspectionPL2, setInspectionPL2] = useState<FileInspection | null>(null);

  const [columnsConfig, setColumnsConfig] = useState<OutputColumnConfig[]>(() =>
    DEFAULT_OUTPUT_COLUMNS.map((c) => ({ ...c }))
  );

  const [configGoc, setConfigGoc] = useState<FileMappingConfig>({
    headerRowIdx: 1,
    nameColIdx: 2,
    codeColIdx: 1,
    ttColIdx: 0,
  });

  const [configPL1, setConfigPL1] = useState<FileMappingConfig>({
    headerRowIdx: 3,
    nameColIdx: 3,
    codeColIdx: 1,
  });

  const [configPL2, setConfigPL2] = useState<FileMappingConfig>({
    headerRowIdx: 1,
    nameColIdx: 4,
    codeColIdx: 3,
  });

  // Quản lý quy trình từng bước (Step 1 -> Step 2 -> Step 3)
  const [currentStep, setCurrentStep] = useState<1 | 2 | 3>(1);

  // State các cột bổ sung người dùng chọn thêm từ từng file Excel
  const [extraColumnsGoc, setExtraColumnsGoc] = useState<ExtraColumnDefinition[]>([]);
  const [extraColumnsPL1, setExtraColumnsPL1] = useState<ExtraColumnDefinition[]>([]);
  const [extraColumnsPL2, setExtraColumnsPL2] = useState<ExtraColumnDefinition[]>([]);

  // Thêm một cột nội dung từ file Excel vào kết quả
  const handleAddExtraColumn = (fileType: 'SOURCE' | 'PL1' | 'PL2') => {
    const inspection = fileType === 'SOURCE' ? inspectionGoc : fileType === 'PL1' ? inspectionPL1 : inspectionPL2;
    if (!inspection || !inspection.headers || inspection.headers.length === 0) return;

    const existingList = fileType === 'SOURCE' ? extraColumnsGoc : fileType === 'PL1' ? extraColumnsPL1 : extraColumnsPL2;
    const usedIndices = new Set(existingList.map((c) => c.columnIndex));
    let pickedIdx = -1;
    for (let i = 0; i < inspection.headers.length; i++) {
      if (!usedIndices.has(i)) {
        pickedIdx = i;
        break;
      }
    }
    if (pickedIdx === -1) pickedIdx = 0;

    const headerName = inspection.headers[pickedIdx] || `Cột ${pickedIdx + 1}`;
    const fileLabel = fileType === 'SOURCE' ? 'File Danh mục gốc' : fileType === 'PL1' ? 'Phụ lục 1' : 'Phụ lục 2';
    const newId = `extra_${fileType.toLowerCase()}_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
    const customTitle = headerName;

    const newDef: ExtraColumnDefinition = {
      id: newId,
      sourceGroup: fileType,
      columnIndex: pickedIdx,
      columnHeader: headerName,
      customTitle,
    };

    if (fileType === 'SOURCE') setExtraColumnsGoc((prev) => [...prev, newDef]);
    else if (fileType === 'PL1') setExtraColumnsPL1((prev) => [...prev, newDef]);
    else setExtraColumnsPL2((prev) => [...prev, newDef]);

    // Đồng thời bổ sung vào columnsConfig để xuất hiện ở Bước 2 và bảng kết quả / file Excel
    setColumnsConfig((prev) => {
      const maxOrder = prev.reduce((m, c) => Math.max(m, c.order || 0), 0);
      const newCol: OutputColumnConfig = {
        id: newId,
        sourceGroup: fileType,
        sourceFileLabel: fileLabel,
        defaultTitle: headerName,
        customTitle: customTitle,
        order: maxOrder + 1,
        selected: true,
        description: `Cột bổ sung [Cột ${pickedIdx + 1}: ${headerName}] từ ${fileLabel}`,
      };
      return [...prev, newCol];
    });
  };

  // Cập nhật cấu hình cột bổ sung (chọn cột khác hoặc đổi tên hiển thị)
  const handleUpdateExtraColumn = (id: string, updates: Partial<ExtraColumnDefinition>) => {
    const updateFn = (list: ExtraColumnDefinition[]) =>
      list.map((col) => (col.id === id ? { ...col, ...updates } : col));

    setExtraColumnsGoc(updateFn);
    setExtraColumnsPL1(updateFn);
    setExtraColumnsPL2(updateFn);

    setColumnsConfig((prev) =>
      prev.map((c) => {
        if (c.id === id) {
          return {
            ...c,
            customTitle: updates.customTitle !== undefined ? updates.customTitle : c.customTitle,
            defaultTitle: updates.columnHeader !== undefined ? updates.columnHeader : c.defaultTitle,
            description:
              updates.columnIndex !== undefined && updates.columnHeader !== undefined
                ? `Cột bổ sung [Cột ${updates.columnIndex + 1}: ${updates.columnHeader}]`
                : c.description,
          };
        }
        return c;
      })
    );
  };

  // Xóa cột bổ sung
  const handleRemoveExtraColumn = (id: string) => {
    setExtraColumnsGoc((prev) => prev.filter((c) => c.id !== id));
    setExtraColumnsPL1((prev) => prev.filter((c) => c.id !== id));
    setExtraColumnsPL2((prev) => prev.filter((c) => c.id !== id));
    setColumnsConfig((prev) => prev.filter((c) => c.id !== id));
  };

  // Cấu hình thuật toán
  const [threshold, setThreshold] = useState<number>(70);
  const [enableAnatomyFilter, setEnableAnatomyFilter] = useState<boolean>(true);

  // Tiến trình và trạng thái
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [progress, setProgress] = useState<number>(0);
  const [statusMessage, setStatusMessage] = useState<string>('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [processingSpeed, setProcessingSpeed] = useState<number>(0);
  const [remainingSeconds, setRemainingSeconds] = useState<number>(0);
  const [processedCount, setProcessedCount] = useState<number>(0);
  const [totalCount, setTotalCount] = useState<number>(0);

  // Cờ hủy tiến trình (Cancel Token)
  const isCancelledRef = useRef<boolean>(false);

  // Kết quả & Thống kê
  const [results, setResults] = useState<MappingResult[]>([]);
  const [stats, setStats] = useState<ProcessingStats | null>(null);

  // Bảng hiển thị & Phân trang (Pagination)
  const [searchFilter, setSearchFilter] = useState<string>('');
  const [selectedSpecialty, setSelectedSpecialty] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'warning_only' | 'both' | 'pl1_only' | 'pl2_only' | 'unmatched'>('all');
  const [pageSize, setPageSize] = useState<number>(25);
  const [currentPage, setCurrentPage] = useState<number>(1);

  // Trạng thái AI Rà Soát & Thẩm Định (Gemini 3.8 Flash)
  const [isAiAuditing, setIsAiAuditing] = useState<boolean>(false);
  const [aiAuditProgress, setAiAuditProgress] = useState<{ current: number; total: number; message: string } | null>(null);
  const [aiAuditSummary, setAiAuditSummary] = useState<{ totalAudited: number; warningCount: number; safeCount: number } | null>(null);

  // Xem giải trình lâm sàng & BHYT chi tiết cho bác sĩ/cán bộ y tế
  const [expandedAuditRows, setExpandedAuditRows] = useState<Set<number>>(new Set());
  const [auditModalRow, setAuditModalRow] = useState<MappingResult | null>(null);

  const toggleExpandAudit = (rowId: number) => {
    setExpandedAuditRows((prev) => {
      const next = new Set(prev);
      if (next.has(rowId)) next.delete(rowId);
      else next.add(rowId);
      return next;
    });
  };

  // Xử lý khi tải file Excel lên: Tự động quét dòng tiêu đề theo cột STT
  const handleFileUpload = async (type: 'SOURCE' | 'PL1' | 'PL2', file: File) => {
    setErrorMessage(null);
    try {
      if (type === 'SOURCE') {
        setFileGoc(file);
        setUsingSampleData(false);
        const insp = await inspectExcelFile(file, 'SOURCE');
        setInspectionGoc(insp);
        setConfigGoc({
          headerRowIdx: insp.headerRowIndex,
          nameColIdx: insp.selectedNameColumnIndex,
          codeColIdx: insp.selectedCodeColumnIndex,
          ttColIdx: insp.selectedTTColumnIndex,
        });
      } else if (type === 'PL1') {
        setFilePL1(file);
        setUsingSampleData(false);
        const insp = await inspectExcelFile(file, 'PL1');
        setInspectionPL1(insp);
        setConfigPL1({
          headerRowIdx: insp.headerRowIndex,
          nameColIdx: insp.selectedNameColumnIndex,
          codeColIdx: insp.selectedCodeColumnIndex,
        });
      } else if (type === 'PL2') {
        setFilePL2(file);
        setUsingSampleData(false);
        const insp = await inspectExcelFile(file, 'PL2');
        setInspectionPL2(insp);
        setConfigPL2({
          headerRowIdx: insp.headerRowIndex,
          nameColIdx: insp.selectedNameColumnIndex,
          codeColIdx: insp.selectedCodeColumnIndex,
        });
      }
    } catch (err: any) {
      setErrorMessage(`Lỗi đọc file: ${err.message || 'Không thể đọc file Excel.'}`);
    }
  };

  // Nạp dữ liệu mẫu
  const handleLoadSampleData = () => {
    setFileGoc(null);
    setFilePL1(null);
    setFilePL2(null);
    setUsingSampleData(true);
    setErrorMessage(null);
    setResults([]);
    setStats(null);
    setCurrentPage(1);
    setExtraColumnsGoc([]);
    setExtraColumnsPL1([]);
    setExtraColumnsPL2([]);

    const inspGoc = getSampleFileInspection('SOURCE');
    const inspPL1 = getSampleFileInspection('PL1');
    const inspPL2 = getSampleFileInspection('PL2');

    setInspectionGoc(inspGoc);
    setInspectionPL1(inspPL1);
    setInspectionPL2(inspPL2);

    setConfigGoc({
      headerRowIdx: inspGoc.headerRowIndex,
      nameColIdx: inspGoc.selectedNameColumnIndex,
      codeColIdx: inspGoc.selectedCodeColumnIndex,
      ttColIdx: inspGoc.selectedTTColumnIndex,
    });
    setConfigPL1({
      headerRowIdx: inspPL1.headerRowIndex,
      nameColIdx: inspPL1.selectedNameColumnIndex,
      codeColIdx: inspPL1.selectedCodeColumnIndex,
    });
    setConfigPL2({
      headerRowIdx: inspPL2.headerRowIndex,
      nameColIdx: inspPL2.selectedNameColumnIndex,
      codeColIdx: inspPL2.selectedCodeColumnIndex,
    });
  };

  // Reset toàn bộ
  const handleReset = () => {
    isCancelledRef.current = true;
    setFileGoc(null);
    setFilePL1(null);
    setFilePL2(null);
    setInspectionGoc(null);
    setInspectionPL1(null);
    setInspectionPL2(null);
    setUsingSampleData(false);
    setCurrentStep(1);
    setExtraColumnsGoc([]);
    setExtraColumnsPL1([]);
    setExtraColumnsPL2([]);
    setColumnsConfig(DEFAULT_OUTPUT_COLUMNS.map((c) => ({ ...c })));
    setResults([]);
    setStats(null);
    setErrorMessage(null);
    setProgress(0);
    setStatusMessage('');
    setProcessingSpeed(0);
    setRemainingSeconds(0);
    setProcessedCount(0);
    setTotalCount(0);
    setCurrentPage(1);
  };

  // Hủy bỏ tiến trình đang chạy
  const handleCancelProcessing = () => {
    isCancelledRef.current = true;
    setStatusMessage('Đang dừng tiến trình...');
  };

  // Chạy Mapping Tối ưu hóa cho Big Data & Không chặn UI
  const handleStartMapping = async () => {
    setErrorMessage(null);
    setIsProcessing(true);
    setCurrentStep(3);
    setProgress(2);
    setStatusMessage('Đang khởi tạo thuật toán và kiểm tra dữ liệu...');
    isCancelledRef.current = false;
    setProcessingSpeed(0);
    setRemainingSeconds(0);

    try {
      let sourceItems: SourceItem[] = [];
      let pl1Items: TargetItem[] = [];
      let pl2Items: TargetItem[] = [];

      if (usingSampleData) {
        setStatusMessage('Đang nạp 12 danh mục kỹ thuật mẫu thực tế...');
        setProgress(10);
        await new Promise((r) => setTimeout(r, 100));
        sourceItems = getSampleSourceList();
        pl1Items = getSampleTargetPL1();
        pl2Items = getSampleTargetPL2();
      } else {
        if (!fileGoc || !filePL1 || !filePL2) {
          throw new Error(
            'Vui lòng tải lên đầy đủ cả 3 file: File Danh mục gốc, Phụ lục 1 và Phụ lục 2 trước khi bắt đầu!'
          );
        }

        // Đọc File Gốc theo cấu hình cột đã chọn
        setStatusMessage('Đang đọc File Danh mục gốc theo cấu hình cột đã chọn...');
        setProgress(8);
        sourceItems = await parseSourceFile(fileGoc, configGoc);

        if (isCancelledRef.current) throw new Error('Đã hủy tiến trình bởi người dùng.');

        // Đọc Phụ lục 1 theo cấu hình cột đã chọn
        setStatusMessage('Đang đọc File Phụ lục 1 theo cấu hình cột đã chọn...');
        setProgress(18);
        pl1Items = await parsePL1File(filePL1, configPL1);

        if (isCancelledRef.current) throw new Error('Đã hủy tiến trình bởi người dùng.');

        // Đọc Phụ lục 2 theo cấu hình cột đã chọn
        setStatusMessage('Đang đọc File Phụ lục 2 theo cấu hình cột đã chọn...');
        setProgress(28);
        pl2Items = await parsePL2File(filePL2, configPL2);
      }

      if (isCancelledRef.current) throw new Error('Đã hủy tiến trình bởi người dùng.');

      // BƯỚC TẠO CHỈ MỤC TĂNG TỐC (PRE-INDEXING)
      setStatusMessage('Đang tạo chỉ mục tìm kiếm siêu tốc (Inverted Index) cho Phụ lục 1...');
      setProgress(35);
      await new Promise((r) => setTimeout(r, 10));
      const indexPL1 = createTargetIndex(pl1Items);

      setStatusMessage('Đang tạo chỉ mục tìm kiếm siêu tốc (Inverted Index) cho Phụ lục 2...');
      setProgress(42);
      await new Promise((r) => setTimeout(r, 10));
      const indexPL2 = createTargetIndex(pl2Items);

      const total = sourceItems.length;
      setTotalCount(total);
      setProcessedCount(0);
      const cutoff = threshold / 100.0;
      const mappedResults: MappingResult[] = [];

      let matchedPL1 = 0;
      let matchedPL2 = 0;
      let matchedBoth = 0;
      let unmatched = 0;

      const startTime = performance.now();
      const BATCH_SIZE = 50; // Xử lý theo lô 50 mục và nhường quyền (yield) cho Main Thread

      let stt1Counter = 0; // Bộ đếm STT 1 tích lũy - CHỈ TĂNG KHI STT 2 LÀ SỐ

      for (let i = 0; i < total; i += BATCH_SIZE) {
        if (isCancelledRef.current) {
          throw new Error('Đã hủy tiến trình đối chiếu theo yêu cầu.');
        }

        const chunkEnd = Math.min(i + BATCH_SIZE, total);

        for (let j = i; j < chunkEnd; j++) {
          const item = sourceItems[j];

          // Bóc tách cơ quan giải phẫu và chuyên khoa của danh mục gốc
          const sourceComp = item.component || decomposeMedicalProcedure(item.name);

          // Khớp Phụ lục 1 với bộ lọc giải phẫu thông minh 2 tầng
          const matchPL1 = getBestMatchWithIndex(item.name, indexPL1, cutoff, enableAnatomyFilter);

          // Khớp Phụ lục 2 với bộ lọc giải phẫu thông minh 2 tầng
          const matchPL2 = getBestMatchWithIndex(item.name, indexPL2, cutoff, enableAnatomyFilter);

          // STT 2: Giữ nguyên hoàn toàn theo file danh mục gốc (KHÔNG gán j + 1 để khắc phục lỗi nhảy số)
          const stt2FromSource = item.stt2 !== undefined ? item.stt2 : '';

          // STT 1: CHỈ TĂNG KHI STT 2 LÀ SỐ
          let stt1Val: number | string = '';
          if (isNumericSTT(stt2FromSource)) {
            stt1Counter++;
            stt1Val = stt1Counter;
          } else {
            stt1Val = '';
          }

          // Trích xuất các cột bổ sung từ từng file đã chọn
          const extraValues: Record<string, any> = {};

          // Trích xuất từ File Danh mục gốc
          for (const ec of extraColumnsGoc) {
            const rawVal = item.rawRow?.[ec.columnIndex];
            extraValues[ec.id] = rawVal !== undefined && rawVal !== null ? String(rawVal).trim() : '';
          }

          // Trích xuất từ Phụ Lục 1 (theo mục tương ứng được khớp)
          for (const ec of extraColumnsPL1) {
            if (matchPL1.matchedItem?.rawRow) {
              const rawVal = matchPL1.matchedItem.rawRow[ec.columnIndex];
              extraValues[ec.id] = rawVal !== undefined && rawVal !== null ? String(rawVal).trim() : '';
            } else {
              extraValues[ec.id] = '';
            }
          }

          // Trích xuất từ Phụ Lục 2 (theo mục tương ứng được khớp)
          for (const ec of extraColumnsPL2) {
            if (matchPL2.matchedItem?.rawRow) {
              const rawVal = matchPL2.matchedItem.rawRow[ec.columnIndex];
              extraValues[ec.id] = rawVal !== undefined && rawVal !== null ? String(rawVal).trim() : '';
            } else {
              extraValues[ec.id] = '';
            }
          }

          const mappedRow: MappingResult = {
            rowId: j + 1,
            stt1: stt1Val,
            stt2: stt2FromSource,
            maGoc: item.code,
            maPL1: matchPL1.code,
            maPL2: matchPL2.code,
            tenGoc: item.name,
            tenPL1: matchPL1.name,
            tenPL2: matchPL2.name,
            scorePL1: matchPL1.score,
            scorePL2: matchPL2.score,
            qtktBenhVien: '',
            soDonViThucHien: '',
            boPhanGoc: sourceComp.anatomyList.length > 0 ? sourceComp.anatomyList.join(', ') : undefined,
            chuyenKhoaGoc: item.chapter || (sourceComp.primaryCategory ? ANATOMY_ONTOLOGY[sourceComp.primaryCategory]?.name : undefined),
            boPhanPL1: matchPL1.anatomy,
            boPhanPL2: matchPL2.anatomy,
            extraValues,
          };
          mappedRow.aiAudit = auditMappingRowWithRules(mappedRow);
          mappedResults.push(mappedRow);

          if (matchPL1.name) matchedPL1++;
          if (matchPL2.name) matchedPL2++;
          if (matchPL1.name && matchPL2.name) matchedBoth++;
          if (!matchPL1.name && !matchPL2.name) unmatched++;
        }

        // Đo đạc tốc độ xử lý & Cập nhật UI
        const now = performance.now();
        const elapsedSec = (now - startTime) / 1000;
        const currentSpeed = Math.round(chunkEnd / Math.max(0.05, elapsedSec));
        const estRemaining = Math.max(0, Math.round((total - chunkEnd) / Math.max(1, currentSpeed)));
        const pct = 45 + Math.floor((chunkEnd / total) * 53);

        setProcessedCount(chunkEnd);
        setProgress(pct);
        setProcessingSpeed(currentSpeed);
        setRemainingSeconds(estRemaining);
        setStatusMessage(
          `Đang đối chiếu: ${chunkEnd.toLocaleString()} / ${total.toLocaleString()} danh mục • Tốc độ: ~${currentSpeed.toLocaleString()} dòng/giây`
        );

        // Nhường quyền cho trình duyệt cập nhật giao diện (tránh đơ tab)
        await new Promise((resolve) => setTimeout(resolve, 0));
      }

      const totalTimeSec = Math.round(((performance.now() - startTime) / 1000) * 10) / 10;
      setProgress(100);
      setStatusMessage(`Hoàn tất đối chiếu ${total.toLocaleString()} mục trong ${totalTimeSec}s!`);
      setResults(mappedResults);
      setStats({
        total,
        matchedPL1,
        matchedPL2,
        matchedBoth,
        unmatched,
        durationSeconds: totalTimeSec,
        speedRowsPerSec: Math.round(total / Math.max(0.1, totalTimeSec)),
      });
      setCurrentPage(1);
    } catch (err: any) {
      setErrorMessage(
        err.message || 'Đã xảy ra lỗi khi xử lý file Excel. Vui lòng kiểm tra lại cấu trúc file.'
      );
      setProgress(0);
    } finally {
      setIsProcessing(false);
      isCancelledRef.current = false;
    }
  };

  // Chạy AI Thẩm Định Chuyên Sâu (Gemini 3.8 Flash)
  const handleRunAiAudit = async () => {
    if (results.length === 0 || isAiAuditing) return;
    setIsAiAuditing(true);
    setErrorMessage(null);

    try {
      // Ưu tiên các dòng đã được ghép với PL1 hoặc PL2
      const targetIndices: number[] = [];
      results.forEach((r, idx) => {
        if (r.tenPL1 || r.tenPL2) {
          targetIndices.push(idx);
        }
      });

      if (targetIndices.length === 0) {
        setStatusMessage('Không có dòng nào đã ghép để thẩm định AI.');
        setIsAiAuditing(false);
        return;
      }

      const CHUNK_SIZE = 20;
      const totalChunks = Math.ceil(targetIndices.length / CHUNK_SIZE);
      const updatedResults = [...results];
      let warningCountNew = 0;

      for (let c = 0; c < totalChunks; c++) {
        const chunkIdxs = targetIndices.slice(c * CHUNK_SIZE, (c + 1) * CHUNK_SIZE);
        const chunkItems = chunkIdxs.map((idx) => ({
          stt: results[idx].rowId,
          tenGoc: results[idx].tenGoc,
          maGoc: results[idx].maGoc,
          tenPL1: results[idx].tenPL1,
          maPL1: results[idx].maPL1,
          tenPL2: results[idx].tenPL2,
          maPL2: results[idx].maPL2,
        }));

        setAiAuditProgress({
          current: Math.min(targetIndices.length, (c + 1) * CHUNK_SIZE),
          total: targetIndices.length,
          message: `Gemini AI đang rà soát lô ${c + 1}/${totalChunks} kỹ thuật...`,
        });

        try {
          const res = await fetch('/api/ai-audit', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ items: chunkItems }),
          });

          if (res.ok) {
            const data = await res.json();
            const aiResults = data.results || [];
            aiResults.forEach((aiItem: any) => {
              const rIndex = updatedResults.findIndex((r) => r.rowId === aiItem.stt);
              if (rIndex !== -1) {
                if (aiItem.hasWarning) warningCountNew++;
                const localRules = auditMappingRowWithRules(updatedResults[rIndex]);
                updatedResults[rIndex] = {
                  ...updatedResults[rIndex],
                  aiAudit: {
                    hasWarning: Boolean(aiItem.hasWarning),
                    warningType: aiItem.warningType || localRules.warningType,
                    reason: aiItem.reason,
                    severity: aiItem.severity,
                    recommendation: aiItem.recommendation || localRules.recommendation,
                    flagTarget: aiItem.flagTarget,
                    auditedBy: data.auditedBy === 'gemini' ? 'gemini' : 'clinical_rule',
                    details: localRules.details,
                    legalBasis: localRules.legalBasis,
                  },
                };
              }
            });
          } else {
            // Nếu có lỗi mạng/server, tự động áp dụng bộ thẩm định lâm sàng
            chunkIdxs.forEach((idx) => {
              const localAudit = auditMappingRowWithRules(updatedResults[idx]);
              updatedResults[idx] = {
                ...updatedResults[idx],
                aiAudit: localAudit,
              };
            });
          }
        } catch (postErr) {
          console.warn('Lỗi thẩm định kết nối, tự động chuyển sang luật lâm sàng:', postErr);
          chunkIdxs.forEach((idx) => {
            const localAudit = auditMappingRowWithRules(updatedResults[idx]);
            updatedResults[idx] = {
              ...updatedResults[idx],
              aiAudit: localAudit,
            };
          });
        }

        // Cập nhật state kết quả
        setResults([...updatedResults]);
        await new Promise((resolve) => setTimeout(resolve, 50));
      }

      const totalWarnings = updatedResults.filter((r) => r.aiAudit?.hasWarning).length;
      setAiAuditSummary({
        totalAudited: targetIndices.length,
        warningCount: totalWarnings,
        safeCount: targetIndices.length - totalWarnings,
      });
    } catch (err: any) {
      setErrorMessage(`Lỗi trong quá trình thẩm định AI: ${err.message || String(err)}`);
    } finally {
      setIsAiAuditing(false);
      setAiAuditProgress(null);
    }
  };

  // Hủy ghép cặp sai lệch (ví dụ tháo PL2 khi gốc là chăm sóc mà PL2 là phẫu thuật mở thông)
  const handleClearMatch = (rowId: number, target: 'PL1' | 'PL2' | 'BOTH') => {
    setResults((prev) =>
      prev.map((r) => {
        if (r.rowId !== rowId) return r;
        const updated = { ...r };
        if (target === 'PL1' || target === 'BOTH') {
          updated.tenPL1 = '';
          updated.maPL1 = '';
          updated.scorePL1 = 0;
          updated.boPhanPL1 = undefined;
        }
        if (target === 'PL2' || target === 'BOTH') {
          updated.tenPL2 = '';
          updated.maPL2 = '';
          updated.scorePL2 = 0;
          updated.boPhanPL2 = undefined;
        }
        updated.aiAudit = auditMappingRowWithRules(updated);
        return updated;
      })
    );
  };

  // Bỏ qua cảnh báo nếu người dùng chủ động muốn ghép
  const handleDismissWarning = (rowId: number) => {
    setResults((prev) =>
      prev.map((r) => {
        if (r.rowId !== rowId) return r;
        return {
          ...r,
          aiAudit: {
            hasWarning: false,
            severity: 'SAFE',
            reason: 'Đã được bác sĩ/chuyên viên duyệt chấp nhận',
            auditedBy: 'user_reviewed',
          },
        };
      })
    );
  };

  // Xuất file Excel (Tự động tô vàng các dòng có cảnh báo và áp dụng thứ tự/tiêu đề cột tùy biến)
  const handleDownloadExcel = () => {
    if (results.length === 0) return;
    exportMappingToExcel(results, columnsConfig);
  };

  // Số lượng cảnh báo phát hiện
  const warningCount = results.filter((r) => r.aiAudit?.hasWarning).length;

  // Lọc kết quả tìm kiếm và bộ lọc trạng thái
  const filteredResults = results.filter((r) => {
    // Lọc theo trạng thái
    if (statusFilter === 'warning_only' && !r.aiAudit?.hasWarning) return false;
    if (statusFilter === 'both' && (!r.tenPL1 || !r.tenPL2)) return false;
    if (statusFilter === 'pl1_only' && (!r.tenPL1 || r.tenPL2)) return false;
    if (statusFilter === 'pl2_only' && (r.tenPL1 || !r.tenPL2)) return false;
    if (statusFilter === 'unmatched' && (r.tenPL1 || r.tenPL2)) return false;

    // Lọc theo Chuyên khoa / Bộ phận giải phẫu
    if (selectedSpecialty !== 'all') {
      const matchSpecialty =
        r.chuyenKhoaGoc === selectedSpecialty ||
        (r.boPhanGoc && r.boPhanGoc.toLowerCase().includes(selectedSpecialty.toLowerCase()));
      if (!matchSpecialty) return false;
    }

    // Lọc theo từ khóa tìm kiếm
    if (!searchFilter.trim()) return true;
    const q = searchFilter.toLowerCase();
    return (
      r.tenGoc.toLowerCase().includes(q) ||
      r.maGoc.toLowerCase().includes(q) ||
      r.tenPL1.toLowerCase().includes(q) ||
      r.tenPL2.toLowerCase().includes(q) ||
      r.maPL1.toLowerCase().includes(q) ||
      r.maPL2.toLowerCase().includes(q) ||
      (r.boPhanGoc && r.boPhanGoc.toLowerCase().includes(q)) ||
      (r.chuyenKhoaGoc && r.chuyenKhoaGoc.toLowerCase().includes(q)) ||
      (r.aiAudit?.reason && r.aiAudit.reason.toLowerCase().includes(q))
    );
  });

  // Phân trang dữ liệu hiển thị (Pagination)
  const totalPages = Math.max(1, Math.ceil(filteredResults.length / pageSize));
  const validCurrentPage = Math.min(currentPage, totalPages);
  const startIndex = (validCurrentPage - 1) * pageSize;
  const displayRows = filteredResults.slice(startIndex, startIndex + pageSize);

  // Cột hiển thị theo thứ tự và cấu hình tùy chỉnh của người dùng
  const activeSortedColumns = useMemo(() => {
    return [...columnsConfig]
      .filter((c) => c.selected)
      .sort((a, b) => a.order - b.order);
  }, [columnsConfig]);

  return (
    <div id="medical-mapping-app" className="min-h-screen bg-slate-50 text-slate-900 font-sans">
      {/* Top Banner Header */}
      <header className="bg-gradient-to-r from-blue-950 via-slate-900 to-sky-950 text-white shadow-md border-b border-slate-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-5">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
            <div className="space-y-1.5">
              <div className="flex flex-wrap items-center gap-2">
                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-sky-500/20 text-sky-200 border border-sky-400/30">
                  <Sparkles className="w-3.5 h-3.5 text-sky-300" />
                  Y Tế Số • Thông tư 23/2024/TT-BYT & TT 32/2023/TT-BYT
                </span>
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-emerald-500/20 text-emerald-300 border border-emerald-400/30">
                  <Zap className="w-3 h-3 text-emerald-400" />
                  Chỉ Mục Đảo Siêu Tốc • Sẵn sàng cho File Nhiều Dòng
                </span>
              </div>
              <div className="flex items-center gap-3">
                <div className="p-1.5 rounded-xl bg-sky-500/20 border border-sky-400/30 shrink-0 shadow-inner">
                  <img src="/favicon.svg" alt="Biểu tượng Y tế" className="w-8 h-8 rounded-lg shadow-sm" />
                </div>
                <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-white">
                  Hệ Thống Đối Chiếu Danh Mục Kỹ Thuật Y Tế Tự Động (Fuzzy Matching)
                </h1>
              </div>
              <p className="text-xs sm:text-sm text-slate-300 max-w-3xl leading-relaxed">
                Tự động đối chiếu mờ từ <span className="text-white font-semibold">File gốc</span> sang{' '}
                <span className="text-sky-300 font-semibold">Phụ lục 1</span> và{' '}
                <span className="text-cyan-300 font-semibold">Phụ lục 2</span>. Tối ưu bộ nhớ đệm, chạy mượt mà trên GitHub và Vercel Edge.
              </p>
            </div>

            {/* Quick Action Buttons */}
            <div className="flex flex-wrap items-center gap-2 self-start lg:self-center shrink-0">
              <button
                id="load-sample-data-btn"
                type="button"
                onClick={handleLoadSampleData}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs sm:text-sm font-semibold bg-sky-600 hover:bg-sky-500 text-white shadow-xs transition-all cursor-pointer border border-sky-400/40 hover:shadow-md"
                title="Tải ngay bộ dữ liệu y tế thực tế để kiểm tra và đối chiếu"
              >
                <Layers className="w-3.5 h-3.5 text-sky-200" />
                Dữ Liệu Mẫu
              </button>

              <button
                id="download-sample-excel-btn"
                type="button"
                onClick={generateSampleExcelFiles}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs sm:text-sm font-medium bg-white/10 hover:bg-white/20 border border-white/20 text-white transition-all cursor-pointer"
                title="Tải 3 file Excel mẫu đúng chuẩn skiprows=1 và skiprows=3 để test"
              >
                <Download className="w-3.5 h-3.5 text-slate-300" />
                Tải 3 File Mẫu
              </button>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-7 space-y-7">
        {/* Step 1 & 2: Upload, Interactive Inspection & Column Customization */}
        <FileColumnWorkflow
          fileGoc={fileGoc}
          filePL1={filePL1}
          filePL2={filePL2}
          usingSampleData={usingSampleData}
          inspectionGoc={inspectionGoc}
          inspectionPL1={inspectionPL1}
          inspectionPL2={inspectionPL2}
          columnsConfig={columnsConfig}
          setColumnsConfig={setColumnsConfig}
          configGoc={configGoc}
          setConfigGoc={setConfigGoc}
          configPL1={configPL1}
          setConfigPL1={setConfigPL1}
          configPL2={configPL2}
          setConfigPL2={setConfigPL2}
          extraColumnsGoc={extraColumnsGoc}
          extraColumnsPL1={extraColumnsPL1}
          extraColumnsPL2={extraColumnsPL2}
          onAddExtraColumn={handleAddExtraColumn}
          onUpdateExtraColumn={handleUpdateExtraColumn}
          onRemoveExtraColumn={handleRemoveExtraColumn}
          currentStep={currentStep}
          setCurrentStep={setCurrentStep}
          hasResults={results.length > 0}
          threshold={threshold}
          setThreshold={setThreshold}
          enableAnatomyFilter={enableAnatomyFilter}
          setEnableAnatomyFilter={setEnableAnatomyFilter}
          isProcessing={isProcessing}
          onFileUpload={handleFileUpload}
          onLoadSample={handleLoadSampleData}
          onStartMapping={handleStartMapping}
          onReset={handleReset}
        />

        {/* Error Message */}
        {errorMessage && (
          <div className="p-4 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm flex items-start gap-3 shadow-xs">
            <AlertCircle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
            <div>
              <div className="font-semibold">Thông báo lỗi:</div>
              <div>{errorMessage}</div>
            </div>
          </div>
        )}

        {/* Step 3: Tiến trình đối chiếu, Thống kê KPI & Bảng kết quả (Chỉ hiển thị ở Bước 3) */}
        {currentStep === 3 && (
          <>
            {/* Progress Bar & Realtime Performance Metrics */}
            {isProcessing && (
              <div className="space-y-3 bg-sky-50/70 p-4 rounded-xl border border-sky-100 shadow-xs">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between text-xs font-semibold text-sky-950 gap-2">
                  <span className="truncate">{statusMessage}</span>
                  <span className="text-sky-700 font-mono text-sm shrink-0">{progress}%</span>
                </div>

                {/* Visual Progress Bar */}
                <div className="w-full bg-slate-200 h-2.5 rounded-full overflow-hidden">
                  <div
                    className="bg-sky-600 h-2.5 rounded-full transition-all duration-200 ease-out"
                    style={{ width: `${progress}%` }}
                  />
                </div>

                {/* Speed & Remaining Time Badges */}
                {totalCount > 0 && (
                  <div className="flex flex-wrap items-center gap-4 text-xs text-slate-600 pt-1">
                    <span className="flex items-center gap-1.5 font-mono">
                      <Gauge className="w-3.5 h-3.5 text-sky-600" />
                      Tốc độ: <b>{processingSpeed.toLocaleString()}</b> dòng/giây
                    </span>
                    <span className="flex items-center gap-1.5 font-mono">
                      <Timer className="w-3.5 h-3.5 text-sky-600" />
                      Ước tính còn lại: <b>~{remainingSeconds}</b> giây
                    </span>
                    <span className="text-slate-400">
                      ({processedCount.toLocaleString()} / {totalCount.toLocaleString()} dòng)
                    </span>
                  </div>
                )}
              </div>
            )}

        {/* Step 2: Statistics & Summary (If processed) */}
        {stats && (
          <section className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 sm:gap-4">
            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
              <div className="text-xs text-slate-500 font-medium">Tổng danh mục gốc</div>
              <div className="text-2xl font-bold text-slate-900 mt-1">{stats.total.toLocaleString()}</div>
              <div className="text-[11px] text-slate-400 mt-0.5">
                {stats.durationSeconds ? `Xong trong ${stats.durationSeconds}s (~${stats.speedRowsPerSec?.toLocaleString()} dòng/s)` : 'dịch vụ kỹ thuật'}
              </div>
            </div>
            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
              <div className="text-xs text-emerald-700 font-medium">Khớp Phụ lục 1 (TT23)</div>
              <div className="text-2xl font-bold text-emerald-700 mt-1">
                {stats.matchedPL1.toLocaleString()}
                <span className="text-xs font-normal text-slate-500 ml-1.5">
                  ({Math.round((stats.matchedPL1 / stats.total) * 100)}%)
                </span>
              </div>
              <div className="text-[11px] text-emerald-600/80 mt-0.5">đạt ngưỡng ≥ {threshold}%</div>
            </div>
            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
              <div className="text-xs text-blue-700 font-medium">Khớp Phụ lục 2 (TT23)</div>
              <div className="text-2xl font-bold text-blue-700 mt-1">
                {stats.matchedPL2.toLocaleString()}
                <span className="text-xs font-normal text-slate-500 ml-1.5">
                  ({Math.round((stats.matchedPL2 / stats.total) * 100)}%)
                </span>
              </div>
              <div className="text-[11px] text-blue-600/80 mt-0.5">đạt ngưỡng ≥ {threshold}%</div>
            </div>
            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
              <div className="text-xs text-slate-500 font-medium">Chưa có tương đương</div>
              <div className="text-2xl font-bold text-slate-700 mt-1">{stats.unmatched.toLocaleString()}</div>
              <div className="text-[11px] text-slate-400 mt-0.5">cần thẩm định thủ công</div>
            </div>
            {/* Card Điểm Cần Lưu Ý - Tô Vàng */}
            <div
              id="stat-card-warning-yellow"
              onClick={() => {
                setStatusFilter(statusFilter === 'warning_only' ? 'all' : 'warning_only');
                setCurrentPage(1);
              }}
              className={`p-4 rounded-xl border transition-all cursor-pointer select-none ${
                statusFilter === 'warning_only'
                  ? 'bg-amber-100 border-amber-400 ring-2 ring-amber-400 shadow-sm'
                  : 'bg-amber-50/70 border-amber-300 hover:bg-amber-100/70 shadow-xs'
              }`}
              title="Bấm để lọc xem ngay các dòng có điểm cần lưu ý (tô vàng)"
            >
              <div className="text-xs text-amber-900 font-bold flex items-center justify-between">
                <span>Điểm Cần Lưu Ý</span>
                <span className="px-1.5 py-0.5 rounded text-[10px] bg-amber-200 text-amber-900 font-mono">Tô vàng</span>
              </div>
              <div className="text-2xl font-black text-amber-900 mt-1 flex items-baseline gap-1.5">
                <span>{warningCount.toLocaleString()}</span>
                <span className="text-xs font-normal text-amber-700">mục</span>
              </div>
              <div className="text-[11px] text-amber-800 mt-0.5 flex items-center gap-1 font-medium">
                <AlertTriangle className="w-3 h-3 text-amber-600 shrink-0" />
                <span>Khác biệt can thiệp / kỹ thuật</span>
              </div>
            </div>
          </section>
        )}

        {/* Step 3: Preview Table, Pagination & Download Button */}
        {results.length > 0 && (
          <section className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden space-y-0">
            {/* Table Header Controls */}
            <div className="p-4 sm:p-5 border-b border-slate-200 flex flex-col gap-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <h3 className="text-base font-semibold text-slate-900 flex items-center gap-2">
                    <FileCheck2 className="w-5 h-5 text-emerald-600" />
                    Bảng Xem Trước Kết Quả Mapping (10 Cột Chuẩn Báo Cáo)
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Hiển thị {filteredResults.length.toLocaleString()} dòng kết quả phù hợp (Đã phân trang để tải trang tức thì).
                  </p>
                </div>

                {/* Action Buttons: AI Audit & Download Excel */}
                <div className="flex flex-wrap items-center gap-2 self-start sm:self-auto">
                  <button
                    id="run-ai-audit-btn"
                    type="button"
                    onClick={handleRunAiAudit}
                    disabled={isAiAuditing || results.length === 0}
                    className="inline-flex items-center justify-center gap-2 px-3.5 py-2.5 rounded-lg text-xs font-bold bg-gradient-to-r from-purple-700 to-indigo-700 hover:from-purple-600 hover:to-indigo-600 text-white shadow-xs transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed border border-purple-400/40 hover:shadow-md"
                    title="Sử dụng Gemini AI thẩm định chuyên sâu toàn bộ file mapping để phát hiện các điểm sai lệch"
                  >
                    {isAiAuditing ? (
                      <>
                        <div className="w-3.5 h-3.5 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                        <span>Gemini Đang Rà Soát...</span>
                      </>
                    ) : (
                      <>
                        <Sparkles className="w-4 h-4 text-amber-300 animate-pulse" />
                        <span>AI Rà Soát & Tô Vàng (Gemini)</span>
                      </>
                    )}
                  </button>

                  <button
                    id="download-excel-result-btn"
                    type="button"
                    onClick={handleDownloadExcel}
                    className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs transition-colors cursor-pointer"
                    title="Xuất file Excel đã tự động tô màu nền vàng các dòng AI cảnh báo"
                  >
                    <Download className="w-4 h-4" />
                    <span>Xuất Excel Đã Tô Vàng (.xlsx)</span>
                  </button>
                </div>
              </div>

              {/* AI Progress Banner */}
              {aiAuditProgress && (
                <div className="p-3 bg-purple-50 border border-purple-200 rounded-lg flex items-center justify-between gap-3 text-xs text-purple-900 animate-pulse">
                  <div className="flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-purple-600 shrink-0" />
                    <span className="font-semibold">{aiAuditProgress.message}</span>
                  </div>
                  <span className="font-mono font-bold text-purple-700">
                    {aiAuditProgress.current} / {aiAuditProgress.total} kỹ thuật
                  </span>
                </div>
              )}

              {/* AI Summary Banner */}
              {aiAuditSummary && (
                <div className="p-3 bg-amber-50/90 border border-amber-300 rounded-lg flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs text-amber-950">
                  <div className="flex items-center gap-2">
                    <Bot className="w-4 h-4 text-purple-700 shrink-0" />
                    <span>
                      <b>Gemini AI đã hoàn tất rà soát {aiAuditSummary.totalAudited} danh mục:</b> Phát hiện{' '}
                      <b className="text-amber-800">{aiAuditSummary.warningCount} điểm cần lưu ý</b> và đã tự động tô vàng.
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => { setStatusFilter('warning_only'); setCurrentPage(1); }}
                    className="px-2.5 py-1 rounded bg-amber-200 hover:bg-amber-300 text-amber-900 font-bold self-start sm:self-auto cursor-pointer"
                  >
                    Xem ngay {aiAuditSummary.warningCount} điểm tô vàng →
                  </button>
                </div>
              )}

              {/* Filters and Search Bar */}
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 pt-2">
                {/* Status Filter Tabs */}
                <div className="flex flex-wrap items-center gap-1.5 text-xs">
                  <button
                    onClick={() => { setStatusFilter('all'); setCurrentPage(1); }}
                    className={`px-3 py-1.5 rounded-lg font-medium transition-colors cursor-pointer ${
                      statusFilter === 'all'
                        ? 'bg-slate-900 text-white'
                        : 'bg-slate-100 hover:bg-slate-200 text-slate-600'
                    }`}
                  >
                    Tất cả ({results.length})
                  </button>
                  <button
                    id="filter-tab-warning-yellow-btn"
                    onClick={() => { setStatusFilter('warning_only'); setCurrentPage(1); }}
                    className={`px-3 py-1.5 rounded-lg font-semibold transition-all cursor-pointer flex items-center gap-1.5 ${
                      statusFilter === 'warning_only'
                        ? 'bg-amber-400 text-amber-950 ring-2 ring-amber-500 shadow-xs'
                        : 'bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-300'
                    }`}
                  >
                    <AlertTriangle className="w-3.5 h-3.5 text-amber-700" />
                    <span>🟡 Cần lưu ý / Tô vàng ({warningCount})</span>
                  </button>
                  <button
                    onClick={() => { setStatusFilter('both'); setCurrentPage(1); }}
                    className={`px-3 py-1.5 rounded-lg font-medium transition-colors cursor-pointer ${
                      statusFilter === 'both'
                        ? 'bg-emerald-700 text-white'
                        : 'bg-slate-100 hover:bg-slate-200 text-slate-600'
                    }`}
                  >
                    Khớp cả 2 PL ({stats?.matchedBoth ?? 0})
                  </button>
                  <button
                    onClick={() => { setStatusFilter('pl1_only'); setCurrentPage(1); }}
                    className={`px-3 py-1.5 rounded-lg font-medium transition-colors cursor-pointer ${
                      statusFilter === 'pl1_only'
                        ? 'bg-sky-700 text-white'
                        : 'bg-slate-100 hover:bg-slate-200 text-slate-600'
                    }`}
                  >
                    Chỉ khớp PL1 ({(stats?.matchedPL1 ?? 0) - (stats?.matchedBoth ?? 0)})
                  </button>
                  <button
                    onClick={() => { setStatusFilter('pl2_only'); setCurrentPage(1); }}
                    className={`px-3 py-1.5 rounded-lg font-medium transition-colors cursor-pointer ${
                      statusFilter === 'pl2_only'
                        ? 'bg-blue-700 text-white'
                        : 'bg-slate-100 hover:bg-slate-200 text-slate-600'
                    }`}
                  >
                    Chỉ khớp PL2 ({(stats?.matchedPL2 ?? 0) - (stats?.matchedBoth ?? 0)})
                  </button>
                  <button
                    onClick={() => { setStatusFilter('unmatched'); setCurrentPage(1); }}
                    className={`px-3 py-1.5 rounded-lg font-medium transition-colors cursor-pointer ${
                      statusFilter === 'unmatched'
                        ? 'bg-amber-700 text-white'
                        : 'bg-slate-100 hover:bg-slate-200 text-slate-600'
                    }`}
                  >
                    Chưa khớp ({stats?.unmatched ?? 0})
                  </button>
                </div>

                {/* Search, Specialty & Page Size */}
                <div className="flex items-center flex-wrap gap-2">
                  <select
                    id="specialty-filter-select"
                    value={selectedSpecialty}
                    onChange={(e) => { setSelectedSpecialty(e.target.value); setCurrentPage(1); }}
                    className="text-xs bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 text-slate-700 cursor-pointer font-medium"
                  >
                    <option value="all">🩺 Tất cả chuyên khoa</option>
                    {Object.values(ANATOMY_ONTOLOGY).map((cat) => (
                      <option key={cat.name} value={cat.name}>
                        {cat.name}
                      </option>
                    ))}
                  </select>

                  <div className="relative flex-1 sm:flex-initial">
                    <Search className="w-4 h-4 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                    <input
                      id="search-filter-input"
                      type="text"
                      value={searchFilter}
                      onChange={(e) => { setSearchFilter(e.target.value); setCurrentPage(1); }}
                      placeholder="Tìm tên, mã, bộ phận..."
                      className="pl-8 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:border-sky-500 w-full sm:w-52"
                    />
                  </div>

                  <select
                    id="page-size-select"
                    value={pageSize}
                    onChange={(e) => { setPageSize(Number(e.target.value)); setCurrentPage(1); }}
                    className="text-xs bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 text-slate-700 cursor-pointer"
                  >
                    <option value={15}>15 dòng/trang</option>
                    <option value={25}>25 dòng/trang</option>
                    <option value={50}>50 dòng/trang</option>
                    <option value={100}>100 dòng/trang</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Table Content with Virtualized/Paginated Rows */}
            <div className="overflow-x-auto max-h-[520px]">
              <table className="w-full text-left text-xs border-collapse">
                <thead className="bg-slate-100 text-slate-700 uppercase text-[10px] tracking-wider font-semibold sticky top-0 z-10 border-b border-slate-200">
                  <tr>
                    {activeSortedColumns.map((col) => {
                      const isSTT = col.id === 'stt1' || col.id === 'stt2';
                      const isAi = col.id === 'aiAudit';
                      const isPL1 = col.id.includes('PL1');
                      const isPL2 = col.id.includes('PL2');

                      return (
                        <th
                          key={col.id}
                          className={`p-2.5 border-r border-slate-200 ${
                            isSTT ? 'text-center w-14' : ''
                          } ${isPL1 ? 'text-emerald-800' : ''} ${
                            isPL2 ? 'text-blue-800' : ''
                          } ${
                            isAi
                              ? 'bg-amber-100/80 text-amber-950 font-bold border-l border-amber-300 min-w-[220px]'
                              : ''
                          } ${col.id.startsWith('ten') ? 'min-w-[220px]' : ''}`}
                          title={col.description}
                        >
                          {col.customTitle || col.defaultTitle}
                        </th>
                      );
                    })}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {displayRows.length > 0 ? (
                    displayRows.map((row) => {
                      const isWarned = Boolean(row.aiAudit?.hasWarning);
                      const isPL1Flagged = isWarned && (row.aiAudit?.flagTarget === 'PL1' || row.aiAudit?.flagTarget === 'BOTH');
                      const isPL2Flagged = isWarned && (row.aiAudit?.flagTarget === 'PL2' || row.aiAudit?.flagTarget === 'BOTH');

                      return (
                        <tr
                          key={row.rowId}
                          className={`transition-colors ${
                            isWarned
                              ? 'bg-amber-50/90 hover:bg-amber-100/90 border-l-4 border-l-amber-500'
                              : 'hover:bg-sky-50/40'
                          }`}
                        >
                          {activeSortedColumns.map((col) => {
                            if (col.id === 'stt1') {
                              return (
                                <td key={col.id} className="p-2.5 text-center font-mono text-slate-500 border-r border-slate-200">
                                  {row.stt1 !== '' ? (
                                    <span className="font-semibold text-slate-700">{row.stt1}</span>
                                  ) : (
                                    <span className="text-slate-300">-</span>
                                  )}
                                </td>
                              );
                            }
                            if (col.id === 'stt2') {
                              return (
                                <td key={col.id} className="p-2.5 text-center font-mono text-slate-500 border-r border-slate-200">
                                  {row.stt2 !== '' ? (
                                    <span>{row.stt2}</span>
                                  ) : (
                                    <span className="text-slate-300">-</span>
                                  )}
                                </td>
                              );
                            }
                            if (col.id === 'maGoc') {
                              return (
                                <td key={col.id} className="p-2.5 font-mono font-medium text-slate-800 border-r border-slate-200">
                                  {row.maGoc}
                                </td>
                              );
                            }
                            if (col.id === 'maPL1') {
                              return (
                                <td key={col.id} className="p-2.5 font-mono text-emerald-700 font-semibold border-r border-slate-200">
                                  {row.maPL1 || <span className="text-slate-300 font-normal italic">Trống</span>}
                                </td>
                              );
                            }
                            if (col.id === 'maPL2') {
                              return (
                                <td key={col.id} className="p-2.5 font-mono text-blue-700 font-semibold border-r border-slate-200">
                                  {row.maPL2 || <span className="text-slate-300 font-normal italic">Trống</span>}
                                </td>
                              );
                            }
                            if (col.id === 'tenGoc') {
                              return (
                                <td key={col.id} className="p-2.5 font-medium text-slate-900 border-r border-slate-200">
                                  <div>{row.tenGoc}</div>
                                  {(row.chuyenKhoaGoc || row.boPhanGoc) && (
                                    <div className="mt-1 flex items-center gap-1.5 flex-wrap">
                                      {row.chuyenKhoaGoc && (
                                        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] bg-slate-100 text-slate-700 font-medium border border-slate-200">
                                          <Stethoscope className="w-2.5 h-2.5 text-sky-600" />
                                          {row.chuyenKhoaGoc}
                                        </span>
                                      )}
                                      {row.boPhanGoc && (
                                        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] bg-sky-50 text-sky-800 font-medium border border-sky-200">
                                          <Activity className="w-2.5 h-2.5 text-sky-600" />
                                          {row.boPhanGoc}
                                        </span>
                                      )}
                                    </div>
                                  )}
                                </td>
                              );
                            }
                            if (col.id === 'tenPL1') {
                              return (
                                <td key={col.id} className="p-2.5 border-r border-slate-200">
                                  {row.tenPL1 ? (
                                    <div className={`space-y-1 ${isPL1Flagged ? 'p-1.5 rounded-lg bg-amber-100/90 border border-amber-400' : ''}`}>
                                      <div className="text-emerald-900 font-medium">{row.tenPL1}</div>
                                      <div className="flex items-center gap-1.5 flex-wrap">
                                        <span className="inline-block px-1.5 py-0.2 rounded text-[10px] bg-emerald-100 text-emerald-800 font-mono">
                                          {row.scorePL1}%
                                        </span>
                                        {row.boPhanPL1 && (
                                          <span className="inline-flex items-center gap-0.5 px-1.5 py-0.2 rounded text-[10px] bg-emerald-50 text-emerald-700 border border-emerald-200">
                                            <ShieldCheck className="w-2.5 h-2.5 text-emerald-600" />
                                            {row.boPhanPL1}
                                          </span>
                                        )}
                                        {isPL1Flagged && (
                                          <span className="inline-flex items-center gap-0.5 px-1.5 py-0.2 rounded text-[10px] bg-amber-200 text-amber-900 font-bold">
                                            <AlertTriangle className="w-2.5 h-2.5 text-amber-700" />
                                            Cần lưu ý
                                          </span>
                                        )}
                                      </div>
                                    </div>
                                  ) : (
                                    <span className="text-slate-300 italic">Không khớp ( &lt; {threshold}% )</span>
                                  )}
                                </td>
                              );
                            }
                            if (col.id === 'tenPL2') {
                              return (
                                <td key={col.id} className="p-2.5 border-r border-slate-200">
                                  {row.tenPL2 ? (
                                    <div className={`space-y-1 ${isPL2Flagged ? 'p-1.5 rounded-lg bg-amber-100/90 border border-amber-400' : ''}`}>
                                      <div className="text-blue-900 font-medium">{row.tenPL2}</div>
                                      <div className="flex items-center gap-1.5 flex-wrap">
                                        <span className="inline-block px-1.5 py-0.2 rounded text-[10px] bg-blue-100 text-blue-800 font-mono">
                                          {row.scorePL2}%
                                        </span>
                                        {row.boPhanPL2 && (
                                          <span className="inline-flex items-center gap-0.5 px-1.5 py-0.2 rounded text-[10px] bg-blue-50 text-blue-700 border border-blue-200">
                                            <ShieldCheck className="w-2.5 h-2.5 text-blue-600" />
                                            {row.boPhanPL2}
                                          </span>
                                        )}
                                        {isPL2Flagged && (
                                          <span className="inline-flex items-center gap-0.5 px-1.5 py-0.2 rounded text-[10px] bg-amber-200 text-amber-900 font-bold">
                                            <AlertTriangle className="w-2.5 h-2.5 text-amber-700" />
                                            Cần lưu ý
                                          </span>
                                        )}
                                      </div>
                                    </div>
                                  ) : (
                                    <span className="text-slate-300 italic">Không khớp ( &lt; {threshold}% )</span>
                                  )}
                                </td>
                              );
                            }
                            if (col.id === 'qtktBenhVien') {
                              return (
                                <td key={col.id} className="p-2.5 text-slate-400 italic border-r border-slate-200">
                                  {row.qtktBenhVien || '(Nhân viên tự điền)'}
                                </td>
                              );
                            }
                            if (col.id === 'soDonViThucHien') {
                              return (
                                <td key={col.id} className="p-2.5 text-slate-400 italic border-r border-slate-200">
                                  {row.soDonViThucHien || '(Để trống)'}
                                </td>
                              );
                            }
                            if (col.id === 'aiAudit') {
                              const audit = row.aiAudit;
                              const isExpanded = expandedAuditRows.has(row.rowId);
                              const hasDetails = Boolean(audit?.details && audit.details.length > 0);

                              return (
                                <td key={col.id} className="p-2.5 min-w-[280px] max-w-[380px]">
                                  {isWarned ? (
                                    <div className="space-y-1.5">
                                      <div className="flex items-center justify-between gap-1">
                                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold ${audit?.severity === 'HIGH' ? 'bg-red-100 text-red-900 border border-red-300' : 'bg-amber-100 text-amber-900 border border-amber-300'}`}>
                                          <AlertTriangle className={`w-3 h-3 ${audit?.severity === 'HIGH' ? 'text-red-700' : 'text-amber-700'} shrink-0`} />
                                          <span>{audit?.severity === 'HIGH' ? 'CẢNH BÁO NGUY CƠ CAO' : 'CẦN LƯU Ý'}</span>
                                        </span>

                                        <button
                                          type="button"
                                          onClick={() => setAuditModalRow(row)}
                                          className="inline-flex items-center gap-1 text-[10px] text-sky-700 hover:text-sky-900 font-semibold cursor-pointer underline hover:no-underline"
                                          title="Mở biên bản thẩm định y khoa & đối chiếu chi tiết"
                                        >
                                          <FileText className="w-3 h-3" />
                                          <span>Biên bản BHYT</span>
                                        </button>
                                      </div>

                                      <p className="text-[11px] text-amber-950 font-medium leading-snug">
                                        {audit?.reason}
                                      </p>

                                      {audit?.recommendation && (
                                        <p className="text-[10px] text-amber-800 italic">
                                          💡 {audit.recommendation}
                                        </p>
                                      )}

                                      {/* Chi tiết giải trình có thể bấm mở rộng (Accordion) */}
                                      {hasDetails && (
                                        <div className="pt-1">
                                          <button
                                            type="button"
                                            onClick={() => toggleExpandAudit(row.rowId)}
                                            className="inline-flex items-center gap-1 text-[10px] text-slate-700 hover:text-slate-900 font-medium bg-slate-100 hover:bg-slate-200 px-2 py-0.5 rounded border border-slate-200 cursor-pointer transition-colors"
                                          >
                                            <Scale className="w-3 h-3 text-amber-700" />
                                            <span>Giải trình lâm sàng ({audit.details!.length})</span>
                                            {isExpanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                                          </button>

                                          {isExpanded && (
                                            <div className="mt-1.5 p-2 bg-amber-50/80 border border-amber-200 rounded text-[10px] space-y-1.5 animate-in fade-in duration-150">
                                              {audit.details!.map((det, dIdx) => (
                                                <div key={dIdx} className="space-y-0.5 border-b border-amber-200/60 pb-1.5 last:border-0 last:pb-0">
                                                  <div className="font-bold text-amber-950 flex items-center gap-1">
                                                    <span className="w-1.5 h-1.5 rounded-full bg-amber-600"></span>
                                                    {det.conflictType}
                                                  </div>
                                                  <div className="text-slate-700">
                                                    <span className="text-slate-500 font-medium">Gốc:</span> {det.sourceFeature} ➔ <span className="text-slate-500 font-medium">Đối chiếu:</span> {det.targetFeature}
                                                  </div>
                                                  <div className="text-slate-800">
                                                    <span className="font-semibold text-slate-900">Lâm sàng:</span> {det.clinicalImpact}
                                                  </div>
                                                  {det.insuranceRisk && (
                                                    <div className="text-red-700 font-medium">
                                                      ⚠️ {det.insuranceRisk}
                                                    </div>
                                                  )}
                                                </div>
                                              ))}
                                              {audit.legalBasis && (
                                                <div className="text-[9px] text-slate-500 italic pt-1 border-t border-amber-200/50">
                                                  Căn cứ: {audit.legalBasis}
                                                </div>
                                              )}
                                            </div>
                                          )}
                                        </div>
                                      )}

                                      <div className="flex items-center gap-1.5 flex-wrap pt-1">
                                        {isPL2Flagged && (
                                          <button
                                            type="button"
                                            onClick={() => handleClearMatch(row.rowId, 'PL2')}
                                            className="text-[10px] px-2 py-0.5 rounded bg-red-100 hover:bg-red-200 text-red-700 font-semibold cursor-pointer border border-red-200"
                                            title="Tháo liên kết Phụ lục 2 bị lệch bản chất can thiệp"
                                          >
                                            Hủy PL2
                                          </button>
                                        )}
                                        {isPL1Flagged && (
                                          <button
                                            type="button"
                                            onClick={() => handleClearMatch(row.rowId, 'PL1')}
                                            className="text-[10px] px-2 py-0.5 rounded bg-red-100 hover:bg-red-200 text-red-700 font-semibold cursor-pointer border border-red-200"
                                            title="Tháo liên kết Phụ lục 1 bị lệch bản chất can thiệp"
                                          >
                                            Hủy PL1
                                          </button>
                                        )}
                                        <button
                                          type="button"
                                          onClick={() => handleDismissWarning(row.rowId)}
                                          className="text-[10px] px-2 py-0.5 rounded bg-slate-200 hover:bg-slate-300 text-slate-700 font-medium cursor-pointer"
                                          title="Xác nhận đã xem xét và chấp thuận mapping này"
                                        >
                                          Đã duyệt
                                        </button>
                                      </div>
                                    </div>
                                  ) : (
                                    <div className="flex items-center justify-between gap-2">
                                      <div className="flex items-center gap-1 text-[11px] text-emerald-700 font-medium">
                                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                                        <span>Phù hợp chuyên môn</span>
                                      </div>
                                      <button
                                        type="button"
                                        onClick={() => setAuditModalRow(row)}
                                        className="p-1 rounded text-slate-400 hover:text-slate-700 hover:bg-slate-100 cursor-pointer"
                                        title="Xem biên bản thẩm định đối chiếu"
                                      >
                                        <FileText className="w-3 h-3" />
                                      </button>
                                    </div>
                                  )}
                                </td>
                              );
                            }
                            if (col.id.startsWith('extra_')) {
                              const val = row.extraValues?.[col.id];
                              return (
                                <td key={col.id} className="p-2.5 border-r border-slate-200 text-slate-800 text-xs font-normal">
                                  {val !== undefined && val !== '' ? (
                                    <span>{val}</span>
                                  ) : (
                                    <span className="text-slate-300 italic">-</span>
                                  )}
                                </td>
                              );
                            }
                            return (
                              <td key={col.id} className="p-2.5 border-r border-slate-200 text-slate-500">
                                -
                              </td>
                            );
                          })}
                        </tr>
                      );
                    })
                  ) : (
                    <tr>
                      <td colSpan={activeSortedColumns.length || 11} className="p-8 text-center text-slate-400 text-xs">
                        Không tìm thấy dòng nào phù hợp với điều kiện tìm kiếm.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination Controls Bar */}
            <div className="p-3.5 bg-slate-50 border-t border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-slate-600">
              <div className="flex items-center gap-1">
                <span>Đang xem</span>
                <span className="font-semibold text-slate-900">
                  {filteredResults.length === 0 ? 0 : startIndex + 1} - {Math.min(startIndex + pageSize, filteredResults.length)}
                </span>
                <span>trong tổng số</span>
                <span className="font-semibold text-slate-900">{filteredResults.length.toLocaleString()}</span>
                <span>dòng</span>
              </div>

              {totalPages > 1 && (
                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => setCurrentPage(1)}
                    disabled={validCurrentPage <= 1}
                    className="p-1 rounded bg-white border border-slate-200 hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                    title="Trang đầu"
                  >
                    <ChevronsLeft className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                    disabled={validCurrentPage <= 1}
                    className="p-1 rounded bg-white border border-slate-200 hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                    title="Trang trước"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>

                  <span className="px-2 font-medium">
                    Trang {validCurrentPage} / {totalPages}
                  </span>

                  <button
                    onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                    disabled={validCurrentPage >= totalPages}
                    className="p-1 rounded bg-white border border-slate-200 hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                    title="Trang sau"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => setCurrentPage(totalPages)}
                    disabled={validCurrentPage >= totalPages}
                    className="p-1 rounded bg-white border border-slate-200 hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                    title="Trang cuối"
                  >
                    <ChevronsRight className="w-4 h-4" />
                  </button>
                </div>
              )}
            </div>
          </section>
        )}
          </>
        )}
      </main>

      {/* GitHub & Vercel Deploy Guide Modal */}
      <DeployGuideModal
        isOpen={isDeployModalOpen}
        onClose={() => setIsDeployModalOpen(false)}
      />

      {/* Modal Biên Bản Thẩm Định Chuyên Môn Y Tế & Rủi Ro BHYT Minh Bạch */}
      <ClinicalAuditModal
        isOpen={Boolean(auditModalRow)}
        onClose={() => setAuditModalRow(null)}
        row={auditModalRow}
        onClearMatch={handleClearMatch}
        onDismissWarning={handleDismissWarning}
      />

      {/* Footer */}
      <footer className="border-t border-slate-200 bg-white py-6 mt-12 text-center text-xs text-slate-500">
        <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <span>
            Hệ Thống Đối Chiếu Danh Mục Kỹ Thuật Y Tế Tự Động • Thông tư 23/2024/TT-BYT
          </span>
          <div className="flex items-center justify-center gap-4">
            <button
              onClick={() => setIsDeployModalOpen(true)}
              className="text-sky-700 hover:underline font-medium inline-flex items-center gap-1 cursor-pointer"
            >
              <BookOpen className="w-3.5 h-3.5" />
              Hướng dẫn sử dụng & Mã nguồn
            </button>
            <span>•</span>
            <span className="text-emerald-700 font-medium">100% Client-Side Private & Fast</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
