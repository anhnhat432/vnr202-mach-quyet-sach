# Mô hình dữ liệu logic

Trạng thái: Approved for planning; sửa đổi v1.1 cho Live Arena V1.0 (2026-10-29, bản sửa 2)  
Nguồn: Core Platform Spec (kèm Amendment v1.1), Live Arena Game Spec, Product Experience Spec, ADR-001 và ADR-004

## Quy ước

- Primary key là UUID trừ enum và bảng lookup cố định.
- Timestamps lưu `timestamptz` UTC; giao diện hiển thị `Asia/Ho_Chi_Minh`.
- Thời lượng lưu integer milliseconds; score lưu integer không âm (tối đa 2 460 cho `minefield`, 2 300 cho `race`), ràng buộc bằng `CHECK`.
- Mã game: `minefield` (Bãi Mìn Tri Thức) và `race` (Đường Đua Lịch Sử); thay `timeline | decision_room` của v1.0.
- Mọi thời điểm quyết định (bắt đầu, `presented_at`, `available_at`, `deadline_at`, `received_at`, hết giờ, kết thúc) lấy bằng `clock_timestamp()` của database tại câu lệnh quyết định, **không** dùng `now()` (thời điểm bắt đầu transaction) và không lấy từ client (`LA-TIME-019`). `created_at`/`updated_at` thuần audit có thể dùng `now()`.
- JSONB chỉ dùng cho nội dung có schema version, không thay thế quan hệ cần constraint hoặc truy vấn.
- Mọi bảng trong schema `public` bật RLS. Bảng chỉ dành cho server không có policy client.
- PostgreSQL functions `SECURITY DEFINER` phải đặt `search_path` cố định và revoke execute khỏi role không cần thiết.

## 1. Identity và roster

### `classes`

- `id`, `code`, `name`, `is_active`, `created_at`.
- Phiên bản đầu chỉ có một row active; constraint bảo đảm tối đa một lớp active.

### `profiles`

- `id` FK `auth.users.id`.
- `role`: `student | admin`.
- `student_id` (`text`): nullable với admin, required và unique với student. Luôn là chuỗi, giữ số 0 đầu, không ép kiểu số; chuẩn hóa chỉ gồm trim và in hoa chữ Latin (`LA-ACC-011`). Không có `CHECK` regex cố định; mẫu định dạng là cấu hình xác định sau khi xem tệp thật (`LA-ACC-013`).
- `full_name`, `class_id`, `status` (`active | locked`), timestamps.
- `must_change_password`: giữ cột cho khả năng mở rộng nhưng V1 luôn `false` với sinh viên (`LA-ACC-004`); không route nào chặn theo cờ này trong V1.
- `public_entry_id`: UUID ngẫu nhiên dùng trong payload/bảng công khai, không suy ra student ID.
- `display_name`: tên hiển thị lớp học dạng rút gọn (ví dụ "An N.V."), sinh khi nhập lớp, admin sửa được có audit, 1–40 ký tự (`LA-PRV-003`). Đây là trường duy nhất về tên được dùng trong projection công khai.
- `display_name_suffix`: số nguyên nullable dùng hiển thị hậu tố trùng tên, gán theo thứ tự nhập lớp (`LA-LB-012`).

### `student_auth_identities` (`LA-ACC-015`)

- `profile_id` PK/FK, `student_id` (unique), `auth_user_id` (unique), `internal_email` (unique; `<uuid v4>@INTERNAL_AUTH_EMAIL_DOMAIN`, sinh một lần, không đổi), `created_at`.
- Bảng chỉ server: bật RLS, không có policy cho `anon`/`authenticated`, revoke mọi quyền khỏi hai role đó. Chỉ service role đọc để ánh xạ MSSV → email nội bộ khi đăng nhập.

### `auth_events` (`LA-ACC-009`)

- `id`, `profile_id`, `event` (`sign_in | sign_out | session_transfer | session_revoked`), `device_label_hash`, `ip_hash`, `created_at`.
- Chỉ admin đọc qua server route; không có policy client.

### `roster_imports`

- `id`, `file_name`, `file_sha256`, `file_format` (`xlsx | csv`), `status`, `row_count`, `valid_count`, `created_by`, timestamps, `error_summary`.
- Status: `validating | validated | applying | applied | failed | compensated`.

### `roster_import_rows`

