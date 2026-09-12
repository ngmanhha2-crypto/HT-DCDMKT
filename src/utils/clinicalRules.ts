import { MappingResult, AiAuditInfo, ClinicalAuditDetail } from '../types';
import {
  decomposeMedicalProcedure,
  evaluateAnatomyCompatibility,
  evaluateActionModalityCompatibility,
  ACTION_MODALITY_INFO,
  ANATOMY_ONTOLOGY,
} from './anatomyMatcher';

/**
 * Cấu trúc kết quả phân tích thẩm định mâu thuẫn chuyên môn lâm sàng
 */
export interface ClinicalDiscrepancyCheckResult {
  hasWarning: boolean;
  reason?: string;
  severity?: 'HIGH' | 'MEDIUM' | 'LOW';
  warningType?: AiAuditInfo['warningType'];
  details?: ClinicalAuditDetail[];
  legalBasis?: string;
  recommendation?: string;
}

/**
 * Định nghĩa mẫu quy tắc thẩm định chuyên sâu (Clinical Discrepancy Rule Pattern)
 */
interface DiscrepancyPattern {
  name: string;
  detect: (goc: string, target: string) => {
    hasConflict: boolean;
    reason?: string;
    warningType?: AiAuditInfo['warningType'];
    severity?: 'HIGH' | 'MEDIUM' | 'LOW';
    detail?: ClinicalAuditDetail;
    legalBasis?: string;
    recommendation?: string;
  };
}

/**
 * Danh mục quy tắc thẩm định lâm sàng & giám định BHYT nâng cao
 */
