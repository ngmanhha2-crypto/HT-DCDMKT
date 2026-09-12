/**
 * Module Phân Tích Ngữ Nghĩa Y Tế (Medical NLP & Anatomy Decomposer)
 * Bóc tách tên dịch vụ kỹ thuật y tế thành các thành phần cốt lõi:
 * 1. Nhóm Hành Động / Bản chất Kỹ thuật (Action Modality: Can thiệp, Đo lường/Xét nghiệm, Phẫu thuật...)
 * 2. Động từ hành động can thiệp cụ thể (Specific Actions: đặt, rút, đo, phẫu thuật, cắt, khâu...)
 * 3. Bộ phận giải phẫu / Vị trí cơ thể / Cơ quan đích (Anatomical Site & Organ System)
 * 4. Đối tượng can thiệp chính (Core Target Entity - đã khử từ rỗng và trạng từ)
 * 5. Các từ bổ trợ / trạng từ (Modifiers: liên tục, tại giường, cấp cứu, thường quy...)
 */

export type ActionModality =
  | 'THU_THUAT_CAN_THIEP'    // Đặt/rút ống thông, catheter, sonde, chọc hút, rửa, bơm, thụt tháo, tiêm truyền...
  | 'XET_NGHIEM_DO_LUONG'    // Đo chỉ số, định lượng, định tính, xét nghiệm sinh hóa, huyết học, test nhanh...
  | 'PHAU_THUAT_XAM_LAN'    // Mổ, phẫu thuật, cắt bỏ, khâu phục hồi, tái tạo, ghép, tán sỏi, kết hợp xương...
  | 'CHAN_DOAN_HINH_ANH'    // Chụp X-quang, CT Scanner, MRI, siêu âm chẩn đoán, xạ hình...
  | 'THAM_DO_CHUC_NANG'     // Điện tâm đồ (ECG), điện não (EEG), đo chức năng hô hấp, đo lưu huyết não...
  | 'VAT_LY_TRI_LIEU_PHCN'  // Kéo giãn, tập vận động, siêu âm trị liệu, sóng ngắn, châm cứu, xoa bóp...
  | 'KHAM_HOI_CHAN';        // Khám bệnh, hội chẩn, tư vấn...

export interface ActionModalityMeta {
  name: string;
  description: string;
  priority: number;
}

export const ACTION_MODALITY_INFO: Record<ActionModality, ActionModalityMeta> = {
  THU_THUAT_CAN_THIEP: {
    name: 'Thủ thuật can thiệp / Điều dưỡng',
    description: 'Đặt/rút ống thông, catheter, sonde, rửa, bơm, thụt tháo, chọc dò, dẫn lưu, tiêm truyền...',
    priority: 1,
  },
  XET_NGHIEM_DO_LUONG: {
    name: 'Xét nghiệm / Đo lường sinh hóa',
    description: 'Đo nồng độ/chỉ số sinh học, định lượng, định tính, xét nghiệm máu, nước tiểu, test...',
    priority: 1,
  },
  PHAU_THUAT_XAM_LAN: {
    name: 'Phẫu thuật xâm lấn ngoại khoa',
    description: 'Phẫu thuật mở, nội soi can thiệp, cắt, khâu phục hồi, tái tạo, ghép, tán sỏi...',
    priority: 1,
  },
  CHAN_DOAN_HINH_ANH: {
    name: 'Chẩn đoán hình ảnh',
    description: 'Chụp X-quang, CT Scanner, MRI, siêu âm, xạ hình...',
    priority: 1,
  },
  THAM_DO_CHUC_NANG: {
    name: 'Thăm dò chức năng',
    description: 'Điện tâm đồ (ECG), điện não (EEG), đo chức năng hô hấp, đo áp lực...',
    priority: 2,
  },
  VAT_LY_TRI_LIEU_PHCN: {
    name: 'Vật lý trị liệu & Phục hồi chức năng',
    description: 'Tập vận động, kéo giãn, điện xung, châm cứu, sóng ngắn...',
    priority: 2,
  },
  KHAM_HOI_CHAN: {
    name: 'Khám lâm sàng & Hội chẩn',
    description: 'Khám chuyên khoa, hội chẩn liên viện, tư vấn...',
    priority: 3,
  },
};

export interface MedicalComponent {
  originalText: string;
  cleanText: string;
  actions: string[];              // Danh sách hành động: "đặt", "đo", "khâu", "cắt"...
  modalities: ActionModality[];   // Danh sách các nhóm hành động nhận diện được
  primaryModality: ActionModality | null; // Nhóm hành động chủ đạo (dominant modality)
  anatomyList: string[];          // Danh sách bộ phận: "ống thông tiểu", "đường huyết", "dạ dày"...
  primaryCategory: string | null; // Chuyên khoa / Hệ cơ quan: "DIEU_DUONG_THU_THUAT", "XET_NGHIEM_CHUYEN_HOA", v.v.
  cleanWithoutAnatomy: string;    // Chuỗi kỹ thuật sau khi đã lược bỏ bộ phận
  coreTarget: string;             // Thực thể can thiệp cốt lõi (sau khi lọc bỏ hành động và từ rỗng)
  modifiers: string[];            // Các từ bổ nghĩa: "liên tục", "tại giường", "cấp cứu"...
}

export interface AnatomyCategoryInfo {
  id: string;
  name: string;
  keywords: string[];
}

