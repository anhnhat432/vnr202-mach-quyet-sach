import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";

describe("SiteHeader", () => {
  it("keeps classroom entry points and hides the four public study sections", () => {
    render(<SiteHeader />);
    render(<SiteFooter />);
    for (const name of ["Hồ sơ", "Mạch nguyên nhân", "Bằng chứng", "Phương pháp", "Phòng Phương Pháp"]) {
      expect(screen.queryByRole("link", { name })).not.toBeInTheDocument();
    }
    expect(screen.getByRole("link", { name: "Ngàn cân" })).toHaveAttribute("href", "/ngan-can");
    expect(screen.getByRole("link", { name: /Live Arena/ })).toHaveAttribute("href", "/live-arena");
    expect(screen.getByRole("link", { name: "Quản trị" })).toHaveAttribute("href", "/quan-tri/cuoc-thi");
    expect(screen.getByRole("link", { name: "Nguồn & AI" })).toHaveAttribute("href", "/nguon-va-ai");
  });
});
