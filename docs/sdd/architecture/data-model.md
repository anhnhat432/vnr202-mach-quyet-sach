# Mô hình dữ liệu logic

Trạng thái: Approved for planning  
Nguồn: Core Platform Spec, Product Experience Spec và ADR-001

## Quy ước

- Primary key là UUID trừ enum và bảng lookup cố định.
- Timestamps lưu `timestamptz` UTC; giao diện hiển thị `Asia/Ho_Chi_Minh`.
- Thời lượng lưu integer milliseconds; score lưu integer từ 0 đến 1000.
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
- `student_id`: nullable với admin, required và unique với student.
- `full_name`, `class_id`, `must_change_password`, `status`, timestamps.
- `public_entry_id`: UUID ngẫu nhiên dùng trong payload/bảng công khai, không suy ra student ID.

### `roster_imports`

- `id`, `file_name`, `file_sha256`, `status`, `row_count`, `created_by`, timestamps, `error_summary`.
- Status: `validating | validated | applying | applied | failed | compensated`.

### `roster_import_rows`

- `import_id`, `row_number`, `student_id`, `full_name`, `temporary_password_ciphertext` không được lưu.
- Chỉ lưu password fingerprint dùng phát hiện trùng trong request nếu cần; xóa staging row sau apply.
- `validation_errors` JSONB và `created_auth_user_id` phục vụ compensation.

Temporary password chỉ tồn tại trong request memory và response một lần; không ghi plaintext vào database, log hoặc artifact.

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

- `id`, `game_type`, `chapter`, `topic`, `question_type`, `difficulty`, `status`, `current_version_id`, timestamps.
- Status `draft | reviewed | published`.

### `question_versions`

- `id`, `question_id`, `version`, `schema_version`, `content_private` JSONB, `content_public` JSONB, `weight`, review/publish metadata.
- `content_private` chứa đáp án và rubric, không có client SELECT policy.
- Published version immutable.

### `question_source_links`

- `question_version_id`, `source_id`, `locator`, `usage_note`.

## 4. Competition và snapshot

### `competitions`

- `id`, `public_id`, `name`, `state`, `opens_at`, `start_deadline_at`, `timezone`, `created_by`, timestamps.
- State: `draft | scheduled | open | start_closed | settling | finalized | archived`.
- Partial unique index ngăn hơn một competition ở state `open`.

### `competition_games`

- `id`, `competition_id`, `game_type`, `question_count`, `playable_duration_ms`, `feedback_pause_limit_ms`, `disconnect_grace_limit_ms`, `blueprint` JSONB, `config_locked_at`.
- Unique `(competition_id, game_type)`.

### `competition_question_snapshots`

- `id`, `competition_game_id`, `question_version_id`, `snapshot_private` JSONB, `snapshot_public` JSONB, `chapter`, `type`, `difficulty`, `weight`.
- Tạo trước khi Open; immutable sau `config_locked_at`.

## 5. Attempt, session và timer

### `attempts`

- `id`, `competition_game_id`, `profile_id`, `state`, `version`, `session_version`.
- `started_at`, `last_timer_anchor_at`, `terminal_at`, `max_legal_end_at`.
- `playable_duration_ms`, `active_elapsed_ms`, `feedback_paused_ms`, `disconnect_grace_used_ms`.
- `last_heartbeat_at`, `current_allocation_index`, `score`, `accuracy_numerator`, `accuracy_denominator`, `active_answer_time_ms`.
- Unique `(competition_game_id, profile_id)` bảo đảm một lượt.

### `attempt_sessions`

- `id`, `attempt_id`, `profile_id`, `session_version`, `device_label_hash`, `started_at`, `last_seen_at`, `revoked_at`, `revoke_reason`.
- Partial unique index bảo đảm một session chưa bị revoke cho mỗi profile trong gameplay.

### `attempt_allocations`

- `id`, `attempt_id`, `sequence`, `snapshot_id`, `option_order` JSONB, `presented_at`, `completed_at`.
- Unique `(attempt_id, sequence)` và `(attempt_id, snapshot_id)`.
- Allocation được tạo một lần khi start và không thay đổi khi resume/chuyển thiết bị.

