import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";

import { QuestionBankAdmin } from "@/features/admin/ui/question-bank-admin";

type Status = "draft" | "reviewed" | "published";
function question(key: string, status: Status = "draft", extra: Record<string, unknown> = {}) {
  return {
    id: key, external_key: key, current_version_id: `v-${key}`, game_type: "race", pool: "race", chapter: "chapter_3",
    topic: "Câu kiểm thử", question_type: "single_choice", difficulty: "easy", origin: "bank",
    question_versions: [{ id: `v-${key}`, version: 1, status, ai_assisted: true, retired_at: null as string | null,
      content_public: { prompt: `Đề ${key}`, options: [{ id: "a", label: "Một" }, { id: "b", label: "Hai" }] },
      content_private: { correctOptionId: "a", explanation: "Giải thích thử" }, question_source_links: [{ source_id: "s", locator: "tr. 5" }] }],
    ...extra,
  };
}
type QuestionFixture = ReturnType<typeof question>;
type Failure = { status: number; code: string; message: string };
function bank(rows: QuestionFixture[], options: { failures?: Record<string, Failure>; networkAt?: string; malformedAt?: string; hold?: Promise<void>; reloadFails?: boolean } = {}) {
  let reads = 0;
  let mutations = 0;
  const fetcher = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    if (init?.method === "POST") {
      mutations += 1;
      const id = url.split("/").at(-2)!;
      if (options.networkAt === id) throw new TypeError("Network unavailable");
      if (options.malformedAt === id) return { ok: true, status: 200, json: async () => ({ data: {} }) };
      if (options.hold) await options.hold;
      const failure = options.failures?.[id];
      if (failure) return { ok: false, status: failure.status, json: async () => ({ error: failure }) };
      const body = JSON.parse(String(init.body)) as { action: "review" | "publish" };
      const next: Status = body.action === "review" ? "reviewed" : "published";
      rows = rows.map((q) => ({ ...q, question_versions: q.question_versions.map((v) => v.id === id ? { ...v, status: next } : v) }));
      return { ok: true, status: 200, json: async () => ({ data: { status: next } }) };
    }
    if (url.includes("/question-bank/readiness")) return { ok: true, json: async () => ({ data: { ready: mutations > 0, blockers: [], target: { meetsTarget: false, expectedAttempts: 60 } } }) };
    reads += 1;
    if (reads > 1 && options.reloadFails) throw new TypeError("Reload unavailable");
    const filter = new URL(url, "https://test.invalid").searchParams;
    const selected = rows.filter((q) => q.origin === filter.get("origin") && (!filter.get("game") || q.game_type === filter.get("game")))
      .map((q) => ({ ...q, question_versions: q.question_versions.filter((v) => !filter.get("status") || v.status === filter.get("status")) }))
      .filter((q) => q.question_versions.length);
    return { ok: true, json: async () => ({ data: selected }) };
  });
  vi.stubGlobal("fetch", fetcher);
  document.cookie = "vnr_csrf=test-token; path=/";
  return { fetcher, posts: () => fetcher.mock.calls.filter(([, init]) => init?.method === "POST") };
}
afterEach(() => { cleanup(); vi.unstubAllGlobals(); vi.restoreAllMocks(); document.cookie = "vnr_csrf=; max-age=0; path=/"; });

async function selectAll() {
  fireEvent.click(await screen.findByRole("checkbox", { name: /Chọn tất cả .* đang hiển thị/ }));
}
function confirmReview(count: number) {
  fireEvent.click(screen.getByRole("button", { name: `Duyệt đã chọn (${count})` }));
  fireEvent.change(screen.getByLabelText("Ghi chú học thuật chung"), { target: { value: "  Đã đối chiếu tr. 5–8.  " } });
  fireEvent.click(screen.getByRole("checkbox", { name: /Tôi đã đối chiếu đáp án/ }));
}

