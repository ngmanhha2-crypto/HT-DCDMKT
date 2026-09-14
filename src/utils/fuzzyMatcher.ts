import { TargetItem, IndexedTargetList } from '../types';
import {
  decomposeMedicalProcedure,
  evaluateAnatomyCompatibility,
  evaluateActionModalityCompatibility,
  MedicalComponent,
  ANATOMY_ONTOLOGY,
  ACTION_MODALITY_INFO,
} from './anatomyMatcher';
import {
  normalizeMedicalAbbreviations,
  getMedicalAbbreviationInfo,
  MEDICAL_ABBREVIATIONS_MAP,
} from './medicalDictionary';

export {
  normalizeMedicalAbbreviations,
  getMedicalAbbreviationInfo,
  MEDICAL_ABBREVIATIONS_MAP,
};

/**
 * Tiền xử lý chuỗi danh mục kỹ thuật y tế:
 * - Chuẩn hóa toàn bộ từ viết tắt lâm sàng (PT, TT, NS, SA, CT, MRI, TLT, CTC, ĐM/TM...)
 * - Nhận diện ngữ cảnh và đồng bộ từ đồng nghĩa y tế
 * - Chuyển thành chữ thường (lowercase)
 * - Xóa bỏ các ký tự đặc biệt nhiễu y tế (*, +, -, ,, ., v.v.)
 * - Loại bỏ các khoảng trắng thừa ở đầu, cuối và giữa các từ.
 */
export function cleanText(text: string | null | undefined): string {
  if (!text) return '';
  return normalizeMedicalAbbreviations(text).normalize('NFC').trim();
}

/**
 * Loại bỏ dấu tiếng Việt (Unaccented Vietnamese text normalizer)
 * Hỗ trợ tra cứu tìm kiếm khi người dùng gõ không dấu hoặc IME tổ hợp NFD
 */
export function removeVietnameseTones(str: string | null | undefined): string {
  if (!str) return '';
  return str
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .normalize('NFC');
}

/**
 * Tách chuỗi thành mảng các từ khóa (tokens) có ý nghĩa (độ dài >= 2)
 */
export function extractTokens(text: string): string[] {
  if (!text) return [];
  const words = text.split(/\s+/);
  const validWords = words.filter((w) => w.length >= 2);
  return validWords.length > 0 ? validWords : words;
}

/**
 * Tạo chỉ mục tìm kiếm thông minh (Two-Tier Medical Pre-indexing):
 * - exactMap: Bảng băm tra cứu O(1)
 * - invertedTokenIndex: Chỉ mục ngược theo từ khóa và bộ phận y tế
 * - itemComponents: Thành phần bóc tách [Hành động Kỹ thuật + Bộ phận Giải phẫu]
 */
export function createTargetIndex(targetList: TargetItem[]): IndexedTargetList {
  const exactMap = new Map<string, TargetItem>();
  const invertedTokenIndex = new Map<string, number[]>();
  const itemTokens: string[][] = new Array(targetList.length);
  const itemLens: number[] = new Array(targetList.length);
  const itemComponents: MedicalComponent[] = new Array(targetList.length);

  for (let i = 0; i < targetList.length; i++) {
    const item = targetList[i];
    const clean = item.cleanName || cleanText(item.name);
    item.cleanName = clean;
    itemLens[i] = clean.length;

    // Bóc tách ngữ nghĩa y tế
    const component = item.component || decomposeMedicalProcedure(item.name);
    item.component = component;
    itemComponents[i] = component;

    // Lưu vào bản đồ khớp tuyệt đối
    if (clean && !exactMap.has(clean)) {
      exactMap.set(clean, item);
    }

    // Tách từ khóa
    const tokens = extractTokens(clean);
    itemTokens[i] = tokens;

    const uniqueTokens = new Set(tokens);

    // Thêm tokens bộ phận, chuyên khoa, nhóm hành động và thực thể cốt lõi vào chỉ mục
    if (component.primaryCategory) {
      uniqueTokens.add(`__CAT_${component.primaryCategory}__`);
    }
    for (const anat of component.anatomyList) {
      uniqueTokens.add(`__ANAT_${anat}__`);
    }
    if (component.primaryModality) {
      uniqueTokens.add(`__MOD_${component.primaryModality}__`);
    }
    if (component.coreTarget && component.coreTarget.length >= 3) {
      uniqueTokens.add(`__CORE_${component.coreTarget}__`);
    }

    uniqueTokens.forEach((token) => {
      let list = invertedTokenIndex.get(token);
      if (!list) {
        list = [];
        invertedTokenIndex.set(token, list);
      }
      list.push(i);
    });
  }

  return {
    items: targetList,
    exactMap,
    invertedTokenIndex,
    itemTokens,
    itemLens,
    itemComponents,
  };
}

/**
 * Thuật toán tính tỷ lệ tương đồng Levenshtein tối ưu bộ nhớ O(min(m, n))
 * Sử dụng mảng 1 chiều tái sử dụng, kèm cắt tỉa sớm khi khoảng cách vượt ngưỡng
 */
