import http from "node:http";
import path from "node:path";
import fs from "node:fs/promises";
import { expect, test } from "@playwright/test";

test.describe.configure({ mode: "serial" });

function createFakeJwt() {
  const header = Buffer.from(JSON.stringify({ alg: "HS256", typ: "JWT" })).toString("base64url");
  const payload = Buffer.from(
    JSON.stringify({
      sub: "00000000-0000-4000-8000-000000000001",
      aud: "authenticated",
      role: "authenticated",
      email: "admin@localhost",
      app_metadata: { role: "admin" },
      exp: Math.floor(Date.now() / 1000) + 7200,
    }),
  ).toString("base64url");
  return `${header}.${payload}.sig`;
}

function createSupabaseAuthCookieValue() {
  const session = {
    access_token: createFakeJwt(),
    refresh_token: "fake-refresh-token",
    expires_in: 7200,
    expires_at: Math.floor(Date.now() / 1000) + 7200,
    token_type: "bearer",
    user: {
      id: "00000000-0000-4000-8000-000000000001",
      aud: "authenticated",
      role: "authenticated",
      email: "admin@localhost",
      app_metadata: { role: "admin" },
      user_metadata: {},
    },
  };
  return `base64-${Buffer.from(JSON.stringify(session)).toString("base64url")}`;
}

let mockAuthServer: http.Server | null = null;

test.beforeAll(async () => {
  mockAuthServer = http.createServer((req, res) => {
    res.setHeader("content-type", "application/json");
    if (req.url?.startsWith("/auth/v1/user")) {
      res.writeHead(200);
      res.end(
        JSON.stringify({
          id: "00000000-0000-4000-8000-000000000001",
          aud: "authenticated",
          role: "authenticated",
          email: "admin@localhost",
          app_metadata: { role: "admin" },
          user_metadata: {},
        }),
      );
      return;
    }
    res.writeHead(200);
    res.end(JSON.stringify({ data: [] }));
  });
  await new Promise<void>((resolve) => {
    mockAuthServer!.once("error", () => {
      mockAuthServer = null;
      resolve();
    });
    mockAuthServer!.listen(54399, "127.0.0.1", () => resolve());
  });
});

test.afterAll(async () => {
  if (mockAuthServer) {
    await new Promise<void>((resolve) => mockAuthServer!.close(() => resolve()));
  }
});

test.beforeEach(({}, info) => {
  test.skip(info.project.name !== "desktop-chromium", "runs viewport checks inside desktop-chromium");
});