- `import_id`, `row_number`, `student_id` (`text`, giữ nguyên chuỗi đọc được), `full_name`, `display_name` (sinh tự động, admin sửa được trong bản xem trước), `student_id_cell_type` (`text | number | other`, chỉ với XLSX), `row_status` (`valid | warning | error`), `issues` JSONB (`duplicate_in_file | already_exists | missing_student_id | missing_full_name | pattern_mismatch | numeric_cell | formula_prefix`), `admin_confirmed` (cho hàng `warning`).
- Không có cột mật khẩu (`LA-ACC-003`): mọi tài khoản tạo từ mật khẩu mặc định cấu hình phía server.
- `created_auth_user_id` phục vụ compensation; xóa staging row sau apply.

Mật khẩu mặc định và mật khẩu nội bộ dẫn xuất (`LA-ACC-005`) chỉ tồn tại trong bộ nhớ của request phía server; không ghi plaintext vào database, log, response hoặc artifact.

## 2. Nội dung công khai

### `sources`

- `id`, `title`, `author_or_issuer`, `publication_year`, `locator`, `url`, `source_type`, `rights_note`, `verification_status`.

### `dossiers`

- `id`, `slug`, `chapter`, `order_index`, `status`, `current_version_id`, timestamps.
- Có đúng 15 dossier Published cho release đầu; năm dossier mỗi chapter.

### `dossier_versions`

- `id`, `dossier_id`, `version`, `schema_version`, `content` JSONB, `reviewed_by`, `published_by`, timestamps.
- `content` chứa briefing, constraints, actors, evidence references, decision interactions, projected consequences, historical comparison và lessons.
- Published version immutable; chỉnh sửa tạo version mới.

### `claims` và `claim_source_links`

- `claims`: luận điểm ổn định có `dossier_version_id`, category và statement.
- `claim_source_links`: `claim_id`, `source_id`, `support_scope`, `locator_override`.
- Đây là dữ liệu của Ma trận Bằng chứng.

### `causal_nodes` và `causal_edges`

- Node thuộc một dossier/version, có lane `context | contradiction | force | decision | result | lesson`, date range và short explanation.
- Edge có type `direct_cause | condition | response | outcome | limitation | lesson`, explanation và source-backed claim.

### `dossier_progress`

- `profile_id`, `dossier_id`, `completed_at`, `version_completed`.
- Unique `(profile_id, dossier_id)`; không liên quan score hoặc attempt eligibility.

## 3. Question governance

### `questions`

- `id`, `game_type` (`minefield | race`), `pool` (`minefield_main | minefield_defuse | race`), `chapter`, `topic`, `question_type` (`single_choice | before_after | pair_choice | defuse_ab`), `option_count` (2 hoặc 3), `difficulty` (`easy | medium | hard`; câu gỡ bom dùng `easy`), `origin` (`bank | fixture`), `status`, `current_version_id`, timestamps.
- Status `draft | reviewed | published`.
- `CHECK`: `pool = minefield_defuse` ⇔ `question_type = defuse_ab`.

### `question_versions`

- `id`, `question_id`, `version`, `schema_version`, `content_public` JSONB (đề, 2–3 đáp án có id ổn định), `content_private` JSONB (id đáp án đúng, giải thích), review/publish metadata (`reviewed_by`, `reviewed_at`, `published_by`, `published_at`).
- `content_private` không có client SELECT policy và chỉ được đọc qua RPC xem lại khi cuộc thi Finalized (`LA-FB-004`).
- `CHECK` số đáp án: 2–3 (`defuse_ab` và `before_after` đúng 2); giới hạn độ dài là cấu hình `[THỬ NGHIỆM LA-CONTENT-008]` (80 / 40 ký tự), kiểm bằng validator thay vì `CHECK` cứng cho tới khi khóa.
- Published version immutable.

### `question_source_links`

- `question_version_id`, `source_id`, `locator`, `usage_note`.

### `question_exposures` (`LA-CONTENT-009`, `LA-CONTENT-010`)

- `question_version_id`, `competition_id`, `allocated_count` (tăng trong transaction tạo lượt), `displayed_count` (tăng khi `content_released_at` được ghi lần đầu), `answer_disclosed_at` (đặt khi cuộc thi Finalized và chỉ khi `displayed_count > 0`) (`LA-ALLOC-012`).
- Cập nhật `allocated_count` diễn ra dưới khóa advisory phạm vi transaction theo `competition_game_id` trong `start_or_resume_attempt` (`LA-ALLOC-011`).
- Primary key `(question_version_id, competition_id)`. View lũy kế: tổng lần xuất hiện, danh sách cuộc thi đã lộ đáp án.

### `competition_disclosed_question_confirmations` (`LA-CONTENT-009`)

