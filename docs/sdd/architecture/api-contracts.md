# API Contracts v1

Trạng thái: Approved for planning; sửa đổi v1.1 cho Live Arena V1.0 (2026-10-29) chờ duyệt văn bản  
Base path: `/api/v1`  
Format: JSON UTF-8, camelCase ở API, snake_case trong PostgreSQL

## 1. Envelope

Success:

```json
{
  "data": {},
  "meta": {
    "requestId": "uuid"
  }
}
```

Error:

```json
{
  "error": {
    "code": "validation_error",
    "message": "Yêu cầu không hợp lệ.",
    "details": [
      { "field": "studentId", "code": "invalid_format", "message": "Mã sinh viên không hợp lệ." }
    ]
  },
  "meta": {
    "requestId": "uuid"
  }
}
```

Không trả stack trace, SQL error, Supabase internal message, existence của student ID ở login hoặc correct answer chưa được phép công bố.

## 2. Headers chung

- `Content-Type: application/json` cho JSON mutations.
- `Idempotency-Key: UUID` bắt buộc với start attempt, transfer session, mở ô và answer submission (`LA-IDEM-001`).
- `X-CSRF-Token` bắt buộc với cookie-authenticated mutations ngoài sign-in.
- `X-Request-Id` do client có thể gửi UUID; server tạo mới nếu thiếu hoặc sai.
- Response mutation trả `Cache-Control: no-store`.

## 3. Authentication

### `POST /auth/sign-in`

Body:

```json
{ "studentId": "SE123456", "password": "string" }
```

Response `200`: profile redacted và CSRF token.  
Errors: `401 invalid_credentials`, `423 account_disabled`, `429 rate_limited`.

Server chuẩn hóa MSSV, tự ánh xạ synthetic email và, khi cần, dẫn xuất mật khẩu nội bộ theo `LA-ACC-005`; response không chứa email nội bộ hay bất kỳ dạng mật khẩu nào. V1 không trả `mustChangePassword` và không có bước đổi mật khẩu bắt buộc (`LA-ACC-004`).

### `POST /auth/change-password`

Không được công bố trong V1 (`LA-ACC-004`). Nếu được mở lại ở phiên bản sau, cần sửa đổi đặc tả riêng.

### `POST /auth/sign-out`

Response `204` và revoke cookie session hiện tại.

## 4. Public experience

### `GET /dossiers`

Filters: `chapter`, `status=published`; public chỉ nhận Published.  
Response gồm đúng 15 metadata rows khi release content hoàn chỉnh.

### `GET /dossiers/{slug}`

Response gồm sáu chặng, public evidence, historical comparison, claims và source citations. Không trả private author notes.

### `GET /cause-map`

Filters: `chapter`, `lane`, `relationType`, `dossierSlug`.  
Response gồm nodes, edges, explanations và dossier links.

### `GET /evidence-matrix`

Filters: `chapter`, `dossierSlug`, `sourceType`; cursor pagination nếu source links vượt 100.

### `POST /me/dossier-progress`

Auth student. Body `{ "dossierId": "uuid", "version": 1 }`.  
Idempotent upsert; không thay score hoặc attempt.

## 5. Competition discovery và leaderboard

### `GET /competitions/current`

Public response: competition `publicId`, `kind` (`official | rehearsal`, `[ĐỀ XUẤT]`), state, opensAt, startDeadlineAt, `standing` (`provisional | official`), hai game summary (`minefield`, `race`: totalDurationMs, số người đang chơi/đã hoàn thành) và URL bảng xếp hạng. Không trả internal UUID hoặc ngân hàng câu hỏi.

### `GET /competitions/{publicId}/games/{game}/leaderboard`

`game`: `minefield | race`. Query `limit` 1-100, default 10 cho trình chiếu, tối đa 100.  
Response gồm `version`, `serverTime`, `competitionState`, `standing` (`provisional | official`), `completedCount`, `playingCount`, entries: `publicEntryId`, `displayName` (họ tên đầy đủ + hậu tố trùng tên nếu có), `rank`, `score`, `attemptState` (`playing | completed | timed_out`), `rankTrend`.

Không trả student ID, auth user ID, câu trả lời, số câu đúng chi tiết theo câu hoặc trạng thái phiên.

## 6. Student Passport

### `GET /me/passport`

Auth student. Response gồm profile, 15 dossier progress markers, competition history và hai thẻ kết quả độc lập mỗi competition: state, score, rank, `standing`, `correctCount`, `hardCorrect`, `completionDurationMs`, `reviewAvailable`.

## 7. Gameplay

Mọi endpoint gameplay yêu cầu sinh viên đã đăng nhập. Response không bao giờ chứa đáp án đúng, giải thích, nội dung ô chưa mở hoặc câu chưa hiển thị (`LA-FB-003`, `MINE-BOARD-005`, `LA-ALLOC-005`).

### Attempt projection (dùng chung)

