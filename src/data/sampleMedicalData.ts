import { SourceItem, TargetItem } from '../types';
import { cleanText } from '../utils/fuzzyMatcher';

// Dữ liệu mẫu File Gốc (Thông tư 43/21, TT 32/2023)
export const RAW_SAMPLE_SOURCE = [
  {
    code: "01.0021.0043",
    name: "Phẫu thuật cắt ruột thừa viêm qua nội soi*",
    chapter: "II. Chuyên khoa Ngoại & Hồi sức",
  },
  {
    code: "01.0054.0043",
    name: "Chụp X-quang cột sống thắt lưng (2 tư thế)+",
    chapter: "I. Khám bệnh & Chẩn đoán hình ảnh",
  },
  {
    code: "02.0112.0021",
    name: "Nội soi thực quản - dạ dày - tá tràng can thiệp cầm máu",
    chapter: "II. Chuyên khoa Ngoại & Hồi sức",
  },
  {
    code: "03.0034.0043",
    name: "Siêu âm Doppler tim qua thành ngực (màu)",
    chapter: "I. Khám bệnh & Chẩn đoán hình ảnh",
  },
  {
    code: "04.0089.0043",
    name: "Đặt catheter tĩnh mạch trung tâm dưới hướng dẫn siêu âm*",
    chapter: "II. Chuyên khoa Ngoại & Hồi sức",
  },
  {
    code: "05.0012.0021",
    name: "Cắt amidan bằng dao mổ Plasma hoặc Coblator",
    chapter: "IX. Tai mũi họng",
  },
  {
    code: "06.0045.0043",
    name: "Khâu vết thương phần mềm vùng mặt đơn giản rách da*",
    chapter: "VIII. Răng hàm mặt",
  },
  {
    code: "07.0090.0021",
    name: "Chụp cắt lớp vi tính lồng ngực không tiêm thuốc cản quang",
    chapter: "I. Khám bệnh & Chẩn đoán hình ảnh",
  },
  {
    code: "08.0019.0043",
    name: "Điều trị tủy răng số 6 vĩnh viễn (nhiều cuống)*+",
    chapter: "VIII. Răng hàm mặt",
  },
  {
    code: "08.0020.0043",
    name: "Trám bít hố rãnh dự phòng sâu răng*",
    chapter: "VIII. Răng hàm mặt",
  },
  {
    code: "08.0021.0043",
    name: "Vệ sinh răng miệng cho người bệnh có cố định hàm",
    chapter: "VIII. Răng hàm mặt",
  },
  {
    code: "09.0067.0043",
    name: "Phẫu thuật lấy thai lần thứ nhất (mổ đẻ)",
    chapter: "III. Sản - Phụ khoa",
  },
  {
    code: "10.0123.0021",
    name: "Bơm rửa đường hô hấp trên",
    chapter: "IX. Tai mũi họng",
  },
  {
    code: "10.0124.0021",
    name: "Bơm thuốc thanh quản*",
    chapter: "IX. Tai mũi họng",
  },
  {
    code: "10.0125.0021",
    name: "Cầm chảy máu ở lỗ mũi sau bằng ống thông có bóng chèn*",
    chapter: "IX. Tai mũi họng",
  },
  {
    code: "11.0041.0043",
    name: "Lọc máu cấp cứu bằng kỹ thuật thẩm tách máu (chạy thận)*",
    chapter: "II. Chuyên khoa Ngoại & Hồi sức",
  },
  {
    code: "12.0166.0043",
    name: "Khâu phục hồi rách âm đạo, tầng sinh môn độ 1, 2,",
    chapter: "III. Sản - Phụ khoa",
  },
  {
    code: "13.0166.0043",
    name: "Khâu phục hồi rách âm hộ",
    chapter: "III. Sản - Phụ khoa",
  },
  {
    code: "14.0168.0043",
    name: "Xử trí vết rách cổ tử cung đơn thuần *",
    chapter: "III. Sản - Phụ khoa",
  },
];