- `competition_id`, `question_version_id`, `confirmed_by`, `reason`, `confirmed_at`.
- Chỉ khi có dòng này, câu đã lộ đáp án mới được đưa vào snapshot của cuộc thi `official`; mỗi dòng có audit.

Câu `origin = fixture` chỉ tồn tại ở môi trường local/preview và chỉ được dùng cho cuộc thi `kind = rehearsal` (`LA-CONTENT-006`).

## 4. Competition và snapshot

### `competitions`

- `id`, `public_id`, `name`, `kind` (`official | rehearsal`, cố định từ khi tạo, `LA-CONTENT-006`), `state`, `opens_at`, `start_deadline_at`, `latency_allowance_ms`, `timezone`, `created_by`, timestamps.
- Kết quả cuộc thi `rehearsal` không bao giờ có `standing = official` và không xuất hiện trong lịch sử chính thức hay Passport.
- State: `draft | scheduled | open | start_closed | settling | finalized | archived`.
- Partial unique index ngăn hơn một competition ở state `open`.

### `competition_games`

- `id`, `competition_id`, `game_type` (`minefield | race`), `total_duration_ms`, `rules` JSONB có schema version (điểm và thời hạn theo độ khó, cơ cấu bàn cờ, combo, offset hiệu ứng `LA-TIME-018`), `blueprint` JSONB, `config_locked_at`.
- Unique `(competition_id, game_type)`.
- Giá trị mặc định: `minefield` 180 000 ms, `race` 150 000 ms `[THỬ NGHIỆM]`. Cơ cấu bàn cờ, điểm và thời hạn câu là `[CHỐT]`: chỉ nhận đúng giá trị của `live-arena-game-spec.md`, kiểm tra bằng `CHECK`/validation, admin không sửa được trong V1.

### `competition_question_snapshots`

- `id`, `competition_game_id`, `question_version_id`, `pool`, `snapshot_public` JSONB, `snapshot_private` JSONB, `chapter`, `question_type`, `difficulty`, `origin`.
- Tạo trước khi Open; immutable sau `config_locked_at`.
- Readiness của cuộc thi `official` từ chối snapshot có `origin = fixture`, question version chưa Published, hoặc câu đã lộ đáp án chưa có dòng xác nhận (`LA-CONTENT-009`); báo cáo số người dự kiến thấy mỗi câu (`LA-CONTENT-010`).

## 5. Attempt, session và timer

### `attempts`

- `id`, `competition_game_id`, `competition_id` (sao chép để làm index), `profile_id`, `state` (`active | completed | timed_out | voided`; `voided` chỉ do admin, `LA-ADMIN-003`), `version`, `session_version`.
- `started_at`, `ends_at` (= `started_at + total_duration_ms`), `terminal_at`, `max_legal_end_at`.
- `score`, `main_answered`, `main_correct`, `hard_correct`, `completion_duration_ms`.
- Game 1: `shields` (0–2), `double_armed` boolean. Game 2: `streak`, `combo_awards` (0–5).
- `pending_allocation_id` nullable: câu đang mở (chỉ một tương tác mở tại một thời điểm).
- `last_heartbeat_at` chỉ dùng giám sát.
- Unique `(competition_game_id, profile_id)` bảo đảm một lượt mỗi game (`LA-TRY-001`).
- Partial unique index trên `(competition_id, profile_id) WHERE state = 'active'` (qua cột `competition_id` sao chép) bảo đảm tối đa một lượt đang hoạt động trên hai game (`LA-TRY-003`).
- Không còn `last_timer_anchor_at`, `active_elapsed_ms`, `feedback_paused_ms`, `disconnect_grace_used_ms` (đồng hồ không tạm dừng, `LA-TIME-001`).

### `attempt_sessions`

- `id`, `attempt_id`, `profile_id`, `session_version`, `device_label_hash`, `started_at`, `last_seen_at`, `revoked_at`, `revoke_reason`.
- Partial unique index bảo đảm một session chưa bị revoke cho mỗi profile trong gameplay.

### `attempt_allocations`

- `id`, `attempt_id`, `sequence`, `role` (`main | defuse`), `snapshot_id`, `difficulty`, `option_order` JSONB.
- `presented_at`, `available_at`, `deadline_at`: ghi một lần trong transaction tạo câu (§5.4.1 của live-arena-game-spec); không cập nhật lại (`LA-TIME-003`). `CHECK (presented_at <= available_at AND available_at < deadline_at)`.
- `content_released_at`: lần đầu nội dung được trả ra; `CHECK (content_released_at >= available_at)` (`LA-TIME-013`, `LA-TIME-015`).
- `outcome` (`correct | incorrect | timed_out`), `resolved_at`.
- Unique `(attempt_id, sequence)` và `(attempt_id, snapshot_id)`.
- Toàn bộ allocation (13 dòng cho `minefield`, 15 dòng cho `race`) được tạo một lần khi start và không đổi khi resume/chuyển thiết bị.

