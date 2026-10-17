/// <reference types="vite/client" />
import { describe, expect, it } from "vitest";
import { quests } from "./quests";
import { categories } from "../lib/types";
import type { Quest } from "../lib/types";
import { evaluate, dependents, references, validateQuests } from "../lib/rules";
import { hasUnlockIndicator } from "../lib/unlocks";
import { parseSave, SAVE_KEY } from "../lib/storage";
import research from "../../docs/arena-research-audit.json";
import metadata from "../../docs/arena-equipment-time-rewards-audit.json";
import baseline from "../../docs/progress-baseline-1311.json";
import challenge from "../../docs/challenge-observations.json";
import arena from "../../docs/arena-observations.json";
import indicators from "../../docs/arena-unlock-indicators-audit.json";
import achievements from "./arena-achievements.json";
type Roster = {
  category: string;
  observedCount: number;
  entries: {
    questId: string;
    name: string;
    url: string;
    order: number;
    role: string;
    tags: string[];
    targets: string[];
    icons: string[];
    condition: unknown;
  }[];
};
const rosters = [arena, challenge] as Roster[];
const named = (name: string) =>
  quests.find((q) => q.category === "arena" && q.name === name)!;
describe("arena and challenge observed source facts", () => {
  for (const r of rosters)
    it(`${r.category}: exact names, roles, order, actual pages and targets`, () => {
      const rosterIds = new Set(r.entries.map((e) => e.questId));
      const qs = quests.filter((q) => rosterIds.has(q.id));
      expect(qs).toHaveLength(r.observedCount);
      expect(
        qs.map((q) => [
          q.id,
          q.name,
          q.order,
          q.role,
          q.tags,
          q.sources[0].url,
          q.arenaInfo!.targets,
          q.condition,
        ]),
      ).toEqual(
        r.entries.map((e) => [
          e.questId,
          e.name,
          e.order,
          e.role,
          e.tags,
          e.url,
          e.targets,
          e.condition,
        ]),
      );
      for (const q of qs) {
        expect(q.rank).toBe("全ランク");
        expect(q.sources[0].url).toMatch(
          /^http:\/\/wiki\.mhxg\.org\/ida\/\d+\.html$/,
        );
        expect(q.arenaInfo!.targets.length).toBeGreaterThan(0);
        expect(q.arenaInfo!.participantLimit).toBe("2人以下");
        expect(q.arenaInfo!.difficulty).toBeUndefined();
        if (q.role === "prowler") {
          expect(q.arenaInfo!.supportTypes).toHaveLength(5);
          expect(q.arenaInfo!.evaluationNotation).toMatch(
            /^S\d+:\d{2} A:?\d+:\d{2} B\d+:\d{2}$/,
          );
        } else {
          expect(q.arenaInfo!.weapons).toHaveLength(5);
          expect(q.arenaInfo!.evaluationNotation).toBeUndefined();
        }
        for (const id of references(q.condition))
          expect(dependents(id, quests)).toContain(q);
      }
    });
  it("does not invent missing original arena prerequisites, and connects five sourced G-rank quests", () => {
    const qs = quests.filter((q) => q.category === "arena");
    expect(qs.filter((q) => references(q.condition).length > 0)).toHaveLength(
      5,
    );
    const oldIds = baseline.map((q) => q.id);
    const q = named("イャンガルルガ討伐"),
      ref = quests.find((x) => x.name === "ネルスキュラの生態研究")!;
    expect(
      evaluate(q.condition, { schemaVersion: 1, completedQuestIds: [], hr: 9 }),
    ).toBe("unmet");
    expect(
      evaluate(q.condition, {
        schemaVersion: 1,
        completedQuestIds: [ref.id],
        hr: 8,
      }),
    ).toBe("unmet");
    expect(
      evaluate(q.condition, {
        schemaVersion: 1,
        completedQuestIds: [ref.id],
        hr: 9,
      }),
    ).toBe("met");
    for (const quest of qs.filter((q) => references(q.condition).length))
      for (const id of references(quest.condition))
        expect(oldIds).toContain(id);
    expect(named("ベリオロス討伐").condition).toEqual({ kind: "none" });
    expect(named("ボルボロス討伐").condition).toEqual({ kind: "none" });
    expect(
      evaluate(named("ホロロホルル討伐").condition, {
        schemaVersion: 1,
        completedQuestIds: oldIds,
        hr: 999,
      }),
    ).toBe("unknown");
  });
  it("preserves literal evaluation notation, including B13:00 and A:09:00, without guessed boundaries", () => {
    expect(named("ドスマッカォ討伐").arenaInfo!.evaluationNotation).toBe(
      "S5:00 A:10:00 B13:00",
    );
    expect(named("ボルボロス討伐").arenaInfo!.evaluationNotation).toBe(
      "S5:00 A:09:00 B13:00",
    );
    expect(named("ババコンガ討伐").arenaInfo!.evaluationNotation).toBe(
      "S7:00 A14:00 B20:00",
    );
  });
  it("does not duplicate cross-quest piercings into single-clear rewards or auto-evaluate A/S", () => {
    expect(achievements.filter((a) => a.label.endsWith("ピアス"))).toHaveLength(
      4,
    );
    expect(
      achievements.filter(
        (a) => a.label.endsWith("ピアス") && a.condition.includes("Aランク"),
      ),
    ).toHaveLength(2);
    for (const q of quests.filter(
      (q) => q.category === "arena" || q.category === "challenge",
    )) {
      expect(
        q.unlocks.some((u) =>
          [
            "剣聖のピアス",
            "増弾のピアス",
            "虚心のピアス",
            "切望のピアス",
          ].includes(u.label),
        ),
      ).toBe(false);
      for (const u of q.unlocks.filter((u) => u.kind === "other")) {
        const row = indicators.otherEntries.find(
          (e) => e.questId === q.id && e.label === u.label,
        );
        expect(row).toBeDefined();
        expect(row!.evidenceUrls.length).toBeGreaterThan(0);
        expect(u.note).toContain("素材入手経路");
      }
    }
    const q = named("ガララアジャラ討伐");
    expect(q.unlocks).toContainEqual({
      kind: "hunter_art",
      label: "音撃震 LV2",
    });
    expect(hasUnlockIndicator(q)).toBe(true);
  });
  it("maintains distinct categories, IDs, real page URLs and an acyclic reference graph", () => {
    expect(
      categories
        .filter((c) => c.id === "arena" || c.id === "challenge")
        .map((c) => c.ranks),
    ).toEqual([["全ランク"], ["全ランク"]]);
    expect(new Set(quests.map((q) => q.id)).size).toBe(quests.length);
    expect(new Set(quests.map((q) => q.sources[0].url)).size).toBe(
      quests.length,
    );
    expect(validateQuests(quests)).toEqual([]);
  });
});
it("keeps all 1311 old quest records exactly unchanged", async () => {
  expect(baseline).toHaveLength(1311);
  for (const old of baseline) {
    const q = quests.find((q) => q.id === old.id);
    expect(q).toBeDefined();
    const hash = Array.from(
      new Uint8Array(
        await crypto.subtle.digest(
          "SHA-256",
          new TextEncoder().encode(JSON.stringify(q)),
        ),
      ),
    )
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
    expect(hash).toBe(old.questSha256);
  }
});
it("keeps version-1 checks, HR and unknown IDs, without persisting arena display facts", () => {
  expect(SAVE_KEY).toBe("qlog.mhxx.progress.v1");
  const data = {
    schemaVersion: 1,
    completedQuestIds: [
      ...baseline.map((q) => q.id),
      "future-arena-id",
      named("ドスマッカォ討伐").id,
    ],
    hr: 123,
  };
  const restored = parseSave(JSON.stringify(data));
  expect(restored).toEqual(data);
  expect(parseSave(JSON.stringify(restored))).toEqual(data);
  expect(Object.keys(restored).sort()).toEqual([
    "completedQuestIds",
    "hr",
    "schemaVersion",
  ]);
});

it("keeps historic audits and their earlier six unmatched observations byte-identical", async () => {
  const files = import.meta.glob<string>("../../docs/*", {
    query: "?raw",
    import: "default",
    eager: true,
  });
  for (const [path, sha] of Object.entries(research.priorAuditFiles)) {
    const text = files[`../../${path}`];
    expect(text).toBeDefined();
    const hash = Array.from(
      new Uint8Array(
        await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text)),
      ),
    )
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
    expect(hash).toBe(sha);
  }
  expect(
    metadata.specialistObservations.filter(
      (m) => m.status === "unmatched_candidate",
    ),
  ).toHaveLength(6);
  expect(
    quests.filter((q) => q.category === "challenge").length,
  ).toBeGreaterThanOrEqual(20);
  expect(
    quests.find((q) => q.category === "challenge" && q.name === "大連続狩猟4")!
      .role,
  ).toBe("hunter");
  expect(quests.length).toBeGreaterThanOrEqual(1348);
});
