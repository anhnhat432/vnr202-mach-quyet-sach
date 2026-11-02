import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { StudentNameForm } from "@/features/auth/ui/student-name-form";
const navigation = vi.hoisted(() => ({ push: vi.fn(), refresh: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => navigation }));
afterEach(() => { cleanup(); vi.unstubAllGlobals(); vi.clearAllMocks(); });

it("requires a name and submits only that name with the authenticated CSRF token", async () => {
  document.cookie = "vnr_csrf=csrf-test; path=/";
  const fetcher = vi.fn(async () => ({ ok: true, json: async () => ({ data: { displayName: "An N.V." } }) }));
  vi.stubGlobal("fetch", fetcher);
  render(<StudentNameForm />);
  const button = screen.getByRole("button", { name: "Lưu tên và vào sảnh" });
  expect(button).toBeDisabled();
  fireEvent.change(screen.getByLabelText("Tên gọi hoặc họ tên"), { target: { value: "Nguyễn Văn An" } });
  fireEvent.click(button);
  await vi.waitFor(() => expect(navigation.push).toHaveBeenCalledWith("/live-arena"));
  expect(fetcher.mock.calls[0]).toEqual(["/api/v1/me/display-name", expect.objectContaining({ method: "POST", body: JSON.stringify({ name: "Nguyễn Văn An" }), headers: expect.objectContaining({ "x-csrf-token": "csrf-test" }) })]);
});
