import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { Passport } from "@/features/passport/passport";

afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

it("shows the student's official results without counting rehearsals", async () => {
  vi.stubGlobal("fetch", vi.fn(async (url: string) => ({ ok: true, json: async () => ({ data: url.endsWith("/me")
    ? { role: "student", fullName: "Nguyễn Văn An", displayName: "An N.V.", studentId: "001" }
    : url.endsWith("/passport/progress") ? [] : [
      { attemptId: "r", game: "race", state: "completed", score: 999, competition: { id: "r", name: "Diễn tập", kind: "rehearsal", standing: "rehearsal" }, reviewAvailable: true },
      { attemptId: "o", game: "minefield", state: "completed", score: 200, mainCorrect: 2, mainTotal: 10, hardCorrect: 1, rank: 1, competition: { id: "o", name: "Cuộc thi A", kind: "official", standing: "official" }, reviewAvailable: true },
    ] }) })));
  render(<Passport dossiers={[]} />);
  expect(await screen.findByText("Nguyễn Văn An")).toBeInTheDocument();
  expect(screen.getByText(/200 điểm/)).toBeInTheDocument();
  expect(screen.queryByText(/999 điểm/)).not.toBeInTheDocument();
  expect(screen.getByText(/Hạng 1/)).toBeInTheDocument();
});

it("requires sign-in instead of showing private results", async () => {
  vi.stubGlobal("fetch", vi.fn(async () => ({ ok: false, status: 401, json: async () => ({ error: { code: "unauthenticated", message: "Đăng nhập" } }) })));
  render(<Passport dossiers={[]} />);
  expect(await screen.findByRole("link", { name: "đăng nhập" })).toHaveAttribute("href", "/dang-nhap");
});

it("labels an unfinished official competition provisional and does not link to review", async () => {
  vi.stubGlobal("fetch", vi.fn(async (url: string) => ({ ok: true, json: async () => ({ data: url.endsWith("/me")
    ? { role: "student", fullName: "An" }
    : url.endsWith("/passport/progress") ? [] : [{ attemptId: "o", game: "race", state: "completed", score: 100, competition: { id: "o", name: "Cuộc thi", kind: "official", standing: "provisional" }, reviewAvailable: false }] }) })));
  render(<Passport dossiers={[]} />);
  expect(await screen.findByText(/Tạm thời/)).toBeInTheDocument();
  expect(screen.queryByRole("link", { name: "Xem lại đáp án" })).not.toBeInTheDocument();
});
