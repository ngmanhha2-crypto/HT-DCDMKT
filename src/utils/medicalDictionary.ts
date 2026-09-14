/**
 * Từ điển Chuẩn Hóa Viết Tắt Lâm Sàng & Danh Pháp Y Tế Việt Nam
 * (Medical Abbreviation Expansion & Clinical Synonym Normalizer)
 *
 * Chức năng cốt lõi:
 * - Chuẩn hóa các thuật ngữ viết tắt y tế thường gặp trong bệnh án, danh mục kỹ thuật bệnh viện (PT, TT, NS, SA, CT, MRI, TLT, CTC, ĐM/TM...)
 * - Nhận diện ngữ cảnh lâm sàng (Contextual Disambiguation): phân biệt 'sa' (siêu âm vs sa tử cung), 'cs' (cột sống vs chăm sóc)
 * - Đồng bộ danh pháp tương đương (Clinical Synonyms): Phaco <-> Tán nhuyễn thể thủy tinh, Mổ đẻ <-> Phẫu thuật lấy thai...
 * - Hỗ trợ chuẩn hóa tiếng Việt Unicode, bảo toàn nghĩa lâm sàng trước khi đưa vào bộ lọc đối chiếu mờ (Fuzzy Matching).
 */

export interface MedicalAbbreviationEntry {
  abbr: string;
  expansion: string;
  category: 'SURGERY' | 'IMAGING' | 'ANATOMY' | 'LAB' | 'PHYSIO' | 'SPECIALTY' | 'GENERAL';
  description: string;
}

/**
 * 1. BẢNG TỪ ĐIỂN CÁC TỪ VIẾT TẮT ĐƠN & KÉP CHUYÊN NGÀNH Y TẾ VIỆT NAM
 */
export const MEDICAL_ABBREVIATIONS_MAP: Record<string, string> = {
  // --- A. Phẫu thuật, Thủ thuật & Gây mê hồi sức ---
  'ptns': 'phẫu thuật nội soi',
  'pt': 'phẫu thuật',
  'tt': 'thủ thuật',
  'ns': 'nội soi',
  'khx': 'kết hợp xương',
  'thk': 'thay khớp',
  'tns': 'tán sỏi',
  'nkq': 'nội khí quản',
  'mkq': 'mở khí quản',
  'gmnkq': 'gây mê nội khí quản',
  'gm': 'gây mê',
  'tts': 'tê tủy sống',
  'te': 'gây tê',

  // --- B. Chẩn đoán hình ảnh & Thăm dò chức năng ---
  'sa': 'siêu âm',
  'clvt': 'cắt lớp vi tính',
  'ct': 'cắt lớp vi tính',
  'mri': 'cộng hưởng từ',
  'cht': 'cộng hưởng từ',
  'xq': 'x quang',
  'xquang': 'x quang',
  'ecg': 'điện tâm đồ',
  'eeg': 'điện não đồ',
  'emg': 'điện cơ',
  'hhk': 'hô hấp ký',
  'spect': 'xạ hình spect',
  'petct': 'chụp pet ct',

  // --- C. Cơ quan giải phẫu & Bộ phận đích ---
  'tlt': 'tiền liệt tuyến',
  'ctc': 'cổ tử cung',
  'tc': 'tử cung',
  'bt': 'buồng trứng',
  'tm': 'tĩnh mạch',
  'đm': 'động mạch',
  'dm': 'động mạch',
  'dd': 'dạ dày',
  'dt': 'đại tràng',
  'tq': 'thực quản',
  'cs': 'cột sống',
  'cstl': 'cột sống thắt lưng',
  'csc': 'cột sống cổ',
  'cstn': 'cột sống ngực',
  'tk': 'thần kinh',
  'ha': 'huyết áp',
  'rhm': 'răng hàm mặt',
  'tmh': 'tai mũi họng',
  'snk': 'sơ sinh',

  // --- D. Xét nghiệm & Cận lâm sàng ---
  'xn': 'xét nghiệm',
  'đl': 'định lượng',
  'dl': 'định lượng',
  'đt': 'định tính',
  'tpt': 'tổng phân tích',
  'đh': 'đường huyết',
  'ksđ': 'kháng sinh đồ',
  'ksd': 'kháng sinh đồ',
  'kss': 'kháng sinh đồ',
  'hct': 'huyết cầu tố',
  'hcth': 'hội chứng thận hư',
  'vss': 'tốc độ máu lắng',
  'hba1c': 'định lượng hba1c',

  // --- E. Phục hồi chức năng & Y học cổ truyền ---
  'vltt': 'vật lý trị liệu',
  'vltl': 'vật lý trị liệu',
  'phcn': 'phục hồi chức năng',
  'yhct': 'y học cổ truyền',
  'yhdtt': 'y học dân tộc',
};