const DISCREPANCY_PATTERNS: DiscrepancyPattern[] = [
  // 1. RÀO CHẮN BẢN CHẤT HÀNH ĐỘNG LÂM SÀNG (ACTION MODALITY)
  {
    name: 'ACTION_MODALITY_BARRIER',
    detect: (goc, target) => {
      const compGoc = decomposeMedicalProcedure(goc);
      const compTarget = decomposeMedicalProcedure(target);
      const modalityRes = evaluateActionModalityCompatibility(compGoc, compTarget);

      if (modalityRes.status === 'MODALITY_CONFLICT') {
        const mGocName = compGoc.primaryModality ? ACTION_MODALITY_INFO[compGoc.primaryModality]?.name : 'Chưa phân nhóm';
        const mTarName = compTarget.primaryModality ? ACTION_MODALITY_INFO[compTarget.primaryModality]?.name : 'Chưa phân nhóm';

        return {
          hasConflict: true,
          reason: `Xung đột bản chất can thiệp: Kỹ thuật gốc thuộc nhóm [${mGocName}], trong khi kỹ thuật đối chiếu thuộc nhóm [${mTarName}].`,
          warningType: 'MISMATCH_INTERVENTION',
          severity: 'HIGH',
          detail: {
            conflictType: 'Bản chất kỹ thuật lâm sàng (Action Modality)',
            sourceFeature: `[${mGocName}] (${compGoc.coreTarget || goc})`,
            targetFeature: `[${mTarName}] (${compTarget.coreTarget || target})`,
            clinicalImpact: 'Khác biệt hoàn toàn về quy trình kỹ thuật, nhân lực thực hiện và tính chất xâm lấn lâm sàng.',
            insuranceRisk: 'Nguy cơ xuất toán 100% do sai lệch bản chất danh mục dịch vụ kỹ thuật thanh toán BHYT.',
          },
          legalBasis: 'Thông tư quy định danh mục kỹ thuật và định mức kinh tế kỹ thuật của Bộ Y tế',
          recommendation: 'Không được áp mã đối chiếu này. Cần tìm dịch vụ có cùng nhóm hành động lâm sàng.',
        };
      }
      return { hasConflict: false };
    },
  },

  // 2. RÀO CHẮN HỆ CƠ QUAN / VỊ TRÍ GIẢI PHẪU ĐÍCH (ANATOMY & ORGAN SYSTEM)
  {
    name: 'ANATOMY_ORGAN_BARRIER',
    detect: (goc, target) => {
      const compGoc = decomposeMedicalProcedure(goc);
      const compTarget = decomposeMedicalProcedure(target);
      const anatRes = evaluateAnatomyCompatibility(compGoc, compTarget);

      if (anatRes.status === 'SEVERE_CONFLICT') {
        const catGocName = compGoc.primaryCategory ? ANATOMY_ONTOLOGY[compGoc.primaryCategory]?.name : compGoc.anatomyList.join(', ');
        const catTarName = compTarget.primaryCategory ? ANATOMY_ONTOLOGY[compTarget.primaryCategory]?.name : compTarget.anatomyList.join(', ');

        return {
          hasConflict: true,
          reason: `Xung đột cơ quan / chuyên khoa đích: Kỹ thuật gốc tác động lên [${catGocName}], nhưng đối chiếu lại ghép sang [${catTarName}].`,
          warningType: 'MISMATCH_ANATOMY',
          severity: 'HIGH',
          detail: {
            conflictType: 'Vị trí giải phẫu & Cơ quan đích',
            sourceFeature: `Cơ quan: ${catGocName} (${compGoc.anatomyList.join(', ') || 'Chưa định danh'})`,
            targetFeature: `Cơ quan: ${catTarName} (${compTarget.anatomyList.join(', ') || 'Chưa định danh'})`,
            clinicalImpact: 'Vị trí can thiệp cơ thể hoàn toàn khác nhau, sai lệch hồ sơ bệnh án và chẩn đoán điều trị.',
            insuranceRisk: 'Cơ quan BHXH sẽ từ chối thanh toán do mã kỹ thuật không phù hợp với chẩn đoán ICD-10 của bệnh nhân.',
          },
          legalBasis: 'Quy chế chuyên môn khám chữa bệnh và bảng danh mục vị trí giải phẫu BHYT',
          recommendation: 'Hủy liên kết này và tìm kiếm kỹ thuật thuộc đúng phân hệ cơ quan giải phẫu tương ứng.',
        };
      }
      return { hasConflict: false };
    },
  },

  // 3. CHĂM SÓC / ĐIỀU DƯỠNG VS PHẪU THUẬT XÂM LẤN NGOẠI KHOA
  {
    name: 'CARE_VS_SURGERY',
    detect: (goc, target) => {
      const g = goc.toLowerCase();
      const t = target.toLowerCase();
      const isGocCare = /\b(chăm sóc|cham soc|thay băng|thay bang|vệ sinh|ve sinh|rút ống|thay ống|bơm rửa|hút đờm)\b/.test(g);
      const isTargetSurgery = /\b(mở thông|mo thong|phẫu thuật|phau thuat|cắt lọc|cắt bỏ|cat bo|đốt|khoét|bóc u|tạo hình|khâu phục hồi|đặt sonde dạ dày)\b/.test(t);

      if (isGocCare && isTargetSurgery && !/\b(chăm sóc|cham soc)\b/.test(t)) {
        return {
          hasConflict: true,
          reason: `Khác biệt phân cấp can thiệp: Kỹ thuật gốc là 'Chăm sóc / Điều dưỡng' nhưng kỹ thuật đối chiếu là 'Phẫu thuật / Can thiệp ngoại khoa'.`,
          warningType: 'MISMATCH_INTERVENTION',
          severity: 'HIGH',
          detail: {
            conflictType: 'Phân cấp nhân lực thực hiện (Điều dưỡng vs Bác sĩ ngoại khoa)',
            sourceFeature: 'Nhiệm vụ chăm sóc / thủ thuật điều dưỡng viên',
            targetFeature: 'Phẫu thuật / thủ thuật xâm lấn do Phẫu thuật viên đảm nhiệm',
            clinicalImpact: 'Khác biệt về định mức nhân lực (bác sĩ phẫu thuật chính vs điều dưỡng) và môi trường phòng mổ.',
            insuranceRisk: 'Xuất toán chi phí phẫu thuật do bệnh án không có biên bản phẫu thuật / thủ thuật tương ứng.',
          },
          recommendation: 'Chọn mã dịch vụ chăm sóc / thủ thuật điều dưỡng tương đương trong Phụ lục BHYT.',
        };
      }

      const isTargetCare = /\b(chăm sóc|cham soc|thay băng|thay bang|rút ống|thay ống)\b/.test(t);
      const isGocSurgery = /\b(mở thông|mo thong|phẫu thuật|phau thuat|cắt bỏ|đốt|bóc u)\b/.test(g);
      if (isGocSurgery && isTargetCare && !/\b(mở thông|phẫu thuật|cắt)\b/.test(t)) {
        return {
          hasConflict: true,
          reason: `Khác biệt phân cấp can thiệp: Kỹ thuật gốc là 'Phẫu thuật / Xâm lấn' nhưng kỹ thuật đối chiếu lại là 'Chăm sóc / Điều dưỡng'.`,
          warningType: 'MISMATCH_INTERVENTION',
          severity: 'HIGH',
          detail: {
            conflictType: 'Phân cấp nhân lực thực hiện (Ngoại khoa vs Điều dưỡng)',
            sourceFeature: 'Phẫu thuật xâm lấn ngoại khoa',
            targetFeature: 'Thủ thuật chăm sóc điều dưỡng',
            clinicalImpact: 'Bệnh viện bị thất thu chi phí phẫu thuật do áp sang mã chăm sóc có giá thanh toán thấp hơn nhiều.',
            insuranceRisk: 'Hạ bậc kỹ thuật không đúng với công sức thực tế của kíp phẫu thuật.',
          },
          recommendation: 'Rà soát danh mục Phẫu thuật loại I, II, III hoặc Đặc biệt để ghép đúng mã.',
        };
      }

      return { hasConflict: false };
    },
  },

  // 4. ỐNG THÔNG (CATHETER) VS MỞ THÔNG NGOẠI KHOA (OSTOMY/STOMA)
  {
    name: 'CATHETER_VS_STOMA',
    detect: (goc, target) => {
      const g = goc.toLowerCase();
      const t = target.toLowerCase();
      if (g.includes('ống thông') && t.includes('mở thông') && !g.includes('mở thông')) {
        return {
          hasConflict: true,
          reason: `Khác biệt kỹ thuật: Kỹ thuật gốc liên quan đến 'Ống thông' (Catheter) nhưng đối chiếu là 'Mở thông' (Phẫu thuật ngoại khoa tạo lỗ rò).`,
          warningType: 'MISMATCH_METHOD',
          severity: 'HIGH',
          detail: {
            conflictType: 'Phương pháp can thiệp (Đặt ống vs Phẫu thuật mở lỗ rò)',
            sourceFeature: 'Đặt / rút ống thông (Catheter/Sonde qua đường tự nhiên hoặc chọc)',
            targetFeature: 'Phẫu thuật mở thông cơ quan (Stoma/Ostomy qua thành bụng)',
            clinicalImpact: 'Mở thông là phẫu thuật tạo đường rò vĩnh viễn hoặc tạm thời, đòi hỏi vô cảm và phẫu trường phức tạp.',
            insuranceRisk: 'Chênh lệch chi phí rất lớn, dễ bị thanh tra BHYT xuất toán vì không có tổn thương mở thông trên thực tế.',
          },
          recommendation: 'Phân định rõ đặt ống thông (catheter) hay phẫu thuật mở thông (ostomy) trước khi phê duyệt.',
        };
      }
      return { hasConflict: false };
    },
  },

  // 5. SAI LỆCH LOẠI MẪU BỆNH PHẨM XÉT NGHIỆM (SPECIMEN MISMATCH)
  {
    name: 'SPECIMEN_MISMATCH',
    detect: (goc, target) => {
      const g = goc.toLowerCase();
      const t = target.toLowerCase();

      const specimens = [
        { key: 'máu', label: 'Máu / Huyết thanh', regex: /\b(máu|huyết thanh|huyết tương|mau|huyet thanh)\b/ },
        { key: 'nước tiểu', label: 'Nước tiểu', regex: /\b(nước tiểu|nuoc tieu|niệu)\b/ },
        { key: 'dịch não tủy', label: 'Dịch não tủy', regex: /\b(dịch não tủy|dich nao tuy)\b/ },
        { key: 'đờm', label: 'Đờm / Dịch phế quản', regex: /\b(đờm|dom|dịch phế quản|dịch khí quản)\b/ },
        { key: 'phân', label: 'Phân', regex: /\b(phân|phan)\b/ },
        { key: 'dịch màng', label: 'Dịch màng phổi / Màng bụng', regex: /\b(dịch màng phổi|dịch màng bụng|dịch cổ trướng)\b/ },
      ];

      let gocSpecimen = '';
      let targetSpecimen = '';

      for (const sp of specimens) {
        if (sp.regex.test(g) && !gocSpecimen) gocSpecimen = sp.label;
        if (sp.regex.test(t) && !targetSpecimen) targetSpecimen = sp.label;
      }

      if (gocSpecimen && targetSpecimen && gocSpecimen !== targetSpecimen) {
        return {
          hasConflict: true,
          reason: `Sai lệch loại mẫu bệnh phẩm: Kỹ thuật gốc xét nghiệm trên [${gocSpecimen}] nhưng đối chiếu là mẫu [${targetSpecimen}].`,
          warningType: 'MISMATCH_SPECIMEN',
          severity: 'HIGH',
          detail: {
            conflictType: 'Loại mẫu bệnh phẩm xét nghiệm (Specimen Type)',
            sourceFeature: `Bệnh phẩm chỉ định: ${gocSpecimen}`,
            targetFeature: `Bệnh phẩm danh mục đối chiếu: ${targetSpecimen}`,
            clinicalImpact: 'Quy trình thu thập, chất bảo quản, hóa chất thử nghiệm và giá trị tham chiếu sinh học hoàn toàn khác nhau.',
            insuranceRisk: 'Hệ thống giám định BHYT tự động bắt lỗi không có kết quả xét nghiệm đúng loại mẫu bệnh phẩm trong phiếu trả kết quả.',
          },
          legalBasis: 'Quy định quản lý chất lượng xét nghiệm và danh mục định mức hóa chất xét nghiệm BHYT',
          recommendation: 'Chọn đúng mã xét nghiệm tương ứng với mẫu bệnh phẩm thực tế của người bệnh.',
        };
      }

      return { hasConflict: false };
    },
  },

  // 6. PHƯƠNG PHÁP NGOẠI KHOA: NỘI SOI VS MỔ MỞ (ENDOSCOPY VS OPEN SURGERY)
  {
    name: 'ENDOSCOPY_VS_OPEN',
    detect: (goc, target) => {
      const g = goc.toLowerCase();
      const t = target.toLowerCase();
      const isGocLaparoscopy = /\b(nội soi|noi soi)\b/.test(g);
      const isTargetLaparoscopy = /\b(nội soi|noi soi)\b/.test(t);
      const isTargetOpen = /\b(mổ mở|mo mo|mở|phẫu thuật mở)\b/.test(t) && !isTargetLaparoscopy;
      const isGocOpen = /\b(mổ mở|mo mo|phẫu thuật mở)\b/.test(g) && !isGocLaparoscopy;

      if (isGocLaparoscopy && isTargetOpen) {
        return {
          hasConflict: true,
          reason: `Khác biệt phương pháp mổ: Kỹ thuật gốc là 'Nội soi' nhưng đối chiếu là 'Mổ mở'.`,
          warningType: 'MISMATCH_METHOD',
          severity: 'HIGH',
          detail: {
            conflictType: 'Đường mổ & Phương pháp phẫu thuật (Nội soi vs Mổ mở)',
            sourceFeature: 'Phẫu thuật nội soi (ít xâm lấn, sử dụng dàn máy nội soi và vật tư tiêu hao nội soi)',
            targetFeature: 'Phẫu thuật mổ mở truyền thống',
            clinicalImpact: 'Khác biệt lớn về thời gian nằm viện, vật tư tiêu hao chuyên dụng (trocar, clip, chỉ khâu nội soi).',
            insuranceRisk: 'BHYT quy định giá phẫu thuật nội soi riêng biệt; áp nhầm mổ mở sẽ bị từ chối thanh toán vật tư nội soi.',
          },
          legalBasis: 'Thông tư quy định định mức kinh tế kỹ thuật chuyên ngành Ngoại khoa',
          recommendation: 'Tìm kiếm chính xác kỹ thuật phẫu thuật nội soi trong Phụ lục BHYT.',
        };
      }

      if (isGocOpen && isTargetLaparoscopy) {
        return {
          hasConflict: true,
          reason: `Khác biệt phương pháp mổ: Kỹ thuật gốc là 'Mổ mở' nhưng đối chiếu là 'Nội soi'.`,
          warningType: 'MISMATCH_METHOD',
          severity: 'HIGH',
          detail: {
            conflictType: 'Đường mổ & Phương pháp phẫu thuật (Mổ mở vs Nội soi)',
            sourceFeature: 'Phẫu thuật mổ hở truyền thống',
            targetFeature: 'Phẫu thuật nội soi',
            clinicalImpact: 'Thực tế không sử dụng dàn máy nội soi nhưng lại áp mã dịch vụ nội soi.',
            insuranceRisk: 'Xuất toán toàn bộ chi phí sử dụng dàn máy và vật tư nội soi do hồ sơ bệnh án không ghi nhận phẫu thuật nội soi.',
          },
          recommendation: 'Chuyển sang mã phẫu thuật mổ mở tương ứng.',
        };
      }

      return { hasConflict: false };
    },
  },

  // 7. MỨC ĐỘ BIẾN CHỨNG & ĐỘ PHỨC TẠP LÂM SÀNG
  {
    name: 'SEVERITY_COMPLICATION',
    detect: (goc, target) => {
      const g = goc.toLowerCase();
      const t = target.toLowerCase();
      const gocHasComplication = /\b(có biến chứng|co bien chung|phức tạp|phuc tap|tái phát|nhiễm trùng)\b/.test(g);
      const targetHasComplication = /\b(có biến chứng|co bien chung|phức tạp|phuc tap|tái phát)\b/.test(t);
      const targetIsSimple = /\b(không biến chứng|khong bien chung|đơn thuần|don thuan)\b/.test(t);

      if (gocHasComplication && targetIsSimple) {
        return {
          hasConflict: true,
          reason: `Khác biệt mức độ lâm sàng: Kỹ thuật gốc là 'Có biến chứng / Phức tạp' nhưng đối chiếu là 'Đơn thuần / Không biến chứng'.`,
          warningType: 'MISMATCH_SEVERITY',
          severity: 'MEDIUM',
          detail: {
            conflictType: 'Mức độ biến chứng & phân độ phức tạp',
            sourceFeature: 'Ca bệnh có biến chứng / diễn biến phức tạp / tái phát',
            targetFeature: 'Quy trình xử trí đơn thuần / không có biến chứng',
            clinicalImpact: 'Định mức thời gian, nhân lực và nguy cơ tai biến trong phẫu thuật/thủ thuật chênh lệch đáng kể.',
            insuranceRisk: 'Ảnh hưởng đến mức giá thanh toán và tính hợp lý trong định suất BHYT.',
          },
          recommendation: 'Kiểm tra danh mục để áp mã có phân loại mức độ biến chứng phù hợp với chẩn đoán bệnh án.',
        };
      }

      if (gocHasComplication && !targetHasComplication && t.length > 0) {
        return {
          hasConflict: true,
          reason: `Lưu ý mức độ: Kỹ thuật gốc có điều kiện 'Có biến chứng' nhưng danh mục đối chiếu không phân định biến chứng.`,
          warningType: 'MISMATCH_SEVERITY',
          severity: 'LOW',
          detail: {
            conflictType: 'Ghi chú điều kiện biến chứng',
            sourceFeature: 'Chỉ định kỹ thuật có biến chứng',
            targetFeature: 'Kỹ thuật dùng chung trong Thông tư',
            clinicalImpact: 'Cần ghi chú rõ tình trạng biến chứng trong tóm tắt hồ sơ bệnh án để bảo vệ quyền lợi thanh toán.',
            insuranceRisk: 'Rủi ro thấp nhưng cần lưu ý đối chiếu chẩn đoán ICD-10.',
          },
        };
      }

      return { hasConflict: false };
    },
  },

  // 8. PHẠM VI GIẢI PHẪU: MỘT BÊN VS HAI BÊN (LATERALITY)
  {
    name: 'LATERALITY_ONE_VS_BOTH',
    detect: (goc, target) => {
      const g = goc.toLowerCase();
      const t = target.toLowerCase();
      const isGocOneSide = /\b(một bên|1 bên|mot ben)\b/.test(g);
      const isTargetBothSides = /\b(hai bên|2 bên|cả hai bên)\b/.test(t);
      const isGocBothSides = /\b(hai bên|2 bên|cả hai bên)\b/.test(g);
      const isTargetOneSide = /\b(một bên|1 bên|mot ben)\b/.test(t);

      if (isGocOneSide && isTargetBothSides) {
        return {
          hasConflict: true,
          reason: `Khác biệt phạm vi: Kỹ thuật gốc là 'Một bên' nhưng đối chiếu là 'Hai bên'.`,
          warningType: 'MISMATCH_ANATOMY',
          severity: 'HIGH',
          detail: {
            conflictType: 'Phạm vi giải phẫu đối xứng (1 bên vs 2 bên)',
            sourceFeature: 'Can thiệp một bên cơ thể (mắt, tai, chi, thận...)',
            targetFeature: 'Định mức kỹ thuật thực hiện hai bên',
            clinicalImpact: 'Khối lượng can thiệp thực tế chỉ bằng 1/2 so với danh mục đối chiếu.',
            insuranceRisk: 'Xuất toán do áp mã thanh toán 2 bên cho dịch vụ thực tế chỉ làm 1 bên (lỗi nghiêm trọng trong giám định BHYT).',
          },
          recommendation: 'Chọn mã dịch vụ thực hiện một bên để đúng định mức thanh toán.',
        };
      }

      if (isGocBothSides && isTargetOneSide) {
        return {
          hasConflict: true,
          reason: `Khác biệt phạm vi: Kỹ thuật gốc là 'Hai bên' nhưng đối chiếu chỉ là 'Một bên'.`,
          warningType: 'MISMATCH_ANATOMY',
          severity: 'MEDIUM',
          detail: {
            conflictType: 'Phạm vi giải phẫu đối xứng (2 bên vs 1 bên)',
            sourceFeature: 'Can thiệp cả hai bên cơ thể',
            targetFeature: 'Định mức kỹ thuật một bên',
            clinicalImpact: 'Bệnh viện có thể bị thiếu hụt doanh thu nếu quy chế BHYT cho phép tính 2 lần hoặc áp mã hai bên.',
            insuranceRisk: 'Cần kiểm tra quy tắc nhân hệ số 1.5x hoặc kê khai số lượng 2 theo hướng dẫn của BHXH.',
          },
          recommendation: 'Kiểm tra xem danh mục có mã riêng cho hai bên hay nhân hệ số theo quy định BHYT.',
        };
      }

      return { hasConflict: false };
    },
  },

  // 9. TẦN SUẤT / ĐỊNH MỨC TÍNH GIÁ: MỘT LẦN VS NHIỀU LẦN / THEO ĐỢT
  {
    name: 'FREQUENCY_ONCE_VS_SERIES',
    detect: (goc, target) => {
      const g = goc.toLowerCase();
      const t = target.toLowerCase();
      const isGocOnce = /\b(một lần|1 lần|mot lan)\b/.test(g);
      const isTargetSeries = /\b(nhiều lần|đợt|theo đợt)\b/.test(t);

      if (isGocOnce && isTargetSeries) {
        return {
          hasConflict: true,
          reason: `Khác biệt tần suất tính giá: Kỹ thuật gốc là 'Một lần' nhưng đối chiếu tính theo 'Nhiều lần / Theo đợt'.`,
          warningType: 'MISMATCH_METHOD',
          severity: 'HIGH',
          detail: {
            conflictType: 'Đơn vị tính & Chu kỳ thanh toán',
            sourceFeature: 'Thực hiện đơn lẻ 1 lần',
            targetFeature: 'Gói liệu trình nhiều lần / theo đợt điều trị',
            clinicalImpact: 'Dịch vụ trọn gói đợt yêu cầu theo dõi liệu trình hoàn chỉnh, không thể tính lẻ từng buổi.',
            insuranceRisk: 'Cơ quan BHXH sẽ xuất toán nếu cơ sở y tế thanh toán mã theo đợt cho chỉ 1 buổi thực hiện.',
          },
          recommendation: 'Xác định rõ đơn vị tính là "Lần" hay "Đợt" để áp đúng mã giá.',
        };
      }

      return { hasConflict: false };
    },
  },

  // 10. KỸ THUẬT HƯỚNG DẪN HÌNH ẢNH (IMAGE-GUIDED VS BLIND/CONVENTIONAL)
  {
    name: 'IMAGE_GUIDED_BARRIER',
    detect: (goc, target) => {
      const g = goc.toLowerCase();
      const t = target.toLowerCase();
      const isGocGuided = /\b(dưới hướng dẫn của siêu âm|dưới hướng dẫn siêu âm|dưới c arm|dưới clvt|dưới hướng dẫn ct)\b/.test(g);
      const isTargetGuided = /\b(dưới hướng dẫn của siêu âm|dưới hướng dẫn siêu âm|dưới c arm|dưới clvt|dưới hướng dẫn ct)\b/.test(t);

      if (isGocGuided && !isTargetGuided && t.length > 0) {
        return {
          hasConflict: true,
          reason: `Lưu ý kỹ thuật dẫn đường: Kỹ thuật gốc thực hiện 'Dưới hướng dẫn hình ảnh (Siêu âm/CT/C-arm)' nhưng đối chiếu không có.`,
          warningType: 'MISMATCH_METHOD',
          severity: 'MEDIUM',
          detail: {
            conflictType: 'Kỹ thuật dẫn đường hình ảnh (Image Guidance)',
            sourceFeature: 'Thực hiện dưới màn hình siêu âm, CT hoặc C-arm',
            targetFeature: 'Kỹ thuật thường quy không có định mức máy chẩn đoán hình ảnh',
            clinicalImpact: 'Đòi hỏi sự tham gia của bác sĩ chẩn đoán hình ảnh và tiêu hao năng lượng thiết bị máy móc.',
            insuranceRisk: 'Nếu áp mã thường quy, bệnh viện không được thanh toán chi phí phụ thu máy siêu âm / C-arm đi kèm.',
          },
          recommendation: 'Rà soát xem có mã chuyên biệt có định ngữ "dưới hướng dẫn của siêu âm/C-arm" hay không.',
        };
      }

      if (!isGocGuided && isTargetGuided) {
        return {
          hasConflict: true,
          reason: `Khác biệt kỹ thuật: Kỹ thuật gốc không yêu cầu hướng dẫn hình ảnh nhưng đối chiếu lại là 'Dưới hướng dẫn siêu âm/C-arm'.`,
          warningType: 'MISMATCH_METHOD',
          severity: 'HIGH',
          detail: {
            conflictType: 'Kỹ thuật dẫn đường hình ảnh (Image Guidance)',
            sourceFeature: 'Kỹ thuật lâm sàng thông thường',
            targetFeature: 'Kỹ thuật chuyên sâu dưới hướng dẫn của siêu âm/C-arm',
            clinicalImpact: 'Hồ sơ bệnh án không có hình ảnh lưu trữ từ máy siêu âm/C-arm để chứng minh.',
            insuranceRisk: 'Xuất toán toàn bộ tiền công và vật tư dẫn đường hình ảnh khi hậu kiểm hồ sơ bệnh án.',
          },
          recommendation: 'Chuyển về mã kỹ thuật thường quy không có hướng dẫn hình ảnh.',
        };
      }

      return { hasConflict: false };
    },
  },
];