### `answer_submissions`

- `id`, `attempt_id`, `allocation_id`, `stage_key`, `idempotency_key`, `submitted_answer` JSONB, `is_correct`, `awarded_points`, `answer_time_ms`, `feedback_public` JSONB, `committed_at`.
- Unique `(attempt_id, allocation_id, stage_key)` và `(attempt_id, idempotency_key)`.
- Không trả `submitted_answer` của người khác hoặc private rubric ra public API.

### Timing projection

Timer không decrement bằng background loop. Mỗi RPC tính elapsed từ `last_timer_anchor_at` theo state và server time rồi persist aggregate mới.

- Heartbeat mặc định 5 giây; disconnect chỉ được server công nhận sau 10 giây không heartbeat.
- Khi reconnect, khoảng từ thời điểm disconnect được công nhận đến reconnect dùng grace còn lại; phần vượt grace tính vào active elapsed.
- Feedback pause chỉ cộng tối đa 8 giây mỗi interaction đã chấm.
- Timeout thắng answer nếu server nhận submission sau playable duration. Boundary được kiểm thử bằng server timestamp, không dùng client timestamp.

## 6. Score và leaderboard

### `leaderboard_entries`

- `competition_game_id`, `profile_id`, `public_entry_id`, `full_name_snapshot`.
- `score`, `accuracy`, `active_answer_time_ms`, `completion_time`, `progress`, `state`, `rank`, `version`, `updated_at`.
- Unique `(competition_game_id, profile_id)`.
- `full_name_snapshot` bảo đảm historical leaderboard không đổi khi profile đổi tên.

### `leaderboard_versions`

- `competition_game_id`, `version`, `committed_at`.
- Một row/game; update bằng row lock trong transaction submit.

Thứ tự rank: score giảm dần, accuracy giảm dần, active answer time tăng dần, completion time tăng dần, `public_entry_id` làm deterministic final fallback nhưng không phải business tie-breaker.

## 7. Operations

### `audit_logs`

- `id`, `actor_profile_id`, `action`, `target_type`, `target_id`, `request_id`, `before_redacted`, `after_redacted`, `created_at`.
- Không lưu password, token, correct-answer payload đầy đủ hoặc service errors có secret.

### `rate_limit_buckets`

- `key_hash`, `window_start`, `count`, `expires_at`.
- Chỉ server/RPC truy cập; job định kỳ xóa row hết hạn.

## 8. PostgreSQL functions bắt buộc

- `start_or_resume_attempt(competition_public_id, game_type)`.
- `transfer_attempt_session(attempt_id, expected_session_version)`.
- `heartbeat_attempt(attempt_id, session_version)`.
- `submit_game_interaction(attempt_id, allocation_id, stage_key, answer, idempotency_key, session_version)`.
- `continue_after_feedback(attempt_id, session_version)`.
- `reconcile_attempt_timer(attempt_id)`.
- `finalize_due_attempts(competition_id)`.
- `transition_competition(competition_id, target_state)`.
- `consume_rate_limit(key_hash, limit_count, window_seconds)`.

## 9. Indexes tối thiểu

- Competition state/schedule, attempt profile/game/state, allocation attempt/sequence.
- Answer attempt/allocation/stage và idempotency key.
- Leaderboard game với composite order cho score/accuracy/time.
- Question status/game/chapter/type/difficulty để kiểm tra pool.
- Dossier status/chapter/order, causal nodes by dossier/lane/date và claims by dossier version.
- Audit target/time và actor/time.

## 10. Migration và seed discipline

- Mỗi migration chỉ tiến; không sửa file migration đã áp dụng production.
- Seed local dùng danh tính giả và câu hỏi mẫu; roster thật không nằm trong seed.
- Schema types sinh ra bằng Supabase CLI sau migration và được commit.
- RLS tests phải chạy bằng anon, student A, student B và admin identities.
