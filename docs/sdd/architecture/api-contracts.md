# API Contracts v1

Trạng thái: Approved for planning; sửa đổi v1.1 cho Live Arena V1.0 (2026-10-29, bản sửa 2)  
Base path: `/api/v1`  
Format: JSON UTF-8, camelCase ở API, snake_case trong PostgreSQL

### Student Passport progress (T025/T034)

`GET /passport/progress` trả `ownerId` của phiên và các hàng tiến độ của chính sinh viên (`dossier_id`, `state`, `completed_at`, `version`); `POST /passport/progress` nhận `slug`, `state`, `ownerId` đã đọc và `expectedVersion` (0 khi chưa có bản lưu). Server luôn lấy profile từ phiên và từ chối nếu `ownerId` không khớp; giá trị này không chọn tài khoản để ghi. Server kiểm tra CSRF, chỉ nhận hồ sơ Published và kiểm tra dữ kiện/phương án thuộc hồ sơ. Ghi có điều kiện theo phiên bản, trả `409 progress_conflict` khi bản server đã đổi. Chặng cuối ghi dấu hoàn thành.

Tiến độ chưa đồng bộ được lưu tại thiết bị; trên máy dùng chung người học cần kiểm tra bản thiết bị trước khi chọn dùng. Khi phiên bản server thay đổi hoặc không xác định, hệ thống yêu cầu chọn bản; không tự ghi đè. Khi chọn bản tài khoản, bản thiết bị được lưu dự phòng cục bộ.

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

Public response: competition `publicId`, `kind` (`official | rehearsal`, `LA-CONTENT-006`), state, opensAt, startDeadlineAt, `standing` (`provisional | official`), hai game summary (`minefield`, `race`: totalDurationMs, số người đang chơi/đã hoàn thành) và URL bảng xếp hạng. Không trả internal UUID hoặc ngân hàng câu hỏi.

### `GET /competitions/{publicId}/games/{game}/leaderboard`

`game`: `minefield | race`. Query `limit`: mặc định 10.  
Response gồm `version`, `serverTime`, `competitionKind`, `competitionState`, `standing` (`provisional | official`; cuộc thi `rehearsal` luôn `provisional` hoặc nhãn "Diễn tập"), `completedCount`, `playingCount`, entries: `publicEntryId`, `displayName`, `rank`, `score`, `attemptState` (`playing | completed | timed_out`), `rankTrend`.

- `displayName`: tên hiển thị lớp học dạng rút gọn kèm hậu tố trùng tên (`LA-PRV-003`, `LA-LB-012`). Không bao giờ có họ tên đầy đủ hay MSSV.
- Chỉ chứa người đã bắt đầu lượt của game đó; không endpoint công khai nào trả danh sách lớp (`LA-PRV-002`).
- Khách không đăng nhập: tối đa 10 hàng, `limit` lớn hơn bị giới hạn về 10. Sinh viên đã đăng nhập: Top 10 kèm `me` (hạng, hàng của chính mình và khoảng cách điểm theo `LA-LB-005`). Danh sách đầy đủ chỉ qua route admin (`LA-PRV-004`).

Không trả student ID, auth user ID, câu trả lời, số câu đúng chi tiết theo câu hoặc trạng thái phiên.

## 6. Student Passport

### `GET /me/passport`

Auth student. Response gồm profile, 15 dossier progress markers, competition history và hai thẻ kết quả độc lập mỗi competition: state, score, rank, `standing`, `correctCount`, `hardCorrect`, `completionDurationMs`, `reviewAvailable`.

## 7. Gameplay

