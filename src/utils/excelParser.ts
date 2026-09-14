import * as XLSX from 'xlsx';
import ExcelJS from 'exceljs';
import { SourceItem, TargetItem, MappingResult, FileInspection, OutputColumnConfig, FileMappingConfig } from '../types';
import { cleanText } from './fuzzyMatcher';
import { RAW_SAMPLE_SOURCE, RAW_SAMPLE_PL1, RAW_SAMPLE_PL2 } from '../data/sampleMedicalData';

/**
 * Chuẩn hóa chuỗi để so sánh từ khóa (bỏ dấu tiếng Việt, chữ thường, bỏ ký tự đặc biệt)
 */
export function normalizeKeyword(str: any): string {
  if (!str) return '';
  return String(str)
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/[^a-z0-9]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Kiểm tra xem một chuỗi có phải là tiêu đề cột STT hay không
 */
export function isSTTKeyword(val: any): boolean {
  if (!val) return false;
  const norm = normalizeKeyword(val);
  // Loại trừ các mã văn bản có chữ tt như 'ma tt 43', 'ma tt 21', 'tt 23'
  if (norm.includes('43') || norm.includes('21') || norm.includes('23') || norm.includes('32')) {
    return false;
  }
  return (
    norm === 'stt' ||
    norm === 'tt' ||
    norm === 'so tt' ||
    norm === 'so thu tu' ||
    norm === 'thu tu' ||
    norm.startsWith('stt ') ||
    norm.startsWith('tt ') ||
    norm.startsWith('so tt ') ||
    norm.endsWith(' stt') ||
    norm.endsWith(' tt') ||
    norm.includes('stt cot') ||
    norm.includes('tt cot') ||
    norm.includes('so tt cot')
  );
}

/**
 * Tự động tìm dòng tiêu đề bảng dựa theo cột STT (quét tới 30 dòng đầu của file Excel)
 */
export function findHeaderRowBySTT(rawRows: any[][]): { rowIndex: number; sttColIndex: number; sttColName: string } {
  const maxScan = Math.min(30, rawRows.length);
  for (let r = 0; r < maxScan; r++) {
    const row = rawRows[r] || [];
    for (let c = 0; c < row.length; c++) {
      const cell = row[c];
      if (isSTTKeyword(cell)) {
        // Kiểm tra xem dòng này có ít nhất một ô khác không rỗng không (tránh cell đơn lẻ)
        const nonEmptyCount = row.filter((val: any) => String(val || '').trim().length > 0).length;
        if (nonEmptyCount >= 2) {
          return {
            rowIndex: r,
            sttColIndex: c,
            sttColName: String(cell).replace(/\r?\n|\r/g, ' ').trim(),
          };
        }
      }
    }
  }

  // Nếu không thấy cột nào rõ STT, tìm dòng có từ khóa kỹ thuật hoặc nhiều ô nhất
  for (let r = 0; r < maxScan; r++) {
    const row = rawRows[r] || [];
    for (let c = 0; c < row.length; c++) {
      const cell = row[c];
      const norm = normalizeKeyword(cell);
      if (norm.includes('danh muc') || norm.includes('ky thuat') || norm.includes('ten')) {
        return {
          rowIndex: r,
          sttColIndex: 0,
          sttColName: String(row[0] || 'STT').replace(/\r?\n|\r/g, ' ').trim() || 'Cột 1',
        };
      }
    }
  }

  return { rowIndex: 0, sttColIndex: 0, sttColName: 'Cột 1' };
}

/**
 * Tự động tìm chỉ số dòng tiêu đề (header row) thông minh:
 * Quét qua 15 dòng đầu tiên để tìm dòng thực sự chứa từ khóa "tên kỹ thuật" hoặc "danh mục kỹ thuật"
 */
function findHeaderRowIndex(
  rawRows: any[][],
  primaryKeywords: string[],
  fallbackDefaultIndex: number
): number {
  const normKeywords = primaryKeywords.map(normalizeKeyword);

  // 1. Quét 15 dòng đầu tiên xem dòng nào chứa từ khóa chỉ định
  const maxScan = Math.min(15, rawRows.length);
  for (let r = 0; r < maxScan; r++) {
    const row = rawRows[r] || [];
    for (const cell of row) {
      if (!cell) continue;
      const normCell = normalizeKeyword(cell);
      if (normKeywords.some((kw) => normCell.includes(kw))) {
        return r;
      }
    }
  }

  // 2. Nếu không thấy từ khóa chỉ định, tìm dòng có nhiều ô chữ nhất trong khoảng 0..5
  let bestRow = fallbackDefaultIndex;
  let maxNonEmpty = 0;
  for (let r = 0; r < Math.min(6, rawRows.length); r++) {
    const count = (rawRows[r] || []).filter((c: any) => String(c || '').trim().length > 0).length;
    if (count > maxNonEmpty) {
      maxNonEmpty = count;
      bestRow = r;
    }
  }

  return Math.min(bestRow, Math.max(0, rawRows.length - 1));
}

/**
 * Tìm chỉ số cột theo từ khóa linh hoạt (tìm theo cụm từ "tên kỹ thuật", không phân biệt hoa/thường/dấu)
 */
function findColumnIndexByKeywords(
  headers: string[],
  primaryKeywords: string[],
  fallbackIndex?: number
): number {
  const normKeywords = primaryKeywords.map(normalizeKeyword);
  const normHeaders = headers.map(normalizeKeyword);

  // 1. Tìm cột chứa toàn bộ cụm từ khóa (ví dụ "ten ky thuat")
  for (const kw of normKeywords) {
    const idx = normHeaders.findIndex((h) => h.includes(kw));
    if (idx !== -1) return idx;
  }

  // 2. Tìm cột chứa tất cả các từ trong cụm từ khóa
  for (const kw of normKeywords) {
    const words = kw.split(' ').filter((w) => w.length >= 2);
    if (words.length >= 2) {
      const idx = normHeaders.findIndex((h) => words.every((w) => h.includes(w)));
      if (idx !== -1) return idx;
    }
  }

  // 3. Sử dụng fallback index nếu hợp lệ
  if (fallbackIndex !== undefined && fallbackIndex >= 0 && fallbackIndex < headers.length) {
    return fallbackIndex;
  }

  return -1;
}

/**
 * Nhận diện dòng tiêu đề Chương / Chuyên khoa / Phân mục trong file Danh mục Kỹ thuật Y tế.
 * Hỗ trợ các mẫu thực tế theo Thông tư BYT (TT 43/2013, TT 21/2017, TT 32/2023, TT 23/2024) và bệnh viện Việt Nam:
 * 1. Số La Mã: "IX. Tai mũi họng", "VIII. Răng hàm mặt", "I. Hồi sức cấp cứu", "II - Ngoại khoa", "X: Mắt"
 * 2. Cột TT chứa số La Mã/Chữ cái: rawTTVal = "IX" | "A", nameVal = "Tai mũi họng"
 * 3. Tiền tố phân loại: "Chương IX...", "Phần II...", "Chuyên khoa Tai mũi họng", "Khoa...", "Khối...", "Nhóm..."
 * 4. Chữ cái phân chương: "A. Ngoại khoa", "B. Nội khoa"
 * 5. Tên chuyên khoa độc lập (khi không có mã kỹ thuật và STT không phải là số chỉ mục kỹ thuật)
 */
export function detectChapterHeader(
  nameVal: string,
  rawTTVal: string,
  codeVal: string,
  row?: any[],
  nameColIdx?: number,
  codeColIdx?: number,
  ttColIdx?: number,
  candidateSTTCols?: number[]
): string | null {
  if (!nameVal && !rawTTVal) return null;

  const trimmedName = String(nameVal || '').trim();
  const trimmedTT = String(rawTTVal || '').trim();
  const trimmedCode = String(codeVal || '').trim();

  // Nếu có mã kỹ thuật rõ ràng (dạng số hoặc mã thông tư có dấu chấm như 15.302, 1.52, 01.0021...), đây là dòng kỹ thuật, KHÔNG PHẢI tiêu đề chương
  if (trimmedCode && /[\d\.]/.test(trimmedCode)) {
    return null;
  }

  // 1. Dòng có số La Mã ở đầu tên: "IX. Tai mũi họng", "VIII. Răng hàm mặt", "I. Hồi sức cấp cứu", "IV - Ngoại khoa", "X: Mắt"
  const romanNameMatch = trimmedName.match(/^([IVXLCDM]+)[\.\:\-\/\)]\s*(.+)$/i);
  if (romanNameMatch) {
    const roman = romanNameMatch[1].toUpperCase();
    const title = romanNameMatch[2].trim();
    // Kiểm tra STT không phải là số thứ tự kỹ thuật lớn (ví dụ không phải số đếm 1048)
    if (!trimmedTT || isNaN(Number(trimmedTT)) || trimmedTT === roman) {
      return `${roman}. ${title}`;
    }
  }

  // 2. Cột STT chứa số La Mã hoặc chữ cái đại diện chương: rawTTVal = "IX" / "IX." / "A"
  const romanTTMatch = trimmedTT.match(/^([IVXLCDM]+|[A-Z])[\.\:]?$/i);
  if (romanTTMatch && trimmedName) {
    const prefix = romanTTMatch[1].toUpperCase();
    // Nếu tên kỹ thuật không có mã
    if (!trimmedCode) {
      if (trimmedName.toUpperCase().startsWith(`${prefix}.`)) {
        return trimmedName;
      }
      return `${prefix}. ${trimmedName}`;
    }
  }

  // 3. Tiền tố phân loại có từ khóa: "Chương ...", "Phần ...", "Chuyên khoa ...", "Khoa ...", "Khối ...", "Nhóm ...", "Mục ..."
  const namedSectionMatch = trimmedName.match(
    /^(chương|chuong|phần|phan|chuyên khoa|chuyen khoa|khoa|khối|khoi|nhóm|nhom|mục|muc|tiểu mục|tieu muc)\s*([IVXLCDM0-9]+|[a-z0-9\.\:\-]+)?\s*[\:\.\-\/]?\s*(.+)$/i
  );
  if (namedSectionMatch && !trimmedCode) {
    if (!trimmedTT || isNaN(Number(trimmedTT))) {
      return trimmedName;
    }
  }

  // 4. Ký hiệu chữ cái phân chương: "A. Ngoại khoa", "B. Khám bệnh"
  const alphaNameMatch = trimmedName.match(/^([A-Z])[\.\:\-]\s+([A-ZÀ-Ỹa-zà-ỹ].+)$/);
  if (alphaNameMatch && !trimmedCode) {
    if (!trimmedTT || isNaN(Number(trimmedTT))) {
      return trimmedName;
    }
  }

  // 5. Tên chuyên khoa độc lập in hoa hoặc Title Case khi các cột mã và STT đều trống
  // (ví dụ ô Excel chỉ ghi "IX. Tai mũi họng" hoặc "TAI MŨI HỌNG", các cột còn lại hoàn toàn để trống)
  if (!trimmedCode && (!trimmedTT || !isNumericSTT(trimmedTT))) {
    const cleanLower = trimmedName.toLowerCase().replace(/[\:\.\-]/g, ' ').replace(/\s+/g, ' ').trim();
    const commonSpecialties = [
      'tai mũi họng', 'tai mui hong',
      'răng hàm mặt', 'rang ham mat',
      'mắt', 'nhãn khoa', 'mat', 'nhan khoa',
      'ngoại khoa', 'ngoai khoa',
      'nội khoa', 'noi khoa',
      'hồi sức cấp cứu', 'hoi suc cap cuu', 'hồi sức tích cực',
      'gây mê hồi sức', 'gay me hoi suc',
      'chẩn đoán hình ảnh', 'chan doan hinh anh',
      'xét nghiệm', 'xet nghiem',
      'sản phụ khoa', 'san phu khoa', 'phụ sản',
      'nhi khoa', 'nhi',
      'y học cổ truyền', 'y hoc co truyen',
      'phục hồi chức năng', 'phuc hoi chuc nang',
      'ung bướu', 'ung buou',
      'da liễu', 'da lieu',
      'thần kinh', 'than kinh',
      'tâm thần', 'tam than',
      'huyết học', 'truyền máu',
      'thăm dò chức năng',
      'chuyên khoa khám bệnh', 'khám bệnh',
    ];

    const isMatchSpecialty = commonSpecialties.some(
      (spec) => cleanLower === spec || cleanLower.endsWith(spec) || cleanLower.startsWith(spec)
    );

    if (isMatchSpecialty) {
      return trimmedName;
    }
  }

  // 6. QUY TẮC CỐT LÕI: Loại danh mục nằm cùng cột với danh sách DVKT
  // nhưng cột STT tương ứng dòng đó thường TRỐNG hoặc KHÔNG PHẢI LÀ SỐ
  // (ví dụ thực tế trong file Excel bệnh viện: "SAU SINH", "TRƯỚC SINH", "HỒI SỨC TRẺ SƠ SINH", "CHĂM SÓC THIẾT YẾU",...)
  if (!trimmedCode) {
    const isSTTBlankOrNotNumeric = !trimmedTT || !isNumericSTT(trimmedTT);

    // Kiểm tra thêm nếu có danh sách các cột STT tiềm năng
    let hasBlankCandidateSTT = false;
    if (row && candidateSTTCols && candidateSTTCols.length > 0) {
      for (const colIdx of candidateSTTCols) {
        const cell = row[colIdx];
        if (cell === null || cell === undefined || String(cell).trim() === '' || !isNumericSTT(cell)) {
          hasBlankCandidateSTT = true;
          break;
        }
      }
    }

    if (isSTTBlankOrNotNumeric || hasBlankCandidateSTT) {
      // Kiểm tra xem dòng này có các cột dữ liệu kỹ thuật khác (checkmark 'x', giá, đơn vị...) hay không
      let isExecutionDataEmpty = true;
      if (row && typeof nameColIdx === 'number' && nameColIdx >= 0) {
        const afterNameCells = row.slice(nameColIdx + 1);
        const nonEmptyAfter = afterNameCells.filter((c: any) => {
          const s = String(c || '').trim();
          return s.length > 0;
        });
        if (nonEmptyAfter.length > 0) {
          isExecutionDataEmpty = false;
        }
      }

      // Độ dài tên hợp lý của một loại danh mục / phân nhóm (2 đến 120 ký tự)
      const validLength = trimmedName.length >= 2 && trimmedName.length <= 120;
      // Dấu hiệu nhận diện: chữ IN HOA (như "SAU SINH", "TRƯỚC SINH") hoặc không có dữ liệu thực hiện
      const isAllUpper = trimmedName === trimmedName.toUpperCase() && /[A-ZÀ-Ỹ]/.test(trimmedName);

      if (validLength && (isExecutionDataEmpty || isAllUpper || !trimmedTT)) {
        return trimmedName;
      }
    }
  }

  return null;
}

