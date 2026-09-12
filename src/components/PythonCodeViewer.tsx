import React, { useState } from 'react';
import { Copy, Check, Download, Terminal, FileCode, Package, BookOpen } from 'lucide-react';

const PYTHON_CODE = `\"\"\"
HỆ THỐNG ĐỐI CHIẾU DANH MỤC KỸ THUẬT Y TẾ TỰ ĐỘNG (FUZZY MATCHING)
Chuyên viên phát triển: Data Scientist / Full-stack Python Developer (Lĩnh vực Y tế)
Ứng dụng: Streamlit + Pandas + difflib / thefuzz + openpyxl
\"\"\"

import io
import re
import difflib
import pandas as pd
import streamlit as st

# Cấu hình trang Streamlit
st.set_page_config(
    page_title="Đối Chiếu Danh Mục Kỹ Thuật Y Tế (Fuzzy Matching)",
    page_icon="🏥",
    layout="wide",
    initial_sidebar_state="expanded"
)

# ==========================================
# 1. CÁC HÀM XỬ LÝ DỮ LIỆU & THUẬT TOÁN (CORE)
# ==========================================

# ==========================================
# 1. BẢNG TỪ ĐIỂN BỘ PHẬN GIẢI PHẪU & HỆ CƠ QUAN Y TẾ CHUẨN
# ==========================================

ANATOMY_ONTOLOGY = {
    'OBSTETRICS_GYNECOLOGY': {
        'name': 'Sản - Phụ khoa',
        'terms': [
            'âm hộ', 'am ho', 'âm đạo', 'am dao', 'tầng sinh môn', 'tang sinh mon',
            'cổ tử cung', 'co tu cung', 'tử cung', 'tu cung', 'buồng trứng', 'buong trung',
            'vòi tử cung', 'voi tu cung', 'vòi trứng', 'voi trung', 'lấy thai',
            'mổ đẻ', 'thai', 'bào thai', 'màng ối', 'dây rốn', 'rau thai', 'sản phụ'
        ]
    },
    'OPHTHALMOLOGY': {
        'name': 'Mắt',
        'terms': [
            'bờ mi', 'bo mi', 'mi mắt', 'mi mat', 'mắt', 'mat', 'kết mạc', 'ket mac',
            'giác mạc', 'giac mac', 'củng mạc', 'cung mac', 'thủy tinh thể', 'thuy tinh the',
            'võng mạc', 'vong mac', 'dịch kính', 'dich kinh', 'lệ đạo', 'le dao',
            'hốc mắt', 'hoc mat', 'nhãn cầu', 'nhan cau', 'mộng thịt', 'mong thit'
        ]
    },
    'ENT': {
        'name': 'Tai Mũi Họng',
        'terms': [
            'amidan', 'a mi đan', 'tai', 'mũi', 'mui', 'họng', 'hong', 'thanh quản', 'thanh quan',
            'xoang', 'màng nhĩ', 'mang nhi', 'vòm', 'khẩu cái', 'cuống mũi', 'cuong mui',
            'vách ngăn', 'vach ngan', 'tai giữa', 'tai giua'
        ]
    },
    'ODONTO_STOMATOLOGY': {
        'name': 'Răng Hàm Mặt',
        'terms': [
            'răng', 'rang', 'hàm', 'ham', 'tủy răng', 'tuy rang', 'lợi', 'loi', 'nướu', 'nuou',
            'xương hàm', 'xuong ham', 'khớp thái dương hàm', 'khop thai duong ham',
            'vùng mặt', 'vung mat', 'mặt', 'mat'
        ]
    },
    'GASTROENTEROLOGY': {
        'name': 'Tiêu hóa - Ổ bụng',
        'terms': [
            'ruột thừa', 'ruot thua', 'dạ dày', 'da day', 'thực quản', 'thuc quan',
            'tá tràng', 'ta trang', 'đại tràng', 'dai trang', 'trực tràng', 'truc trang',
            'hậu môn', 'hau mon', 'gan', 'mật', 'mat', 'tụy', 'tuy', 'lách', 'lach',
            'phúc mạc', 'phuc mac', 'ổ bụng', 'o bung', 'ruột non', 'ruot non'
        ]
    },
    'CARDIOLOGY': {
        'name': 'Tim mạch & Lồng ngực',
        'terms': [
            'tim', 'động mạch', 'dong mach', 'tĩnh mạch', 'tinh mach', 'mạch máu', 'mach mau',
            'van tim', 'lồng ngực', 'long nguc', 'phổi', 'phoi', 'màng phổi', 'mang phoi',
            'trung thất', 'trung that', 'catheter'
        ]
    },
    'UROLOGY_NEPHROLOGY': {
        'name': 'Thận - Tiết niệu',
        'terms': [
            'thận', 'than', 'niệu quản', 'nieu quan', 'bàng quang', 'bang quang',
            'niệu đạo', 'nieu dao', 'tiền liệt tuyến', 'tien liet tuyen', 'thẩm tách máu',
            'chạy thận', 'loc mau'
        ]
    },
    'NEUROLOGY_MUSCULOSKELETAL': {
        'name': 'Cơ Xương Khớp & Thần kinh',
        'terms': [
            'cột sống', 'cot song', 'thắt lưng', 'that lung', 'tủy sống', 'tuy song',
            'não', 'nao', 'khớp', 'khop', 'xương', 'xuong', 'gân', 'gan', 'cơ', 'co'
        ]
    }
}

def clean_text(text: any) -> str:
    \"\"\"
    Tiền xử lý chuỗi danh mục kỹ thuật y tế:
    - Chuyển thành chữ thường (lowercase)
    - Xóa các ký tự đặc biệt gây nhiễu thường gặp trong y tế: *, +, -, ,, ., v.v.
    - Loại bỏ khoảng trắng thừa đầu, cuối và giữa các từ.
    \"\"\"
    if pd.isna(text):
        return ""
    text_str = str(text).lower()
    # Loại bỏ các ký tự đặc biệt thường gặp: *, +, -, ,, ., [, ], (, ), :, ;, /, \\
    text_str = re.sub(r"[\\*\\+\\-\\,\\.\\[\\]\\(\\)\\:\\;\\/\\\\_\\"']", " ", text_str)
    # Gom các khoảng trắng thừa liên tiếp thành 1 dấu cách duy nhất và strip
    text_str = re.sub(r"\\s+", " ", text_str).strip()
    return text_str


def decompose_medical_procedure(name: str) -> dict:
    \"\"\"
    Bóc tách ngữ nghĩa danh mục kỹ thuật y tế:
    Tách biệt Hành động kỹ thuật can thiệp và Bộ phận giải phẫu tương ứng.
    \"\"\"
    clean = clean_text(name)
    anatomy_list = []
    category_set = set()
    clean_without_anatomy = clean

    for cat_key, cat_data in ANATOMY_ONTOLOGY.items():
        for term in sorted(cat_data['terms'], key=len, reverse=True):
            pattern = rf"\\b{re.escape(term)}\\b"
            if re.search(pattern, clean):
                if term not in anatomy_list:
                    anatomy_list.append(term)
                    category_set.add(cat_key)
                clean_without_anatomy = re.sub(pattern, ' ', clean_without_anatomy)

    clean_without_anatomy = re.sub(r"\\s+", " ", clean_without_anatomy).strip()
    primary_category = list(category_set)[0] if category_set else None

    return {
        'clean_text': clean,
        'clean_without_anatomy': clean_without_anatomy,
        'anatomy_list': anatomy_list,
        'primary_category': primary_category,
        'categories': list(category_set)
    }


def evaluate_anatomy_compatibility(comp1: dict, comp2: dict) -> dict:
    \"\"\"
    Đánh giá độ tương thích bộ phận giải phẫu giữa 2 kỹ thuật y tế:
    - EXACT_MATCH: Trùng bộ phận giải phẫu cụ thể -> Thưởng điểm
    - SAME_ORGAN_SYSTEM: Cùng hệ cơ quan
    - SEVERE_CONFLICT: Xung đột giải phẫu nghiêm trọng -> Chặn 100%
    \"\"\"
    anat1 = set(comp1.get('anatomy_list', []))
    anat2 = set(comp2.get('anatomy_list', []))
    cats1 = set(comp1.get('categories', []))
    cats2 = set(comp2.get('categories', []))

    if not anat1 and not anat2:
        return {'status': 'GENERIC', 'penalty': 1.0}

    if anat1 and anat2:
        if anat1.intersection(anat2):
            return {'status': 'EXACT_MATCH', 'penalty': 1.0}

        if cats1.intersection(cats2):
            return {'status': 'SAME_ORGAN_SYSTEM', 'penalty': 0.85}

        return {'status': 'SEVERE_CONFLICT', 'penalty': 0.0}

    return {'status': 'GENERIC', 'penalty': 0.9}


class IndexedTargetDict:
    \"\"\"
    Cấu trúc dữ liệu chỉ mục ngược (Inverted Index) kết hợp Bộ Lọc Y Tế 2 Tầng:
    - Tầng 1: Lọc theo Bộ Phận Giải Phẫu & Hệ Cơ Quan (chặn 100% xung đột chuyên khoa).
    - Tầng 2: So khớp chi tiết Tên Kỹ Thuật / Hành động can thiệp.
    \"\"\"
    def __init__(self, choices_dict: dict):
        self.choices_dict = choices_dict
        self.exact_map = {k: v for k, v in choices_dict.items()}
        self.inverted_index = {}
        self.item_lens = {}
        self.components = {}

        for clean_name, (orig_name, code) in choices_dict.items():
            self.item_lens[clean_name] = len(clean_name)
            comp = decompose_medical_procedure(orig_name)
            self.components[clean_name] = comp

            words = [w for w in clean_name.split() if len(w) >= 2]
            for w in set(words):
                if w not in self.inverted_index:
                    self.inverted_index[w] = []
                self.inverted_index[w].append(clean_name)

            for anat in comp['anatomy_list']:
                anat_token = f"__ANAT_{anat}__"
                if anat_token not in self.inverted_index:
                    self.inverted_index[anat_token] = []
                self.inverted_index[anat_token].append(clean_name)

            if comp['primary_category']:
                cat_token = f"__CAT_{comp['primary_category']}__"
                if cat_token not in self.inverted_index:
                    self.inverted_index[cat_token] = []
                self.inverted_index[cat_token].append(clean_name)

    def match(self, query: str, threshold: float = 0.70, enable_anatomy_filter: bool = True) -> tuple:
        if not query or not self.choices_dict:
            return ("", "", 0.0)

        query_comp = decompose_medical_procedure(query)
        clean_query = query_comp['clean_text']

        if clean_query in self.exact_map:
            orig_name, code = self.exact_map[clean_query]
            return (orig_name, code, 100.0)

        q_len = len(clean_query)
        words = [w for w in clean_query.split() if len(w) >= 2]

        candidate_counts = {}
        for w in words:
            if w in self.inverted_index:
                for cand in self.inverted_index[w]:
                    candidate_counts[cand] = candidate_counts.get(cand, 0) + 1

        if enable_anatomy_filter:
            for anat in query_comp['anatomy_list']:
                anat_token = f"__ANAT_{anat}__"
                if anat_token in self.inverted_index:
                    for cand in self.inverted_index[anat_token]:
                        candidate_counts[cand] = candidate_counts.get(cand, 0) + 8

            if query_comp['primary_category']:
                cat_token = f"__CAT_{query_comp['primary_category']}__"
                if cat_token in self.inverted_index:
                    for cand in self.inverted_index[cat_token]:
                        candidate_counts[cand] = candidate_counts.get(cand, 0) + 4

        candidates = []
        if candidate_counts:
            sorted_candidates = sorted(candidate_counts.items(), key=lambda x: x[1], reverse=True)
            candidates = [c[0] for c in sorted_candidates[:50]]
        else:
            for cand, c_len in self.item_lens.items():
                if abs(q_len - c_len) / max(q_len, c_len, 1) <= 0.35:
                    candidates.append(cand)
                    if len(candidates) >= 40:
                        break

        if not candidates:
            return ("", "", 0.0)

        best_orig = ""
        best_code = ""
        best_score = 0.0

        for cand_clean in candidates:
            target_comp = self.components.get(cand_clean) or decompose_medical_procedure(cand_clean)

            if enable_anatomy_filter:
                compat = evaluate_anatomy_compatibility(query_comp, target_comp)
                if compat['status'] == 'SEVERE_CONFLICT':
                    continue

            full_ratio = difflib.SequenceMatcher(None, clean_query, cand_clean).ratio()

            tech_ratio = full_ratio
            if query_comp['clean_without_anatomy'] and target_comp['clean_without_anatomy']:
                tech_ratio = difflib.SequenceMatcher(
                    None, query_comp['clean_without_anatomy'], target_comp['clean_without_anatomy']
                ).ratio()

            if enable_anatomy_filter:
                if compat['status'] == 'EXACT_MATCH':
                    composite_score = 0.50 * full_ratio + 0.35 * tech_ratio + 0.15
                elif compat['status'] == 'SAME_ORGAN_SYSTEM':
                    composite_score = 0.55 * full_ratio + 0.35 * tech_ratio + 0.05
                else:
                    composite_score = full_ratio * compat['penalty']
            else:
                composite_score = full_ratio

            composite_score = min(1.0, composite_score)

            if composite_score > best_score:
                best_score = composite_score
                orig_name, code = self.choices_dict[cand_clean]
                best_orig = orig_name
                best_code = code
                if composite_score >= 0.98:
                    break

        if best_score >= threshold and best_orig:
            return (best_orig, best_code, round(best_score * 100, 1))

        return ("", "", 0.0)


def get_best_match(query: str, choices_dict_or_index, threshold: float = 0.70, enable_anatomy_filter: bool = True) -> tuple:
    \"\"\"
    Tìm kiếm kết quả tương đồng nhất với Bộ Lọc 2 Tầng.
    \"\"\"
    if isinstance(choices_dict_or_index, IndexedTargetDict):
        return choices_dict_or_index.match(query, threshold=threshold, enable_anatomy_filter=enable_anatomy_filter)

    if not query or not choices_dict_or_index:
        return ("", "", 0.0)

    query_comp = decompose_medical_procedure(query)
    clean_query = query_comp['clean_text']

    if clean_query in choices_dict_or_index:
        orig_name, code = choices_dict_or_index[clean_query]
        return (orig_name, code, 100.0)

    cleaned_choices = list(choices_dict_or_index.keys())
    best_matches = difflib.get_close_matches(clean_query, cleaned_choices, n=1, cutoff=threshold)
    if best_matches:
        best_clean = best_matches[0]
        ratio = difflib.SequenceMatcher(None, clean_query, best_clean).ratio()
        if ratio >= threshold:
            orig_name, code = choices_dict_or_index[best_clean]
            return (orig_name, code, round(ratio * 100, 1))

    return ("", "", 0.0)


def read_excel_smart_header(file_bytes, target_keywords: list, default_skiprows: int = 1) -> pd.DataFrame:
    \"\"\"
    Tự động đọc file Excel và tìm kiếm dòng tiêu đề thực tế:
    Quét qua 20 dòng đầu tiên để tìm dòng chứa từ khóa chỉ định (ví dụ 'tên kỹ thuật', 'danh mục kỹ thuật').
    \"\"\"
    try:
        file_bytes.seek(0)
    except Exception:
        pass

    df_raw = pd.read_excel(file_bytes, sheet_name=0, header=None, nrows=20)
    header_row = default_skiprows
    norm_keywords = [clean_text(kw) for kw in target_keywords]
    
    for r_idx in range(len(df_raw)):
        row_values = [clean_text(str(val)) for val in df_raw.iloc[r_idx] if pd.notna(val)]
        if any(any(kw in cell_text for kw in norm_keywords) for cell_text in row_values):
            header_row = r_idx
            break
            
    try:
        file_bytes.seek(0)
    except Exception:
        pass
        
    df = pd.read_excel(file_bytes, sheet_name=0, skiprows=header_row)
    return df


def find_column_by_keyword(df: pd.DataFrame, candidates: list, fallback_idx: int = None) -> str:
    \"\"\"
    Hàm tìm tên cột linh hoạt theo từ khóa (hỗ trợ "tên kỹ thuật", không phân biệt hoa/thường/dấu):
    \"\"\"
    for c in candidates:
        if c in df.columns:
            return c
            
    cleaned_cols = {col: clean_text(str(col)) for col in df.columns}
    norm_candidates = [clean_text(c) for c in candidates]
    
    # Tìm cột chứa cụm từ khóa (ví dụ "ten ky thuat")
    for cand in norm_candidates:
        if not cand:
            continue
        for col, c_text in cleaned_cols.items():
            if cand in c_text:
                return col
                
    for cand in norm_candidates:
        words = [w for w in cand.split() if len(w) >= 2]
        if len(words) >= 2:
            for col, c_text in cleaned_cols.items():
                if all(w in c_text for w in words):
                    return col
                    
    if fallback_idx is not None and 0 <= fallback_idx < len(df.columns):
        return df.columns[fallback_idx]
        
    return None


# ==========================================
# 2. HÀM ĐỌC & CHUẨN BỊ DỮ LIỆU TỪNG FILE
# ==========================================

def process_source_file(file_bytes) -> pd.DataFrame:
    \"\"\"
    Đọc File Gốc:
    - Tự động nhận diện dòng tiêu đề chứa 'danh mục kỹ thuật' hoặc 'tên kỹ thuật'
    - Lấy cột Tên và cột Mã TT 43, 21
    \"\"\"
    df = read_excel_smart_header(
        file_bytes, 
        target_keywords=["danh mục kỹ thuật", "tên kỹ thuật", "tên danh mục"],
        default_skiprows=1
    )
    
    col_name = find_column_by_keyword(
        df, 
        ["tên kỹ thuật", "danh mục kỹ thuật", "tên danh mục kỹ thuật", "tên danh mục"],
        fallback_idx=2
    )
    col_code = find_column_by_keyword(
        df, 
        ["mã tt 43, 21", "mã tt 43", "mã kỹ thuật", "mã"],
        fallback_idx=1
    )
    
    if not col_name:
        raise ValueError(
            f"File Danh mục gốc không tìm thấy cột chứa từ khóa 'Tên kỹ thuật' hoặc 'Danh mục kỹ thuật'. "
            f"Các cột hiện có: {list(df.columns)}"
        )
    if not col_code:
        raise ValueError(
            f"File Danh mục gốc không tìm thấy cột 'Mã TT 43, 21'. "
            f"Các cột hiện có: {list(df.columns)}"
        )
        
    df_clean = df[[col_code, col_name]].copy()
    df_clean.columns = ["Ma_Goc", "Ten_Goc"]
    df_clean = df_clean.dropna(subset=["Ten_Goc"]).reset_index(drop=True)
    return df_clean


def process_pl1_file(file_bytes) -> dict:
    \"\"\"
    Đọc File Phụ lục 1:
    - Tự động nhận diện dòng tiêu đề chứa 'tên kỹ thuật'
    - Lấy cột Tên (cột 4) và Mã kỹ thuật (cột 2)
    \"\"\"
    df = read_excel_smart_header(
        file_bytes, 
        target_keywords=["tên kỹ thuật", "mã kỹ thuật"],
        default_skiprows=3
    )
    
    # 🎯 Tìm cột Tên theo từ khóa "tên kỹ thuật"
    col_name = find_column_by_keyword(
        df, 
        ["tên kỹ thuật", "tên kỹ thuật (cột 4)", "cột 4", "tên"],
        fallback_idx=3
    )
    col_code = find_column_by_keyword(
        df, 
        ["mã kỹ thuật", "mã kỹ thuật (cột 2)", "cột 2", "mã"],
        fallback_idx=1
    )
    
    if not col_name:
        raise ValueError(
            f"File Phụ lục 1 không tìm thấy cột chứa từ khóa 'Tên kỹ thuật'. "
            f"Các cột đọc được: {list(df.columns)}"
        )
    if not col_code:
        raise ValueError(
            f"File Phụ lục 1 không tìm thấy cột 'Mã kỹ thuật'. "
            f"Các cột đọc được: {list(df.columns)}"
        )
        
    choices_dict = {}
    for _, row in df.iterrows():
        name = row[col_name]
        code = row[col_code]
        if pd.notna(name):
            orig_name = str(name).strip()
            c_name = clean_text(orig_name)
            str_code = str(code).strip() if pd.notna(code) else ""
            if c_name and c_name not in choices_dict:
                choices_dict[c_name] = (orig_name, str_code)
                
    return choices_dict


def process_pl2_file(file_bytes) -> dict:
    \"\"\"
    Đọc File Phụ lục 2:
    - Tự động nhận diện dòng tiêu đề chứa từ khóa 'tên kỹ thuật' hoặc 'mã liên kết'
    - Lấy cột Tên kỹ thuật và Mã liên kết
    \"\"\"
    df = read_excel_smart_header(
        file_bytes, 
        target_keywords=["tên kỹ thuật", "mã liên kết", "mã tương đương"],
        default_skiprows=1
    )
    
    # 🎯 TÌM CỘT THEO TỪ KHÓA "TÊN KỸ THUẬT"
    col_name = find_column_by_keyword(
        df, 
        ["tên kỹ thuật", "tên kỹ thuật (cột 5)", "cột 5", "tên dịch vụ", "tên"],
        fallback_idx=4
    )
    col_code = find_column_by_keyword(
        df, 
        ["mã liên kết", "mã liên kết (cột 4)", "mã tương đương", "mã kỹ thuật", "cột 4", "mã"],
        fallback_idx=3
    )
    
    if not col_name:
        raise ValueError(
            f"File Phụ lục 2 không tìm thấy cột chứa từ khóa 'Tên kỹ thuật'. "
            f"Các cột đọc được: {list(df.columns)}"
        )
    if not col_code:
        raise ValueError(
            f"File Phụ lục 2 không tìm thấy cột mã liên kết. "
            f"Các cột đọc được: {list(df.columns)}"
        )
        
    choices_dict = {}
    for _, row in df.iterrows():
        name = row[col_name]
        code = row[col_code]
        if pd.notna(name):
            orig_name = str(name).strip()
            c_name = clean_text(orig_name)
            str_code = str(code).strip() if pd.notna(code) else ""
            if c_name and c_name not in choices_dict:
                choices_dict[c_name] = (orig_name, str_code)
                
    return choices_dict


# ==========================================
# 3. GIAO DIỆN STREAMLIT CHÍNH
# ==========================================

def main():
    # Tiêu đề ứng dụng
    st.markdown(
        \"\"\"
        <div style="background: linear-gradient(135deg, #1e3a8a 0%, #0284c7 100%); padding: 22px 28px; border-radius: 12px; color: white; margin-bottom: 24px;">
            <h1 style="margin: 0; font-size: 26px; font-weight: 700;">
                🏥 Hệ Thống Đối Chiếu Danh Mục Kỹ Thuật Y Tế Tự Động (Fuzzy Matching)
            </h1>
            <p style="margin: 8px 0 0 0; font-size: 15px; opacity: 0.92;">
                Tự động đối chiếu danh mục kỹ thuật y tế từ <b>File gốc</b> sang <b>Phụ lục 1 (TT23)</b> và <b>Phụ lục 2 (TT23)</b> theo Thông tư Bộ Y tế bằng thuật toán so khớp chuỗi mờ thông minh.
            </p>
        </div>
        \"\"\",
        unsafe_allow_html=True
    )
    
    # Sidebar: Cài đặt và Hướng dẫn
    with st.sidebar:
        st.header("⚙️ Cấu Hình Thuật Toán")
        threshold_pct = st.slider(
            "Ngưỡng tương đồng tối thiểu (Threshold)",
            min_value=50,
            max_value=95,
            value=70,
            step=5,
            help="Nếu độ tương đồng giữa tên gốc và tên phụ lục >= ngưỡng này thì sẽ lấy kết quả; nhỏ hơn sẽ để trống."
        )
        threshold = threshold_pct / 100.0
        
        st.markdown("---")
        st.subheader("📋 Quy định cấu trúc file:")
        st.markdown(\"\"\"
        - **File Gốc:** \`skiprows=1\`, Cột *"Danh mục kỹ thuật"*, *"Mã TT 43, 21"*
        - **Phụ lục 1:** \`skiprows=3\`, Cột *"Tên kỹ thuật (cột 4)"*, *"Mã kỹ thuật (cột 2)"*
        - **Phụ lục 2:** \`skiprows=1\`, Cột *"Tên kỹ thuật (cột 5)"*, *"Mã liên kết (cột 4)"*
        \"\"\")
        
        st.markdown("---")
        st.info("💡 **Gợi ý:** Thuật toán tự động làm sạch ký tự nhiễu (*, +, -, ...) và tìm kiếm chuỗi tương đồng cao nhất.")

    # Khu vực Upload 3 File
    st.subheader("📂 1. Tải lên các file dữ liệu (.xlsx)")
    
    col1, col2, col3 = st.columns(3)
    
    with col1:
        st.markdown("##### 📄 File Danh mục gốc")
        file_goc = st.file_uploader(
            "Chọn file Gốc (.xlsx)", 
            type=["xlsx"], 
            key="file_goc",
            help="File danh mục kỹ thuật tại cơ sở khám chữa bệnh"
        )
        
    with col2:
        st.markdown("##### 📗 File Phụ lục 1 - TT23")
        file_pl1 = st.file_uploader(
            "Chọn file Phụ lục 1 (.xlsx)", 
            type=["xlsx"], 
            key="file_pl1",
            help="Danh mục kỹ thuật Phụ lục 1 Thông tư 23/2024/TT-BYT"
        )
        
    with col3:
        st.markdown("##### 📘 File Phụ lục 2 - TT23")
        file_pl2 = st.file_uploader(
            "Chọn file Phụ lục 2 (.xlsx)", 
            type=["xlsx"], 
            key="file_pl2",
            help="Danh mục kỹ thuật Phụ lục 2 Thông tư 23/2024/TT-BYT"
        )

    st.markdown("---")
    st.subheader("🚀 2. Thực hiện Đối chiếu (Mapping)")
    
    # Nút bấm bắt đầu chạy
    start_mapping = st.button("Bắt đầu chạy Đối chiếu (Mapping)", type="primary", use_container_width=True)
    
    if start_mapping:
        # Kiểm tra upload đủ 3 file
        if not file_goc or not file_pl1 or not file_pl2:
            st.error("⚠️ Vui lòng tải lên đầy đủ cả 3 file: File Gốc, File Phụ lục 1 và File Phụ lục 2 trước khi bắt đầu!")
            return
            
        try:
            status_container = st.container()
            progress_bar = st.progress(0)
            status_text = st.empty()
            
            # Bước 1: Đọc và tiền xử lý dữ liệu
            status_text.text("Đang nạp và kiểm tra dữ liệu từ File Danh mục gốc...")
            df_goc = process_source_file(file_goc)
            progress_bar.progress(15)
            
            status_text.text("Đang xử lý từ điển kỹ thuật Phụ lục 1...")
            dict_pl1 = process_pl1_file(file_pl1)
            progress_bar.progress(30)
            
            status_text.text("Đang xử lý từ điển kỹ thuật Phụ lục 2...")
            dict_pl2 = process_pl2_file(file_pl2)
            progress_bar.progress(45)
            
            total_items = len(df_goc)
            st.info(f"📊 Đã nạp thành công: **{total_items}** mục từ File Gốc | **{len(dict_pl1)}** mục PL1 | **{len(dict_pl2)}** mục PL2")
            
            # Bước 2: Chạy thuật toán Fuzzy Matching
            results = []
            status_text.text(f"Đang tiến hành so khớp mờ cho {total_items} dịch vụ kỹ thuật...")
            
            for i, row in df_goc.iterrows():
                ten_goc_raw = str(row["Ten_Goc"]).strip()
                ma_goc = str(row["Ma_Goc"]).strip() if pd.notna(row["Ma_Goc"]) else ""
                
                # Làm sạch text
                query_clean = clean_text(ten_goc_raw)
                
                # Khớp với Phụ lục 1
                pl1_name, pl1_code, _ = get_best_match(query_clean, dict_pl1, threshold=threshold)
                
                # Khớp với Phụ lục 2
                pl2_name, pl2_code, _ = get_best_match(query_clean, dict_pl2, threshold=threshold)
                
                # Tạo hàng kết quả theo ĐÚNG 10 cột yêu cầu:
                stt_idx = i + 1
                results.append({
                    "Stt 1": stt_idx,
                    "Stt 2": stt_idx,
                    "Mã TT 43, 21": ma_goc,
                    "Mã TT 23 (PL1)": pl1_code,
                    "Mã TT 23 (PL2)": pl2_code,
                    "Tên Danh mục kỹ thuật theo Thông tư 32/2023/TT-BYT": ten_goc_raw,
                    "Tên DMKT theo Phụ lục 1 Thông tư 23/2024/TT-BYT": pl1_name,
                    "Tên DMKT theo Phụ lục 2 Thông tư 23/2024/TT-BYT": pl2_name,
                    "QTKT tương ứng tại Bệnh viện": "",
                    "Số Đơn vị thực hiện": ""
                })
                
                # Cập nhật thanh tiến trình theo chu kỳ
                if (i + 1) % max(1, total_items // 20) == 0 or (i + 1) == total_items:
                    pct = 45 + int(((i + 1) / total_items) * 50)
                    progress_bar.progress(min(pct, 95))
                    status_text.text(f"Đang đối chiếu: {i + 1}/{total_items} danh mục kỹ thuật...")
            
            # Chuyển kết quả thành DataFrame
            df_result = pd.DataFrame(results)
            
            progress_bar.progress(100)
            status_text.text("✅ Hoàn thành đối chiếu thành công!")
            
            # Đếm thống kê khớp
            matched_pl1_count = sum(1 for r in results if r["Tên DMKT theo Phụ lục 1 Thông tư 23/2024/TT-BYT"] != "")
            matched_pl2_count = sum(1 for r in results if r["Tên DMKT theo Phụ lục 2 Thông tư 23/2024/TT-BYT"] != "")
            
            st.success(
                f"🎉 **Đối chiếu hoàn tất!** "
                f"Khớp thành công PL1: **{matched_pl1_count}/{total_items}** ({round(matched_pl1_count/total_items*100, 1)}%) | "
                f"Khớp thành công PL2: **{matched_pl2_count}/{total_items}** ({round(matched_pl2_count/total_items*100, 1)}%) "
                f"với ngưỡng tương đồng ≥ {threshold_pct}%."
            )
            
            # Bảng xem trước kết quả
            st.markdown("---")
            st.subheader("👁️ 3. Xem trước kết quả (Preview 10 dòng đầu tiên)")
            st.dataframe(df_result.head(10), use_container_width=True)
            
            # Chuẩn bị file Excel để download
            excel_buffer = io.BytesIO()
            with pd.ExcelWriter(excel_buffer, engine="openpyxl") as writer:
                df_result.to_excel(writer, index=False, sheet_name="Ket_qua_Mapping")
                
                # Tự động căn chỉnh độ rộng cột Excel
                worksheet = writer.sheets["Ket_qua_Mapping"]
                for col in worksheet.columns:
                    max_len = max(len(str(cell.value or "")) for cell in col)
                    col_letter = col[0].column_letter
                    worksheet.column_dimensions[col_letter].width = max(max_len + 3, 12)
                    
            excel_data = excel_buffer.getvalue()
            
            st.markdown("---")
            st.subheader("💾 4. Tải xuống kết quả hoàn chỉnh")
            st.download_button(
                label="📥 Tải file Ket_qua_Mapping_DMKT.xlsx",
                data=excel_data,
                file_name="Ket_qua_Mapping_DMKT.xlsx",
                mime="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                type="primary",
                use_container_width=True
            )
            
        except Exception as e:
            st.error(f"❌ **Đã xảy ra lỗi trong quá trình xử lý:** {str(e)}")
            st.info("Vui lòng kiểm tra lại định dạng file, dòng tiêu đề bỏ qua (skiprows), và tên cột trong các file đã tải lên.")


if __name__ == "__main__":
    main()
`;