// Dữ liệu mẫu Phụ lục 1 - TT 23/2024/TT-BYT (skiprows=3)
export const RAW_SAMPLE_PL1 = [
  {
    code: "23.PL1.00101",
    name: "Phẫu thuật cắt ruột thừa viêm qua nội soi",
  },
  {
    code: "23.PL1.00142",
    name: "Chụp X-quang cột sống thắt lưng 2 tư thế",
  },
  {
    code: "23.PL1.00205",
    name: "Nội soi thực quản dạ dày tá tràng can thiệp cầm máu",
  },
  {
    code: "23.PL1.00310",
    name: "Siêu âm Doppler tim qua thành ngực",
  },
  {
    code: "23.PL1.00415",
    name: "Đặt catheter tĩnh mạch trung tâm",
  },
  {
    code: "23.PL1.00520",
    name: "Cắt amidan bằng dao Plasma",
  },
  {
    code: "23.PL1.00625",
    name: "Khâu vết thương phần mềm vùng mặt",
  },
  {
    code: "23.PL1.00730",
    name: "Chụp cắt lớp vi tính lồng ngực không tiêm thuốc",
  },
  {
    code: "23.PL1.00835",
    name: "Điều trị tủy răng vĩnh viễn có nhiều chân răng",
  },
  {
    code: "23.PL1.00940",
    name: "Phẫu thuật lấy thai lần đầu",
  },
  {
    code: "23.PL1.01045",
    name: "Chọc hút tế bào bằng kim nhỏ tuyến giáp dưới hướng dẫn siêu âm",
  },
  {
    code: "23.PL1.01150",
    name: "Lọc máu cấp cứu bằng kỹ thuật thẩm tách máu",
  },
  {
    code: "23.PL1.01255",
    name: "Khâu phục hồi rách âm đạo, tầng sinh môn",
  },
  {
    code: "23.PL1.01360",
    name: "Khâu phục hồi rách âm hộ",
  },
  {
    code: "23.PL1.01465",
    name: "Khâu phục hồi bờ mi",
  },
  {
    code: "23.PL1.01570",
    name: "Xử trí vết rách cổ tử cung",
  },
];

// Dữ liệu mẫu Phụ lục 2 - TT 23/2024/TT-BYT (skiprows=1)
export const RAW_SAMPLE_PL2 = [
  {
    code: "23.PL2.0001",
    name: "Phẫu thuật nội soi cắt ruột thừa",
  },
  {
    code: "23.PL2.0002",
    name: "Chụp Xquang cột sống thắt lưng thường quy",
  },
  {
    code: "23.PL2.0003",
    name: "Nội soi dạ dày tá tràng can thiệp cầm máu bằng kẹp clip",
  },
  {
    code: "23.PL2.0004",
    name: "Siêu âm tim Doppler màu thành ngực",
  },
  {
    code: "23.PL2.0005",
    name: "Đặt catheter tĩnh mạch trung tâm có hướng dẫn siêu âm",
  },
  {
    code: "23.PL2.0006",
    name: "Cắt amidan bằng phương pháp Coblator hoặc Plasma",
  },
  {
    code: "23.PL2.0007",
    name: "Khâu vết thương phần mềm phức tạp vùng mặt",
  },
  {
    code: "23.PL2.0008",
    name: "Chụp CLVT lồng ngực không thuốc cản quang",
  },
  {
    code: "23.PL2.0009",
    name: "Điều trị tủy răng số 6 vĩnh viễn",
  },
  {
    code: "23.PL2.0010",
    name: "Phẫu thuật mổ lấy thai đường bụng",
  },
  {
    code: "23.PL2.0011",
    name: "Sinh thiết tế bào tuyến giáp bằng kim nhỏ FNA",
  },
  {
    code: "23.PL2.0012",
    name: "Chạy thận nhân tạo cấp cứu",
  },
  {
    code: "23.PL2.0013",
    name: "Khâu phục hồi bờ mi",
  },
  {
    code: "23.PL2.0014",
    name: "Khâu phục hồi rách âm đạo và tầng sinh môn",
  },
  {
    code: "23.PL2.0015",
    name: "Khâu phục hồi vết rách âm hộ",
  },
  {
    code: "23.PL2.0016",
    name: "Xử trí vết rách cổ tử cung đơn thuần",
  },
];

export function getSampleSourceList(): SourceItem[] {
  return RAW_SAMPLE_SOURCE.map((item, idx) => {
    const chapterName = item.chapter || (idx >= 8 ? 'II. Chuyên khoa Ngoại & Hồi sức' : 'I. Khám bệnh & CĐHA');
    const stt2InChapter = idx + 1;

    return {
      id: idx + 1,
      stt2: stt2InChapter,
      code: item.code,
      name: item.name,
      chapter: chapterName,
      rawRow: [stt2InChapter, item.code, item.name, idx % 2 === 0 ? 'X' : '', chapterName],
    };
  });
}

export function getSampleTargetPL1(): TargetItem[] {
  return RAW_SAMPLE_PL1.map((item, idx) => ({
    code: item.code,
    name: item.name,
    cleanName: cleanText(item.name),
    rawRow: [idx + 1, item.code, 'Loại 1', item.name],
  }));
}

export function getSampleTargetPL2(): TargetItem[] {
  return RAW_SAMPLE_PL2.map((item, idx) => ({
    code: item.code,
    name: item.name,
    cleanName: cleanText(item.name),
    rawRow: [idx + 1, `TD.${idx + 1}`, 'CLS', item.code, item.name],
  }));
}