/**
 * Từ điển các Hệ cơ quan & Bộ phận giải phẫu & Lĩnh vực lâm sàng chuẩn y tế Việt Nam
 */
export const ANATOMY_ONTOLOGY: Record<string, { name: string; terms: string[] }> = {
  // 1. THỦ THUẬT ĐIỀU DƯỠNG & CHĂM SÓC CAN THIỆP (RẤT QUAN TRỌNG ĐỂ PHÂN BIỆT VỚI XÉT NGHIỆM/NGOẠI KHOA)
  DIEU_DUONG_THU_THUAT: {
    name: 'Thủ thuật Điều dưỡng / Chăm sóc can thiệp',
    terms: [
      'ống thông tiểu', 'ong thong tieu', 'thông tiểu', 'thong tieu',
      'sonde tiểu', 'sonde tieu', 'catheter tiểu', 'catheter tieu', 'foley', 'ống foley',
      'ống thông bàng quang', 'ong thong bang quang', 'dẫn lưu bàng quang', 'dan luu bang quang',
      'sonde dạ dày', 'sonde da day', 'ống thông dạ dày', 'ong thong da day', 'ống levin', 'ong levin',
      'rửa dạ dày', 'rua da day', 'thụt tháo', 'thut thao', 'thụt giữ', 'thut giu',
      'thụt đại tràng', 'thut dai trang', 'thụt phân', 'thut phan',
      'catheter tĩnh mạch', 'catheter tinh mach', 'tĩnh mạch ngoại vi', 'tinh mach ngoai vi',
      'catheter tĩnh mạch trung tâm', 'catheter tinh mach trung tam', 'cvc', 'picc', 'đặt cvl',
      'catheter luồn', 'ong luon tinh mach',
      'ống nội khí quản', 'ong noi khi quan', 'canun mở khí quản', 'canun mo khi quan', 'canule',
      'hút đờm', 'hut dom', 'hút thông đường thở', 'hut thong duong tho', 'hút dịch khí phế quản',
      'vỗ rung', 'vo rung', 'vỗ rung lồng ngực',
      'thay băng', 'thay bang', 'cắt chỉ', 'cat chi', 'chăm sóc vết mổ', 'cham soc vet mo',
      'chăm sóc ống dẫn lưu', 'cham soc ong dan luu', 'rửa vết thương', 'rua vet thuong',
      'bơm rửa bàng quang', 'bom rua bang quang'
    ],
  },

  // 2. XÉT NGHIỆM & THĂM DÒ SINH HÓA - CHUYỂN HÓA - HUYẾT HỌC
  XET_NGHIEM_CHUYEN_HOA: {
    name: 'Xét nghiệm Sinh hóa - Chuyển hóa - Huyết học',
    terms: [
      'đường huyết', 'duong huyet', 'đường máu', 'duong mau', 'glucose', 'glycemia', 'hba1c',
      'khí máu', 'khi mau', 'khí máu động mạch', 'khi mau dong mach', 'lactate', 'abg',
      'điện giải đồ', 'dien giai do', 'ion đồ', 'ion do', 'natri', 'kali', 'clo', 'calci',
      'men gan', 'ast', 'alt', 'got', 'gpt', 'bilirubin',
      'ure', 'creatinin', 'axit uric', 'acid uric',
      'công thức máu', 'cong thuc mau', 'huyết đồ', 'huyet do',
      'tiểu cầu', 'tieu cau', 'bạch cầu', 'bach cau', 'hồng cầu', 'hong cau',
      'hemoglobin', 'hct', 'mcv', 'mch',
      'đông máu', 'dong mau', 'đông máu toàn bộ', 'inr', 'pt', 'aptt', 'fibrinogen', 'd-dimer',
      'tổng phân tích nước tiểu', 'tong phan tich nuoc tieu', 'protein niệu', 'protein nieu',
      'hồng cầu niệu', 'bạch cầu niệu', 'cặn lắng nước tiểu',
      'troponin', 'ck-mb', 'nt-probnp', 'crp', 'procalcitonin', 'pct',
      'mỡ máu', 'lipid máu', 'cholesterol', 'triglyceride', 'hdl', 'ldl',
      'tốc độ lắng máu', 'mau lang', 'vs',
      'nhóm máu', 'nhom mau', 'hệ abo', 'rh'
    ],
  },

  SAN_PHU_KHOA: {
    name: 'Sản - Phụ khoa',
    terms: [
      'âm hộ', 'am ho', 'âm đạo', 'am dao', 'tầng sinh môn', 'tang sinh mon',
      'cổ tử cung', 'co tu cung', 'tử cung', 'tu cung', 'buồng tử cung', 'buong tu cung',
      'buồng trứng', 'buong trung', 'vòi trứng', 'voi trung', 'vòi tử cung', 'voi tu cung',
      'phần phụ', 'phan phu', 'thai', 'bánh rau', 'banh rau', 'rau thai', 'màng ối', 'mang oi',
      'nước ối', 'nuoc oi', 'núm vú', 'num vu', 'tuyến vú', 'tuyen vu', 'vú', 'vu',
      'đáy chậu', 'day chau', 'vùng kín', 'vung kin', 'vết mổ đẻ', 'vet mo de',
      'vét hạch chậu', 'băng huyết sau sinh'
    ],
  },
  MAT: {
    name: 'Mắt / Nhãn khoa',
    terms: [
      'bờ mi', 'bo mi', 'mi mắt', 'mi mat', 'mi', 'kết mạc', 'ket mac',
      'giác mạc', 'giac mac', 'củng mạc', 'cung mac', 'tiền phòng', 'tien phong',
      'mống mắt', 'mong mat', 'thể mi', 'the mi', 'thể thủy tinh', 'the thuy tinh',
      'thủy tinh thể', 'thuy tinh the', 'dịch kính', 'dich kinh', 'võng mạc', 'vong mac',
      'hốc mắt', 'hoc mat', 'lệ đạo', 'le dao', 'tuyến lệ', 'tuyen le', 'điểm lệ', 'diem le',
      'ống lệ', 'ong le', 'túi lệ', 'tui le', 'cơ vận nhãn', 'co van nhan', 'nhãn cầu', 'nhan cau',
      'mắt', 'mat', 'góc tiền phòng', 'goc tien phong'
    ],
  },
  TAI_MUI_HONG: {
    name: 'Tai - Mũi - Họng',
    terms: [
      'màng nhĩ', 'mang nhi', 'hòm nhĩ', 'hom nhi', 'xương con', 'xuong con',
      'vành tai', 'vanh tai', 'ống tai', 'ong tai', 'tai giữa', 'tai giua',
      'tai ngoài', 'tai ngoai', 'tai trong', 'tai', 'vòi nhĩ', 'voi nhi',
      'mũi', 'mui', 'vách ngăn', 'vach ngan', 'cuốn mũi', 'cuon mui',
      'xoang hàm', 'xoang ham', 'xoang trán', 'xoang tran', 'xoang sàng', 'xoang sang',
      'xoang bướm', 'xoang buom', 'xoang',
      'họng', 'hong', 'hạ họng', 'ha hong', 'amidan', 'a-mi-đan', 'va',
      'thanh quản', 'thanh quan', 'dây thanh', 'day thanh', 'nắp thanh môn', 'nap thanh mon',
      'tiền đình', 'tien dinh', 'khẩu cái', 'khau cai'
    ],
  },
  RANG_HAM_MAT: {
    name: 'Răng - Hàm - Mặt',
    terms: [
      'răng', 'rang', 'tủy răng', 'tuy rang', 'lợi', 'loi', 'nha chu',
      'hàm trên', 'ham tren', 'hàm dưới', 'ham duoi', 'xương hàm', 'xuong ham',
      'khớp thái dương hàm', 'khop thai duong ham', 'lưỡi', 'luoi', 'sàn miệng', 'san mieng',
      'môi', 'moi', 'vòm miệng', 'vom mieng', 'má', 'ma', 'tuyến mang tai', 'tuyen mang tai',
      'tuyến dưới hàm', 'tuyen duoi ham', 'vùng mặt', 'vung mat'
    ],
  },
  TIEU_HOA: {
    name: 'Tiêu hóa - Ổ bụng - Gan mật',
    terms: [
      'ruột thừa', 'ruot thua', 'dạ dày', 'da day', 'đại tràng', 'dai trang',
      'trực tràng', 'truc trang', 'hậu môn', 'hau mon', 'cơ thắt hậu môn', 'co that hau mon',
      'gan', 'đường mật', 'duong mat', 'ống mật chủ', 'ong mat chu', 'túi mật', 'tui mat',
      'tụy', 'tuy', 'thực quản', 'thuc quan', 'tâm vị', 'tam vi', 'môn vị', 'mon vi',
      'tá tràng', 'ta trang', 'ruột non', 'ruot non', 'hỗng tràng', 'hong trang',
      'hồi tràng', 'hoi trang', 'manh tràng', 'manh trang', 'mạc treo', 'mac treo',
      'ổ bụng', 'o bung', 'bụng', 'bung', 'phúc mạc', 'phuc mac',
      'thoát vị bẹn', 'thoat vi ben', 'rốn', 'ron', 'khoang sau phúc mạc'
    ],
  },
  TIET_NIEU_NAM_KHOA: {
    name: 'Tiết niệu - Nam học',
    terms: [
      'thận', 'than', 'bể thận', 'be than', 'niệu quản', 'nieu quan',
      'bàng quang', 'bang quang', 'niệu đạo', 'nieu dao',
      'tiền liệt tuyến', 'tien liet tuyen', 'tuyến tiền liệt', 'tuyen tien liet',
      'tinh hoàn', 'tinh hoan', 'mào tinh', 'mao tinh', 'thừng tinh', 'thung tinh',
      'bìu', 'biu', 'dương vật', 'duong vat', 'quy đầu', 'quy dau', 'bao quy đầu', 'bao quy dau'
    ],
  },
  HO_HAP_LONG_NGUC: {
    name: 'Hô hấp - Lồng ngực',
    terms: [
      'phổi', 'phoi', 'màng phổi', 'mang phoi', 'khoang màng phổi', 'khoang mang phoi',
      'phế quản', 'phe quan', 'khí quản', 'khi quan', 'trung thất', 'trung that',
      'lồng ngực', 'long nguc', 'ngực', 'nguc', 'cơ hoành', 'co hoanh'
    ],
  },
  TIM_MACH: {
    name: 'Tim mạch',
    terms: [
      'tim', 'màng ngoài tim', 'mang ngoai tim', 'van tim', 'van hai lá', 'van ba lá',
      'nhĩ', 'nhi', 'thất', 'that', 'tâm nhĩ', 'tam nhi', 'tâm thất', 'tam that',
      'động mạch chủ', 'dong mach chu', 'động mạch vành', 'dong mach vanh',
      'động mạch phổi', 'dong mach phoi', 'động mạch', 'dong mach',
      'tĩnh mạch', 'tinh mach', 'mạch máu', 'mach mau', 'shunt', 'cầu nối mạch'
    ],
  },
  CO_XUONG_KHOP: {
    name: 'Cơ xương khớp - Chấn thương',
    terms: [
      'xương đùi', 'xuong dui', 'xương cẳng chân', 'xuong cang chan',
      'xương chày', 'xuong chay', 'xương mác', 'xuong mac',
      'xương bánh chè', 'xuong banh che', 'xương cánh tay', 'xuong canh tay',
      'xương cẳng tay', 'xuong cang tay', 'xương quay', 'xuong quay', 'xương trụ', 'xuong tru',
      'xương bàn tay', 'xuong ban tay', 'ngón tay', 'ngon tay',
      'xương bàn chân', 'xuong ban chan', 'ngón chân', 'ngon chan',
      'xương đòn', 'xuong don', 'xương bả vai', 'xuong ba vai', 'xương chậu', 'xuong chau',
      'khớp vai', 'khop vai', 'khớp háng', 'khop hang', 'khớp gối', 'khop goi',
      'khớp khuỷu', 'khop khuyu', 'khớp cổ tay', 'khop co tay', 'khớp cổ chân', 'khop co chan',
      'cột sống', 'cot song', 'đĩa đệm', 'dia dem', 'đốt sống', 'dot song',
      'cột sống cổ', 'cột sống thắt lưng', 'cột sống ngực',
      'gân', 'gan', 'cơ', 'co', 'dây chằng', 'day chang', 'bao hoạt dịch', 'bao hoat dich',
      'xương sọ', 'xuong so'
    ],
  },
  THAN_KINH: {
    name: 'Thần kinh - Sọ não',
    terms: [
      'não', 'nao', 'sọ não', 'so nao', 'màng não', 'mang nao',
      'tủy sống', 'tuy song', 'dây thần kinh', 'day than kinh', 'não thất', 'nao that',
      'hố sau', 'ho sau', 'tủy', 'dịch não tủy', 'dich nao tuy'
    ],
  },
  DA_MO_MEM: {
    name: 'Da - Mô mềm',
    terms: [
      'da', 'dưới da', 'duoi da', 'móng', 'mong', 'mô mềm', 'mo mem',
      'u mỡ', 'u mo', 'u bã đậu', 'u ba dau', 'sẹo', 'seo', 'nang', 'áp xe', 'ap xe'
    ],
  },
};

