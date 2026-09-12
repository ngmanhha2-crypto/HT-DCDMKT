import React, { useState } from 'react';
import {
  X,
  Copy,
  Check,
  Github,
  Globe,
  Zap,
  ShieldCheck,
  Terminal,
  Cpu,
  Layers,
  ExternalLink,
  FileCode,
  BookOpen,
  FileSpreadsheet,
  CheckCircle2,
  AlertTriangle,
} from 'lucide-react';
import { PythonCodeViewer } from './PythonCodeViewer';

interface DeployGuideModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const DeployGuideModal: React.FC<DeployGuideModalProps> = ({ isOpen, onClose }) => {
  const [activeTab, setActiveTab] = useState<'python' | 'github' | 'vercel' | 'performance' | 'usage'>('python');
  const [copiedId, setCopiedId] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleCopy = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const gitCommands = `# 1. Khởi tạo kho chứa Git trên máy tính của bạn
git init

# 2. Thêm toàn bộ mã nguồn vào vùng staging
git add .

# 3. Tạo commit đầu tiên
git commit -m "feat: Medical DMKT Fuzzy Matcher optimized for Vercel and Big Data"

# 4. Đổi tên nhánh mặc định thành main
git branch -M main

# 5. Liên kết kho chứa GitHub của bạn (thay username và repo_name bằng link của bạn)
git remote add origin https://github.com/<YOUR_USERNAME>/<YOUR_REPO_NAME>.git

# 6. Đẩy mã nguồn lên GitHub
git push -u origin main`;

  const vercelJsonContent = `{
  "framework": "vite",
  "buildCommand": "npm run build",
  "outputDirectory": "dist",
  "rewrites": [
    {
      "source": "/(.*)",
      "destination": "/index.html"
    }
  ]
}`;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl max-w-5xl w-full shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[92vh]">
        {/* Modal Header */}
        <div className="px-6 py-4 bg-gradient-to-r from-blue-900 via-sky-900 to-slate-900 text-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-white/10 border border-white/20">
              <BookOpen className="w-5 h-5 text-sky-300" />
            </div>
            <div>
              <h3 className="text-lg font-bold">Hướng Dẫn Sử Dụng, Mã Nguồn & Triển Khai</h3>
              <p className="text-xs text-sky-200">
                Tài liệu quy trình, gói mã nguồn Python Streamlit (app.py) và hướng dẫn đẩy GitHub / Vercel
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-300 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
            aria-label="Đóng"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="flex border-b border-slate-200 bg-slate-50 px-6 text-xs font-medium gap-1 overflow-x-auto">
          <button
            onClick={() => setActiveTab('python')}
            className={`py-3 px-3 border-b-2 flex items-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap ${
              activeTab === 'python'
                ? 'border-sky-600 text-sky-700 font-semibold bg-white'
                : 'border-transparent text-slate-600 hover:text-slate-900'
            }`}
          >
            <FileCode className="w-4 h-4 text-emerald-600" />
            1. Mã Nguồn Python (Streamlit)
          </button>

          <button
            onClick={() => setActiveTab('usage')}
            className={`py-3 px-3 border-b-2 flex items-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap ${
              activeTab === 'usage'
                ? 'border-sky-600 text-sky-700 font-semibold bg-white'
                : 'border-transparent text-slate-600 hover:text-slate-900'
            }`}
          >
            <BookOpen className="w-4 h-4 text-indigo-600" />
            2. Quy Trình Sử Dụng DMKT
          </button>

          <button
            onClick={() => setActiveTab('github')}
            className={`py-3 px-3 border-b-2 flex items-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap ${
              activeTab === 'github'
                ? 'border-sky-600 text-sky-700 font-semibold bg-white'
                : 'border-transparent text-slate-600 hover:text-slate-900'
            }`}
          >
            <Github className="w-4 h-4" />
            3. Đẩy Code Lên GitHub
          </button>

