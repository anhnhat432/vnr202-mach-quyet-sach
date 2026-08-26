// Ngàn Cân Treo Sợi Tóc — kịch bản mô phỏng khủng hoảng 1945–1946.
// Người chơi (một mình, hoặc cả lớp ở chế độ live) lèo lái chính quyền non trẻ qua
// sáu vòng khủng hoảng có thật. Mỗi lựa chọn đánh đổi giữa ba thanh trạng thái.
// Nội dung bám giáo trình Lịch sử Đảng, Chương 2 — tình thế "ngàn cân treo sợi tóc".

export type MeterId = "longDan" | "theNuoc" | "thucLuc";

export type MeterDef = {
  id: MeterId;
  label: string;
  glyph: string;
  blurb: string;
  start: number;
};

export const METERS: MeterDef[] = [
  {
    id: "longDan",
    label: "Lòng dân",
    glyph: "❤️",
    blurb: "Niềm tin của nhân dân — chỗ dựa gốc rễ của cách mạng.",
    start: 60,
  },
  {
    id: "theNuoc",
    label: "Thế nước",
    glyph: "🏛️",
    blurb: "Độc lập, chủ quyền, vị thế trước ngoại bang.",
    start: 35,
  },
  {
    id: "thucLuc",
    label: "Thực lực",
    glyph: "⚙️",
    blurb: "Ngân khố, lương thực, quân đội — sức mạnh vật chất.",
    start: 25,
  },
];

export type CrisisChoice = {
  id: string;
  glyph: string;
  label: string;
  /** Diễn biến điện ảnh khi lựa chọn được thực thi. */
  outcome: string;
  /** Thay đổi ba thanh trạng thái (có thể âm). */
  effects: Partial<Record<MeterId, number>>;
  /** Đây có phải điều Đảng thực sự đã làm không? */
  historical: boolean;
  /** Một dòng "Sử thật" ngắn, gắn với lựa chọn. */
  note: string;
};

export type CrisisRound = {
  id: string;
  turn: string;
  threat: string;
  date: string;
  title: string;
  situation: string;
  question: string;
  choices: CrisisChoice[];
};

