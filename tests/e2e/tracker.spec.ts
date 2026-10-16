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
  await expect(page.locator(".quest-card")).toHaveCount(45);
  await expect(
    page.getByText("データ整備中 · 実クエスト1311件収録"),
  ).toBeVisible();
  await page.getByRole("button", { name: "G級", exact: true }).click();
  await expect(page.locator(".quest-card")).toHaveCount(32);
  await page.getByRole("button", { name: "闘技大会", exact: true }).click();
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
    page.getByText("村人から依頼を受注し、必要な会話を行う（架空の例）", {
      exact: true,
    }),
  ).toBeVisible();
  await expect(page.locator(".state")).toHaveText("記録上の前提達成");
  await expect(
    page.getByRole("link", { name: /MHXX攻略レシピ（トップページ）/ }),
  ).toHaveAttribute("href", "http://wiki.mhxg.org/");
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
  await expect(page.locator(".state")).toHaveText("記録上の前提達成");
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
  expect(target!.width).toBeGreaterThanOrEqual(44);
  if (test.info().project.name === "mobile")
    await page.screenshot({
      path: "test-results/mobile-tracker.png",
      fullPage: true,
    });
});

test("real village data persists, links to confirmed pages, and separates conversation notes from evaluation", async ({
  page,
}) => {
  await page.goto("./");
  await page
    .getByRole("combobox", { name: "ランク", exact: true })
    .selectOption("1");
  await expect(page.locator(".quest-card")).toHaveCount(7);
  await page
    .getByRole("checkbox", {
      name: "古代林の特産ゼンマイをクリア",
      exact: true,
    })
    .check();
  await page
    .getByRole("button", { name: /キー.*古代の森でシメジ狩り/ })
    .click();
  await expect(page.locator(".state")).toHaveText("記録上の前提達成");
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
  await expect(page.locator(".state")).toHaveText("記録上の前提達成");
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
  await expect(page.locator(".state")).toHaveText("記録上の前提達成");
  await expect(
    page.getByText("ネコ嬢、ベルナ村の村長の順に話す。", {
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

test("pre-update progress and backups keep their IDs after recipe link changes", async ({
  page,
}) => {
  const legacy = {
    schemaVersion: 1,
    completedQuestIds: [
      "village-1-g8-822831",
      "village-2-g8-822843",
      "future-quest",
    ],
    hr: 4,
  };
  await page.addInitScript((data) => {
    if (!localStorage.getItem("qlog.mhxx.progress.v1"))
      localStorage.setItem("qlog.mhxx.progress.v1", JSON.stringify(data));
  }, legacy);
  await page.goto("./");
  await page
    .getByRole("combobox", { name: "ランク", exact: true })
    .selectOption("2");
  await expect(
    page.getByRole("checkbox", {
      name: "跳躍のアウトローをクリア",
      exact: true,
    }),
  ).toBeChecked();
  await page.getByRole("button", { name: /緊急.*跳躍のアウトロー/ }).click();
  const recipe = page.getByRole("link", {
    name: /MHXX攻略レシピ（該当クエスト詳細）/,
  });
  await expect(recipe).toHaveAttribute(
    "href",
    "http://wiki.mhxg.org/ida/219257.html",
  );
  await expect(recipe).toHaveAttribute("target", "_blank");
  await expect(recipe).toHaveAttribute("rel", "noopener noreferrer");
  await expect(page.getByLabel("現在のHR")).toHaveValue("4");
  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "JSONを書き出す" }).click();
  const file = await downloadPromise;
  const exported = JSON.parse(await readFile((await file.path())!, "utf8"));
  expect(exported.completedQuestIds).toEqual(legacy.completedQuestIds);
  expect(exported.schemaVersion).toBe(1);
  await page
    .getByRole("checkbox", { name: "跳躍のアウトローをクリア", exact: true })
    .uncheck();
  await page.getByLabel("バックアップファイル").setInputFiles(backup(legacy));
  await page.getByRole("button", { name: "追加して復元" }).click();
  await page.reload();
  await expect(
    page.getByRole("checkbox", {
      name: "跳躍のアウトローをクリア",
      exact: true,
    }),
  ).toBeChecked();
  expect(
    await page.evaluate(
      () =>
        JSON.parse(localStorage.getItem("qlog.mhxx.progress.v1")!)
          .completedQuestIds,
    ),
  ).toEqual(expect.arrayContaining(legacy.completedQuestIds));
  await page
    .getByRole("combobox", { name: "ランク", exact: true })
    .selectOption("1");
  await page
    .getByRole("combobox", { name: "種別", exact: true })
    .selectOption("request");
  await expect(page.locator(".quest-card")).toHaveCount(1);
  await expect(
    page.getByRole("checkbox", {
      name: "ネコ嬢のジャギィ討伐依頼をクリア",
      exact: true,
    }),
  ).toBeVisible();
});

test("audited rank rosters, roles, and newly added progress persist", async ({
  page,
}) => {
  await page.goto("./");
  const rank = page.getByRole("combobox", { name: "ランク", exact: true });
  await rank.selectOption("1");
  await expect(page.locator(".quest-card")).toHaveCount(7);
  await page
    .getByRole("checkbox", { name: "悠久が眠る竜琥珀をクリア", exact: true })
    .check();
  await page.reload();
  await expect(
    page.getByRole("checkbox", {
      name: "悠久が眠る竜琥珀をクリア",
      exact: true,
    }),
  ).toBeChecked();
  await rank.selectOption("2");
  await expect(page.locator(".quest-card")).toHaveCount(37);
  await expect(page.getByRole("progressbar")).toHaveAttribute("max", "37");
  await page
    .getByRole("combobox", { name: "プレイ種別", exact: true })
    .selectOption("prowler");
  await expect(page.locator(".quest-card")).toHaveCount(3);
  await rank.selectOption("3");
  await expect(page.locator(".quest-card")).toHaveCount(6);
  await page
    .getByRole("combobox", { name: "プレイ種別", exact: true })
    .selectOption("");
  await expect(page.locator(".quest-card")).toHaveCount(45);
  await expect(page.getByRole("progressbar")).toHaveAttribute("max", "45");
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});

test("new request reverse links expose food and show receipt instructions without blocking prerequisites", async ({
  page,
}) => {
  await page.goto("./");
  await page
    .getByRole("combobox", { name: "ランク", exact: true })
    .selectOption("2");
  await page.getByRole("searchbox").fill("青熊獣");
  await page
    .getByRole("checkbox", { name: "青熊獣アオアシラをクリア", exact: true })
    .check();
  await page.getByRole("button", { name: /依頼.*青熊獣アオアシラ/ }).click();
  await page
    .getByRole("button", { name: "村 ★2 / ぽかぽかタケノコ納品", exact: true })
    .click();
  await expect(page.locator(".state")).toHaveText("記録上の前提達成");
  await expect(
    page.getByRole("listitem").filter({ hasText: "ツチタケノコ" }),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: /MHXX攻略レシピ（該当クエスト詳細）/ }),
  ).toHaveAttribute("href", "http://wiki.mhxg.org/ida/218324.html");
  await expect(
    page.getByText(/依頼主への報告・会話や実際の追加はゲーム内で確認/),
  ).toBeVisible();
});

test("real prowler threshold and authoritative primary prerequisite", async ({
  page,
}) => {
  await page.goto("./");
  await page
    .getByRole("combobox", { name: "プレイ種別", exact: true })
    .selectOption("prowler");
  await page
    .getByRole("checkbox", { name: "森丘の悪戯っ子をクリア", exact: true })
    .check();
  await page
    .getByRole("checkbox", { name: "釣りニャンデー創刊をクリア", exact: true })
    .check();
  await page.getByRole("button", { name: /沼地に異常事態発生虫？/ }).click();
  await expect(page.locator(".state")).toHaveText("記録上の前提達成");
  await page
    .getByRole("checkbox", { name: "釣りニャンデー創刊をクリア", exact: true })
    .uncheck();
  await expect(page.locator(".state")).toHaveText("未達成");
  await page
    .getByRole("combobox", { name: "ランク", exact: true })
    .selectOption("2");
  await page
    .getByRole("checkbox", {
      name: "ニャンター、はじめてのお使いをクリア",
      exact: true,
    })
    .check();
  await page.getByRole("button", { name: /古代林のポイント招きネコ/ }).click();
  await expect(page.locator(".state")).toHaveText("記録上の前提達成");
  await expect(
    page.getByText("出現・受注に必要な操作", { exact: true }),
  ).toHaveCount(0);
});

test("ranks 4–6 show full rosters and omit internal verification badges", async ({
  page,
}) => {
  await page.goto("./");
  for (const [rank, count, prowlers] of [
    ["4", 35, 6],
    ["5", 28, 5],
    ["6", 45, 4],
  ] as const) {
    await page
      .getByRole("combobox", { name: "ランク", exact: true })
      .selectOption(rank);
    await expect(page.locator(".quest-card")).toHaveCount(count);
    await expect(page.getByRole("progressbar")).toHaveAttribute(
      "max",
      String(count),
    );
    await expect(
      page
        .locator(".quest-meta")
        .filter({ hasText: /一部確認|データ確認済み|データ未確認/ }),
    ).toHaveCount(0);
    await page
      .getByRole("combobox", { name: "プレイ種別", exact: true })
      .selectOption("prowler");
    await expect(page.locator(".quest-card")).toHaveCount(prowlers);
    await page
      .getByRole("combobox", { name: "プレイ種別", exact: true })
      .selectOption("");
  }
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});

test("all 89 existing checks and backups survive and NPC notes do not block a new quest", async ({
  page,
}) => {
  const baseline: { id: string }[] = JSON.parse(
    await readFile("docs/progress-id-baseline.json", "utf8"),
  );
  const ids = baseline.map((q) => q.id);
  await page.addInitScript((ids) => {
    localStorage.setItem(
      "qlog.mhxx.progress.v1",
      JSON.stringify({
        schemaVersion: 1,
        completedQuestIds: [...ids, "future-id"],
        hr: 7,
      }),
    );
  }, ids);
  await page.goto("./");
  await expect(page.getByRole("progressbar")).toHaveAttribute("value", "45");
  await page
    .getByRole("combobox", { name: "ランク", exact: true })
    .selectOption("4");
  await expect(page.getByRole("progressbar")).toHaveAttribute("value", "0");
  await page
    .getByRole("checkbox", { name: "落石注意！？をクリア", exact: true })
    .check();
  await page.getByRole("searchbox").fill("トレジャー！虫");
  await page
    .getByRole("button", { name: /古代林のトレジャー！虫の巻/ })
    .click();
  await expect(page.locator(".state")).toHaveText("記録上の前提達成");
  await expect(
    page.getByText("ココット村 トレジィの依頼2を受注する。", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: /MHXX攻略レシピ（該当クエスト詳細）/ }),
  ).toHaveAttribute("href", "http://wiki.mhxg.org/ida/220199.html");
  const pending = page.waitForEvent("download");
  await page.getByRole("button", { name: "JSONを書き出す" }).click();
  const file = await pending;
  const exported = JSON.parse(await readFile((await file.path())!, "utf8"));
  expect(exported.schemaVersion).toBe(1);
  expect(exported.hr).toBe(7);
  expect(exported.completedQuestIds).toHaveLength(91);
  expect(exported.completedQuestIds).toEqual(
    expect.arrayContaining([...ids, "future-id"]),
  );
});