export function fastLevenshteinRatio(
  s1: string,
  s2: string,
  minScoreRequired: number = 0.5
): number {
  if (s1 === s2) return 1.0;
  if (!s1 || !s2) return 0.0;

  const m = s1.length;
  const n = s2.length;
  const maxLen = Math.max(m, n);
  if (maxLen === 0) return 1.0;

  // Cắt tỉa toán học: nếu chênh lệch độ dài quá lớn thì không thể đạt ngưỡng
  const minPossibleDistance = Math.abs(m - n);
  if ((maxLen - minPossibleDistance) / maxLen < minScoreRequired) {
    return 0.0;
  }

  const maxAllowedDistance = Math.floor(maxLen * (1 - minScoreRequired));

  // Đảm bảo s1 là chuỗi ngắn hơn để tối ưu bộ nhớ
  const [str1, str2, len1, len2] = m <= n ? [s1, s2, m, n] : [s2, s1, n, m];

  // Sử dụng 2 hàng int32
  let prev = new Int32Array(len1 + 1);
  let curr = new Int32Array(len1 + 1);

  for (let i = 0; i <= len1; i++) {
    prev[i] = i;
  }

  for (let j = 1; j <= len2; j++) {
    curr[0] = j;
    let minRowVal = curr[0];
    const char2 = str2[j - 1];

    for (let i = 1; i <= len1; i++) {
      const cost = str1[i - 1] === char2 ? 0 : 1;
      const val = Math.min(
        prev[i] + 1,      // deletion
        curr[i - 1] + 1,  // insertion
        prev[i - 1] + cost // substitution
      );
      curr[i] = val;
      if (val < minRowVal) minRowVal = val;
    }

    // Nếu giá trị nhỏ nhất trong hàng đã vượt mức cho phép, dừng sớm
    if (minRowVal > maxAllowedDistance) {
      return 0.0;
    }

    // Swap prev và curr
    const temp = prev;
    prev = curr;
    curr = temp;
  }

  const finalDist = prev[len1];
  const ratio = (maxLen - finalDist) / maxLen;
  return ratio >= minScoreRequired ? ratio : 0.0;
}

/**
 * Tính tỷ lệ tương đồng Ratcliff/Obershelp (tương đương difflib.SequenceMatcher trong Python)
 */
export function sequenceMatcherRatio(s1: string, s2: string): number {
  if (s1 === s2) return 1.0;
  if (!s1 || !s2) return 0.0;

  const len1 = s1.length;
  const len2 = s2.length;
  const total = len1 + len2;
  if (total === 0) return 1.0;

  // Cắt tỉa nhanh: nếu độ dài chênh lệch quá 65%, bỏ qua
  if (Math.abs(len1 - len2) / Math.max(len1, len2) > 0.65) {
    return 0.0;
  }

  function findMatchingBlocks(
    alo: number,
    ahi: number,
    blo: number,
    bhi: number
  ): number {
    let bestI = alo;
    let bestJ = blo;
    let bestSize = 0;

    for (let i = alo; i < ahi; i++) {
      for (let j = blo; j < bhi; j++) {
        let k = 0;
        while (i + k < ahi && j + k < bhi && s1[i + k] === s2[j + k]) {
          k++;
        }
        if (k > bestSize) {
          bestI = i;
          bestJ = j;
          bestSize = k;
        }
      }
    }

    if (bestSize === 0) return 0;

    let matches = bestSize;
    if (alo < bestI && blo < bestJ) {
      matches += findMatchingBlocks(alo, bestI, blo, bestJ);
    }
    if (bestI + bestSize < ahi && bestJ + bestSize < bhi) {
      matches += findMatchingBlocks(bestI + bestSize, ahi, bestJ + bestSize, bhi);
    }

    return matches;
  }

  const matchingChars = findMatchingBlocks(0, len1, 0, len2);
  return (2.0 * matchingChars) / total;
}

export interface MatchResult {
  name: string;
  code: string;
  score: number;
  anatomy?: string;
  specialty?: string;
  modality?: string;
  coreTarget?: string;
  matchedItem?: TargetItem | null;
}

/**
 * Tìm kiếm mục tương đồng nhất sử dụng Bộ Lọc Y Tế 2 Tầng:
 * Tầng 1: Lọc theo Bộ Phận Giải Phẫu & Hệ Cơ Quan (chặn 100% xung đột như Âm hộ vs Bờ mi)
 * Tầng 2: So khớp chi tiết Tên Kỹ Thuật / Hành động can thiệp
 */