/**
 * Bảng ánh xạ cụm từ hành động y tế sang Nhóm Hành Động (Action Modality)
 */
export const ACTION_MODALITY_PATTERNS: { modality: ActionModality; patterns: string[] }[] = [
  {
    modality: 'THU_THUAT_CAN_THIEP',
    patterns: [
      'đặt ống thông', 'dat ong thong', 'đặt sonde', 'dat sonde', 'đặt catheter', 'dat catheter',
      'đặt canun', 'dat canun', 'đặt canule', 'đặt nội khí quản', 'dat noi khi quan',
      'đặt ống', 'dat ong', 'đặt kim luồn', 'đặt buồng tiêm', 'đặt sten', 'đặt stent',
      'rút ống thông', 'rut ong thong', 'rút sonde', 'rut sonde', 'rút catheter', 'rut catheter',
      'rút canun', 'rút ống', 'rut ong', 'tháo ống',
      'thông tiểu', 'thong tieu', 'dẫn lưu', 'dan luu', 'chọc dò', 'choc do', 'chọc hút', 'choc hut',
      'rửa bàng quang', 'rua bang quang', 'rửa dạ dày', 'rua da day', 'rửa', 'rua',
      'thụt tháo', 'thut thao', 'thụt giữ', 'thut giu', 'thụt', 'thut',
      'bơm rửa', 'bom rua', 'bơm thuốc', 'bom thuoc', 'bơm', 'bom',
      'tiêm truyền', 'tiem truyen', 'tiêm khớp', 'tiem khop', 'tiêm bắp', 'tiêm tĩnh mạch', 'tiêm', 'tiem',
      'truyền dịch', 'truyen dich', 'truyền máu', 'truyen mau', 'truyền', 'truyen',
      'thay băng', 'thay bang', 'cắt chỉ', 'cat chi', 'chăm sóc ống dẫn lưu', 'chăm sóc vết thương',
      'hút đờm', 'hut dom', 'hút thông', 'hut thong', 'vỗ rung', 'vo rung',
      'phong bế', 'phong be', 'lọc máu', 'loc mau', 'thẩm tách', 'tham tach', 'thay huyết tương',
      'đặt', 'dat', 'rút', 'rut', 'thay', 'thay'
    ],
  },
  {
    modality: 'XET_NGHIEM_DO_LUONG',
    patterns: [
      'đo đường huyết', 'do duong huyet', 'đo nồng độ', 'do nong do', 'đo áp lực', 'do ap luc',
      'xét nghiệm', 'xet nghiem', 'định lượng', 'dinh luong', 'định tính', 'dinh tinh',
      'phân tích', 'phan tich', 'test nhanh', 'test', 'sinh hóa', 'sinh hoa',
      'huyết học', 'huyet hoc', 'miễn dịch', 'mien dich', 'vi sinh', 'vi sinh',
      'nuôi cấy', 'nuoi cay', 'kháng sinh đồ', 'khang sinh do', 'soi tươi', 'soi phết',
      'đếm tế bào', 'định nhóm máu', 'phản ứng chéo', 'pcr', 'elisa',
      'tổng phân tích', 'tong phan tich', 'đo', 'do'
    ],
  },
  {
    modality: 'PHAU_THUAT_XAM_LAN',
    patterns: [
      'phẫu thuật', 'phau thuat', 'mổ', 'mo', 'cắt bỏ', 'cat bo', 'cắt đoạn', 'cat doan',
      'cắt cụt', 'cat cut', 'cắt bán phần', 'cắt toàn bộ', 'cắt', 'cat',
      'khâu phục hồi', 'khau phuc hoi', 'khâu bảo tồn', 'khâu nối', 'khâu', 'khau',
      'phục hồi', 'phuc hoi', 'tạo hình', 'tao hinh', 'tái tạo', 'tai tao',
      'nối', 'noi', 'ghép', 'ghep', 'vá', 'va', 'bóc tách', 'boc tach', 'bóc u', 'boc',
      'nạo vét', 'nao vet', 'nạo hạch', 'nạo', 'nao', 'tán sỏi', 'tan soi', 'lấy sỏi', 'lay soi',
      'kết hợp xương', 'ket hop xuong', 'thay khớp', 'thay khop', 'cố định cột sống',
      'mở thông', 'mo thong', 'đóng rò', 'dong ro', 'giải phóng', 'giai phong'
    ],
  },
  {
    modality: 'CHAN_DOAN_HINH_ANH',
    patterns: [
      'chụp x quang', 'chup x quang', 'chụp xquang', 'chụp cắt lớp', 'chup cat lop',
      'chụp ct', 'chup ct', 'clvt', 'chụp mri', 'chup mri', 'cộng hưởng từ', 'cong huong tu',
      'siêu âm chẩn đoán', 'siêu âm doppler', 'siêu âm 4d', 'siêu âm', 'sieu am',
      'xạ hình', 'xa hinh', 'spect', 'pet ct', 'nội soi chẩn đoán', 'chụp mạch', 'chup mach',
      'chụp tử cung vòi trứng', 'chụp', 'chup'
    ],
  },
  {
    modality: 'THAM_DO_CHUC_NANG',
    patterns: [
      'điện tâm đồ', 'dien tam do', 'điện tim', 'dien tim', 'ecg',
      'điện não đồ', 'dien nao do', 'điện não', 'eeg', 'điện cơ', 'dien co', 'emg',
      'đo chức năng thông khí', 'do chuc nang thong khi', 'đo hô hấp ký', 'ho hap ky',
      'đo thính lực', 'đo thị lực', 'holter điện tim', 'holter huyết áp',
      'đo lưu huyết não', 'đo áp lực bàng quang', 'niệu động học', 'noi soi da day'
    ],
  },
  {
    modality: 'VAT_LY_TRI_LIEU_PHCN',
    patterns: [
      'vật lý trị liệu', 'vat ly tri lieu', 'phục hồi chức năng', 'phuc hoi chuc nang',
      'tập vận động', 'tap van dong', 'kéo giãn cột sống', 'keo gian',
      'sóng ngắn điều trị', 'song ngan', 'siêu âm điều trị', 'sieu am dieu tri',
      'điện xung điều trị', 'dien xung', 'laser điều trị', 'tập đi', 'tập thở',
      'châm cứu', 'cham cuu', 'xoa bóp bấm huyệt', 'thủy châm', 'cứu ngải'
    ],
  },
  {
    modality: 'KHAM_HOI_CHAN',
    patterns: [
      'khám bệnh', 'kham benh', 'khám chuyên khoa', 'khám', 'kham',
      'hội chẩn', 'hoi chan', 'tư vấn sức khỏe', 'tu van'
    ],
  },
];