test("HR gates auto-evaluate and the collected rank-7 prerequisite resolves 宿命", async ({
  page,
}) => {
  await page.goto("./");
  await page
    .getByRole("combobox", { name: "ランク", exact: true })
    .selectOption("6");
  await page
    .getByRole("checkbox", { name: "灼熱の刃をクリア", exact: true })
    .check();
  await page.getByRole("searchbox").fill("黒狼鳥");
  await page
    .getByRole("button", { name: /高難度：黒狼鳥は舞い降りた/ })
    .click();
  await expect(page.locator(".state")).toHaveText("要確認");
  await page.getByLabel("現在のHR").fill("4");
  await page.getByRole("button", { name: "HRを保存" }).click();
  await expect(page.locator(".state")).toHaveText("未達成");
  await page.getByLabel("現在のHR").fill("5");
  await page.getByRole("button", { name: "HRを保存" }).click();
  await expect(page.locator(".state")).toHaveText("記録上の前提達成");
  await expect(
    page.getByText("ココット村 ドンドルマの守護兵の依頼1を受注する。", {
      exact: true,
    }),
  ).toBeVisible();
  await page.getByRole("searchbox").fill("廻り集いて回帰せん");
  await page
    .getByRole("checkbox", { name: "廻り集いて回帰せんをクリア", exact: true })
    .check();
  await page.getByRole("searchbox").fill("宿命の四天王");
  await page.getByRole("button", { name: /宿命の四天王/ }).click();
  await expect(page.locator(".state")).toHaveText("未達成");
  await page
    .getByRole("button", {
      name: "村 ★7 / 調査隊初陣！遺群嶺の桃毛獣",
      exact: true,
    })
    .click();
  await page
    .getByRole("checkbox", {
      name: "調査隊初陣！遺群嶺の桃毛獣をクリア",
      exact: true,
    })
    .check();
  await page
    .getByRole("button", { name: "村 ★6 / 宿命の四天王", exact: true })
    .click();
  await expect(page.locator(".state")).toHaveText("記録上の前提達成");
});

test("confirmed facility meals replace warnings while unresolved facilities stay visible", async ({
  page,
}) => {
  await page.goto("./");
  for (const [rank, name, menu] of [
    ["2", "跳躍のアウトロー", "屋台の情熱まかない飯"],
    ["4", "幻惑の魔術師", "屋台の闘魂まかない飯"],
    ["5", "黒き禍", "屋台の愛情まかない飯"],
  ]) {
    await page
      .getByRole("combobox", { name: "ランク", exact: true })
      .selectOption(rank);
    await page.getByRole("searchbox").fill(name);
    await page.getByRole("button", { name: new RegExp(name) }).click();
    await expect(page.getByText(menu, { exact: false })).toBeVisible();
    await expect(
      page.getByText("具体的な施設・交易の解放内容と追加条件は未確認です。", {
        exact: true,
      }),
    ).toHaveCount(0);
    await expect(
      page.getByRole("link", { name: /MHXX攻略Wiki（食事施設）/ }),
    ).toHaveAttribute(
      "href",
      "https://mhx-wiki.com/?%E9%A3%9F%E4%BA%8B%E5%8A%B9%E6%9E%9C%E4%B8%80%E8%A6%A7",
    );
  }
  await page
    .getByRole("combobox", { name: "ランク", exact: true })
    .selectOption("3");
  await page.getByRole("searchbox").fill("鬼面狩人を威す");
  await page.getByRole("button", { name: /鬼面狩人を威す/ }).click();
  await expect(
    page.getByText("具体的な施設・交易の解放内容と追加条件は未確認です。", {
      exact: true,
    }),
  ).toBeVisible();
  await expect(
    page.getByText("リノプロシュート", { exact: false }),
  ).toBeVisible();
});

test("all 197 released checks survive facility changes and remain in version-1 backups", async ({
  page,
}) => {
  const released: { id: string }[] = JSON.parse(
    await readFile("docs/progress-id-baseline.json", "utf8"),
  );
  const roster = JSON.parse(await readFile("docs/data-audit.json", "utf8")) as {
    ranks: { rank: string; entries: { recipeUrl: string }[] }[];
  };
  const ids = [
    ...released.map((q) => q.id),
    ...roster.ranks
      .filter((r) => Number(r.rank) >= 4 && Number(r.rank) <= 6)
      .flatMap((r) =>
        r.entries.map(
          (q) =>
            `village-${r.rank}-recipe-${q.recipeUrl.split("/").pop()!.replace(".html", "")}`,
        ),
      ),
  ];
  await page.addInitScript((ids) => {
    localStorage.setItem(
      "qlog.mhxx.progress.v1",
      JSON.stringify({
        schemaVersion: 1,
        completedQuestIds: [...ids, "future-id"],
        hr: 7,
      }),
    );
  }, ids);
  await page.goto("./");
  for (const [rank, count] of [
    ["1", 7],
    ["2", 37],
    ["3", 45],
    ["4", 35],
    ["5", 28],
    ["6", 45],
  ] as const) {
    await page
      .getByRole("combobox", { name: "ランク", exact: true })
      .selectOption(rank);
    await expect(page.getByRole("progressbar")).toHaveAttribute(
      "value",
      String(count),
    );
  }
  const pending = page.waitForEvent("download");
  await page.getByRole("button", { name: "JSONを書き出す" }).click();
  const file = await pending;
  const exported = JSON.parse(await readFile((await file.path())!, "utf8"));
  expect(exported.schemaVersion).toBe(1);
  expect(exported.hr).toBe(7);
  expect(exported.completedQuestIds).toHaveLength(198);
  expect(exported.completedQuestIds).toEqual(
    expect.arrayContaining([...ids, "future-id"]),
  );
});

test("otomo and cart unlocks show HR alternatives and preserve conflicting slot-count warnings", async ({
  page,
}) => {
  await page.goto("./");
  for (const [rank, name, label] of [
    ["4", "雪山のポイント捜索隊！", "オトモの初期雇用レベル5〜7"],
    ["6", "牙と毒の沼地", "オトモの初期雇用レベル10〜12"],
    ["5", "怪鳥の頭部破壊に挑戦！", "交易窓口の荷車2台目"],
    ["6", "青と緑の波状包囲網", "交易窓口の荷車3台目"],
  ]) {
    await page
      .getByRole("combobox", { name: "ランク", exact: true })
      .selectOption(rank);
    await page.getByRole("searchbox").fill(name);
    await page.getByRole("button", { name: new RegExp(name) }).click();
    await expect(page.getByText(label, { exact: false })).toBeVisible();
    await expect(
      page.getByText("具体的な施設・交易の解放内容と追加条件は未確認です。", {
        exact: true,
      }),
    ).toHaveCount(0);
    if (name === "牙と毒の沼地")
      await expect(
        page.getByText(/このクエストのクリア、またはHR5以上（OR）で解放/),
      ).toBeVisible();
  }
  await page
    .getByRole("combobox", { name: "ランク", exact: true })
    .selectOption("3");
  await page.getByRole("searchbox").fill("森丘の悪戯っ子");
  await page.getByRole("button", { name: /森丘の悪戯っ子/ }).click();
  await expect(
    page.getByText("オトモ雇用枠の拡張（上限数は未確定）", { exact: false }),
  ).toBeVisible();
  await expect(
    page
      .locator(".quest-details")
      .getByText(/基本情報：48匹、専用クエスト表：36匹/)
      .first(),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: /MHXXニャンターwiki（基本情報）/ }),
  ).toHaveAttribute("href", "https://w.atwiki.jp/mhxxnyanter/pages/20.html");
});

