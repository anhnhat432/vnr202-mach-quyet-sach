begin;

insert into public.sources
    (id, title, author_or_issuer, publication_year, locator, url, source_type, rights_note, verification_status)
    values ('10000000-0000-0000-0000-000000000001', 'Giáo trình Lịch sử Đảng Cộng sản Việt Nam dành cho sinh viên khối không chuyên', 'Bộ Giáo dục và Đào tạo', 2021,
      'Chương I-III', null, 'textbook', 'Tài liệu chính của môn học',
      'verified');

insert into public.sources
    (id, title, author_or_issuer, publication_year, locator, url, source_type, rights_note, verification_status)
    values ('10000000-0000-0000-0000-000000000004', 'VNR202 Session 4 - Thành lập Đảng và Cương lĩnh chính trị đầu tiên', 'Bộ môn VNR202, FPT University', 2026,
      'Slides 3-18', null, 'course_slide', 'Học liệu nội bộ dùng cho sản phẩm môn học',
      'verified');

insert into public.sources
    (id, title, author_or_issuer, publication_year, locator, url, source_type, rights_note, verification_status)
    values ('10000000-0000-0000-0000-000000000011', 'VNR202 Session 11 - Xây dựng và bảo vệ chính quyền cách mạng 1945-1946', 'Bộ môn VNR202, FPT University', 2026,
      'Slides 3-18', null, 'course_slide', 'Học liệu nội bộ dùng cho sản phẩm môn học',
      'verified');

insert into public.sources
    (id, title, author_or_issuer, publication_year, locator, url, source_type, rights_note, verification_status)
    values ('10000000-0000-0000-0000-000000000022', 'VNR202 Session 22 - Đại hội VI và đường lối đổi mới toàn diện', 'Bộ môn VNR202, FPT University', 2026,
      'Slides 3-26', null, 'course_slide', 'Học liệu nội bộ dùng cho sản phẩm môn học',
      'verified');

insert into public.dossiers
    (id, slug, chapter, order_index, title, central_question, status)
    values ('20000000-0000-0000-0000-000000000001', 'con-duong-nao-cho-doc-lap', 'chapter_1', 1,
      'Con đường nào cho độc lập?', 'Một đường lối mới cần đáp ứng những điều kiện nào để giải quyết khủng hoảng cứu nước?', 'draft');

insert into public.dossiers
    (id, slug, chapter, order_index, title, central_question, status)
    values ('20000000-0000-0000-0000-000000000002', 'hop-nhat-de-mo-duong', 'chapter_1', 2,
      'Hợp nhất để mở đường', 'Làm thế nào thống nhất lực lượng cộng sản và hình thành một cương lĩnh có khả năng quy tụ cách mạng?', 'published');

insert into public.dossier_versions
    (id, dossier_id, version, schema_version, content, reviewed_at, published_at)
    values ('30000000-0000-0000-0000-000000000002', '20000000-0000-0000-0000-000000000002', 1, 1, '{"briefing":{"period":"1929-1930","context":["Phong trào công nhân và phong trào yêu nước phát triển, đòi hỏi một tổ chức lãnh đạo thống nhất.","Ba tổ chức cộng sản lần lượt ra đời nhưng hoạt động phân tán và có nguy cơ tranh giành ảnh hưởng."],"centralContradiction":"Yêu cầu thống nhất lực lượng cách mạng đối lập với tình trạng chia rẽ tổ chức và thiếu một cương lĩnh chung.","objective":"Hình thành một chính đảng thống nhất với đường lối giải phóng dân tộc phù hợp hoàn cảnh Việt Nam.","constraints":["Phải xử lý bất đồng giữa các tổ chức cộng sản.","Cương lĩnh phải xác định đúng nhiệm vụ, lực lượng và phương pháp cách mạng."]},"evidence":[{"id":"c1-e1","label":"Sự trưởng thành của phong trào công nhân","kind":"event","summary":"Các cuộc bãi công chuyển dần từ yêu cầu kinh tế sang nội dung chính trị và liên kết rộng hơn.","sourceIds":["10000000-0000-0000-0000-000000000004"],"isDistractor":false},{"id":"c1-e2","label":"Ba tổ chức cộng sản cùng tồn tại","kind":"assessment","summary":"Sự ra đời của các tổ chức cộng sản phản ánh xu thế cách mạng nhưng tạo nguy cơ phân tán lãnh đạo.","sourceIds":["10000000-0000-0000-0000-000000000004"],"isDistractor":false},{"id":"c1-e3","label":"Vai trò chuẩn bị của Nguyễn Ái Quốc","kind":"document","summary":"Công tác truyền bá lý luận, đào tạo cán bộ và xây dựng tổ chức tạo tiền đề tư tưởng, chính trị và tổ chức.","sourceIds":["10000000-0000-0000-0000-000000000001"],"isDistractor":false},{"id":"c1-e4","label":"Ưu tiên mở rộng từng tổ chức riêng lẻ","kind":"assessment","summary":"Tiếp tục phát triển riêng lẻ có thể tăng lực lượng cục bộ nhưng không giải quyết yêu cầu thống nhất lãnh đạo.","sourceIds":["10000000-0000-0000-0000-000000000004"],"isDistractor":true}],"decision":{"prompt":"Hãy chọn hướng quyết định có khả năng giải quyết đồng thời vấn đề tổ chức và đường lối.","requiredEvidenceCount":3,"options":[{"id":"unify","label":"Triệu tập hội nghị hợp nhất và thông qua cương lĩnh chung","rationale":"Giải quyết chia rẽ tổ chức đồng thời xác lập nhiệm vụ và lực lượng cách mạng."},{"id":"separate","label":"Giữ ba tổ chức hoạt động độc lập rồi phối hợp khi cần","rationale":"Tránh va chạm trước mắt nhưng duy trì cạnh tranh và thiếu trung tâm lãnh đạo thống nhất."}]},"projectedConsequences":[{"optionId":"unify","steps":["Tạo một trung tâm lãnh đạo thống nhất.","Hình thành cương lĩnh chung làm căn cứ tập hợp lực lượng.","Giảm xung đột tổ chức và mở khả năng phát triển phong trào trên phạm vi cả nước."]},{"optionId":"separate","steps":["Mỗi tổ chức tiếp tục xây dựng ảnh hưởng riêng.","Cạnh tranh làm suy giảm khả năng phối hợp.","Phong trào thiếu đường lối và cơ quan lãnh đạo thống nhất."]}],"historicalComparison":{"actualDecision":"Hội nghị đầu năm 1930 do Nguyễn Ái Quốc chủ trì đã thống nhất các tổ chức cộng sản và thành lập Đảng Cộng sản Việt Nam.","implementation":["Thông qua các văn kiện xác định phương hướng chiến lược, nhiệm vụ và lực lượng cách mạng.","Xây dựng tổ chức thống nhất thay cho tình trạng phân tán trước đó."],"results":["Chấm dứt cơ bản khủng hoảng về đường lối và tổ chức lãnh đạo của cách mạng Việt Nam.","Tạo nền tảng chính trị để lãnh đạo phong trào cách mạng phát triển."],"limitations":["Việc thống nhất tổ chức không tự động loại bỏ mọi khác biệt nhận thức và khó khăn trong thực tiễn hoạt động bí mật."]},"lessons":["Thống nhất tổ chức phải gắn với thống nhất đường lối.","Đường lối chỉ có sức quy tụ khi xuất phát từ yêu cầu thực tế của dân tộc."],"sources":[{"id":"10000000-0000-0000-0000-000000000001","title":"Giáo trình Lịch sử Đảng Cộng sản Việt Nam dành cho sinh viên khối không chuyên","authorOrIssuer":"Bộ Giáo dục và Đào tạo","locator":"Chương I","url":null},{"id":"10000000-0000-0000-0000-000000000004","title":"VNR202 Session 4 - Thành lập Đảng và Cương lĩnh chính trị đầu tiên","authorOrIssuer":"Bộ môn VNR202, FPT University","locator":"Slides 3-18","url":null}]}'::jsonb, now(), now());

