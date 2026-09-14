import {
  SourceItem,
  TargetItem,
  MappingResult,
  ProcessingStats,
  ExtraColumnDefinition,
} from '../types';
import {
  createTargetIndex,
  getBestMatchWithIndex,
} from '../utils/fuzzyMatcher';
import {
  decomposeMedicalProcedure,
  ANATOMY_ONTOLOGY,
} from '../utils/anatomyMatcher';
import { auditMappingRowWithRules } from '../utils/clinicalRules';

/**
 * Kiểm tra xem giá trị STT 2 có phải là số hợp lệ
 */
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

export interface WorkerStartPayload {
  sourceItems: SourceItem[];
  pl1Items: TargetItem[];
  pl2Items: TargetItem[];
  threshold: number;
  enableAnatomyFilter: boolean;
  extraColumnsGoc: ExtraColumnDefinition[];
  extraColumnsPL1: ExtraColumnDefinition[];
  extraColumnsPL2: ExtraColumnDefinition[];
  lockedRows: MappingResult[];
}

export interface WorkerProgressPayload {
  stage: 'INDEXING_PL1' | 'INDEXING_PL2' | 'MATCHING' | 'FINALIZING';
  processed: number;
  total: number;
  percent: number;
  speedRowsPerSec: number;
  estimatedRemainingSec: number;
  statusMessage: string;
  counters?: {
    matchedPL1: number;
    matchedPL2: number;
    matchedBoth: number;
    unmatched: number;
  };
}

let isCancelled = false;

self.onmessage = async (e: MessageEvent) => {
  const data = e.data;

  if (data?.type === 'CANCEL') {
    isCancelled = true;
    return;
  }

  if (data?.type === 'START_MATCHING') {
    isCancelled = false;
    const payload: WorkerStartPayload = data.payload;

    try {
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
      } = payload;

      const total = sourceItems.length;

      // 1. Giai đoạn tạo chỉ mục Phụ lục 1
      self.postMessage({
        type: 'PROGRESS',
        payload: {
          stage: 'INDEXING_PL1',
          processed: 0,
          total,
          percent: 32,
          speedRowsPerSec: 0,
          estimatedRemainingSec: 0,
          statusMessage: `[Web Worker] Đang tạo chỉ mục ngược (Inverted Index) cho ${pl1Items.length.toLocaleString()} danh mục Phụ lục 1...`,
        },
      });

      if (isCancelled) return;
      const indexPL1 = createTargetIndex(pl1Items);

      // 2. Giai đoạn tạo chỉ mục Phụ lục 2
      self.postMessage({
        type: 'PROGRESS',
        payload: {
          stage: 'INDEXING_PL2',
          processed: 0,
          total,
          percent: 42,
          speedRowsPerSec: 0,
          estimatedRemainingSec: 0,
          statusMessage: `[Web Worker] Đang tạo chỉ mục ngược (Inverted Index) cho ${pl2Items.length.toLocaleString()} danh mục Phụ lục 2...`,
        },
      });

      if (isCancelled) return;
      const indexPL2 = createTargetIndex(pl2Items);

      // 3. Xây dựng bản đồ các dòng đã khóa/chốt tay để bảo toàn
      const lockedRowsMap = new Map<string, MappingResult>();
      for (const r of lockedRows) {
        if (r.isLocked) {
          const key = r.maGoc ? `code:${r.maGoc}` : `name:${r.tenGoc}`;
          lockedRowsMap.set(key, r);
        }
      }

      const cutoff = threshold / 100.0;
      const mappedResults: MappingResult[] = new Array(total);

      let matchedPL1 = 0;
      let matchedPL2 = 0;
      let matchedBoth = 0;
      let unmatched = 0;
      let stt1Counter = 0;

      const startTime = performance.now();
      let lastProgressReportTime = startTime;
      const REPORT_INTERVAL_MS = 80; // Giới hạn tần suất báo cáo tiến trình (thực hiện mỗi ~80ms để không nghẽn luồng truyền tin)

      // 4. Vòng lặp đối chiếu mờ chính chạy trong nền Web Worker
      for (let j = 0; j < total; j++) {
        if (isCancelled) {
          self.postMessage({
            type: 'CANCELLED',
            payload: { message: 'Đã dừng tiến trình Web Worker theo yêu cầu của người dùng.' },
          });
          return;
        }

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

        // Trích xuất các cột bổ sung từ File Gốc
        const extraValues: Record<string, any> = {};
        for (const ec of extraColumnsGoc) {
          const rawVal = item.rawRow?.[ec.columnIndex];
          extraValues[ec.id] = rawVal !== undefined && rawVal !== null ? String(rawVal).trim() : '';
        }

        // Kiểm tra xem dòng này có được chốt khóa thủ công không
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

          // Trích xuất cột bổ sung từ PL1
          for (const ec of extraColumnsPL1) {
            if (matchPL1.matchedItem?.rawRow) {
              const rawVal = matchPL1.matchedItem.rawRow[ec.columnIndex];
              extraValues[ec.id] = rawVal !== undefined && rawVal !== null ? String(rawVal).trim() : '';
            } else {
              extraValues[ec.id] = '';
            }
          }

          // Trích xuất cột bổ sung từ PL2
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

        mappedResults[j] = mappedRow;

        if (mappedRow.maPL1 || mappedRow.tenPL1) matchedPL1++;
        if (mappedRow.maPL2 || mappedRow.tenPL2) matchedPL2++;
        if ((mappedRow.maPL1 || mappedRow.tenPL1) && (mappedRow.maPL2 || mappedRow.tenPL2)) matchedBoth++;
        if (!mappedRow.maPL1 && !mappedRow.tenPL1 && !mappedRow.maPL2 && !mappedRow.tenPL2) unmatched++;

        const now = performance.now();
        const shouldReport =
          now - lastProgressReportTime >= REPORT_INTERVAL_MS || j === total - 1;

        if (shouldReport) {
          lastProgressReportTime = now;
          const processedCount = j + 1;
          const elapsedSec = (now - startTime) / 1000;
          const currentSpeed = Math.round(processedCount / Math.max(0.05, elapsedSec));
          const estRemaining = Math.max(0, Math.round((total - processedCount) / Math.max(1, currentSpeed)));
          const pct = 45 + Math.floor((processedCount / total) * 53);

          self.postMessage({
            type: 'PROGRESS',
            payload: {
              stage: 'MATCHING',
              processed: processedCount,
              total,
              percent: pct,
              speedRowsPerSec: currentSpeed,
              estimatedRemainingSec: estRemaining,
              statusMessage: `[Web Worker Đa Luồng] Đang đối chiếu: ${processedCount.toLocaleString()} / ${total.toLocaleString()} danh mục • Tốc độ: ~${currentSpeed.toLocaleString()} dòng/giây`,
              counters: {
                matchedPL1,
                matchedPL2,
                matchedBoth,
                unmatched,
              },
            },
          });
        }
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

      self.postMessage({
        type: 'SUCCESS',
        payload: {
          results: mappedResults,
          stats,
          lockedPreservedCount: lockedRowsMap.size,
        },
      });
    } catch (err: any) {
      self.postMessage({
        type: 'ERROR',
        payload: {
          message: err?.message || 'Đã xảy ra lỗi trong Web Worker khi xử lý dữ liệu mờ.',
        },
      });
    }
  }
};