/**
 * Kiểm tra xem một dòng có phải là tiêu đề phân chương / chuyên khoa hay không
 * (Hàm tương thích ngược với code cũ)
 */
function isChapterHeaderRow(nameVal: string, rawTTVal: string, codeVal: string): boolean {
  return detectChapterHeader(nameVal, rawTTVal, codeVal) !== null;
}

/**
 * Kiểm tra xem giá trị STT 2 có phải là một số hợp lệ hay không.
 * STT 1 CHỈ TĂNG KHI STT 2 LÀ SỐ.
 * Nếu STT 2 là chữ (ví dụ: "TT", "I", "II", "A", ...), hoặc rỗng/khoảng trắng: return false.
 * Nếu STT 2 là số nguyên hoặc số thực (ví dụ: 1, 2, 93, 1251, "93", "1"): return true.
 */
export function isNumericSTT(val: any): boolean {
  if (val === null || val === undefined) return false;
  if (typeof val === 'number') {
    return !isNaN(val) && isFinite(val) && val > 0;
  }
  const str = String(val).trim();
  if (!str) return false;

  // Chuỗi phải là số nguyên hoặc số thập phân hợp lệ, không chứa ký tự chữ
  if (!/^\d+(\.\d+)?$/.test(str)) {
    return false;
  }
  const num = Number(str);
  return !isNaN(num) && isFinite(num) && num > 0;
}

