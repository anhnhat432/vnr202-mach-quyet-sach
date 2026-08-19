import { describe, expect, it } from "vitest";

import { PROJECT_NAME } from "@/lib/project";

describe("project foundation", () => {
  it("exposes the approved project name", () => {
    expect(PROJECT_NAME).toBe("VNR202 - Mạch Quyết Sách");
  });
});
