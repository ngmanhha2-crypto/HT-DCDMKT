import {
  SourceItem,
  TargetItem,
  MappingResult,
  ProcessingStats,
  ExtraColumnDefinition,
} from '../types';
import {
  WorkerStartPayload,
  WorkerProgressPayload,
} from '../workers/matching.worker';
import {
  createTargetIndex,
  getBestMatchWithIndex,
} from './fuzzyMatcher';
import {
  decomposeMedicalProcedure,
  ANATOMY_ONTOLOGY,
} from './anatomyMatcher';
import { auditMappingRowWithRules } from './clinicalRules';

export interface MatchingJobOptions {
  sourceItems: SourceItem[];
  pl1Items: TargetItem[];
  pl2Items: TargetItem[];
  threshold: number;
  enableAnatomyFilter: boolean;
  extraColumnsGoc: ExtraColumnDefinition[];
  extraColumnsPL1: ExtraColumnDefinition[];
  extraColumnsPL2: ExtraColumnDefinition[];
  lockedRows: MappingResult[];
  onProgress?: (progress: WorkerProgressPayload) => void;
}

export interface MatchingJobResult {
  results: MappingResult[];
  stats: ProcessingStats;
  isWorker: boolean;
}

export interface MatchingJobController {
  promise: Promise<MatchingJobResult>;
  cancel: () => void;
}

/**
 * Kiểm tra xem môi trường hiện tại có hỗ trợ Web Worker hay không
 */
export function isWebWorkerSupported(): boolean {
  return typeof window !== 'undefined' && typeof window.Worker !== 'undefined';
}

function isNumericSTT(val: any): boolean {
  if (val === null || val === undefined) return false;
  if (typeof val === 'number') {
    return !isNaN(val) && isFinite(val) && val > 0;
  }
  const str = String(val).trim();
  if (!str) return false;
  if (!/^\d+(\.\d+)?$/.test(str)) {
    return false;
  }
  const num = Number(str);
  return !isNaN(num) && isFinite(num) && num > 0;
}

/**
 * Khởi chạy thuật toán đối chiếu mờ trong Web Worker nền
 * Giải phóng hoàn toàn luồng chính (Main Thread), giữ giao diện mượt mà 60 FPS
 * kể cả với danh mục trên 10.000 - 50.000 dòng.
 */
export function startMatchingWorkerJob(options: MatchingJobOptions): MatchingJobController {
  let worker: Worker | null = null;
  let isCancelled = false;
  let rejectFn: ((reason?: any) => void) | null = null;

  const cancel = () => {
    isCancelled = true;
    if (worker) {
      try {
        worker.postMessage({ type: 'CANCEL' });
        worker.terminate();
      } catch (e) {
        console.warn('Lỗi khi chấm dứt worker:', e);
      }
      worker = null;
    }
    if (rejectFn) {
      rejectFn(new Error('Đã hủy tiến trình đối chiếu theo yêu cầu của người dùng.'));
    }
  };

  const promise = new Promise<MatchingJobResult>((resolve, reject) => {
    rejectFn = reject;

    // Kiểm tra khả năng tạo Web Worker
    if (!isWebWorkerSupported()) {
      console.warn('Web Worker không được hỗ trợ, chuyển sang chế độ dự phòng Main Thread');
      runMatchingInMainThread(options, () => isCancelled)
        .then((res) => resolve({ ...res, isWorker: false }))
        .catch(reject);
      return;
    }

    try {
      // Khởi tạo Web Worker module theo chuẩn Vite/ESM
      worker = new Worker(new URL('../workers/matching.worker.ts', import.meta.url), {
        type: 'module',
      });

      worker.onmessage = (e: MessageEvent) => {
        const data = e.data;
        if (!data) return;

        if (data.type === 'PROGRESS' && options.onProgress) {
          options.onProgress(data.payload as WorkerProgressPayload);
        } else if (data.type === 'SUCCESS') {
          const payload = data.payload;
          if (worker) {
            worker.terminate();
            worker = null;
          }
          resolve({
            results: payload.results,
            stats: payload.stats,
            isWorker: true,
          });
        } else if (data.type === 'CANCELLED') {
          if (worker) {
            worker.terminate();
            worker = null;
          }
          reject(new Error(data.payload?.message || 'Đã hủy tiến trình.'));
        } else if (data.type === 'ERROR') {
          if (worker) {
            worker.terminate();
            worker = null;
          }
          reject(new Error(data.payload?.message || 'Lỗi khi thực thi trong Web Worker.'));
        }
      };

      worker.onerror = (err) => {
        console.error('Web Worker gặp sự cố, tự động kích hoạt fallback sang Main Thread:', err);
        if (worker) {
          try {
            worker.terminate();
          } catch (_) {}
          worker = null;
        }

        // Tự động khôi phục chuyển sang Main Thread fallback
        if (!isCancelled) {
          runMatchingInMainThread(options, () => isCancelled)
            .then((res) => resolve({ ...res, isWorker: false }))
            .catch(reject);
        }
      };

      const startPayload: WorkerStartPayload = {
        sourceItems: options.sourceItems,
        pl1Items: options.pl1Items,
        pl2Items: options.pl2Items,
        threshold: options.threshold,
        enableAnatomyFilter: options.enableAnatomyFilter,
        extraColumnsGoc: options.extraColumnsGoc,
        extraColumnsPL1: options.extraColumnsPL1,
        extraColumnsPL2: options.extraColumnsPL2,
        lockedRows: options.lockedRows,
      };

      worker.postMessage({
        type: 'START_MATCHING',
        payload: startPayload,
      });
    } catch (createErr) {
      console.warn('Không thể khởi tạo Web Worker, chuyển sang Main Thread:', createErr);
      runMatchingInMainThread(options, () => isCancelled)
        .then((res) => resolve({ ...res, isWorker: false }))
        .catch(reject);
    }
  });

  return { promise, cancel };
}