export function getBestMatchWithIndex(
  query: string,
  targetIndex: IndexedTargetList,
  threshold: number = 0.70,
  enableAnatomyFilter: boolean = true
): MatchResult {
  if (!query || !targetIndex || targetIndex.items.length === 0) {
    return { name: '', code: '', score: 0, matchedItem: null };
  }

  // Bóc tách ngữ nghĩa y tế của chuỗi truy vấn (query)
  const queryComp = decomposeMedicalProcedure(query);
  const cleanQuery = queryComp.cleanText;
  if (!cleanQuery) {
    return { name: '', code: '', score: 0, matchedItem: null };
  }

  // BƯỚC 1: Khớp chính xác tuyệt đối O(1) qua bảng băm (Exact Map)
  const exactHit = targetIndex.exactMap.get(cleanQuery);
  if (exactHit) {
    return {
      name: exactHit.name,
      code: exactHit.code,
      score: 100,
      anatomy: exactHit.component?.anatomyList.join(', '),
      specialty: exactHit.component?.primaryCategory
        ? ANATOMY_ONTOLOGY[exactHit.component.primaryCategory]?.name
        : undefined,
      matchedItem: exactHit,
    };
  }

  // BƯỚC 2: Thu hẹp không gian tìm kiếm qua Chỉ mục ngược (Candidate Pruning)
  const queryTokens = extractTokens(cleanQuery);
  const qLen = cleanQuery.length;

  const candidateScores = new Map<number, number>();

  // 1. Quét theo từ khóa
  for (const token of queryTokens) {
    const matchedIndices = targetIndex.invertedTokenIndex.get(token);
    if (matchedIndices) {
      for (const idx of matchedIndices) {
        candidateScores.set(idx, (candidateScores.get(idx) || 0) + 1);
      }
    }
  }

  // 2. Ưu tiên các ứng viên có cùng bộ phận giải phẫu hoặc cùng chuyên khoa
  if (enableAnatomyFilter) {
    for (const anat of queryComp.anatomyList) {
      const anatMatches = targetIndex.invertedTokenIndex.get(`__ANAT_${anat}__`);
      if (anatMatches) {
        for (const idx of anatMatches) {
          candidateScores.set(idx, (candidateScores.get(idx) || 0) + 8); // Trọng số ưu tiên cao cho đúng bộ phận
        }
      }
    }

    if (queryComp.primaryCategory) {
      const catMatches = targetIndex.invertedTokenIndex.get(`__CAT_${queryComp.primaryCategory}__`);
      if (catMatches) {
        for (const idx of catMatches) {
          candidateScores.set(idx, (candidateScores.get(idx) || 0) + 4); // Cùng chuyên khoa
        }
      }
    }

    if (queryComp.primaryModality) {
      const modMatches = targetIndex.invertedTokenIndex.get(`__MOD_${queryComp.primaryModality}__`);
      if (modMatches) {
        for (const idx of modMatches) {
          candidateScores.set(idx, (candidateScores.get(idx) || 0) + 5); // Cùng bản chất nhóm hành động
        }
      }
    }

    if (queryComp.coreTarget && queryComp.coreTarget.length >= 3) {
      const coreMatches = targetIndex.invertedTokenIndex.get(`__CORE_${queryComp.coreTarget}__`);
      if (coreMatches) {
        for (const idx of coreMatches) {
          candidateScores.set(idx, (candidateScores.get(idx) || 0) + 10); // Cùng thực thể cốt lõi
        }
      }
    }
  }

  let candidatesToEvaluate: number[] = [];

  if (candidateScores.size > 0) {
    const sorted = Array.from(candidateScores.entries()).sort((a, b) => b[1] - a[1]);
    // Lấy tối đa 50 ứng viên tiềm năng nhất
    candidatesToEvaluate = sorted.slice(0, 50).map((entry) => entry[0]);
  } else {
    // Nếu không trùng từ khóa nào, xét các mục có độ dài tương đương
    for (let i = 0; i < targetIndex.items.length; i++) {
      const tLen = targetIndex.itemLens[i];
      if (Math.abs(qLen - tLen) / Math.max(qLen, tLen) <= 0.35) {
        candidatesToEvaluate.push(i);
        if (candidatesToEvaluate.length >= 40) break;
      }
    }
  }

  if (candidatesToEvaluate.length === 0) {
    return { name: '', code: '', score: 0, matchedItem: null };
  }

  let bestItem: TargetItem | null = null;
  let bestScore = 0;

  // BƯỚC 3: So sánh chi tiết trên tập ứng viên thu gọn với Hệ Thống Rào Chắn Y Tế Đa Tầng
  for (const idx of candidatesToEvaluate) {
    const item = targetIndex.items[idx];
    const targetComp = targetIndex.itemComponents[idx] || decomposeMedicalProcedure(item.name);
    const targetClean = item.cleanName;
    const tLen = targetIndex.itemLens[idx];

    // 🎯 TẦNG 1: KIỂM TRA BỘ PHẬN GIẢI PHẪU & HỆ CƠ QUAN
    let compat: ReturnType<typeof evaluateAnatomyCompatibility> = {
      status: 'GENERIC_OR_UNKNOWN',
      penaltyFactor: 1.0,
      bonus: 0.0,
      reason: '',
    };

    let modalityCompat: ReturnType<typeof evaluateActionModalityCompatibility> = {
      status: 'MODALITY_UNKNOWN',
      penaltyFactor: 1.0,
      bonus: 0.0,
      reason: '',
    };

    if (enableAnatomyFilter) {
      compat = evaluateAnatomyCompatibility(queryComp, targetComp);

      // 🚫 CHẶN ĐỨNG 100% XUNG ĐỘT GIẢI PHẪU:
      // Nếu bộ phận giải phẫu xung đột nghiêm trọng (ví dụ: Âm hộ vs Bờ mi, Thận vs Tai...)
      if (compat.status === 'SEVERE_CONFLICT') {
        continue;
      }

      // 🚫 TẦNG 1.5: RÀO CHẮN BẢN CHẤT HÀNH ĐỘNG LÂM SÀNG (ACTION MODALITY BARRIER)
      // Chặn đứng 100% xung đột bản chất (ví dụ: Đặt ống can thiệp vs Xét nghiệm/đo lường)
      modalityCompat = evaluateActionModalityCompatibility(queryComp, targetComp);
      if (modalityCompat.status === 'MODALITY_CONFLICT') {
        continue;
      }

      // 🚫 TẦNG 1.8: RÀO CHẮN THỰC THỂ CAN THIỆP CỐT LÕI (CORE TARGET ENTITY BARRIER)
      // Sau khi đã lọc bỏ các từ rỗng y khoa như "kỹ thuật", "quy trình", "liên tục", "tại giường"...
      // Nếu cả hai bên đều xác định rõ thực thể đích (độ dài >= 3) nhưng không có điểm tương đồng
      // Ví dụ: "ống thông tiểu" vs "đường huyết" -> coreSimilarity = 0.0 -> CHẶN ĐỨNG!
      if (
        queryComp.coreTarget &&
        targetComp.coreTarget &&
        queryComp.coreTarget.length >= 3 &&
        targetComp.coreTarget.length >= 3
      ) {
        const coreLev = fastLevenshteinRatio(queryComp.coreTarget, targetComp.coreTarget, 0.25);
        const coreSeq = sequenceMatcherRatio(queryComp.coreTarget, targetComp.coreTarget);
        const coreSimilarity = Math.max(coreLev, coreSeq);
        if (coreSimilarity < 0.35) {
          continue;
        }
      }
    }

    // Cắt tỉa theo độ chênh lệch chiều dài
    const maxLen = Math.max(qLen, tLen);
    if (Math.abs(qLen - tLen) / maxLen > (1 - Math.max(0.4, threshold - 0.2))) {
      continue;
    }

    // 🎯 TẦNG 2: SO KHỚP TÊN KỸ THUẬT, HÀNH ĐỘNG VÀ THỰC THỂ CỐT LÕI
    // 2.1. So khớp toàn chuỗi
    const levScore = fastLevenshteinRatio(cleanQuery, targetClean, 0.35);
    const seqScore = sequenceMatcherRatio(cleanQuery, targetClean);
    const fullScore = Math.max(levScore, seqScore);

    // 2.2. So khớp riêng phần kỹ thuật (đã lược bớt tên bộ phận)
    let techScore = fullScore;
    if (queryComp.cleanWithoutAnatomy && targetComp.cleanWithoutAnatomy) {
      const levTech = fastLevenshteinRatio(queryComp.cleanWithoutAnatomy, targetComp.cleanWithoutAnatomy, 0.35);
      const seqTech = sequenceMatcherRatio(queryComp.cleanWithoutAnatomy, targetComp.cleanWithoutAnatomy);
      techScore = Math.max(levTech, seqTech);
    }

    // 2.3. So khớp thực thể can thiệp cốt lõi (Core Target)
    let coreScore = 1.0;
    if (
      queryComp.coreTarget &&
      targetComp.coreTarget &&
      queryComp.coreTarget.length >= 3 &&
      targetComp.coreTarget.length >= 3
    ) {
      const coreLev = fastLevenshteinRatio(queryComp.coreTarget, targetComp.coreTarget, 0.25);
      const coreSeq = sequenceMatcherRatio(queryComp.coreTarget, targetComp.coreTarget);
      coreScore = Math.max(coreLev, coreSeq);
    }

    // 2.4. Tính điểm tổng hợp đa tầng (Multi-Tier Composite Score)
    let compositeScore = fullScore;
    if (enableAnatomyFilter) {
      if (compat.status === 'EXACT_MATCH') {
        // Trùng đúng bộ phận: Kết hợp 35% toàn chuỗi + 25% kỹ thuật + 25% thực thể cốt lõi + 15% thưởng
        compositeScore = 0.35 * fullScore + 0.25 * techScore + 0.25 * coreScore + 0.15;
      } else if (compat.status === 'SAME_ORGAN_SYSTEM') {
        // Cùng hệ cơ quan: 40% toàn chuỗi + 25% kỹ thuật + 25% thực thể cốt lõi + 10% thưởng
        compositeScore = 0.40 * fullScore + 0.25 * techScore + 0.25 * coreScore + 0.10;
      } else {
        // Kỹ thuật chung
        compositeScore = (0.50 * fullScore + 0.25 * techScore + 0.25 * coreScore) * compat.penaltyFactor;
      }

      // Áp dụng hệ số tương thích nhóm hành động (Action Modality)
      compositeScore = compositeScore * modalityCompat.penaltyFactor + modalityCompat.bonus;
    }

    compositeScore = Math.min(1.0, compositeScore);

    if (compositeScore > bestScore) {
      bestScore = compositeScore;
      bestItem = item;

      // Nếu đạt độ chính xác gần như hoàn hảo, kết thúc sớm
      if (compositeScore >= 0.98) {
        break;
      }
    }
  }

  if (bestScore >= threshold && bestItem) {
    const comp = bestItem.component || decomposeMedicalProcedure(bestItem.name);
    return {
      name: bestItem.name,
      code: bestItem.code,
      score: Math.round(bestScore * 1000) / 10,
      anatomy: comp.anatomyList.join(', '),
      specialty: comp.primaryCategory ? ANATOMY_ONTOLOGY[comp.primaryCategory]?.name : undefined,
      modality: comp.primaryModality ? ACTION_MODALITY_INFO[comp.primaryModality]?.name : undefined,
      coreTarget: comp.coreTarget,
      matchedItem: bestItem,
    };
  }

  return { name: '', code: '', score: 0, matchedItem: null };
}

