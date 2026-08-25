// Khoảnh Khắc Quyết Sách — dữ liệu cho lối chơi "Bạn sẽ quyết sao?".
// Mục tiêu: nhẹ đầu, vui, không áp lực. Mỗi khoảnh khắc chỉ 1 câu hỏi, 2-3 lựa chọn to
// để chạm, rồi lật ra đáp án lịch sử kèm một sự thật bất ngờ.
// Nội dung bám 15 hồ sơ trong docs/sdd/content/dossiers (5 khoảnh khắc mỗi chương VNR202).

export type MomentChoice = {
  id: string;
  glyph: string;
  label: string;
};

export type DecisionMoment = {
  id: string;
  chapter: 1 | 2 | 3;
  chapterLabel: string;
  year: string;
  title: string;
  /** Một câu bối cảnh, ngắn và có sức ép. */
  setup: string;
  /** Câu hỏi chốt, hiển thị ngay trên các lựa chọn. */
  prompt: string;
  choices: MomentChoice[];
  historicalChoiceId: string;
  /** Số phiếu mồi để thanh "người chơi đã chọn" trông có sức sống ngay lần đầu. */
  seedVotes: Record<string, number>;
  /** Sự thật bất ngờ hiện ra khi lật bài. */
  fact: string;
  /** Vì sao lịch sử chọn như vậy — hiện sau nút "muốn biết thêm". */
  why: string;
  /** Nguồn tra cứu — để thầy cô thấy có căn cứ. */
  source: string;
};

const CH1 = "Chương 1 · Giành chính quyền";
const CH2 = "Chương 2 · Kháng chiến & thống nhất";
const CH3 = "Chương 3 · Đổi mới";