/**
 * Thuật toán đối chiếu dự phòng trên luồng chính (Main Thread fallback)
 * Sử dụng phân lô (chunking) và nhường quyền (yield) để duy trì khả năng hồi đáp.
 */
export async function runMatchingInMainThread(
  options: MatchingJobOptions,
  checkCancelled: () => boolean
): Promise<{ results: MappingResult[]; stats: ProcessingStats }> {
  const {
    sourceItems,
    pl1Items,
    pl2Items,
    threshold,
    enableAnatomyFilter,
    extraColumnsGoc = [],
    extraColumnsPL1 = [],
    extraColumnsPL2 = [],
    lockedRows = [],
    onProgress,
  } = options;

  const total = sourceItems.length;

  // 1. Tạo chỉ mục Phụ lục 1
  if (onProgress) {
    onProgress({
      stage: 'INDEXING_PL1',
      processed: 0,
      total,
      percent: 32,
      speedRowsPerSec: 0,
      estimatedRemainingSec: 0,
      statusMessage: `[Main Thread Fallback] Đang tạo chỉ mục cho ${pl1Items.length.toLocaleString()} mục Phụ lục 1...`,
    });
  }
  await new Promise((r) => setTimeout(r, 10));
  if (checkCancelled()) throw new Error('Đã hủy tiến trình đối chiếu.');
  const indexPL1 = createTargetIndex(pl1Items);

  // 2. Tạo chỉ mục Phụ lục 2
  if (onProgress) {
    onProgress({
      stage: 'INDEXING_PL2',
      processed: 0,
      total,
      percent: 42,
      speedRowsPerSec: 0,
      estimatedRemainingSec: 0,
      statusMessage: `[Main Thread Fallback] Đang tạo chỉ mục cho ${pl2Items.length.toLocaleString()} mục Phụ lục 2...`,
    });
  }
  await new Promise((r) => setTimeout(r, 10));
  if (checkCancelled()) throw new Error('Đã hủy tiến trình đối chiếu.');
  const indexPL2 = createTargetIndex(pl2Items);

  const lockedRowsMap = new Map<string, MappingResult>();
  for (const r of lockedRows) {
    if (r.isLocked) {
      const key = r.maGoc ? `code:${r.maGoc}` : `name:${r.tenGoc}`;
      lockedRowsMap.set(key, r);
    }
  }

  const cutoff = threshold / 100.0;
  const mappedResults: MappingResult[] = [];

  let matchedPL1 = 0;
  let matchedPL2 = 0;
  let matchedBoth = 0;
  let unmatched = 0;
  let stt1Counter = 0;

  const startTime = performance.now();
  const BATCH_SIZE = 50;

  for (let i = 0; i < total; i += BATCH_SIZE) {
    if (checkCancelled()) throw new Error('Đã hủy tiến trình đối chiếu theo yêu cầu.');

    const chunkEnd = Math.min(i + BATCH_SIZE, total);

    for (let j = i; j < chunkEnd; j++) {
      const item = sourceItems[j];
      const sourceComp = item.component || decomposeMedicalProcedure(item.name);
      const stt2FromSource = item.stt2 !== undefined ? item.stt2 : '';

      let stt1Val: number | string = '';
      if (isNumericSTT(stt2FromSource)) {
        stt1Counter++;
        stt1Val = stt1Counter;
      } else {
        stt1Val = '';
      }

      const extraValues: Record<string, any> = {};
      for (const ec of extraColumnsGoc) {
        const rawVal = item.rawRow?.[ec.columnIndex];
        extraValues[ec.id] = rawVal !== undefined && rawVal !== null ? String(rawVal).trim() : '';
      }

      const lookupKey = item.code ? `code:${item.code}` : `name:${item.name}`;
      const existingLocked = lockedRowsMap.get(lookupKey);

      let mappedRow: MappingResult;

      if (existingLocked) {
        mappedRow = {
          ...existingLocked,
          rowId: j + 1,
          stt1: stt1Val,
          stt2: stt2FromSource,
          extraValues,
        };
        if (!mappedRow.aiAudit) {
          mappedRow.aiAudit = auditMappingRowWithRules(mappedRow);
        }
      } else {
        const matchPL1 = getBestMatchWithIndex(item.name, indexPL1, cutoff, enableAnatomyFilter);
        const matchPL2 = getBestMatchWithIndex(item.name, indexPL2, cutoff, enableAnatomyFilter);

        for (const ec of extraColumnsPL1) {
          if (matchPL1.matchedItem?.rawRow) {
            const rawVal = matchPL1.matchedItem.rawRow[ec.columnIndex];
            extraValues[ec.id] = rawVal !== undefined && rawVal !== null ? String(rawVal).trim() : '';
          } else {
            extraValues[ec.id] = '';
          }
        }

        for (const ec of extraColumnsPL2) {
          if (matchPL2.matchedItem?.rawRow) {
            const rawVal = matchPL2.matchedItem.rawRow[ec.columnIndex];
            extraValues[ec.id] = rawVal !== undefined && rawVal !== null ? String(rawVal).trim() : '';
          } else {
            extraValues[ec.id] = '';
          }
        }

        mappedRow = {
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
          chuyenKhoaGoc:
            item.chapter ||
            (sourceComp.primaryCategory ? ANATOMY_ONTOLOGY[sourceComp.primaryCategory]?.name : undefined) ||
            'Chưa phân loại',
          boPhanPL1: matchPL1.anatomy,
          boPhanPL2: matchPL2.anatomy,
          extraValues,
        };
        mappedRow.aiAudit = auditMappingRowWithRules(mappedRow);
      }

      mappedResults.push(mappedRow);

      if (mappedRow.maPL1 || mappedRow.tenPL1) matchedPL1++;
      if (mappedRow.maPL2 || mappedRow.tenPL2) matchedPL2++;
      if ((mappedRow.maPL1 || mappedRow.tenPL1) && (mappedRow.maPL2 || mappedRow.tenPL2)) matchedBoth++;
      if (!mappedRow.maPL1 && !mappedRow.tenPL1 && !mappedRow.maPL2 && !mappedRow.tenPL2) unmatched++;
    }

    const now = performance.now();
    const elapsedSec = (now - startTime) / 1000;
    const currentSpeed = Math.round(chunkEnd / Math.max(0.05, elapsedSec));
    const estRemaining = Math.max(0, Math.round((total - chunkEnd) / Math.max(1, currentSpeed)));
    const pct = 45 + Math.floor((chunkEnd / total) * 53);

    if (onProgress) {
      onProgress({
        stage: 'MATCHING',
        processed: chunkEnd,
        total,
        percent: pct,
        speedRowsPerSec: currentSpeed,
        estimatedRemainingSec: estRemaining,
        statusMessage: `[Main Thread Fallback] Đang đối chiếu: ${chunkEnd.toLocaleString()} / ${total.toLocaleString()} danh mục • Tốc độ: ~${currentSpeed.toLocaleString()} dòng/giây`,
        counters: {
          matchedPL1,
          matchedPL2,
          matchedBoth,
          unmatched,
        },
      });
    }

    await new Promise((resolve) => setTimeout(resolve, 0));
  }

  const totalTimeSec = Math.round(((performance.now() - startTime) / 1000) * 10) / 10;
  const stats: ProcessingStats = {
    total,
    matchedPL1,
    matchedPL2,
    matchedBoth,
    unmatched,
    durationSeconds: totalTimeSec,
    speedRowsPerSec: Math.round(total / Math.max(0.1, totalTimeSec)),
  };

  return { results: mappedResults, stats };
}