update public.dossiers set current_version_id = '30000000-0000-0000-0000-000000000002', updated_at = now()
    where id = '20000000-0000-0000-0000-000000000002';

insert into public.claims (id, dossier_version_id, category, statement)
      values ('40000000-0000-0000-0000-000000000021', '30000000-0000-0000-0000-000000000002', 'context', 'Phong trào công nhân và phong trào yêu nước phát triển, đòi hỏi một tổ chức lãnh đạo thống nhất.');

insert into public.claim_source_links (claim_id, source_id, support_scope)
      values ('40000000-0000-0000-0000-000000000021', '10000000-0000-0000-0000-000000000001', 'Hỗ trợ luận điểm context trong hồ sơ Hợp nhất để mở đường.');

insert into public.claims (id, dossier_version_id, category, statement)
      values ('40000000-0000-0000-0000-000000000022', '30000000-0000-0000-0000-000000000002', 'basis', 'Yêu cầu thống nhất lực lượng cách mạng đối lập với tình trạng chia rẽ tổ chức và thiếu một cương lĩnh chung.');

insert into public.claim_source_links (claim_id, source_id, support_scope)
      values ('40000000-0000-0000-0000-000000000022', '10000000-0000-0000-0000-000000000004', 'Hỗ trợ luận điểm basis trong hồ sơ Hợp nhất để mở đường.');

insert into public.claims (id, dossier_version_id, category, statement)
      values ('40000000-0000-0000-0000-000000000023', '30000000-0000-0000-0000-000000000002', 'implementation', 'Thông qua các văn kiện xác định phương hướng chiến lược, nhiệm vụ và lực lượng cách mạng.');

insert into public.claim_source_links (claim_id, source_id, support_scope)
      values ('40000000-0000-0000-0000-000000000023', '10000000-0000-0000-0000-000000000001', 'Hỗ trợ luận điểm implementation trong hồ sơ Hợp nhất để mở đường.');

insert into public.claims (id, dossier_version_id, category, statement)
      values ('40000000-0000-0000-0000-000000000024', '30000000-0000-0000-0000-000000000002', 'result', 'Chấm dứt cơ bản khủng hoảng về đường lối và tổ chức lãnh đạo của cách mạng Việt Nam.');

insert into public.claim_source_links (claim_id, source_id, support_scope)
      values ('40000000-0000-0000-0000-000000000024', '10000000-0000-0000-0000-000000000004', 'Hỗ trợ luận điểm result trong hồ sơ Hợp nhất để mở đường.');

insert into public.claims (id, dossier_version_id, category, statement)
      values ('40000000-0000-0000-0000-000000000025', '30000000-0000-0000-0000-000000000002', 'limitation', 'Việc thống nhất tổ chức không tự động loại bỏ mọi khác biệt nhận thức và khó khăn trong thực tiễn hoạt động bí mật.');

insert into public.claim_source_links (claim_id, source_id, support_scope)
      values ('40000000-0000-0000-0000-000000000025', '10000000-0000-0000-0000-000000000001', 'Hỗ trợ luận điểm limitation trong hồ sơ Hợp nhất để mở đường.');

insert into public.claims (id, dossier_version_id, category, statement)
      values ('40000000-0000-0000-0000-000000000026', '30000000-0000-0000-0000-000000000002', 'lesson', 'Thống nhất tổ chức phải gắn với thống nhất đường lối.');

insert into public.claim_source_links (claim_id, source_id, support_scope)
      values ('40000000-0000-0000-0000-000000000026', '10000000-0000-0000-0000-000000000004', 'Hỗ trợ luận điểm lesson trong hồ sơ Hợp nhất để mở đường.');

insert into public.causal_nodes
      (id, dossier_version_id, lane, label, explanation, sort_index)
      values ('50000000-0000-0000-0000-000000000021', '30000000-0000-0000-0000-000000000002', 'context', 'Phong trào công nhân và phong trào yêu nước phát triển, đòi hỏi một tổ chức lãnh đạo thống nhất.', 'Phong trào công nhân và phong trào yêu nước phát triển, đòi hỏi một tổ chức lãnh đạo thống nhất.', 1);