```json
{
  "attemptId": "uuid",
  "game": "minefield",
  "state": "active",
  "attemptVersion": 9,
  "sessionVersion": 3,
  "serverTime": "2026-11-05T10:01:10.000Z",
  "remainingMs": 112000,
  "score": 740,
  "progress": { "processed": 4, "total": 10 },
  "items": { "shields": 1, "doubleArmed": false },
  "streak": null,
  "board": [{ "index": 0, "state": "opened", "kind": "chest" }, { "index": 1, "state": "hidden" }],
  "currentInteraction": {
    "allocationId": "uuid",
    "role": "main",
    "difficulty": "medium",
    "availableInMs": 0,
    "remainingMs": 5400,
    "prompt": "string",
    "options": [{ "id": "a1", "label": "string" }, { "id": "b2", "label": "string" }, { "id": "c3", "label": "string" }]
  },
  "standing": { "rank": 7, "label": "provisional", "gapToAbove": 60, "gapToTop10": null }
}
```

- `board` chỉ có ở `minefield`; `streak` chỉ có ở `race`.
- `currentInteraction` là `null` khi không có câu đang mở. `remainingMs` của câu là `min(deadline_at, ends_at) − serverTime`; client chỉ dùng để hiển thị (`LA-TIME-007`).
- `options` theo thứ tự đã đảo cho lượt (`LA-ALLOC-003`), id đáp án không tiết lộ đáp án đúng.

### `POST /competitions/{publicId}/games/{game}/attempts`

Auth student, `Idempotency-Key`. Không cần body.  
Response `201` nếu tạo mới, `200` nếu tiếp tục lượt đã có; body là attempt projection.  
Errors: `409 start_deadline_passed`, `409 competition_not_open`, `409 another_attempt_active` (kèm `activeAttempt: { game, attemptId }`), `409 question_pool_insufficient`, `410 attempt_terminal` (lượt đã kết thúc; body có kết quả).

### `GET /attempts/{attemptId}`

Owner student/admin only. Trả attempt projection có thẩm quyền; gọi khi F5, kết nối lại hoặc nhận sự kiện `reconcile_required`.

### `POST /attempts/{attemptId}/heartbeats`

Body `{ "sessionVersion": 3 }`. Response `serverTime`, `remainingMs`, `state`. Chỉ phục vụ trạng thái kết nối và giám sát; không ảnh hưởng đồng hồ (`LA-TIME-012`).

### `POST /attempts/{attemptId}/session-transfers`

Body `{ "expectedSessionVersion": 3 }`, `Idempotency-Key`.  
Response tăng `sessionVersion`, revoke session cũ và trả attempt projection. Không làm mới bất kỳ thời hạn nào.  
Errors: `409 stale_session`, `410 attempt_terminal`.

### `POST /attempts/{attemptId}/cells/{cellIndex}/open` (chỉ `minefield`)

Headers `Idempotency-Key`. Body `{ "sessionVersion": 3 }`. `cellIndex` 0–19.

```json
{
  "data": {
    "cell": { "index": 12, "kind": "bomb" },
    "event": { "type": "defuse_required", "pointsDelta": 0 },
    "score": 740,
    "items": { "shields": 1, "doubleArmed": false },
    "currentInteraction": { "allocationId": "uuid", "role": "defuse", "availableInMs": 600, "remainingMs": 5600, "prompt": "string", "options": [{ "id": "a1", "label": "A" }, { "id": "b2", "label": "B" }] },
    "standing": { "rank": 7, "label": "provisional", "gapToAbove": 60, "gapToTop10": null },
    "leaderboardVersion": 41,
    "attemptVersion": 10,
    "remainingMs": 104000
  }
}
```

Mở lại ô đã mở hoặc gửi lại cùng `Idempotency-Key` trả kết quả đã có `200`, không thay đổi điểm (`MINE-BOARD-007`).  
Errors: `409 interaction_pending` `[ĐỀ XUẤT MINE-BOARD-008]`, `409 stale_session`, `409 stale_attempt`, `410 attempt_terminal`, `422 invalid_cell`.

### `POST /attempts/{attemptId}/interactions/{allocationId}/submissions`

Headers: `Idempotency-Key`. Body:

```json
{ "sessionVersion": 3, "optionId": "b2" }
```

Response:

```json
{
  "data": {
    "outcome": "correct",
    "pointsDelta": 400,
    "events": [{ "type": "answer", "pointsDelta": 200 }, { "type": "double_consumed", "pointsDelta": 200 }],
    "score": 1140,
    "items": { "shields": 1, "doubleArmed": false },
    "streak": null,
    "standing": { "rank": 5, "previousRank": 7, "label": "provisional", "gapToAbove": 20, "gapToTop10": null },
    "leaderboardVersion": 42,
    "attemptVersion": 11,
    "remainingMs": 98000,
    "nextInteraction": null,
    "attemptState": "active"
  }
}
```

- `outcome`: `correct | incorrect | timed_out`. Response **không** chứa đáp án đúng hay giải thích (`LA-FB-001`, `LA-FB-003`).
- Với `race`, `nextInteraction` chứa câu tiếp theo kèm `availableInMs` bằng thời gian phản hồi `[ĐỀ XUẤT LA-TIME-010]`; thời hạn câu tính từ `available_at`.
- Câu trả lời đến sau `min(deadline_at, ends_at) + latency_allowance` được ghi `timed_out`, 0 điểm (`LA-TIME-005`).
- Gửi lại cùng `Idempotency-Key` hoặc gửi lần hai cho cùng allocation trả kết quả đã commit `200`, không cộng điểm lần hai.