/**
 * Hàm tìm kiếm tương thích ngược (nếu truyền mảng TargetItem thuần)
 */
export function getBestMatch(
  query: string,
  targetList: TargetItem[],
  threshold: number = 0.70,
  enableAnatomyFilter: boolean = true
): MatchResult {
  if (!query || !targetList || targetList.length === 0) {
    return { name: '', code: '', score: 0, matchedItem: null };
  }

  const queryComp = decomposeMedicalProcedure(query);
  const cleanQuery = queryComp.cleanText;
  if (!cleanQuery) {
    return { name: '', code: '', score: 0, matchedItem: null };
  }

  // 1. Khớp chính xác
  for (const item of targetList) {
    if (cleanQuery === (item.cleanName || cleanText(item.name))) {
      const comp = item.component || decomposeMedicalProcedure(item.name);
      return {
        name: item.name,
        code: item.code,
        score: 100,
        anatomy: comp.anatomyList.join(', '),
        specialty: comp.primaryCategory ? ANATOMY_ONTOLOGY[comp.primaryCategory]?.name : undefined,
        matchedItem: item,
      };
    }
  }

  // 2. Chạy so sánh với Hệ Thống Rào Chắn Y Tế Đa Tầng
  let bestItem: TargetItem | null = null;
  let bestScore = 0;

  for (const item of targetList) {
    const targetComp = item.component || decomposeMedicalProcedure(item.name);
    const targetClean = item.cleanName || cleanText(item.name);

    let compat: ReturnType<typeof evaluateAnatomyCompatibility> = {
      status: 'GENERIC_OR_UNKNOWN',
      penaltyFactor: 1.0,
      bonus: 0.0,
      reason: '',
    };

    let modalityCompat: ReturnType<typeof evaluateActionModalityCompatibility> = {
      status: 'MODALITY_UNKNOWN',
      penaltyFactor: 1.0,
      bonus: 0.0,
      reason: '',
    };

    if (enableAnatomyFilter) {
      compat = evaluateAnatomyCompatibility(queryComp, targetComp);
      if (compat.status === 'SEVERE_CONFLICT') {
        continue;
      }

      modalityCompat = evaluateActionModalityCompatibility(queryComp, targetComp);
      if (modalityCompat.status === 'MODALITY_CONFLICT') {
        continue;
      }

      if (
        queryComp.coreTarget &&
        targetComp.coreTarget &&
        queryComp.coreTarget.length >= 3 &&
        targetComp.coreTarget.length >= 3
      ) {
        const coreLev = fastLevenshteinRatio(queryComp.coreTarget, targetComp.coreTarget, 0.25);
        const coreSeq = sequenceMatcherRatio(queryComp.coreTarget, targetComp.coreTarget);
        const coreSimilarity = Math.max(coreLev, coreSeq);
        if (coreSimilarity < 0.35) {
          continue;
        }
      }
    }

    const levScore = fastLevenshteinRatio(cleanQuery, targetClean, 0.35);
    const seqScore = sequenceMatcherRatio(cleanQuery, targetClean);
    const fullScore = Math.max(levScore, seqScore);

    let techScore = fullScore;
    if (queryComp.cleanWithoutAnatomy && targetComp.cleanWithoutAnatomy) {
      const levTech = fastLevenshteinRatio(queryComp.cleanWithoutAnatomy, targetComp.cleanWithoutAnatomy, 0.35);
      const seqTech = sequenceMatcherRatio(queryComp.cleanWithoutAnatomy, targetComp.cleanWithoutAnatomy);
      techScore = Math.max(levTech, seqTech);
    }

    let coreScore = 1.0;
    if (
      queryComp.coreTarget &&
      targetComp.coreTarget &&
      queryComp.coreTarget.length >= 3 &&
      targetComp.coreTarget.length >= 3
    ) {
      const coreLev = fastLevenshteinRatio(queryComp.coreTarget, targetComp.coreTarget, 0.25);
      const coreSeq = sequenceMatcherRatio(queryComp.coreTarget, targetComp.coreTarget);
      coreScore = Math.max(coreLev, coreSeq);
    }

    let compositeScore = fullScore;
    if (enableAnatomyFilter) {
      if (compat.status === 'EXACT_MATCH') {
        compositeScore = 0.35 * fullScore + 0.25 * techScore + 0.25 * coreScore + 0.15;
      } else if (compat.status === 'SAME_ORGAN_SYSTEM') {
        compositeScore = 0.40 * fullScore + 0.25 * techScore + 0.25 * coreScore + 0.10;
      } else {
        compositeScore = (0.50 * fullScore + 0.25 * techScore + 0.25 * coreScore) * compat.penaltyFactor;
      }

      compositeScore = compositeScore * modalityCompat.penaltyFactor + modalityCompat.bonus;
    }

    compositeScore = Math.min(1.0, compositeScore);

    if (compositeScore > bestScore) {
      bestScore = compositeScore;
      bestItem = item;
      if (compositeScore >= 0.98) break;
    }
  }

  if (bestScore >= threshold && bestItem) {
    const comp = bestItem.component || decomposeMedicalProcedure(bestItem.name);
    return {
      name: bestItem.name,
      code: bestItem.code,
      score: Math.round(bestScore * 1000) / 10,
      anatomy: comp.anatomyList.join(', '),
      specialty: comp.primaryCategory ? ANATOMY_ONTOLOGY[comp.primaryCategory]?.name : undefined,
      modality: comp.primaryModality ? ACTION_MODALITY_INFO[comp.primaryModality]?.name : undefined,
      coreTarget: comp.coreTarget,
      matchedItem: bestItem,
    };
  }

  return { name: '', code: '', score: 0, matchedItem: null };
}

