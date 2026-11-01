import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { CompetitionAdmin } from "@/features/admin/ui/competition-admin";
import { QuestionBankAdmin } from "@/features/admin/ui/question-bank-admin";
import { RehearsalStudio } from "@/features/admin/ui/rehearsal-studio";
import { mapRpcError } from "@/features/arena/server/arena-service";
import { generateRehearsalFixtures } from "@/features/rehearsal/server/rehearsal-service";
import { RosterImport } from "@/features/roster/ui/roster-import";

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  document.cookie = "vnr_csrf=; max-age=0; path=/";
});

describe("Rehearsal isolation & server error mapping", () => {
  it("generates exactly 87 deterministic [GIẢ LẬP] fixture questions across all required pools", () => {
    const fixtures = generateRehearsalFixtures(20261030, "fx");
    expect(fixtures).toHaveLength(87);
    expect(fixtures.every((q) => q.prompt.startsWith("[GIẢ LẬP]"))).toBe(true);
    expect(fixtures.filter((q) => q.pool === "minefield_main" && q.difficulty === "easy")).toHaveLength(9);
    expect(fixtures.filter((q) => q.pool === "minefield_main" && q.difficulty === "medium")).toHaveLength(12);
    expect(fixtures.filter((q) => q.pool === "minefield_main" && q.difficulty === "hard")).toHaveLength(9);
    expect(fixtures.filter((q) => q.pool === "minefield_defuse" && q.difficulty === "easy")).toHaveLength(12);
    expect(fixtures.filter((q) => q.pool === "race" && q.difficulty === "easy")).toHaveLength(15);
    expect(fixtures.filter((q) => q.pool === "race" && q.difficulty === "medium")).toHaveLength(21);
    expect(fixtures.filter((q) => q.pool === "race" && q.difficulty === "hard")).toHaveLength(9);
  });

  it("maps rehearsal_account_forbidden, official_competition_protected and official_competition_currently_open", () => {
    const forbiddenAcc = mapRpcError({ code: "42501", message: "rehearsal_account_forbidden" });
    expect(forbiddenAcc.status).toBe(403);
    expect(forbiddenAcc.code).toBe("rehearsal_account_forbidden");

    const protectedComp = mapRpcError({ code: "42501", message: "official_competition_protected" });
    expect(protectedComp.status).toBe(403);
    expect(protectedComp.code).toBe("official_competition_protected");

    const openOfficial = mapRpcError({ code: "QA409", message: "official_competition_currently_open" });
    expect(openOfficial.status).toBe(409);
    expect(openOfficial.code).toBe("official_competition_currently_open");
  });
});

