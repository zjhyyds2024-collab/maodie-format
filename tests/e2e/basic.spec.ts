import { test, expect } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => !localStorage.getItem("vert-enhanced-store") && localStorage.setItem("vert-enhanced-store", JSON.stringify({state:{settings:{theme:"system",language:"en",quality:92,audioBitrate:192,sampleRate:44100,preserveMetadata:true}},version:0})));
});

test.describe("Home page", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
  });

  test("shows app title and tagline", async ({ page }) => {
    await expect(page.getByText("耄耋格式", { exact: true }).first()).toBeVisible();
    await expect(page.getByText("Local file converter", { exact: true })).toBeVisible();
  });

  test("shows upload and presets in one workspace", async ({ page }) => {
    await expect(page.getByRole("heading", { name: "Quick presets" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Conversion workspace" })).toBeVisible();
    for(const name of ["Images", "Audio", "Video", "Documents"]) await expect(page.getByRole("heading", {name,exact:true})).toHaveCount(0);
    await expect(page.getByRole("link", {name:/toolbox/i})).toHaveCount(0);
  });

  test("opens the conversion workspace for file upload", async ({ page }) => {
    await page.goto("/convert");
    await expect(page).toHaveURL("/");
    await expect(page.getByText("Drop files here")).toBeVisible();
  });

  test("navigation links are visible", async ({ page }) => {
    await expect(page.getByRole("link", { name: "Conversion workspace" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Settings" })).toBeVisible();
  });
});

test.describe("Settings page", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/settings");
  });

  test("shows settings title", async ({ page }) => {
    await expect(page.getByRole("heading", { name: "Settings" })).toBeVisible();
  });

  test("shows appearance section", async ({ page }) => {
    await expect(page.getByText("Appearance")).toBeVisible();
    await expect(page.getByText("Theme")).toBeVisible();
    await expect(page.getByText("Language")).toBeVisible();
  });

  test("shows conversion section", async ({ page }) => {
    await expect(page.getByRole("heading", { name: "Conversion", exact: true })).toBeVisible();
    await expect(page.getByText("Image quality")).toBeVisible();
  });

  test("migrates automatic audio rate and persists an explicit rate", async ({ page }) => {
    const sampleRate = page.getByRole("combobox", {name:"Audio sample rate", exact:true});
    await expect(sampleRate).toHaveValue("0");
    await sampleRate.selectOption("48000");
    await page.reload();
    await expect(sampleRate).toHaveValue("48000");
    await sampleRate.selectOption("0");
    await page.reload();
    await expect(sampleRate).toHaveValue("0");
  });

  test("can change theme to dark", async ({ page }) => {
    const select = page.locator("select").first();
    await select.selectOption("dark");
    await expect(page.locator("html")).toHaveClass(/dark/);
  });
});

test.describe("Navigation", () => {
  test("navigates between pages", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("link", { name: "Settings" }).click();
    await expect(page).toHaveURL("/settings");
    await page.getByRole("link", { name: "Conversion workspace" }).click();
    await expect(page).toHaveURL("/");
  });
});
