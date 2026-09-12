import express from 'express';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import { GoogleGenAI, Type } from '@google/genai';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
const PORT = 3000;

app.use(express.json({ limit: '10mb' }));

// Lazy getter cho Gemini AI client
let geminiClient: GoogleGenAI | null = null;
function getGemini(): GoogleGenAI {
  if (!geminiClient) {
    geminiClient = new GoogleGenAI({
      apiKey: process.env.GEMINI_API_KEY,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        },
      },
    });
  }
  return geminiClient;
}

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    hasApiKey: Boolean(process.env.GEMINI_API_KEY),
  });
});

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

/**
 * Bộ thẩm định lâm sàng chuyên sâu (Clinical Heuristics)
 * Hoạt động bền vững ngay cả khi API AI gặp sự cố 503 quá tải hoặc không có API Key
 */
function evaluateClinicalRulesForItems(items: AuditItemRequest[]): AuditItemResponse[] {
  return items.map((item) => {
    const g = item.tenGoc.toLowerCase();
    const t1 = (item.tenPL1 || '').toLowerCase();
    const t2 = (item.tenPL2 || '').toLowerCase();

    let hasWarning = false;
    let warningType: AuditItemResponse['warningType'] = 'NONE';
    const reasons: string[] = [];
    let severity: AuditItemResponse['severity'] = 'SAFE';
    let flagTarget: AuditItemResponse['flagTarget'] = 'NONE';

    // 1. Chăm sóc (Điều dưỡng) vs Phẫu thuật / Mở thông / Can thiệp ngoại khoa
    const isGocCare = /\b(chăm sóc|cham soc|thay băng|thay bang|vệ sinh|ve sinh|rút ống|thay ống|bơm rửa)\b/.test(g);
    const isTarget2Surgery = /\b(mở thông|mo thong|phẫu thuật|phau thuat|cắt lọc|cắt bỏ|cat bo|đốt|khoét|bóc u|tạo hình|khâu phục hồi|đặt sonde dạ dày)\b/.test(t2);
    const isTarget1Surgery = /\b(mở thông|mo thong|phẫu thuật|phau thuat|cắt lọc|cắt bỏ|cat bo|đốt|khoét|bóc u|tạo hình|khâu phục hồi|đặt sonde dạ dày)\b/.test(t1);

    if (isGocCare && isTarget2Surgery && !/\b(chăm sóc|cham soc|thay băng)\b/.test(t2)) {
      hasWarning = true;
      warningType = 'MISMATCH_INTERVENTION';
      flagTarget = 'PL2';
      severity = 'HIGH';
      reasons.push(`Khác biệt can thiệp: Kỹ thuật gốc là 'Chăm sóc / Điều dưỡng' nhưng PL2 là 'Phẫu thuật / Mở thông' (${item.tenPL2})`);
    }

    if (isGocCare && isTarget1Surgery && !/\b(chăm sóc|cham soc|thay băng)\b/.test(t1)) {
      hasWarning = true;
      warningType = 'MISMATCH_INTERVENTION';
      flagTarget = flagTarget === 'PL2' ? 'BOTH' : 'PL1';
      severity = 'HIGH';
      reasons.push(`Khác biệt can thiệp: Kỹ thuật gốc là 'Chăm sóc / Điều dưỡng' nhưng PL1 là 'Phẫu thuật / Mở thông' (${item.tenPL1})`);
    }

    // 2. Ống thông (Catheter care) vs Mở thông (Surgical ostomy)
    if (g.includes('ống thông') && t2.includes('mở thông') && !g.includes('mở thông')) {
      hasWarning = true;
      warningType = 'MISMATCH_INTERVENTION';
      flagTarget = flagTarget === 'PL1' ? 'BOTH' : 'PL2';
      severity = 'HIGH';
      reasons.push(`Khác biệt kỹ thuật: Kỹ thuật gốc là 'Ống thông' nhưng PL2 là 'Mở thông' phẫu thuật`);
    }

    // 3. Phương pháp phẫu thuật: Nội soi vs Mổ mở
    if (g.includes('nội soi') && (t2.includes('mổ mở') || t2.includes('phẫu thuật mở'))) {
      hasWarning = true;
      warningType = 'MISMATCH_METHOD';
      flagTarget = flagTarget === 'PL1' ? 'BOTH' : 'PL2';
      severity = 'MEDIUM';
      reasons.push(`Khác biệt phương pháp mổ: Gốc là 'Nội soi' nhưng PL2 là 'Mổ mở'`);
    }

    // 4. Mức độ: Có biến chứng vs Đơn thuần
    if (/\b(có biến chứng|phức tạp)\b/.test(g) && /\b(không biến chứng|đơn thuần)\b/.test(t2)) {
      hasWarning = true;
      warningType = 'MISMATCH_SEVERITY';
      flagTarget = flagTarget === 'PL1' ? 'BOTH' : 'PL2';
      severity = 'MEDIUM';
      reasons.push(`Khác biệt mức độ lâm sàng: Gốc có biến chứng nhưng PL2 là đơn thuần`);
    }

    // 5. Chẩn đoán vs Điều trị can thiệp
    const isGocDiag = /\b(chụp|siêu âm|đo điện|thăm dò|chẩn đoán)\b/.test(g);
    const isTarget2Therapeutic = /\b(phẫu thuật|cắt|khâu|nạo|bóc)\b/.test(t2) && !/\b(chụp|siêu âm)\b/.test(t2);
    if (isGocDiag && isTarget2Therapeutic) {
      hasWarning = true;
      warningType = 'MISMATCH_INTERVENTION';
      flagTarget = flagTarget === 'PL1' ? 'BOTH' : 'PL2';
      severity = 'HIGH';
      reasons.push(`Khác biệt phân nhóm: Gốc là 'Chẩn đoán / Thăm dò' nhưng PL2 là 'Phẫu thuật / Điều trị'`);
    }

    // 6. Can thiệp / Điều dưỡng vs Xét nghiệm / Đo lường sinh hóa
    const isGocIntervention = /\b(đặt ống|thông tiểu|sonde|catheter|chọc dò|chọc hút|thụt tháo|bơm rửa|hút đờm)\b/.test(g);
    const isTargetLab = /\b(đo đường huyết|đo nồng độ|xét nghiệm|định lượng|glucose|khí máu|điện giải|sinh hóa|huyết học)\b/.test(t2);
    if (isGocIntervention && isTargetLab) {
      hasWarning = true;
      warningType = 'MISMATCH_INTERVENTION';
      flagTarget = flagTarget === 'PL1' ? 'BOTH' : 'PL2';
      severity = 'HIGH';
      reasons.push(`Khác biệt bản chất: Gốc là 'Thủ thuật can thiệp / Điều dưỡng' nhưng đối chiếu là 'Xét nghiệm / Đo lường' (${item.tenPL2})`);
    }

    // 7. Phạm vi giải phẫu: Một bên vs Hai bên
    if (/\b(một bên|1 bên)\b/.test(g) && /\b(hai bên|2 bên|cả hai bên)\b/.test(t2)) {
      hasWarning = true;
      warningType = 'MISMATCH_ANATOMY';
      flagTarget = flagTarget === 'PL1' ? 'BOTH' : 'PL2';
      severity = 'HIGH';
      reasons.push(`Khác biệt phạm vi: Gốc là 'Một bên' nhưng đối chiếu là 'Hai bên'`);
    }

    return {
      stt: item.stt,
      hasWarning,
      warningType,
      reason: hasWarning ? reasons.join(' | ') : 'Khớp chuyên môn an toàn',
      severity,
      recommendation: hasWarning ? 'Cần chuyên viên/bác sĩ kiểm tra lại bản chất can thiệp trước khi áp mã' : 'Chấp nhận mapping',
      flagTarget,
    };
  });
}

