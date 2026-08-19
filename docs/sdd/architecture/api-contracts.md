# API Contracts v1

Trạng thái: Approved for planning  
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
- `Idempotency-Key: UUID` bắt buộc với start attempt, transfer session và answer submission.
- `X-CSRF-Token` bắt buộc với cookie-authenticated mutations ngoài sign-in.
- `X-Request-Id` do client có thể gửi UUID; server tạo mới nếu thiếu hoặc sai.
- Response mutation trả `Cache-Control: no-store`.

## 3. Authentication

### `POST /auth/sign-in`

Body:

```json
{ "studentId": "SE123456", "password": "string" }
```

Response `200`: profile redacted, `mustChangePassword`, CSRF token.  
Errors: `401 invalid_credentials`, `423 account_disabled`, `429 rate_limited`.

Server tự ánh xạ synthetic email; response không chứa email nội bộ.

### `POST /auth/change-password`

Body:

```json
{ "newPassword": "string", "confirmPassword": "string" }
```

Response `200`: `mustChangePassword: false`.  
Password policy: 10-72 ký tự, có chữ và số, không trùng student ID, full name hoặc temporary password hiện tại.

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

Public response: competition `publicId`, state, opensAt, startDeadlineAt, two game summaries và public leaderboard URLs. Không trả internal UUID hoặc question pool.

### `GET /competitions/{publicId}/games/{game}/leaderboard`

`game`: `timeline | decision_room`. Query `limit` 1-100, default 60.  
Response gồm `version`, `serverTime`, `state`, entries: `publicEntryId`, `fullName`, `rank`, `score`, `accuracy`, `progress`, `attemptState`, `rankTrend`.

Không trả student ID, auth user ID, submitted answers hoặc session state.

## 6. Student Passport

### `GET /me/passport`

Auth student. Response gồm profile, 15 dossier progress markers, competition history và hai independent game result cards mỗi competition.

## 7. Gameplay

### `POST /competitions/{publicId}/games/{game}/attempts`

Auth student, password changed, `Idempotency-Key`. Không cần body.  
Response `201` nếu tạo mới, `200` nếu resume existing; cùng response shape:

```json
{
  "data": {
    "attemptId": "uuid",
    "state": "active",
    "sessionVersion": 3,
    "serverTime": "2026-08-19T10:00:00Z",
    "remainingMs": 360000,
    "graceRemainingMs": 120000,
    "currentInteraction": {}
  }
}
```

Errors: `409 start_deadline_passed`, `409 competition_not_open`, `409 question_pool_insufficient`, `423 password_change_required`.

### `GET /attempts/{attemptId}`

Owner student/admin only. Returns authoritative attempt projection and current redacted interaction.

### `POST /attempts/{attemptId}/heartbeats`

Body `{ "sessionVersion": 3 }`. Response server time, remaining/grace time and attempt state. Rate target: one request mỗi 5 giây; server coalesces writes when safe.

### `POST /attempts/{attemptId}/session-transfers`

Body `{ "expectedSessionVersion": 3 }`, `Idempotency-Key`.  
Response tăng sessionVersion, revoke session cũ và trả attempt projection.  
Errors: `409 stale_session`, `409 terminal_attempt`.

### `POST /attempts/{attemptId}/interactions/{allocationId}/submissions`

Headers: `Idempotency-Key`. Body:

```json
{
  "sessionVersion": 3,
  "stageKey": "evidence",
  "answer": {}
}
```

Response:

```json
{
  "data": {
    "submissionId": "uuid",
    "isCorrect": true,
    "awardedPoints": 72,
    "feedback": {},
    "feedbackPauseUntil": "2026-08-19T10:02:08Z",
    "score": 540,
    "rank": 8,
    "leaderboardVersion": 41,
    "remainingMs": 221000,
    "attemptVersion": 9,
    "nextInteractionAvailable": false
  }
}
```

Duplicate idempotency key hoặc duplicate stage trả authoritative existing result `200`, không cộng điểm lần hai.  
Errors: `409 stale_session`, `409 stale_attempt`, `409 interaction_already_completed`, `410 attempt_terminal`, `422 invalid_answer_shape`.

### `POST /attempts/{attemptId}/feedback/continue`

Body `{ "sessionVersion": 3, "attemptVersion": 9 }`.  
Response kết thúc feedback pause sớm và trả next interaction.

## 8. Admin roster

### `POST /admin/roster-imports`

Multipart CSV, tối đa 1 MiB, tối đa 100 rows, UTF-8, exact headers `student_id,full_name,temporary_password`.  
Response `201` với validation preview; malformed/duplicate file trả `422` và không tạo profile/Auth user.

### `POST /admin/roster-imports/{id}/apply`

Áp dụng một validated import. Response `200 applied` hoặc `409 import_not_ready`. Provider failure trả `503 roster_apply_failed`, audit và chạy compensation cho Auth users đã tạo trong batch.

### `POST /admin/profiles/{profileId}/password-resets`

Body `{ "temporaryPassword": "string" }`. Server update Auth password, set `mustChangePassword`, revoke active gameplay session và audit. Không trả hoặc log password.

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

Transition body `{ "targetState": "open" }`. Open chỉ thành công khi schedule hợp lệ, đủ Published pool và snapshot/config được lock.

## 11. Status codes và stable error codes

- `400 invalid_json`, `400 invalid_request`.
- `401 unauthenticated`, `401 invalid_credentials`.
- `403 forbidden`, `403 csrf_failed`.
- `404 not_found` dùng khi resource không tồn tại hoặc caller không được biết sự tồn tại.
- `409 duplicate_resource`, `409 stale_session`, `409 stale_attempt`, `409 invalid_state_transition`.
- `410 attempt_terminal`.
- `422 validation_error`, `422 publication_requirements_failed`.
- `423 password_change_required`, `423 account_disabled`.
- `429 rate_limited` kèm `Retry-After`.
- `500 internal_error`, `503 temporarily_unavailable`.

## 12. OpenAPI

`openapi/v1.yaml` phải mô tả toàn bộ endpoint, schema, auth, headers, examples và stable error codes. Contract tests parse OpenAPI và bảo đảm Route Handler exports không lệch endpoint đã công bố.