/**
 * Tạo RegExp có biên giới từ an toàn cho tiếng Việt Unicode (thay thế cho \b của ASCII)
 */
export function createVnWordRegex(phrase: string): RegExp {
  const VN_CHARS = 'a-z0-9àáảãạăằắẳẵặâầấẩẫậèéẻẽẹêềếểễệìíỉĩịòóỏõọôồốổỗộơờớởỡợùúủũụưừứửữựỳýỷỹỵđ';
  const escaped = phrase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp('(^|[^' + VN_CHARS + '])' + escaped + '(?=[^' + VN_CHARS + ']|$)', 'gi');
}

/**
 * 2. CÁC QUY TẮC CỤM TỪ / HỢP NGỮ Y TẾ ƯU TIÊN CAO (Multi-word Compounds & Special Slashes)
 * Xử lý trước để tránh chia cắt sai hoặc ngữ cảnh xung đột
 */
const COMPOUND_RULES_RAW: [string, string][] = [
  // Hợp ngữ có dấu gạch chéo hoặc gạch nối: ĐM/TM, PT/TT, CLVT/MRI...
  ['đm/tm', 'động mạch và tĩnh mạch'],
  ['dm/tm', 'động mạch và tĩnh mạch'],
  ['đm-tm', 'động mạch và tĩnh mạch'],
  ['pt/tt', 'phẫu thuật thủ thuật'],
  ['pt-tt', 'phẫu thuật thủ thuật'],
  ['clvt/mri', 'cắt lớp vi tính và cộng hưởng từ'],
  ['ct/mri', 'cắt lớp vi tính và cộng hưởng từ'],
  ['rhm/tmh', 'răng hàm mặt và tai mũi họng'],
  ['vltt/phcn', 'vật lý trị liệu phục hồi chức năng'],
  ['vltl/phcn', 'vật lý trị liệu phục hồi chức năng'],

  // Ngữ cảnh "CS": Chăm sóc vs Cột sống
  ['cs vết thương', 'chăm sóc vết thương'],
  ['cs bệnh nhân', 'chăm sóc bệnh nhân'],
  ['cs canun', 'chăm sóc canun'],
  ['cs dẫn lưu', 'chăm sóc dẫn lưu'],
  ['cs mở khí quản', 'chăm sóc mở khí quản'],
  ['cs thắt lưng', 'cột sống thắt lưng'],
  ['cs cổ', 'cột sống cổ'],
  ['cs ngực', 'cột sống ngực'],

  // Cụm phẫu thuật nội soi thường gặp
  ['pt ns', 'phẫu thuật nội soi'],
  ['pt mở', 'phẫu thuật mở'],
  ['cắt ruột thừa ns', 'phẫu thuật nội soi cắt ruột thừa'],
  ['cắt tlt ns', 'phẫu thuật nội soi cắt đốt u tiền liệt tuyến'],
  ['cắt đốt ns tlt', 'phẫu thuật nội soi cắt đốt u tiền liệt tuyến'],
  ['cắt u xơ tc', 'phẫu thuật cắt u xơ tử cung'],
  ['cắt tc toàn phần', 'phẫu thuật cắt tử cung toàn phần'],
  ['cắt tc bán phần', 'phẫu thuật cắt tử cung bán phần'],

  // Cụm thăm dò chức năng & CĐHA
  ['chụp ct scanner', 'chụp cắt lớp vi tính'],
  ['chụp ct', 'chụp cắt lớp vi tính'],
  ['chụp clvt', 'chụp cắt lớp vi tính'],
  ['chụp mri', 'chụp cộng hưởng từ'],
  ['chụp cht', 'chụp cộng hưởng từ'],
  ['chụp xq', 'chụp x quang'],
  ['chụp xquang', 'chụp x quang'],
  ['đo ecg', 'đo điện tâm đồ'],
  ['ghi ecg', 'ghi điện tâm đồ'],
  ['đo eeg', 'đo điện não đồ'],
  ['đo đh', 'đo đường huyết'],
  ['đo đh mao mạch', 'đo đường huyết mao mạch'],
  ['tpt tế bào máu', 'tổng phân tích tế bào máu'],
  ['tpt nước tiểu', 'tổng phân tích nước tiểu'],
  ['ksđ tự động', 'kháng sinh đồ tự động'],

  // Nội soi & Thủ thuật can thiệp
  ['ns dạ dày', 'nội soi dạ dày tá tràng'],
  ['ns đại tràng', 'nội soi đại tràng'],
  ['ns khí phế quản', 'nội soi khí phế quản'],
  ['ns tai mũi họng', 'nội soi tai mũi họng'],
  ['đặt nkq', 'đặt ống nội khí quản'],
  ['rút nkq', 'rút ống nội khí quản'],
  ['canun mkq', 'canun mở khí quản'],
  ['chăm sóc mkq', 'chăm sóc mở khí quản'],
];