insert into public.causal_nodes
      (id, dossier_version_id, lane, label, explanation, sort_index)
      values ('50000000-0000-0000-0000-000000000022', '30000000-0000-0000-0000-000000000002', 'contradiction', 'Yêu cầu thống nhất lực lượng cách mạng đối lập với tình trạng chia rẽ tổ chức và thiếu một cương lĩnh chung.', 'Yêu cầu thống nhất lực lượng cách mạng đối lập với tình trạng chia rẽ tổ chức và thiếu một cương lĩnh chung.', 2);

insert into public.causal_nodes
      (id, dossier_version_id, lane, label, explanation, sort_index)
      values ('50000000-0000-0000-0000-000000000023', '30000000-0000-0000-0000-000000000002', 'decision', 'Hội nghị đầu năm 1930 do Nguyễn Ái Quốc chủ trì đã thống nhất các tổ chức cộng sản và thành lập Đảng Cộng sản Việt Nam.', 'Hội nghị đầu năm 1930 do Nguyễn Ái Quốc chủ trì đã thống nhất các tổ chức cộng sản và thành lập Đảng Cộng sản Việt Nam.', 3);

insert into public.causal_nodes
      (id, dossier_version_id, lane, label, explanation, sort_index)
      values ('50000000-0000-0000-0000-000000000024', '30000000-0000-0000-0000-000000000002', 'result', 'Chấm dứt cơ bản khủng hoảng về đường lối và tổ chức lãnh đạo của cách mạng Việt Nam.', 'Chấm dứt cơ bản khủng hoảng về đường lối và tổ chức lãnh đạo của cách mạng Việt Nam.', 4);

insert into public.causal_nodes
      (id, dossier_version_id, lane, label, explanation, sort_index)
      values ('50000000-0000-0000-0000-000000000025', '30000000-0000-0000-0000-000000000002', 'lesson', 'Thống nhất tổ chức phải gắn với thống nhất đường lối.', 'Thống nhất tổ chức phải gắn với thống nhất đường lối.', 5);

insert into public.causal_edges
      (id, source_node_id, target_node_id, relation, explanation, claim_id)
      values ('60000000-0000-0000-0000-000000000021', '50000000-0000-0000-0000-000000000021',
        '50000000-0000-0000-0000-000000000022', 'condition', 'Yêu cầu thống nhất lực lượng cách mạng đối lập với tình trạng chia rẽ tổ chức và thiếu một cương lĩnh chung.', '40000000-0000-0000-0000-000000000021');

insert into public.causal_edges
      (id, source_node_id, target_node_id, relation, explanation, claim_id)
      values ('60000000-0000-0000-0000-000000000022', '50000000-0000-0000-0000-000000000022',
        '50000000-0000-0000-0000-000000000023', 'response', 'Hội nghị đầu năm 1930 do Nguyễn Ái Quốc chủ trì đã thống nhất các tổ chức cộng sản và thành lập Đảng Cộng sản Việt Nam.', '40000000-0000-0000-0000-000000000022');

insert into public.causal_edges
      (id, source_node_id, target_node_id, relation, explanation, claim_id)
      values ('60000000-0000-0000-0000-000000000023', '50000000-0000-0000-0000-000000000023',
        '50000000-0000-0000-0000-000000000024', 'outcome', 'Chấm dứt cơ bản khủng hoảng về đường lối và tổ chức lãnh đạo của cách mạng Việt Nam.', '40000000-0000-0000-0000-000000000024');

insert into public.causal_edges
      (id, source_node_id, target_node_id, relation, explanation, claim_id)
      values ('60000000-0000-0000-0000-000000000024', '50000000-0000-0000-0000-000000000024',
        '50000000-0000-0000-0000-000000000025', 'lesson', 'Thống nhất tổ chức phải gắn với thống nhất đường lối.', '40000000-0000-0000-0000-000000000026');

insert into public.dossiers
    (id, slug, chapter, order_index, title, central_question, status)
    values ('20000000-0000-0000-0000-000000000003', 'giu-mach-phong-trao', 'chapter_1', 3,
      'Giữ mạch phong trào', 'Làm thế nào phục hồi tổ chức và phong trào sau tổn thất lớn?', 'draft');

insert into public.dossiers
    (id, slug, chapter, order_index, title, central_question, status)
    values ('20000000-0000-0000-0000-000000000004', 'linh-hoat-trong-cua-so-dan-chu', 'chapter_1', 4,
      'Linh hoạt trong một cửa sổ dân chủ', 'Khi điều kiện thay đổi, mục tiêu và hình thức đấu tranh cần điều chỉnh ra sao?', 'draft');

insert into public.dossiers
    (id, slug, chapter, order_index, title, central_question, status)
    values ('20000000-0000-0000-0000-000000000005', 'chop-dung-thoi-co', 'chapter_1', 5,
      'Chớp đúng thời cơ', 'Điều kiện nào biến thời cơ thành quyết định Tổng khởi nghĩa?', 'draft');

insert into public.dossiers
    (id, slug, chapter, order_index, title, central_question, status)
    values ('20000000-0000-0000-0000-000000000006', 'giu-chinh-quyen-giua-vong-vay', 'chapter_2', 6,
      'Giữ chính quyền giữa vòng vây', 'Ưu tiên quyết sách nào để bảo vệ chính quyền non trẻ trong nhiều nguy cơ đồng thời?', 'published');