> **Giai đoạn E – đã triển khai (2026-10-30).** `openapi/v1.yaml` là bản công bố của các route dưới đây; test `openapi-contract.test.ts` bảo đảm file route và OpenAPI không lệch. Đường dẫn thực tế (khác bản nháp phía dưới ở tên cuối đường dẫn; luật không đổi):
>
> | Method + đường dẫn (`/api/v1`) | Ghi chú |
> |---|---|
> | `GET /arena/lobby` | cuộc thi đang mở và trạng thái lượt từng game |
> | `POST /arena/competitions/{publicId}/games/{game}/attempt` | bắt đầu/tiếp tục; `201` mới, `200` tiếp tục; `Idempotency-Key` bắt buộc; tiếp tục từ phiên Auth mới sẽ nhận quyền điều khiển |
> | `GET /arena/attempts/{attemptId}` | projection; chỉ phiên đang điều khiển |
> | `POST /arena/attempts/{attemptId}/transfer` | nhận quyền điều khiển (thiết bị mới), không reset gì |
> | `POST /arena/attempts/{attemptId}/interactions/{allocationId}/content` | giải phóng nội dung câu (giữ tới 1 s hoặc `425` + `availableInMs`); POST vì ghi lần phát hành đầu |
> | `POST /arena/attempts/{attemptId}/cells/{index}/open` | Game 1 |
> | `POST /arena/attempts/{attemptId}/answers` | body chỉ gồm `allocationId`, `optionId` (strict) |
> | `POST /arena/attempts/{attemptId}/heartbeat` | chỉ hiển thị kết nối |
> | `GET /arena/attempts/{attemptId}/standing`, `/review` | hạng cá nhân; xem lại chỉ sau Finalized |
> | `GET /arena/leaderboards/{publicId}/{game}` | công khai, Top 10, chỉ tên hiển thị, giới hạn tần suất theo IP tin cậy |
> | `POST /admin/competitions`, `GET .../{id}/readiness`, `POST .../{id}/transitions`, `/finalize`, `/reconcile` | quản trị cuộc thi (CSRF, 404 cho người không phải admin) |
>
> **Định danh và phiên điều khiển.** Mọi RPC dùng `profile_id` lấy từ Supabase Auth đã xác minh (`getUser`), không bao giờ từ body/query/header do client gửi (body `strict` từ chối `profileId`, `score`, `isCorrect`, thời gian). Quyền điều khiển lượt gắn với claim `session_id` của access token (`attempts.control_auth_session_id`). Đăng nhập sinh viên trên thiết bị mới gọi `arena_claim_active_attempt`; `POST .../attempt` (tiếp tục) và `POST .../transfer` gọi `arena_bind_session(..., take_control => true)`; mọi lời gọi gameplay khác dùng `take_control => false` nên phiên cũ nhận `409 stale_session`. `session_version` chỉ là phiên bản nội bộ truyền cho RPC, client không gửi.
> **Lỗi cơ sở dữ liệu → mã API ổn định:** `QA404→404`, `QA409→409`, `QA410→410`, `QA422→422`, `QA425→425 too_early` (+`details.availableInMs`), `55P03→503 temporarily_unavailable`, `QB001/QB002→503 competition_not_ready`, `42501→403`; mọi lỗi khác `500 internal_error` không kèm văn bản SQL.
> **Chưa có trong E:** Realtime Broadcast (T053), `GET /competitions/current` công khai và Passport (dùng `arena/lobby`/leaderboard), xác nhận câu đã lộ qua API (RPC `confirm_disclosed_questions` đã có), thao tác sự cố admin.


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
    "released": true,
    "content": {
      "prompt": "string",
      "options": [{ "id": "a1", "label": "string" }, { "id": "b2", "label": "string" }, { "id": "c3", "label": "string" }]
    }
  },
  "standing": { "rank": 7, "label": "provisional", "gapToAbove": 60, "gapToTop10": null }
}
```

- `board` chỉ có ở `minefield`; `streak` chỉ có ở `race`.
- `currentInteraction` là `null` khi không có câu đang mở. `remainingMs` của câu là `min(deadline_at, ends_at) − serverTime`; client chỉ dùng để hiển thị (`LA-TIME-007`).
- **Phát hành nội dung (`LA-TIME-013`):** khi `serverTime < available_at`, `released = false`, `content` vắng mặt và chỉ có `availableInMs`; `remainingMs` khi đó bằng thời hạn đầy đủ tính từ `available_at`. Projection (kể cả sau F5 hoặc chuyển thiết bị) không bao giờ chứa nội dung câu trước `available_at`.
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
    "currentInteraction": { "allocationId": "uuid", "role": "defuse", "availableInMs": 600, "released": false },
    "standing": { "rank": 7, "label": "provisional", "gapToAbove": 60, "gapToTop10": null },
    "leaderboardVersion": 41,
    "attemptVersion": 10,
    "remainingMs": 104000
  }
}
```

Mở lại ô đã mở hoặc gửi lại cùng `Idempotency-Key` trả kết quả đã có `200`, không thay đổi điểm (`MINE-BOARD-007`).  
Response mở ô **không** chứa nội dung câu; client lấy nội dung bằng endpoint dưới đây (`LA-TIME-013`, `LA-TIME-014`).  
Errors: `409 interaction_pending` (`MINE-BOARD-008`), `409 stale_session`, `409 stale_attempt`, `410 attempt_terminal`, `422 invalid_cell`.

### `GET /attempts/{attemptId}/interactions/{allocationId}/content`

Owner student, header `X-Session-Version`. Trả nội dung câu khi `clock_timestamp() ≥ available_at`:

```json
{ "data": { "allocationId": "uuid", "prompt": "string", "options": [{ "id": "a1", "label": "string" }, { "id": "b2", "label": "string" }], "remainingMs": 5550, "serverTime": "2026-11-05T10:01:12.600Z" } }
```

