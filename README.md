# 🏥 Hệ Thống Đối Chiếu Danh Mục Kỹ Thuật Y Tế Tự Động (Fuzzy Matching)

> **Giải pháp chuyển đổi và đối chiếu danh mục kỹ thuật y tế tự động** từ Danh mục kỹ thuật cơ sở khám chữa bệnh (Thông tư 32/2023/TT-BYT) sang **Phụ lục 1** và **Phụ lục 2** (Thông tư 23/2024/TT-BYT của Bộ Y tế).
> Được tối ưu hóa chuyên biệt để chạy mượt mà trên **GitHub & Vercel**, xử lý siêu tốc các **tập tin Excel lớn nhiều dòng (từ hàng ngàn đến hàng vạn dòng)** mà không bị đơ trình duyệt hay lỗi Timeout.

---

## ⚡ Các Tính Năng Nổi Bật Cho File Excel Lớn (Big Data)

Khi đối chiếu mờ (Fuzzy Matching) giữa 2 danh mục y tế (ví dụ: File Gốc 5.000 dòng đối chiếu với 15.000 dòng ở Phụ lục), thuật toán duyệt lặp 2 vòng lồng thông thường sẽ sinh ra $5.000 \times 15.000 = 75.000.000$ phép so sánh chuỗi ký tự, gây đơ tab trình duyệt hoặc lỗi Serverless Timeout (10 giây trên Vercel). 

Ứng dụng đã được tái kiến trúc với các giải pháp tối ưu:

1. **Chỉ Mục Đảo & Chặn Lọc Ứng Viên (Inverted Index Candidate Pruning):**
   - Tiền xử lý tạo từ điển chỉ mục ngược từ khóa y tế trong vòng vài phần nghìn giây.
   - Với mỗi dịch vụ kỹ thuật cần khớp, hệ thống chỉ lọc ra 20-40 ứng viên tiềm năng nhất thay vì duyệt qua toàn bộ 15.000 mục, **giảm 99.7% lượng tính toán thừa**.
2. **Khớp Tuyệt Đối $O(1)$ Qua Hash Map:**
   - Hàng nghìn dịch vụ trùng tên sau khi làm sạch ký tự nhiễu (`*`, `+`, `-`, khoảng trắng thừa) được trả về ngay tức thì (điểm 100%) trong $0.0001$ms.
3. **Cắt Tỉa Toán Học & Levenshtein Mảng 1 Chiều:**
   - Loại bỏ phép tính khoảng cách chỉnh sửa nếu chênh lệch độ dài giữa 2 chuỗi vượt ngưỡng cho phép.
4. **Chia Nhỏ Tác Vụ Bất Đồng Bộ (Non-blocking Chunked Batching):**
   - Xử lý theo từng khối 50 dòng và nhường quyền (yield) cho trình duyệt.
   - Hiển thị trực tiếp: **Tốc độ (dòng/giây)**, **Thời gian ước tính còn lại**, và nút **Hủy/Dừng** tiến trình bất cứ lúc nào.
5. **Phân Trang Hiển Thị Thông Minh (DOM Pagination):**
   - Dù kết quả có 10.000 hay 50.000 dòng, giao diện chỉ hiển thị số dòng theo trang (15, 25, 50, 100 dòng/trang), đảm bảo giao diện luôn mượt mà ở 60fps.
6. **100% Client-Side Private & Unlimited Timeout:**
   - Toàn bộ tính toán diễn ra trực tiếp trên trình duyệt của người dùng.
   - **Không phụ thuộc vào Serverless Function** $\rightarrow$ Không lo bị giới hạn Timeout 10s của gói Vercel Hobby.
   - **Bảo mật dữ liệu y tế tuyệt đối**: File Excel của bệnh viện không bao giờ gửi ra server bên thứ 3.

---

## 🚀 Hướng Dẫn Triển Khai Lên GitHub & Vercel

### Cách 1: Đẩy mã nguồn lên GitHub

1. Tạo một repository mới trên GitHub (ví dụ: `dmkt-fuzzy-matching`).
2. Mở Terminal tại thư mục dự án và chạy các lệnh:

