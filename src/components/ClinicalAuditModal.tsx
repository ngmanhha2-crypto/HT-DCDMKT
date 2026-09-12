import React, { useState } from 'react';
import {
  X,
  AlertTriangle,
  CheckCircle2,
  Scale,
  Copy,
  CheckCheck,
  Stethoscope,
  FileText,
  ShieldAlert,
  ArrowRight,
  HelpCircle,
  ExternalLink,
} from 'lucide-react';
import { MappingResult } from '../types';

interface ClinicalAuditModalProps {
  isOpen: boolean;
  onClose: () => void;
  row: MappingResult | null;
  onClearMatch?: (rowId: number, target: 'PL1' | 'PL2') => void;
  onDismissWarning?: (rowId: number) => void;
}

export const ClinicalAuditModal: React.FC<ClinicalAuditModalProps> = ({
  isOpen,
  onClose,
  row,
  onClearMatch,
  onDismissWarning,
}) => {
  const [copied, setCopied] = useState(false);

  if (!isOpen || !row) return null;

  const audit = row.aiAudit;
  const isWarned = Boolean(audit?.hasWarning);
  const isPL1Flagged = isWarned && (audit?.flagTarget === 'PL1' || audit?.flagTarget === 'BOTH');
  const isPL2Flagged = isWarned && (audit?.flagTarget === 'PL2' || audit?.flagTarget === 'BOTH');

  const handleCopy = () => {
    if (!audit) return;
    const lines = [
      `=== BIÊN BẢN THẨM ĐỊNH CHUYÊN MÔN Y TẾ & RỦI RO BHYT ===`,
      `Mã kỹ thuật BV: ${row.maGoc || '(Không mã)'}`,
      `Tên kỹ thuật BV: ${row.tenGoc}`,
      `Chuyên khoa / Hệ cơ quan: ${row.chuyenKhoaGoc || 'Chưa phân loại'} - ${row.boPhanGoc || 'Chưa phân loại'}`,
      `--------------------------------------------------------`,
      `Dịch vụ đối chiếu PL1: [${row.maPL1 || 'Chưa ghép'}] ${row.tenPL1 || 'Chưa ghép'} (Độ tương đồng: ${row.scorePL1}%)`,
      `Dịch vụ đối chiếu PL2: [${row.maPL2 || 'Chưa ghép'}] ${row.tenPL2 || 'Chưa ghép'} (Độ tương đồng: ${row.scorePL2}%)`,
      `--------------------------------------------------------`,
      `Kết luận thẩm định: ${isWarned ? (audit.severity === 'HIGH' ? 'CẢNH BÁO NGUY CƠ CAO (XUẤT TOÁN BHYT)' : 'CẦN LƯU Ý MỨC ĐỘ TRUNG BÌNH') : 'PHÙ HỢP CHUYÊN MÔN'}`,
      `Lý do thẩm định: ${audit.reason || 'Khớp chuyên môn an toàn'}`,
      audit.recommendation ? `Khuyến nghị: ${audit.recommendation}` : '',
      audit.legalBasis ? `Căn cứ pháp lý: ${audit.legalBasis}` : '',
    ];

    if (audit.details && audit.details.length > 0) {
      lines.push(`\nCHI TIẾT PHÂN TÍCH LÂM SÀNG:`);
      audit.details.forEach((d, idx) => {
        lines.push(`${idx + 1}. ${d.conflictType}:`);
        lines.push(`   - Kỹ thuật BV: ${d.sourceFeature}`);
        lines.push(`   - Dịch vụ đối chiếu: ${d.targetFeature}`);
        lines.push(`   - Tác động lâm sàng: ${d.clinicalImpact}`);
        if (d.insuranceRisk) lines.push(`   - Rủi ro BHYT: ${d.insuranceRisk}`);
      });
    }

    lines.push(`\nThời gian trích xuất: ${new Date().toLocaleString('vi-VN')}`);

    navigator.clipboard.writeText(lines.filter(Boolean).join('\n')).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    });
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 overflow-y-auto animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-xl shadow-2xl border border-slate-200 max-w-4xl w-full my-8 overflow-hidden flex flex-col max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="bg-slate-900 text-white px-6 py-4 flex items-center justify-between border-b border-slate-800 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className={`p-2 rounded-lg ${isWarned ? (audit?.severity === 'HIGH' ? 'bg-red-500/20 text-red-400' : 'bg-amber-500/20 text-amber-400') : 'bg-emerald-500/20 text-emerald-400'}`}>
              {isWarned ? <ShieldAlert className="w-5 h-5" /> : <Scale className="w-5 h-5" />}
            </div>
            <div>
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                Biên Bản Thẩm Định Chuyên Môn Lâm Sàng & Rủi Ro BHYT
                {isWarned && (
                  <span className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded ${audit?.severity === 'HIGH' ? 'bg-red-900 text-red-200 border border-red-700' : 'bg-amber-900 text-amber-200 border border-amber-700'}`}>
                    {audit?.severity === 'HIGH' ? 'Nguy cơ xuất toán' : 'Cần rà soát'}
                  </span>
                )}
              </h3>
              <p className="text-xs text-slate-400">
                Đối chiếu kỹ thuật theo Thông tư quy định của Bộ Y tế và Bảo hiểm Xã hội
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
            title="Đóng"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Body */}
        <div className="p-6 overflow-y-auto space-y-6 text-sm text-slate-700">
          {/* Section 1: Thông tin kỹ thuật bệnh viện */}
          <div className="bg-slate-50 border border-slate-200 rounded-lg p-4">
            <div className="flex items-start justify-between gap-4">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-slate-200 text-slate-700">
                    MÃ BV: {row.maGoc || 'N/A'}
                  </span>
                  {row.chuyenKhoaGoc && (
                    <span className="px-2 py-0.5 rounded text-[11px] font-medium bg-blue-100 text-blue-800">
                      Khoa: {row.chuyenKhoaGoc}
                    </span>
                  )}
                  {row.boPhanGoc && (
                    <span className="px-2 py-0.5 rounded text-[11px] font-medium bg-purple-100 text-purple-800">
                      Cơ quan: {row.boPhanGoc}
                    </span>
                  )}
                </div>
                <h4 className="text-base font-bold text-slate-900 leading-snug">
                  {row.tenGoc}
                </h4>
              </div>

              <div className="shrink-0 text-right text-xs text-slate-500">
                <div>STT Dòng: <b>#{row.stt1 || row.rowId}</b></div>
                {row.qtktBenhVien && <div>QTKT: {row.qtktBenhVien}</div>}
              </div>
            </div>
          </div>

          {/* Section 2: So sánh 2 chiều với Phụ Lục 1 & 2 */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* PL1 Card */}
            <div className={`p-3.5 rounded-lg border ${isPL1Flagged ? 'bg-red-50/50 border-red-300' : 'bg-slate-50 border-slate-200'}`}>
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-xs font-bold text-slate-700 uppercase flex items-center gap-1">
                  Phụ lục 1 (Thông tư BHYT)
                  {isPL1Flagged && (
                    <span className="text-[10px] font-bold text-red-600 bg-red-100 px-1.5 py-0.2 rounded">
                      Cảnh báo
                    </span>
                  )}
                </span>
                <span className={`text-xs font-bold px-2 py-0.5 rounded ${row.scorePL1 >= 80 ? 'bg-emerald-100 text-emerald-800' : row.scorePL1 >= 60 ? 'bg-amber-100 text-amber-800' : 'bg-slate-100 text-slate-600'}`}>
                  Khớp: {row.scorePL1}%
                </span>
              </div>
              <div className="text-xs font-semibold text-slate-900">
                {row.tenPL1 ? (
                  <>
                    <span className="text-slate-500 font-normal mr-1">[{row.maPL1 || 'Không mã'}]:</span>
                    {row.tenPL1}
                  </>
                ) : (
                  <span className="text-slate-400 italic">Chưa đối chiếu dịch vụ Phụ lục 1</span>
                )}
              </div>
            </div>

            {/* PL2 Card */}
            <div className={`p-3.5 rounded-lg border ${isPL2Flagged ? 'bg-red-50/50 border-red-300' : 'bg-slate-50 border-slate-200'}`}>
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-xs font-bold text-slate-700 uppercase flex items-center gap-1">
                  Phụ lục 2 (Thông tư BHYT)
                  {isPL2Flagged && (
                    <span className="text-[10px] font-bold text-red-600 bg-red-100 px-1.5 py-0.2 rounded">
                      Cảnh báo
                    </span>
                  )}
                </span>
                <span className={`text-xs font-bold px-2 py-0.5 rounded ${row.scorePL2 >= 80 ? 'bg-emerald-100 text-emerald-800' : row.scorePL2 >= 60 ? 'bg-amber-100 text-amber-800' : 'bg-slate-100 text-slate-600'}`}>
                  Khớp: {row.scorePL2}%
                </span>
              </div>
              <div className="text-xs font-semibold text-slate-900">
                {row.tenPL2 ? (
                  <>
                    <span className="text-slate-500 font-normal mr-1">[{row.maPL2 || 'Không mã'}]:</span>
                    {row.tenPL2}
                  </>
                ) : (
                  <span className="text-slate-400 italic">Chưa đối chiếu dịch vụ Phụ lục 2</span>
                )}
              </div>
            </div>
          </div>

          {/* Section 3: Báo cáo Thẩm định Chuyên môn (Transparent Audit Findings) */}
          <div className={`rounded-xl p-5 border ${isWarned ? (audit?.severity === 'HIGH' ? 'bg-amber-50/80 border-amber-300' : 'bg-amber-50/50 border-amber-200') : 'bg-emerald-50/60 border-emerald-200'}`}>
            <div className="flex items-start gap-3 mb-4">
              <div className={`p-2 rounded-lg shrink-0 ${isWarned ? (audit?.severity === 'HIGH' ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700') : 'bg-emerald-100 text-emerald-700'}`}>
                {isWarned ? <AlertTriangle className="w-5 h-5" /> : <CheckCircle2 className="w-5 h-5" />}
              </div>
              <div className="space-y-1">
                <h5 className="font-bold text-slate-900 text-sm">
                  {isWarned
                    ? (audit?.severity === 'HIGH' ? 'Phát hiện Mâu Thuẫn Chuyên Môn Nghiêm Trọng' : 'Phát hiện Điểm Lưu Ý Khi Áp Mã')
                    : 'Đánh Giá Thẩm Định: Đạt Tiêu Chuẩn Phù Hợp'}
                </h5>
                <p className="text-xs text-slate-700 leading-relaxed font-medium">
                  {audit?.reason || 'Cặp đối chiếu có sự đồng nhất về bản chất kỹ thuật lâm sàng, cơ quan giải phẫu và điều kiện thực hiện.'}
                </p>
              </div>
            </div>

            {/* Bảng chi tiết các rào chắn kỹ thuật (Details Breakdown Table) */}
            {audit?.details && audit.details.length > 0 && (
              <div className="mt-4 space-y-3">
                <div className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                  <Stethoscope className="w-4 h-4 text-sky-600" />
                  Bảng Phân Tích Y Khoa & Rủi Ro BHYT Minh Bạch
                </div>

                <div className="border border-slate-200 rounded-lg overflow-hidden bg-white shadow-xs">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead className="bg-slate-100 text-slate-700 border-b border-slate-200 font-bold">
                      <tr>
                        <th className="p-2.5 w-1/4">Yếu Tố Thẩm Định</th>
                        <th className="p-2.5 w-1/4">So Sánh Thực Tế</th>
                        <th className="p-2.5 w-1/2">Phân Tích Chuyên Môn & Nguy Cơ BHYT</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {audit.details.map((detail, idx) => (
                        <tr key={idx} className="hover:bg-slate-50">
                          <td className="p-2.5 align-top font-bold text-slate-900">
                            <span className="inline-block px-1.5 py-0.5 rounded bg-amber-100 text-amber-900 font-semibold text-[11px] mb-1">
                              {detail.conflictType}
                            </span>
                          </td>
                          <td className="p-2.5 align-top space-y-1">
                            <div className="text-[11px]">
                              <span className="font-semibold text-slate-500">BV:</span>{' '}
                              <span className="text-slate-900 font-medium">{detail.sourceFeature}</span>
                            </div>
                            <div className="text-[11px]">
                              <span className="font-semibold text-slate-500">Đối chiếu:</span>{' '}
                              <span className="text-slate-900 font-medium">{detail.targetFeature}</span>
                            </div>
                          </td>
                          <td className="p-2.5 align-top space-y-1.5">
                            <div className="text-[11px] text-slate-700">
                              <span className="font-semibold text-slate-800">Lâm sàng:</span> {detail.clinicalImpact}
                            </div>
                            {detail.insuranceRisk && (
                              <div className="text-[11px] text-red-700 bg-red-50 p-1.5 rounded border border-red-200">
                                <span className="font-bold">⚠️ Rủi ro BHYT:</span> {detail.insuranceRisk}
                              </div>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Căn cứ pháp lý & Khuyến nghị */}
            <div className="mt-4 pt-3 border-t border-slate-200/80 space-y-2 text-xs">
              {audit?.legalBasis && (
                <div className="flex items-start gap-2 text-slate-600">
                  <FileText className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-bold text-slate-800">Căn cứ pháp lý viện dẫn:</span> {audit.legalBasis}
                  </div>
                </div>
              )}
              {audit?.recommendation && (
                <div className="flex items-start gap-2 text-amber-900 bg-amber-100/60 p-2.5 rounded-lg border border-amber-200">
                  <span className="font-bold text-base shrink-0">💡</span>
                  <div>
                    <span className="font-bold text-amber-950">Khuyến nghị của Hội đồng chuyên môn / AI:</span>{' '}
                    {audit.recommendation}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="bg-slate-50 px-6 py-4 border-t border-slate-200 flex flex-wrap items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleCopy}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white border border-slate-300 hover:bg-slate-100 text-slate-700 font-semibold text-xs transition-colors cursor-pointer"
              title="Sao chép toàn bộ biên bản giải trình vào Clipboard"
            >
              {copied ? <CheckCheck className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4 text-slate-500" />}
              <span>{copied ? 'Đã sao chép biên bản!' : 'Sao chép giải trình'}</span>
            </button>
          </div>

          <div className="flex items-center gap-2">
            {isPL2Flagged && onClearMatch && (
              <button
                type="button"
                onClick={() => {
                  onClearMatch(row.rowId, 'PL2');
                  onClose();
                }}
                className="px-3 py-1.5 rounded-lg bg-red-100 hover:bg-red-200 text-red-700 font-bold text-xs border border-red-300 cursor-pointer"
              >
                Hủy ghép PL2
              </button>
            )}

            {isPL1Flagged && onClearMatch && (
              <button
                type="button"
                onClick={() => {
                  onClearMatch(row.rowId, 'PL1');
                  onClose();
                }}
                className="px-3 py-1.5 rounded-lg bg-red-100 hover:bg-red-200 text-red-700 font-bold text-xs border border-red-300 cursor-pointer"
              >
                Hủy ghép PL1
              </button>
            )}

            {isWarned && onDismissWarning && (
              <button
                type="button"
                onClick={() => {
                  onDismissWarning(row.rowId);
                  onClose();
                }}
                className="px-3 py-1.5 rounded-lg bg-slate-200 hover:bg-slate-300 text-slate-800 font-semibold text-xs cursor-pointer"
                title="Bác sĩ xác nhận đã kiểm tra và phê duyệt áp dụng"
              >
                Xác nhận đã duyệt
              </button>
            )}

            <button
              type="button"
              onClick={onClose}
              className="px-4 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-white font-semibold text-xs cursor-pointer"
            >
              Đóng
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