insert into public.dossier_versions
    (id, dossier_id, version, schema_version, content, reviewed_at, published_at)
    values ('30000000-0000-0000-0000-000000000006', '20000000-0000-0000-0000-000000000006', 1, 1, '{"briefing":{"period":"1945-1946","context":["Chính quyền cách mạng mới thành lập phải đối mặt nạn đói, nạn dốt và tài chính kiệt quệ.","Nhiều lực lượng nước ngoài và phản động cùng gây sức ép trong khi bộ máy nhà nước còn non trẻ."],"centralContradiction":"Phải bảo vệ thành quả cách mạng trong khi nguồn lực kinh tế, quân sự và hành chính đều rất hạn chế.","objective":"Củng cố tính chính danh, giảm bớt kẻ thù trực tiếp và tạo thời gian xây dựng lực lượng.","constraints":["Không thể đồng thời đối đầu quân sự với mọi lực lượng.","Đời sống nhân dân và năng lực quản trị cần được cải thiện ngay."]},"evidence":[{"id":"c2-e1","label":"Nạn đói và ngân khố khó khăn","kind":"data","summary":"Khủng hoảng đời sống và tài chính đe dọa trực tiếp niềm tin vào chính quyền mới.","sourceIds":["10000000-0000-0000-0000-000000000011"],"isDistractor":false},{"id":"c2-e2","label":"Yêu cầu xây dựng chính quyền hợp pháp","kind":"document","summary":"Tổng tuyển cử và xây dựng thiết chế nhà nước giúp củng cố nền tảng chính trị và pháp lý.","sourceIds":["10000000-0000-0000-0000-000000000001"],"isDistractor":false},{"id":"c2-e3","label":"Nhiều lực lượng gây sức ép","kind":"assessment","summary":"Tình thế đòi hỏi phân hóa đối phương và lựa chọn đối tượng nguy hiểm trực tiếp theo từng thời điểm.","sourceIds":["10000000-0000-0000-0000-000000000011"],"isDistractor":false},{"id":"c2-e4","label":"Tập trung duy nhất vào quân sự","kind":"assessment","summary":"Ưu tiên tuyệt đối cho đối đầu quân sự bỏ qua khủng hoảng dân sinh, chính trị và ngoại giao.","sourceIds":["10000000-0000-0000-0000-000000000011"],"isDistractor":true}],"decision":{"prompt":"Chọn gói quyết sách tạo được thời gian, tính chính danh và sức dân cho chính quyền mới.","requiredEvidenceCount":3,"options":[{"id":"combined","label":"Kết hợp dân sinh, xây dựng chính quyền và ngoại giao mềm dẻo","rationale":"Giải quyết đồng thời nền tảng bên trong và áp lực đối ngoại trong điều kiện chưa thể đối đầu toàn diện."},{"id":"military-first","label":"Dồn toàn bộ nguồn lực vào đối đầu quân sự ngay lập tức","rationale":"Thể hiện quyết tâm nhưng làm tăng nguy cơ bị cô lập và suy yếu nền tảng trong nước."}]},"projectedConsequences":[{"optionId":"combined","steps":["Cải thiện niềm tin và huy động sức dân.","Củng cố cơ sở pháp lý của chính quyền.","Phân hóa đối phương và kéo dài thời gian chuẩn bị lực lượng."]},{"optionId":"military-first","steps":["Nguồn lực ít ỏi bị phân tán trong đối đầu nhiều phía.","Khủng hoảng dân sinh tiếp tục làm suy giảm nền tảng xã hội.","Chính quyền có nguy cơ bị cô lập trước khi củng cố lực lượng."]}],"historicalComparison":{"actualDecision":"Đường lối bảo vệ chính quyền kết hợp chống đói, chống dốt, xây dựng nhà nước mới, trấn áp phản cách mạng và ngoại giao linh hoạt.","implementation":["Tổ chức Tổng tuyển cử và xây dựng các thiết chế nhà nước.","Phát động các biện pháp cứu đói, tăng gia sản xuất và xóa nạn mù chữ.","Thực hiện sách lược hòa hoãn có nguyên tắc để phân hóa đối phương và tranh thủ thời gian."],"results":["Chính quyền cách mạng được củng cố và vượt qua giai đoạn đặc biệt nguy hiểm.","Lực lượng được chuẩn bị thêm cho cuộc kháng chiến lâu dài."],"limitations":["Các biện pháp hòa hoãn chỉ có giá trị trong thời gian nhất định và không loại bỏ nguy cơ chiến tranh."]},"lessons":["Bảo vệ chính quyền cần kết hợp sức mạnh dân sinh, chính trị, quân sự và ngoại giao.","Trong thế yếu phải biết phân hóa đối phương và sử dụng thời gian như một nguồn lực chiến lược."],"sources":[{"id":"10000000-0000-0000-0000-000000000001","title":"Giáo trình Lịch sử Đảng Cộng sản Việt Nam dành cho sinh viên khối không chuyên","authorOrIssuer":"Bộ Giáo dục và Đào tạo","locator":"Chương II","url":null},{"id":"10000000-0000-0000-0000-000000000011","title":"VNR202 Session 11 - Xây dựng và bảo vệ chính quyền cách mạng 1945-1946","authorOrIssuer":"Bộ môn VNR202, FPT University","locator":"Slides 3-18","url":null}]}'::jsonb, now(), now());

update public.dossiers set current_version_id = '30000000-0000-0000-0000-000000000006', updated_at = now()
    where id = '20000000-0000-0000-0000-000000000006';

insert into public.claims (id, dossier_version_id, category, statement)
      values ('40000000-0000-0000-0000-000000000061', '30000000-0000-0000-0000-000000000006', 'context', 'Chính quyền cách mạng mới thành lập phải đối mặt nạn đói, nạn dốt và tài chính kiệt quệ.');

insert into public.claim_source_links (claim_id, source_id, support_scope)
      values ('40000000-0000-0000-0000-000000000061', '10000000-0000-0000-0000-000000000001', 'Hỗ trợ luận điểm context trong hồ sơ Giữ chính quyền giữa vòng vây.');

insert into public.claims (id, dossier_version_id, category, statement)
      values ('40000000-0000-0000-0000-000000000062', '30000000-0000-0000-0000-000000000006', 'basis', 'Phải bảo vệ thành quả cách mạng trong khi nguồn lực kinh tế, quân sự và hành chính đều rất hạn chế.');

insert into public.claim_source_links (claim_id, source_id, support_scope)
      values ('40000000-0000-0000-0000-000000000062', '10000000-0000-0000-0000-000000000011', 'Hỗ trợ luận điểm basis trong hồ sơ Giữ chính quyền giữa vòng vây.');