/**
 * Xử lý giá trị STT 2 từ file gốc một cách chính xác nhất:
 * - Nếu ô có số nguyên -> trả về number (ví dụ 93, 1, 2).
 * - Nếu ô có số thập phân -> trả về number (ví dụ 1.1).
 * - Nếu ô có chữ (như "TT", "I", "II", "A") -> giữ nguyên chuỗi chữ đó.
 * - Nếu ô trống hoặc không xác định -> trả về rỗng '' (TUYỆT ĐỐI KHÔNG TỰ NHẢY SỐ hoặc gán index).
 */
export function parseSTT2(rawVal: any): number | string {
  if (rawVal === null || rawVal === undefined) return '';
  const str = String(rawVal).replace(/\r?\n|\r/g, ' ').trim();
  if (!str) return '';

  if (/^\d+(\.0+)?$/.test(str)) {
    const num = parseInt(str, 10);
    if (!isNaN(num)) return num;
  }

  if (/^\d+\.\d+$/.test(str)) {
    const num = parseFloat(str);
    if (!isNaN(num)) return num;
  }

  return str;
}

/**
 * Danh sách cột mặc định phân chia theo từng file tải lên và thông tin hệ thống
 */
export const DEFAULT_OUTPUT_COLUMNS: OutputColumnConfig[] = [
  {
    id: 'stt1',
    sourceGroup: 'SOURCE',
    sourceFileLabel: 'File Danh mục gốc',
    defaultTitle: 'Stt 1',
    customTitle: 'Stt 1',
    order: 1,
    selected: true,
    description: 'Số thứ tự cộng dồn toàn viện (chỉ tăng khi STT 2 là số)',
  },
  {
    id: 'stt2',
    sourceGroup: 'SOURCE',
    sourceFileLabel: 'File Danh mục gốc',
    defaultTitle: 'Stt 2',
    customTitle: 'Stt 2',
    order: 2,
    selected: true,
    description: 'Số thứ tự chính xác theo file danh mục gốc (không tự ý nhảy số)',
  },
  {
    id: 'maGoc',
    sourceGroup: 'SOURCE',
    sourceFileLabel: 'File Danh mục gốc',
    defaultTitle: 'Mã TT 43, 21',
    customTitle: 'Mã TT 43, 21',
    order: 3,
    selected: true,
    description: 'Mã danh mục kỹ thuật cũ theo TT 43/2013 hoặc TT 21/2017',
  },
  {
    id: 'maPL1',
    sourceGroup: 'PL1',
    sourceFileLabel: 'Phụ lục 1 (TT 23/2024)',
    defaultTitle: 'Mã TT 23 (PL1)',
    customTitle: 'Mã TT 23 (PL1)',
    order: 4,
    selected: true,
    description: 'Mã kỹ thuật ghép được trong Phụ lục 1 Thông tư 23/2024/TT-BYT',
  },
  {
    id: 'maPL2',
    sourceGroup: 'PL2',
    sourceFileLabel: 'Phụ lục 2 (TT 23/2024)',
    defaultTitle: 'Mã TT 23 (PL2)',
    customTitle: 'Mã TT 23 (PL2)',
    order: 5,
    selected: true,
    description: 'Mã liên kết tương đương trong Phụ lục 2 Thông tư 23/2024/TT-BYT',
  },
  {
    id: 'tenGoc',
    sourceGroup: 'SOURCE',
    sourceFileLabel: 'File Danh mục gốc',
    defaultTitle: 'Tên Danh mục kỹ thuật theo TT 32/2023/TT-BYT (Gốc)',
    customTitle: 'Tên Danh mục kỹ thuật theo TT 32/2023/TT-BYT (Gốc)',
    order: 6,
    selected: true,
    description: 'Tên danh mục kỹ thuật cơ sở khám chữa bệnh đang thực hiện',
  },
  {
    id: 'tenPL1',
    sourceGroup: 'PL1',
    sourceFileLabel: 'Phụ lục 1 (TT 23/2024)',
    defaultTitle: 'Tên DMKT theo Phụ lục 1 TT 23/2024/TT-BYT',
    customTitle: 'Tên DMKT theo Phụ lục 1 TT 23/2024/TT-BYT',
    order: 7,
    selected: true,
    description: 'Tên kỹ thuật tương đương ghép được tại Phụ lục 1',
  },
  {
    id: 'tenPL2',
    sourceGroup: 'PL2',
    sourceFileLabel: 'Phụ lục 2 (TT 23/2024)',
    defaultTitle: 'Tên DMKT theo Phụ lục 2 TT 23/2024/TT-BYT',
    customTitle: 'Tên DMKT theo Phụ lục 2 TT 23/2024/TT-BYT',
    order: 8,
    selected: true,
    description: 'Tên kỹ thuật tương đương ghép được tại Phụ lục 2',
  },
  {
    id: 'qtktBenhVien',
    sourceGroup: 'SYSTEM',
    sourceFileLabel: 'Quy trình & Bổ sung',
    defaultTitle: 'QTKT tương ứng tại BV',
    customTitle: 'QTKT tương ứng tại BV',
    order: 9,
    selected: true,
    description: 'Quy trình kỹ thuật tương ứng đang ban hành tại bệnh viện',
  },
  {
    id: 'soDonViThucHien',
    sourceGroup: 'SYSTEM',
    sourceFileLabel: 'Quy trình & Bổ sung',
    defaultTitle: 'Số ĐV thực hiện',
    customTitle: 'Số ĐV thực hiện',
    order: 10,
    selected: true,
    description: 'Số khoa phòng / đơn vị thực hiện kỹ thuật này',
  },
  {
    id: 'aiAudit',
    sourceGroup: 'SYSTEM',
    sourceFileLabel: 'Thẩm định AI & Lâm sàng',
    defaultTitle: 'Đánh Giá AI & Cảnh Báo',
    customTitle: 'Đánh Giá AI & Cảnh Báo',
    order: 11,
    selected: true,
    description: 'Thẩm định lâm sàng AI phát hiện xung đột giải phẫu, can thiệp',
  },
];

