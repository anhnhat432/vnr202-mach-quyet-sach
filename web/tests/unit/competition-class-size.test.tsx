import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { CompetitionAdmin } from "@/features/admin/ui/competition-admin";
import { QuestionBankAdmin } from "@/features/admin/ui/question-bank-admin";

afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

it("warns an administrator when expected attendance differs from the active roster", async () => {
  vi.stubGlobal("fetch", vi.fn(async (url: string) => {
    const data = url.endsWith("/admin/competitions")
      ? [{ id: "a", name: "Thi thử", kind: "official", state: "draft", standing: "provisional", attempts: 0, active: 0, startDeadlineAt: "2030-01-01T00:00:00Z" }]
      : url.includes("/readiness?") ? { ready: true, blockers: [], classSize: 42, target: { expectedAttempts: 60, meetsTarget: false, maxPerQuestion: 10 }, games: {} }
      : url.endsWith("/monitor") ? { attempts: [] } : url.endsWith("/audit") ? [] : { questions: [] };
    return { ok: true, json: async () => ({ data }) };
  }));
  render(<CompetitionAdmin />);
  expect(await screen.findByText(/Danh sách lớp hiện có 42 sinh viên, khác sĩ số dự kiến 60/)).toHaveAttribute("role", "alert");
});

it("keeps GIẢ LẬP fixture rows when the initial bank query finishes after switching the origin filter", async () => {
  let resolveBank: ((value: unknown) => void) | null = null;
  vi.stubGlobal("fetch", vi.fn((url: string) => {
    if (url.includes("/admin/questions?origin=bank")) {
      return new Promise((resolve) => {
        resolveBank = () => resolve({ ok: true, json: async () => ({ data: [] }) });
      });
    }
    if (url.includes("/admin/questions?origin=fixture")) {
      return Promise.resolve({
        ok: true,
        json: async () => ({
          data: [{
            id: "fx-1", external_key: "fx-race-1", game_type: "race", pool: "race", chapter: "chapter_1", topic: "Thử", question_type: "single_choice", difficulty: "easy", origin: "fixture",
            question_versions: [{ id: "v-1", version: 1, status: "published", ai_assisted: false, retired_at: null, content_public: { prompt: "[GIẢ LẬP] Câu thử", options: [{ id: "a", label: "Đáp án A" }, { id: "b", label: "Đáp án B" }] }, content_private: { correctOptionId: "a", explanation: "Giải thích" }, question_source_links: [] }],
          }],
        }),
      });
    }
    return Promise.resolve({ ok: true, json: async () => ({ data: { ready: false, blockers: ["insufficient_pool:race/easy"], target: { meetsTarget: false, expectedAttempts: 60 } } }) });
  }));
  render(<QuestionBankAdmin />);
  await act(async () => { await new Promise((r) => setTimeout(r, 10)); });
  fireEvent.change(screen.getByLabelText("Nguồn"), { target: { value: "fixture" } });
  expect(await screen.findByText("GIẢ LẬP")).toBeVisible();
  await act(async () => { resolveBank?.(undefined); await new Promise((r) => setTimeout(r, 10)); });
  expect(screen.getByText("GIẢ LẬP")).toBeVisible();
});