insert into public.claims (id, dossier_version_id, category, statement)
      values ('40000000-0000-0000-0000-000000000063', '30000000-0000-0000-0000-000000000006', 'implementation', 'Tổ chức Tổng tuyển cử và xây dựng các thiết chế nhà nước.');

insert into public.claim_source_links (claim_id, source_id, support_scope)
      values ('40000000-0000-0000-0000-000000000063', '10000000-0000-0000-0000-000000000001', 'Hỗ trợ luận điểm implementation trong hồ sơ Giữ chính quyền giữa vòng vây.');

insert into public.claims (id, dossier_version_id, category, statement)
      values ('40000000-0000-0000-0000-000000000064', '30000000-0000-0000-0000-000000000006', 'result', 'Chính quyền cách mạng được củng cố và vượt qua giai đoạn đặc biệt nguy hiểm.');

insert into public.claim_source_links (claim_id, source_id, support_scope)
      values ('40000000-0000-0000-0000-000000000064', '10000000-0000-0000-0000-000000000011', 'Hỗ trợ luận điểm result trong hồ sơ Giữ chính quyền giữa vòng vây.');

insert into public.claims (id, dossier_version_id, category, statement)
      values ('40000000-0000-0000-0000-000000000065', '30000000-0000-0000-0000-000000000006', 'limitation', 'Các biện pháp hòa hoãn chỉ có giá trị trong thời gian nhất định và không loại bỏ nguy cơ chiến tranh.');

insert into public.claim_source_links (claim_id, source_id, support_scope)
      values ('40000000-0000-0000-0000-000000000065', '10000000-0000-0000-0000-000000000001', 'Hỗ trợ luận điểm limitation trong hồ sơ Giữ chính quyền giữa vòng vây.');

insert into public.claims (id, dossier_version_id, category, statement)
      values ('40000000-0000-0000-0000-000000000066', '30000000-0000-0000-0000-000000000006', 'lesson', 'Bảo vệ chính quyền cần kết hợp sức mạnh dân sinh, chính trị, quân sự và ngoại giao.');

insert into public.claim_source_links (claim_id, source_id, support_scope)
      values ('40000000-0000-0000-0000-000000000066', '10000000-0000-0000-0000-000000000011', 'Hỗ trợ luận điểm lesson trong hồ sơ Giữ chính quyền giữa vòng vây.');

insert into public.causal_nodes
      (id, dossier_version_id, lane, label, explanation, sort_index)
      values ('50000000-0000-0000-0000-000000000061', '30000000-0000-0000-0000-000000000006', 'context', 'Chính quyền cách mạng mới thành lập phải đối mặt nạn đói, nạn dốt và tài chính kiệt quệ.', 'Chính quyền cách mạng mới thành lập phải đối mặt nạn đói, nạn dốt và tài chính kiệt quệ.', 1);

insert into public.causal_nodes
      (id, dossier_version_id, lane, label, explanation, sort_index)
      values ('50000000-0000-0000-0000-000000000062', '30000000-0000-0000-0000-000000000006', 'contradiction', 'Phải bảo vệ thành quả cách mạng trong khi nguồn lực kinh tế, quân sự và hành chính đều rất hạn chế.', 'Phải bảo vệ thành quả cách mạng trong khi nguồn lực kinh tế, quân sự và hành chính đều rất hạn chế.', 2);

insert into public.causal_nodes
      (id, dossier_version_id, lane, label, explanation, sort_index)
      values ('50000000-0000-0000-0000-000000000063', '30000000-0000-0000-0000-000000000006', 'decision', 'Đường lối bảo vệ chính quyền kết hợp chống đói, chống dốt, xây dựng nhà nước mới, trấn áp phản cách mạng và ngoại giao linh hoạt.', 'Đường lối bảo vệ chính quyền kết hợp chống đói, chống dốt, xây dựng nhà nước mới, trấn áp phản cách mạng và ngoại giao linh hoạt.', 3);

insert into public.causal_nodes
      (id, dossier_version_id, lane, label, explanation, sort_index)
      values ('50000000-0000-0000-0000-000000000064', '30000000-0000-0000-0000-000000000006', 'result', 'Chính quyền cách mạng được củng cố và vượt qua giai đoạn đặc biệt nguy hiểm.', 'Chính quyền cách mạng được củng cố và vượt qua giai đoạn đặc biệt nguy hiểm.', 4);

insert into public.causal_nodes
      (id, dossier_version_id, lane, label, explanation, sort_index)
      values ('50000000-0000-0000-0000-000000000065', '30000000-0000-0000-0000-000000000006', 'lesson', 'Bảo vệ chính quyền cần kết hợp sức mạnh dân sinh, chính trị, quân sự và ngoại giao.', 'Bảo vệ chính quyền cần kết hợp sức mạnh dân sinh, chính trị, quân sự và ngoại giao.', 5);

insert into public.causal_edges
      (id, source_node_id, target_node_id, relation, explanation, claim_id)
      values ('60000000-0000-0000-0000-000000000061', '50000000-0000-0000-0000-000000000061',
        '50000000-0000-0000-0000-000000000062', 'condition', 'Phải bảo vệ thành quả cách mạng trong khi nguồn lực kinh tế, quân sự và hành chính đều rất hạn chế.', '40000000-0000-0000-0000-000000000061');

insert into public.causal_edges
      (id, source_node_id, target_node_id, relation, explanation, claim_id)
      values ('60000000-0000-0000-0000-000000000062', '50000000-0000-0000-0000-000000000062',
        '50000000-0000-0000-0000-000000000063', 'response', 'Đường lối bảo vệ chính quyền kết hợp chống đói, chống dốt, xây dựng nhà nước mới, trấn áp phản cách mạng và ngoại giao linh hoạt.', '40000000-0000-0000-0000-000000000062');

insert into public.causal_edges
      (id, source_node_id, target_node_id, relation, explanation, claim_id)
      values ('60000000-0000-0000-0000-000000000063', '50000000-0000-0000-0000-000000000063',
        '50000000-0000-0000-0000-000000000064', 'outcome', 'Chính quyền cách mạng được củng cố và vượt qua giai đoạn đặc biệt nguy hiểm.', '40000000-0000-0000-0000-000000000064');