/**
 * Kiểm tra mâu thuẫn chuyên môn lâm sàng giữa Tên Gốc và Phụ Lục (PL1 hoặc PL2)
 * Trả về báo cáo giải trình minh bạch chi tiết cho Bác sĩ và Cán bộ thẩm định BHYT
 */
export function checkClinicalDiscrepancy(
  tenGoc: string,
  targetName: string,
  score: number
): ClinicalDiscrepancyCheckResult {
  if (!targetName || !tenGoc) {
    return { hasWarning: false };
  }

  // Nếu tên hoàn toàn giống nhau 100% -> Tuyệt đối an toàn
  if (tenGoc.trim().toLowerCase() === targetName.trim().toLowerCase()) {
    return { hasWarning: false };
  }

  const collectedDetails: ClinicalAuditDetail[] = [];
  let highestSeverity: 'HIGH' | 'MEDIUM' | 'LOW' = 'LOW';
  let primaryReason = '';
  let primaryWarningType: AiAuditInfo['warningType'] = 'NONE';
  let primaryLegalBasis = '';
  let primaryRecommendation = '';

  // Quét qua toàn bộ danh mục quy tắc thẩm định lâm sàng
  for (const pattern of DISCREPANCY_PATTERNS) {
    const res = pattern.detect(tenGoc, targetName);
    if (res.hasConflict) {
      if (!primaryReason) {
        primaryReason = res.reason || '';
        primaryWarningType = res.warningType || 'MISMATCH_INTERVENTION';
        primaryLegalBasis = res.legalBasis || '';
        primaryRecommendation = res.recommendation || '';
      }

      if (res.severity === 'HIGH') {
        highestSeverity = 'HIGH';
      } else if (res.severity === 'MEDIUM' && highestSeverity !== 'HIGH') {
        highestSeverity = 'MEDIUM';
      }

      if (res.detail) {
        collectedDetails.push(res.detail);
      }
    }
  }

  if (collectedDetails.length > 0) {
    return {
      hasWarning: true,
      reason: primaryReason,
      severity: highestSeverity,
      warningType: primaryWarningType,
      details: collectedDetails,
      legalBasis: primaryLegalBasis || 'Thông tư quy định danh mục kỹ thuật và giá dịch vụ khám bệnh, chữa bệnh BHYT',
      recommendation: primaryRecommendation || 'Kiểm tra lại bản chất can thiệp kỹ thuật trước khi phê duyệt áp mã tương đương.',
    };
  }

  // Cảnh báo nếu điểm số mấp mé ngưỡng (dưới 78%)
  if (score > 0 && score < 78) {
    return {
      hasWarning: true,
      reason: `Độ tương đồng chuỗi ở mức vừa phải (${score}%). Cần bác sĩ/chuyên viên rà soát đối chiếu kỹ trước khi áp mã BHYT.`,
      severity: 'LOW',
      warningType: 'LOW_CONFIDENCE',
      details: [
        {
          conflictType: 'Độ tin cậy tương đồng (Fuzzy Confidence Score)',
          sourceFeature: tenGoc,
          targetFeature: targetName,
          clinicalImpact: 'Tên hai kỹ thuật có sự khác biệt từ ngữ đáng kể, cần rà soát kỹ quy trình chuyên môn tương ứng.',
          insuranceRisk: 'Cần có giải trình chuyên môn rõ ràng nếu cơ quan BHXH yêu cầu đối chiếu danh mục kỹ thuật bệnh viện.',
        },
      ],
      legalBasis: 'Quy chế đối chiếu và chuẩn hóa danh mục kỹ thuật tại cơ sở khám bệnh, chữa bệnh',
      recommendation: 'Xem xét đối chiếu thủ công hoặc tìm tên dịch vụ có độ tương thích cao hơn.',
    };
  }

  return { hasWarning: false };
}

