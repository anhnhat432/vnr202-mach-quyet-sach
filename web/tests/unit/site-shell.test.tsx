import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { SiteHeader } from "@/components/site-header";

describe("SiteHeader", () => {
  it("exposes the three main public experiences", () => {
    render(<SiteHeader />);
    expect(screen.getByRole("link", { name: "Hồ sơ" })).toHaveAttribute("href", "/ho-so");
    expect(screen.getByRole("link", { name: "Mạch nguyên nhân" })).toHaveAttribute(
      "href",
      "/mach-nguyen-nhan",
    );
    expect(screen.getByRole("link", { name: "Bằng chứng" })).toHaveAttribute(
      "href",
      "/ma-tran-bang-chung",
    );
  });
});