insert into public.causal_edges
      (id, source_node_id, target_node_id, relation, explanation, claim_id)
      values ('60000000-0000-0000-0000-000000000064', '50000000-0000-0000-0000-000000000064',
        '50000000-0000-0000-0000-000000000065', 'lesson', 'Bảo vệ chính quyền cần kết hợp sức mạnh dân sinh, chính trị, quân sự và ngoại giao.', '40000000-0000-0000-0000-000000000066');

insert into public.dossiers
    (id, slug, chapter, order_index, title, central_question, status)
    values ('20000000-0000-0000-0000-000000000007', 'khi-hoa-hoan-khong-con-du', 'chapter_2', 7,
      'Khi hòa hoãn không còn đủ', 'Khi nào cần chuyển từ hòa hoãn sang kháng chiến toàn quốc?', 'draft');

insert into public.dossiers
    (id, slug, chapter, order_index, title, central_question, status)
    values ('20000000-0000-0000-0000-000000000008', 'tao-the-cho-quyet-chien', 'chapter_2', 8,
      'Tạo thế cho quyết chiến', 'Làm thế nào chuyển từ cầm cự sang chủ động chiến lược và kết thúc chiến tranh?', 'draft');

insert into public.dossiers
    (id, slug, chapter, order_index, title, central_question, status)
    values ('20000000-0000-0000-0000-000000000009', 'mot-dat-nuoc-hai-nhiem-vu', 'chapter_2', 9,
      'Một đất nước, hai nhiệm vụ chiến lược', 'Hai miền có thể hỗ trợ nhau như thế nào trong một chiến lược chung?', 'draft');

insert into public.dossiers
    (id, slug, chapter, order_index, title, central_question, status)
    values ('20000000-0000-0000-0000-000000000010', 'tu-doi-dau-cuc-bo-den-toan-thang', 'chapter_2', 10,
      'Từ đối đầu cục bộ đến toàn thắng', 'Những điều chỉnh nào tạo ra thế và lực cho quyết định kết thúc chiến tranh?', 'draft');

insert into public.dossiers
    (id, slug, chapter, order_index, title, central_question, status)
    values ('20000000-0000-0000-0000-000000000011', 'bai-toan-hau-chien', 'chapter_3', 11,
      'Bài toán hậu chiến', 'Làm thế nào vừa thống nhất, khôi phục vừa bảo vệ đất nước sau chiến tranh?', 'draft');

insert into public.dossiers
    (id, slug, chapter, order_index, title, central_question, status)
    values ('20000000-0000-0000-0000-000000000012', 'pha-vo-suc-i-co-che-cu', 'chapter_3', 12,
      'Phá vỡ sức ì của cơ chế cũ', 'Các bước đột phá cục bộ đã bộc lộ nhu cầu đổi mới toàn diện như thế nào?', 'draft');

insert into public.dossiers
    (id, slug, chapter, order_index, title, central_question, status)
    values ('20000000-0000-0000-0000-000000000013', 'doi-moi-hay-tut-hau', 'chapter_3', 13,
      'Đổi mới hay tụt hậu', 'Một cuộc khủng hoảng toàn diện đòi hỏi thay đổi tư duy và cơ chế đến mức nào?', 'published');

insert into public.dossier_versions
    (id, dossier_id, version, schema_version, content, reviewed_at, published_at)
    values ('30000000-0000-0000-0000-000000000013', '20000000-0000-0000-0000-000000000013', 1, 1, '{"briefing":{"period":"1986-1996","context":["Kinh tế - xã hội lâm vào khủng hoảng, hàng hóa khan hiếm và lạm phát năm 1986 ở mức rất cao.","Các bước khoán và tự chủ trước Đại hội VI cho thấy thực tiễn đã vượt khỏi nhiều ràng buộc của cơ chế cũ."],"centralContradiction":"Nhu cầu giải phóng năng lực sản xuất đối lập với cơ chế quản lý tập trung, bao cấp không còn phù hợp.","objective":"Đưa đất nước ra khỏi khủng hoảng đồng thời giữ định hướng phát triển và ổn định xã hội.","constraints":["Nguồn lực trong nước hạn chế và môi trường quốc tế biến động.","Đổi mới phải đồng bộ nhưng cần kiểm soát tác động xã hội và năng lực quản lý."]},"evidence":[{"id":"c3-e1","label":"Lạm phát và thiếu hụt hàng hóa","kind":"data","summary":"Khủng hoảng cho thấy cơ chế phân phối và quản lý cũ không tạo đủ động lực sản xuất.","sourceIds":["10000000-0000-0000-0000-000000000022"],"isDistractor":false},{"id":"c3-e2","label":"Các thử nghiệm khoán và tự chủ","kind":"event","summary":"Những bước đột phá từ thực tiễn cho thấy trao quyền chủ động có thể cải thiện hiệu quả sản xuất.","sourceIds":["10000000-0000-0000-0000-000000000001"],"isDistractor":false},{"id":"c3-e3","label":"Yêu cầu đổi mới tư duy","kind":"document","summary":"Đại hội VI nhấn mạnh nhìn thẳng sự thật, đánh giá đúng sự thật và đổi mới toàn diện.","sourceIds":["10000000-0000-0000-0000-000000000022"],"isDistractor":false},{"id":"c3-e4","label":"Tiếp tục điều chỉnh nhỏ trong cơ chế cũ","kind":"assessment","summary":"Các sửa đổi rời rạc có thể giảm áp lực ngắn hạn nhưng không xử lý mâu thuẫn cơ chế ở quy mô toàn nền kinh tế.","sourceIds":["10000000-0000-0000-0000-000000000022"],"isDistractor":true}],"decision":{"prompt":"Chọn hướng quyết định phù hợp khi các biện pháp cục bộ không còn đủ giải quyết khủng hoảng.","requiredEvidenceCount":3,"options":[{"id":"comprehensive-renovation","label":"Đổi mới toàn diện, trước hết đổi mới tư duy và cơ chế kinh tế","rationale":"Thừa nhận yêu cầu khách quan của thực tiễn và tạo động lực cho nhiều thành phần kinh tế."},{"id":"minor-adjustments","label":"Giữ cơ chế cũ và chỉ điều chỉnh một số khâu phân phối","rationale":"Ít xáo trộn trước mắt nhưng không xử lý nguyên nhân hệ thống của khủng hoảng."}]},"projectedConsequences":[{"optionId":"comprehensive-renovation","steps":["Mở rộng quyền chủ động sản xuất và lưu thông.","Hình thành cơ chế kinh tế nhiều thành phần có quản lý.","Tạo điều kiện ổn định và từng bước thoát khỏi khủng hoảng."]},{"optionId":"minor-adjustments","steps":["Một số điểm nghẽn được xử lý tạm thời.","Động lực sản xuất và tín hiệu thị trường tiếp tục bị hạn chế.","Khủng hoảng có nguy cơ kéo dài và làm giảm niềm tin."]}],"historicalComparison":{"actualDecision":"Đại hội VI năm 1986 mở đường cho đổi mới toàn diện, coi đổi mới kinh tế là trọng tâm ban đầu và từng bước hoàn thiện nhận thức về cơ chế thị trường.","implementation":["Thực hiện các chính sách khoán, tự chủ sản xuất và thừa nhận nền kinh tế nhiều thành phần.","Điều chỉnh cơ chế quản lý, phân phối và mở rộng quan hệ kinh tế đối ngoại."],"results":["Đất nước từng bước kiềm chế lạm phát, phát triển sản xuất và thoát khỏi khủng hoảng kinh tế - xã hội.","Tạo nền tảng cho giai đoạn công nghiệp hóa, hiện đại hóa và hội nhập tiếp theo."],"limitations":["Quá trình đổi mới phát sinh chênh lệch, hạn chế quản lý và yêu cầu tiếp tục hoàn thiện thể chế."]},"lessons":["Đổi mới phải xuất phát từ thực tiễn và dám nhìn thẳng vào hạn chế của mô hình hiện hành.","Cải cách kinh tế cần đi cùng năng lực quản lý, ổn định xã hội và mục tiêu phát triển lâu dài."],"sources":[{"id":"10000000-0000-0000-0000-000000000001","title":"Giáo trình Lịch sử Đảng Cộng sản Việt Nam dành cho sinh viên khối không chuyên","authorOrIssuer":"Bộ Giáo dục và Đào tạo","locator":"Chương III","url":null},{"id":"10000000-0000-0000-0000-000000000022","title":"VNR202 Session 22 - Đại hội VI và đường lối đổi mới toàn diện","authorOrIssuer":"Bộ môn VNR202, FPT University","locator":"Slides 3-26","url":null}]}'::jsonb, now(), now());