/**
 * Gọi Gemini AI với cơ chế Fallback và Retry tự động khi gặp 503 (High Demand)
 */
async function callGeminiAudit(ai: GoogleGenAI, promptData: any[]): Promise<AuditItemResponse[] | null> {
  // Danh sách mô hình chuẩn theo hướng dẫn SDK: gemini-3.8-flash, gemini-flash-latest, gemini-3.1-flash-lite
  const candidateModels = ['gemini-3.8-flash', 'gemini-flash-latest', 'gemini-3.1-flash-lite'];

  for (const modelName of candidateModels) {
    // Cho phép tối đa 2 lần thử trên mỗi model nếu gặp quá tải tạm thời (503 / 429)
    for (let attempt = 1; attempt <= 2; attempt++) {
      try {
        const response = await ai.models.generateContent({
          model: modelName,
          contents: `Rà soát các cặp ánh xạ danh mục kỹ thuật y tế sau đây và phát hiện các mâu thuẫn chuyên môn lâm sàng:
${JSON.stringify(promptData, null, 2)}`,
          config: {
            systemInstruction: `Bạn là Chuyên gia Thẩm định Danh mục Kỹ thuật Khám chữa bệnh Bộ Y tế Việt Nam.
Nhiệm vụ: Rà soát danh sách kỹ thuật gốc đối chiếu sang Phụ lục 1 (pl1) và Phụ lục 2 (pl2).
Hãy phát hiện và gắn cờ (hasWarning = true) cho bất kỳ sự sai lệch nào về:
1. Bản chất can thiệp: Ví dụ 'Chăm sóc' (điều dưỡng) ghép với 'Mở thông' (phẫu thuật), 'Khâu' ghép với 'Cắt', 'Theo dõi' ghép với 'Thủ thuật xâm lấn'.
2. Phương pháp mổ: 'Nội soi' ghép với 'Mổ mở'.
3. Biến chứng / Mức độ: 'Đơn thuần' ghép với 'Có biến chứng' hoặc ngược lại.
4. Tần suất / Định lượng: 'Một lần' ghép với 'Nhiều lần/Đợt'.
5. Khác biệt cơ quan giải phẫu.

Nếu kỹ thuật trùng khớp hoàn toàn hoặc đồng nghĩa chuẩn y khoa: hasWarning = false, severity = "SAFE".
Nếu có điểm cần lưu ý: hasWarning = true, giải thích lý do súc tích trong reason (tiếng Việt), đưa ra recommendation cụ thể, chỉ định flagTarget là 'PL1', 'PL2', hoặc 'BOTH'.`,
            responseMimeType: 'application/json',
            responseSchema: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  stt: { type: Type.INTEGER },
                  hasWarning: { type: Type.BOOLEAN },
                  warningType: {
                    type: Type.STRING,
                    description: 'MISMATCH_INTERVENTION, MISMATCH_ANATOMY, MISMATCH_SEVERITY, MISMATCH_METHOD, LOW_CONFIDENCE, hoặc NONE',
                  },
                  reason: { type: Type.STRING },
                  severity: {
                    type: Type.STRING,
                    description: 'HIGH, MEDIUM, LOW, hoặc SAFE',
                  },
                  recommendation: { type: Type.STRING },
                  flagTarget: {
                    type: Type.STRING,
                    description: 'PL1, PL2, BOTH, hoặc NONE',
                  },
                },
                required: ['stt', 'hasWarning', 'warningType', 'reason', 'severity', 'recommendation', 'flagTarget'],
              },
            },
          },
        });

        const parsed = JSON.parse(response.text || '[]') as AuditItemResponse[];
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed;
        }
      } catch (err: any) {
        const isBusy =
          err?.status === 503 ||
          err?.status === 429 ||
          String(err?.message || '').includes('503') ||
          String(err?.message || '').includes('high demand');

        if (isBusy && attempt < 2) {
          // Chờ 600ms và thử lại model này
          await new Promise((resolve) => setTimeout(resolve, 600));
          continue;
        }

        // Chuyển sang mô hình kế tiếp mà không làm gián đoạn
        console.info(`[AI Audit] Mô hình ${modelName} đang bận hoặc lưu lượng cao, chuyển tiếp sang phương án dự phòng...`);
        break;
      }
    }
  }

  return null;
}