/**
 * Phân tích file Excel ngay khi tải lên:
 * Tự động tìm dòng tiêu đề dựa trên cột STT, trích xuất danh sách cột và gợi ý cột danh mục/mã
 */
export async function inspectExcelFile(
  file: File,
  fileType: 'SOURCE' | 'PL1' | 'PL2'
): Promise<FileInspection> {
  const data = await file.arrayBuffer();
  const workbook = XLSX.read(data, { type: 'array', dense: true });
  const firstSheetName = workbook.SheetNames[0];
  if (!firstSheetName) {
    throw new Error(`File "${file.name}" không chứa bất kỳ trang tính (sheet) nào.`);
  }
  const worksheet = workbook.Sheets[firstSheetName];
  const rawRows: any[][] = XLSX.utils.sheet_to_json(worksheet, {
    header: 1,
    defval: '',
  });

  if (rawRows.length < 1) {
    throw new Error(`File "${file.name}" trống hoặc không có dòng dữ liệu nào.`);
  }

  // Tự động tìm dòng tiêu đề bảng dựa theo cột STT
  const sttResult = findHeaderRowBySTT(rawRows);
  const headerRowIndex = sttResult.rowIndex;
  const headers = (rawRows[headerRowIndex] || []).map((h: any, idx: number) => {
    const s = String(h || '').replace(/\r?\n|\r/g, ' ').trim();
    return s || `Cột ${idx + 1}`;
  });

  // Tìm cột Tên danh mục & Mã kỹ thuật phù hợp theo từng loại file
  let selectedNameColumnIndex = -1;
  let selectedCodeColumnIndex = -1;
  const selectedTTColumnIndex = sttResult.sttColIndex;

  if (fileType === 'SOURCE') {
    selectedNameColumnIndex = findColumnIndexByKeywords(
      headers,
      ['ten ky thuat', 'danh muc ky thuat', 'ten danh muc', 'ten'],
      headers.length > 2 ? 2 : 0
    );
    selectedCodeColumnIndex = findColumnIndexByKeywords(
      headers,
      ['ma tt 43', 'ma tt 21', 'ma ky thuat', 'ma'],
      headers.length > 1 ? 1 : 0
    );
  } else if (fileType === 'PL1') {
    selectedNameColumnIndex = findColumnIndexByKeywords(
      headers,
      ['ten ky thuat', 'danh muc ky thuat', 'ten danh muc', 'ten'],
      headers.length > 3 ? 3 : 0
    );
    selectedCodeColumnIndex = findColumnIndexByKeywords(
      headers,
      ['ma ky thuat', 'ma tt 23', 'ma'],
      headers.length > 1 ? 1 : 0
    );
  } else {
    // PL2
    selectedNameColumnIndex = findColumnIndexByKeywords(
      headers,
      ['ten ky thuat', 'danh muc ky thuat', 'ten danh muc', 'ten'],
      headers.length > 4 ? 4 : 0
    );
    selectedCodeColumnIndex = findColumnIndexByKeywords(
      headers,
      ['ma lien ket', 'ma tt 23', 'ma ky thuat', 'ma loai', 'ma'],
      headers.length > 3 ? 3 : 0
    );
  }

  // Lấy tối đa 5 dòng mẫu kế tiếp để preview trực quan
  const sampleRows: any[][] = [];
  for (let r = headerRowIndex + 1; r < rawRows.length && sampleRows.length < 5; r++) {
    const row = rawRows[r] || [];
    if (row.some((cell: any) => String(cell || '').trim().length > 0)) {
      sampleRows.push(row.map((cell: any) => String(cell || '').replace(/\r?\n|\r/g, ' ').trim()));
    }
  }

  return {
    fileName: file.name,
    fileSize: file.size,
    totalRows: rawRows.length,
    headerRowIndex,
    detectedSTTColumn: sttResult.sttColName,
    headers,
    sampleRows,
    selectedNameColumnIndex: Math.max(0, selectedNameColumnIndex),
    selectedCodeColumnIndex: Math.max(0, selectedCodeColumnIndex),
    selectedTTColumnIndex: Math.max(0, selectedTTColumnIndex),
  };
}

/**
 * Tạo dữ liệu phân tích mẫu cho Dữ Liệu Mẫu
 */
export function getSampleFileInspection(fileType: 'SOURCE' | 'PL1' | 'PL2'): FileInspection {
  if (fileType === 'SOURCE') {
    return {
      fileName: 'File_Danh_Muc_Goc_Mau.xlsx',
      fileSize: 24500,
      totalRows: 17,
      headerRowIndex: 1,
      detectedSTTColumn: 'TT',
      headers: ['TT', 'Mã TT 43, 21', 'Danh mục kỹ thuật', 'và điều dưỡng thực hiện độc lập', 'định và thực hiện độc lập'],
      sampleRows: [
        ['1', '1.65', 'Băng ép bất động xử trí rắn độc cắn+', 'X', 'X'],
        ['2', '1.70', 'Băng ép cầm máu+', 'X', 'X'],
        ['3', '1.11', 'Chăm sóc catheter động mạch', 'X', 'X'],
      ],
      selectedNameColumnIndex: 2,
      selectedCodeColumnIndex: 1,
      selectedTTColumnIndex: 0,
    };
  } else if (fileType === 'PL1') {
    return {
      fileName: 'File_Phu_Luc_1_TT23_Mau.xlsx',
      fileSize: 48200,
      totalRows: 18,
      headerRowIndex: 3,
      detectedSTTColumn: 'Stt (cột 1)',
      headers: ['Stt (cột 1)', 'Mã kỹ thuật (cột 2)', 'Phân loại (cột 3)', 'Tên kỹ thuật (cột 4)'],
      sampleRows: [
        ['1', '23.PL1.0001', 'Loại 1', 'Băng ép bất động sơ cứu rắn độc cắn'],
        ['2', '23.PL1.0002', 'Loại 1', 'Băng ép cầm máu vết thương phần mềm'],
        ['3', '23.PL1.0003', 'Loại 1', 'Chăm sóc và theo dõi đường catheter động mạch'],
      ],
      selectedNameColumnIndex: 3,
      selectedCodeColumnIndex: 1,
      selectedTTColumnIndex: 0,
    };
  } else {
    return {
      fileName: 'File_Phu_Luc_2_TT23_Mau.xlsx',
      fileSize: 52100,
      totalRows: 18,
      headerRowIndex: 1,
      detectedSTTColumn: 'Số TT (cột 1)',
      headers: ['Số TT (cột 1)', 'Mã tương đương (cột 2)', 'Mã loại (cột 3)', 'Mã liên kết (cột 4)', 'Tên kỹ thuật (cột 5)'],
      sampleRows: [
        ['1', 'TD.001', 'CLS', '23.PL2.0001', 'Băng ép bất động xử trí rắn cắn'],
        ['2', 'TD.002', 'CLS', '23.PL2.0002', 'Băng ép vết thương cầm máu'],
        ['3', 'TD.003', 'CLS', '23.PL2.0003', 'Chăm sóc người bệnh có catheter động mạch'],
      ],
      selectedNameColumnIndex: 4,
      selectedCodeColumnIndex: 3,
      selectedTTColumnIndex: 0,
    };
  }
}