update public.dossiers set current_version_id = '30000000-0000-0000-0000-000000000013', updated_at = now()
    where id = '20000000-0000-0000-0000-000000000013';

insert into public.claims (id, dossier_version_id, category, statement)
      values ('40000000-0000-0000-0000-000000000131', '30000000-0000-0000-0000-000000000013', 'context', 'Kinh tế - xã hội lâm vào khủng hoảng, hàng hóa khan hiếm và lạm phát năm 1986 ở mức rất cao.');

insert into public.claim_source_links (claim_id, source_id, support_scope)
      values ('40000000-0000-0000-0000-000000000131', '10000000-0000-0000-0000-000000000001', 'Hỗ trợ luận điểm context trong hồ sơ Đổi mới hay tụt hậu.');

insert into public.claims (id, dossier_version_id, category, statement)
      values ('40000000-0000-0000-0000-000000000132', '30000000-0000-0000-0000-000000000013', 'basis', 'Nhu cầu giải phóng năng lực sản xuất đối lập với cơ chế quản lý tập trung, bao cấp không còn phù hợp.');

insert into public.claim_source_links (claim_id, source_id, support_scope)
      values ('40000000-0000-0000-0000-000000000132', '10000000-0000-0000-0000-000000000022', 'Hỗ trợ luận điểm basis trong hồ sơ Đổi mới hay tụt hậu.');

insert into public.claims (id, dossier_version_id, category, statement)
      values ('40000000-0000-0000-0000-000000000133', '30000000-0000-0000-0000-000000000013', 'implementation', 'Thực hiện các chính sách khoán, tự chủ sản xuất và thừa nhận nền kinh tế nhiều thành phần.');

insert into public.claim_source_links (claim_id, source_id, support_scope)
      values ('40000000-0000-0000-0000-000000000133', '10000000-0000-0000-0000-000000000001', 'Hỗ trợ luận điểm implementation trong hồ sơ Đổi mới hay tụt hậu.');

insert into public.claims (id, dossier_version_id, category, statement)
      values ('40000000-0000-0000-0000-000000000134', '30000000-0000-0000-0000-000000000013', 'result', 'Đất nước từng bước kiềm chế lạm phát, phát triển sản xuất và thoát khỏi khủng hoảng kinh tế - xã hội.');

insert into public.claim_source_links (claim_id, source_id, support_scope)
      values ('40000000-0000-0000-0000-000000000134', '10000000-0000-0000-0000-000000000022', 'Hỗ trợ luận điểm result trong hồ sơ Đổi mới hay tụt hậu.');

insert into public.claims (id, dossier_version_id, category, statement)
      values ('40000000-0000-0000-0000-000000000135', '30000000-0000-0000-0000-000000000013', 'limitation', 'Quá trình đổi mới phát sinh chênh lệch, hạn chế quản lý và yêu cầu tiếp tục hoàn thiện thể chế.');

insert into public.claim_source_links (claim_id, source_id, support_scope)
      values ('40000000-0000-0000-0000-000000000135', '10000000-0000-0000-0000-000000000001', 'Hỗ trợ luận điểm limitation trong hồ sơ Đổi mới hay tụt hậu.');

insert into public.claims (id, dossier_version_id, category, statement)
      values ('40000000-0000-0000-0000-000000000136', '30000000-0000-0000-0000-000000000013', 'lesson', 'Đổi mới phải xuất phát từ thực tiễn và dám nhìn thẳng vào hạn chế của mô hình hiện hành.');