test("upper village rosters show every observed rank and role without verification badges", async ({
  page,
}) => {
  await page.goto("./");
  for (const [rank, count, prowlers] of [
    ["7", 37, 3],
    ["8", 42, 4],
    ["9", 44, 4],
    ["10", 50, 5],
  ] as const) {
    await page
      .getByRole("combobox", { name: "ランク", exact: true })
      .selectOption(rank);
    await expect(page.locator(".quest-card")).toHaveCount(count);
    await expect(page.getByRole("progressbar")).toHaveAttribute(
      "max",
      String(count),
    );
    await expect(
      page
        .locator(".quest-meta")
        .filter({ hasText: /一部確認|データ確認済み|データ未確認/ }),
    ).toHaveCount(0);
    await page
      .getByRole("combobox", { name: "プレイ種別", exact: true })
      .selectOption("prowler");
    await expect(page.locator(".quest-card")).toHaveCount(prowlers);
    await page
      .getByRole("combobox", { name: "プレイ種別", exact: true })
      .selectOption("");
  }
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});

test("197 released checks coexist with new upper progress and version-1 backup exports", async ({
  page,
}) => {
  const released: { id: string }[] = JSON.parse(
    await readFile("docs/progress-baseline-197.json", "utf8"),
  );
  const ids = released.map((q) => q.id);
  await page.addInitScript((ids) => {
    // Seed once: a reload must exercise saved changes, not restore the fixture.
    if (localStorage.getItem("qlog.mhxx.progress.v1")) return;
    localStorage.setItem(
      "qlog.mhxx.progress.v1",
      JSON.stringify({
        schemaVersion: 1,
        completedQuestIds: [...ids, "future-id"],
        hr: 7,
      }),
    );
  }, ids);
  await page.goto("./");
  await page
    .getByRole("combobox", { name: "ランク", exact: true })
    .selectOption("7");
  await expect(page.getByRole("progressbar")).toHaveAttribute("value", "0");
  await page.getByRole("searchbox").fill("調査隊初陣");
  await page
    .getByRole("button", { name: /調査隊初陣！遺群嶺の桃毛獣/ })
    .click();
  await expect(page.locator(".state")).toHaveText("記録上の前提達成");
  await expect(
    page.getByRole("link", { name: /MHXX攻略レシピ（該当クエスト詳細）/ }),
  ).toHaveAttribute("href", "http://wiki.mhxg.org/ida/285740.html");
  await page
    .getByRole("checkbox", {
      name: "調査隊初陣！遺群嶺の桃毛獣をクリア",
      exact: true,
    })
    .check();
  await page
    .getByRole("button", { name: "村 ★6 / 宿命の四天王", exact: true })
    .click();
  await expect(page.locator(".state")).toHaveText("記録上の前提達成");
  await expect(
    page.getByRole("checkbox", { name: "宿命の四天王をクリア", exact: true }),
  ).toBeChecked();
  await page
    .getByRole("combobox", { name: "ランク", exact: true })
    .selectOption("8");
  await page.getByRole("searchbox").fill("冷血なるドスギアノス");
  await page
    .getByRole("checkbox", {
      name: "冷血なるドスギアノス！をクリア",
      exact: true,
    })
    .check();
  await page.getByRole("searchbox").fill("桃毛獣のトサカ");
  await page
    .getByRole("button", { name: /桃毛獣のトサカ破壊に挑戦！/ })
    .click();
  await expect(page.locator(".state")).toHaveText("記録上の前提達成");
  await expect(
    page.getByText("オトモの初期雇用レベル30〜32", { exact: false }),
  ).toBeVisible();
  await page
    .getByRole("checkbox", {
      name: "桃毛獣のトサカ破壊に挑戦！をクリア",
      exact: true,
    })
    .check();
  await expect
    .poll(() =>
      page.evaluate(
        () =>
          JSON.parse(localStorage.getItem("qlog.mhxx.progress.v1")!)
            .completedQuestIds as string[],
      ),
    )
    .toContain("village-8-recipe-288228");
  await page.reload();
  await page
    .getByRole("combobox", { name: "ランク", exact: true })
    .selectOption("8");
  await page.getByRole("searchbox").fill("桃毛獣のトサカ");
  await expect(
    page.getByRole("checkbox", {
      name: "桃毛獣のトサカ破壊に挑戦！をクリア",
      exact: true,
    }),
  ).toBeChecked();
  const pending = page.waitForEvent("download");
  await page.getByRole("button", { name: "JSONを書き出す" }).click();
  const exported = JSON.parse(
    await readFile((await (await pending).path())!, "utf8"),
  );
  expect(exported.schemaVersion).toBe(1);
  expect(exported.hr).toBe(7);
  expect(exported.completedQuestIds).toHaveLength(201);
  expect(exported.completedQuestIds).toEqual(
    expect.arrayContaining([
      ...ids,
      "future-id",
      "village-7-recipe-285740",
      "village-8-recipe-288226",
      "village-8-recipe-288228",
    ]),
  );
});