          <button
            onClick={() => setActiveTab('vercel')}
            className={`py-3 px-3 border-b-2 flex items-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap ${
              activeTab === 'vercel'
                ? 'border-sky-600 text-sky-700 font-semibold bg-white'
                : 'border-transparent text-slate-600 hover:text-slate-900'
            }`}
          >
            <Globe className="w-4 h-4 text-sky-600" />
            4. Triển Khai Vercel
          </button>

          <button
            onClick={() => setActiveTab('performance')}
            className={`py-3 px-3 border-b-2 flex items-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap ${
              activeTab === 'performance'
                ? 'border-sky-600 text-sky-700 font-semibold bg-white'
                : 'border-transparent text-slate-600 hover:text-slate-900'
            }`}
          >
            <Zap className="w-4 h-4 text-amber-500" />
            5. Tối Ưu File Excel Lớn
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto space-y-5 text-slate-700 text-sm flex-1">
          {activeTab === 'python' && (
            <div className="space-y-4">
              <div className="bg-sky-50 border border-sky-200 rounded-xl p-4 text-xs text-sky-950 flex items-start gap-3">
                <FileCode className="w-5 h-5 text-sky-700 shrink-0 mt-0.5" />
                <div>
                  <div className="font-semibold text-sm">Gói mã nguồn Python độc lập (Streamlit App)</div>
                  <div className="mt-1 text-slate-600 leading-relaxed">
                    Dành cho các cơ sở y tế muốn vận hành mã nguồn Python trực tiếp trên máy chủ nội bộ hoặc máy cá nhân mà không cần internet. Bạn có thể tải ngay file <b>app.py</b>, <b>requirements.txt</b> hoặc sao chép mã nguồn bên dưới.
                  </div>
                </div>
              </div>

              {/* Embedded Python Code Viewer */}
              <PythonCodeViewer />
            </div>
          )}

          {activeTab === 'usage' && (
            <div className="space-y-4">
              <div className="bg-indigo-50 border border-indigo-200 rounded-xl p-4 text-xs text-indigo-950 flex items-start gap-3">
                <BookOpen className="w-5 h-5 text-indigo-700 shrink-0 mt-0.5" />
                <div>
                  <div className="font-semibold text-sm">Quy trình 3 bước đối chiếu danh mục kỹ thuật y tế</div>
                  <div className="mt-1 text-slate-600">
                    Tuân thủ tiêu chuẩn Thông tư 23/2024/TT-BYT, tự động loại bỏ rủi ro ghép nhầm chuyên khoa và tô vàng cảnh báo lâm sàng.
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="p-4 rounded-xl border border-slate-200 bg-slate-50 space-y-2">
                  <div className="flex items-center gap-2">
                    <span className="w-6 h-6 rounded-full bg-sky-600 text-white font-bold text-xs flex items-center justify-center">
                      1
                    </span>
                    <span className="font-bold text-slate-800 text-xs">Nạp 3 File Excel</span>
                  </div>
                  <p className="text-xs text-slate-600 leading-relaxed">
                    Tải lên Danh mục Kỹ thuật gốc của bệnh viện, Phụ lục 1 và Phụ lục 2. Hệ thống tự động bỏ dòng tiêu đề thừa (skiprows=1 và skiprows=3) và phát hiện đúng cột.
                  </p>
                </div>

                <div className="p-4 rounded-xl border border-slate-200 bg-slate-50 space-y-2">
                  <div className="flex items-center gap-2">
                    <span className="w-6 h-6 rounded-full bg-sky-600 text-white font-bold text-xs flex items-center justify-center">
                      2
                    </span>
                    <span className="font-bold text-slate-800 text-xs">Đối Chiếu 2 Tầng</span>
                  </div>
                  <p className="text-xs text-slate-600 leading-relaxed">
                    Khớp độc lập Tên kỹ thuật can thiệp (cắt, khâu, nội soi...) và Bộ phận giải phẫu (mắt, dạ dày, âm hộ...). Chặn 100% rủi ro ghép sai chuyên khoa.
                  </p>
                </div>

                <div className="p-4 rounded-xl border border-slate-200 bg-slate-50 space-y-2">
                  <div className="flex items-center gap-2">
                    <span className="w-6 h-6 rounded-full bg-sky-600 text-white font-bold text-xs flex items-center justify-center">
                      3
                    </span>
                    <span className="font-bold text-slate-800 text-xs">Rà Soát & Xuất Excel</span>
                  </div>
                  <p className="text-xs text-slate-600 leading-relaxed">
                    Hệ thống tự động tô vàng các dòng có cảnh báo lâm sàng (như Chăm sóc ghép với Phẫu thuật). Xuất file Excel chuẩn đúng định dạng biểu mẫu.
                  </p>
                </div>
              </div>

              <div className="p-4 rounded-xl bg-slate-900 text-slate-200 space-y-2 text-xs">
                <div className="font-bold text-sky-400 flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-emerald-400" />
                  Nguyên tắc bảo mật dữ liệu y tế 100% Client-Side
                </div>
                <p className="text-slate-300 leading-relaxed">
                  Toàn bộ quá trình đọc file Excel, phân tích từ khóa và tính toán độ tương đồng diễn ra ngay trên trình duyệt máy tính của bạn thông qua Web Worker và RAM máy tính. Không có bất kỳ tệp dữ liệu bệnh viện nào bị tải lên máy chủ ngoài.
                </p>
              </div>
            </div>
          )}

