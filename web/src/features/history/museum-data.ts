import type { HistoryImage } from "./types";

export type HistoricalLocation = { id: string; name: string; latitude: number; longitude: number; precision: string; country: string; sourceUrl: string };
const naturalEarth = "https://github.com/nvkelso/natural-earth-vector/blob/master/geojson/ne_10m_populated_places_simple.geojson";
function city(id: string, name: string, longitude: number, latitude: number, country: string): HistoricalLocation {
  return { id, name, latitude, longitude, country, precision: "Tọa độ đại diện đô thị, không phải vị trí chính xác của sự kiện", sourceUrl: naturalEarth };
}
export const LOCATIONS: HistoricalLocation[] = [
  city("hanoi", "Hà Nội", 105.848068, 21.035273, "Việt Nam"),
  city("saigon", "Sài Gòn / TP. Hồ Chí Minh", 106.702985, 10.762125, "Việt Nam"),
  city("tours", "Tours", 0.699947, 47.380375, "Pháp"),
  city("guangzhou", "Quảng Châu", 113.261785, 23.124723, "Trung Quốc"),
  city("hongkong", "Hương Cảng", 114.183064, 22.306927, "Trung Quốc"),
  city("caobang", "Cao Bằng · đại diện vùng", 106.268005, 22.663998, "Việt Nam"),
  city("langson", "Lạng Sơn · đại diện vùng", 106.757002, 21.845997, "Việt Nam"),
  city("paris", "Paris", 2.352992, 48.858092, "Pháp"),
  city("geneva", "Genève · trụ sở WTO", 6.140028, 46.210008, "Thụy Sĩ"),
  city("brunei", "Bandar Seri Begawan", 114.933284, 4.883331, "Brunei"),
  { id: "bentre", name: "Bến Tre · đại diện vùng", longitude: 106.5, latitude: 10 + 10 / 60, country: "Việt Nam", precision: "Tọa độ vùng Bến Tre, không phải vị trí chính xác tại Mỏ Cày", sourceUrl: "https://www.wikidata.org/wiki/Q33366" },
  { id: "dienbien", name: "Điện Biên Phủ", latitude: 21 + 23 / 60 + 13 / 3600, longitude: 103 + 56 / 3600, country: "Việt Nam", precision: "Tọa độ đại diện chiến trường, không định vị từng cứ điểm", sourceUrl: "https://www.wikidata.org/wiki/Q604897" },
];
export const TOPICS = [{ id: "cach-mang", label: "Phong trào & tổ chức" }, { id: "khang-chien", label: "Kháng chiến" }, { id: "ngoai-giao", label: "Ngoại giao & hội nhập" }, { id: "kien-thiet", label: "Kiến thiết & Đổi mới" }] as const;
export type MuseumTopic = typeof TOPICS[number]["id"];
type EventGeography = { locationIds: string[]; topic: MuseumTopic; note?: string; startDate?: string; endDate?: string };
export const EVENT_GEOGRAPHY: Record<string, EventGeography> = {
  "1911-ra-di": { locationIds: ["saigon"], topic: "cach-mang" },
  "1920-tours": { locationIds: ["tours"], topic: "cach-mang" },
  "1925-thanh-nien": { locationIds: ["guangzhou"], topic: "cach-mang" },
  "1930-thanh-lap-dang": { locationIds: ["hongkong"], topic: "cach-mang" },
  "1941-viet-minh": { locationIds: ["caobang"], topic: "cach-mang", note: "Pác Bó thuộc Cao Bằng; marker dùng đô thị đại diện vùng, không đặt tại di tích." },
  "1945-thang-tam": { locationIds: ["hanoi", "saigon"], topic: "cach-mang", note: "Sự kiện trên cả nước; hai đô thị chỉ là điểm đại diện." },
  "1945-doc-lap": { locationIds: ["hanoi"], topic: "cach-mang" },
  "1946-khang-chien": { locationIds: ["hanoi"], topic: "khang-chien", note: "Hà Nội đại diện cho sự kiện toàn quốc." },
  "1950-bien-gioi": { locationIds: ["caobang", "langson"], topic: "khang-chien", startDate: "1950-09-16", endDate: "1950-10-17" },
  "1954-dien-bien": { locationIds: ["dienbien"], topic: "khang-chien", startDate: "1954-03-13", endDate: "1954-05-07" },
  "1960-dong-khoi": { locationIds: ["bentre"], topic: "cach-mang" },
  "1968-mau-than": { locationIds: ["saigon"], topic: "khang-chien", note: "Sài Gòn là một trong nhiều đô thị; không đại diện toàn bộ địa bàn tác chiến." },
  "1973-paris": { locationIds: ["paris"], topic: "ngoai-giao" },
  "1975-thong-nhat": { locationIds: ["saigon"], topic: "khang-chien", startDate: "1975-04-26", endDate: "1975-04-30" },
  "1976-quoc-hoi": { locationIds: ["hanoi"], topic: "kien-thiet", startDate: "1976-04-25", endDate: "1976-07-02", note: "Hà Nội đại diện kỳ họp Quốc hội, cuộc bầu cử diễn ra trên cả nước." },
  "1981-khoan-100": { locationIds: ["hanoi"], topic: "kien-thiet", note: "Chính sách áp dụng trên cả nước; dùng thủ đô làm điểm đại diện." },
  "1986-doi-moi": { locationIds: ["hanoi"], topic: "kien-thiet", startDate: "1986-12-15", endDate: "1986-12-18" },
  "1995-asean": { locationIds: ["brunei"], topic: "ngoai-giao" },
  "2007-wto": { locationIds: ["geneva"], topic: "ngoai-giao", note: "Genève đại diện trụ sở WTO; không khẳng định có lễ gia nhập tại đây ngày 11/01/2007." },
  "2021-dai-hoi-xiii": { locationIds: ["hanoi"], topic: "kien-thiet", startDate: "2021-01-25", endDate: "2021-02-01" },
};
export const BA_DINH_2008: HistoryImage = {
  src: "/history/ba-dinh-2008.jpg", width: 1280, height: 853,
  alt: "Quảng trường Ba Đình và Lăng Chủ tịch Hồ Chí Minh ngày 13 tháng 3 năm 2008",
  caption: "Quảng trường Ba Đình · 13.03.2008 (không phải ảnh hiện tại)",
  credit: "© Vyacheslav Argenberg · bản thu nhỏ Commons, hiển thị trong khung; không phục dựng",
  sourceUrl: "https://commons.wikimedia.org/wiki/File:Hanoi,_Vietnam,_Ba_Dinh_Square.jpg",
  license: "CC BY 4.0", licenseUrl: "https://creativecommons.org/licenses/by/4.0/",
};
export const CAMPAIGN = {
  title: "Điện Biên Phủ · 56 ngày đêm", eventId: "1954-dien-bien",
  sourceUrl: "https://baotang.dsvh.gov.vn/vi-VN/Detail/Index/117",
  phases: [
    { title: "Mở cửa phía Bắc", date: "13–17.03.1954", text: "Tiến công các cứ điểm Him Lam, Độc Lập và Bản Kéo, phá vỡ tuyến phòng ngự phía Bắc. Trận mở màn tạo điều kiện bao vây khu trung tâm.", points: [{ x: 333, y: 263, label: "Him Lam / Béatrice" }, { x: 177, y: 95, label: "Độc Lập / Gabrielle" }, { x: 51, y: 260, label: "Bản Kéo / Anne-Marie" }] },
    { title: "Siết vòng vây trung tâm", date: "30.03–30.04.1954", text: "Tiến công các điểm cao phía Đông, phát triển trận địa vây lấn và khống chế sân bay Mường Thanh. Giao tranh kéo dài, từng bước thu hẹp phạm vi kiểm soát của đối phương.", points: [{ x: 270, y: 380, label: "Các điểm cao phía Đông" }, { x: 193, y: 372, label: "Sân bay Mường Thanh" }] },
    { title: "Tổng công kích", date: "01–07.05.1954", text: "Tiếp tục đánh chiếm các cứ điểm còn lại; làm chủ A1 và tiến vào khu chỉ huy. Ngày 7/5, tướng De Castries cùng bộ chỉ huy bị bắt, chiến dịch kết thúc thắng lợi.", points: [{ x: 263, y: 472, label: "Khu Eliane · gồm A1" }, { x: 186, y: 474, label: "Khu trung tâm" }] },
  ],
};