Errors: `409 stale_session`, `409 stale_attempt`, `409 interaction_not_current`, `410 attempt_terminal`, `422 invalid_answer_shape`.

### `GET /attempts/{attemptId}/review`

Owner student only. Chỉ khi cuộc thi `finalized | archived` (`LA-FB-004`). Response: từng câu với đề, lựa chọn của sinh viên, đáp án đúng, giải thích, nguồn và kết quả.  
Errors: `409 review_not_available` khi cuộc thi chưa Finalized.

## 8. Admin roster

### `POST /admin/roster-imports`

Multipart, một tệp `.xlsx` hoặc `.csv` (UTF-8), tối đa 1 MiB, tối đa 100 hàng dữ liệu. Với `.xlsx` chỉ đọc sheet đầu tiên và giá trị ô (không đánh giá công thức).  
Cột bắt buộc (không phân biệt hoa thường, chấp nhận bí danh): MSSV (`student_id`, `MSSV`, `Mã sinh viên`), họ tên (`full_name`, `Họ và tên`, `Họ tên`). Không có cột mật khẩu (`LA-ACC-003`).  
Response `201` với bản xem trước: tổng hàng, số hàng hợp lệ, lỗi theo hàng (`duplicate_in_file`, `already_exists`, `missing_student_id`, `missing_full_name`, `invalid_student_id`). Tệp không đọc được trả `422`. Không tạo profile/Auth user ở bước này (`LA-ACC-002`).

### `POST /admin/roster-imports/{id}/apply`

Áp dụng các hàng hợp lệ của một import đã xem trước. Mọi tài khoản dùng mật khẩu mặc định cấu hình phía server. Response `200 applied` hoặc `409 import_not_ready`. Provider failure trả `503 roster_apply_failed`, audit và chạy compensation cho Auth users đã tạo trong batch. `[ĐỀ XUẤT LA-ACC-010]` Hàng `already_exists` không bị sửa.

### `POST /admin/profiles/{profileId}/password-resets`

Không body. Đặt lại mật khẩu về mật khẩu mặc định cấu hình phía server, revoke phiên chơi đang hoạt động và audit. Không trả hoặc log mật khẩu.

## 9. Admin content

- `GET/POST /admin/questions`
- `GET/PATCH /admin/questions/{id}`
- `POST /admin/questions/{id}/reviews`
- `POST /admin/questions/{id}/publications`
- `GET/POST /admin/dossiers`
- `GET/PATCH /admin/dossiers/{id}`
- `POST /admin/dossiers/{id}/publications`

Transition invalid trả `409 invalid_content_transition`. Publish thiếu source/schema trả `422 publication_requirements_failed`.

## 10. Admin competition

- `GET/POST /admin/competitions`
- `GET/PATCH /admin/competitions/{id}`
- `POST /admin/competitions/{id}/readiness-checks`
- `POST /admin/competitions/{id}/transitions`
- `GET /admin/competitions/{id}/monitor`
- `GET /admin/audit-logs?cursor=...`

Transition body `{ "targetState": "open" }`. Open chỉ thành công khi schedule hợp lệ, đủ Published pool cho từng ô blueprint của cả hai game, cuộc thi `official` không dùng câu `fixture`, và snapshot/config được lock.

### Xử lý sự cố `[ĐỀ XUẤT LA-ADMIN-003]`

- `POST /admin/attempts/{attemptId}/incidents` body `{ "action": "note | revoke_sessions | lock_account | void_attempt", "reason": "string" }`.
- Bắt buộc `reason`, ghi audit. Không có action tạo lượt mới (`LA-ADMIN-001`); không action nào sửa điểm, thứ hạng hoặc thời gian (`LA-ADMIN-002`).

## 11. Status codes và stable error codes

- `400 invalid_json`, `400 invalid_request`.
- `401 unauthenticated`, `401 invalid_credentials`.
- `403 forbidden`, `403 csrf_failed`.
- `404 not_found` dùng khi resource không tồn tại hoặc caller không được biết sự tồn tại.
- `409 duplicate_resource`, `409 stale_session`, `409 stale_attempt`, `409 invalid_state_transition`, `409 another_attempt_active`, `409 interaction_pending`, `409 interaction_not_current`, `409 review_not_available`.
- `410 attempt_terminal`.
- `422 validation_error`, `422 publication_requirements_failed`, `422 invalid_cell`, `422 invalid_answer_shape`.
- `423 account_disabled`. (`423 password_change_required` không dùng trong V1, `LA-ACC-004`.)
- `429 rate_limited` kèm `Retry-After`.
- `500 internal_error`, `503 temporarily_unavailable`.

## 12. OpenAPI

`openapi/v1.yaml` phải mô tả toàn bộ endpoint, schema, auth, headers, examples và stable error codes. Contract tests parse OpenAPI và bảo đảm Route Handler exports không lệch endpoint đã công bố.