          {activeTab === 'github' && (
            <div className="space-y-4">
              <div className="bg-sky-50 border border-sky-200 rounded-xl p-4 text-xs text-sky-900 flex items-start gap-3">
                <Github className="w-5 h-5 text-sky-700 shrink-0 mt-0.5" />
                <div>
                  <div className="font-semibold text-sm">Đưa mã nguồn lên GitHub Repository</div>
                  <div className="mt-1 text-slate-600">
                    Tạo một kho chứa (repository) mới trên{' '}
                    <a
                      href="https://github.com/new"
                      target="_blank"
                      rel="noreferrer"
                      className="text-sky-700 font-medium underline inline-flex items-center gap-0.5"
                    >
                      github.com/new <ExternalLink className="w-3 h-3" />
                    </a>
                    , sau đó sao chép các dòng lệnh dưới đây và chạy trong terminal tại thư mục dự án:
                  </div>
                </div>
              </div>

              <div className="relative rounded-xl overflow-hidden border border-slate-800 bg-slate-900 text-slate-100 shadow-sm">
                <div className="flex items-center justify-between px-4 py-2 bg-slate-800/80 border-b border-slate-700 text-xs text-slate-300">
                  <span className="font-mono flex items-center gap-1.5">
                    <Terminal className="w-3.5 h-3.5 text-sky-400" />
                    Terminal / Bash
                  </span>
                  <button
                    onClick={() => handleCopy(gitCommands, 'git')}
                    className="inline-flex items-center gap-1 text-xs text-sky-300 hover:text-white bg-slate-700 hover:bg-slate-600 px-2 py-1 rounded transition-colors cursor-pointer"
                  >
                    {copiedId === 'git' ? (
                      <>
                        <Check className="w-3.5 h-3.5 text-emerald-400" /> Đã sao chép
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5" /> Sao chép lệnh
                      </>
                    )}
                  </button>
                </div>
                <pre className="p-4 font-mono text-xs overflow-x-auto text-emerald-300 leading-relaxed whitespace-pre">
                  {gitCommands}
                </pre>
              </div>

              <div className="text-xs text-slate-500 bg-slate-50 p-3.5 rounded-lg border border-slate-200">
                💡 <b>Mẹo:</b> File <code>.gitignore</code> trong dự án đã được cấu hình tự động loại bỏ <code>node_modules/</code>, <code>dist/</code>, các file log và tệp tạm thời.
              </div>
            </div>
          )}