export interface CandidateMatchResult {
  item: TargetItem;
  code: string;
  name: string;
  score: number;
  anatomy?: string;
  specialty?: string;
  matchType: 'EXACT' | 'PREFIX' | 'SUBSTRING' | 'ALL_WORDS' | 'FUZZY' | 'CODE';
}

export interface FastSearchTargetItem {
  item: TargetItem;
  code: string;
  lowerCode: string;
  name: string;
  lowerName: string;
  unaccentedName: string;
  cleanName: string;
  unaccentedClean: string;
  tokens: string[];
  unaccentedTokens: string[];
  comp?: MedicalComponent;
}

// Bộ nhớ đệm chỉ mục tìm kiếm siêu tốc theo mảng TargetItem[]
const fastIndexCache = new WeakMap<TargetItem[], FastSearchTargetItem[]>();

export function getOrCreateFastSearchIndex(items: TargetItem[]): FastSearchTargetItem[] {
  if (!items || items.length === 0) return [];
  const cached = fastIndexCache.get(items);
  if (cached) return cached;

  const indexed: FastSearchTargetItem[] = new Array(items.length);
  for (let i = 0; i < items.length; i++) {
    const it = items[i];
    const code = (it.code || '').trim().normalize('NFC');
    const lowerCode = code.toLowerCase();

    const name = (it.name || '').trim().normalize('NFC');
    const lowerName = name.toLowerCase();
    const unaccentedName = removeVietnameseTones(lowerName);

    const clean = (it.cleanName || cleanText(name)).toLowerCase().normalize('NFC');
    const unaccentedClean = removeVietnameseTones(clean);

    const tokens = clean.split(/\s+/).filter(Boolean);
    const unaccentedTokens = unaccentedClean.split(/\s+/).filter(Boolean);

    indexed[i] = {
      item: it,
      code,
      lowerCode,
      name,
      lowerName,
      unaccentedName,
      cleanName: clean,
      unaccentedClean,
      tokens,
      unaccentedTokens,
      comp: it.component,
    };
  }

  fastIndexCache.set(items, indexed);
  return indexed;
}

