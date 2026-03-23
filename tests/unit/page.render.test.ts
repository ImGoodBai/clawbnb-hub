import { describe, expect, it } from "vitest";

import { renderDemoPage } from "../../src/service/page.js";

describe("demo page render", () => {
  it("renders the main shell and API hooks", () => {
    const page = renderDemoPage();
    expect(page).toContain("WeClawBot-ex");
    expect(page).toContain("/api/qr/create");
    expect(page).toContain("/api/health");
    expect(page).toContain("自动刷新");
    expect(page).toContain("添加微信");
    expect(page).toContain("独立 Agent");
  });
});