describe("RehearsalStudio closed-loop workflow", () => {
  it("provisions test accounts, opens a rehearsal round, displays leaderboards, and resets via a new round", async () => {
    document.cookie = "vnr_csrf=rehearsal-csrf; path=/";
    let roundNumber = 1;
    let attemptsCount = 2;
    let accounts = [
      { id: "u1", studentId: "THU001", fullName: "Thí Sinh Thử 01", displayName: "An N.V.", status: "active", updatedAt: "2026-11-01T10:00:00Z" },
    ];
    let minefieldEntries = [
      { rank: 1, entryId: "e1", displayName: "An N.V.", score: 85, correctCount: 8, hardCorrect: 2, completionDurationMs: 65000, progress: 10, state: "completed" },
    ];

    const fetcher = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url === "/api/v1/admin/rehearsal" && (!init?.method || init.method === "GET")) {
        return {
          ok: true,
          json: async () => ({
            data: {
              fixtureCount: 87,
              fixturesReady: true,
              officialOpen: false,
              activeRehearsal: {
                id: `reh-${roundNumber}`,
                publicId: `pub-${roundNumber}0000000`,
                name: `Phòng thi thử #${roundNumber}`,
                kind: "rehearsal",
                state: "open",
                standing: "provisional",
                opensAt: "2026-11-01T10:00:00Z",
                startDeadlineAt: "2026-11-01T13:00:00Z",
                finalizedAt: null,
                attempts: attemptsCount,
                active: 0,
                completed: attemptsCount,
                participants: attemptsCount,
              },
              rehearsalHistory: [],
              accounts,
              leaderboards: {
                minefield: { totalParticipants: minefieldEntries.length, entries: minefieldEntries },
                race: { totalParticipants: 0, entries: [] },
              },
            },
          }),
        };
      }
      if (url === "/api/v1/admin/rehearsal/accounts" && init?.method === "POST") {
        const body = JSON.parse(String(init.body)) as { count: number };
        accounts = Array.from({ length: body.count }, (_, idx) => ({
          id: `u-${idx + 1}`,
          studentId: `THU${String(idx + 1).padStart(3, "0")}`,
          fullName: `Thí Sinh Thử ${idx + 1}`,
          displayName: `Thử ${idx + 1}`,
          status: "active",
          updatedAt: "2026-11-01T10:05:00Z",
        }));
        return {
          ok: true,
          status: 201,
          json: async () => ({ data: { accounts, createdCount: body.count - 1, refreshedCount: 1 } }),
        };
      }
      if (url === "/api/v1/admin/rehearsal/rounds" && init?.method === "POST") {
        const prevId = `reh-${roundNumber}`;
        roundNumber += 1;
        attemptsCount = 0;
        minefieldEntries = [];
        return {
          ok: true,
          status: 201,
          json: async () => ({
            data: {
              id: `reh-${roundNumber}`,
              publicId: `pub-${roundNumber}0000000`,
              name: `Phòng thi thử #${roundNumber}`,
              closedRehearsalIds: [prevId],
            },
          }),
        };
      }
      return { ok: true, json: async () => ({ data: {} }) };
    });
    vi.stubGlobal("fetch", fetcher);

    render(<RehearsalStudio />);
    expect(await screen.findByText("Phòng thi thử #1")).toBeVisible();
    expect(screen.getByText("85")).toBeVisible();

    // Provision 3 test accounts
    const countInput = screen.getByLabelText("Số lượng tài khoản thử (1–30)");
    fireEvent.change(countInput, { target: { value: "3" } });
    fireEvent.click(screen.getByRole("button", { name: /Tạo \/ Làm mới 3 tài khoản thử/ }));
    expect(await screen.findByText("THU003")).toBeVisible();

    // Click "Chơi thử lại (Vòng diễn tập mới)" -> opens confirmation dialog -> confirm reset
    fireEvent.click(screen.getByRole("button", { name: "Chơi thử lại (Vòng diễn tập mới)" }));
    const dialog = screen.getByRole("dialog", { name: /Bắt đầu vòng “Chơi thử lại” mới/ });
    expect(dialog).toBeVisible();
    fireEvent.click(within(dialog).getByRole("button", { name: "Xác nhận mở vòng diễn tập mới" }));

    expect(await screen.findByText("Phòng thi thử #2")).toBeVisible();
    expect(screen.getAllByText(/Bảng xếp hạng đang trống/)).toHaveLength(2);
  });

  it("locks rehearsal opening/resetting when an official competition is currently open", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: true,
        json: async () => ({
          data: {
            fixtureCount: 87,
            fixturesReady: true,
            officialOpen: true,
            activeRehearsal: null,
            rehearsalHistory: [],
            accounts: [],
            leaderboards: null,
          },
        }),
      })),
    );
    render(<RehearsalStudio />);
    expect(await screen.findByText(/Đang có cuộc thi chính thức mở!/)).toBeVisible();
    expect(screen.getByRole("button", { name: "Mở buổi thi thử ngay" })).toBeDisabled();
  });
});