          {activeTab === 'vercel' && (
            <div className="space-y-4">
              <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 text-xs text-emerald-900 flex items-start gap-3">
                <Globe className="w-5 h-5 text-emerald-700 shrink-0 mt-0.5" />
                <div>
                  <div className="font-semibold text-sm">Kết nối GitHub Repo và Deploy lên Vercel</div>
                  <div className="mt-1 text-slate-600">
                    Vercel tự động nhận diện cấu hình Vite SPA trong file <code>vercel.json</code> đã tích hợp sẵn và triển khai trong 30 giây.
                  </div>
                </div>
              </div>

              <div className="space-y-3">
                <div className="flex gap-3 items-start p-3 bg-slate-50 rounded-lg border border-slate-200">
                  <div className="w-6 h-6 rounded-full bg-sky-600 text-white font-bold text-xs flex items-center justify-center shrink-0">
                    1
                  </div>
                  <div>
                    <div className="font-semibold text-xs text-slate-800">Truy cập Vercel Dashboard</div>
                    <div className="text-xs text-slate-600 mt-0.5">
                      Đăng nhập tại{' '}
                      <a
                        href="https://vercel.com"
                        target="_blank"
                        rel="noreferrer"
                        className="text-sky-700 underline font-medium"
                      >
                        vercel.com
                      </a>{' '}
                      bằng tài khoản GitHub của bạn.
                    </div>
                  </div>
                </div>

                <div className="flex gap-3 items-start p-3 bg-slate-50 rounded-lg border border-slate-200">
                  <div className="w-6 h-6 rounded-full bg-sky-600 text-white font-bold text-xs flex items-center justify-center shrink-0">
                    2
                  </div>
                  <div>
                    <div className="font-semibold text-xs text-slate-800">Add New Project</div>
                    <div className="text-xs text-slate-600 mt-0.5">
                      Nhấn nút <b>&quot;Add New...&quot; &rarr; &quot;Project&quot;</b> và chọn Repository GitHub bạn vừa đẩy mã nguồn lên.
                    </div>
                  </div>
                </div>

                <div className="flex gap-3 items-start p-3 bg-slate-50 rounded-lg border border-slate-200">
                  <div className="w-6 h-6 rounded-full bg-sky-600 text-white font-bold text-xs flex items-center justify-center shrink-0">
                    3
                  </div>
                  <div>
                    <div className="font-semibold text-xs text-slate-800">Tự động cấu hình chuẩn</div>
                    <div className="text-xs text-slate-600 mt-0.5">
                      Vercel sẽ tự động điền: <b>Framework Preset: Vite</b>, <b>Build Command:</b> <code>npm run build</code>, <b>Output Directory:</b> <code>dist</code>.
                    </div>
                  </div>
                </div>

                <div className="flex gap-3 items-start p-3 bg-slate-50 rounded-lg border border-slate-200">
                  <div className="w-6 h-6 rounded-full bg-sky-600 text-white font-bold text-xs flex items-center justify-center shrink-0">
                    4
                  </div>
                  <div>
                    <div className="font-semibold text-xs text-slate-800">Nhấn &quot;Deploy&quot;</div>
                    <div className="text-xs text-slate-600 mt-0.5">
                      Ứng dụng sẽ có link công khai dạng <code>https://your-project.vercel.app</code> với chứng chỉ SSL HTTPS miễn phí, CDN toàn cầu và tự động cập nhật mỗi khi bạn push git!
                    </div>
                  </div>
                </div>
              </div>

              {/* Vercel.json */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-xs font-semibold text-slate-700">File vercel.json đã cấu hình sẵn trong project:</span>
                  <button
                    onClick={() => handleCopy(vercelJsonContent, 'vercel_json')}
                    className="text-xs text-sky-700 hover:text-sky-900 inline-flex items-center gap-1 cursor-pointer"
                  >
                    {copiedId === 'vercel_json' ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                    Sao chép
                  </button>
                </div>
                <pre className="p-3 bg-slate-900 text-sky-300 font-mono text-xs rounded-lg overflow-x-auto">
                  {vercelJsonContent}
                </pre>
              </div>
            </div>
          )}

          {activeTab === 'performance' && (
            <div className="space-y-4">
              <div className="p-4 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-900 space-y-1">
                <div className="font-bold text-sm flex items-center gap-2">
                  <Zap className="w-4 h-4 text-amber-600" />
                  Cơ chế tăng tốc xử lý tập tin Excel lớn (1.000 - 50.000 dòng)
                </div>
                <p className="text-slate-600">
                  Các ứng dụng Fuzzy Matching truyền thống thường bị treo (freeze) hoặc quá thời gian xử lý (Timeout) khi gặp file Excel lớn vì thuật toán duyệt lặp 2 vòng O(N &times; M) (ví dụ 5.000 dòng đối chiếu với 15.000 dòng tạo ra 75.000.000 phép tính so khớp ký tự).
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5 text-xs">
                <div className="p-3.5 rounded-xl border border-slate-200 bg-white shadow-xs space-y-1.5">
                  <div className="font-bold text-slate-900 flex items-center gap-2">
                    <Cpu className="w-4 h-4 text-sky-600" />
                    Chỉ Mục Đảo & Chặn Lọc Ứng Viên (Inverted Index)
                  </div>
                  <p className="text-slate-600 leading-relaxed">
                    Trước khi so sánh, ứng dụng tạo chỉ mục ngược theo từ khóa y tế. Với mỗi dòng cần khớp, hệ thống lọc ra ngay 20-40 ứng viên tiềm năng nhất thay vì so sánh với tất cả 15.000 mục. Giảm 99.7% lượng tính toán thừa!
                  </p>
                </div>

                <div className="p-3.5 rounded-xl border border-slate-200 bg-white shadow-xs space-y-1.5">
                  <div className="font-bold text-slate-900 flex items-center gap-2">
                    <Zap className="w-4 h-4 text-emerald-600" />
                    Khớp Tuyệt Đối O(1) Qua Hash Map
                  </div>
                  <p className="text-slate-600 leading-relaxed">
                    Các kỹ thuật trùng tên sau khi lọc ký tự nhiễu (*, +, -) được trả về ngay lập tức với điểm số 100% trong 0.0001ms, bỏ qua hoàn toàn thuật toán tính khoảng cách chỉnh sửa.
                  </p>
                </div>

                <div className="p-3.5 rounded-xl border border-slate-200 bg-white shadow-xs space-y-1.5">
                  <div className="font-bold text-slate-900 flex items-center gap-2">
                    <Layers className="w-4 h-4 text-purple-600" />
                    Chia Nhỏ Tác Vụ Bất Đồng Bộ (Chunking)
                  </div>
                  <p className="text-slate-600 leading-relaxed">
                    Xử lý theo khối 50-100 dòng mỗi nhịp, giải phóng Main Thread của trình duyệt để thanh tiến trình cập nhật mượt mà (tốc độ dòng/giây, thời gian còn lại) và người dùng có thể nhấn nút &quot;Hủy bỏ&quot; bất kỳ lúc nào.
                  </p>
                </div>

                <div className="p-3.5 rounded-xl border border-slate-200 bg-white shadow-xs space-y-1.5">
                  <div className="font-bold text-slate-900 flex items-center gap-2">
                    <ShieldCheck className="w-4 h-4 text-indigo-600" />
                    Không Giới Hạn Server Timeout & Bảo Mật
                  </div>
                  <p className="text-slate-600 leading-relaxed">
                    Vì chạy 100% Client-Side trên trình duyệt người dùng, ứng dụng <b>không bao giờ bị lỗi Timeout 10s của Vercel Serverless Function</b> và file Excel y tế của bệnh viện không bị gửi ra ngoài mạng internet.
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between">
          <div className="text-xs text-slate-500">
            Tài liệu hướng dẫn & mã nguồn đóng gói hỗ trợ kỹ thuật y tế
          </div>
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg text-xs font-semibold bg-sky-600 hover:bg-sky-700 text-white transition-colors cursor-pointer"
          >
            Đã hiểu, đóng cửa sổ
          </button>
        </div>
      </div>
    </div>
  );
};