insert into public.claim_source_links (claim_id, source_id, support_scope)
      values ('40000000-0000-0000-0000-000000000136', '10000000-0000-0000-0000-000000000022', 'Hỗ trợ luận điểm lesson trong hồ sơ Đổi mới hay tụt hậu.');

insert into public.causal_nodes
      (id, dossier_version_id, lane, label, explanation, sort_index)
      values ('50000000-0000-0000-0000-000000000131', '30000000-0000-0000-0000-000000000013', 'context', 'Kinh tế - xã hội lâm vào khủng hoảng, hàng hóa khan hiếm và lạm phát năm 1986 ở mức rất cao.', 'Kinh tế - xã hội lâm vào khủng hoảng, hàng hóa khan hiếm và lạm phát năm 1986 ở mức rất cao.', 1);

insert into public.causal_nodes
      (id, dossier_version_id, lane, label, explanation, sort_index)
      values ('50000000-0000-0000-0000-000000000132', '30000000-0000-0000-0000-000000000013', 'contradiction', 'Nhu cầu giải phóng năng lực sản xuất đối lập với cơ chế quản lý tập trung, bao cấp không còn phù hợp.', 'Nhu cầu giải phóng năng lực sản xuất đối lập với cơ chế quản lý tập trung, bao cấp không còn phù hợp.', 2);

insert into public.causal_nodes
      (id, dossier_version_id, lane, label, explanation, sort_index)
      values ('50000000-0000-0000-0000-000000000133', '30000000-0000-0000-0000-000000000013', 'decision', 'Đại hội VI năm 1986 mở đường cho đổi mới toàn diện, coi đổi mới kinh tế là trọng tâm ban đầu và từng bước hoàn thiện nhận thức về cơ chế thị trường.', 'Đại hội VI năm 1986 mở đường cho đổi mới toàn diện, coi đổi mới kinh tế là trọng tâm ban đầu và từng bước hoàn thiện nhận thức về cơ chế thị trường.', 3);

insert into public.causal_nodes
      (id, dossier_version_id, lane, label, explanation, sort_index)
      values ('50000000-0000-0000-0000-000000000134', '30000000-0000-0000-0000-000000000013', 'result', 'Đất nước từng bước kiềm chế lạm phát, phát triển sản xuất và thoát khỏi khủng hoảng kinh tế - xã hội.', 'Đất nước từng bước kiềm chế lạm phát, phát triển sản xuất và thoát khỏi khủng hoảng kinh tế - xã hội.', 4);

insert into public.causal_nodes
      (id, dossier_version_id, lane, label, explanation, sort_index)
      values ('50000000-0000-0000-0000-000000000135', '30000000-0000-0000-0000-000000000013', 'lesson', 'Đổi mới phải xuất phát từ thực tiễn và dám nhìn thẳng vào hạn chế của mô hình hiện hành.', 'Đổi mới phải xuất phát từ thực tiễn và dám nhìn thẳng vào hạn chế của mô hình hiện hành.', 5);

insert into public.causal_edges
      (id, source_node_id, target_node_id, relation, explanation, claim_id)
      values ('60000000-0000-0000-0000-000000000131', '50000000-0000-0000-0000-000000000131',
        '50000000-0000-0000-0000-000000000132', 'condition', 'Nhu cầu giải phóng năng lực sản xuất đối lập với cơ chế quản lý tập trung, bao cấp không còn phù hợp.', '40000000-0000-0000-0000-000000000131');

insert into public.causal_edges
      (id, source_node_id, target_node_id, relation, explanation, claim_id)
      values ('60000000-0000-0000-0000-000000000132', '50000000-0000-0000-0000-000000000132',
        '50000000-0000-0000-0000-000000000133', 'response', 'Đại hội VI năm 1986 mở đường cho đổi mới toàn diện, coi đổi mới kinh tế là trọng tâm ban đầu và từng bước hoàn thiện nhận thức về cơ chế thị trường.', '40000000-0000-0000-0000-000000000132');

insert into public.causal_edges
      (id, source_node_id, target_node_id, relation, explanation, claim_id)
      values ('60000000-0000-0000-0000-000000000133', '50000000-0000-0000-0000-000000000133',
        '50000000-0000-0000-0000-000000000134', 'outcome', 'Đất nước từng bước kiềm chế lạm phát, phát triển sản xuất và thoát khỏi khủng hoảng kinh tế - xã hội.', '40000000-0000-0000-0000-000000000134');

insert into public.causal_edges
      (id, source_node_id, target_node_id, relation, explanation, claim_id)
      values ('60000000-0000-0000-0000-000000000134', '50000000-0000-0000-0000-000000000134',
        '50000000-0000-0000-0000-000000000135', 'lesson', 'Đổi mới phải xuất phát từ thực tiễn và dám nhìn thẳng vào hạn chế của mô hình hiện hành.', '40000000-0000-0000-0000-000000000136');

insert into public.dossiers
    (id, slug, chapter, order_index, title, central_question, status)
    values ('20000000-0000-0000-0000-000000000014', 'mo-cua-khong-mat-phuong-huong', 'chapter_3', 14,
      'Mở cửa nhưng không mất phương hướng', 'Làm thế nào kết hợp hội nhập, hiện đại hóa và các động lực tăng trưởng mới?', 'draft');

insert into public.dossiers
    (id, slug, chapter, order_index, title, central_question, status)
    values ('20000000-0000-0000-0000-000000000015', 'giu-niem-tin-bang-nang-luc-the-che', 'chapter_3', 15,
      'Giữ niềm tin bằng năng lực thể chế', 'Thành tựu, hạn chế và phòng chống tham nhũng liên hệ thế nào với niềm tin và năng lực phát triển?', 'draft');

do $$
declare planned_count int; published_count int;
begin
  select count(*) into planned_count from public.dossiers;
  select count(*) into published_count from public.dossiers where status = 'published';
  if planned_count <> 15 then raise exception 'expected 15 planned dossiers, got %', planned_count; end if;
  if published_count <> 3 then raise exception 'expected 3 phase-one published dossiers, got %', published_count; end if;
end $$;

commit;