describe("CompetitionAdmin operational UX & safety", () => {
  it("does not auto-select an unopened official competition when multiple competitions exist, and requires a confirmation modal to open an official competition", async () => {
    document.cookie = "vnr_csrf=admin-csrf; path=/";
    const postCalls: Array<{ url: string; body: unknown }> = [];

    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = String(input);
        if (init?.method === "POST") {
          postCalls.push({ url, body: JSON.parse(String(init.body)) });
          return { ok: true, json: async () => ({ data: { state: "open" } }) };
        }
        if (url.endsWith("/admin/competitions")) {
          return {
            ok: true,
            json: async () => ({
              data: [
                {
                  id: "off-1",
                  publicId: "pub-off-1",
                  name: "VNR202 · Buổi chơi 02/11/2026",
                  kind: "official",
                  state: "scheduled",
                  standing: "official",
                  opensAt: "2026-11-02T08:00:00Z",
                  startDeadlineAt: "2026-11-02T09:00:00Z",
                  finalizedAt: null,
                  attempts: 0,
                  active: 0,
                },
                {
                  id: "reh-1",
                  publicId: "pub-reh-1",
                  name: "Phòng thi thử #1",
                  kind: "rehearsal",
                  state: "settling",
                  standing: "provisional",
                  opensAt: "2026-11-01T08:00:00Z",
                  startDeadlineAt: "2026-11-01T09:00:00Z",
                  finalizedAt: null,
                  attempts: 4,
                  active: 0,
                },
              ],
            }),
          };
        }
        if (url.includes("/readiness?")) {
          return {
            ok: true,
            json: async () => ({
              data: { ready: true, blockers: [], classSize: 39, target: { expectedAttempts: 39, meetsTarget: true, maxPerQuestion: 7 }, games: {} },
            }),
          };
        }
        if (url.endsWith("/monitor")) {
          return {
            ok: true,
            json: async () => ({
              data: {
                attempts: [
                  {
                    attemptId: "att-1",
                    profileId: "p-1",
                    game: "minefield",
                    state: "active",
                    studentId: "SE18001",
                    accountStatus: "active",
                    displayName: "An N.V.",
                    score: 40,
                    mainAnswered: 4,
                    mainTotal: 10,
                    mainCorrect: 4,
                    startedAt: "2026-11-02T08:01:00Z",
                    remainingMs: 120000,
                    completionDurationMs: null,
                    heartbeatAgoMs: 32000,
                    deviceTransfers: 0,
                    timeouts: 1,
                    pendingQuestion: true,
                    incidents: [],
                  },
                  {
                    attemptId: "att-2",
                    profileId: "p-2",
                    game: "race",
                    state: "completed",
                    studentId: "SE18002",
                    accountStatus: "active",
                    displayName: "Bình T.T.",
                    score: 110,
                    mainAnswered: 15,
                    mainTotal: 15,
                    mainCorrect: 12,
                    startedAt: "2026-11-02T08:01:00Z",
                    remainingMs: 0,
                    completionDurationMs: 95000,
                    heartbeatAgoMs: 3000,
                    deviceTransfers: 0,
                    timeouts: 0,
                    pendingQuestion: false,
                    incidents: [],
                  },
                ],
              },
            }),
          };
        }
        if (url.endsWith("/audit")) return { ok: true, json: async () => ({ data: [] }) };
        return { ok: true, json: async () => ({ data: { questions: [] } }) };
      }),
    );

    render(<CompetitionAdmin />);

    // Wait for list to load; verify it did NOT auto-select the unopened official competition
    expect(await screen.findByRole("button", { name: /VNR202 · Buổi chơi 02\/11\/2026/ })).toBeVisible();
    expect(screen.getByText(/Chưa chọn cuộc thi điều hành/)).toBeVisible();

    // Explicitly select the official competition
    fireEvent.click(screen.getByRole("button", { name: /VNR202 · Buổi chơi 02\/11\/2026/ }));

    // Clicking "Mở cuộc thi" on an official competition opens the confirmation modal first without firing POST
    const openBtn = await screen.findByRole("button", { name: /Mở cuộc thi/ });
    fireEvent.click(openBtn);
    expect(postCalls).toHaveLength(0);

    const dialog = screen.getByRole("dialog", { name: "Xác nhận mở cuộc thi chính thức?" });
    expect(within(dialog).getByText("VNR202 · Buổi chơi 02/11/2026")).toBeVisible();
    expect(within(dialog).getByText("Chính thức (Official)")).toBeVisible();
    expect(within(dialog).getByText(/39 sinh viên/)).toBeVisible();
    expect(within(dialog).getByText("60 phút")).toBeVisible();

    // Confirm inside the modal
    fireEvent.click(within(dialog).getByRole("button", { name: "Xác nhận mở cuộc thi chính thức" }));
    await waitFor(() => expect(postCalls).toHaveLength(1));
    expect(postCalls[0]).toEqual({
      url: "/api/v1/admin/competitions/off-1/transitions",
      body: { target: "open", startWindowMinutes: 60 },
    });

    // Verify monitor search & connection warning filter
    expect(screen.getByText(/mất 32 s/)).toBeVisible();
    fireEvent.change(screen.getByPlaceholderText("Nhập MSSV hoặc tên hiển thị..."), {
      target: { value: "SE18002" },
    });
    expect(screen.queryByText("An N.V.")).not.toBeInTheDocument();
    expect(screen.getByText("Bình T.T.")).toBeVisible();
  });
});

