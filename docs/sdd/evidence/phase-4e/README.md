# Giai đoạn E – API gameplay (nghiệm thu)

Ngày: 2026-10-30. Phạm vi: HTTP API cho hai game và quản trị cuộc thi, gắn quyền điều khiển lượt với phiên Supabase Auth. Không đổi luật điểm, bàn cờ, combo hay hai BXH Top 10. Chưa có giao diện (F), chưa có Realtime Broadcast.

## Đã làm
| Hạng mục | Nơi |
|---|---|
| Migration: `attempts.control_auth_session_id`, `arena_bind_session`, `arena_claim_active_attempt` | `supabase/migrations/202610310001_arena_api_session.sql` |
| 11 route sinh viên/công khai + 5 route admin | `web/src/app/api/v1/arena/**`, `web/src/app/api/v1/admin/competitions/**` |
| `requireStudent`: profile từ Auth đã xác minh + `session_id` của token, CSRF cho thao tác ghi | `web/src/lib/api/guard.ts` |
| Hợp đồng strict (Zod) và ánh xạ lỗi DB → mã API ổn định, không lộ văn bản SQL | `web/src/features/arena/contracts`, `server/arena-service.ts` |
| Đăng nhập sinh viên trên thiết bị mới nhận quyền điều khiển lượt đang chơi | `web/src/features/auth/server/sign-in.ts` |
| OpenAPI + test không lệch với route | `openapi/v1.yaml`, `tests/unit/openapi-contract.test.ts` |
| CI: e2e dùng 1 worker và có `SUPABASE_DB_URL` để dọn dữ liệu | `.github/workflows/ci.yml`, `web/playwright.config.ts` |

## Kiểm thử (cục bộ, harness dự phòng)
- E2E HTTP thật (`arena-api.spec.ts`, Next dev + GoTrue + PostgREST + Postgres): không đăng nhập → 401; thiếu CSRF → 403; thiếu `Idempotency-Key` → 422; body có `profileId`/`score`/`isCorrect` → 422; sinh viên gọi route admin → 404; chuyển trạng thái sai → 409; bắt đầu/tiếp tục/replay; long-poll nội dung; trả lời đúng +100, replay cùng khóa trả đúng kết quả cũ; game thứ hai bị chặn kèm `attemptId`; sinh viên khác → 404; **đăng nhập lần hai (phiên Auth mới) → phiên cũ `409 stale_session` cho GET/answer/content, phiên mới cùng `attemptId`, cùng `startedAt`, cùng điểm**, `sessionVersion` +1; chuyển ngược bằng `/transfer`; BXH công khai chỉ có tên hiển thị; review `409` trước Finalized; finalize `409 attempts_still_active`. Mọi phản hồi gameplay được quét: không có `correctOptionId`/`explanation`.
- Tích hợp `arena-session.test.ts` (3): gắn phiên lần đầu, từ chối phiên khác, tăng `session_version` đúng một lần mỗi lần chuyển, claim khi đăng nhập chỉ tác động lượt đang chơi.
- Unit: `arena-service.test.ts` (ánh xạ lỗi, body strict, Idempotency-Key), `openapi-contract.test.ts`.

## CI chính thức (Supabase CLI stack)
Run 26 trên PR #6, commit `b7e1dfb`: `web`, `security-scan` và `database` đều đạt. Job `database`: `supabase test db` (pgTAP) đạt, test tích hợp 124 đạt (gồm toàn bộ test đồng hồ), e2e trình duyệt + `arena-api.spec.ts` đạt. Hai lần đỏ trước đó là lỗi kiểu trong test (`9976773`) và so sánh mốc thời gian bằng `Date` JS làm mất micro giây trong test đua biên (`d3ed5a5`), đều đã sửa; không phải lỗi sản phẩm.

## Hạn chế
- Realtime Broadcast và polling theo `version` của BXH chưa có (T053/F); `GET /competitions/current` công khai và Passport chưa làm (dùng `arena/lobby` và leaderboard).
- `/transfer` và `POST .../attempt` luôn nhận quyền; chưa có xác nhận "Chuyển sang thiết bị này?" ở UI (F).
- Thao tác sự cố admin (`LA-ADMIN-003`) và khóa ngoại bộ đếm `question_exposures.competition_id` vẫn là việc riêng (T056 / ghi chú data-model).
- Đo Wi-Fi (P2) và tải thật (P7) vẫn chờ Giai đoạn G.