it("requires human confirmation and one trimmed shared note, with independent per-version requests and CSRF", async () => {
  const { posts, fetcher } = bank([question("q-a"), question("q-b")]);
  render(<QuestionBankAdmin />);
  await selectAll();
  fireEvent.click(screen.getByRole("button", { name: "Duyệt đã chọn (2)" }));
  const submit = screen.getByRole("button", { name: "Xác nhận duyệt 2 câu" });
  expect(submit).toBeDisabled();
  fireEvent.change(screen.getByLabelText("Ghi chú học thuật chung"), { target: { value: "   " } });
  fireEvent.click(screen.getByRole("checkbox", { name: /Tôi đã đối chiếu đáp án/ }));
  expect(submit).toBeDisabled();
  expect(posts()).toHaveLength(0);
  fireEvent.change(screen.getByLabelText("Ghi chú học thuật chung"), { target: { value: "  Đã đối chiếu tr. 5–8.  " } });
  fireEvent.click(submit);
  expect(await screen.findByText("Đã xử lý: 2 thành công · 0 lỗi · 0 chưa rõ · 0 chưa gửi.")).toBeVisible();
  expect(posts().map(([url, init]) => ({ url, body: JSON.parse(String(init?.body)), headers: init?.headers }))).toEqual([
    { url: "/api/v1/admin/question-versions/v-q-a/transitions", body: { action: "review", note: "Đã đối chiếu tr. 5–8." }, headers: { "content-type": "application/json", "x-csrf-token": "test-token" } },
    { url: "/api/v1/admin/question-versions/v-q-b/transitions", body: { action: "review", note: "Đã đối chiếu tr. 5–8." }, headers: { "content-type": "application/json", "x-csrf-token": "test-token" } },
  ]);
  expect(fetcher.mock.calls.filter(([url]) => String(url).includes("/question-bank/readiness"))).toHaveLength(2);
  expect(screen.getByRole("button", { name: "Xuất bản đã chọn (0)" })).toBeDisabled();
});

it("cancels a group without any mutation and clears selection when filters change", async () => {
  const { posts } = bank([question("q-a")]);
  render(<QuestionBankAdmin />);
  await selectAll();
  confirmReview(1);
  fireEvent.click(screen.getByRole("button", { name: "Hủy" }));
  expect(posts()).toHaveLength(0);
  fireEvent.change(screen.getByLabelText("Game"), { target: { value: "minefield" } });
  expect(await screen.findByText("Không có câu hỏi phù hợp.")).toBeVisible();
  fireEvent.change(screen.getByLabelText("Game"), { target: { value: "" } });
  expect(await screen.findByRole("checkbox", { name: "Chọn câu q-a phiên bản 1" })).not.toBeChecked();
});

it("publishes only selected Reviewed versions and never reviews Drafts as part of publication", async () => {
  const { posts } = bank([question("q-a"), question("q-b", "reviewed")]);
  render(<QuestionBankAdmin />);
  await selectAll();
  fireEvent.click(screen.getByRole("button", { name: "Xuất bản đã chọn (1)" }));
  expect(posts()).toHaveLength(0);
  fireEvent.click(screen.getByRole("button", { name: "Xác nhận xuất bản 1 câu" }));
  expect(await screen.findByText("Đã xử lý: 1 thành công · 0 lỗi · 0 chưa rõ · 0 chưa gửi.")).toBeVisible();
  expect(posts()).toHaveLength(1);
  expect(posts()[0][0]).toContain("/v-q-b/");
  expect(JSON.parse(String(posts()[0][1]?.body))).toEqual({ action: "publish" });
});

it("excludes fixtures, retired versions and superseded versions even under a status filter", async () => {
  const old = question("q-old", "published");
  old.question_versions.push({ ...old.question_versions[0], id: "old-draft", version: 0, status: "draft" });
  const retired = question("q-retired");
  retired.question_versions[0].retired_at = "2026-01-01";
  bank([old, retired, question("q-fixture", "draft", { origin: "fixture" }), question("q-a")]);
  render(<QuestionBankAdmin />);
  await selectAll();
  expect(screen.queryByRole("checkbox", { name: /Chọn câu q-old|Chọn câu q-retired|Chọn câu q-fixture/ })).not.toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Duyệt đã chọn (1)" })).toBeEnabled();
  fireEvent.change(screen.getByLabelText("Trạng thái"), { target: { value: "draft" } });
  await waitFor(() => expect(screen.queryByText("Đề q-old")).not.toBeInTheDocument());
  fireEvent.change(screen.getByLabelText("Nguồn"), { target: { value: "fixture" } });
  expect(await screen.findByText("GIẢ LẬP")).toBeVisible();
  expect(screen.queryByRole("checkbox", { name: /Chọn câu/ })).not.toBeInTheDocument();
});

