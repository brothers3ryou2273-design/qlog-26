import { describe, expect, it } from "vitest";
import audit from "../../docs/facility-unlocks-audit.json";
import roster from "../../docs/data-audit.json";
import released from "../../docs/progress-id-baseline.json";
import { quests } from "./quests";
import { parseSave, SAVE_KEY } from "../lib/storage";

describe("facility re-investigation", () => {
  for (const record of audit.records) {
    it(`${record.name}: preserves the documented result and checked source`, () => {
      const q = quests.find((q) => q.id === record.questId)!;
      expect(q.name).toBe(record.name);
      expect(q.rank).toBe(record.rank);
      expect(q.sources[0].url).toBe(record.primaryUrl);
      if (record.status !== "unresolved") {
        expect(q.unlocks).toEqual(
          expect.arrayContaining(record.adoptedUnlocks),
        );
        for (const url of record.supplementalUrls) {
          expect(q.sources).toContainEqual(
            expect.objectContaining({ url, checkedAt: record.checkedAt }),
          );
        }
        if (record.status === "resolved") expect(q.warnings).toEqual([]);
        else {
          expect(q.warnings?.join(" ")).toContain("不一致");
          expect(q.unlocks).toContainEqual(
            expect.objectContaining({
              label: "オトモ雇用枠の拡張（上限数は未確定）",
            }),
          );
        }
      } else {
        expect(record.adoptedUnlocks).toEqual([]);
        expect(q.warnings?.length).toBeGreaterThan(0);
        expect(
          q.unlocks.some((u) => u.kind === "facility" || u.kind === "trade"),
        ).toBe(false);
      }
      expect(q.verification).toBe("partial");
    });
  }
  it("retains numerical contradictions without presenting either count as confirmed", () => {
    expect(audit.records).toHaveLength(13);
    expect(audit.records.filter((r) => r.status === "resolved")).toHaveLength(
      7,
    );
    expect(audit.records.filter((r) => r.status === "partial")).toHaveLength(3);
    expect(audit.records.filter((r) => r.status === "unresolved")).toHaveLength(
      3,
    );
    expect(quests.filter((q) => q.warnings?.length)).toHaveLength(6);
    for (const r of audit.records.filter((r) => r.status === "partial")) {
      expect(r.conflict?.basicCount).not.toBe(r.conflict?.questTableCount);
      expect(r.supplementalUrls).toHaveLength(2);
    }
  });
  it("retains every released ID and the version-1 save format for all 197 checks", () => {
    const expected = [
      ...released.map((q) => q.id),
      ...roster.ranks
        .filter((r) => Number(r.rank) >= 4)
        .flatMap((r) =>
          r.entries.map(
            (q) =>
              `village-${r.rank}-recipe-${q.recipeUrl.split("/").pop()!.replace(".html", "")}`,
          ),
        ),
    ];
    expect(expected).toHaveLength(197);
    expect(quests.map((q) => q.id)).toEqual(expected);
    expect(SAVE_KEY).toBe("qlog.mhxx.progress.v1");
    const old = {
      schemaVersion: 1,
      completedQuestIds: [...expected, "future-id"],
      hr: 7,
    };
    expect(parseSave(JSON.stringify(old))).toEqual(old);
  });
  it("distinguishes initial hiring levels from level caps and keeps HR alternatives in unlock notes", () => {
    for (const [name, range, hr] of [
      ["雪山のポイント捜索隊！", "5〜7", 4],
      ["牙と毒の沼地", "10〜12", 5],
    ] as const) {
      const q = quests.find((q) => q.name === name)!;
      expect(q.unlocks).toContainEqual(
        expect.objectContaining({
          label: `オトモの初期雇用レベル${range}`,
          note: expect.stringContaining(`またはHR${hr}以上（OR）`),
        }),
      );
      expect(q.unlocks.some((u) => u.label.includes("上限解放"))).toBe(false);
    }
  });
  it("does not attach the separately triggered special meal to the urgent quest", () => {
    const q = quests.find((q) => q.name === "灼熱の刃")!;
    expect(q.unlocks.some((u) => u.label === "屋台の特上まかない飯")).toBe(
      false,
    );
  });
});