/**
 * Đọc File Gốc:
 * Hỗ trợ cấu hình tùy chỉnh dòng header và cột danh mục / mã
 */
export async function parseSourceFile(file: File, config?: FileMappingConfig): Promise<SourceItem[]> {
  const data = await file.arrayBuffer();
  const workbook = XLSX.read(data, { type: 'array', dense: true });
  const firstSheetName = workbook.SheetNames[0];
  if (!firstSheetName) {
    throw new Error('File Danh mục gốc không chứa bất kỳ sheet nào.');
  }
  const worksheet = workbook.Sheets[firstSheetName];

  const rawRows: any[][] = XLSX.utils.sheet_to_json(worksheet, {
    header: 1,
    defval: '',
  });

  if (rawRows.length < 2) {
    throw new Error('File Danh mục gốc không có đủ dữ liệu.');
  }

  // Nếu có config tùy biến từ người dùng, ưu tiên sử dụng
  let headerRowIdx = config?.headerRowIdx ?? -1;
  if (headerRowIdx < 0) {
    headerRowIdx = findHeaderRowIndex(
      rawRows,
      ['danh muc ky thuat', 'ten ky thuat', 'ten danh muc'],
      1
    );
  }

  const headers = (rawRows[headerRowIdx] || []).map((h: any) => String(h || '').trim());

  const nameIdx = config?.nameColIdx !== undefined && config.nameColIdx >= 0
    ? config.nameColIdx
    : findColumnIndexByKeywords(
        headers,
        ['ten ky thuat', 'danh muc ky thuat', 'ten danh muc', 'ten'],
        2
      );

  const codeIdx = config?.codeColIdx !== undefined && config.codeColIdx >= 0
    ? config.codeColIdx
    : findColumnIndexByKeywords(
        headers,
        ['ma tt 43', 'ma tt 21', 'ma ky thuat', 'ma'],
        1
      );

  // Tìm tất cả các cột STT tiềm năng (trước cột Tên kỹ thuật)
  const normHeaders = headers.map(normalizeKeyword);
  const sttCandidateIndices: number[] = [];
  for (let c = 0; c < nameIdx; c++) {
    const h = normHeaders[c] || '';
    if (
      h === 'tt' ||
      h === 'stt' ||
      h === 'so tt' ||
      h === 'so thu tu' ||
      h === 'thu tu' ||
      h.startsWith('stt') ||
      h.startsWith('tt ') ||
      h.includes('so tt') ||
      isSTTKeyword(headers[c])
    ) {
      sttCandidateIndices.push(c);
    }
  }

  // Tìm cột TT / STT của File Gốc (STT 2)
  let ttIdx = config?.ttColIdx !== undefined && config.ttColIdx >= 0 ? config.ttColIdx : -1;
  if (ttIdx === -1) {
    if (sttCandidateIndices.length > 1) {
      // Ưu tiên cột có từ khóa rõ ràng
      let chosenIdx = -1;
      for (const col of sttCandidateIndices) {
        const h = normHeaders[col] || '';
        if (h.includes('qd') || h.includes('43') || h.includes('21') || h.includes('23') || h.includes('kt') || h.includes('stt 2')) {
          chosenIdx = col;
          break;
        }
      }

      // Quét các dòng mẫu để phân biệt cột STT kỹ thuật thực tế (thường bắt đầu > 1 hoặc có ô trống ở dòng loại danh mục)
      if (chosenIdx === -1) {
        const secondCandidate = sttCandidateIndices[1];
        let hasGapsOrHighNumbers = false;
        const scanLimit = Math.min(headerRowIdx + 25, rawRows.length);
        for (let r = headerRowIdx + 1; r < scanLimit; r++) {
          const val = rawRows[r]?.[secondCandidate];
          if (val === undefined || val === null || String(val).trim() === '') {
            hasGapsOrHighNumbers = true;
            break;
          }
          const num = Number(val);
          if (!isNaN(num) && num > 10) {
            hasGapsOrHighNumbers = true;
            break;
          }
        }
        chosenIdx = hasGapsOrHighNumbers ? secondCandidate : sttCandidateIndices[0];
      }
      ttIdx = chosenIdx;
    } else if (sttCandidateIndices.length === 1) {
      ttIdx = sttCandidateIndices[0];
    } else {
      ttIdx = normHeaders.findIndex(
        (h) => h === 'tt' || h === 'stt' || h === 'so tt' || h === 'so thu tu' || h === 'thu tu'
      );
      if (ttIdx === -1) {
        ttIdx = normHeaders.findIndex(
          (h) => (h.startsWith('tt ') || h.startsWith('stt ')) && !h.includes('43') && !h.includes('21') && !h.includes('23')
        );
      }
      if (ttIdx === -1 && nameIdx !== 0 && codeIdx !== 0) {
        ttIdx = 0;
      }
    }
  }

  if (nameIdx === -1 || nameIdx >= headers.length) {
    throw new Error(
      `File Gốc không tìm thấy cột chứa Tên danh mục kỹ thuật. Vui lòng kiểm tra lại cấu hình chọn cột.`
    );
  }

  const items: SourceItem[] = [];
  let currentMajorChapter = '';
  let currentSubCategory = '';
  let currentChapter = '';

  // Tự động nhận diện cột Chuyên khoa / Khoa phòng / Phân loại nếu có trong tiêu đề file
  let specialtyColIdx = normHeaders.findIndex(
    (h) =>
      h === 'chuyen khoa' ||
      h === 'khoa phong' ||
      h === 'khoa' ||
      h === 'khoa thuc hien' ||
      h === 'nhom ky thuat' ||
      h === 'phan loai' ||
      h === 'chuyen nganh' ||
      h === 'he co quan' ||
      h === 'chuong'
  );
  if (specialtyColIdx === -1) {
    specialtyColIdx = normHeaders.findIndex(
      (h) =>
        (h.startsWith('chuyen khoa') || h.startsWith('khoa ') || h.startsWith('nhom ')) &&
        !h.includes('ten') &&
        !h.includes('ma') &&
        !h.includes('stt')
    );
  }

  for (let r = headerRowIdx + 1; r < rawRows.length; r++) {
    const row = rawRows[r];
    if (!row) continue;
    const nameVal = nameIdx !== -1 && row[nameIdx] !== undefined ? String(row[nameIdx]).trim().normalize('NFC') : '';
    const codeVal = codeIdx !== -1 && row[codeIdx] !== undefined ? String(row[codeIdx]).trim().normalize('NFC') : '';
    const rawTTVal = ttIdx !== -1 && row[ttIdx] !== undefined && row[ttIdx] !== null ? String(row[ttIdx]).trim().normalize('NFC') : '';

    if (!nameVal) continue;

    // Nếu là dòng tiêu đề chương / loại danh mục thì lưu lại chương hiện tại và bỏ qua, không tính là kỹ thuật
    const detectedChapter = detectChapterHeader(
      nameVal,
      rawTTVal,
      codeVal,
      row,
      nameIdx,
      codeIdx,
      ttIdx,
      sttCandidateIndices
    );
    if (detectedChapter) {
      const isMajorChapter =
        /^([IVXLCDM]+)[\.\:\-\/\)]/i.test(detectedChapter) ||
        /^(chương|chuong|phần|phan|khoa|khối|chuyên khoa)\s+/i.test(detectedChapter);

      if (isMajorChapter) {
        currentMajorChapter = detectedChapter;
        currentSubCategory = '';
      } else {
        currentSubCategory = detectedChapter;
      }

      currentChapter = currentMajorChapter && currentSubCategory
        ? `${currentMajorChapter} > ${currentSubCategory}`
        : (currentSubCategory || currentMajorChapter || detectedChapter);

      continue;
    }

    // Xác định STT 2: Chính xác theo cột TT trong file danh mục gốc
    // KHẮC PHỤC LỖI NHẢY SỐ: Nếu ô rỗng thì giữ nguyên '', KHÔNG tự ý gán items.length + 1 trừ khi file hoàn toàn không có cột TT
    let parsedStt2: number | string = '';
    if (ttIdx !== -1) {
      parsedStt2 = parseSTT2(row[ttIdx]);
    } else {
      parsedStt2 = items.length + 1;
    }

    // Trích xuất chuyên khoa từ cột chuyên biệt nếu có trong dòng
    let rowSpecialty = '';
    if (specialtyColIdx !== -1 && row[specialtyColIdx] !== undefined && row[specialtyColIdx] !== null) {
      rowSpecialty = String(row[specialtyColIdx]).trim();
    }

    const finalChapter = rowSpecialty || currentChapter || undefined;

    items.push({
      id: items.length + 1, // STT 1: Tăng dần liên tục cộng dồn từ 1 đến N
      stt2: parsedStt2,      // STT 2: Chính xác hoàn toàn theo file danh mục gốc
      name: nameVal,
      code: codeVal,
      chapter: finalChapter,
      rawRow: row,
    });
  }

  if (items.length === 0) {
    throw new Error('File Danh mục gốc không có dòng dữ liệu hợp lệ nào.');
  }

  return items;
}