/**
 * Danh mục các từ bổ trợ / trạng từ / thuật ngữ phụ trợ (Medical Modifiers & Stopwords)
 */
export const MEDICAL_MODIFIERS = [
  'liên tục', 'lien tuc',
  'ngắt quãng', 'ngat quang',
  'tại giường', 'tai giuong',
  'cấp cứu', 'cap cuu',
  'thường quy', 'thuong quy',
  'chu kỳ', 'chu ky',
  'tự động', 'tu dong',
  'bằng máy', 'bang may',
  'một lần', 'mot lan',
  'nhiều lần', 'nhieu lan',
  'kỹ thuật', 'ky thuat',
  'quy trình', 'quy trinh',
  'dịch vụ', 'dich vu',
  'trong ngày', 'trong ngay',
  'hàng ngày', 'hang ngay'
];

/**
 * Danh mục các động từ hành động / kỹ thuật y tế phổ biến (giữ tương thích)
 */
export const PROCEDURE_ACTIONS: string[] = [
  'khâu phục hồi', 'khau phuc hoi',
  'khâu', 'khau',
  'phục hồi', 'phuc hoi',
  'phẫu thuật', 'phau thuat',
  'cắt bỏ', 'cat bo',
  'cắt', 'cat',
  'tạo hình', 'tao hinh',
  'tái tạo', 'tai tao',
  'nối', 'noi',
  'ghép', 'ghep',
  'vá', 'va',
  'nạo', 'nao',
  'bóc', 'boc',
  'hút', 'hut',
  'dẫn lưu', 'dan luu',
  'chọc dò', 'choc do',
  'chọc hút', 'choc hut',
  'sinh thiết', 'sinh thiet',
  'cầm máu', 'cam mau',
  'xử trí', 'xu tri',
  'đóng', 'dong',
  'mở', 'mo',
  'cố định', 'co dinh',
  'kết hợp xương', 'ket hop xuong',
  'thay', 'thay',
  'tán sỏi', 'tan soi',
  'lấy sỏi', 'lay soi',
  'lấy dị vật', 'lay di vat',
  'giải phóng', 'giai phong',
  'nong', 'nong',
  'thắt', 'that',
  'nội soi', 'noi soi',
  'chụp x quang', 'chup x quang',
  'chụp cắt lớp', 'chup cat lop',
  'chụp cti', 'chup ct', 'chup cọng huong tu', 'chup mri',
  'chụp', 'chup',
  'siêu âm', 'sieu am',
  'đo', 'do',
  'xét nghiệm', 'xet nghiem',
  'định lượng', 'dinh luong',
  'rửa', 'rua',
  'bơm', 'bom',
  'đặt', 'dat',
  'rút', 'rut',
  'thay băng', 'thay bang',
  'phong bế', 'phong be',
  'lọc máu', 'loc mau',
];