/**
 * Tìm kiếm mờ thông minh danh sách ứng viên tốt nhất (Top Fuzzy Matches) phục vụ Autocomplete trực tiếp trên bảng.
 * Áp dụng chỉ mục đệm trước (FastSearchTargetItem) và thuật toán đa tầng chấm điểm chuẩn hóa tiếng Việt:
 * 1. Khớp mã kỹ thuật (Code exact/prefix)
 * 2. Khớp chuỗi chính xác / Tiền tố cụm từ (Exact phrase / Prefix match - VD: "Băng ép")
 * 3. Khớp chuỗi con đầy đủ (Full Substring match)
 * 4. Khớp toàn bộ tập từ khóa (Full Keyword Intersection - AND logic, thưởng thứ tự từ)
 * 5. Phạt nặng các mục thiếu từ khóa tìm kiếm (tránh trường hợp gõ "Băng ép" mà "Thay băng" lại vượt lên trước)
 * 6. Hỗ trợ gõ không dấu / lỗi gõ bàn phím Telex
 */
export function searchTopFuzzyMatches(
  query: string,
  items: TargetItem[],
  limit: number = 15
): CandidateMatchResult[] {
  if (!items || items.length === 0) return [];
  const rawQ = (query || '').trim().normalize('NFC');
  if (!rawQ) {
    return items.slice(0, limit).map((item) => {
      const comp = item.component || decomposeMedicalProcedure(item.name);
      return {
        item,
        code: item.code,
        name: item.name,
        score: 100,
        anatomy: comp.anatomyList.join(', '),
        specialty: comp.primaryCategory ? ANATOMY_ONTOLOGY[comp.primaryCategory]?.name : undefined,
        matchType: 'EXACT',
      };
    });
  }

  // Tận dụng chỉ mục tìm kiếm siêu tốc (pre-computed index cache)
  const indexedList = getOrCreateFastSearchIndex(items);

  // Chuẩn hóa câu truy vấn: Có dấu, Không dấu, Mở rộng viết tắt
  const lowerQ = rawQ.toLowerCase().normalize('NFC');
  const unaccentedQ = removeVietnameseTones(lowerQ);

  const cleanQ = cleanText(rawQ).toLowerCase().normalize('NFC');
  const unaccentedCleanQ = removeVietnameseTones(cleanQ);

  // Danh sách từ khóa người dùng gõ
  const qTokens = lowerQ.split(/\s+/).filter(Boolean);
  const qCleanTokens = cleanQ.split(/\s+/).filter(Boolean);
  const qUnaccentedTokens = unaccentedQ.split(/\s+/).filter(Boolean);
  const activeTokens = qCleanTokens.length > 0 ? qCleanTokens : qTokens;

  // Lọc nhanh theo từ khóa đầu tiên để tăng tốc tối đa khi dữ liệu lớn (> 10.000 dòng)
  const firstWord = activeTokens[0] || lowerQ;
  const firstUnaccented = qUnaccentedTokens[0] || unaccentedQ;
  const requireFirstWordCheck = firstWord.length >= 3 && activeTokens.length >= 2;

  const scoredResults: {
    item: TargetItem;
    score: number;
    matchType: 'EXACT' | 'PREFIX' | 'SUBSTRING' | 'ALL_WORDS' | 'FUZZY' | 'CODE';
    comp?: MedicalComponent;
  }[] = [];

  for (let i = 0; i < indexedList.length; i++) {
    const entry = indexedList[i];
    const {
      lowerCode,
      lowerName,
      unaccentedName,
      cleanName: targetClean,
      unaccentedClean: unaccentedTargetClean,
      tokens: targetTokens,
      unaccentedTokens: targetUnaccentedTokens,
    } = entry;

    // Tối ưu tốc độ: Bỏ qua các mục hoàn toàn không chứa từ khóa đầu tiên khi truy vấn dài
    if (requireFirstWordCheck) {
      if (
        !lowerName.includes(firstWord) &&
        !unaccentedName.includes(firstUnaccented) &&
        !lowerCode.includes(lowerQ)
      ) {
        continue;
      }
    }

    let score = 0;
    let matchType: 'EXACT' | 'PREFIX' | 'SUBSTRING' | 'ALL_WORDS' | 'FUZZY' | 'CODE' = 'FUZZY';

    // 1. So khớp mã kỹ thuật (Code Match)
    if (lowerCode) {
      if (lowerCode === lowerQ) {
        score = 100;
        matchType = 'CODE';
      } else if (lowerCode.startsWith(lowerQ)) {
        score = 98;
        matchType = 'CODE';
      } else if (lowerCode.includes(lowerQ)) {
        score = 92;
        matchType = 'CODE';
      }
    }

    // 2. So khớp cụm từ chính xác & tiền tố chuỗi (Exact Phrase & Prefix Match)
    if (score < 99) {
      // 2.1 Trùng khớp tuyệt đối
      if (lowerName === lowerQ || targetClean === cleanQ) {
        score = 100;
        matchType = 'EXACT';
      } else if (unaccentedName === unaccentedQ || unaccentedTargetClean === unaccentedCleanQ) {
        score = 99;
        matchType = 'EXACT';
      }
      // 2.2 Tên kỹ thuật BẮT ĐẦU bằng cụm từ tìm kiếm (VD: "Băng ép bất động..." bắt đầu bằng "Băng ép")
      else if (lowerName.startsWith(lowerQ) || targetClean.startsWith(cleanQ)) {
        const lenRatio = cleanQ.length / Math.max(1, targetClean.length);
        score = Math.max(score, 95 + 4 * lenRatio);
        matchType = 'PREFIX';
      } else if (unaccentedName.startsWith(unaccentedQ) || unaccentedTargetClean.startsWith(unaccentedCleanQ)) {
        const lenRatio = unaccentedCleanQ.length / Math.max(1, unaccentedTargetClean.length);
        score = Math.max(score, 93 + 4 * lenRatio);
        matchType = 'PREFIX';
      }
      // 2.3 Tên kỹ thuật CHỨA trọn vẹn cụm từ tìm kiếm (Full Substring)
      else if (lowerName.includes(lowerQ) || targetClean.includes(cleanQ)) {
        const lenRatio = cleanQ.length / Math.max(1, targetClean.length);
        score = Math.max(score, 90 + 5 * lenRatio);
        matchType = 'SUBSTRING';
      } else if (unaccentedName.includes(unaccentedQ) || unaccentedTargetClean.includes(unaccentedCleanQ)) {
        const lenRatio = unaccentedCleanQ.length / Math.max(1, unaccentedTargetClean.length);
        score = Math.max(score, 86 + 5 * lenRatio);
        matchType = 'SUBSTRING';
      }
      // 3. So khớp đa từ khóa (Multi-token Keyword Matching)
      else {
        let matchedQueryWords = 0;
        let lastFoundIndex = -1;
        let inConsecutiveOrder = true;

        for (let t = 0; t < activeTokens.length; t++) {
          const qWord = activeTokens[t];
          const qUnaccentedWord = qUnaccentedTokens[t] || removeVietnameseTones(qWord);

          let foundThisWord = false;
          let foundIndex = -1;

          for (let k = 0; k < targetTokens.length; k++) {
            const tw = targetTokens[k];
            const tuw = targetUnaccentedTokens[k] || '';

            // Khớp chính xác từ hoặc từ mục tiêu bắt đầu bằng từ khóa
            if (tw === qWord || (qWord.length >= 2 && tw.startsWith(qWord))) {
              foundThisWord = true;
              foundIndex = k;
              break;
            }
            if (tuw === qUnaccentedWord || (qUnaccentedWord.length >= 2 && tuw.startsWith(qUnaccentedWord))) {
              foundThisWord = true;
              foundIndex = k;
              break;
            }
          }

          if (foundThisWord) {
            matchedQueryWords++;
            if (foundIndex < lastFoundIndex) {
              inConsecutiveOrder = false;
            }
            lastFoundIndex = foundIndex;
          }
        }

        const coverage = activeTokens.length > 0 ? matchedQueryWords / activeTokens.length : 0;

        if (activeTokens.length >= 2) {
          if (coverage >= 1.0) {
            // Khớp TẤT CẢ các từ người dùng tìm kiếm!
            const orderBonus = inConsecutiveOrder ? 4 : 0;
            const lenRatio = cleanQ.length / Math.max(1, targetClean.length);
            score = Math.max(score, 84 + orderBonus + 4 * lenRatio);
            matchType = 'ALL_WORDS';
          } else if (coverage >= 0.5) {
            // Chỉ khớp MỘT PHẦN từ khóa (VD gõ "băng ép" mà chỉ có "băng")
            // Áp dụng mức điểm trần tối đa 35% để KHÔNG BAO GIỜ chen ngang các mục khớp đầy đủ
            score = Math.max(score, 35 * coverage);
          }
        } else if (activeTokens.length === 1) {
          if (coverage >= 1.0) {
            const lenRatio = cleanQ.length / Math.max(1, targetClean.length);
            score = Math.max(score, 80 + 8 * lenRatio);
            matchType = 'SUBSTRING';
          }
        }

        // 4. Bổ trợ bằng SequenceMatcher khi chuỗi ngắn hoặc có khả năng gõ sai chính tả
        if (score < 40 && cleanQ.length >= 4 && targetClean.length <= cleanQ.length * 2.2) {
          const seq = sequenceMatcherRatio(cleanQ, targetClean);
          if (seq >= 0.6) {
            score = Math.max(score, seq * 50);
          }
        }
      }
    }

    // Lấy những ứng viên có điểm số tiềm năng >= 25% hoặc khớp mã
    if (score >= 25 || matchType === 'CODE') {
      scoredResults.push({
        item: entry.item,
        score: Math.round(score * 10) / 10,
        matchType,
        comp: entry.comp,
      });
    }
  }

  // Sắp xếp giảm dần theo điểm số, nếu bằng điểm thì ưu tiên tên ngắn hơn
  scoredResults.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    return a.item.name.length - b.item.name.length;
  });

  const topResults = scoredResults.slice(0, limit);

  return topResults.map((res) => {
    const comp = res.comp || res.item.component || decomposeMedicalProcedure(res.item.name);
    return {
      item: res.item,
      code: res.item.code,
      name: res.item.name,
      score: res.score,
      anatomy: comp.anatomyList.join(', '),
      specialty: comp.primaryCategory ? ANATOMY_ONTOLOGY[comp.primaryCategory]?.name : undefined,
      matchType: res.matchType,
    };
  });
}