/**
 * Đọc File Phụ lục 1:
 * Hỗ trợ cấu hình tùy chỉnh cột Tên kỹ thuật và Mã kỹ thuật
 */
export async function parsePL1File(file: File, config?: FileMappingConfig): Promise<TargetItem[]> {
  const data = await file.arrayBuffer();
  const workbook = XLSX.read(data, { type: 'array', dense: true });
  const firstSheetName = workbook.SheetNames[0];
  if (!firstSheetName) {
    throw new Error('File Phụ lục 1 không chứa sheet nào.');
  }
  const worksheet = workbook.Sheets[firstSheetName];

  const rawRows: any[][] = XLSX.utils.sheet_to_json(worksheet, {
    header: 1,
    defval: '',
  });

  if (rawRows.length <= 1) {
    throw new Error('File Phụ lục 1 không có đủ dữ liệu.');
  }

  let headerRowIdx = config?.headerRowIdx ?? -1;
  if (headerRowIdx < 0) {
    headerRowIdx = findHeaderRowIndex(
      rawRows,
      ['ten ky thuat', 'ten ky thuat cot 4', 'ma ky thuat'],
      3
    );
  }

  const headers = (rawRows[headerRowIdx] || []).map((h: any) => String(h || '').trim());

  const nameIdx = config?.nameColIdx !== undefined && config.nameColIdx >= 0
    ? config.nameColIdx
    : findColumnIndexByKeywords(
        headers,
        ['ten ky thuat', 'ten ky thuat cot 4', 'cot 4', 'ten'],
        3
      );

  const codeIdx = config?.codeColIdx !== undefined && config.codeColIdx >= 0
    ? config.codeColIdx
    : findColumnIndexByKeywords(
        headers,
        ['ma ky thuat', 'ma ky thuat cot 2', 'cot 2', 'ma'],
        1
      );

  if (nameIdx === -1 || nameIdx >= headers.length) {
    throw new Error(
      `File Phụ lục 1 không tìm thấy cột Tên kỹ thuật đối chiếu. Vui lòng kiểm tra lại cấu hình chọn cột.`
    );
  }

  const items: TargetItem[] = [];
  for (let r = headerRowIdx + 1; r < rawRows.length; r++) {
    const row = rawRows[r];
    if (!row) continue;
    const nameVal = nameIdx !== -1 && row[nameIdx] !== undefined ? String(row[nameIdx]).trim().normalize('NFC') : '';
    const codeVal = codeIdx !== -1 && row[codeIdx] !== undefined ? String(row[codeIdx]).trim().normalize('NFC') : '';

    if (nameVal) {
      if (detectChapterHeader(nameVal, '', codeVal, row, nameIdx, codeIdx)) {
        continue;
      }
      items.push({
        name: nameVal,
        code: codeVal,
        cleanName: cleanText(nameVal),
        rawRow: row,
      });
    }
  }

  if (items.length === 0) {
    throw new Error('File Phụ lục 1 không có dòng kỹ thuật hợp lệ nào.');
  }

  return items;
}

/**
 * Đọc File Phụ lục 2:
 * Hỗ trợ cấu hình tùy chỉnh cột Tên kỹ thuật và Mã kỹ thuật
 */