export const MOMENTS: DecisionMoment[] = [
  // ================= CHƯƠNG 1 (1930–1945) =================
  {
    id: "1929-con-duong",
    chapter: 1,
    chapterLabel: CH1,
    year: "1911–1929",
    title: "Đi tìm một con đường",
    setup: "Bao phong trào yêu nước đã thất bại. Con đường cứu nước đang bế tắc, cần một hướng đi hoàn toàn mới.",
    prompt: "Nếu là bạn, chọn con đường nào?",
    choices: [
      { id: "proletarian", glyph: "🧭", label: "Con đường cách mạng vô sản" },
      { id: "old-model", glyph: "🏛️", label: "Khôi phục mô hình cứu nước cũ" },
      { id: "colonial-reform", glyph: "📜", label: "Trông chờ thực dân cải cách" },
    ],
    historicalChoiceId: "proletarian",
    seedVotes: { proletarian: 52, "old-model": 26, "colonial-reform": 16 },
    fact: "Nguyễn Ái Quốc đến với chủ nghĩa Mác-Lênin và tìm ra con đường cách mạng vô sản — lối thoát cho cuộc khủng hoảng đường lối kéo dài.",
    why: "Các con đường cũ đều bế tắc. Chỉ con đường mới, gắn giải phóng dân tộc với một lực lượng và tổ chức đủ tầm, mới mở được đường ra.",
    source: "Giáo trình Lịch sử Đảng — Chương 1; hành trình tìm đường cứu nước của Nguyễn Ái Quốc (1911–1929).",
  },
  {
    id: "1930-hop-nhat",
    chapter: 1,
    chapterLabel: CH1,
    year: "Đầu năm 1930",
    title: "Ba nhóm, một con đường",
    setup: "Cùng lúc có ba tổ chức cộng sản, hoạt động riêng rẽ và có nguy cơ tranh giành ảnh hưởng. Phong trào đang cần một ngọn cờ chung.",
    prompt: "Nếu là bạn, bạn sẽ làm gì?",
    choices: [
      { id: "unify", glyph: "🤝", label: "Hợp nhất thành một Đảng duy nhất" },
      { id: "grow-apart", glyph: "🏁", label: "Để mỗi nhóm tự lớn mạnh" },
      { id: "wait", glyph: "⏳", label: "Chờ phong trào tự chọn người dẫn đầu" },
    ],
    historicalChoiceId: "unify",
    seedVotes: { unify: 61, "grow-apart": 18, wait: 14 },
    fact: "Ngày 3/2/1930, Nguyễn Ái Quốc chủ trì hợp nhất ba tổ chức thành Đảng Cộng sản Việt Nam — chấm dứt cảnh chia rẽ và mở ra một đường lối chung.",
    why: "Một cương lĩnh chung cộng một tổ chức thống nhất mới đủ sức quy tụ cả phong trào. Để rời rạc thì mạnh cục bộ nhưng không ai đủ tầm dẫn dắt cả nước.",
    source: "Giáo trình Lịch sử Đảng — Chương 1; Cương lĩnh chính trị đầu tiên (2/1930).",
  },
  {
    id: "1935-giu-mach",
    chapter: 1,
    chapterLabel: CH1,
    year: "1932–1935",
    title: "Giữ mạch giữa khủng bố trắng",
    setup: "Sau cao trào 1930–1931, địch khủng bố dữ dội, tổ chức tổn thất nặng nề. Phong trào có nguy cơ đứt mạch.",
    prompt: "Cứu phong trào bằng cách nào?",
    choices: [
      { id: "rebuild", glyph: "🌱", label: "Bảo toàn hạt nhân, từng bước khôi phục" },
      { id: "uprising-now", glyph: "🔥", label: "Phát động tổng khởi nghĩa ngay" },
      { id: "retreat", glyph: "🚪", label: "Rút khỏi hoạt động vô thời hạn" },
    ],
    historicalChoiceId: "rebuild",
    seedVotes: { rebuild: 49, "uprising-now": 30, retreat: 15 },
    fact: "Những cán bộ còn lại kiên trì gây dựng lại tổ chức, nối lại phong trào và tiến tới Đại hội I (3/1935) — phong trào không đứt mạch.",
    why: "Khởi nghĩa khi lực lượng kiệt quệ là tự sát; rút lui vô thời hạn là buông xuôi. Giữ hạt nhân để hồi sinh mới là nước đi khôn.",
    source: "Giáo trình Lịch sử Đảng — Chương 1; Đại hội đại biểu toàn quốc lần thứ I (3/1935).",
  },
  {
    id: "1938-cua-so-dan-chu",
    chapter: 1,
    chapterLabel: CH1,
    year: "1936–1939",
    title: "Cửa sổ dân chủ hé mở",
    setup: "Tình hình thế giới đổi chiều, xuất hiện không gian đấu tranh công khai. Nhưng mục tiêu độc lập lâu dài vẫn còn đó.",
    prompt: "Tận dụng thời cơ này thế nào?",
    choices: [
      { id: "flexible", glyph: "🪟", label: "Mở mặt trận rộng, đấu tranh linh hoạt" },
      { id: "unchanged", glyph: "📌", label: "Giữ nguyên khẩu hiệu cũ" },
      { id: "abandon", glyph: "🏳️", label: "Chỉ đòi cải cách, bỏ mục tiêu độc lập" },
    ],
    historicalChoiceId: "flexible",
    seedVotes: { flexible: 55, unchanged: 24, abandon: 12 },
    fact: "Đảng lập mặt trận dân chủ rộng rãi, kết hợp công khai – bí mật, hợp pháp – nửa hợp pháp; ảnh hưởng chính trị lan rộng, cán bộ tích lũy kinh nghiệm.",
    why: "Điều kiện đổi thì sách lược phải đổi — nhưng linh hoạt về hình thức mà không đánh mất mục tiêu chiến lược lâu dài.",
    source: "Giáo trình Lịch sử Đảng — Chương 1; phong trào dân chủ 1936–1939.",
  },
  {
    id: "1945-tong-khoi-nghia",
    chapter: 1,
    chapterLabel: CH1,
    year: "Tháng 8/1945",
    title: "Thời cơ ngàn năm có một",
    setup: "Nhật vừa đầu hàng Đồng minh, bộ máy cai trị rối loạn. Lực lượng cách mạng đã chuẩn bị sẵn. Nhưng cửa sổ này chỉ mở vài ngày.",
    prompt: "Bạn có 3 ngày. Quyết sao?",
    choices: [
      { id: "uprising", glyph: "⚡", label: "Tổng khởi nghĩa NGAY" },
      { id: "wait-allies", glyph: "⏳", label: "Chờ Đồng minh vào rồi tính" },
      { id: "rural", glyph: "🌾", label: "Chỉ nổi dậy ở vài vùng nông thôn" },
    ],
    historicalChoiceId: "uprising",
    seedVotes: { uprising: 58, "wait-allies": 20, rural: 15 },
    fact: "Chỉ trong khoảng hai tuần, chính quyền về tay nhân dân trên cả nước. Ngày 2/9/1945, nước Việt Nam Dân chủ Cộng hòa ra đời.",
    why: "Chớp được thời cơ vì đã chuẩn bị sẵn Mặt trận Việt Minh, lực lượng vũ trang và căn cứ địa từ trước. Chần chừ chờ bên ngoài là tự đánh mất quyền chủ động.",
    source: "Giáo trình Lịch sử Đảng — Chương I, Cách mạng Tháng Tám; Đại hội Quốc dân Tân Trào (8/1945).",
  },

  // ================= CHƯƠNG 2 (1945–1975) =================
  {
    id: "1946-giu-chinh-quyen",
    chapter: 2,
    chapterLabel: CH2,
    year: "1945–1946",
    title: "Ngàn cân treo sợi tóc",
    setup: "Chính quyền vừa ra đời đã đối mặt giặc đói, giặc dốt và giặc ngoại xâm cùng lúc. Ngân khố gần như trống rỗng.",
    prompt: "Cứu chính quyền non trẻ bằng cách nào?",
    choices: [
      { id: "combined", glyph: "🤝", label: "Vừa lo dân sinh, vừa xây chính quyền, vừa ngoại giao mềm dẻo" },
      { id: "military", glyph: "⚔️", label: "Dồn tất cả vào đối đầu quân sự ngay" },
      { id: "surrender", glyph: "🏳️", label: "Nhân nhượng vô điều kiện cho yên" },
    ],
    historicalChoiceId: "combined",
    seedVotes: { combined: 57, military: 22, surrender: 13 },
    fact: "Diệt giặc đói, diệt giặc dốt, dựng nhà nước mới và hòa hoãn khôn khéo — chính quyền vượt qua giai đoạn hiểm nghèo nhất.",
    why: "Nhiều nguy cơ ập đến cùng lúc thì không thể chỉ dùng súng. Phải vừa lo dân sinh, vừa tạo tính chính danh, vừa câu giờ bằng ngoại giao.",
    source: "Giáo trình Lịch sử Đảng — Chương 2; tình thế 'ngàn cân treo sợi tóc' (1945–1946).",
  },
  {
    id: "1946-khang-chien-toan-quoc",
    chapter: 2,
    chapterLabel: CH2,
    year: "Cuối năm 1946",
    title: "Khi nhân nhượng hết đường",
    setup: "Ta đã nhân nhượng nhiều lần, nhưng đối phương lấn tới, quyết cướp nước ta lần nữa. Không còn dư địa hòa hoãn.",
    prompt: "Giờ phải làm gì?",
    choices: [
      { id: "resistance", glyph: "🛡️", label: "Kháng chiến toàn quốc: toàn dân, toàn diện, lâu dài" },
      { id: "concede", glyph: "🙇", label: "Tiếp tục nhân nhượng bằng mọi giá" },
      { id: "conventional", glyph: "🎖️", label: "Đánh chính quy, đối đầu trực diện ngay" },
    ],
    historicalChoiceId: "resistance",
    seedVotes: { resistance: 60, concede: 16, conventional: 18 },
    fact: "Đêm 19/12/1946, Toàn quốc kháng chiến bùng nổ với đường lối toàn dân, toàn diện, lâu dài, tự lực cánh sinh — 'Chúng ta thà hy sinh tất cả chứ nhất định không chịu mất nước'.",
    why: "Nhân nhượng mãi thì mất nước; đánh chính quy khi còn yếu thì thua nhanh. 'Lấy yếu thắng mạnh' phải bằng chiến tranh nhân dân lâu dài.",
    source: "Giáo trình Lịch sử Đảng — Chương 2; Lời kêu gọi Toàn quốc kháng chiến (19/12/1946).",
  },
  {
    id: "1954-dien-bien-phu",
    chapter: 2,
    chapterLabel: CH2,
    year: "Năm 1954",
    title: "Điểm hẹn quyết chiến",
    setup: "Muốn kết thúc chiến tranh có lợi, cần một đòn quyết định. Pháp dựng tập đoàn cứ điểm mạnh nhất Đông Dương giữa một thung lũng.",
    prompt: "Đánh ở đâu, đánh thế nào?",
    choices: [
      { id: "dbp", glyph: "🏔️", label: "Quyết chiến tại Điện Biên Phủ" },
      { id: "avoid", glyph: "🌫️", label: "Tránh quyết chiến, đánh du kích lai rai" },
      { id: "negotiate", glyph: "📝", label: "Đàm phán sớm, chấp nhận chia cắt" },
    ],
    historicalChoiceId: "dbp",
    seedVotes: { dbp: 62, avoid: 18, negotiate: 14 },
    fact: "56 ngày đêm 'khoét núi, ngủ hầm', ta tiêu diệt hoàn toàn tập đoàn cứ điểm Điện Biên Phủ (7/5/1954), buộc Pháp ký Hiệp định Genève.",
    why: "Không có đòn quyết định thì chiến tranh kéo dài bất lợi. Đổi phương châm từ 'đánh nhanh, thắng nhanh' sang 'đánh chắc, tiến chắc' để cầm chắc thắng lợi.",
    source: "Giáo trình Lịch sử Đảng — Chương 2; Chiến dịch Điện Biên Phủ & Hiệp định Genève (1954).",
  },
  {
    id: "1960-hai-nhiem-vu",
    chapter: 2,
    chapterLabel: CH2,
    year: "1954–1965",
    title: "Một nước, hai nhiệm vụ",
    setup: "Đất nước tạm chia hai miền với hai chế độ. Miền Bắc hòa bình, miền Nam còn dưới ách thống trị.",
    prompt: "Một Đảng lãnh đạo hai miền thế nào?",
    choices: [
      { id: "parallel", glyph: "⚖️", label: "Đồng thời hai nhiệm vụ: Bắc là hậu phương, Nam là tiền tuyến" },
      { id: "north-first", glyph: "🏗️", label: "Chỉ lo xây miền Bắc, tạm hoãn đấu tranh ở miền Nam" },
      { id: "south-first", glyph: "⚡", label: "Dồn toàn lực giải phóng miền Nam ngay" },
    ],
    historicalChoiceId: "parallel",
    seedVotes: { parallel: 56, "north-first": 22, "south-first": 17 },
    fact: "Miền Bắc trở thành hậu phương lớn, miền Nam chuyển từ giữ gìn lực lượng sang thế tiến công — làm phá sản chiến lược 'Chiến tranh đặc biệt' của Mỹ.",
    why: "Bỏ miền nào cũng hỏng. Hậu phương vững mới nuôi được tiền tuyến; tiền tuyến thắng mới bảo vệ được hậu phương.",
    source: "Giáo trình Lịch sử Đảng — Chương 2; đường lối Đại hội III (1960).",
  },
  {
    id: "1975-toan-thang",
    chapter: 2,
    chapterLabel: CH2,
    year: "1965–1975",
    title: "Đường tới toàn thắng",
    setup: "Mỹ đổ quân ồ ạt. Muốn thắng, phải bẻ gãy ý chí xâm lược của một siêu cường.",
    prompt: "Kết hợp thế nào để giành thắng lợi cuối cùng?",
    choices: [
      { id: "combined", glyph: "🎯", label: "Kết hợp quân sự – chính trị – ngoại giao, tiến tới tổng tiến công" },
      { id: "military-only", glyph: "💥", label: "Chỉ dựa vào đấu tranh quân sự thuần túy" },
      { id: "talks-only", glyph: "🗣️", label: "Ưu tiên đàm phán, hạn chế đánh" },
    ],
    historicalChoiceId: "combined",
    seedVotes: { combined: 59, "military-only": 20, "talks-only": 15 },
    fact: "'Đánh cho Mỹ cút' (Hiệp định Paris 1973) rồi 'đánh cho ngụy nhào' — Đại thắng mùa Xuân 1975, ngày 30/4 giải phóng miền Nam, thống nhất đất nước.",
    why: "Một siêu cường không thể bị bẻ gãy chỉ bằng súng, cũng không chỉ bằng bàn đàm phán — phải phối hợp cả ba mặt trận.",
    source: "Giáo trình Lịch sử Đảng — Chương 2; Hiệp định Paris (1973) & Đại thắng mùa Xuân (1975).",
  },

  // ================= CHƯƠNG 3 (1975–nay) =================
  {
    id: "1976-thong-nhat",
    chapter: 3,
    chapterLabel: CH3,
    year: "1975–1976",
    title: "Thống nhất rồi, giờ sao?",
    setup: "Súng đã ngừng, non sông liền một dải. Nhưng đất nước kiệt quệ và vẫn phải bảo vệ biên giới.",
    prompt: "Thống nhất đất nước thế nào?",
    choices: [
      { id: "unify-state", glyph: "🗳️", label: "Thống nhất về mặt nhà nước bằng tổng tuyển cử cả nước" },
      { id: "two-admin", glyph: "🧩", label: "Giữ hai chính quyền miền riêng một thời gian" },
      { id: "wait-economy", glyph: "🐢", label: "Chờ kinh tế ổn rồi mới thống nhất" },
    ],
    historicalChoiceId: "unify-state",
    seedVotes: { "unify-state": 58, "two-admin": 20, "wait-economy": 15 },
    fact: "Năm 1976, tổng tuyển cử bầu Quốc hội chung và đặt tên nước là Cộng hòa xã hội chủ nghĩa Việt Nam — thống nhất trọn vẹn về mặt nhà nước.",
    why: "Thắng lợi trên chiến trường phải được hoàn tất bằng thống nhất về nhà nước, tạo nền tảng pháp lý và chính trị để dựng xây.",
    source: "Giáo trình Lịch sử Đảng — Chương 3; Tổng tuyển cử & kỳ họp Quốc hội thống nhất (1976).",
  },
  {
    id: "1981-pha-suc-i",
    chapter: 3,
    chapterLabel: CH3,
    year: "1979–1985",
    title: "Bung ra hay siết lại?",
    setup: "Cơ chế tập trung, bao cấp trói chân sản xuất. Nhiều nơi nông dân và xí nghiệp lén 'xé rào' làm khác — và hiệu quả hơn.",
    prompt: "Trước những cách làm 'xé rào' đó, bạn làm gì?",
    choices: [
      { id: "breakthrough", glyph: "🔓", label: "Cho các bước đột phá bung ra, học từ thực tiễn" },
      { id: "tighten", glyph: "🔒", label: "Siết chặt kỷ luật kế hoạch tập trung" },
      { id: "ignore", glyph: "🙈", label: "Lờ đi, không thay đổi gì" },
    ],
    historicalChoiceId: "breakthrough",
    seedVotes: { breakthrough: 54, tighten: 24, ignore: 13 },
    fact: "Khoán 100 (1981) và chủ trương 'làm cho sản xuất bung ra' — những đột phá cục bộ dần dọn đường cho công cuộc Đổi mới.",
    why: "Thực tiễn 'xé rào' cho thấy cơ chế cũ đã lỗi thời. Lắng nghe cuộc sống thay vì siết lại mới mở được lối đi.",
    source: "Giáo trình Lịch sử Đảng — Chương 3; Chỉ thị 100 (1981) và các bước đột phá tiền Đổi mới.",
  },
  {
    id: "1986-doi-moi",
    chapter: 3,
    chapterLabel: CH3,
    year: "Năm 1986",
    title: "Đổi mới hay tụt hậu",
    setup: "Kinh tế khủng hoảng, lạm phát phi mã, đời sống rất khó khăn. Cơ chế tập trung quan liêu, bao cấp đã hụt hơi.",
    prompt: "Giữ nguyên hay đổi?",
    choices: [
      { id: "reform", glyph: "🔄", label: "Đổi mới toàn diện" },
      { id: "keep", glyph: "🔒", label: "Giữ nguyên cơ chế cũ" },
      { id: "tweak", glyph: "🐢", label: "Chỉ sửa nhẹ vài chỗ" },
    ],
    historicalChoiceId: "reform",
    seedVotes: { reform: 55, keep: 17, tweak: 21 },
    fact: "Đại hội VI (12/1986) khởi xướng công cuộc Đổi mới, đưa đất nước từng bước ra khỏi khủng hoảng và hội nhập với thế giới.",
    why: "Nhìn thẳng vào sự thật, đổi mới tư duy kinh tế nhưng giữ vững định hướng. Sửa nửa vời thì không đủ sức thoát khủng hoảng.",
    source: "Giáo trình Lịch sử Đảng — Chương 3; Văn kiện Đại hội đại biểu toàn quốc lần thứ VI (1986).",
  },
  {
    id: "hoi-nhap",
    chapter: 3,
    chapterLabel: CH3,
    year: "1995–2007",
    title: "Mở cửa mà không lạc lối",
    setup: "Muốn phát triển phải bước ra thế giới. Nhưng mở cửa cũng đi kèm rủi ro chệch hướng.",
    prompt: "Hội nhập thế nào?",
    choices: [
      { id: "proactive", glyph: "🌏", label: "Chủ động hội nhập, đa phương hóa, giữ vững định hướng" },
      { id: "closed", glyph: "🚪", label: "Khép cửa, tự lực hoàn toàn" },
      { id: "wide-open", glyph: "🌊", label: "Mở cửa ồ ạt, buông lỏng mọi thứ" },
    ],
    historicalChoiceId: "proactive",
    seedVotes: { proactive: 57, closed: 18, "wide-open": 17 },
    fact: "Gia nhập ASEAN (1995), bình thường hóa quan hệ với Mỹ, gia nhập WTO (2007) — hội nhập sâu mà vẫn giữ độc lập và định hướng phát triển.",
    why: "Khép cửa thì tụt hậu; mở toang vô điều kiện thì mất chủ động. Tinh thần là 'hòa nhập nhưng không hòa tan'.",
    source: "Giáo trình Lịch sử Đảng — Chương 3; hội nhập quốc tế (ASEAN 1995, WTO 2007).",
  },
  {
    id: "the-che",
    chapter: 3,
    chapterLabel: CH3,
    year: "Hiện nay",
    title: "Giữ niềm tin bằng gì?",
    setup: "Đất nước đạt nhiều thành tựu, nhưng cũng đối mặt với tham nhũng và những hạn chế. Niềm tin phải được giữ bằng hành động.",
    prompt: "Giữ niềm tin bằng cách nào?",
    choices: [
      { id: "institutions", glyph: "🏛️", label: "Xây dựng, chỉnh đốn Đảng, chống tham nhũng, hoàn thiện thể chế" },
      { id: "image", glyph: "🙈", label: "Né tránh để giữ hình ảnh" },
      { id: "growth-only", glyph: "💰", label: "Chỉ lo tăng trưởng, bỏ qua thể chế" },
    ],
    historicalChoiceId: "institutions",
    seedVotes: { institutions: 56, image: 16, "growth-only": 20 },
    fact: "Đẩy mạnh xây dựng, chỉnh đốn Đảng và đấu tranh phòng, chống tham nhũng gắn với hoàn thiện thể chế — nền tảng cho phát triển bền vững.",
    why: "Thành tựu kinh tế không tự nó giữ được niềm tin. Năng lực và sự trong sạch của thể chế mới là cái gốc lâu dài.",
    source: "Giáo trình Lịch sử Đảng — Chương 3; xây dựng, chỉnh đốn Đảng và phòng, chống tham nhũng.",
  },
];
