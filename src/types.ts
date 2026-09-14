import { MedicalComponent } from './utils/anatomyMatcher';

export interface SourceItem {
  id: number;
  code: string;
  name: string;
  stt2?: number | string;
  chapter?: string;
  component?: MedicalComponent;
  rawRow?: any[];
}

export interface TargetItem {
  code: string;
  name: string;
  cleanName: string;
  component?: MedicalComponent;
  rawRow?: any[];
}

export interface ClinicalAuditDetail {
  conflictType: string;
  sourceFeature: string;
  targetFeature: string;
  clinicalImpact: string;
  insuranceRisk?: string;
}

export interface AiAuditInfo {
  hasWarning: boolean;
  warningType?:
    | 'MISMATCH_INTERVENTION'
    | 'MISMATCH_ANATOMY'
    | 'MISMATCH_SEVERITY'
    | 'MISMATCH_METHOD'
    | 'MISMATCH_SPECIMEN'
    | 'LOW_CONFIDENCE'
    | 'NONE';
  reason?: string;
  severity?: 'HIGH' | 'MEDIUM' | 'LOW' | 'SAFE';
  recommendation?: string;
  flagTarget?: 'PL1' | 'PL2' | 'BOTH' | 'NONE';
  auditedBy?: 'gemini' | 'clinical_rule' | 'user_reviewed';
  details?: ClinicalAuditDetail[];
  legalBasis?: string;
}

export interface MappingResult {
  rowId: number;
  stt1: number | string;
  stt2: number | string;
  maGoc: string;
  maPL1: string;
  maPL2: string;
  tenGoc: string;
  tenPL1: string;
  tenPL2: string;
  scorePL1: number;
  scorePL2: number;
  qtktBenhVien: string;
  soDonViThucHien: string;
  boPhanGoc?: string;
  chuyenKhoaGoc?: string;
  boPhanPL1?: string;
  boPhanPL2?: string;
  aiAudit?: AiAuditInfo;
  extraValues?: Record<string, any>;
  isLocked?: boolean;          // Khóa dòng thủ công, ngăn thuật toán ghi đè khi chạy lại
  isManualOverride?: boolean;  // Đã được người dùng chỉnh sửa tay
  manualNote?: string;         // Ghi chú thẩm định của cán bộ y tế
  lockedAt?: string;           // Thời điểm chốt dòng (ISO string)
}

export interface SavedSession {
  id: string;
  savedAt: string; // ISO string
  title: string;
  sourceItemCount: number;
  pl1ItemCount: number;
  pl2ItemCount: number;
  resultCount: number;
  lockedCount: number;
  stats?: ProcessingStats | null;
  results: MappingResult[];
  sourceItems: SourceItem[];
  pl1Items: TargetItem[];
  pl2Items: TargetItem[];
  threshold: number;
  enableAnatomyFilter: boolean;
  extraColumns?: ExtraColumnDefinition[];
}

export interface SavedSessionSummary {
  id: string;
  savedAt: string;
  title: string;
  sourceItemCount: number;
  resultCount: number;
  lockedCount: number;
}

export interface ExtraColumnDefinition {
  id: string;
  sourceGroup: 'SOURCE' | 'PL1' | 'PL2';
  columnIndex: number;
  columnHeader: string;
  customTitle: string;
}

export interface ProcessingStats {
  total: number;
  matchedPL1: number;
  matchedPL2: number;
  matchedBoth: number;
  unmatched: number;
  durationSeconds?: number;
  speedRowsPerSec?: number;
}

export interface MatchProgressInfo {
  processed: number;
  total: number;
  percent: number;
  speedRowsPerSec: number;
  estimatedRemainingSec: number;
  stage: string;
}

export interface IndexedTargetList {
  items: TargetItem[];
  exactMap: Map<string, TargetItem>;
  invertedTokenIndex: Map<string, number[]>;
  itemTokens: string[][];
  itemLens: number[];
  itemComponents: MedicalComponent[];
}

export interface FileInspection {
  fileName: string;
  fileSize: number;
  totalRows: number;
  headerRowIndex: number;
  detectedSTTColumn: string;
  headers: string[];
  sampleRows: any[][];
  selectedNameColumnIndex: number;
  selectedCodeColumnIndex: number;
  selectedTTColumnIndex?: number;
}

export type ColumnSourceGroup = 'SOURCE' | 'PL1' | 'PL2' | 'SYSTEM';

export interface OutputColumnConfig {
  id: string;
  sourceGroup: ColumnSourceGroup;
  sourceFileLabel: string;
  defaultTitle: string;
  customTitle: string;
  order: number;
  selected: boolean;
  description: string;
}

export interface FileMappingConfig {
  headerRowIdx: number;
  nameColIdx: number;
  codeColIdx: number;
  ttColIdx?: number;
}

