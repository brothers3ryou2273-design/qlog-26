/// <reference types="vite/client" />
import { describe, expect, it } from "vitest";
import { quests } from "./quests";
import { categories } from "../lib/types";
import { evaluate, references, validateQuests } from "../lib/rules";
import { hasUnlockIndicator } from "../lib/unlocks";
import { parseSave, SAVE_KEY } from "../lib/storage";
import connections from "../../docs/event-connections.json";
import baseline from "../../docs/progress-baseline-1167.json";
import research from "../../docs/event-research-audit.json";
import materials from "../../docs/event-materials-audit.json";
import unlockAudit from "../../docs/event-unlock-indicators-audit.json";
import lowRoster from "../../docs/event-low-observations.json";
import gRoster from "../../docs/event-g-observations.json";
import highRoster from "../../docs/event-high-observations.json";
import type { Quest } from "../lib/types";

type Observation = {
  rank: string;
  observedCount: number;
  entries: {
    questId: string;
    name: string;
    listName: string;
    rank: string;
    order: number;
    role: Quest["role"];
    tags: Quest["tags"];
    url: string;
    icons: string[];
    detailTitle: string;
    httpStatus: number;
    condition: Quest["condition"];
    hrFromDetail: number | null;
  }[];
};
const rosters = [lowRoster, highRoster, gRoster] as Observation[];
const oldDocs = import.meta.glob<string>("../../docs/*", {
  query: "?raw",
  import: "default",
  eager: true,
});
async function sha(text: string) {
  return Array.from(
    new Uint8Array(
      await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text)),
    ),
  )
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}
describe("Japanese MHXX observed event catalog", () => {
  for (const roster of rosters)
    it(`${roster.rank}: exact list and detail set, order, role, attributes and HR`, () => {
      const qs = quests.filter(
        (q) => q.category === "event" && q.rank === roster.rank,
      );
      expect(qs).toHaveLength(roster.observedCount);
      expect(
        qs.map((q) => [
          q.id,
          q.name,
          q.rank,
          q.order,
          q.role,
          q.tags,
          q.sources[0].url,
          q.condition,
        ]),
      ).toEqual(
        roster.entries.map((r) => [
          r.questId,
          r.name,
          r.rank,
          r.order,
          r.role,
          r.tags,
          r.url,
          r.condition,
        ]),
      );
      expect(qs.map((q) => q.order)).toEqual(
        Array.from({ length: qs.length }, (_, i) => i + 1),
      );
      for (const [i, q] of qs.entries()) {
        const r = roster.entries[i];
        expect(r.httpStatus).toBe(200);
        expect(r.detailTitle).toContain(q.name);
        expect(q.sources[0].url).toMatch(
          /^http:\/\/wiki\.mhxg\.org\/ida\/\d+\.html$/,
        );
        expect(q.id).toContain(
          q.sources[0].url.split("/").at(-1)!.replace(".html", ""),
        );
        expect(q.role).toBe(
          r.icons.includes("ニャンター") ? "prowler" : "hunter",
        );
        expect(q.tags).toEqual(["normal"]);
        expect(references(q.condition)).toEqual([]);
        if (r.hrFromDetail !== null) {
          expect(
            evaluate(q.condition, {
              schemaVersion: 1,
              completedQuestIds: [],
              hr: r.hrFromDetail - 1,
            }),
          ).toBe("unmet");
          expect(
            evaluate(q.condition, {
              schemaVersion: 1,
              completedQuestIds: [],
              hr: r.hrFromDetail,
            }),
          ).toBe(q.condition.kind === "all" ? "unknown" : "met");
        }
      }
    });
  it("has three game divisions, distinct IDs/URLs and valid non-cyclic references", () => {
    expect(categories.find((c) => c.id === "event")!.ranks).toEqual([
      "下位",
      "上位",
      "G級",
    ]);
    expect(new Set(quests.map((q) => q.id)).size).toBe(quests.length);
    expect(new Set(quests.map((q) => q.sources[0].url)).size).toBe(
      quests.length,
    );
    expect(validateQuests(quests)).toEqual([]);
  });
  it("only marks evidenced event recipes or special utility items, not ordinary materials", () => {
    for (const q of quests.filter((q) => q.category === "event")) {
      expect(hasUnlockIndicator(q)).toBe(
        unlockAudit.otherEntries.some((r) => r.questId === q.id && r.show),
      );
      for (const u of q.unlocks) {
        const row = unlockAudit.otherEntries.find(
          (r) => r.questId === q.id && r.label === u.label,
        );
        expect(row).toBeDefined();
        expect(row!.evidenceUrls.length).toBeGreaterThan(0);
        expect(u.note).toMatch(/素材|アイテム/);
        expect(u.note).not.toContain("必ず入手");
      }
    }
    expect(
      hasUnlockIndicator(
        quests.find(
          (q) =>
            q.category === "event" && q.name === "サンリオ・ひとぐでしようぜ",
        )!,
      ),
    ).toBe(true);
    expect(
      hasUnlockIndicator(
        quests.find(
          (q) => q.category === "event" && q.name === "溶岩塊の季節",
        )!,
      ),
    ).toBe(false);
  });
});
it("preserves 1167 old records except audited list-link corrections and all old audit files byte-for-byte", async () => {
  expect(baseline).toHaveLength(1167);
  for (const old of baseline) {
    const q = quests.find((q) => q.id === old.id);
    expect(q).toBeDefined();
    const comparable = structuredClone(q!);
    for (const change of connections.sourceListChanges.filter(
      (c) => c.questId === old.id,
    )) {
      const source = comparable.sources.find(
        (s) => s.kind === "list" && s.url === change.after,
      );
      expect(source).toBeDefined();
      source!.url = change.before;
    }
    expect(await sha(JSON.stringify(comparable))).toBe(old.questSha256);
  }
  for (const [path, hash] of Object.entries(research.priorAuditFiles)) {
    const text = oldDocs[`../../${path}`];
    expect(text).toBeDefined();
    expect(await sha(text)).toBe(hash);
  }
});
it("restores and reexports all old checks, HR, unknown IDs and independent event progress as schema 1", () => {
  expect(SAVE_KEY).toBe("qlog.mhxx.progress.v1");
  const event = quests.find((q) => q.category === "event")!;
  const input = {
    schemaVersion: 1,
    completedQuestIds: [
      ...baseline.map((q) => q.id),
      "future-unknown",
      event.id,
    ],
    hr: 100,
  };
  const saved = parseSave(JSON.stringify(input));
  expect(saved).toEqual(input);
  expect(parseSave(JSON.stringify(saved))).toEqual(saved);
  expect(saved.completedQuestIds).toHaveLength(1169);
});

