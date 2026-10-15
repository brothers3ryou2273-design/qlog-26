import { expect, test } from "@playwright/test";
import { readFile } from "node:fs/promises";
const saveKey = "qlog.mhxx.demo.v1";
async function demo(page: import("@playwright/test").Page) {
  await page.goto("./");
  await page.getByRole("button", { name: "架空データで操作を試す" }).click();
}
function backup(data: object) {
  return {
    name: "backup.json",
    mimeType: "application/json",
    buffer: Buffer.from(JSON.stringify(data)),
  };
}
test("production shows partial coverage and noindex", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("./");
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute(
    "content",
    "noindex, nofollow",
  );
  await expect(
    page.getByRole("heading", { name: "村 ★3", exact: true }),
  ).toBeVisible();
  await expect(page.locator(".quest-card")).toHaveCount(4);
  await expect(
    page.getByText("データ整備中 · 実クエスト14件・一部確認"),
  ).toBeVisible();
  await page
    .getByRole("combobox", { name: "ランク", exact: true })
    .selectOption("4");
  await expect(
    page.getByRole("heading", { name: "このランクは、これから収録します" }),
  ).toBeVisible();
  expect(errors).toEqual([]);
});
test("checks persist through reload, search filters, and category totals stay separate", async ({
  page,
}) => {
  await demo(page);
  await page
    .getByRole("combobox", { name: "ランク", exact: true })
    .selectOption("1");
  const checkbox = page.getByRole("checkbox", {
    name: "【架空】はじめの採集をクリア",
  });
  await checkbox.check();
  await page.reload();
  // Demo mode itself is deliberately not persisted; explicitly enter the isolated demo again.
  await page.getByRole("button", { name: "架空データで操作を試す" }).click();
  await expect(checkbox).toBeChecked();
  await expect(page.getByRole("progressbar")).toHaveAttribute("value", "1");
  await page.getByRole("checkbox", { name: "未クリアのみ" }).check();
  await expect(checkbox).toHaveCount(0);
  await page.getByRole("checkbox", { name: "未クリアのみ" }).uncheck();
  await page.getByRole("searchbox").fill("はじめ");
  await expect(page.locator(".quest-card")).toHaveCount(1);
  await page.getByRole("searchbox").fill("");
  await page
    .getByRole("combobox", { name: "種別", exact: true })
    .selectOption("key");
  await expect(page.locator(".quest-card")).toHaveCount(1);
  await page.getByRole("button", { name: "イベント", exact: true }).click();
  await expect(page.getByRole("progressbar")).toHaveAttribute("value", "0");
  await expect(page.locator(".progress-heading")).toContainText("収録済み 0件");
});
test("nested prerequisites and reverse links navigate between ranks and preserve unknown flags", async ({
  page,
}) => {
  await demo(page);
  await page
    .getByRole("combobox", { name: "ランク", exact: true })
    .selectOption("1");
  await page
    .getByRole("checkbox", { name: "【架空】はじめの採集をクリア" })
    .check();
  await page.getByRole("button", { name: /キー.*はじめの採集/ }).click();
  await page.getByRole("button", { name: "村 ★2 / 【架空】森の調査" }).click();
  await expect(
    page.getByRole("heading", { name: "村 ★2", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText("すべて必要（AND）", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText("村人の依頼・会話をゲーム内で確認：ゲーム内で要確認", {
      exact: true,
    }),
  ).toBeVisible();
  await expect(page.locator(".state")).toHaveText("要確認");
  await expect(
    page.getByRole("link", { name: /MHXX攻略レシピ（トップページ）/ }),
  ).toHaveAttribute("href", "https://wiki.mhxg.org/");
  await page.getByRole("button", { name: "村 ★3 / 【架空】峠への道" }).click();
  await expect(
    page.getByRole("heading", { name: "村 ★3", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText("HR 2以上（HR未入力）", { exact: true }),
  ).toBeVisible();
});
test("OR uses one completed prerequisite and role filter identifies prowler", async ({
  page,
}) => {
  await demo(page);
  await page
    .getByRole("combobox", { name: "ランク", exact: true })
    .selectOption("1");
  await page
    .getByRole("checkbox", { name: "【架空】はじめの採集をクリア" })
    .check();
  await page
    .getByRole("combobox", { name: "ランク", exact: true })
    .selectOption("2");
  await page
    .getByRole("combobox", { name: "プレイ種別", exact: true })
    .selectOption("prowler");
  await expect(page.locator(".quest-card")).toHaveCount(1);
  await page.getByRole("button", { name: /二つの足跡/ }).click();
  await expect(
    page.getByText("いずれかが必要（OR）", { exact: true }),
  ).toBeVisible();
  await expect(page.locator(".state")).toHaveText("前提条件達成");
});
test("backup download, preview, cancel, merge, unknown IDs, replace, malformed and wrong dataset", async ({
  page,
}) => {
  await demo(page);
  await page
    .getByRole("combobox", { name: "ランク", exact: true })
    .selectOption("1");
  await page
    .getByRole("checkbox", { name: "【架空】はじめの採集をクリア" })
    .check();
  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "JSONを書き出す" }).click();
  const download = await downloadPromise;
  const downloaded = JSON.parse(
    await readFile((await download.path())!, "utf8"),
  );
  expect(downloaded.completedQuestIds).toEqual(["demo-1"]);
  expect(downloaded.dataset).toBe("demo");
  const upload = page.getByLabel("バックアップファイル");
  const imported = {
    schemaVersion: 1,
    dataset: "demo",
    completedQuestIds: ["demo-2", "future-id"],
    hr: 5,
  };
  await upload.setInputFiles(backup(imported));
  await expect(page.getByRole("dialog")).toBeVisible();
  await expect(
    page.getByText("未収録のID：1件（削除せず保持します）"),
  ).toBeVisible();
  await page.getByRole("button", { name: "キャンセル", exact: true }).click();
  expect(
    await page.evaluate(
      (k) => JSON.parse(localStorage.getItem(k)!).completedQuestIds,
      saveKey,
    ),
  ).toEqual(["demo-1"]);
  await upload.setInputFiles(backup(imported));
  await page.getByRole("button", { name: "追加して復元" }).click();
  await expect(
    page.getByRole("checkbox", { name: "【架空】森の調査をクリア" }),
  ).toBeChecked();
  expect(
    await page.evaluate(
      (k) => JSON.parse(localStorage.getItem(k)!).completedQuestIds,
      saveKey,
    ),
  ).toEqual(["demo-1", "demo-2", "future-id"]);
  await upload.setInputFiles(backup(imported));
  await page
    .getByRole("checkbox", { name: "現在の進捗をファイルで置き換える" })
    .check();
  await expect(page.getByText(/現在の記録のうち 1件が外れ/)).toBeVisible();
  await page.getByRole("button", { name: "置き換えて復元" }).click();
  await expect(
    page.getByRole("checkbox", { name: "【架空】はじめの採集をクリア" }),
  ).not.toBeChecked();
  await expect(page.getByLabel("現在のHR")).toHaveValue("5");
  const before = await page.evaluate((k) => localStorage.getItem(k), saveKey);
  await upload.setInputFiles({
    name: "bad.json",
    mimeType: "application/json",
    buffer: Buffer.from("{broken"),
  });
  await expect(page.getByRole("alert")).toContainText("JSONを読み取れません");
  await upload.setInputFiles(
    backup({ schemaVersion: 1, completedQuestIds: [] }),
  );
  await expect(page.getByRole("alert")).toContainText("相互に読み込めません");
  expect(await page.evaluate((k) => localStorage.getItem(k), saveKey)).toBe(
    before,
  );
});
test("demo and real progress stay isolated, and unknown IDs survive changes", async ({
  page,
}) => {
  await page.goto("./");
  await page
    .getByLabel("バックアップファイル")
    .setInputFiles(
      backup({ schemaVersion: 1, completedQuestIds: ["future-real"] }),
    );
  await page.getByRole("button", { name: "追加して復元" }).click();
  await page.getByRole("button", { name: "架空データで操作を試す" }).click();
  await page
    .getByRole("combobox", { name: "ランク", exact: true })
    .selectOption("1");
  await page
    .getByRole("checkbox", { name: "【架空】はじめの採集をクリア" })
    .check();
  await page.getByRole("button", { name: "実データに戻る" }).click();
  expect(
    await page.evaluate(
      () =>
        JSON.parse(localStorage.getItem("qlog.mhxx.progress.v1")!)
          .completedQuestIds,
    ),
  ).toEqual(["future-real"]);
  await expect(
    page.getByText(
      "未収録IDのクリア記録 1件を保持しています。再収録時に表示されます。",
    ),
  ).toBeVisible();
});
test("corrupt saved data is preserved, and writes are blocked", async ({
  page,
}) => {
  await page.addInitScript(() =>
    localStorage.setItem("qlog.mhxx.progress.v1", "{broken"),
  );
  await page.goto("./");
  await expect(page.getByRole("alert")).toContainText("上書きせず保護");
  await expect(
    page.getByRole("button", { name: "JSONから復元" }),
  ).toBeDisabled();
  expect(
    await page.evaluate(() => localStorage.getItem("qlog.mhxx.progress.v1")),
  ).toBe("{broken");
});
test("storage write failures are reported without claiming success or changing checks", async ({
  page,
}) => {
  await demo(page);
  await page
    .getByRole("combobox", { name: "ランク", exact: true })
    .selectOption("1");
  await page.evaluate(() => {
    Storage.prototype.setItem = () => {
      throw new DOMException("full", "QuotaExceededError");
    };
  });
  await page
    .getByRole("checkbox", { name: "【架空】はじめの採集をクリア" })
    .click();
  await expect(page.getByRole("status")).toContainText("保存できませんでした");
  await expect(
    page.getByRole("checkbox", { name: "【架空】はじめの採集をクリア" }),
  ).not.toBeChecked();
});
test("HR validation, mobile layout and touch target sizes", async ({
  page,
}) => {
  await demo(page);
  await page.getByLabel("現在のHR").fill("1.5");
  await page.getByRole("button", { name: "HRを保存" }).click();
  await expect(page.getByRole("alert")).toContainText("HRは1〜999");
  await page.getByLabel("現在のHR").fill("2");
  await page.getByRole("button", { name: "HRを保存" }).click();
  expect(
    await page.evaluate(
      (k) => JSON.parse(localStorage.getItem(k)!).hr,
      saveKey,
    ),
  ).toBe(2);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  const target = await page.locator(".quest-check").first().boundingBox();
  expect(target!.height).toBeGreaterThanOrEqual(44);
  if (test.info().project.name === "mobile")
    await page.screenshot({
      path: "test-results/mobile-tracker.png",
      fullPage: true,
    });
});

test("real village data persists, links to confirmed pages, and keeps conversations unknown", async ({
  page,
}) => {
  await page.goto("./");
  await page
    .getByRole("combobox", { name: "ランク", exact: true })
    .selectOption("1");
  await expect(page.locator(".quest-card")).toHaveCount(4);
  await page
    .getByRole("checkbox", {
      name: "古代林の特産ゼンマイをクリア",
      exact: true,
    })
    .check();
  await page
    .getByRole("button", { name: /キー.*古代の森でシメジ狩り/ })
    .click();
  await expect(page.locator(".state")).toHaveText("前提条件達成");
  await page
    .getByRole("checkbox", {
      name: "古代の森でシメジ狩りをクリア",
      exact: true,
    })
    .check();
  await page
    .getByRole("checkbox", {
      name: "マッカォの群れを討伐せよ！をクリア",
      exact: true,
    })
    .check();
  await page
    .getByRole("button", { name: /キー.*ネコ嬢のジャギィ討伐依頼/ })
    .click();
  await expect(page.locator(".state")).toHaveText("要確認");
  await page
    .getByRole("checkbox", {
      name: "ネコ嬢のジャギィ討伐依頼をクリア",
      exact: true,
    })
    .check();
  await page
    .getByRole("button", { name: "村 ★2 / 跳躍のアウトロー", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "村 ★2", exact: true }),
  ).toBeVisible();
  await expect(page.locator(".state")).toHaveText("要確認");
  await expect(
    page.getByText("ネコ嬢、ベルナ村の村長の順に話す：ゲーム内で要確認", {
      exact: true,
    }),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: /Game8 MHXX（該当クエスト詳細）/ }),
  ).toHaveAttribute("href", "https://game8.jp/mh-xx/822843");
  await page.reload();
  await page
    .getByRole("combobox", { name: "ランク", exact: true })
    .selectOption("1");
  await expect(
    page.getByRole("checkbox", {
      name: "古代林の特産ゼンマイをクリア",
      exact: true,
    }),
  ).toBeChecked();
  await expect(page.getByRole("progressbar")).toHaveAttribute("value", "4");
  const stored = await page.evaluate(() =>
    JSON.parse(localStorage.getItem("qlog.mhxx.progress.v1")!),
  );
  expect(stored.completedQuestIds).toHaveLength(4);
  expect(stored.completedQuestIds).toContain("village-1-g8-822831");
});