describe("QuestionBankAdmin & RosterImport enhancements", () => {
  it("filters questions by difficulty and search keyword", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) => {
        if (url.includes("/question-bank/readiness")) {
          return { ok: true, json: async () => ({ data: { ready: true, blockers: [], target: { meetsTarget: true, expectedAttempts: 60 } } }) };
        }
        return {
          ok: true,
          json: async () => ({
            data: [
              {
                id: "1",
                external_key: "q-doi-moi",
                current_version_id: "v1",
                game_type: "race",
                pool: "race",
                chapter: "chapter_2",
                topic: "Đại hội VI",
                question_type: "single_choice",
                difficulty: "hard",
                origin: "bank",
                question_versions: [
                  {
                    id: "v1",
                    version: 1,
                    status: "published",
                    ai_assisted: false,
                    retired_at: null,
                    content_public: { prompt: "Đại hội VI năm 1986 mở ra thời kỳ nào?", options: [{ id: "a", label: "Đổi mới" }, { id: "b", label: "Bao cấp" }] },
                    content_private: { correctOptionId: "a", explanation: "Giải thích" },
                    question_source_links: [],
                  },
                ],
              },
              {
                id: "2",
                external_key: "q-co-ban",
                current_version_id: "v2",
                game_type: "race",
                pool: "race",
                chapter: "chapter_1",
                topic: "Cương lĩnh",
                question_type: "single_choice",
                difficulty: "easy",
                origin: "bank",
                question_versions: [
                  {
                    id: "v2",
                    version: 1,
                    status: "published",
                    ai_assisted: false,
                    retired_at: null,
                    content_public: { prompt: "Câu hỏi dễ về cương lĩnh", options: [{ id: "a", label: "A" }, { id: "b", label: "B" }] },
                    content_private: { correctOptionId: "a", explanation: "Giải thích" },
                    question_source_links: [],
                  },
                ],
              },
            ],
          }),
        };
      }),
    );

    render(<QuestionBankAdmin />);
    expect(await screen.findByText("q-doi-moi")).toBeVisible();
    expect(screen.getByText("q-co-ban")).toBeVisible();

    fireEvent.change(screen.getByLabelText("Độ khó"), { target: { value: "hard" } });
    expect(screen.getByText("q-doi-moi")).toBeVisible();
    expect(screen.queryByText("q-co-ban")).not.toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("Tìm kiếm câu hỏi"), { target: { value: "không tồn tại" } });
    expect(await screen.findByText("Không có câu hỏi phù hợp.")).toBeVisible();
  });

  it("displays the official student directory and executes classroom support actions with audit reason", async () => {
    document.cookie = "vnr_csrf=roster-csrf; path=/";
    const postCalls: Array<{ url: string; body: unknown }> = [];

    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = String(input);
        if (init?.method === "POST" || init?.method === "PATCH") {
          postCalls.push({ url, body: JSON.parse(String(init.body)) });
          return { ok: true, json: async () => ({ data: { reset: true } }) };
        }
        return {
          ok: true,
          json: async () => ({
            data: {
              classInfo: { id: "c1", code: "VNR202", name: "Lớp Lịch sử Đảng" },
              students: [
                {
                  id: "00000000-0000-4000-8000-000000000001",
                  student_id: "SE180101",
                  full_name: "Nguyễn Văn An",
                  display_name: "An N.V.",
                  display_name_suffix: null,
                  status: "active",
                  updated_at: "2026-11-01T10:00:00Z",
                },
              ],
            },
          }),
        };
      }),
    );

    render(<RosterImport />);
    expect(await screen.findByText("SE180101")).toBeVisible();
    expect(screen.getByText("Nguyễn Văn An")).toBeVisible();

    fireEvent.click(screen.getByRole("button", { name: "Đặt lại MK" }));
    const dialog = screen.getByRole("dialog", { name: "Đặt lại mật khẩu mặc định" });
    expect(dialog).toBeVisible();
    fireEvent.click(within(dialog).getByRole("button", { name: "Xác nhận thực hiện" }));

    await waitFor(() => expect(postCalls).toHaveLength(1));
    expect(postCalls[0]).toEqual({
      url: "/api/v1/admin/profiles/00000000-0000-4000-8000-000000000001/password-resets",
      body: { reason: "Hỗ trợ đặt lại mật khẩu mặc định tại lớp" },
    });
  });
});