export async function parsePL2File(file: File, config?: FileMappingConfig): Promise<TargetItem[]> {
  const data = await file.arrayBuffer();
  const workbook = XLSX.read(data, { type: 'array', dense: true });
  const firstSheetName = workbook.SheetNames[0];
  if (!firstSheetName) {
    throw new Error('File Phụ lục 2 không chứa sheet nào.');
  }
  const worksheet = workbook.Sheets[firstSheetName];

  const rawRows: any[][] = XLSX.utils.sheet_to_json(worksheet, {
    header: 1,
    defval: '',
  });

  if (rawRows.length <= 1) {
    throw new Error('File Phụ lục 2 không có đủ dữ liệu.');
  }

  let headerRowIdx = config?.headerRowIdx ?? -1;
  if (headerRowIdx < 0) {
    headerRowIdx = findHeaderRowIndex(
      rawRows,
      ['ten ky thuat', 'ma lien ket', 'ten ky thuat cot 5', 'ma tuong duong'],
      1
    );
  }

  const headers = (rawRows[headerRowIdx] || []).map((h: any) => String(h || '').trim());

  const nameIdx = config?.nameColIdx !== undefined && config.nameColIdx >= 0
    ? config.nameColIdx
    : findColumnIndexByKeywords(
        headers,
        ['ten ky thuat', 'ten ky thuat cot 5', 'cot 5', 'ten dich vu', 'ten'],
        4
      );

  const codeIdx = config?.codeColIdx !== undefined && config.codeColIdx >= 0
    ? config.codeColIdx
    : findColumnIndexByKeywords(
        headers,
        ['ma lien ket', 'ma lien ket cot 4', 'ma tuong duong', 'ma ky thuat', 'cot 4', 'ma'],
        3
      );

  if (nameIdx === -1 || nameIdx >= headers.length) {
    throw new Error(
      `File Phụ lục 2 không tìm thấy cột Tên kỹ thuật đối chiếu. Vui lòng kiểm tra lại cấu hình chọn cột.`
    );
  }

  const items: TargetItem[] = [];
  for (let r = headerRowIdx + 1; r < rawRows.length; r++) {
    const row = rawRows[r];
    if (!row) continue;
    const nameVal = nameIdx !== -1 && row[nameIdx] !== undefined ? String(row[nameIdx]).trim().normalize('NFC') : '';
    const codeVal = codeIdx !== -1 && row[codeIdx] !== undefined ? String(row[codeIdx]).trim().normalize('NFC') : '';

    if (nameVal) {
      if (detectChapterHeader(nameVal, '', codeVal, row, nameIdx, codeIdx)) {
        continue;
      }
      items.push({
        name: nameVal,
        code: codeVal,
        cleanName: cleanText(nameVal),
        rawRow: row,
      });
    }
  }

  if (items.length === 0) {
    throw new Error('File Phụ lục 2 không có dòng kỹ thuật hợp lệ nào.');
  }

  return items;
}

/**
 * Xuất file Excel kết quả Ket_qua_Mapping_DMKT.xlsx theo đúng thứ tự và tên cột tùy biến
 * TỰ ĐỘNG TÔ VÀNG các dòng có điểm cần lưu ý được phát hiện bởi AI & Thẩm định lâm sàng
 */
export async function exportMappingToExcel(
  results: MappingResult[],
  columnsConfig?: OutputColumnConfig[]
): Promise<void> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Hệ Thống Đối Chiếu DMKT Y Tế - AI Studio';
  workbook.lastModifiedBy = 'Gemini AI Clinical Auditor';
  workbook.created = new Date();

  const worksheet = workbook.addWorksheet('Ket_qua_Mapping', {
    views: [{ state: 'frozen', ySplit: 1 }],
  });

  const activeColumns = columnsConfig && columnsConfig.length > 0
    ? columnsConfig.filter((c) => c.selected).sort((a, b) => a.order - b.order)
    : null;

  if (activeColumns && activeColumns.length > 0) {
    worksheet.columns = activeColumns.map((col) => {
      let width = 20;
      if (col.id === 'stt1' || col.id === 'stt2') width = 8;
      else if (col.id === 'tenGoc' || col.id === 'tenPL1' || col.id === 'tenPL2') width = 48;
      else if (col.id === 'aiAudit') width = 40;
      else if (col.id === 'maGoc' || col.id === 'maPL1' || col.id === 'maPL2') width = 18;
      else if (col.id === 'qtktBenhVien') width = 26;
      else if (col.id === 'soDonViThucHien') width = 18;
      else if (col.id.startsWith('extra_')) width = 24;
      return {
        header: col.customTitle || col.defaultTitle,
        key: col.id,
        width,
      };
    });
  } else {
    // Khai báo các cột mặc định
    worksheet.columns = [
      { header: 'Stt 1', key: 'stt1', width: 8 },
      { header: 'Stt 2', key: 'stt2', width: 8 },
      { header: 'Mã TT 43, 21', key: 'maGoc', width: 18 },
      { header: 'Mã TT 23 (PL1)', key: 'maPL1', width: 18 },
      { header: 'Mã TT 23 (PL2)', key: 'maPL2', width: 18 },
      { header: 'Tên Danh mục kỹ thuật theo Thông tư 32/2023/TT-BYT', key: 'tenGoc', width: 48 },
      { header: 'Tên DMKT theo Phụ lục 1 Thông tư 23/2024/TT-BYT', key: 'tenPL1', width: 48 },
      { header: 'Tên DMKT theo Phụ lục 2 Thông tư 23/2024/TT-BYT', key: 'tenPL2', width: 48 },
      { header: 'QTKT tương ứng tại Bệnh viện', key: 'qtktBenhVien', width: 26 },
      { header: 'Số Đơn vị thực hiện', key: 'soDonViThucHien', width: 18 },
      { header: 'Đánh Giá AI & Cảnh Báo', key: 'aiAudit', width: 36 },
    ];
  }

  // Định dạng dòng tiêu đề (Header row)
  const headerRow = worksheet.getRow(1);
  headerRow.height = 32;
  headerRow.font = { name: 'Arial', size: 10, bold: true, color: { argb: 'FFFFFFFF' } };
  headerRow.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FF0F172A' }, // Slate 900
  };
  headerRow.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };

  // Thêm từng dòng dữ liệu và tô vàng các dòng có cảnh báo
  results.forEach((r) => {
    const hasWarning = Boolean(r.aiAudit?.hasWarning);
    let auditStatus = '';
    if (r.isLocked) {
      auditStatus = `🔒 ĐÃ CHỐT TAY${r.manualNote ? `: ${r.manualNote}` : ''}`;
    } else if (hasWarning) {
      auditStatus = r.aiAudit?.severity === 'HIGH' ? '⚠️ CẢNH BÁO NGUY CƠ' : '🟡 CẦN LƯU Ý';
    } else {
      auditStatus = r.tenPL1 || r.tenPL2 ? '✅ Phù hợp' : '⚪ Chưa ghép';
    }

    const auditNote = hasWarning
      ? `${r.aiAudit?.reason || ''}${r.aiAudit?.recommendation ? ` -> Khuyến nghị: ${r.aiAudit.recommendation}` : ''}`
      : '';

    const rowData: Record<string, any> = {
      stt1: r.stt1 !== undefined && r.stt1 !== '' ? r.stt1 : '',
      stt2: r.stt2 !== undefined && r.stt2 !== '' ? r.stt2 : '',
      maGoc: r.maGoc,
      maPL1: r.maPL1,
      maPL2: r.maPL2,
      tenGoc: r.tenGoc,
      tenPL1: r.tenPL1,
      tenPL2: r.tenPL2,
      qtktBenhVien: r.qtktBenhVien,
      soDonViThucHien: r.soDonViThucHien,
      aiAudit: auditStatus + (auditNote ? ` (${auditNote})` : ''),
      chuyenKhoaGoc: r.chuyenKhoaGoc || '',
    };

    if (r.extraValues) {
      Object.assign(rowData, r.extraValues);
    }

    const row = worksheet.addRow(rowData);
    row.height = 24;
    row.alignment = { vertical: 'middle' };

    try {
      const stt1Cell = row.getCell('stt1');
      if (stt1Cell) stt1Cell.alignment = { vertical: 'middle', horizontal: 'center' };
      const stt2Cell = row.getCell('stt2');
      if (stt2Cell) stt2Cell.alignment = { vertical: 'middle', horizontal: 'center' };
    } catch (_) {}

    // TÔ VÀNG TOÀN BỘ DÒNG NẾU CÓ ĐIỂM CẦN LƯU Ý (Yellow warning fill)
    if (hasWarning) {
      row.eachCell((cell) => {
        cell.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'FFFFF9C4' }, // Màu vàng sáng nhạt (Amber/Yellow Highlight)
        };
      });

      // Nhấn mạnh ô trạng thái AI màu cam/vàng đậm
      try {
        const statusCell = row.getCell('aiAudit');
        if (statusCell) {
          statusCell.font = { name: 'Arial', size: 10, bold: true, color: { argb: 'FFB45309' } };
          statusCell.fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'FFFFE082' },
          };
        }
      } catch (_) {}

      // Đánh dấu ô kỹ thuật bị mâu thuẫn
      try {
        if (r.aiAudit?.flagTarget === 'PL2') {
          const pl2Cell = row.getCell('tenPL2');
          if (pl2Cell) pl2Cell.font = { name: 'Arial', size: 10, bold: true, color: { argb: 'FFB91C1C' } };
        } else if (r.aiAudit?.flagTarget === 'PL1') {
          const pl1Cell = row.getCell('tenPL1');
          if (pl1Cell) pl1Cell.font = { name: 'Arial', size: 10, bold: true, color: { argb: 'FFB91C1C' } };
        }
      } catch (_) {}
    }

    // Border mờ thanh lịch cho từng ô
    row.eachCell((cell) => {
      cell.border = {
        top: { style: 'thin', color: { argb: 'FFE2E8F0' } },
        left: { style: 'thin', color: { argb: 'FFE2E8F0' } },
        bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } },
        right: { style: 'thin', color: { argb: 'FFE2E8F0' } },
      };
    });
  });

  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'Ket_qua_Mapping_DMKT_To_Vang_Luu_Y.xlsx';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  window.URL.revokeObjectURL(url);
}