/**
 * 3. TỪ ĐỒNG NGHĨA DANH PHÁP LÂM SÀNG CỐT LÕI (Clinical Synonyms & Equivalence)
 * Chuyển các cách gọi dân gian / chuyên khoa khác nhau về cùng một chuẩn ngữ nghĩa
 */
const CLINICAL_SYNONYM_RULES_RAW: [string, string][] = [
  // Sản phụ khoa: Mổ đẻ <-> Phẫu thuật lấy thai
  ['mổ đẻ', 'phẫu thuật lấy thai'],
  ['mo de', 'phẫu thuật lấy thai'],
  ['mổ lấy thai', 'phẫu thuật lấy thai'],
  ['mo lay thai', 'phẫu thuật lấy thai'],
  ['pt mổ đẻ', 'phẫu thuật lấy thai'],

  // Nhãn khoa: Phaco <-> Tán nhuyễn thể thủy tinh
  ['phaco', 'tán nhuyễn thể thủy tinh bằng siêu âm phaco'],

  // Tai mũi họng: Nạo VA <-> Nạo sùi vòm họng
  ['nạo va', 'nạo sùi vòm họng va'],
  ['cắt a', 'phẫu thuật cắt amidan'],
  ['cắt amidan', 'phẫu thuật cắt amidan'],

  // Tim mạch & Thần kinh: Điện tim <-> Điện tâm đồ
  ['điện tim', 'điện tâm đồ'],
  ['điện não', 'điện não đồ'],

  // Tiết niệu: U xơ TLT <-> U phì đại lành tính tuyến tiền liệt
  ['u xơ tuyến tiền liệt', 'u phì đại lành tính tuyến tiền liệt'],
  ['u xơ tiền liệt tuyến', 'u phì đại lành tính tuyến tiền liệt'],
  ['tăng sinh lành tính tuyến tiền liệt', 'u phì đại lành tính tuyến tiền liệt'],
  ['thông đái', 'thông tiểu'],

  // Hô hấp: Chọc nước màng phổi <-> Chọc dò khoang màng phổi
  ['chọc nước màng phổi', 'chọc dò khoang màng phổi'],
  ['chọc tháo dịch màng phổi', 'chọc dò khoang màng phổi'],
  ['x quang tim phổi', 'chụp x quang ngực thẳng'],
  ['chụp tim phổi', 'chụp x quang ngực thẳng'],
];

const COMPILED_COMPOUND_RULES: [RegExp, string][] = COMPOUND_RULES_RAW.map(([pattern, rep]) => [
  createVnWordRegex(pattern),
  rep,
]);

const COMPILED_SYNONYM_RULES: [RegExp, string][] = CLINICAL_SYNONYM_RULES_RAW.map(([pattern, rep]) => [
  createVnWordRegex(pattern),
  rep,
]);

/**
 * Bảng ký tự ranh giới từ tiếng Việt Unicode (Unicode-safe word boundary matcher)
 */
const VIETNAMESE_LETTERS_REGEX = /[a-z0-9àáảãạăằắẳẵặâầấẩẫậèéẻẽẹêềếểễệìíỉĩịòóỏõọôồốổỗộơờớởỡợùúủũụưừứửữựỳýỷỹỵđ]/i;