- Long-poll (`LA-TIME-017`): nếu yêu cầu tới trước `available_at` không quá offset (≤ 1 000 ms), server giữ yêu cầu tới `available_at` rồi trả nội dung. Dự phòng: nếu tới sớm hơn mức đó hoặc không giữ được kết nối, trả `425 too_early` với `availableInMs`, không có nội dung.
- Không bao giờ chứa đáp án đúng. Gọi lại nhiều lần trả cùng nội dung và cùng `deadline_at`; lấy muộn không kéo dài thời hạn (`LA-TIME-015`). Lần trả đầu tiên ghi `content_released_at`.
- Errors: `425 too_early`, `409 stale_session`, `409 interaction_not_current`, `410 attempt_terminal` (lượt đã kết thúc hoặc câu đã hết giờ — không trả nội dung).

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
- Với `race`, `nextInteraction` chỉ chứa `allocationId`, `difficulty`, `availableInMs` (bằng offset phản hồi, `LA-TIME-010`) và `released: false`; **không** chứa nội dung. Client lấy nội dung qua endpoint `content`; thời hạn câu tính từ `available_at` do server đặt.
- Câu trả lời đến sau `min(deadline_at, ends_at) + latency_allowance` được ghi `timed_out`, 0 điểm (`LA-TIME-005`).
- Gửi lại cùng `Idempotency-Key` hoặc gửi lần hai cho cùng allocation trả kết quả đã commit `200`, không cộng điểm lần hai.

Errors: `409 stale_session`, `409 stale_attempt`, `409 interaction_not_current`, `410 attempt_terminal`, `422 invalid_answer_shape`.

### `GET /attempts/{attemptId}/review`

Owner student only. Chỉ khi cuộc thi `finalized | archived` (`LA-FB-004`). Response: từng câu với đề, lựa chọn của sinh viên, đáp án đúng, giải thích, nguồn và kết quả.  
Errors: `409 review_not_available` khi cuộc thi chưa Finalized.

## 8. Admin roster

### `POST /admin/roster-imports`

Multipart, một tệp `.xlsx` hoặc `.csv` (UTF-8), tối đa 1 MiB (`[THỬ NGHIỆM LA-ACC-017]`); giới hạn số hàng chưa cố định (`[MỞ] LA-ACC-014`), nếu có thì là cấu hình. Với `.xlsx` chỉ đọc sheet đầu tiên, đọc văn bản hiển thị của ô, không đánh giá công thức.  
MSSV luôn được đọc và trả về dạng chuỗi, giữ số 0 đầu (`LA-ACC-011`); ô MSSV kiểu số trong `.xlsx` sinh cảnh báo `numeric_cell` (`LA-ACC-012`). Khi chưa có mẫu định dạng (`[MỞ] LA-ACC-013`), chỉ áp dụng kiểm tra an toàn tối thiểu (`LA-ACC-018`); mẫu nếu có là cấu hình.  
Cột bắt buộc (không phân biệt hoa thường, chấp nhận bí danh): MSSV (`student_id`, `MSSV`, `Mã sinh viên`), họ tên (`full_name`, `Họ và tên`, `Họ tên`). Không có cột mật khẩu (`LA-ACC-003`).  
Response `201` với bản xem trước: tổng hàng, số hàng hợp lệ, cảnh báo và lỗi theo hàng (`duplicate_in_file`, `already_exists`, `missing_student_id`, `missing_full_name`, `pattern_mismatch`, `numeric_cell`, `formula_prefix`), kèm `displayName` sinh tự động (`LA-PRV-003`) mà quản trị viên chỉnh được trước khi áp dụng. Tệp không đọc được trả `422`. Không tạo profile/Auth user ở bước này (`LA-ACC-002`).

### `POST /admin/roster-imports/{id}/apply`

Body `{ "confirmedWarningRows": [12, 37], "displayNameOverrides": { "12": "An N.V." } }`. Áp dụng các hàng hợp lệ và các hàng cảnh báo được xác nhận của một import đã xem trước. Mọi tài khoản dùng mật khẩu mặc định cấu hình phía server. Response `200 applied` hoặc `409 import_not_ready`. Provider failure chạy compensation cho Auth users đã tạo (kể cả tài khoản mất phản hồi), xác minh từng lần xóa. Sạch hoàn toàn: `503 roster_apply_failed`, bản nhập `compensated`. Còn sót: `503 roster_cleanup_incomplete`, bản nhập `failed`, phần sót bị khóa và ghi lại (ADR-005). Hàng `already_exists` không bị sửa (`LA-ACC-010`).

### `PATCH /admin/profiles/{profileId}/display-name`

Body `{ "displayName": "An N.V.", "reason": "string" }`. Tối đa 40 ký tự, chuẩn hóa Unicode, không ký tự điều khiển. Ghi audit; cập nhật `display_name_snapshot` của các lượt trong cuộc thi chưa Finalized (`LA-PRV-005`).