```bash
# Khởi tạo Git
git init

# Thêm tất cả các file
git add .

# Tạo commit
git commit -m "feat: Medical DMKT fuzzy matcher optimized for big data & Vercel"

# Đổi nhánh chính thành main
git branch -M main

# Thêm remote link của repository bạn vừa tạo
git remote add origin https://github.com/<YOUR_USERNAME>/<YOUR_REPO_NAME>.git

# Đẩy code lên GitHub
git push -u origin main
```

---

### Cách 2: Triển khai lên Vercel (Hoàn toàn Miễn phí & Tự động)

1. Truy cập [vercel.com](https://vercel.com) và đăng nhập bằng tài khoản **GitHub**.
2. Nhấn **"Add New..."** $\rightarrow$ Chọn **"Project"**.
3. Chọn repository GitHub vừa tạo ở bước trên.
4. Vercel sẽ tự động phát hiện cấu hình từ file `vercel.json`:
   - **Framework Preset**: `Vite`
   - **Build Command**: `npm run build`
   - **Output Directory**: `dist`
5. Nhấn **"Deploy"**. Sau khoảng 30 giây, ứng dụng của bạn sẽ có một đường link công khai dạng:
   `https://<ten-du-an>.vercel.app`
6. Mỗi khi bạn đẩy commit mới lên nhánh `main` của GitHub, Vercel sẽ tự động build và cập nhật phiên bản mới nhất!

---

## 💻 Chạy Cục Bộ (Local Development)

### 1. Phiên bản Web Hiện đại (React + TypeScript + Vite)
```bash
# Cài đặt thư viện
npm install

# Khởi chạy server phát triển
npm run dev
# Ứng dụng chạy tại http://localhost:3000
```

### 2. Phiên bản Python Streamlit (Tùy chọn)
Nếu cơ sở y tế muốn chạy kịch bản Python nội bộ:
```bash
# Tạo môi trường ảo
python -m venv venv

# Kích hoạt môi trường (Windows: venv\Scripts\activate, Mac/Linux: source venv/bin/activate)
source venv/bin/activate

# Cài đặt thư viện
pip install -r requirements.txt

# Chạy ứng dụng Streamlit
streamlit run app.py
```

---

## 📋 Quy Chuẩn Cấu Trúc 3 File Excel Đầu Vào

| Tập tin | Bỏ qua dòng (skiprows) | Cột Tên Kỹ Thuật | Cột Mã Kỹ Thuật |
| :--- | :---: | :--- | :--- |
| **File Danh mục gốc** | `skiprows=1` (dòng 2 là header) | `Danh mục kỹ thuật` | `Mã TT 43, 21` |
| **Phụ lục 1 (TT23)** | `skiprows=3` (dòng 4 là header) | `Tên kỹ thuật (cột 4)` | `Mã kỹ thuật (cột 2)` |
| **Phụ lục 2 (TT23)** | `skiprows=1` (dòng 2 là header) | `Tên kỹ thuật\n(cột 5)` | `Mã liên kết\n(cột 4)` |

### File Xuất Chuẩn 10 Cột: `Ket_qua_Mapping_DMKT.xlsx`
1. `Stt 1`
2. `Stt 2`
3. `Mã TT 43, 21`
4. `Mã TT 23 (PL1)`
5. `Mã TT 23 (PL2)`
6. `Tên Danh mục kỹ thuật theo Thông tư 32/2023/TT-BYT`
7. `Tên DMKT theo Phụ lục 1 Thông tư 23/2024/TT-BYT`
8. `Tên DMKT theo Phụ lục 2 Thông tư 23/2024/TT-BYT`
9. `QTKT tương ứng tại Bệnh viện`
10. `Số Đơn vị thực hiện`

---

## 🛡️ Bản Quyền & Giấy Phép
Dự án được xây dựng phục vụ chuyển đổi số ngành Y tế Việt Nam, tuân thủ các quy định chuyên môn kỹ thuật của Bộ Y tế.
