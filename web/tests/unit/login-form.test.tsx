import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { LoginForm } from "@/features/auth/ui/login-form";
import { AdminLoginForm } from "@/features/admin/ui/admin-login";

const navigation = vi.hoisted(() => ({ push: vi.fn(), refresh: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => navigation }));
afterEach(() => { cleanup(); vi.unstubAllGlobals(); vi.clearAllMocks(); });

it("sends pending students to first-login name setup", async () => {
  vi.stubGlobal("fetch", vi.fn(async () => ({ ok: true, json: async () => ({ data: { requiresDisplayName: true } }) })));
  render(<LoginForm />);
  fireEvent.change(screen.getByLabelText("Mã số sinh viên"), { target: { value: "TEST001" } });
  fireEvent.change(screen.getByLabelText("Mật khẩu"), { target: { value: "test-only" } });
  fireEvent.click(screen.getByRole("button", { name: "Đăng nhập" }));
  await vi.waitFor(() => expect(navigation.push).toHaveBeenCalledWith("/thiet-lap-ten"));
});

it.each(["student", "admin"])("shows provider outage rather than invalid credentials for %s", async (kind) => {
  vi.stubGlobal("fetch", vi.fn(async () => ({ ok: false, status: 503 })));
  render(kind === "student" ? <LoginForm /> : <AdminLoginForm />);
  fireEvent.change(screen.getByLabelText(kind === "student" ? "Mã số sinh viên" : "Email quản trị"), { target: { value: kind === "student" ? "TEST001" : "admin@test.invalid" } });
  fireEvent.change(screen.getByLabelText("Mật khẩu"), { target: { value: "test-only" } });
  fireEvent.click(screen.getByRole("button", { name: "Đăng nhập" }));
  expect(await screen.findByText(/Đăng nhập tạm thời gián đoạn/)).toBeVisible();
});
