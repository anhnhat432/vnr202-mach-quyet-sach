import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { CompetitionAdmin } from "@/features/admin/ui/competition-admin";

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