it("covers the three independently observed source sets and keeps their published classification", () => {
  expect(rosters.map((r) => r.observedCount)).toEqual([11, 84, 49]);
  expect(quests.filter((q) => q.category === "event")).toHaveLength(144);
  expect(quests).toHaveLength(1311);
  expect(
    rosters.map((r) => r.entries.filter((q) => q.role === "prowler").length),
  ).toEqual([6, 11, 7]);
  for (const q of quests.filter((q) => q.category === "event")) {
    expect(q.sources.slice(2).every((s) => s.kind === "reference")).toBe(true);
    expect(q.tags).not.toContain("unlock");
  }
});

it("binds special recipes to observed material uses and excludes general certificates", () => {
  expect(materials.entries).toHaveLength(95);
  const recipes = materials.entries.filter(
    (i) => i.classification === "recipe_material",
  );
  expect(recipes).toHaveLength(83);
  for (const material of recipes) {
    expect(material.httpStatus).toBe(200);
    expect(material.detailTitle).toContain(material.name);
    expect(material.equipmentUses.length).toBeGreaterThan(0);
    const linked = quests.filter(
      (q) =>
        q.category === "event" && q.sources.some((s) => s.url === material.url),
    );
    expect(linked.length).toBeGreaterThan(0);
    for (const q of linked) {
      expect(
        material.eventRewardObservations.some(
          (r) => r.questUrl === q.sources[0].url,
        ),
      ).toBe(true);
      expect(
        q.unlocks.some(
          (u) => u.label === material.name + "を使う装備の生産・強化",
        ),
      ).toBe(true);
      expect(hasUnlockIndicator(q)).toBe(true);
    }
  }
  for (const material of materials.entries.filter(
    (i) => i.classification === "ordinary_certificate_or_currency",
  )) {
    expect(material.indicatorEligible).toBe(false);
    expect(
      quests
        .filter((q) => q.category === "event")
        .some((q) => q.sources.slice(2).some((s) => s.url === material.url)),
    ).toBe(false);
  }
  expect(unlockAudit.otherEntries).toHaveLength(89);
});

it("corrects only the 86 audited G4 list citations and matches the live roster attributes", () => {
  expect(connections.conditionChanges).toEqual([]);
  expect(connections.unlockChanges).toEqual([]);
  expect(connections.sourceListChanges).toHaveLength(86);
  expect(connections.sourceListAudit.namesRolesTagsAndUrlsMatch).toBe(true);
  expect(
    quests
      .filter((q) => q.category === "g_rank" && q.rank === "G4")
      .map((q) => ({
        name: q.name,
        url: q.sources[0].url,
        role: q.role,
        tags: q.tags,
        order: q.order,
      })),
  ).toEqual(connections.sourceListAudit.entries);
  for (const change of connections.sourceListChanges) {
    const q = quests.find((q) => q.id === change.questId)!;
    expect(
      q.sources.some((s) => s.kind === "list" && s.url === change.after),
    ).toBe(true);
    expect(
      q.sources.some((s) => s.kind === "list" && s.url === change.before),
    ).toBe(false);
  }
});