/**
 * Thẩm định toàn diện 1 dòng kết quả mapping (kết hợp cả PL1 và PL2)
 * Cung cấp đầy đủ báo cáo giải trình minh bạch cho Bác sĩ & Cán bộ BHYT
 */
export function auditMappingRowWithRules(row: MappingResult): AiAuditInfo {
  const pl1Check = checkClinicalDiscrepancy(row.tenGoc, row.tenPL1, row.scorePL1);
  const pl2Check = checkClinicalDiscrepancy(row.tenGoc, row.tenPL2, row.scorePL2);

  const reasons: string[] = [];
  const allDetails: ClinicalAuditDetail[] = [];
  let severity: 'HIGH' | 'MEDIUM' | 'LOW' | 'SAFE' = 'SAFE';
  let flagTarget: 'PL1' | 'PL2' | 'BOTH' | 'NONE' = 'NONE';
  let warningType: AiAuditInfo['warningType'] = 'NONE';
  let legalBasis = '';
  let recommendation = '';

  if (pl1Check.hasWarning && pl2Check.hasWarning) {
    flagTarget = 'BOTH';
    reasons.push(`[PL1]: ${pl1Check.reason}`);
    reasons.push(`[PL2]: ${pl2Check.reason}`);
    severity = pl1Check.severity === 'HIGH' || pl2Check.severity === 'HIGH' ? 'HIGH' : 'MEDIUM';
    warningType = pl1Check.warningType || pl2Check.warningType || 'MISMATCH_INTERVENTION';
    if (pl1Check.details) allDetails.push(...pl1Check.details);
    if (pl2Check.details) allDetails.push(...pl2Check.details);
    legalBasis = pl1Check.legalBasis || pl2Check.legalBasis || '';
    recommendation = pl1Check.recommendation || pl2Check.recommendation || '';
  } else if (pl1Check.hasWarning) {
    flagTarget = 'PL1';
    reasons.push(`[PL1]: ${pl1Check.reason}`);
    severity = pl1Check.severity || 'MEDIUM';
    warningType = pl1Check.warningType || 'MISMATCH_INTERVENTION';
    if (pl1Check.details) allDetails.push(...pl1Check.details);
    legalBasis = pl1Check.legalBasis || '';
    recommendation = pl1Check.recommendation || '';
  } else if (pl2Check.hasWarning) {
    flagTarget = 'PL2';
    reasons.push(`[PL2]: ${pl2Check.reason}`);
    severity = pl2Check.severity || 'MEDIUM';
    warningType = pl2Check.warningType || 'MISMATCH_INTERVENTION';
    if (pl2Check.details) allDetails.push(...pl2Check.details);
    legalBasis = pl2Check.legalBasis || '';
    recommendation = pl2Check.recommendation || '';
  }

  if (reasons.length > 0) {
    return {
      hasWarning: true,
      warningType,
      reason: reasons.join(' | '),
      severity,
      recommendation: recommendation || 'Kiểm tra lại bản chất can thiệp kỹ thuật trước khi phê duyệt áp mã tương đương.',
      flagTarget,
      auditedBy: 'clinical_rule',
      details: allDetails.length > 0 ? allDetails : undefined,
      legalBasis: legalBasis || 'Thông tư quy định danh mục kỹ thuật và thanh toán BHYT',
    };
  }

  return {
    hasWarning: false,
    warningType: 'NONE',
    severity: 'SAFE',
    flagTarget: 'NONE',
    auditedBy: 'clinical_rule',
  };
}
