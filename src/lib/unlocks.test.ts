import { describe, expect, it } from "vitest";
import { hasUnlockIndicator } from "./unlocks";
import { quests } from "../data/quests";
import legacyAudit from "../../docs/unlock-indicators-audit.json";
import permitAudit from "../../docs/permit-unlock-indicators-audit.json";
const audit = {otherEntries: [...legacyAudit.otherEntries, ...permitAudit.otherEntries], confirmedMarkers: legacyAudit.confirmedMarkers};
const named = (name: string, category = "village", rank?: string) =>
  quests.find(
    (q) =>
      q.name === name && q.category === category && (!rank || q.rank === rank),
  )!;
describe("evidence-based unlock indicator", () => {
  it("shows equipment recipes and actual other rewards, but not reference-only records", () => {
    const q = named("ライバルの激突！！", "hub", "4");
    expect(q.unlocks.every((u) => u.kind === "other")).toBe(true);
    expect(hasUnlockIndicator(q)).toBe(true);
    expect(hasUnlockIndicator(named("鉄壁の盾蟹", "hub", "1"))).toBe(false);
    expect(
      hasUnlockIndicator(named("ドスランポスを狩猟せよ！", "hub", "1")),
    ).toBe(false);
    expect(hasUnlockIndicator(named("奈落の妖星", "hub", "7"))).toBe(false);
  });
  it("shows arts and multiple rewards as a single boolean decision", () => {
    expect(hasUnlockIndicator(named("大地を泳ぐモンスター", "hub", "4"))).toBe(
      true,
    );
    expect(
      hasUnlockIndicator(named("超☆メモ帳～跳狗竜狩猟編～", "hub", "4")),
    ).toBe(true);
  });
  it("uses confirmed markers even without a concrete unlock name, without inferring from warnings", () => {
    const q = named("青熊獣アオアシラ");
    expect(q.unlocks.every((u) => u.kind === "other")).toBe(true);
    expect(hasUnlockIndicator(q)).toBe(true);
    expect(
      hasUnlockIndicator({
        ...q,
        id: "unresearched",
        unlocks: [],
        warnings: ["施設内容は未調査"],
      }),
    ).toBe(false);
    expect(
      hasUnlockIndicator({
        ...q,
        id: "unresearched",
        unlocks: [{ kind: "other", label: "未調査の項目" }],
      }),
    ).toBe(false);
  });
  it("classifies every real other item with source evidence and exact label matching", () => {
    for (const q of quests)
      for (const u of q.unlocks.filter((u) => u.kind === "other")) {
        const row = audit.otherEntries.find(
          (r) => r.questId === q.id && r.label === u.label,
        );
        expect(row).toBeDefined();
        expect(row!.sourceUrl).toBe(q.sources[0].url);
      }
    for (const row of audit.otherEntries) {
      const q = quests.find((q) => q.id === row.questId)!;
      const isolated = {
        ...q,
        id: row.questId,
        unlocks: q.unlocks.filter((u) => u.label === row.label),
      };
      if (!audit.confirmedMarkers.some((m) => m.questId === q.id))
        expect(hasUnlockIndicator(isolated)).toBe(row.show);
    }
    for (const m of audit.confirmedMarkers)
      expect(m.markers.length).toBeGreaterThan(0);
  });
});