### `POST /admin/roster-imports/{id}/cleanup`

Thử lại việc xóa các tài khoản còn sót của bản nhập có trạng thái `failed` (chỉ những id đã được ghi lại). `200 {removed}` khi sạch; `503 roster_cleanup_incomplete` nếu vẫn còn; `409 import_not_ready` nếu bản nhập không có gì để dọn. Có audit.

### `POST /admin/profiles/{profileId}/password-resets`

Không body. Đặt lại mật khẩu về mật khẩu mặc định cấu hình phía server, revoke phiên chơi đang hoạt động và audit. Không trả hoặc log mật khẩu.

## 9. Admin content

Câu hỏi (Giai đoạn C, đã triển khai):

- `POST /admin/questions` — tạo hoặc cập nhật **Draft** theo `key` (`201 created`, `200 updated | unchanged | new_version`). Body Zod `strict`; không nhận `status` hay `origin`; luôn `origin = bank`. Quy tắc sâu do database quyết định.
- `GET /admin/questions?game&origin&status&limit` — danh sách kèm phiên bản, nguồn, đáp án và giải thích (chỉ admin).
- `POST /admin/question-versions/{id}/transitions` — body `{action: review|publish|reject|retire, note?}`; người thực hiện luôn là admin đang đăng nhập. Lỗi: `422 publication_requirements_failed` (thiếu người duyệt/nguồn đã xác minh/ghi chú cho nội dung do AI soạn), `409 invalid_content_transition`, `403 forbidden`, `404`.
- `GET /admin/question-bank/readiness?kind=official|rehearsal&competitionId&expectedAttempts` — báo cáo sẵn sàng (blocker và mục tiêu 168 câu riêng).

Chưa triển khai: `GET/PATCH /admin/questions/{id}` riêng lẻ (dùng POST theo `key`), giao diện quản trị (T055).

Dossier:
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

Transition body `{ "targetState": "open" }`. Open chỉ thành công khi schedule hợp lệ, đủ Published pool cho từng ô blueprint của cả hai game, cuộc thi `official` không dùng câu `fixture`, mọi câu đã lộ đáp án trong snapshot đều đã được xác nhận, và snapshot/config được lock.

Readiness response gồm: thiếu hụt theo ô blueprint, số người dự kiến thấy mỗi câu (`LA-CONTENT-010`), danh sách câu đã lộ đáp án kèm cuộc thi gây lộ (`LA-CONTENT-009`).

### `POST /admin/competitions/{id}/disclosed-question-confirmations`

Body `{ "questionVersionIds": ["uuid"], "reason": "string" }`. Chỉ khi cuộc thi chưa Open. Ghi xác nhận cho từng câu và audit; không có xác nhận ngầm hay hàng loạt cho mọi câu đã lộ (`LA-CONTENT-009`).

### Xử lý sự cố (`LA-ADMIN-003`)

- `POST /admin/attempts/{attemptId}/incidents` body `{ "action": "note | revoke_sessions | lock_account | void_attempt", "reason": "string" }`.
- Bắt buộc `reason`, ghi audit. Không có action tạo lượt mới hoặc cấp lượt thay thế (`LA-ADMIN-001`, `LA-ADMIN-004`); không action nào sửa điểm, thứ hạng hoặc thời gian (`LA-ADMIN-002`).

## 11. Status codes và stable error codes

- `400 invalid_json`, `400 invalid_request`.
- `401 unauthenticated`, `401 invalid_credentials`.
- `403 forbidden`, `403 csrf_failed`.
- `404 not_found` dùng khi resource không tồn tại hoặc caller không được biết sự tồn tại.
- `409 duplicate_resource`, `409 stale_session`, `409 stale_attempt`, `409 invalid_state_transition`, `409 another_attempt_active`, `409 interaction_pending`, `409 interaction_not_current`, `409 review_not_available`.
- `410 attempt_terminal`.
- `422 validation_error`, `422 publication_requirements_failed`, `422 invalid_cell`, `422 invalid_answer_shape`.
- `423 account_disabled`. (`423 password_change_required` không dùng trong V1, `LA-ACC-004`.)
- `425 too_early` kèm `availableInMs` (nội dung câu chưa được phát hành).
- `429 rate_limited` kèm `Retry-After`.
- `500 internal_error`, `503 temporarily_unavailable` (bao gồm hết `lock_wait_limit`, không ghi gì, có thể thử lại, `LA-TIME-021`).

## 12. OpenAPI

`openapi/v1.yaml` phải mô tả toàn bộ endpoint, schema, auth, headers, examples và stable error codes. Contract tests parse OpenAPI và bảo đảm Route Handler exports không lệch endpoint đã công bố.