it("reports independent validation failures and still processes other selected questions", async () => {
  const { posts } = bank([question("q-a"), question("q-b"), question("q-c")], { failures: { "v-q-b": { status: 422, code: "publication_requirements_failed", message: "Nguồn chưa đủ điều kiện." } } });
  render(<QuestionBankAdmin />);
  await selectAll(); confirmReview(3);
  fireEvent.click(screen.getByRole("button", { name: "Xác nhận duyệt 3 câu" }));
  expect(await screen.findByText("Đã xử lý: 2 thành công · 1 lỗi · 0 chưa rõ · 0 chưa gửi.")).toBeVisible();
  expect(posts()).toHaveLength(3);
  expect(screen.getByText(/q-b.*Nguồn chưa đủ điều kiện/)).toBeInTheDocument();
});

it.each([0, 503])("stops without automatic retry when an outcome is uncertain (%s)", async (status) => {
  const { posts } = bank([question("q-a"), question("q-b"), question("q-c")], status === 0
    ? { networkAt: "v-q-b" }
    : { failures: { "v-q-b": { status, code: "internal_error", message: "Không rõ kết quả." } } });
  render(<QuestionBankAdmin />);
  await selectAll(); confirmReview(3);
  fireEvent.click(screen.getByRole("button", { name: "Xác nhận duyệt 3 câu" }));
  expect(await screen.findByText("Đã xử lý: 1 thành công · 0 lỗi · 1 chưa rõ · 1 chưa gửi.")).toBeVisible();
  expect(posts()).toHaveLength(2);
  expect(screen.getByText(/Đã dừng nhóm.*tải lại trạng thái/)).toBeVisible();
});

it("stops the remaining queue when the session expires", async () => {
  const { posts } = bank([question("q-a"), question("q-b")], { failures: { "v-q-a": { status: 401, code: "unauthenticated", message: "Cần đăng nhập lại." } } });
  render(<QuestionBankAdmin />);
  await selectAll(); confirmReview(2);
  fireEvent.click(screen.getByRole("button", { name: "Xác nhận duyệt 2 câu" }));
  expect(await screen.findByText("Đã xử lý: 0 thành công · 1 lỗi · 0 chưa rõ · 1 chưa gửi.")).toBeVisible();
  expect(posts()).toHaveLength(1);
});

it("stops the queue if a successful HTTP response does not confirm the transition", async () => {
  const { posts } = bank([question("q-a"), question("q-b")], { malformedAt: "v-q-a" });
  render(<QuestionBankAdmin />);
  await selectAll(); confirmReview(2);
  fireEvent.click(screen.getByRole("button", { name: "Xác nhận duyệt 2 câu" }));
  expect(await screen.findByText("Đã xử lý: 0 thành công · 0 lỗi · 1 chưa rõ · 1 chưa gửi.")).toBeVisible();
  expect(posts()).toHaveLength(1);
});

it("serializes requests and locks selection, filters and duplicate submission while processing", async () => {
  let release!: () => void;
  const hold = new Promise<void>((resolve) => { release = resolve; });
  const { posts } = bank([question("q-a"), question("q-b")], { hold });
  render(<QuestionBankAdmin />);
  await selectAll(); confirmReview(2);
  const form = screen.getByRole("form", { name: "Xác nhận duyệt nhóm" });
  fireEvent.submit(form); fireEvent.submit(form);
  expect(posts()).toHaveLength(1);
  expect(screen.getByLabelText("Game")).toBeDisabled();
  expect(screen.getByRole("checkbox", { name: "Chọn câu q-a phiên bản 1" })).toBeDisabled();
  await act(async () => { release(); });
  expect(await screen.findByText("Đã xử lý: 2 thành công · 0 lỗi · 0 chưa rõ · 0 chưa gửi.")).toBeVisible();
  expect(posts()).toHaveLength(2);
});

it("hides stale actionable rows if the authoritative reload fails", async () => {
  bank([question("q-a")], { reloadFails: true });
  render(<QuestionBankAdmin />);
  await selectAll(); confirmReview(1);
  fireEvent.click(screen.getByRole("button", { name: "Xác nhận duyệt 1 câu" }));
  await waitFor(() => expect(screen.queryByRole("checkbox", { name: /Chọn câu q-a/ })).not.toBeInTheDocument());
  expect(screen.getByRole("button", { name: "Tải lại ngân hàng" })).toBeEnabled();
});

it("cancels an individual note prompt without sending a transition", async () => {
  const { posts } = bank([question("q-a")]);
  vi.spyOn(window, "prompt").mockReturnValue(null);
  render(<QuestionBankAdmin />);
  fireEvent.click(await screen.findByRole("button", { name: "Duyệt học thuật" }));
  expect(posts()).toHaveLength(0);
});