/**
 * Hàm chuẩn hóa từ viết tắt lâm sàng chuyên sâu:
 * 1. Chuyển chữ thường và chuẩn hóa ký tự nhiễu
 * 2. Thay thế các hợp ngữ đặc thù / dấu gạch chéo (compound multi-word replacements)
 * 3. Chuẩn hóa các từ viết tắt độc lập (single-token abbreviations) với ranh giới an toàn cho tiếng Việt
 * 4. Ánh xạ từ đồng nghĩa lâm sàng tương đương
 * 5. Loại bỏ khoảng trắng thừa
 */
export function normalizeMedicalAbbreviations(rawText: string | null | undefined): string {
  if (!rawText) return '';

  let text = String(rawText).toLowerCase();

  // 1. Xóa ký tự gạch chân hoặc ký tự nhiễu nhưng giữ lại gạch chéo tạm thời để xử lý ĐM/TM
  text = text.replace(/[*+\-,.\[\]():;\\_"'`~!?@#$%^&=]/g, ' ');

  // 2. Chạy các hợp ngữ ưu tiên (Compounds)
  for (const [pattern, replacement] of COMPILED_COMPOUND_RULES) {
    text = text.replace(pattern, (_match, p1) => (p1 || '') + replacement);
  }

  // Bây giờ xóa dấu gạch chéo còn sót lại
  text = text.replace(/[\/]/g, ' ');

  // 3. Thay thế các từ đồng nghĩa lâm sàng cốt lõi (Clinical Synonyms)
  for (const [pattern, replacement] of COMPILED_SYNONYM_RULES) {
    text = text.replace(pattern, (_match, p1) => (p1 || '') + replacement);
  }

  // 4. Tokenize chuỗi và thay thế các từ viết tắt độc lập (Safe token boundary replacement)
  const tokens = text.split(/\s+/).filter(Boolean);
  const normalizedTokens: string[] = [];

  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i];
    const nextToken = i + 1 < tokens.length ? tokens[i + 1] : '';

    // Kiểm tra ngoại lệ ngữ cảnh lâm sàng: "sa" đi với sa tạng bệnh lý (sa tử cung, sa sinh dục, sa trực tràng...)
    // Chỉ giữ là bệnh lý "sa" nếu đứng trước nó là các động từ ngoại khoa/điều trị (phẫu thuật, điều trị, khâu, treo, sửa chữa, phục hồi...)
    const followingTwo = (tokens[i + 1] ? tokens[i + 1] + ' ' : '') + (tokens[i + 2] || '');
    const prevToken = i > 0 ? tokens[i - 1] : '';
    const isPrecededBySurgery = /^(?:phẫu|thuật|pt|điều|trị|mổ|khâu|treo|cố|định|tái|tạo|phục|hồi|làm|hẹp|manchester)$/i.test(prevToken);
    const isProlapseOrgan = /^(?:tử cung|tu cung|sinh dục|sinh duc|trực tràng|truc trang|thành âm|bang quang|bàng quang|ruột|tang|tạng)/i.test(followingTwo);

    if (token === 'sa' && isProlapseOrgan && isPrecededBySurgery) {
      normalizedTokens.push('sa');
      continue;
    }

    // Tra cứu trong từ điển viết tắt
    const expansion = MEDICAL_ABBREVIATIONS_MAP[token];
    if (expansion) {
      normalizedTokens.push(expansion);
    } else {
      normalizedTokens.push(token);
    }
  }

  // Gộp lại và dọn dẹp các từ lặp lại do ghép nối ngữ cảnh (ví dụ "chăm sóc chăm sóc", "phẫu thuật phẫu thuật")
  let result = normalizedTokens.join(' ');
  result = result.replace(/\b(chăm sóc|phẫu thuật|thủ thuật|nội soi|siêu âm|cắt lớp vi tính)\s+\1\b/gi, '$1');
  result = result.replace(/\s+/g, ' ').trim();
  return result;
}

/**
 * Tra cứu giải thích cho một từ viết tắt y tế (phục vụ hiển thị tooltip / chú giải cho người dùng)
 */
export function getMedicalAbbreviationInfo(abbr: string): string | null {
  const key = abbr.trim().toLowerCase();
  return MEDICAL_ABBREVIATIONS_MAP[key] || null;
}
