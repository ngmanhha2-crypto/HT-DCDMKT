import { GoogleGenAI, Type } from '@google/genai';

interface AuditItemRequest {
  stt: number;
  tenGoc: string;
  maGoc?: string;
  tenPL1?: string;
  maPL1?: string;
  tenPL2?: string;
  maPL2?: string;
}

interface AuditItemResponse {
  stt: number;
  hasWarning: boolean;
  warningType: 'MISMATCH_INTERVENTION' | 'MISMATCH_ANATOMY' | 'MISMATCH_SEVERITY' | 'MISMATCH_METHOD' | 'LOW_CONFIDENCE' | 'NONE';
  reason: string;
  severity: 'HIGH' | 'MEDIUM' | 'LOW' | 'SAFE';
  recommendation: string;
  flagTarget: 'PL1' | 'PL2' | 'BOTH' | 'NONE';
}

function evaluateClinicalRulesForItems(items: AuditItemRequest[]): AuditItemResponse[] {
  return items.map((item) => {
    const nameGoc = (item.tenGoc || '').toLowerCase();
    const namePL2 = (item.tenPL2 || '').toLowerCase();
    const namePL1 = (item.tenPL1 || '').toLowerCase();

    // 1. Chăm sóc/vệ sinh vs Phẫu thuật/Mở thông
    const isCareGoc = /(chăm sóc|thay băng|rửa|vệ sinh|băng ép)/i.test(nameGoc);
    const isSurgeryTarget = /(phẫu thuật|mở thông|cắt lọc|khâu|tạo hình|bóc tách)/i.test(namePL2);
    if (isCareGoc && isSurgeryTarget) {
      return {
        stt: item.stt,
        hasWarning: true,
        warningType: 'MISMATCH_INTERVENTION',
        severity: 'HIGH',
        flagTarget: 'PL2',
        reason: 'Lệch bản chất can thiệp: Kỹ thuật gốc là thủ thuật điều dưỡng (chăm sóc/vệ sinh) nhưng Phụ lục 2 lại ghép vào Phẫu thuật/Mở thông xâm lấn.',
        recommendation: 'Cần bỏ ghép PL2 để tránh bị BHXH xuất toán 100% do sai danh mục chuyên môn ngoại khoa.',
      };
    }

    // 2. Chăm sóc/rút sonde vs Phẫu thuật mở thông dạ dày/ruột
    const isSondeCareGoc = /(rút|thay|chăm sóc|đặt).*(sonde|ống thông)/i.test(nameGoc);
    const isOstomyTarget = /(phẫu thuật|mổ).*(mở thông|dạ dày|hỗng tràng|đại tràng)/i.test(namePL2);
    if (isSondeCareGoc && isOstomyTarget) {
      return {
        stt: item.stt,
        hasWarning: true,
        warningType: 'MISMATCH_INTERVENTION',
        severity: 'HIGH',
        flagTarget: 'PL2',
        reason: 'Cảnh báo sai mã nghiêm trọng: Dịch vụ gốc là thủ thuật thông thường về ống thông, Phụ lục 2 lại ghép vào phẫu thuật ngoại khoa mở tạng.',
        recommendation: 'Hủy liên kết PL2 này và tra cứu mã thủ thuật điều dưỡng/đặt ống thông thích hợp.',
      };
    }

    // 3. Thủ thuật can thiệp/điều dưỡng vs Xét nghiệm cận lâm sàng
    const isNursingIntervention = /(đặt|thay|chăm sóc|thông|rút|bơm|thụt|khâu|bó|nẹp|tiêm|truyền)/i.test(nameGoc);
    const isLabTest = /(đo|định lượng|xét nghiệm|sinh hóa|huyết học|khí máu|tổng phân tích)/i.test(namePL2) ||
                       /(đo|định lượng|xét nghiệm|sinh hóa|huyết học|khí máu|tổng phân tích)/i.test(namePL1);
    if (isNursingIntervention && isLabTest) {
      const targetFlag = /(đo|định lượng|xét nghiệm|sinh hóa|huyết học)/i.test(namePL2) ? 'PL2' : 'PL1';
      return {
        stt: item.stt,
        hasWarning: true,
        warningType: 'MISMATCH_INTERVENTION',
        severity: 'HIGH',
        flagTarget: targetFlag as any,
        reason: 'Lệch phân loại: Kỹ thuật gốc là thủ thuật/can thiệp điều dưỡng nhưng dịch vụ đối chiếu lại là Xét nghiệm đo đạc sinh hóa/cận lâm sàng.',
        recommendation: 'Hủy ghép sai nhóm cận lâm sàng và tra cứu danh mục Thủ thuật điều dưỡng.',
      };
    }

    // 4. Lệch phạm vi giải phẫu: Một bên vs Hai bên
    const isOneSideGoc = /(1 bên|một bên|đơn bên|phải|trái)/i.test(nameGoc);
    const isTwoSidesTarget = /(2 bên|hai bên|song phương|toàn thể)/i.test(namePL2) || /(2 bên|hai bên|song phương|toàn thể)/i.test(namePL1);
    if (isOneSideGoc && isTwoSidesTarget) {
      const targetFlag = /(2 bên|hai bên|song phương)/i.test(namePL2) ? 'PL2' : 'PL1';
      return {
        stt: item.stt,
        hasWarning: true,
        warningType: 'MISMATCH_ANATOMY',
        severity: 'HIGH',
        flagTarget: targetFlag as any,
        reason: 'Lệch phạm vi giải phẫu: Kỹ thuật gốc thực hiện 1 bên nhưng danh mục ghép thanh toán quy định cho 2 bên (nguy cơ lạm dụng dịch vụ kỹ thuật).',
        recommendation: 'Kiểm tra lại cơ cấu giá thanh toán BHYT, chỉ áp dụng mã 1 bên hoặc tính hệ số 50% theo quy định.',
      };
    }

    // 5. Nội soi vs Mổ mở
    const isLaparoGoc = /(nội soi|laparoscop|endoscop)/i.test(nameGoc);
    const isOpenSurgeryPL2 = /(mổ mở|phẫu thuật mở)/i.test(namePL2);
    if (isLaparoGoc && isOpenSurgeryPL2) {
      return {
        stt: item.stt,
        hasWarning: true,
        warningType: 'MISMATCH_METHOD',
        severity: 'MEDIUM',
        flagTarget: 'PL2',
        reason: 'Lệch phương pháp: Kỹ thuật gốc là Nội soi nhưng Phụ lục 2 lại chọn phương pháp Mổ mở.',
        recommendation: 'Kiểm tra xem Thông tư có mã phẫu thuật nội soi tương ứng hay áp dụng chung định mức giá.',
      };
    }

    return {
      stt: item.stt,
      hasWarning: false,
      warningType: 'NONE',
      severity: 'SAFE',
      reason: 'Khớp an toàn theo đối chiếu giải phẫu học và phương pháp lâm sàng.',
      recommendation: '',
      flagTarget: 'NONE',
    };
  });
}

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  const { items } = req.body || {};
  if (!Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ error: 'Danh sách items không hợp lệ' });
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    const heuristicResults = evaluateClinicalRulesForItems(items);
    return res.json({
      success: true,
      auditedBy: 'clinical_rule',
      results: heuristicResults,
    });
  }

  try {
    const ai = new GoogleGenAI({ apiKey });
    const prompt = `Bạn là một Chuyên gia Thẩm định Y khoa và Giám định Bảo hiểm Y tế (BHYT) của Bộ Y tế Việt Nam.
Nhiệm vụ của bạn là kiểm tra danh sách các dịch vụ kỹ thuật bệnh viện đã được ghép nối (mapping) với Phụ lục 1 và Phụ lục 2 (theo Thông tư 23/2024/TT-BYT).

ĐẶC BIỆT CHÚ Ý PHÁT HIỆN CÁC LỖI NGUY HIỂM SAU:
1. Lệch bản chất can thiệp lâm sàng: Ví dụ bệnh viện làm thủ thuật chăm sóc/điều dưỡng (thay băng, rút/thay sonde) nhưng ghép sang Phẫu thuật mở tạng, cắt lọc, tạo hình ngoại khoa.
2. Lệch giải phẫu hoặc phương pháp: Một bên vs Hai bên, Nội soi vs Mổ mở, Xét nghiệm vs Thủ thuật.

Dữ liệu cần kiểm tra:
${JSON.stringify(items, null, 2)}

Trả về kết quả chuẩn xác theo schema JSON đã định nghĩa.`;

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            results: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  stt: { type: Type.INTEGER },
                  hasWarning: { type: Type.BOOLEAN },
                  warningType: {
                    type: Type.STRING,
                    enum: [
                      'MISMATCH_INTERVENTION',
                      'MISMATCH_ANATOMY',
                      'MISMATCH_SEVERITY',
                      'MISMATCH_METHOD',
                      'LOW_CONFIDENCE',
                      'NONE',
                    ],
                  },
                  reason: { type: Type.STRING },
                  severity: {
                    type: Type.STRING,
                    enum: ['HIGH', 'MEDIUM', 'LOW', 'SAFE'],
                  },
                  recommendation: { type: Type.STRING },
                  flagTarget: {
                    type: Type.STRING,
                    enum: ['PL1', 'PL2', 'BOTH', 'NONE'],
                  },
                },
                required: ['stt', 'hasWarning', 'warningType', 'reason', 'severity', 'recommendation', 'flagTarget'],
              },
            },
          },
          required: ['results'],
        },
      },
    });

    const parsed = JSON.parse(response.text || '{}');
    return res.json({
      success: true,
      auditedBy: 'gemini',
      results: parsed.results || [],
    });
  } catch (error: any) {
    console.warn('Vercel Gemini API call failed, falling back to clinical heuristics:', error.message);
    const fallbackResults = evaluateClinicalRulesForItems(items);
    return res.json({
      success: true,
      auditedBy: 'clinical_rule',
      results: fallbackResults,
    });
  }
}