/**
 * Endpoint AI Rà soát & Thẩm định Danh mục Kỹ thuật Y tế
 */
app.post('/api/ai-audit', async (req, res) => {
  try {
    const { items } = req.body as { items: AuditItemRequest[] };

    if (!items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: 'Danh sách items không được để trống' });
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      console.warn('GEMINI_API_KEY chưa được cấu hình. Áp dụng bộ phân tích quy tắc lâm sàng.');
      const fallbackResults = evaluateClinicalRulesForItems(items);
      return res.json({
        auditedBy: 'clinical_rule',
        results: fallbackResults,
      });
    }

    const ai = getGemini();
    const promptData = items.map((it) => ({
      stt: it.stt,
      goc: it.tenGoc,
      pl1: it.tenPL1 || '',
      pl2: it.tenPL2 || '',
    }));

    try {
      const parsed = await callGeminiAudit(ai, promptData);
      if (parsed && Array.isArray(parsed) && parsed.length > 0) {
        return res.json({
          auditedBy: 'gemini',
          results: parsed,
        });
      }

      // Nếu tất cả mô hình AI đều đang bận / có lưu lượng cao, chuyển sang luật lâm sàng
      console.info('[AI Audit] Các mô hình AI đang tạm thời có lưu lượng cao, kích hoạt bộ luật lâm sàng dự phòng.');
      const fallbackResults = evaluateClinicalRulesForItems(items);
      return res.json({
        auditedBy: 'clinical_rule_fallback',
        notice: 'Hệ thống đã áp dụng bộ luật chuyên gia lâm sàng để thẩm định và tô vàng các điểm lưu ý.',
        results: fallbackResults,
      });
    } catch (geminiError: any) {
      console.info('[AI Audit] Chuyển đổi sang bộ thẩm định lâm sàng dự phòng.');
      const fallbackResults = evaluateClinicalRulesForItems(items);
      return res.json({
        auditedBy: 'clinical_rule_fallback',
        notice: 'Hệ thống đã áp dụng bộ luật chuyên gia lâm sàng để thẩm định và tô vàng các điểm lưu ý.',
        results: fallbackResults,
      });
    }
  } catch (error) {
    console.error('Lỗi xử lý audit:', error);
    // Luôn trả về 200 kèm fallback an toàn thay vì làm hỏng giao diện người dùng
    try {
      const { items } = req.body as { items: AuditItemRequest[] };
      const fallbackResults = evaluateClinicalRulesForItems(items || []);
      return res.json({
        auditedBy: 'clinical_rule_fallback',
        results: fallbackResults,
      });
    } catch {
      return res.status(500).json({
        error: 'Không thể hoàn thành thẩm định',
        message: error instanceof Error ? error.message : String(error),
      });
    }
  }
});

// Khởi chạy Vite middleware hoặc static files
async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server đang chạy tại http://0.0.0.0:${PORT}`);
  });
}

startServer();