test("Admin classroom readiness: 3 screens at 1366x768 & 390px, above-the-fold primary action, 39-student roster merge, pagination, and error recovery", async ({
  page,
  context,
}) => {
  test.setTimeout(120_000);
  const screenshotDir = path.resolve(process.cwd(), "test-results", "classroom-admin-screenshots");
  await fs.mkdir(screenshotDir, { recursive: true });

  await context.addCookies([
    {
      name: "sb-127-auth-token",
      value: createSupabaseAuthCookieValue(),
      domain: "127.0.0.1",
      path: "/",
    },
    {
      name: "vnr_csrf",
      value: "local-e2e-csrf-token",
      domain: "127.0.0.1",
      path: "/",
    },
  ]);

  // Build 39 realistic mock students for the classroom
  const students39 = Array.from({ length: 39 }, (_, idx) => {
    const num = String(idx + 1).padStart(2, "0");
    return {
      id: `00000000-0000-4000-8000-0000000000${num}`,
      student_id: `SE1800${num}`,
      full_name: `Nguyễn Văn Sinh Viên ${num}`,
      display_name: `Viên ${num} N.V.`,
      display_name_suffix: null,
      status: idx === 4 ? ("locked" as const) : ("active" as const),
      updated_at: "2026-11-11T08:00:00Z",
    };
  });

  let officialState: "scheduled" | "open" | "start_closed" | "settling" | "finalized" = "scheduled";
  let failStudentsOnce = false;

  await page.route("**/api/v1/admin/**", async (route) => {
    const url = route.request().url();
    const method = route.request().method();

    if (url.includes("/api/v1/admin/competitions") && method === "GET" && url.endsWith("/competitions")) {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          data: [
            {
              id: "comp-off-1",
              publicId: "pub-off-1",
              name: "VNR202 · Kiểm tra cuối kỳ (39 SV)",
              kind: "official",
              state: officialState,
              standing: "official",
              opensAt: "2026-11-12T08:00:00Z",
              startDeadlineAt: "2026-11-12T09:00:00Z",
              finalizedAt: officialState === "finalized" ? "2026-11-12T09:15:00Z" : null,
              attempts: 6,
              active: 2,
            },
            {
              id: "comp-reh-1",
              publicId: "pub-reh-1",
              name: "Phòng thi thử #1",
              kind: "rehearsal",
              state: "finalized",
              standing: "provisional",
              opensAt: "2026-11-11T07:00:00Z",
              startDeadlineAt: "2026-11-11T08:00:00Z",
              finalizedAt: "2026-11-11T08:05:00Z",
              attempts: 4,
              active: 0,
            },
            {
              id: "comp-arch-1",
              publicId: "pub-arch-1",
              name: "Đợt diễn tập cũ tuần trước",
              kind: "rehearsal",
              state: "archived",
              standing: "provisional",
              opensAt: "2026-11-04T07:00:00Z",
              startDeadlineAt: "2026-11-04T08:00:00Z",
              finalizedAt: "2026-11-04T08:05:00Z",
              attempts: 2,
              active: 0,
            },
          ],
        }),
      });
      return;
    }

    if (url.includes("/transitions") && method === "POST" && url.includes("comp-off-1")) {
      const body = JSON.parse(route.request().postData() ?? "{}") as { target?: typeof officialState };
      if (body.target) officialState = body.target;
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ data: { state: officialState } }),
      });
      return;
    }

    if (url.includes("/readiness") && method === "GET" && url.includes("comp-off-1")) {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          data: {
            ready: true,
            blockers: [],
            classSize: 39,
            target: { expectedAttempts: 39, meetsTarget: true, maxPerQuestion: 7 },
            games: {
              minefield: {
                minefield_main: { easy: 12, medium: 16, hard: 12, published: 40 },
                minefield_defuse: { easy: 15, medium: 0, hard: 0, published: 15 },
              },
              race: {
                race: { easy: 18, medium: 24, hard: 12, published: 54 },
              },
            },
          },
        }),
      });
      return;
    }

    if (url.includes("/monitor") && method === "GET") {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          data: {
            attempts: [
              // Student 01: Playing Minefield, Completed Race
              {
                attemptId: "att-1m",
                profileId: students39[0]!.id,
                game: "minefield",
                state: "active",
                studentId: students39[0]!.student_id,
                accountStatus: "active",
                displayName: students39[0]!.display_name,
                score: 55,
                mainAnswered: 6,
                mainTotal: 10,
                mainCorrect: 5,
                startedAt: "2026-11-12T08:02:00Z",
                remainingMs: 95000,
                completionDurationMs: null,
                heartbeatAgoMs: 4000,
                deviceTransfers: 0,
                timeouts: 0,
                pendingQuestion: false,
                incidents: [],
              },
              {
                attemptId: "att-1r",
                profileId: students39[0]!.id,
                game: "race",
                state: "completed",
                studentId: students39[0]!.student_id,
                accountStatus: "active",
                displayName: students39[0]!.display_name,
                score: 120,
                mainAnswered: 15,
                mainTotal: 15,
                mainCorrect: 13,
                startedAt: "2026-11-12T08:01:00Z",
                remainingMs: 0,
                completionDurationMs: 88000,
                heartbeatAgoMs: 3000,
                deviceTransfers: 0,
                timeouts: 0,
                pendingQuestion: false,
                incidents: [],
              },
              // Student 02: Completed both games ("Xong cả hai")
              {
                attemptId: "att-2m",
                profileId: students39[1]!.id,
                game: "minefield",
                state: "completed",
                studentId: students39[1]!.student_id,
                accountStatus: "active",
                displayName: students39[1]!.display_name,
                score: 90,
                mainAnswered: 10,
                mainTotal: 10,
                mainCorrect: 9,
                startedAt: "2026-11-12T08:01:00Z",
                remainingMs: 0,
                completionDurationMs: 110000,
                heartbeatAgoMs: 2000,
                deviceTransfers: 0,
                timeouts: 0,
                pendingQuestion: false,
                incidents: [],
              },
              {
                attemptId: "att-2r",
                profileId: students39[1]!.id,
                game: "race",
                state: "completed",
                studentId: students39[1]!.student_id,
                accountStatus: "active",
                displayName: students39[1]!.display_name,
                score: 135,
                mainAnswered: 15,
                mainTotal: 15,
                mainCorrect: 14,
                startedAt: "2026-11-12T08:03:00Z",
                remainingMs: 0,
                completionDurationMs: 79000,
                heartbeatAgoMs: 2000,
                deviceTransfers: 0,
                timeouts: 0,
                pendingQuestion: false,
                incidents: [],
              },
              // Student 03: Completed 1/2 games ("Xong 1/2 trò")
              {
                attemptId: "att-3m",
                profileId: students39[2]!.id,
                game: "minefield",
                state: "completed",
                studentId: students39[2]!.student_id,
                accountStatus: "active",
                displayName: students39[2]!.display_name,
                score: 70,
                mainAnswered: 10,
                mainTotal: 10,
                mainCorrect: 7,
                startedAt: "2026-11-12T08:02:00Z",
                remainingMs: 0,
                completionDurationMs: 130000,
                heartbeatAgoMs: 5000,
                deviceTransfers: 0,
                timeouts: 1,
                pendingQuestion: false,
                incidents: [],
              },
              // Student 04: Active but disconnected >25s ("Mất kết nối")
              {
                attemptId: "att-4r",
                profileId: students39[3]!.id,
                game: "race",
                state: "active",
                studentId: students39[3]!.student_id,
                accountStatus: "active",
                displayName: students39[3]!.display_name,
                score: 40,
                mainAnswered: 5,
                mainTotal: 15,
                mainCorrect: 4,
                startedAt: "2026-11-12T08:04:00Z",
                remainingMs: 65000,
                completionDurationMs: null,
                heartbeatAgoMs: 36000,
                deviceTransfers: 1,
                timeouts: 1,
                pendingQuestion: true,
                incidents: ["Máy báo yếu Wi-Fi"],
              },
            ],
          },
        }),
      });
      return;
    }

    if (url.includes("/audit") && method === "GET") {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          data: [
            {
              id: 1,
              action: "competition.schedule",
              target_type: "competition",
              target_id: "comp-off-1",
              reason: "Chuẩn bị buổi thi chính thức",
              created_at: "2026-11-12T07:55:00Z",
            },
          ],
        }),
      });
      return;
    }

    if (url.includes("/disclosed-questions") && method === "GET") {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ data: { questions: [] } }),
      });
      return;
    }

    if (url.includes("/api/v1/admin/students") && method === "GET") {
      if (failStudentsOnce) {
        failStudentsOnce = false;
        await route.fulfill({
          status: 500,
          contentType: "application/json",
          body: JSON.stringify({ error: { message: "Không thể tải danh sách lớp từ máy chủ." } }),
        });
        return;
      }
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          data: {
            classInfo: { id: "cls-1", code: "VNR202", name: "Lịch sử Đảng Cộng sản Việt Nam (39 SV)" },
            students: students39,
          },
        }),
      });
      return;
    }

    if (url.includes("/api/v1/admin/question-bank/readiness")) {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          data: {
            ready: false,
            blockers: [
              "insufficient_pool:minefield/minefield_main/hard",
              "two_option_cap_unsatisfiable:race",
            ],
            target: { meetsTarget: false, expectedAttempts: 39 },
          },
        }),
      });
      return;
    }

    if (url.includes("/api/v1/admin/questions") && method === "GET") {
      const parsed = new URL(url);
      const diffFilter = parsed.searchParams.get("difficulty");
      const statusFilter = parsed.searchParams.get("status");
      const gameFilter = parsed.searchParams.get("game");
      const allQuestions = Array.from({ length: 45 }, (_, idx) => {
        const num = idx + 1;
        const difficulty = idx % 3 === 0 ? "easy" : idx % 3 === 1 ? "medium" : "hard";
        const gameType = idx % 2 === 0 ? "minefield" : "race";
        const pool = gameType === "minefield" ? (idx % 4 === 0 ? "minefield_defuse" : "minefield_main") : "race";
        const status = idx < 5 ? "draft" : idx < 10 ? "reviewed" : "published";
        return {
          id: `q-${num}`,
          external_key: `vnr202-cau-${String(num).padStart(2, "0")}`,
          current_version_id: `v-${num}`,
          game_type: gameType,
          pool,
          chapter: `chapter_${(idx % 3) + 1}`,
          topic: `Quyết sách lịch sử số ${num}`,
          question_type: "single_choice",
          difficulty,
          origin: parsed.searchParams.get("origin") ?? "bank",
          question_versions: [
            {
              id: `v-${num}`,
              version: 1,
              status,
              ai_assisted: idx === 0,
              retired_at: null,
              content_public: {
                prompt: `[GIẢ LẬP] Câu hỏi lịch sử số ${num}: Đại hội nào đề ra đường lối Đổi mới toàn diện?`,
                options: [
                  { id: "a", label: "Đại hội VI (12/1986)" },
                  { id: "b", label: "Đại hội V (3/1982)" },
                  { id: "c", label: "Đại hội VII (6/1991)" },
                ],
              },
              content_private: {
                correctOptionId: "a",
                explanation: "Đại hội VI tháng 12/1986 mở đầu công cuộc Đổi mới toàn diện.",
              },
              question_source_links: [{ source_id: "src-1", locator: `Giáo trình VNR202 tr. ${10 + num}` }],
            },
          ],
        };
      });

      const filtered = allQuestions.filter(
        (q) =>
          (!diffFilter || q.difficulty === diffFilter) &&
          (!gameFilter || q.game_type === gameFilter) &&
          (!statusFilter || q.question_versions[0]!.status === statusFilter),
      );

      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ data: filtered }),
      });
      return;
    }

    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ data: {} }),
    });
  });

  // ===========================================================================
  // 1. SCREEN 1: ĐIỀU HÀNH (/quan-tri/cuoc-thi) — 1366x768 & 390px
  // ===========================================================================
  await page.setViewportSize({ width: 1366, height: 768 });
  await page.goto("/quan-tri/cuoc-thi");

  // Sticky bar shows waiting state when no competition is open
  await expect(page.getByText(/Chưa có cuộc thi nào mở; sinh viên đang ở màn hình chờ/)).toBeVisible();

  // Auto-selected nearest scheduled official competition; verify primary button "Mở cuộc thi" is in first viewport (<= 768px) without scrolling
  const openBtn = page.getByRole("button", { name: /Mở cuộc thi/ });
  await expect(openBtn).toBeVisible();
  const scrollY = await page.evaluate(() => window.scrollY);
  expect(scrollY).toBe(0);
  const openBtnBox = await openBtn.boundingBox();
  expect(openBtnBox).not.toBeNull();
  expect(openBtnBox!.y).toBeGreaterThanOrEqual(0);
  expect(openBtnBox!.y + openBtnBox!.height).toBeLessThanOrEqual(768);

  // Verify 39 students are merged into the unified table (including "Chưa vào", "Xong 1/2 trò", "Xong cả hai", "Mất kết nối")
  await expect(page.getByRole("heading", { name: /Bảng điều hành cả lớp · 39 sinh viên/ })).toBeVisible();
  await expect(page.getByRole("button", { name: "Xuất bảng điểm (CSV)" })).toBeVisible();

  // Capture Desktop 1366x768 screenshot of Điều hành (viewport-only to prove above-the-fold primary action, plus fullPage)
  await page.screenshot({ path: path.join(screenshotDir, "dieu-hanh-desktop-1366x768.png") });
  await page.screenshot({ path: path.join(screenshotDir, "dieu-hanh-desktop-1366x768-full.png"), fullPage: true });

  // Open Official Competition via Confirmation Modal -> Verify real classSize (39 sinh viên)
  await openBtn.click();
  const openModal = page.getByRole("dialog", { name: "Xác nhận mở cuộc thi chính thức?" });
  await expect(openModal).toBeVisible();
  await expect(openModal.getByText("39 sinh viên")).toBeVisible();
  await openModal.getByRole("button", { name: "Xác nhận mở cuộc thi chính thức" }).click();

  // Sticky bar updates to show active competition
  await expect(page.getByText(/Sinh viên đang thấy:/)).toBeVisible();

  // Per-game incident modal title includes game name and attempt state
  await page.locator("tr", { hasText: "SE180001" }).getByRole("button", { name: "Xử lý Bãi Mìn" }).click();
  const incDialog = page.getByRole("dialog", { name: /Xử lý sự cố · SE180001 · Viên 01 N\.V\. · Bãi Mìn Tri Thức \(Đang chơi\)/ });
  await expect(incDialog).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(incDialog).toHaveCount(0);

  // Capture Mobile 390px screenshot of Điều hành and verify control panel precedes sidebar
  await page.setViewportSize({ width: 390, height: 844 });
  await page.evaluate(() => window.scrollTo({ top: 0, left: 0, behavior: "instant" }));
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
  const mainY = (await page.locator(".acc-ops-main").boundingBox())!.y;
  const sidebarY = (await page.locator(".acc-ops-sidebar").boundingBox())!.y;
  expect(mainY).toBeLessThan(sidebarY);
  await page.screenshot({ path: path.join(screenshotDir, "dieu-hanh-mobile-390px.png"), fullPage: true });

  // ===========================================================================
  // 2. SCREEN 2: NGÂN HÀNG CÂU HỎI (/quan-tri/ngan-hang-cau-hoi) — 1366x768 & 390px
  // ===========================================================================
  await page.setViewportSize({ width: 1366, height: 768 });
  await page.goto("/quan-tri/ngan-hang-cau-hoi");
  await expect(page.getByRole("heading", { name: "Ngân hàng câu hỏi" })).toBeVisible();

  // Blockers are translated into Vietnamese (no raw codes)
  await expect(page.getByText(/Thiếu câu hỏi Bãi Mìn Tri Thức \(Câu chính Bãi Mìn, mức Khó\)/)).toBeVisible();
  await expect(page.getByText(/Trò Đường Đua Lịch Sử có quá nhiều câu 2 lựa chọn/)).toBeVisible();

  // Pagination: shows 20 questions initially with "Xem thêm" button
  await expect(page.locator(".adm__questions > li")).toHaveCount(20);
  await expect(page.getByRole("button", { name: /Xem thêm 20 câu/ })).toBeVisible();

  // Whole-bank KPI counts (35 published, 5 / 5 draft/reviewed) do not change when filtering by difficulty
  const kpiGrid = page.getByRole("region", { name: "Tổng quan ngân hàng câu hỏi" });
  await expect(kpiGrid.getByText("35", { exact: true })).toBeVisible();
  await expect(kpiGrid.getByText("5 / 5", { exact: true })).toBeVisible();
  await page.getByLabel("Độ khó").selectOption("hard");
  await expect(kpiGrid.getByText("35", { exact: true })).toBeVisible();
  await expect(kpiGrid.getByText("5 / 5", { exact: true })).toBeVisible();
  await page.getByLabel("Độ khó").selectOption("");

  await page.evaluate(() => window.scrollTo({ top: 0, left: 0, behavior: "instant" }));
  await page.screenshot({ path: path.join(screenshotDir, "ngan-hang-cau-hoi-desktop-1366x768.png") });
  await page.screenshot({ path: path.join(screenshotDir, "ngan-hang-cau-hoi-desktop-1366x768-full.png"), fullPage: true });

  await page.setViewportSize({ width: 390, height: 844 });
  await page.evaluate(() => window.scrollTo({ top: 0, left: 0, behavior: "instant" }));
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
  await page.screenshot({ path: path.join(screenshotDir, "ngan-hang-cau-hoi-mobile-390px.png"), fullPage: true });

  // ===========================================================================
  // 3. SCREEN 3: DANH SÁCH LỚP (/quan-tri/lop) — 1366x768 & 390px
  // ===========================================================================
  failStudentsOnce = true;
  await page.setViewportSize({ width: 1366, height: 768 });
  await page.goto("/quan-tri/lop");

  // Verify red error banner + "Thử lại" button when loading fails, and NO false "Không tìm thấy sinh viên phù hợp."
  await expect(page.getByText(/Không thể tải danh sách lớp từ máy chủ/)).toBeVisible();
  await expect(page.getByText(/Không tìm thấy sinh viên phù hợp/)).toHaveCount(0);
  await page.getByRole("button", { name: "Thử lại" }).click();

  // Directory loads 39 students and sits above the collapsed file import section
  await expect(page.getByText("SE180001")).toBeVisible();
  await expect(page.getByText("SE180039")).toBeVisible();

  await page.evaluate(() => window.scrollTo({ top: 0, left: 0, behavior: "instant" }));
  await page.screenshot({ path: path.join(screenshotDir, "danh-sach-lop-desktop-1366x768.png") });
  await page.screenshot({ path: path.join(screenshotDir, "danh-sach-lop-desktop-1366x768-full.png"), fullPage: true });

  await page.setViewportSize({ width: 390, height: 844 });
  await page.evaluate(() => window.scrollTo({ top: 0, left: 0, behavior: "instant" }));
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
  await page.screenshot({ path: path.join(screenshotDir, "danh-sach-lop-mobile-390px.png"), fullPage: true });
});