/**
 * Tạo và tải xuống các file Excel mẫu chuẩn theo đúng quy định để người dùng test
 */
export function generateSampleExcelFiles(): void {
  // 1. File Gốc (skiprows=1: dòng 0 tiêu đề chung, dòng 1 header: TT, Mã, Danh mục...)
  const wbGoc = XLSX.utils.book_new();
  const rowsGoc = [
    ['DANH MỤC KỸ THUẬT CƠ SỞ KHÁM CHỮA BỆNH (FILE GỐC)'],
    ['TT', 'Mã TT 43, 21', 'Danh mục kỹ thuật', 'và điều dưỡng thực hiện độc lập', 'định và thực hiện độc lập'],
    ['', '', 'I. Chương chung', '', ''],
    ...RAW_SAMPLE_SOURCE.slice(0, 8).map((s, idx) => [idx + 1, s.code, s.name, 'X', 'X']),
    ['', '', 'II. Chuyên khoa Ngoại và Hồi sức', '', ''],
    ...RAW_SAMPLE_SOURCE.slice(8).map((s, idx) => [idx + 1, s.code, s.name, 'X', 'X']),
  ];
  const wsGoc = XLSX.utils.aoa_to_sheet(rowsGoc);
  wsGoc['!cols'] = [{ wch: 8 }, { wch: 20 }, { wch: 60 }, { wch: 20 }, { wch: 20 }];
  XLSX.utils.book_append_sheet(wbGoc, wsGoc, 'DMKT_Goc');
  XLSX.writeFile(wbGoc, 'File_Danh_Muc_Goc_Mau.xlsx');

  // 2. File Phụ lục 1 (skiprows=3: dòng 0-2 là thông tin Bộ Y Tế, dòng 3 header)
  const wbPL1 = XLSX.utils.book_new();
  const rowsPL1 = [
    ['BỘ Y TẾ - CỤC QUẢN LÝ KHÁM CHỮA BỆNH'],
    ['PHỤ LỤC 1 - THÔNG TƯ SỐ 23/2024/TT-BYT'],
    ['DANH MỤC KỸ THUẬT TRONG KHÁM BỆNH, CHỮA BỆNH'],
    ['Stt (cột 1)', 'Mã kỹ thuật (cột 2)', 'Phân loại (cột 3)', 'Tên kỹ thuật (cột 4)'],
    ...RAW_SAMPLE_PL1.map((p, idx) => [idx + 1, p.code, 'Loại 1', p.name]),
  ];
  const wsPL1 = XLSX.utils.aoa_to_sheet(rowsPL1);
  wsPL1['!cols'] = [{ wch: 12 }, { wch: 24 }, { wch: 18 }, { wch: 60 }];
  XLSX.utils.book_append_sheet(wbPL1, wsPL1, 'Phu_Luc_1');
  XLSX.writeFile(wbPL1, 'File_Phu_Luc_1_TT23_Mau.xlsx');

  // 3. File Phụ lục 2 (skiprows=1: dòng 0 tiêu đề, dòng 1 header có \n)
  const wbPL2 = XLSX.utils.book_new();
  const rowsPL2 = [
    ['PHỤ LỤC 2 - THÔNG TƯ 23/2024/TT-BYT - BẢNG THAM CHIẾU MÃ LIÊN KẾT'],
    ['Số TT\n(cột 1)', 'Mã tương đương\n(cột 2)', 'Mã loại\n(cột 3)', 'Mã liên kết\n(cột 4)', 'Tên kỹ thuật\n(cột 5)'],
    ...RAW_SAMPLE_PL2.map((p, idx) => [idx + 1, 'TD.' + idx, 'CLS', p.code, p.name]),
  ];
  const wsPL2 = XLSX.utils.aoa_to_sheet(rowsPL2);
  wsPL2['!cols'] = [{ wch: 14 }, { wch: 18 }, { wch: 14 }, { wch: 24 }, { wch: 60 }];
  XLSX.utils.book_append_sheet(wbPL2, wsPL2, 'Phu_Luc_2');
  XLSX.writeFile(wbPL2, 'File_Phu_Luc_2_TT23_Mau.xlsx');
}