export const ROUNDS: CrisisRound[] = [
  {
    id: "giac-doi",
    turn: "Vòng 1",
    threat: "Giặc đói",
    date: "Mùa đông 1945",
    title: "Hai triệu người đã ngã xuống",
    situation:
      "Nạn đói Ất Dậu vừa cướp đi khoảng hai triệu sinh mạng. Đê vỡ, mùa màng thất bát, người chết đói vẫn nằm bên đường. Chính quyền mới chỉ vài tuần tuổi phải cứu dân ngay lập tức.",
    question: "Cứu đói bằng cách nào?",
    choices: [
      {
        id: "share",
        glyph: "🍚",
        label: "Hũ gạo cứu đói · toàn dân tăng gia sản xuất",
        outcome:
          "Cả nước sẻ từng bơ gạo — cứ mười ngày nhịn một bữa bỏ vào hũ gạo cứu đói. 'Tấc đất tấc vàng': đất trống, vỉa hè, bãi bồi đều thành ruộng. Nạn đói bị đẩy lùi chỉ trong vài tháng.",
        effects: { longDan: 12, theNuoc: 2, thucLuc: 10 },
        historical: true,
        note: "Hồ Chí Minh kêu gọi 'nhường cơm sẻ áo'; đầu 1946 nạn đói cơ bản được đẩy lùi.",
      },
      {
        id: "seize",
        glyph: "🚛",
        label: "Trưng thu lương thực nhà giàu, chia cưỡng bức",
        outcome:
          "Kho thóc bị trưng thu, có gạo phát ngay. Nhưng địa chủ, phú nông quay lưng, tin đồn lan nhanh — khối đoàn kết rạn nứt đúng lúc cần nhất.",
        effects: { longDan: -14, theNuoc: -4, thucLuc: 6 },
        historical: false,
        note: "Cưỡng bức khi lòng người chưa vững dễ đẩy tầng lớp trung gian sang phía đối phương.",
      },
      {
        id: "wait-aid",
        glyph: "⏳",
        label: "Chờ viện trợ từ bên ngoài",
        outcome:
          "Không một chuyến gạo nào tới. Mỗi ngày chờ đợi là thêm những người ngã xuống. Dân bắt đầu hỏi: chính quyền mới rốt cuộc làm được gì cho ta?",
        effects: { longDan: -10, thucLuc: -8 },
        historical: false,
        note: "Không nước nào công nhận Việt Nam Dân chủ Cộng hòa lúc này — trông chờ bên ngoài là ngõ cụt.",
      },
    ],
  },
  {
    id: "giac-dot",
    turn: "Vòng 2",
    threat: "Giặc dốt",
    date: "Tháng 9/1945",
    title: "Một dân tộc chưa đọc được tờ truyền đơn của mình",
    situation:
      "Hơn 90% dân số mù chữ. Một quốc gia vừa giành độc lập nhưng gần như không ai đọc nổi một tờ cáo thị của chính quyền mình. Dốt cũng là một thứ giặc.",
    question: "Diệt giặc dốt thế nào?",
    choices: [
      {
        id: "literacy",
        glyph: "📖",
        label: "Bình dân học vụ · toàn dân đi học",
        outcome:
          "Lớp học mọc lên ở đình làng, sân chợ, bến đò. Người biết chữ dạy người chưa biết, viết phấn lên cả tấm lưng trâu. Trong một năm, hàng triệu người thoát nạn mù chữ.",
        effects: { longDan: 10, theNuoc: 3, thucLuc: 6 },
        historical: true,
        note: "Nha Bình dân học vụ lập 8/9/1945; hơn 2,5 triệu người biết đọc viết chỉ trong năm đầu.",
      },
      {
        id: "army-first",
        glyph: "🔫",
        label: "Dồn nguồn lực cho quân sự, học chữ tính sau",
        outcome:
          "Súng được ưu tiên. Nhưng một dân tộc không biết chữ khó dựng nổi bộ máy, khó hiểu chủ trương — nội lực thật sự vẫn ngủ yên.",
        effects: { longDan: -8, theNuoc: 4, thucLuc: -2 },
        historical: false,
        note: "Đảng chủ trương diệt cùng lúc cả ba thứ giặc, không hy sinh dân trí cho quân sự.",
      },
      {
        id: "later",
        glyph: "🙈",
        label: "Chưa cần, để dân tự lo",
        outcome:
          "Không gì thay đổi. Chính quyền nói, nhưng phần lớn dân không đọc được điều mình vừa được trao — độc lập vẫn xa lạ với chính người dân.",
        effects: { longDan: -6, thucLuc: -4 },
        historical: false,
        note: "Dân trí thấp khiến mọi chủ trương khó đi vào cuộc sống, chính quyền khó bám rễ.",
      },
    ],
  },
  {
    id: "ngan-kho",
    turn: "Vòng 3",
    threat: "Ngân khố trống",
    date: "Tháng 9/1945",
    title: "Hơn một triệu đồng, quá nửa là tiền rách",
    situation:
      "Kho bạc chỉ còn hơn 1,2 triệu đồng Đông Dương, quá nửa rách nát. Ngân hàng Đông Dương vẫn nằm trong tay đối phương. Lấy gì nuôi bộ máy, nuôi quân?",
    question: "Xoay xở ngân khố bằng cách nào?",
    choices: [
      {
        id: "gold-week",
        glyph: "💛",
        label: "Tuần lễ Vàng · Quỹ Độc lập — kêu gọi dân góp",
        outcome:
          "'Tuần lễ Vàng' mở ra. Dân góp nhẫn cưới, vòng tay, khuyên tai. Chỉ trong thời gian ngắn, hàng trăm ký vàng và hàng chục triệu đồng chảy về ngân khố.",
        effects: { longDan: 6, theNuoc: 2, thucLuc: 14 },
        historical: true,
        note: "Tuần lễ Vàng (9/1945) thu ~370 kg vàng và ~20 triệu đồng cho Quỹ Độc lập.",
      },
      {
        id: "print",
        glyph: "🖨️",
        label: "In thật nhiều tiền để chi tiêu",
        outcome:
          "Máy in chạy hết công suất, có tiền tiêu ngay. Nhưng giá cả bắt đầu leo thang, đồng tiền mất giá — cái bẫy lạm phát đang há miệng chờ.",
        effects: { longDan: -10, theNuoc: -4, thucLuc: 8 },
        historical: false,
        note: "In tiền vô độ giữa khủng hoảng dễ thổi bùng lạm phát, bào mòn chính niềm tin của dân.",
      },
      {
        id: "tax",
        glyph: "🧾",
        label: "Tăng thuế thật nặng lên dân",
        outcome:
          "Thuế chồng thuế lên những người vừa thoát nạn đói. Chính quyền có thêm tiền, nhưng đánh đổi bằng chính niềm tin vừa gây dựng.",
        effects: { longDan: -14, thucLuc: 6 },
        historical: false,
        note: "Chính quyền cách mạng chủ trương khoan thư sức dân, bãi bỏ nhiều thứ thuế vô lý của chế độ cũ.",
      },
    ],
  },
  {
    id: "quan-tuong",
    turn: "Vòng 4",
    threat: "20 vạn quân Tưởng",
    date: "Cuối năm 1945",
    title: "Thù trong, giặc ngoài cùng ập tới",
    situation:
      "20 vạn quân Tưởng tràn vào miền Bắc 'giải giáp quân Nhật', kéo theo tay sai Việt Quốc, Việt Cách đòi ghế, đòi lương thực, tung tiền mất giá. Cùng lúc, Pháp đã nổ súng ở Nam Bộ.",
    question: "Đối phó với quân Tưởng và tay sai ở miền Bắc thế nào?",
    choices: [
      {
        id: "principled",
        glyph: "🤝",
        label: "Hòa hoãn có nguyên tắc — tránh cùng lúc đánh nhiều kẻ thù",
        outcome:
          "Ta nhường 70 ghế Quốc hội cho Việt Quốc, Việt Cách, cấp một phần lương thực. Nuốt cái nhục trước mắt để không phải đánh Tưởng và Pháp cùng một lúc — dồn sức cho kẻ thù chính là Pháp.",
        effects: { longDan: -3, theNuoc: -6, thucLuc: 8 },
        historical: true,
        note: "Chủ trương 'Hoa–Việt thân thiện': nhân nhượng có nguyên tắc để phân hóa, cô lập kẻ thù.",
      },
      {
        id: "fight-all",
        glyph: "⚔️",
        label: "Đánh đuổi quân Tưởng ngay",
        outcome:
          "20 vạn quân Tưởng không dễ đuổi. Ta sa vào thế cùng lúc chống cả Tưởng lẫn Pháp — rơi đúng vào cái bẫy hiểm nghèo nhất mà lẽ ra phải tránh.",
        effects: { longDan: 4, theNuoc: -18, thucLuc: -14 },
        historical: false,
        note: "Đánh nhiều kẻ thù một lúc khi lực còn mỏng là điều Đảng kiên quyết tránh.",
      },
      {
        id: "yield-all",
        glyph: "🏳️",
        label: "Nhượng bộ tất cả cho yên thân",
        outcome:
          "Nhượng vô nguyên tắc, tay sai được đà lấn tới, đòi cả những vị trí then chốt. Càng lùi, đối phương càng tiến — chính quyền bị rỗng ruột từ bên trong.",
        effects: { longDan: -12, theNuoc: -16 },
        historical: false,
        note: "Nhân nhượng phải có giới hạn, có nguyên tắc — nhượng vô nguyên tắc là tự đánh mất mình.",
      },
    ],
  },
  {
    id: "hiep-dinh-so-bo",
    turn: "Vòng 5",
    threat: "Hiệp ước Hoa – Pháp",
    date: "Tháng 3/1946",
    title: "Nước cờ nghiệt ngã nhất",
    situation:
      "Pháp và Tưởng bắt tay: Pháp sẽ ra Bắc thay quân Tưởng. Ta đứng trước lựa chọn nghiệt ngã — hoặc cùng lúc đánh cả Pháp lẫn Tưởng, hoặc tạm bắt tay với Pháp để tống 20 vạn quân Tưởng về nước.",
    question: "Trước hiệp ước Hoa – Pháp, ta chọn gì?",
    choices: [
      {
        id: "sign",
        glyph: "✒️",
        label: "Ký Hiệp định Sơ bộ 6/3 — hòa để tiến, mượn tay Pháp đuổi Tưởng",
        outcome:
          "Ta ký Hiệp định Sơ bộ: chấp nhận một số quân Pháp ra Bắc, đổi lại 20 vạn quân Tưởng phải rút. Bị gọi là 'nhân nhượng', nhưng ta vừa gạt được một kẻ thù, vừa có thêm thời gian chuẩn bị.",
        effects: { longDan: -6, theNuoc: -4, thucLuc: 12 },
        historical: true,
        note: "Hiệp định Sơ bộ 6/3/1946: hòa hoãn với Pháp để đuổi Tưởng, tranh thủ thời gian — 'hòa để tiến'.",
      },
      {
        id: "war-now",
        glyph: "💥",
        label: "Xé bỏ tất cả, đánh cả hai ngay",
        outcome:
          "Ta lao vào cuộc chiến với cả Pháp lẫn Tưởng khi lực lượng chưa sẵn sàng. Ngàn cân treo sợi tóc — và sợi tóc căng đến mức sắp đứt.",
        effects: { longDan: 6, theNuoc: -14, thucLuc: -18 },
        historical: false,
        note: "Khai chiến khi chưa đủ lực và đang bị bao vây bốn phía là nước đi mạo hiểm chết người.",
      },
      {
        id: "give-up",
        glyph: "😔",
        label: "Buông xuôi, để Pháp trở lại trên thế thượng phong",
        outcome:
          "Ta không chủ động cầm nước cờ mà chấp nhận Pháp quay lại áp đặt. Thành quả của Cách mạng Tháng Tám có nguy cơ tan biến trong tay.",
        effects: { longDan: -14, theNuoc: -20 },
        historical: false,
        note: "Bị động buông xuôi đồng nghĩa đánh mất quyền tự quyết vừa giành được.",
      },
    ],
  },
  {
    id: "tam-uoc",
    turn: "Vòng 6",
    threat: "Chiến tranh cận kề",
    date: "Cuối năm 1946",
    title: "Còn nước, còn tát",
    situation:
      "Đàm phán chính thức ở Fontainebleau bế tắc. Pháp lấn tới, khiêu khích khắp nơi — chiến tranh gần như chắc chắn. Ta chỉ còn một khoảng thời gian mong manh.",
    question: "Dùng khoảng thời gian mong manh còn lại thế nào?",
    choices: [
      {
        id: "modus",
        glyph: "🕰️",
        label: "Ký Tạm ước 14/9, tranh thủ từng ngày chuẩn bị kháng chiến",
        outcome:
          "Chủ tịch Hồ Chí Minh ký Tạm ước 14/9 — nhân nhượng thêm một bước để có thêm thời gian. Ta khẩn trương chuyển lực lượng, di dời máy móc, dựng thế trận cho cuộc kháng chiến sắp tới.",
        effects: { longDan: 2, theNuoc: -2, thucLuc: 12 },
        historical: true,
        note: "Tạm ước 14/9/1946 kéo dài hòa hoãn để chuẩn bị; Toàn quốc kháng chiến bùng nổ 19/12/1946.",
      },
      {
        id: "strike",
        glyph: "🔥",
        label: "Ngừng nhân nhượng, nổ súng trước",
        outcome:
          "Ta khai chiến khi hậu phương chưa kịp dựng, lực lượng chưa kịp chuyển. Có khí thế ngùn ngụt, nhưng đánh đổi bằng chính sự chuẩn bị sống còn.",
        effects: { longDan: 4, theNuoc: -6, thucLuc: -12 },
        historical: false,
        note: "Kháng chiến nổ ra khi chưa chuẩn bị đủ sẽ bất lợi ngay từ những ngày đầu.",
      },
      {
        id: "drift",
        glyph: "💤",
        label: "Cứ hòa hoãn, không chuẩn bị gì thêm",
        outcome:
          "Ta ru ngủ trong hòa hoãn, không dựng thế trận. Khi Pháp ra tay, ta hoàn toàn bị động — nhân nhượng mà không chuẩn bị là tự trói tay mình.",
        effects: { longDan: -6, theNuoc: -8, thucLuc: -8 },
        historical: false,
        note: "Hòa hoãn chỉ có ý nghĩa khi đi kèm khẩn trương chuẩn bị cho tình huống xấu nhất.",
      },
    ],
  },
];

export const LESSON = {
  title: "Dĩ bất biến, ứng vạn biến",
  body:
    "Kiên định mục tiêu độc lập (cái bất biến), nhưng mềm dẻo, nhân nhượng CÓ NGUYÊN TẮC về sách lược (cái vạn biến). Hòa hoãn không phải đầu hàng — mà để bảo toàn lực lượng và giành thời gian. Đó là cách chính quyền cách mạng vượt qua tình thế 'ngàn cân treo sợi tóc' 1945–1946.",
};

export const CLAMP_MIN = 0;
export const CLAMP_MAX = 100;
