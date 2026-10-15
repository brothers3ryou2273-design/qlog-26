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
    page.getByText("データ整備中 · 実クエスト474件収録"),
  ).toBeVisible();
  await page.getByRole("button", { name: "G級", exact: true }).click();
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
  const table = page
    .getByRole("table")
    .filter({
      has: page.getByText("集会所下位★1〜3の収録状況", { exact: true }),
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
  await page
    .getByLabel("バックアップファイル")
    .setInputFiles(
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

test("collected hub prerequisites leave unrecorded delivery and the uncollected hub-5 gate visible", async ({
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
  await expect(page.locator(".state")).toHaveText("要確認");
  await expect(
    page.getByText(
      "未収録：集★5雪山の主、ドドブランゴのクリア（キャラバンの竜人商人の依頼3）",
      { exact: true },
    ),
  ).toBeVisible();
  await expect(
    page.getByRole("button", {
      name: "集会所 ★3（下位） / 化石に眠る太古の記憶",
      exact: true,
    }),
  ).toBeVisible();
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
