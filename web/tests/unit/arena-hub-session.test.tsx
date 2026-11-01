import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { ArenaHub } from "@/features/arena/ui/arena-hub";
import { ArenaApiError, arenaApi } from "@/features/arena/client/api";
vi.mock("@/features/arena/client/api", async original => ({ ...await original<typeof import("@/features/arena/client/api")>(), arenaApi: { lobby: vi.fn() } }));
afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.resetAllMocks(); });
it("gives administrators a usable admin link instead of unusable student start links", async () => {
  vi.mocked(arenaApi.lobby).mockRejectedValue(new ArenaApiError(403, "forbidden", "Chỉ sinh viên mới chơi được."));
  render(<ArenaHub />);
  await screen.findByText(/Tài khoản này không có quyền/);
  expect(screen.getByRole("link", { name: "Vào quản trị" })).toHaveAttribute("href", "/quan-tri/cuoc-thi");
  expect(screen.queryAllByRole("link", { name: /Vào game/ })).toHaveLength(0);
});
it("coalesces manual and focus refresh and discovers opening", async () => {
  vi.spyOn(document, "visibilityState", "get").mockReturnValue("visible");
  vi.mocked(arenaApi.lobby).mockResolvedValueOnce({ competition: null, games: [] } as never);
  render(<ArenaHub />);
  await screen.findByText(/Đang chờ giảng viên/);
  vi.mocked(arenaApi.lobby).mockResolvedValue({ competition: { name: "[GIẢ LẬP] Buổi thử", state: "open", kind: "rehearsal", startDeadlineAt: "2030-01-01T00:00:00Z" }, games: [] } as never);
  window.dispatchEvent(new Event("focus"));
  fireEvent.click(screen.getByRole("button", { name: "Kiểm tra lại" }));
  await waitFor(() => expect(screen.getByText("[GIẢ LẬP] Buổi thử")).toBeInTheDocument());
  expect(arenaApi.lobby).toHaveBeenCalledTimes(2);
});
