import { expect, test } from "@playwright/test";

test("Chapter 1 Drafts stay absent from the public catalogue and API", async ({ page, request }) => {
  await page.goto("/ho-so");
  await expect(page.getByRole("link", { name: /Hợp nhất để mở đường/ })).toBeVisible();
  await expect(page.getByText("Con đường nào cho độc lập?")).toHaveCount(0);
  await expect(page.getByText("Giữ mạch phong trào")).toHaveCount(0);
  await expect(page.getByText("Linh hoạt trong một cửa sổ dân chủ")).toHaveCount(0);
  await expect(page.getByText("Chớp đúng thời cơ")).toHaveCount(0);

  const response = await request.get("/api/v1/dossiers");
  expect(response.status()).toBe(200);
  const payload = await response.json();
  expect(payload.data).toHaveLength(3);
  expect(payload.data.map((item: { status: string }) => item.status)).toEqual([
    "published",
    "published",
    "published",
  ]);

  const draftResponse = await page.goto("/ho-so/con-duong-nao-cho-doc-lap");
  expect(draftResponse?.status()).toBe(404);
  await expect(page.getByRole("heading", { name: "404", exact: true })).toBeVisible();
});