test("upper final conditions distinguish HR, the bounded all-clear set, and random appearance", async ({
  page,
}) => {
  const baseline: { id: string }[] = JSON.parse(
    await readFile("docs/progress-baseline-197.json", "utf8"),
  );
  const roster = JSON.parse(await readFile("docs/data-audit.json", "utf8")) as {
    ranks: { rank: string; entries: { recipeUrl: string }[] }[];
  };
  const ids = [
    ...baseline.map((q) => q.id),
    ...roster.ranks
      .filter((r) => Number(r.rank) >= 7)
      .flatMap((r) =>
        r.entries.map(
          (q) =>
            `village-${r.rank}-recipe-${q.recipeUrl.split("/").pop()!.replace(".html", "")}`,
        ),
      ),
  ];
  await page.addInitScript((ids) => {
    localStorage.setItem(
      "qlog.mhxx.progress.v1",
      JSON.stringify({ schemaVersion: 1, completedQuestIds: ids, hr: 9 }),
    );
  }, ids);
  await page.goto("./");
  await page
    .getByRole("combobox", { name: "ランク", exact: true })
    .selectOption("10");
  await page.getByRole("searchbox").fill("怨嗟の骸");
  await page.getByRole("button", { name: /怨嗟の骸/ }).click();
  await expect(page.locator(".state")).toHaveText("記録上の前提達成");
  await page.getByLabel("現在のHR").fill("8");
  await page.getByRole("button", { name: "HRを保存" }).click();
  await expect(page.locator(".state")).toHaveText("未達成");
  await page.getByLabel("現在のHR").fill("9");
  await page.getByRole("button", { name: "HRを保存" }).click();
  await expect(page.locator(".state")).toHaveText("記録上の前提達成");
  await page.getByRole("searchbox").fill("高難度：モンスターハンター");
  await page
    .getByRole("button", { name: /高難度：モンスターハンター/ })
    .click();
  await expect(page.locator(".state")).toHaveText("記録上の前提達成");
  await page
    .getByText("対象の前提クエストを表示（141条件）", { exact: true })
    .click();
  await expect(
    page.getByRole("button", {
      name: "村 ★7 / 調査隊初陣！遺群嶺の桃毛獣",
      exact: true,
    }),
  ).toBeVisible();
  await expect(
    page.getByText("ポッケ・ネーヴェ（特別入手）", { exact: false }),
  ).toBeVisible();
  await page.getByRole("searchbox").fill("高難度：宵闇に消ゆ");
  await page.getByRole("button", { name: /高難度：宵闇に消ゆ/ }).click();
  await expect(page.locator(".state")).toHaveText("要確認");
  await expect(
    page.getByText(
      "ランダム出現（現在の出現状態は保存記録から判定できません）",
      { exact: true },
    ),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});

test("hub rosters, roles and key flags match each audited rank and coverage", async ({
  page,
}) => {
  await page.goto("./");
  await page.getByRole("button", { name: "集会所", exact: true }).click();
  for (const [rank, count, keys] of [
    ["1", 31, 5],
    ["2", 35, 6],
    ["3", 38, 6],
  ] as const) {
    await page
      .getByRole("combobox", { name: "ランク", exact: true })
      .selectOption(rank);
    await expect(page.locator(".quest-card")).toHaveCount(count);
    await expect(page.getByRole("progressbar")).toHaveAttribute(
      "max",
      String(count),
    );
    await page
      .getByRole("combobox", { name: "プレイ種別", exact: true })
      .selectOption("prowler");
    await expect(page.locator(".quest-card")).toHaveCount(3);
    await page
      .getByRole("combobox", { name: "プレイ種別", exact: true })
      .selectOption("");
    await page
      .getByRole("combobox", { name: "種別", exact: true })
      .selectOption("key");
    await expect(page.locator(".quest-card")).toHaveCount(keys);
    await page
      .getByRole("combobox", { name: "種別", exact: true })
      .selectOption("");
  }
  await page.getByText("収録状況と出典について", { exact: true }).click();
  const table = page.getByRole("table").filter({
    has: page.getByText("集会所★1〜7の収録状況", { exact: true }),
  });
  await expect(table).toContainText("31");
  await expect(table).toContainText("35");
  await expect(table).toContainText("38");
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});

test("legacy 370-check backups merge with new hub progress and preserve HR and unknown IDs", async ({
  page,
}) => {
  const ids = (
    JSON.parse(await readFile("docs/progress-baseline-370.json", "utf8")) as {
      id: string;
    }[]
  ).map((q) => q.id);
  await page.goto("./");
  await page.getByLabel("バックアップファイル").setInputFiles(
    backup({
      schemaVersion: 1,
      completedQuestIds: [...ids, "future-hub-id"],
      hr: 6,
    }),
  );
  await expect(
    page.getByText("未収録のID：1件（削除せず保持します）"),
  ).toBeVisible();
  await page
    .getByRole("checkbox", { name: "現在の進捗をファイルで置き換える" })
    .check();
  await page.getByRole("button", { name: "置き換えて復元" }).click();
  await page.getByRole("button", { name: "集会所", exact: true }).click();
  await page
    .getByRole("combobox", { name: "ランク", exact: true })
    .selectOption("1");
  await page.getByRole("searchbox").fill("古代林の採集ツアー");
  await page
    .getByRole("checkbox", { name: "古代林の採集ツアーをクリア", exact: true })
    .check();
  await page.reload();
  await page.getByRole("button", { name: "集会所", exact: true }).click();
  await page
    .getByRole("combobox", { name: "ランク", exact: true })
    .selectOption("1");
  await expect(
    page.getByRole("checkbox", {
      name: "古代林の採集ツアーをクリア",
      exact: true,
    }),
  ).toBeChecked();
  await expect(page.getByLabel("現在のHR")).toHaveValue("6");
  const pending = page.waitForEvent("download");
  await page.getByRole("button", { name: "JSONを書き出す" }).click();
  const exported = JSON.parse(
    await readFile((await (await pending).path())!, "utf8"),
  );
  expect(exported.schemaVersion).toBe(1);
  expect(exported.hr).toBe(6);
  expect(exported.completedQuestIds).toHaveLength(372);
  expect(exported.completedQuestIds).toEqual(
    expect.arrayContaining([...ids, "future-hub-id", "hub-1-recipe-218337"]),
  );
});

test("village and hub prerequisite navigation works in both directions and reports do not block known gates", async ({
  page,
}) => {
  const ids = (
    JSON.parse(await readFile("docs/progress-baseline-370.json", "utf8")) as {
      id: string;
    }[]
  ).map((q) => q.id);
  await page.addInitScript((ids) => {
    if (!localStorage.getItem("qlog.mhxx.progress.v1"))
      localStorage.setItem(
        "qlog.mhxx.progress.v1",
        JSON.stringify({ schemaVersion: 1, completedQuestIds: ids, hr: 6 }),
      );
  }, ids);
  await page.goto("./");
  await page
    .getByRole("combobox", { name: "ランク", exact: true })
    .selectOption("9");
  await page.getByRole("searchbox").fill("雪山、雪玉、雪合戦");
  await page.getByRole("button", { name: /雪山、雪玉、雪合戦/ }).click();
  await expect(page.locator(".state")).toHaveText("未達成");
  await page
    .getByRole("button", {
      name: "集会所 ★1（下位） / 新たな食材ハンターの誕生！？",
      exact: true,
    })
    .click();
  await expect(
    page.getByRole("heading", { name: "集会所 ★1（下位）", exact: true }),
  ).toBeVisible();
  await expect(page.locator(".state")).toHaveText("記録上の前提達成");
  await expect(page.getByText("チココーン", { exact: false })).toBeVisible();
  const link = page.getByRole("link", {
    name: /MHXX攻略レシピ（該当クエスト詳細）/,
  });
  await expect(link).toHaveAttribute(
    "href",
    "http://wiki.mhxg.org/ida/220241.html",
  );
  await expect(link).toHaveAttribute("target", "_blank");
  await expect(link).toHaveAttribute("rel", "noopener noreferrer");
  await page
    .getByRole("checkbox", {
      name: "新たな食材ハンターの誕生！？をクリア",
      exact: true,
    })
    .check();
  await page
    .getByRole("button", {
      name: "村 ★9 / 雪山、雪玉、雪合戦！！",
      exact: true,
    })
    .click();
  await expect(page.locator(".state")).toHaveText("記録上の前提達成");
  await expect(
    page.getByText("キャラバンの料理長の依頼1を達成後、依頼主へ報告する。", {
      exact: true,
    }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});

test("new hub-5 completion resolves the village chain while material delivery remains untracked", async ({
  page,
}) => {
  const ids = (
    JSON.parse(await readFile("docs/progress-baseline-370.json", "utf8")) as {
      id: string;
    }[]
  ).map((q) => q.id);
  for (const rank of [1, 2, 3])
    ids.push(
      ...(
        JSON.parse(await readFile(`src/data/hub-${rank}.json`, "utf8")) as {
          id: string;
        }[]
      ).map((q) => q.id),
    );
  await page.addInitScript(
    (ids) =>
      localStorage.setItem(
        "qlog.mhxx.progress.v1",
        JSON.stringify({ schemaVersion: 1, completedQuestIds: ids, hr: 5 }),
      ),
    ids,
  );
  await page.goto("./");
  await page
    .getByRole("combobox", { name: "ランク", exact: true })
    .selectOption("10");
  await page.getByRole("searchbox").fill("遺群嶺を塞ぐ恐暴竜");
  await page.getByRole("button", { name: /遺群嶺を塞ぐ恐暴竜/ }).click();
  await expect(page.locator(".state")).toHaveText("未達成");
  await expect(
    page.getByRole("button", {
      name: "集会所 ★3（下位） / 化石に眠る太古の記憶",
      exact: true,
    }),
  ).toBeVisible();
  await page
    .getByRole("button", {
      name: "集会所 ★5（上位） / 雪山の主、ドドブランゴ",
      exact: true,
    })
    .click();
  await expect(page.locator(".state")).toHaveText("記録上の前提達成");
  await page
    .getByRole("checkbox", {
      name: "雪山の主、ドドブランゴをクリア",
      exact: true,
    })
    .check();
  await page
    .getByRole("button", { name: "村 ★10 / 遺群嶺を塞ぐ恐暴竜", exact: true })
    .click();
  await expect(page.locator(".state")).toHaveText("記録上の前提達成");
  await page.getByRole("button", { name: "集会所", exact: true }).click();
  await page
    .getByRole("combobox", { name: "ランク", exact: true })
    .selectOption("2");
  await page.getByRole("searchbox").fill("無謀な弟子");
  await page.getByRole("button", { name: /無謀な弟子/ }).click();
  await expect(page.locator(".state")).toHaveText("要確認");
  await expect(
    page.getByText("オトモ武具屋の依頼1：納品 マカライト鉱石 x2大猪の皮 x1", {
      exact: true,
    }),
  ).toBeVisible();
});

test("upper hub rosters expose every role, key and urgent count", async ({
  page,
}) => {
  await page.goto("./");
  await page.getByRole("button", { name: "集会所", exact: true }).click();
  for (const [rank, count, prowlers, keys, urgents] of [
    ["4", 38, 4, 4, 0],
    ["5", 51, 5, 5, 1],
    ["6", 71, 4, 5, 2],
    ["7", 75, 4, 6, 3],
  ] as const) {
    await page
      .getByRole("combobox", { name: "ランク", exact: true })
      .selectOption(rank);
    await expect(page.locator(".quest-card")).toHaveCount(count);
    await page
      .getByRole("combobox", { name: "プレイ種別", exact: true })
      .selectOption("prowler");
    await expect(page.locator(".quest-card")).toHaveCount(prowlers);
    await page
      .getByRole("combobox", { name: "プレイ種別", exact: true })
      .selectOption("");
    for (const [type, n] of [
      ["key", keys],
      ["urgent", urgents],
    ] as const) {
      await page
        .getByRole("combobox", { name: "種別", exact: true })
        .selectOption(type);
      await expect(page.locator(".quest-card")).toHaveCount(n);
    }
    await page
      .getByRole("combobox", { name: "種別", exact: true })
      .selectOption("");
  }
  await page.getByText("収録状況と出典について", { exact: true }).click();
  const table = page
    .getByRole("table")
    .filter({ has: page.getByText("集会所★1〜7の収録状況", { exact: true }) });
  for (const count of [38, 51, 71, 75])
    await expect(table).toContainText(String(count));
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});

test("old 474-check JSON restores HR and unknown IDs while new upper checks persist", async ({
  page,
}) => {
  const ids = (
    JSON.parse(await readFile("docs/progress-baseline-474.json", "utf8")) as {
      id: string;
    }[]
  ).map((q) => q.id);
  await page.goto("./");
  await page.getByLabel("バックアップファイル").setInputFiles(
    backup({
      schemaVersion: 1,
      completedQuestIds: [...ids, "future-g-id"],
      hr: 8,
    }),
  );
  await expect(
    page.getByText("未収録のID：1件（削除せず保持します）"),
  ).toBeVisible();
  await page
    .getByRole("checkbox", { name: "現在の進捗をファイルで置き換える" })
    .check();
  await page.getByRole("button", { name: "置き換えて復元" }).click();
  await page.getByRole("button", { name: "集会所", exact: true }).click();
  await page
    .getByRole("combobox", { name: "ランク", exact: true })
    .selectOption("4");
  await page.getByRole("searchbox").fill("大師範の試練");
  await page
    .getByRole("checkbox", { name: "大師範の試練をクリア", exact: true })
    .check();
  await page.reload();
  await page.getByRole("searchbox").fill("大師範の試練");
  await expect(
    page.getByRole("checkbox", { name: "大師範の試練をクリア", exact: true }),
  ).toBeChecked();
  await expect(page.getByLabel("現在のHR")).toHaveValue("8");
  const pending = page.waitForEvent("download");
  await page.getByRole("button", { name: "JSONを書き出す" }).click();
  const exported = JSON.parse(
    await readFile((await (await pending).path())!, "utf8"),
  );
  expect(exported.schemaVersion).toBe(1);
  expect(exported.hr).toBe(8);
  expect(exported.completedQuestIds).toHaveLength(476);
  expect(exported.completedQuestIds).toEqual(
    expect.arrayContaining([...ids, "future-g-id", "hub-4-recipe-228766"]),
  );
});

test("upper progress distinguishes G-transition HR, random spawns, deliveries and village residuals", async ({
  page,
}) => {
  const ids = (
    JSON.parse(await readFile("docs/progress-baseline-474.json", "utf8")) as {
      id: string;
    }[]
  ).map((q) => q.id);
  for (const rank of [4, 5, 6, 7])
    ids.push(
      ...(
        JSON.parse(await readFile(`src/data/hub-${rank}.json`, "utf8")) as {
          id: string;
        }[]
      ).map((q) => q.id),
    );
  await page.addInitScript((ids) => {
    if (!localStorage.getItem("qlog.mhxx.progress.v1"))
      localStorage.setItem(
        "qlog.mhxx.progress.v1",
        JSON.stringify({ schemaVersion: 1, completedQuestIds: ids, hr: 8 }),
      );
  }, ids);
  await page.goto("./");
  await page.getByRole("button", { name: "集会所", exact: true }).click();
  await page
    .getByRole("combobox", { name: "ランク", exact: true })
    .selectOption("7");
  await page.getByRole("searchbox").fill("その腕前");
  await page.getByRole("button", { name: /その腕前/ }).click();
  await expect(page.locator(".state")).toHaveText("記録上の前提達成");
  await expect(
    page.getByRole("button", {
      name: "集会所 ★7（上位） / 遺跡平原からの伝書",
      exact: true,
    }),
  ).toBeVisible();
  await expect(
    page.getByText("G級（G★1・HR9）への進行", { exact: false }),
  ).toBeVisible();
  await page.getByLabel("現在のHR").fill("7");
  await page.getByRole("button", { name: "HRを保存" }).click();
  await expect(page.locator(".state")).toHaveText("未達成");
  await page.getByLabel("現在のHR").fill("9");
  await page.getByRole("button", { name: "HRを保存" }).click();
  await page.getByRole("searchbox").fill("氷点下の支配者");
  await page.getByRole("button", { name: /氷点下の支配者/ }).click();
  await expect(page.locator(".state")).toHaveText("要確認");
  await expect(
    page.getByText(
      "ランダム出現（現在の出現状態は保存記録から判定できません）",
      { exact: true },
    ),
  ).toBeVisible();
  await page.getByRole("searchbox").fill("蒼く渦巻く登竜門");
  await page.getByRole("button", { name: /蒼く渦巻く登竜門/ }).click();
  await expect(page.locator(".state")).toHaveText("要確認");
  await expect(
    page.getByText(
      "交易船の船長の依頼3：納品 ユクモの木 x5泡立つ滑液 x2海綿質の上皮 x1",
      { exact: true },
    ),
  ).toBeVisible();
  await page.getByRole("button", { name: "村", exact: true }).click();
  await page
    .getByRole("combobox", { name: "ランク", exact: true })
    .selectOption("9");
  await page.getByRole("searchbox").fill("轟竜の狩猟をさせてやるぜ");
  await page.getByRole("button", { name: /轟竜の狩猟をさせてやるぜ/ }).click();
  await expect(page.locator(".state")).toHaveText("未達成");
  await expect(
    page.getByRole("button", {
      name: "G級 G★2 / 泥まみれの商魂！",
      exact: true,
    }),
  ).toBeVisible();
  await page
    .getByRole("button", {
      name: "集会所 ★7（上位） / 空の飛竜と陸の飛竜",
      exact: true,
    })
    .click();
  await expect(
    page.getByRole("button", {
      name: "村 ★9 / 轟竜の狩猟をさせてやるぜ！",
      exact: true,
    }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});

test("unlock badges show once, distinguish reference-only data, and survive checks/reload", async ({
  page,
}) => {
  await page.goto("./");
  await page.getByRole("button", { name: "集会所", exact: true }).click();
  await page
    .getByRole("combobox", { name: "ランク", exact: true })
    .selectOption("4");
  for (const name of [
    "ライバルの激突！！",
    "大地を泳ぐモンスター",
    "超☆メモ帳～跳狗竜狩猟編～",
  ]) {
    const card = page
      .locator(".quest-card")
      .filter({ has: page.locator(".quest-name", { hasText: name }) });
    await expect(card.locator(".tag-unlock")).toHaveCount(1);
  }
  await page.getByRole("searchbox").fill("ライバルの激突");
  const card = page.locator(".quest-card");
  await card.getByRole("checkbox").check();
  await expect(card.locator(".tag-unlock")).toHaveText("解放あり");
  await card.locator(".quest-title").click();
  await expect(card.locator(".quest-details")).toBeVisible();
  await expect(card.locator(".quest-details")).toContainText("製法");
  const bounds = await card.boundingBox();
  expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(
    page.viewportSize()!.width,
  );
  await page.reload();
  await page.getByRole("button", { name: "集会所", exact: true }).click();
  await page
    .getByRole("combobox", { name: "ランク", exact: true })
    .selectOption("4");
  await page.getByRole("searchbox").fill("ライバルの激突");
  await expect(page.locator(".quest-card").getByRole("checkbox")).toBeChecked();
  await expect(page.locator(".tag-unlock")).toHaveCount(1);
  await page.getByRole("searchbox").fill("");
  await page
    .getByRole("combobox", { name: "ランク", exact: true })
    .selectOption("7");
  const hrOnly = page
    .locator(".quest-card")
    .filter({ has: page.getByText("奈落の妖星", { exact: true }) });
  await expect(hrOnly.locator(".tag-unlock")).toHaveCount(0);
  await page.getByRole("button", { name: "村", exact: true }).click();
  await page
    .getByRole("combobox", { name: "ランク", exact: true })
    .selectOption("2");
  const marker = page
    .locator(".quest-card")
    .filter({ has: page.getByText("青熊獣アオアシラ", { exact: true }) });
  await expect(marker.locator(".tag-unlock")).toHaveCount(1);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
});

test("all G-rank rosters, flags and coverage remain operable at phone width", async ({
  page,
}) => {
  await page.goto("./");
  await page.getByRole("button", { name: "G級", exact: true }).click();
  for (const [rank, count, prowlers, keys, urgents, requests] of [
    ["G1", 32, 3, 5, 0, 6],
    ["G2", 53, 3, 6, 1, 17],
    ["G3", 59, 4, 6, 1, 8],
    ["G4", 86, 5, 6, 2, 11],
  ] as const) {
    await page
      .getByRole("combobox", { name: "ランク", exact: true })
      .selectOption(rank);
    await expect(page.locator(".quest-card")).toHaveCount(count);
    await page
      .getByRole("combobox", { name: "プレイ種別", exact: true })
      .selectOption("prowler");
    await expect(page.locator(".quest-card")).toHaveCount(prowlers);
    await page
      .getByRole("combobox", { name: "プレイ種別", exact: true })
      .selectOption("");
    for (const [type, n] of [
      ["key", keys],
      ["urgent", urgents],
      ["request", requests],
    ] as const) {
      await page
        .getByRole("combobox", { name: "種別", exact: true })
        .selectOption(type);
      await expect(page.locator(".quest-card")).toHaveCount(n);
    }
    await page
      .getByRole("combobox", { name: "種別", exact: true })
      .selectOption("");
  }
  await page.getByText("収録状況と出典について", { exact: true }).click();
  const table = page
    .getByRole("table")
    .filter({ has: page.getByText("G★1〜4の収録状況", { exact: true }) });
  for (const n of [32, 53, 59, 86])
    await expect(table).toContainText(String(n));
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});

test("old 709 checks restore unchanged while new G checks, HR, unknown IDs and badges persist", async ({
  page,
}) => {
  const ids = (
    JSON.parse(await readFile("docs/progress-baseline-709.json", "utf8")) as {
      id: string;
    }[]
  ).map((q) => q.id);
  await page.goto("./");
  await page.getByLabel("バックアップファイル").setInputFiles(
    backup({
      schemaVersion: 1,
      completedQuestIds: [...ids, "future-stage-id"],
      hr: 80,
    }),
  );
  await page
    .getByRole("checkbox", { name: "現在の進捗をファイルで置き換える" })
    .check();
  await page.getByRole("button", { name: "置き換えて復元" }).click();
  await expect(page.getByLabel("現在のHR")).toHaveValue("80");
  await page.getByRole("button", { name: "G級", exact: true }).click();
  await page
    .getByRole("combobox", { name: "ランク", exact: true })
    .selectOption("G2");
  await page.getByRole("searchbox").fill("泥まみれの商魂");
  const card = page.locator(".quest-card");
  await expect(card.locator(".tag-unlock")).toHaveCount(1);
  await card.locator(".quest-title").click();
  await expect(card.locator(".state")).toHaveText("未達成");
  await page.getByRole("searchbox").fill("");
  await page
    .getByRole("combobox", { name: "ランク", exact: true })
    .selectOption("G1");
  await page
    .getByRole("combobox", { name: "種別", exact: true })
    .selectOption("key");
  const newKeys = page.locator(".quest-card").getByRole("checkbox");
  await expect(newKeys).toHaveCount(5);
  for (let i = 0; i < 5; i++) await newKeys.nth(i).check();
  await page
    .getByRole("combobox", { name: "種別", exact: true })
    .selectOption("");
  await page
    .getByRole("combobox", { name: "ランク", exact: true })
    .selectOption("G2");
  await page.getByRole("searchbox").fill("泥まみれの商魂");
  await card.locator(".quest-title").click();
  await expect(card.locator(".state")).toHaveText("記録上の前提達成");
  await expect(
    card.getByRole("link", { name: /MHXX攻略レシピ（該当クエスト詳細）/ }),
  ).toHaveAttribute("href", "http://wiki.mhxg.org/ida/286190.html");
  await card.getByRole("checkbox").check();
  await page.screenshot({
    path: `test-results/g2-${test.info().project.name}.png`,
    fullPage: true,
  });
  await page.reload();
  await expect(
    page.getByRole("checkbox", {
      name: "泥まみれの商魂！をクリア",
      exact: true,
    }),
  ).toBeChecked();
  await expect(page.locator(".tag-unlock")).toHaveCount(1);
  await expect(page.getByLabel("現在のHR")).toHaveValue("80");
  await page.getByRole("searchbox").fill("");
  await page
    .getByRole("combobox", { name: "ランク", exact: true })
    .selectOption("G4");
  await page.getByRole("searchbox").fill("蠢く墟城");
  await expect(page.locator(".tag-unlock")).toHaveCount(0);
  await page
    .getByRole("checkbox", { name: "蠢く墟城をクリア", exact: true })
    .check();
  await page.getByRole("button", { name: "村", exact: true }).click();
  await page
    .getByRole("combobox", { name: "ランク", exact: true })
    .selectOption("10");
  await page.getByRole("searchbox").fill("高難度：雪山に佇む轟竜");
  await page.locator(".quest-title").click();
  await expect(page.locator(".state")).toHaveText("記録上の前提達成");
  await page
    .getByRole("button", { name: "G級 G★4 / 蠢く墟城", exact: true })
    .click();
  await expect(
    page.getByRole("button", {
      name: "村 ★10 / 高難度：雪山に佇む轟竜",
      exact: true,
    }),
  ).toBeVisible();
  const pending = page.waitForEvent("download");
  await page.getByRole("button", { name: "JSONを書き出す" }).click();
  const exported = JSON.parse(
    await readFile((await (await pending).path())!, "utf8"),
  );
  expect(exported.schemaVersion).toBe(1);
  expect(exported.hr).toBe(80);
  expect(exported.completedQuestIds).toHaveLength(717);
  expect(exported.completedQuestIds).toEqual(
    expect.arrayContaining([
      ...ids,
      "future-stage-id",
      "g-rank-2-recipe-286190",
      "g-rank-4-recipe-294013",
    ]),
  );
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});

test("unlock filter combines with role, search, incomplete and restores new and old view values", async ({
  page,
}) => {
  await page.addInitScript(() => {
    if (!localStorage.getItem("qlog.mhxx.view.v1"))
      localStorage.setItem(
        "qlog.mhxx.view.v1",
        JSON.stringify({
          category: "hub",
          rank: "4",
          tag: "request",
          role: "",
          search: "",
          incomplete: false,
        }),
      );
  });
  await page.goto("./");
  const type = page.getByRole("combobox", { name: "種別", exact: true });
  await expect(type).toHaveValue("request");
  await expect(page.locator(".quest-card")).toHaveCount(3);
  await type.selectOption("unlock");
  await expect(page.locator(".quest-card")).toHaveCount(6);
  await expect(page.locator(".quest-card .tag-unlock")).toHaveCount(6);
  await page
    .getByRole("combobox", { name: "プレイ種別", exact: true })
    .selectOption("prowler");
  await expect(page.locator(".quest-card")).toHaveCount(1);
  await page.getByRole("searchbox").fill("大師範");
  await page
    .getByRole("checkbox", { name: "大師範の試練をクリア", exact: true })
    .check();
  await page.getByRole("checkbox", { name: "未クリアのみ" }).check();
  await expect(page.locator(".quest-card")).toHaveCount(0);
  await page.reload();
  await expect(type).toHaveValue("unlock");
  await expect(page.getByRole("searchbox")).toHaveValue("大師範");
  await expect(
    page.getByRole("checkbox", { name: "未クリアのみ" }),
  ).toBeChecked();
  await page.getByRole("checkbox", { name: "未クリアのみ" }).uncheck();
  await expect(
    page.getByRole("checkbox", { name: "大師範の試練をクリア", exact: true }),
  ).toBeChecked();
  await page.getByRole("searchbox").fill("");
  await page
    .getByRole("combobox", { name: "プレイ種別", exact: true })
    .selectOption("");
  await type.selectOption("");
  await expect(page.locator(".quest-card")).toHaveCount(38);
  await page
    .getByRole("combobox", { name: "ランク", exact: true })
    .selectOption("7");
  await type.selectOption("unlock");
  await page.getByRole("searchbox").fill("奈落の妖星");
  await expect(page.locator(".quest-card")).toHaveCount(0);
  await type.selectOption("");
  await expect(page.locator(".quest-card")).toHaveCount(1);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});

test("permit selector uses 18 named groups and migrates the legacy all-stages view", async ({
  page,
}) => {
  await page.addInitScript(() => {
    if (!localStorage.getItem("qlog.mhxx.view.v1"))
      localStorage.setItem(
        "qlog.mhxx.view.v1",
        JSON.stringify({
          category: "permit",
          rank: "全段階",
          tag: "unlock",
          role: "hunter",
          search: "",
          incomplete: false,
        }),
      );
  });
  await page.goto("./");
  const selector = page.getByRole("combobox", { name: "二つ名", exact: true });
  await expect(selector).toHaveValue("紅兜");
  await expect(selector.locator("option")).toHaveCount(18);
  await expect(
    page.getByRole("combobox", { name: "種別", exact: true }),
  ).toHaveValue("unlock");
  await expect(
    page.getByText(/自分の特殊許可として受注・クリアし/),
  ).toBeVisible();
  for (const [id, label] of [
    ["紅兜", "紅兜アオアシラ"],
    ["大雪主", "大雪主ウルクスス"],
    ["矛砕", "矛砕ダイミョウザザミ"],
    ["紫毒姫", "紫毒姫リオレイア"],
    ["岩穿", "岩穿テツカブラ"],
    ["白疾風", "白疾風ナルガクルガ"],
    ["宝纏", "宝纏ウラガンキン"],
    ["隻眼", "隻眼イャンガルルガ"],
    ["黒炎王", "黒炎王リオレウス"],
    ["金雷公", "金雷公ジンオウガ"],
    ["荒鉤爪", "荒鉤爪ティガレックス"],
    ["燼滅刃", "燼滅刃ディノバルド"],
    ["朧隠", "朧隠ホロロホルル"],
    ["鎧裂", "鎧裂ショウグンギザミ"],
    ["天眼", "天眼タマミツネ"],
    ["青電主", "青電主ライゼクス"],
    ["銀嶺", "銀嶺ガムート"],
    ["鏖魔", "鏖魔ディアブロス"],
  ]) {
    await selector.selectOption(id);
    await expect(
      page.getByRole("heading", { name: `特殊許可 ${label}`, exact: true }),
    ).toBeVisible();
    await expect(page.getByRole("progressbar")).toHaveAttribute("value", "0");
  }
  await page.reload();
  await expect(selector).toHaveValue("鏖魔");
  await page
    .getByRole("combobox", { name: "種別", exact: true })
    .selectOption("");
  await page
    .getByRole("combobox", { name: "プレイ種別", exact: true })
    .selectOption("");
  await page.getByRole("button", { name: "村", exact: true }).click();
  await page
    .getByRole("combobox", { name: "ランク", exact: true })
    .selectOption("3");
  await expect(page.locator(".quest-card")).toHaveCount(45);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});

test("all permit groups show audited stages, real unlock filters and independent saved progress", async ({
  page,
}) => {
  const audit = JSON.parse(
    await readFile("docs/permit-roster-audit.json", "utf8"),
  ) as {
    groups: {
      id: string;
      legacy: boolean;
      observedCount: number;
      entries: { name: string; permitStage: string }[];
    }[];
  };
  await page.goto("./");
  await page.getByRole("button", { name: "特殊許可", exact: true }).click();
  const group = page.getByRole("combobox", { name: "二つ名", exact: true }),
    type = page.getByRole("combobox", { name: "種別", exact: true });
  for (const g of audit.groups) {
    await group.selectOption(g.id);
    await expect(page.locator(".quest-card")).toHaveCount(g.observedCount);
    await expect(page.locator(".quest-name")).toHaveText(
      g.entries.map((e) => e.name),
    );
    await expect(page.locator(".quest-tags > span:first-child")).toHaveText(
      g.entries.map((e) => e.permitStage),
    );
    await expect(page.getByRole("progressbar")).toHaveAttribute(
      "max",
      String(g.observedCount),
    );
    await type.selectOption("unlock");
    await expect(page.locator(".quest-card")).toHaveCount(g.legacy ? 6 : 4);
    await expect(page.locator(".tag-unlock")).toHaveCount(g.legacy ? 6 : 4);
    await type.selectOption("");
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
  }
  await type.selectOption("request");
  await expect(page.locator(".quest-card")).toHaveCount(1);
  await expect(page.locator(".quest-name")).toHaveText(
    "【特殊許可】鏖魔狩猟依頼G1",
  );
  await type.selectOption("");
  await page
    .getByRole("combobox", { name: "プレイ種別", exact: true })
    .selectOption("prowler");
  await expect(page.locator(".quest-card")).toHaveCount(0);
  await page
    .getByRole("combobox", { name: "プレイ種別", exact: true })
    .selectOption("");
  await group.selectOption("紅兜");
  await page
    .getByRole("checkbox", {
      name: "【特殊許可】紅兜狩猟依頼１をクリア",
      exact: true,
    })
    .check();
  await expect(page.getByRole("progressbar")).toHaveAttribute("value", "1");
  await page
    .locator(".quest-card")
    .first()
    .screenshot({
      path: `test-results/permit-card-${test.info().project.name}.png`,
    });
  await group.selectOption("大雪主");
  await expect(page.getByRole("progressbar")).toHaveAttribute("value", "0");
  await group.selectOption("紅兜");
  await page.reload();
  await expect(group).toHaveValue("紅兜");
  await expect(page.getByRole("progressbar")).toHaveAttribute("value", "1");
  await expect(
    page.getByRole("checkbox", {
      name: "【特殊許可】紅兜狩猟依頼１をクリア",
      exact: true,
    }),
  ).toBeChecked();
});

test("permit predecessor and successor navigation preserves HR100 and Bloodbath's ordered residual", async ({
  page,
}) => {
  const ids = (
    JSON.parse(await readFile("docs/progress-baseline-939.json", "utf8")) as {
      id: string;
    }[]
  ).map((q) => q.id);
  await page.addInitScript((ids) => {
    if (!localStorage.getItem("qlog.mhxx.progress.v1"))
      localStorage.setItem(
        "qlog.mhxx.progress.v1",
        JSON.stringify({ schemaVersion: 1, completedQuestIds: ids, hr: 99 }),
      );
  }, ids);
  await page.goto("./");
  await page.getByRole("button", { name: "特殊許可", exact: true }).click();
  const card = page.locator("#quest-permit-redhelm-lv1-recipe-218339");
  await card.locator(".quest-title").click();
  await expect(card.locator(".state")).toHaveText("記録上の前提達成");
  await expect(
    card.locator('a[href="http://wiki.mhxg.org/ida/218339.html"]'),
  ).toBeVisible();
  await card.getByRole("checkbox").check();
  await page
    .getByRole("button", {
      name: "特殊許可 紅兜アオアシラ / 【特殊許可】紅兜捕獲依頼２",
      exact: true,
    })
    .click();
  await expect(page.locator(".state")).toHaveText("記録上の前提達成");
  await page
    .getByRole("button", {
      name: "特殊許可 紅兜アオアシラ / 【特殊許可】紅兜狩猟依頼１",
      exact: true,
    })
    .click();
  await page
    .getByRole("button", {
      name: "集会所 ★1（下位） / 伝説のメニューに不可欠なモノ",
      exact: true,
    })
    .click();
  await expect(
    page.getByRole("button", {
      name: "特殊許可 紅兜アオアシラ / 【特殊許可】紅兜狩猟依頼１",
      exact: true,
    }),
  ).toBeVisible();
  await page
    .getByRole("button", {
      name: "特殊許可 紅兜アオアシラ / 【特殊許可】紅兜狩猟依頼１",
      exact: true,
    })
    .click();
  await page.getByRole("searchbox").fill("超特殊許可");
  await page.locator(".quest-title").click();
  await expect(page.locator(".state")).toHaveText("未達成");
  await page.getByLabel("現在のHR").fill("100");
  await page.getByRole("button", { name: "HRを保存" }).click();
  await expect(page.locator(".state")).toHaveText("未達成");
  await page
    .getByRole("button", {
      name: "特殊許可 紅兜アオアシラ / 【特殊許可】紅兜狩猟依頼G5",
      exact: true,
    })
    .click();
  await page
    .getByRole("checkbox", {
      name: "【特殊許可】紅兜狩猟依頼G5をクリア",
      exact: true,
    })
    .check();
  await page
    .getByRole("button", {
      name: "特殊許可 紅兜アオアシラ / 【超特殊許可】紅兜狩猟依頼",
      exact: true,
    })
    .click();
  await expect(page.locator(".state")).toHaveText("記録上の前提達成");
  await expect(page.locator(".quest-details")).toContainText(
    "防具合成の研究：紅兜",
  );
  for (const g of ["朧隠", "鎧裂", "天眼", "青電主", "銀嶺"]) {
    await page
      .getByRole("combobox", { name: "二つ名", exact: true })
      .selectOption(g);
    await page
      .getByRole("checkbox", {
        name: `【特殊許可】${g}捕獲依頼G1をクリア`,
        exact: true,
      })
      .check();
  }
  await page
    .getByRole("combobox", { name: "二つ名", exact: true })
    .selectOption("鏖魔");
  await page.getByRole("searchbox").fill("鏖魔狩猟依頼G1");
  await page.locator(".quest-title").click();
  await expect(page.locator(".state")).toHaveText("要確認");
  await expect(
    page.getByText(/前提達成後の酒場での会話→クエスト1回クリア/),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});

test("version-1 backup of 939 old checks restores with HR and unknown IDs alongside new permit checks", async ({
  page,
}) => {
  const ids = (
    JSON.parse(await readFile("docs/progress-baseline-939.json", "utf8")) as {
      id: string;
    }[]
  ).map((q) => q.id);
  await page.goto("./");
  await page.getByLabel("バックアップファイル").setInputFiles(
    backup({
      schemaVersion: 1,
      completedQuestIds: [...ids, "future-stage9-id"],
      hr: 100,
    }),
  );
  await page
    .getByRole("checkbox", { name: "現在の進捗をファイルで置き換える" })
    .check();
  await page.getByRole("button", { name: "置き換えて復元" }).click();
  await page.getByRole("button", { name: "特殊許可", exact: true }).click();
  for (const [group, name] of [
    ["紅兜", "【特殊許可】紅兜狩猟依頼１"],
    ["大雪主", "【特殊許可】大雪主狩猟依頼１"],
    ["朧隠", "【特殊許可】朧隠捕獲依頼G1"],
  ]) {
    await page
      .getByRole("combobox", { name: "二つ名", exact: true })
      .selectOption(group);
    await page
      .getByRole("checkbox", { name: `${name}をクリア`, exact: true })
      .check();
  }
  await page.reload();
  await expect(
    page.getByRole("checkbox", {
      name: "【特殊許可】朧隠捕獲依頼G1をクリア",
      exact: true,
    }),
  ).toBeChecked();
  await expect(page.getByLabel("現在のHR")).toHaveValue("100");
  const pending = page.waitForEvent("download");
  await page.getByRole("button", { name: "JSONを書き出す" }).click();
  const exported = JSON.parse(
    await readFile((await (await pending).path())!, "utf8"),
  );
  expect(exported.schemaVersion).toBe(1);
  expect(exported.hr).toBe(100);
  expect(exported.completedQuestIds).toHaveLength(943);
  expect(exported.completedQuestIds).toEqual(
    expect.arrayContaining([
      ...ids,
      "future-stage9-id",
      "permit-redhelm-lv1-recipe-218339",
    ]),
  );
  expect(exported.dataset).toBe("mhxx");
  expect(Object.keys(exported).sort()).toEqual([
    "completedQuestIds",
    "dataset",
    "hr",
    "schemaVersion",
  ]);
});

test("event has three published divisions and migrates the legacy view without losing filters", async ({
  page,
}) => {
  await page.addInitScript(() => {
    if (!localStorage.getItem("event-migration-seeded")) {
      localStorage.setItem(
        "qlog.mhxx.view.v1",
        JSON.stringify({
          category: "event",
          rank: "全ランク",
          search: "コラボ",
          tag: "unlock",
          role: "prowler",
          incomplete: true,
        }),
      );
      localStorage.setItem("event-migration-seeded", "yes");
    }
  });
  await page.goto("./");
  const rank = page.getByRole("combobox", { name: "ランク", exact: true });
  await expect(rank).toHaveValue("下位");
  await expect(rank.locator("option")).toHaveText(["下位", "上位", "G級"]);
  await expect(page.getByRole("searchbox")).toHaveValue("コラボ");
  await expect(
    page.getByRole("combobox", { name: "種別", exact: true }),
  ).toHaveValue("unlock");
  await expect(
    page.getByRole("combobox", { name: "プレイ種別", exact: true }),
  ).toHaveValue("prowler");
  await expect(
    page.getByRole("checkbox", { name: "未クリアのみ" }),
  ).toBeChecked();
  for (const r of ["上位", "G級", "下位"]) {
    await rank.selectOption(r);
    await expect(
      page.getByRole("heading", { name: `イベント ${r}`, exact: true }),
    ).toBeVisible();
  }
  await page.reload();
  await expect(rank).toHaveValue("下位");
  await expect(page.getByRole("searchbox")).toHaveValue("コラボ");
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.getByRole("button", { name: "特殊許可", exact: true }).click();
  await expect(
    page
      .getByRole("combobox", { name: "二つ名", exact: true })
      .locator("option"),
  ).toHaveCount(18);
});

test("all three event divisions show the observed roster, combined filters and independent progress", async ({
  page,
}) => {
  const rosters = await Promise.all(
    ["low", "high", "g"].map(
      async (k) =>
        JSON.parse(
          await readFile(`docs/event-${k}-observations.json`, "utf8"),
        ) as {
          rank: string;
          observedCount: number;
          entries: { questId: string; name: string; role: string }[];
        },
    ),
  );
  const audit = JSON.parse(
    await readFile("docs/event-unlock-indicators-audit.json", "utf8"),
  ) as { otherEntries: { questId: string; show: boolean }[] };
  const badgeIds = new Set(
    audit.otherEntries.filter((r) => r.show).map((r) => r.questId),
  );
  await page.goto("./");
  await page.getByRole("button", { name: "イベント", exact: true }).click();
  const rank = page.getByRole("combobox", { name: "ランク", exact: true });
  const type = page.getByRole("combobox", { name: "種別", exact: true });
  const role = page.getByRole("combobox", { name: "プレイ種別", exact: true });
  for (const r of rosters) {
    await rank.selectOption(r.rank);
    await expect(page.locator(".quest-name")).toHaveText(
      r.entries.map((q) => q.name),
    );
    await expect(page.getByRole("progressbar")).toHaveAttribute(
      "max",
      String(r.observedCount),
    );
    await expect(page.getByRole("progressbar")).toHaveAttribute("value", "0");
    await type.selectOption("key");
    await expect(page.locator(".quest-card")).toHaveCount(0);
    await type.selectOption("normal");
    await expect(page.locator(".quest-card")).toHaveCount(r.observedCount);
    await type.selectOption("unlock");
    await expect(page.locator(".quest-name")).toHaveText(
      r.entries.filter((q) => badgeIds.has(q.questId)).map((q) => q.name),
    );
    await role.selectOption("prowler");
    const matches = r.entries.filter(
      (q) => badgeIds.has(q.questId) && q.role === "prowler",
    );
    await expect(page.locator(".quest-name")).toHaveText(
      matches.map((q) => q.name),
    );
    await page.getByRole("searchbox").fill(matches[0].name);
    await expect(page.locator(".quest-card")).toHaveCount(1);
    await page.locator(".quest-card").getByRole("checkbox").check();
    await expect(page.getByRole("progressbar")).toHaveAttribute("value", "1");
    await page.getByRole("checkbox", { name: "未クリアのみ" }).check();
    await expect(page.locator(".quest-card")).toHaveCount(0);
    await page.reload();
    await expect(type).toHaveValue("unlock");
    await expect(role).toHaveValue("prowler");
    await expect(page.getByRole("searchbox")).toHaveValue(matches[0].name);
    await expect(page.locator(".quest-card")).toHaveCount(0);
    await page.getByRole("checkbox", { name: "未クリアのみ" }).uncheck();
    await expect(
      page.locator(".quest-card").getByRole("checkbox"),
    ).toBeChecked();
    await page.getByRole("searchbox").fill("");
    await type.selectOption("");
    await role.selectOption("");
    await expect(page.locator(".quest-card")).toHaveCount(r.observedCount);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
  }
  expect(
    await page.evaluate(
      () =>
        JSON.parse(localStorage.getItem("qlog.mhxx.progress.v1")!)
          .completedQuestIds,
    ),
  ).toHaveLength(3);
  await page.getByRole("button", { name: "村", exact: true }).click();
  await expect(page.getByRole("progressbar")).toHaveAttribute("value", "0");
  await page.getByRole("button", { name: "特殊許可", exact: true }).click();
  await expect(
    page
      .getByRole("combobox", { name: "二つ名", exact: true })
      .locator("option"),
  ).toHaveCount(18);
  await page.getByRole("button", { name: "イベント", exact: true }).click();
  await expect(rank).toHaveValue("下位");
  await expect(page.getByRole("progressbar")).toHaveAttribute("value", "1");
});

test("event details distinguish recipe materials, ordinary rewards, HR and equipment restrictions", async ({
  page,
}) => {
  await page.goto("./");
  await page.getByRole("button", { name: "イベント", exact: true }).click();
  const rank = page.getByRole("combobox", { name: "ランク", exact: true });
  await page.getByRole("searchbox").fill("サンリオ・ひとぐでしようぜ");
  const card = page.locator(".quest-card");
  await card.locator(".quest-title").click();
  await expect(card.locator(".tag-unlock")).toHaveCount(1);
  await expect(card.locator(".quest-details")).toContainText(
    "ぐでたまフライパン",
  );
  await expect(card.locator(".quest-details")).toContainText(
    "ニセたま頭タイツ",
  );
  await expect(card.locator(".quest-details")).toContainText(
    "クリアだけで製法や装備を取得した扱いにはしません",
  );
  await expect(
    card.getByRole("link", { name: /MHXX攻略レシピ（該当クエスト詳細）/ }),
  ).toHaveAttribute("href", "http://wiki.mhxg.org/ida/267299.html");
  await card.screenshot({
    path: `test-results/event-recipe-${test.info().project.name}.png`,
  });
  await page.getByRole("searchbox").fill("溶岩塊の季節");
  await expect(card.locator(".tag-unlock")).toHaveCount(0);
  await page.getByRole("searchbox").fill("USJ・幻惑なる2頭の輪舞曲");
  await card.locator(".quest-title").click();
  await expect(card.locator(".state")).toHaveText("要確認");
  await expect(card.locator(".quest-details")).toContainText(
    "防具・護石を装備せず",
  );
  await rank.selectOption("上位");
  await page.getByRole("searchbox").fill("範馬刃牙・最大VS最強");
  await card.locator(".quest-title").click();
  await page.getByLabel("現在のHR").fill("3");
  await page.getByRole("button", { name: "HRを保存" }).click();
  await expect(card.locator(".state")).toHaveText("未達成");
  await page.getByLabel("現在のHR").fill("13");
  await page.getByRole("button", { name: "HRを保存" }).click();
  await expect(card.locator(".state")).toHaveText("要確認");
  await rank.selectOption("G級");
  await page.getByRole("searchbox").fill("ドリフターズ・孤島の漂流者");
  await card.locator(".quest-title").click();
  await expect(card.locator(".state")).toHaveText("要確認");
  await expect(card.locator(".quest-details")).toContainText(
    "弾・ビンポーチ以外のアイテムは持込不可",
  );
  await page.getByRole("searchbox").fill("MHヒストリーⅠ");
  await expect(page.locator(".quest-name")).toHaveText([
    "MHヒストリーⅠ",
    "MHヒストリーⅡ",
  ]);
  const history = page.locator("#quest-event-g-recipe-354114");
  await history.locator(".quest-title").click();
  await expect(history.locator(".state")).toHaveText("記録上の前提達成");
  await expect(history.locator(".tag-unlock")).toHaveCount(0);
  await page.getByRole("button", { name: "G級", exact: true }).click();
  await rank.selectOption("G4");
  await page.getByRole("searchbox").fill("天を貫く凶星");
  await card.locator(".quest-title").click();
  await expect(card.getByRole("link", { name: /ランク一覧/ })).toHaveAttribute(
    "href",
    "http://wiki.mhxg.org/data/2996.html",
  );
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});

test("old 1167-check JSON round-trips with HR, an unknown ID and three independently saved events", async ({
  page,
}) => {
  const ids = (
    JSON.parse(await readFile("docs/progress-baseline-1167.json", "utf8")) as {
      id: string;
    }[]
  ).map((q) => q.id);
  await page.goto("./");
  await page.getByLabel("バックアップファイル").setInputFiles(
    backup({
      schemaVersion: 1,
      completedQuestIds: [...ids, "future-stage10-id"],
      hr: 101,
    }),
  );
  await page
    .getByRole("checkbox", { name: "現在の進捗をファイルで置き換える" })
    .check();
  await page.getByRole("button", { name: "置き換えて復元" }).click();
  await page.getByRole("button", { name: "イベント", exact: true }).click();
  const added: string[] = [];
  for (const [rank, name] of [
    ["下位", "サンリオ・ひとぐでしようぜ"],
    ["上位", "名探偵コナン・連続狩猟事件！"],
    ["G級", "MHヒストリーⅡ"],
  ]) {
    await page
      .getByRole("combobox", { name: "ランク", exact: true })
      .selectOption(rank);
    await page.getByRole("searchbox").fill(name);
    await expect(page.getByRole("progressbar")).toHaveAttribute("value", "0");
    const card = page.locator(".quest-card");
    added.push((await card.getAttribute("id"))!.replace(/^quest-/, ""));
    await card.getByRole("checkbox").check();
    await expect(page.getByRole("progressbar")).toHaveAttribute("value", "1");
  }
  await page.reload();
  await expect(page.locator(".quest-card").getByRole("checkbox")).toBeChecked();
  await expect(page.getByLabel("現在のHR")).toHaveValue("101");
  const pending = page.waitForEvent("download");
  await page.getByRole("button", { name: "JSONを書き出す" }).click();
  const exported = JSON.parse(
    await readFile((await (await pending).path())!, "utf8"),
  );
  expect(exported).toMatchObject({
    schemaVersion: 1,
    hr: 101,
    dataset: "mhxx",
  });
  expect(exported.completedQuestIds).toHaveLength(1171);
  expect(exported.completedQuestIds).toEqual(
    expect.arrayContaining([...ids, "future-stage10-id", ...added]),
  );
  expect(Object.keys(exported).sort()).toEqual([
    "completedQuestIds",
    "dataset",
    "hr",
    "schemaVersion",
  ]);
});