### `minefield_cells`

- `attempt_id`, `cell_index` (0–19), `kind` (`question | bomb | double | shield | chest`), `allocation_id` nullable (ô câu hỏi gắn với một allocation `main`), `opened_at`, `swapped_from_index` nullable (ghi nhận đổi ô bom ở lần mở đầu, `MINE-BOARD-003`).
- Primary key `(attempt_id, cell_index)`; `CHECK` đếm đúng cơ cấu 10/3/1/2/4 được kiểm tra bởi RPC tạo bàn cờ và pgTAP.
- Không có client SELECT policy; client chỉ nhận ô đã mở qua projection.

### `answer_submissions`

- `id`, `attempt_id`, `allocation_id`, `idempotency_key`, `submitted_option_id`, `received_at`, `is_correct`, `outcome`, `awarded_points`, `committed_at`.
- Unique `(attempt_id, allocation_id)` và `(attempt_id, idempotency_key)`.
- Không trả `submitted_option_id` của người khác hoặc đáp án đúng ra API trước khi Finalized.

### `attempt_events` (sổ sự kiện điểm)

- `id`, `attempt_id`, `seq`, `event_type` (`answer | chest | bomb_penalty | shield_consumed | shield_gained | double_armed | double_consumed | combo_bonus | board_swap | timeout`), `source_ref` (ô hoặc allocation), `points_delta`, `score_after`, `created_at`.
- Unique `(attempt_id, seq)` và `(attempt_id, event_type, source_ref)` để một nguồn không gây điểm hai lần (`LA-IDEM-002`).
- Dùng cho audit, test đối chiếu và hiển thị lịch sử điểm của chính người chơi.

### `attempt_incidents` (`LA-ADMIN-003`)

- `id`, `attempt_id`, `action` (`note | revoke_sessions | lock_account | void_attempt`), `reason`, `actor_profile_id`, `created_at`.
- Mọi thao tác đồng thời ghi `audit_logs`.

### Timing projection

Timer không decrement bằng background loop và không tạm dừng.

- `remaining_ms = ends_at − clock_timestamp()`; câu đang mở có `question_remaining_ms = min(deadline_at, ends_at) − clock_timestamp()` và chỉ được trả khi `clock_timestamp() ≥ available_at`.
- Nội dung câu chỉ được trả khi `clock_timestamp() ≥ available_at` (`LA-TIME-013`); yêu cầu sớm hơn được giữ tới `available_at` hoặc trả `425` (`LA-TIME-017`).
- Trả lời được chấp nhận khi `received_at ≤ min(deadline_at, ends_at) + latency_allowance_ms`; ngược lại ghi `timed_out` (`LA-TIME-005`, `LA-TIME-009`).
- Câu có `available_at ≥ ends_at` không được phát hành và được ghi `timed_out` khi lượt kết thúc (`LA-TIME-016`).
- Mọi RPC đọc/ghi gọi `reconcile_attempt` để xử lý câu quá hạn và chuyển lượt sang `timed_out` khi `clock_timestamp() > ends_at + latency_allowance_ms + lock_wait_limit` (`LA-TIME-022`).
- Heartbeat mặc định 5 giây, chỉ cập nhật `last_heartbeat_at`.

## 6. Score và leaderboard

### `leaderboard_entries`

- `competition_game_id`, `profile_id`, `public_entry_id`, `display_name_snapshot` (tên hiển thị lớp học, không bao giờ là họ tên đầy đủ), `display_name_suffix`.
- `score`, `correct_count` (Game 1: số câu chính đúng; Game 2: số câu đúng), `hard_correct`, `completion_duration_ms`, `progress`, `state` (`playing | completed | timed_out`), `excluded` (lượt `voided`), `version`, `updated_at`.
- Unique `(competition_game_id, profile_id)`.
- `display_name_snapshot` bảo đảm historical leaderboard không đổi khi profile đổi tên (`LA-PRV-005`).

### `leaderboard_versions`

- `competition_game_id`, `version`, `committed_at`.
- Một row/game; update bằng row lock trong transaction của mỗi sự kiện điểm.