const REQUIREMENTS_TXT = `streamlit>=1.30.0
pandas>=2.0.0
openpyxl>=3.1.2
thefuzz>=0.22.1
python-Levenshtein>=0.23.0
`;

export const PythonCodeViewer: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'app' | 'req' | 'guide'>('app');
  const [copied, setCopied] = useState<string | null>(null);

  const handleCopy = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopied(id);
    setTimeout(() => setCopied(null), 2000);
  };

  const handleDownloadFile = (content: string, filename: string, mime: string) => {
    const blob = new Blob([content], { type: mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div id="python-code-section" className="bg-white border border-slate-200 rounded-xl shadow-xs overflow-hidden">
      {/* Header */}
      <div className="p-4 bg-slate-900 text-white flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <FileCode className="w-5 h-5 text-sky-400" />
          <h3 className="font-semibold text-base text-slate-100">
            Mã Nguồn Python Đóng Gói (Streamlit App) & Hướng Dẫn Cài Đặt
          </h3>
        </div>
        <div className="flex items-center gap-2">
          <button
            id="download-app-py-btn"
            onClick={() => handleDownloadFile(PYTHON_CODE, 'app.py', 'text/x-python')}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-sky-600 hover:bg-sky-500 text-white transition-colors cursor-pointer"
          >
            <Download className="w-3.5 h-3.5" />
            Tải app.py
          </button>
          <button
            id="download-requirements-txt-btn"
            onClick={() => handleDownloadFile(REQUIREMENTS_TXT, 'requirements.txt', 'text/plain')}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition-colors cursor-pointer"
          >
            <Package className="w-3.5 h-3.5" />
            Tải requirements.txt
          </button>
        </div>
      </div>

      {/* Navigation tabs */}
      <div className="flex border-b border-slate-200 bg-slate-50 px-4">
        <button
          id="tab-app-py"
          onClick={() => setActiveTab('app')}
          className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors cursor-pointer flex items-center gap-2 ${
            activeTab === 'app'
              ? 'border-sky-600 text-sky-700 bg-white'
              : 'border-transparent text-slate-600 hover:text-slate-900'
          }`}
        >
          <FileCode className="w-4 h-4" />
          app.py (Mã nguồn chính)
        </button>
        <button
          id="tab-requirements"
          onClick={() => setActiveTab('req')}
          className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors cursor-pointer flex items-center gap-2 ${
            activeTab === 'req'
              ? 'border-sky-600 text-sky-700 bg-white'
              : 'border-transparent text-slate-600 hover:text-slate-900'
          }`}
        >
          <Package className="w-4 h-4" />
          requirements.txt
        </button>
        <button
          id="tab-guide"
          onClick={() => setActiveTab('guide')}
          className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors cursor-pointer flex items-center gap-2 ${
            activeTab === 'guide'
              ? 'border-sky-600 text-sky-700 bg-white'
              : 'border-transparent text-slate-600 hover:text-slate-900'
          }`}
        >
          <BookOpen className="w-4 h-4" />
          Hướng dẫn chạy máy cá nhân
        </button>
      </div>

      {/* Tab content */}
      <div className="p-4">
        {activeTab === 'app' && (
          <div className="space-y-2">
            <div className="flex justify-between items-center text-xs text-slate-500 pb-1">
              <span>Đóng gói 1 file app.py duy nhất, tích hợp Streamlit, Pandas, difflib, và openpyxl.</span>
              <button
                id="copy-app-py-code"
                onClick={() => handleCopy(PYTHON_CODE, 'app')}
                className="inline-flex items-center gap-1 text-slate-700 hover:text-sky-700 font-medium cursor-pointer"
              >
                {copied === 'app' ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                {copied === 'app' ? 'Đã sao chép!' : 'Sao chép code'}
              </button>
            </div>
            <pre className="p-4 bg-slate-950 text-slate-200 rounded-lg text-xs leading-relaxed overflow-x-auto max-h-[500px] font-mono select-all">
              <code>{PYTHON_CODE}</code>
            </pre>
          </div>
        )}

        {activeTab === 'req' && (
          <div className="space-y-3">
            <div className="flex justify-between items-center text-xs text-slate-500">
              <span>Danh sách các thư viện cần cài đặt để chạy app:</span>
              <button
                id="copy-req-txt"
                onClick={() => handleCopy(REQUIREMENTS_TXT, 'req')}
                className="inline-flex items-center gap-1 text-slate-700 hover:text-sky-700 font-medium cursor-pointer"
              >
                {copied === 'req' ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                {copied === 'req' ? 'Đã sao chép!' : 'Sao chép nội dung'}
              </button>
            </div>
            <pre className="p-4 bg-slate-950 text-slate-200 rounded-lg text-xs font-mono">
              <code>{REQUIREMENTS_TXT}</code>
            </pre>
          </div>
        )}

        {activeTab === 'guide' && (
          <div className="space-y-4 text-sm text-slate-700">
            <div className="p-4 bg-sky-50 border border-sky-200 rounded-lg">
              <h4 className="font-semibold text-sky-900 flex items-center gap-2 mb-2">
                <Terminal className="w-4 h-4 text-sky-700" />
                Các bước cài đặt và khởi chạy trên máy tính cá nhân (Windows / macOS / Linux)
              </h4>
              <p className="text-xs text-sky-800 leading-normal">
                Bạn chỉ cần máy tính đã cài đặt Python (phiên bản 3.9, 3.10, 3.11 hoặc 3.12).
              </p>
            </div>

            <div className="space-y-3">
              <div className="border border-slate-200 rounded-lg p-3 bg-white">
                <div className="font-semibold text-slate-900 text-xs mb-1">
                  Bước 1: Tạo thư mục dự án và lưu file
                </div>
                <p className="text-xs text-slate-600 mb-2">
                  Tải 2 file <code className="bg-slate-100 px-1 py-0.5 rounded text-sky-800">app.py</code> và <code className="bg-slate-100 px-1 py-0.5 rounded text-sky-800">requirements.txt</code> vào chung một thư mục (ví dụ: <code className="bg-slate-100 px-1 py-0.5 rounded">medical_mapping</code>).
                </p>
              </div>

              <div className="border border-slate-200 rounded-lg p-3 bg-white">
                <div className="font-semibold text-slate-900 text-xs mb-1">
                  Bước 2: Mở Terminal / PowerShell và tạo môi trường ảo (Khuyến nghị)
                </div>
                <div className="bg-slate-900 text-slate-200 p-2.5 rounded font-mono text-xs overflow-x-auto space-y-1">
                  <div className="text-slate-400"># Windows:</div>
                  <div>python -m venv venv</div>
                  <div>venv\Scripts\activate</div>
                  <div className="text-slate-400 pt-1"># macOS / Linux:</div>
                  <div>python3 -m venv venv</div>
                  <div>source venv/bin/activate</div>
                </div>
              </div>

              <div className="border border-slate-200 rounded-lg p-3 bg-white">
                <div className="font-semibold text-slate-900 text-xs mb-1">
                  Bước 3: Cài đặt các thư viện phụ thuộc
                </div>
                <div className="bg-slate-900 text-slate-200 p-2.5 rounded font-mono text-xs overflow-x-auto">
                  pip install -r requirements.txt
                </div>
              </div>

              <div className="border border-slate-200 rounded-lg p-3 bg-white">
                <div className="font-semibold text-slate-900 text-xs mb-1">
                  Bước 4: Khởi chạy Web App Streamlit
                </div>
                <div className="bg-slate-900 text-slate-200 p-2.5 rounded font-mono text-xs overflow-x-auto">
                  streamlit run app.py
                </div>
                <p className="text-xs text-emerald-700 mt-2 font-medium">
                  Trình duyệt web của bạn sẽ tự động mở trang: <code className="bg-emerald-50 text-emerald-800 px-1.5 py-0.5 rounded">http://localhost:8501</code>
                </p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
