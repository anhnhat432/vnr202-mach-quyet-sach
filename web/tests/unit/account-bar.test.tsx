import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { AccountBar } from "@/components/account-bar";
vi.mock("next/navigation", () => ({ usePathname: () => "/live-arena" }));
afterEach(() => { cleanup(); vi.unstubAllGlobals(); document.cookie = "vnr_csrf=;max-age=0;path=/"; });
function session(role = "student", failLogout = false) {
  document.cookie = "vnr_csrf=synthetic-token;path=/";
  const fetcher = vi.fn(async (url: string, init?: RequestInit) => {
    if (url.endsWith("/me")) return Response.json({ data: { role, displayName: "An N.V.", fullName: "Nguyễn Văn An", studentId: "ZZSYNTHETIC001" } });
    if (url.endsWith("/auth/sign-out")) {
      expect(init?.method).toBe("POST");
      expect((init?.headers as Record<string, string>)["x-csrf-token"]).toBe("synthetic-token");
      return failLogout ? Response.json({ error: { code: "service_unavailable", message: "Đăng xuất tạm thời gián đoạn." } }, { status: 503 }) : new Response(null, { status: 204 });
    }
    throw Error("Unexpected request");
  });
  vi.stubGlobal("fetch", fetcher);
  return fetcher;
}
it("shows only the classroom name and cancels logout without a mutation", async () => {
  const fetcher = session(); render(<AccountBar />);
  await screen.findByText("An N.V.");
  expect(document.body.textContent).not.toContain("Nguyễn Văn An");
  expect(document.body.textContent).not.toContain("ZZSYNTHETIC001");
  fireEvent.click(screen.getByRole("button", { name: "Đăng xuất" }));
  expect(screen.getByText(/Đồng hồ lượt đang chơi vẫn chạy/)).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Hủy" }));
  expect(fetcher).toHaveBeenCalledTimes(1);
});
it("posts CSRF logout, clears identity and navigates only after 204", async () => {
  session(); const navigate = vi.fn(); render(<AccountBar onSignedOut={navigate} />);
  await screen.findByText("An N.V.");
  fireEvent.click(screen.getByRole("button", { name: "Đăng xuất" }));
  fireEvent.click(screen.getByRole("button", { name: "Xác nhận đăng xuất" }));
  await waitFor(() => expect(navigate).toHaveBeenCalledWith("/dang-nhap"));
  expect(screen.queryByText("An N.V.")).not.toBeInTheDocument();
});
it("keeps the identity and error visible when logout fails", async () => {
  session("admin", true); const navigate = vi.fn(); render(<AccountBar onSignedOut={navigate} />);
  await screen.findByText("An N.V.");
  fireEvent.click(screen.getByRole("button", { name: "Đăng xuất" }));
  await screen.findByRole("alert");
  expect(navigate).not.toHaveBeenCalled();
  expect(screen.getByText("An N.V.")).toBeInTheDocument();
});