Thứ hạng được tính khi đọc bằng `rank() OVER (ORDER BY score DESC, correct_count DESC, hard_correct DESC, completion_duration_ms ASC)` trên các entry không bị loại; người bằng nhau ở mọi tiêu chí có cùng hạng (`LA-LB-008`). `completion_duration_ms` của lượt đang chơi là `NULL` và xếp sau (`NULLS LAST`). `public_entry_id` chỉ dùng để ổn định thứ tự hiển thị giữa những người đồng hạng. Nhãn `provisional | official` lấy từ trạng thái cuộc thi (`official` chỉ khi `finalized | archived`).

## 7. Operations

### `audit_logs`

- `id`, `actor_profile_id`, `action`, `target_type`, `target_id`, `request_id`, `before_redacted`, `after_redacted`, `created_at`.
- Không lưu password, token, correct-answer payload đầy đủ hoặc service errors có secret.

### `rate_limit_buckets`

- `key_hash`, `window_start`, `count`, `expires_at`.
- Chỉ server/RPC truy cập; job định kỳ xóa row hết hạn.

## 8. PostgreSQL functions bắt buộc

- `start_or_resume_attempt(competition_public_id, game_type, idempotency_key)`: tạo lượt, allocation, bàn cờ; từ chối nếu có lượt đang hoạt động ở game kia. Phân bổ chạy dưới `pg_advisory_xact_lock` theo `competition_game_id`, chọn câu có `allocated_count` nhỏ nhất (phá hòa ngẫu nhiên), áp dụng `LA-ALLOC-007/008/010` (`LA-ALLOC-011`).
- `submit_answer`: câu lệnh đầu `received_at := clock_timestamp()`, sau đó `SET LOCAL lock_timeout`, rồi `SELECT … FOR UPDATE` lượt (`LA-TIME-020`, `LA-TIME-021`).
- `transfer_attempt_session(attempt_id, expected_session_version)`.
- `heartbeat_attempt(attempt_id, session_version)`.
- `open_minefield_cell(attempt_id, cell_index, idempotency_key, session_version)`.
- `submit_answer(attempt_id, allocation_id, option_id, idempotency_key, session_version)`.
- `reconcile_attempt(attempt_id)`.
- `get_attempt_projection(attempt_id)`: projection đã lược bỏ nội dung chưa được phép (không có nội dung câu trước `available_at`).
- `get_interaction_content(attempt_id, allocation_id, session_version)`: trả nội dung câu khi `clock_timestamp() ≥ available_at`, ghi `content_released_at`; không bao giờ trả đáp án đúng.
- `get_leaderboard(competition_public_id, game_type, limit)` và `get_player_standing(attempt_id)` (hạng, khoảng cách tới người ngay trên hoặc hạng 10, trường hợp hạng 1 theo `LA-LB-005`).
- `get_attempt_review(attempt_id)`: chỉ trả dữ liệu khi cuộc thi `finalized | archived`.
- `finalize_competition(competition_id)`.
- `transition_competition(competition_id, target_state)`.
- `record_attempt_incident(attempt_id, action, reason)` (`LA-ADMIN-003`).
- `confirm_disclosed_questions(competition_id, question_version_ids, reason)` (`LA-CONTENT-009`).
- `finalize_competition` đồng thời ghi `answer_disclosed_at` cho mọi câu đã phân bổ trong cuộc thi (`LA-FB-004`).
- `consume_rate_limit(key_hash, limit_count, window_seconds)`.

## 9. Indexes tối thiểu

- Competition state/schedule, attempt profile/game/state, partial index lượt đang hoạt động theo profile.
- Allocation attempt/sequence, cells attempt/index, events attempt/seq.
- Answer attempt/allocation và idempotency key.
- Leaderboard game với composite order `(score DESC, correct_count DESC, hard_correct DESC, completion_duration_ms ASC)`.
- Question pool/status/difficulty/origin để kiểm tra ngân hàng; exposures theo question version.
- Dossier status/chapter/order, causal nodes by dossier/lane/date và claims by dossier version.
- Audit target/time và actor/time.

## 10. Migration và seed discipline

- Mỗi migration chỉ tiến; không sửa file migration đã áp dụng production.
- Seed local dùng danh tính giả và câu hỏi `origin = fixture`; roster thật, mật khẩu mặc định và câu hỏi ngân hàng chưa duyệt không nằm trong seed production.
- Schema types sinh ra bằng Supabase CLI sau migration và được commit.
- RLS tests phải chạy bằng anon, student A, student B và admin identities.
- pgTAP trên PostgreSQL cục bộ không thay thế kiểm thử trên Supabase thật (Auth, RLS, Realtime); cả hai là bắt buộc trước khi đóng các gate Core.