/**
 * Bóc tách chuỗi kỹ thuật y tế chuyên sâu:
 * - Phân loại Nhóm Hành Động (Action Modality)
 * - Động từ can thiệp (Actions)
 * - Bộ phận giải phẫu & Chuyên khoa (Anatomy List & Primary Category)
 * - Thực thể can thiệp cốt lõi (Core Target)
 * - Các từ bổ trợ / trạng từ (Modifiers)
 */
export function decomposeMedicalProcedure(text: string): MedicalComponent {
  if (!text) {
    return {
      originalText: '',
      cleanText: '',
      actions: [],
      modalities: [],
      primaryModality: null,
      anatomyList: [],
      primaryCategory: null,
      cleanWithoutAnatomy: '',
      coreTarget: '',
      modifiers: [],
    };
  }

  // Chuẩn hóa chuỗi cơ bản
  let clean = String(text).toLowerCase();
  clean = clean.replace(/[*+\-,.\[\]():;\/\\_"'`~!?@#$%^&=]/g, ' ');
  clean = clean.replace(/\s+/g, ' ').trim();

  // 1. Quét tìm các từ bổ trợ / trạng từ (Modifiers)
  const detectedModifiers: string[] = [];
  for (const mod of MEDICAL_MODIFIERS) {
    const regex = new RegExp(`(^|\\s)${mod.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(\\s|$)`, 'i');
    if (regex.test(clean)) {
      if (!detectedModifiers.includes(mod)) {
        detectedModifiers.push(mod);
      }
    }
  }

  // 2. Quét tìm bộ phận giải phẫu & chuyên khoa đích
  const detectedAnatomy: string[] = [];
  let detectedCategory: string | null = null;

  for (const [catKey, catObj] of Object.entries(ANATOMY_ONTOLOGY)) {
    const sortedTerms = [...catObj.terms].sort((a, b) => b.length - a.length);

    for (const term of sortedTerms) {
      const regex = new RegExp(`(^|\\s)${term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(\\s|$)`, 'i');
      if (regex.test(clean)) {
        if (!detectedAnatomy.includes(term)) {
          detectedAnatomy.push(term);
        }
        if (!detectedCategory) {
          detectedCategory = catKey;
        }
      }
    }
  }

  // 3. Quét tìm hành động kỹ thuật can thiệp cụ thể
  const detectedActions: string[] = [];
  const sortedActions = [...PROCEDURE_ACTIONS].sort((a, b) => b.length - a.length);

  for (const act of sortedActions) {
    const regex = new RegExp(`(^|\\s)${act.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(\\s|$)`, 'i');
    if (regex.test(clean)) {
      if (!detectedActions.some((existing) => existing.includes(act))) {
        detectedActions.push(act);
      }
    }
  }

  // 4. Nhận diện Nhóm Hành Động (Action Modality)
  const detectedModalities: ActionModality[] = [];
  for (const modItem of ACTION_MODALITY_PATTERNS) {
    for (const pat of modItem.patterns) {
      const regex = new RegExp(`(^|\\s)${pat.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(\\s|$)`, 'i');
      if (regex.test(clean)) {
        if (!detectedModalities.includes(modItem.modality)) {
          detectedModalities.push(modItem.modality);
        }
        break;
      }
    }
  }

  // Xác định Nhóm Hành Động Chủ Đạo (Primary Modality) theo thứ tự ưu tiên
  let primaryModality: ActionModality | null = null;
  if (detectedModalities.length > 0) {
    // Sắp xếp theo thứ tự ưu tiên trong ACTION_MODALITY_INFO
    primaryModality = [...detectedModalities].sort(
      (a, b) => ACTION_MODALITY_INFO[a].priority - ACTION_MODALITY_INFO[b].priority
    )[0];
  } else if (detectedCategory === 'DIEU_DUONG_THU_THUAT') {
    primaryModality = 'THU_THUAT_CAN_THIEP';
  } else if (detectedCategory === 'XET_NGHIEM_CHUYEN_HOA') {
    primaryModality = 'XET_NGHIEM_DO_LUONG';
  }

  // 5. Tạo chuỗi không chứa bộ phận giải phẫu
  let withoutAnatomy = clean;
  for (const anat of detectedAnatomy) {
    const regex = new RegExp(`(^|\\s)${anat.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(\\s|$)`, 'gi');
    withoutAnatomy = withoutAnatomy.replace(regex, ' ');
  }
  withoutAnatomy = withoutAnatomy.replace(/\s+/g, ' ').trim();

  // 6. Trích xuất Thực thể Cốt lõi (Core Target): Lược bỏ "kỹ thuật", các modifier và hành động
  let core = clean;
  // Bỏ từ "kỹ thuật", "quy trình", "dịch vụ"
  core = core.replace(/(^|\s)(kỹ thuật|ky thuat|quy trình|quy trinh|dịch vụ|dich vu)(\s|$)/gi, ' ');
  // Bỏ các modifier (liên tục, ngắt quãng...)
  for (const mod of detectedModifiers) {
    const regex = new RegExp(`(^|\\s)${mod.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(\\s|$)`, 'gi');
    core = core.replace(regex, ' ');
  }
  // Bỏ các hành động đã tìm thấy
  for (const act of detectedActions) {
    const regex = new RegExp(`(^|\\s)${act.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(\\s|$)`, 'gi');
    core = core.replace(regex, ' ');
  }
  core = core.replace(/\s+/g, ' ').trim();

  return {
    originalText: text,
    cleanText: clean,
    actions: detectedActions,
    modalities: detectedModalities,
    primaryModality,
    anatomyList: detectedAnatomy,
    primaryCategory: detectedCategory,
    cleanWithoutAnatomy: withoutAnatomy,
    coreTarget: core,
    modifiers: detectedModifiers,
  };
}

export type AnatomyCompatibilityStatus =
  | 'EXACT_MATCH'         // Trùng chính xác bộ phận (ví dụ cùng 'âm hộ', cùng 'đường huyết')
  | 'SAME_ORGAN_SYSTEM'   // Cùng hệ cơ quan/chuyên khoa (ví dụ 'âm hộ' và 'âm đạo' thuộc Sản Phụ Khoa)
  | 'GENERIC_OR_UNKNOWN'  // Một bên không xác định bộ phận (cho phép khớp theo kỹ thuật)
  | 'SEVERE_CONFLICT';    // XUNG ĐỘT BỘ PHẬN NGHIÊM TRỌNG (ví dụ 'thông tiểu' vs 'đường huyết', 'âm hộ' vs 'bờ mi')

/**
 * Kiểm tra tính tương thích về giải phẫu và miền lâm sàng giữa 2 dịch vụ kỹ thuật y tế
 */
export function evaluateAnatomyCompatibility(
  comp1: MedicalComponent,
  comp2: MedicalComponent
): { status: AnatomyCompatibilityStatus; penaltyFactor: number; bonus: number; reason: string } {
  const cat1 = comp1.primaryCategory;
  const cat2 = comp2.primaryCategory;

  // Nếu cả 2 đều không phát hiện bộ phận đặc thù
  if (!cat1 && !cat2) {
    return {
      status: 'GENERIC_OR_UNKNOWN',
      penaltyFactor: 1.0,
      bonus: 0.0,
      reason: 'Cả hai dịch vụ mang tính kỹ thuật chung (không chỉ định cơ quan cụ thể)',
    };
  }

  // Nếu một bên có bộ phận nhưng bên kia là kỹ thuật chung
  if (!cat1 || !cat2) {
    return {
      status: 'GENERIC_OR_UNKNOWN',
      penaltyFactor: 0.9, // Trừ nhẹ để ưu tiên mục có đúng bộ phận hơn
      bonus: 0.0,
      reason: 'Một bên chỉ định bộ phận cụ thể, bên kia là kỹ thuật chung',
    };
  }

  // CẢ HAI BÊN ĐỀU CÓ BỘ PHẬN HOẶC MIỀN LÂM SÀNG:
  // Kiểm tra nếu có ít nhất 1 bộ phận trùng khớp chính xác
  const hasExactAnatomy = comp1.anatomyList.some((a1) =>
    comp2.anatomyList.some((a2) => a1 === a2 || a1.includes(a2) || a2.includes(a1))
  );

  if (hasExactAnatomy) {
    return {
      status: 'EXACT_MATCH',
      penaltyFactor: 1.0,
      bonus: 0.15, // Thưởng 15% điểm tương đồng
      reason: 'Khớp chính xác bộ phận giải phẫu hoặc đối tượng đích',
    };
  }

  // Nếu cùng nhóm chuyên khoa / miền lâm sàng
  if (cat1 === cat2) {
    return {
      status: 'SAME_ORGAN_SYSTEM',
      penaltyFactor: 1.0,
      bonus: 0.05, // Thưởng nhẹ
      reason: `Cùng hệ cơ quan (${ANATOMY_ONTOLOGY[cat1]?.name || cat1})`,
    };
  }

  // ⚠️ XUNG ĐỘT HỆ CƠ QUAN / BỘ PHẬN NGHIÊM TRỌNG
  // Ví dụ: DIEU_DUONG_THU_THUAT ('ống thông tiểu') đối đầu XET_NGHIEM_CHUYEN_HOA ('đường huyết')
  // Hoặc SAN_PHU_KHOA ('âm hộ') đối đầu MAT ('bờ mi')
  return {
    status: 'SEVERE_CONFLICT',
    penaltyFactor: 0.0, // Phạt triệt để về 0! Chặn đứng hoàn toàn việc ghép sai
    bonus: 0.0,
    reason: `Xung đột hệ cơ quan / chuyên khoa nghiêm trọng: [${ANATOMY_ONTOLOGY[cat1]?.name || cat1}] đối đầu [${ANATOMY_ONTOLOGY[cat2]?.name || cat2}]`,
  };
}

export type ActionModalityCompatibilityStatus =
  | 'MODALITY_MATCH'       // Cùng nhóm hành động (ví dụ cùng là Thủ thuật can thiệp hoặc cùng Xét nghiệm)
  | 'MODALITY_COMPATIBLE'  // Tương thích bổ trợ (ví dụ Phẫu thuật và Thủ thuật can thiệp)
  | 'MODALITY_UNKNOWN'     // Một bên không xác định được nhóm hành động
  | 'MODALITY_CONFLICT';   // XUNG ĐỘT BẢN CHẤT LÂM SÀNG (ví dụ Đặt ống can thiệp đối đầu Đo đường huyết/Xét nghiệm)

/**
 * Đánh giá tính tương thích giữa hai Nhóm Hành Động (Action Modality Barrier)
 * Ngăn chặn tuyệt đối việc ghép kỹ thuật xâm lấn/đặt ống với đo đạc/xét nghiệm.
 */
export function evaluateActionModalityCompatibility(
  comp1: MedicalComponent,
  comp2: MedicalComponent
): { status: ActionModalityCompatibilityStatus; penaltyFactor: number; bonus: number; reason: string } {
  const m1 = comp1.primaryModality;
  const m2 = comp2.primaryModality;

  // Nếu một trong hai bên không rõ nhóm hành động
  if (!m1 || !m2) {
    return {
      status: 'MODALITY_UNKNOWN',
      penaltyFactor: 1.0,
      bonus: 0.0,
      reason: 'Một hoặc cả hai bên chưa xác định được nhóm hành động lâm sàng',
    };
  }

  // 1. Trùng khớp nhóm hành động
  if (m1 === m2) {
    return {
      status: 'MODALITY_MATCH',
      penaltyFactor: 1.0,
      bonus: 0.08, // Thưởng 8% vì cùng bản chất hành động
      reason: `Cùng nhóm bản chất kỹ thuật: ${ACTION_MODALITY_INFO[m1].name}`,
    };
  }

  // 2. CẶP XUNG ĐỘT TUYỆT ĐỐI (MUTUALLY EXCLUSIVE MODALITIES):
  // Can thiệp/Đặt ống vs Đo lường/Xét nghiệm (VÍ DỤ: Đặt ống thông tiểu vs Đo đường huyết)
  const isInterventionVsLab =
    (m1 === 'THU_THUAT_CAN_THIEP' && m2 === 'XET_NGHIEM_DO_LUONG') ||
    (m2 === 'THU_THUAT_CAN_THIEP' && m1 === 'XET_NGHIEM_DO_LUONG');

  // Phẫu thuật ngoại khoa vs Xét nghiệm
  const isSurgeryVsLab =
    (m1 === 'PHAU_THUAT_XAM_LAN' && m2 === 'XET_NGHIEM_DO_LUONG') ||
    (m2 === 'PHAU_THUAT_XAM_LAN' && m1 === 'XET_NGHIEM_DO_LUONG');

  // Phẫu thuật ngoại khoa vs Vật lý trị liệu
  const isSurgeryVsRehab =
    (m1 === 'PHAU_THUAT_XAM_LAN' && m2 === 'VAT_LY_TRI_LIEU_PHCN') ||
    (m2 === 'PHAU_THUAT_XAM_LAN' && m1 === 'VAT_LY_TRI_LIEU_PHCN');

  // Chẩn đoán hình ảnh vs Thủ thuật điều dưỡng can thiệp
  const isImagingVsNursing =
    (m1 === 'CHAN_DOAN_HINH_ANH' && m2 === 'THU_THUAT_CAN_THIEP') ||
    (m2 === 'CHAN_DOAN_HINH_ANH' && m1 === 'THU_THUAT_CAN_THIEP');

  // Xét nghiệm vs Chẩn đoán hình ảnh
  const isLabVsImaging =
    (m1 === 'XET_NGHIEM_DO_LUONG' && m2 === 'CHAN_DOAN_HINH_ANH') ||
    (m2 === 'XET_NGHIEM_DO_LUONG' && m1 === 'CHAN_DOAN_HINH_ANH');

  if (isInterventionVsLab || isSurgeryVsLab || isSurgeryVsRehab || isImagingVsNursing || isLabVsImaging) {
    return {
      status: 'MODALITY_CONFLICT',
      penaltyFactor: 0.0, // Phạt triệt để về 0%
      bonus: 0.0,
      reason: `Xung đột bản chất kỹ thuật: [${ACTION_MODALITY_INFO[m1].name}] đối đầu [${ACTION_MODALITY_INFO[m2].name}]`,
    };
  }

  // Các cặp có thể tương thích nhẹ (ví dụ Phẫu thuật và Thủ thuật can thiệp)
  return {
    status: 'MODALITY_COMPATIBLE',
    penaltyFactor: 0.85,
    bonus: 0.0,
    reason: `Hai nhóm kỹ thuật khác nhau nhưng có thể liên đới: [${ACTION_MODALITY_INFO[m1].name}] và [${ACTION_MODALITY_INFO[m2].name}]`,
  };
}

