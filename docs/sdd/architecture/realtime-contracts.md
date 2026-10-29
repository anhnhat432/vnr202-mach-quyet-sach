# Realtime Contracts

Trạng thái: Approved for planning; sửa đổi v1.1 cho Live Arena V1.0 (2026-10-29, bản sửa 2)  
Nguyên tắc: event là notification, REST/RPC projection là nguồn chân lý

## 1. Channel taxonomy

### Public leaderboard

- Topic: `leaderboard:{competitionPublicId}:{game}` với `game` là `minefield | race`; hai topic độc lập (`LA-LB-001`).
- Không dùng chung namespace với kênh Giờ G (`giog:*`), là kênh luyện tập không có thẩm quyền (`LA-SCOPE-004`).
- Channel mode: public Broadcast cho release một lớp.
- Events: `leaderboard.changed`, `leaderboard.finalized`, `competition.state_changed`.
- Client không gửi dữ liệu nghiệp vụ lên channel.

### Student attempt

- Topic: `attempt:{attemptId}`.
- Channel chỉ được subscribe bởi owner student và admin qua Realtime Authorization.
- Events: `attempt.session_revoked`, `attempt.state_changed`, `attempt.reconcile_required`.

### Admin monitor

- Topic: `admin:competition:{competitionId}`.
- Private channel, admin only.
- Events: attempt counts, disconnect transitions, terminal counts, rate warnings và settle status.

### Presence

- Public leaderboard presence chỉ là ước lượng người xem.
- Attempt/admin presence dùng private channel.
- Presence state không quyết định score, timer, eligibility hoặc completion.

## 2. Event envelope

```json
{
  "eventId": "uuid",
  "eventType": "leaderboard.changed",
  "occurredAt": "2026-08-19T10:02:00.123Z",
  "aggregate": {
    "type": "leaderboard",
    "publicId": "competition-public-id:minefield",
    "version": 41
  },
  "data": {
    "competitionPublicId": "competition-public-id",
    "game": "minefield"
  }
}
```

Yêu cầu:

- `eventId` unique.
- `version` tăng đơn điệu trong từng aggregate.
- Public event không có tên hiển thị, full name, student ID, auth ID, answer, đáp án đúng, score chi tiết hoặc attempt ID (`LA-ANTI-007`).
- Client bỏ event sai schema, sai topic, version nhỏ hơn hoặc bằng version đang render.

## 3. Leaderboard flow

1. Mọi RPC gây sự kiện điểm (`submit_answer`, `open_minefield_cell` khi mở rương hoặc gỡ bom thất bại, `reconcile_attempt` khi ghi hết giờ hoặc kết thúc lượt) khóa attempt và leaderboard version row.
2. RPC đánh giá, ghi sổ sự kiện, update attempt và leaderboard entry, tăng version (`LA-LB-002`).
3. Database trigger hoặc server broadcaster phát `leaderboard.changed` sau commit.
4. Player nhận score, rank, khoảng cách điểm và version trực tiếp trong HTTP response.
5. Viewer nhận Broadcast, debounce 100-250 ms rồi GET authoritative leaderboard.
6. Nếu Broadcast thiếu hoặc sai thứ tự, periodic sync 15 giây khi live và sync ngay khi tab focus/reconnect sửa divergence.

Mục tiêu dưới tải duyệt: rank đã commit xuất hiện ở connected viewer trong 1 giây.

Hiệu ứng vượt hạng và tăng/giảm hạng trên màn trình chiếu được tính ở client bằng cách so sánh hai projection có thẩm quyền liên tiếp; payload sự kiện không mang tên hay điểm. `leaderboard.finalized` chỉ phát sau khi `finalize_competition` commit; client đổi nhãn `Tạm thời` sang `Chính thức` sau khi GET xác nhận `standing = official` (`LA-LB-007`).

## 4. Public channel abuse boundary

Public Broadcast cho phép client không đáng tin cậy có thể phát notification giả. Biện pháp release đầu:

- Event không mang dữ liệu có thẩm quyền.
- Client chỉ fetch khi event hợp lệ và version lớn hơn local.
- Fetch được debounce, coalesce và rate limit.
- API trả authoritative version; fake high version không được lưu làm local version nếu fetch không xác nhận.
- UI hiển thị `Đang đồng bộ` thay vì áp dụng payload.

Upgrade trigger: khi mở nhiều lớp hoặc public audience lớn hơn mục tiêu, chuyển sang private channel với short-lived viewer authorization.

## 5. Attempt session events

### `attempt.session_revoked`

```json
{
  "eventId": "uuid",
  "eventType": "attempt.session_revoked",
  "occurredAt": "2026-08-19T10:03:00Z",
  "aggregate": { "type": "attempt", "publicId": "attempt-id", "version": 10 },
  "data": { "reason": "device_transfer", "sessionVersion": 4 }
}
```

Old client phải khóa input ngay, dừng heartbeat và GET attempt projection. Dù event bị bỏ lỡ, mọi mutation với stale sessionVersion bị server từ chối.

### `attempt.state_changed`

Data chỉ gồm state, attemptVersion và serverTime; remaining time phải refetch hoặc lấy từ HTTP response để tránh client tự tin vào event trễ. Không event nào mang nội dung câu hỏi hay đáp án; nội dung câu chỉ được lấy qua HTTP sau `available_at` (`LA-TIME-013`).

## 6. Connection state UX

- `connected`: Realtime connected và heartbeat gần nhất thành công.
- `degraded`: mất Broadcast nhưng API còn hoạt động; game tiếp tục qua HTTP, leaderboard polling.
- `offline`: browser network unavailable; UI đóng input submission mới và báo rõ đồng hồ vẫn chạy (`LA-TIME-001`).
- `reconciling`: reconnect và GET projection.
- `revoked`: sessionVersion stale hoặc nhận revoke event.

V1 không có trạng thái `grace paused` (`LA-TIME-001`, `LA-UX-006`). Sau reconnect, client luôn GET projection; câu đã hết hạn trong lúc mất mạng hiển thị là hết giờ theo kết quả server.

## 7. Retry và backoff

- Leaderboard GET: immediate, 500 ms, 1 s, 2 s, tối đa 5 s; reset khi success.
- Heartbeat: interval 5 s, một retry sau 1 s; không xếp hàng nhiều heartbeat.
- Answer submission và mở ô: giữ cùng `Idempotency-Key`; retry khi network error, không tự retry `4xx` ngoài `409 stale_attempt` sau một projection refresh. Retry không kéo dài thời hạn: server so `received_at` của lần nhận đầu tiên hợp lệ với `deadline_at`.
- Realtime reconnect theo Supabase client; on subscribe success luôn full resync.

## 8. Validation tests

- Event out of order, duplicate, malformed và fake high version.
- Broadcast missed trong 30 giây rồi reconnect.
- 60 player submissions phân bố trong một giây và 200 viewer subscriptions.
- Old device nhận revoke trễ nhưng API vẫn từ chối answer và mở ô.
- Sự kiện của game này không làm client của bảng game kia refetch hoặc đổi dữ liệu.
- Không payload nào chứa student ID, đáp án đúng hoặc giải thích (quét tự động).
- Realtime down hoàn toàn: gameplay vẫn commit qua HTTP và leaderboard polling hội tụ.
