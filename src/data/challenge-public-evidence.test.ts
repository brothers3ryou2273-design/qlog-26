/// <reference types="vite/client" />
import { expect, it } from "vitest";
import { quests } from "./quests";
import { validateQuests } from "../lib/rules";
import { hasUnlockIndicator } from "../lib/unlocks";
import added from "./challenge-xx.json";
import evidence from "../../docs/pr13/qlog_mhxx_pr13_public_evidence_20261017.json";
import decisions from "../../docs/pr13/candidate-decisions.json";
import changes from "../../docs/pr13/existing-weapon-changes.json";
import historic from "../../docs/pr13/historic-audit-baseline.json";
import database from "../../docs/pr13/database-observations.json";

it("registers 18 externally observed Kiranico IDs and one directly fetched alternate detail ID", () => {
  expect(added).toHaveLength(19);
  expect(added.filter((q) => q.role === "hunter")).toHaveLength(13);
  expect(added.filter((q) => q.role === "prowler")).toHaveLength(6);
  expect(decisions.entries).toHaveLength(20);
  expect(
    decisions.entries
      .filter((d) => d.decision === "pending")
      .map((d) => d.name),
  ).toEqual(["ＸＸイベント：大連続狩猟３"]);
  for (const q of added) {
    const e = evidence.candidateQuests.find((c) => c.name === q.name)!;
    expect(quests.find((c) => c.id === q.id)).toEqual(q);
    expect(q.category).toBe("challenge");
    expect(q.rank).toBe("全ランク");
    expect(q.arenaInfo.targets).toEqual(e.targets);
    expect(q.role).toBe(e.role);
    if (e.kiranicoDetailUrl) {
      expect(q.id).toBe(
        `challenge-kiranico-${e.kiranicoDetailUrl.split("/").at(-1)}`,
      );
      expect(q.sources[0].url).toBe(e.kiranicoDetailUrl);
    } else {
      expect(q.id).toBe("challenge-mh4info-1906");
      expect(q.sources[0].url).toBe(
        "https://x.mh4info.com/quest/detail/?no=1906",
      );
      expect(
        database.some(
          (d) => d.url === q.sources[0].url && d.status === "fetched",
        ),
      ).toBe(true);
    }
    expect(q.condition.kind).toBe("unknown");
    expect(q.unlocks).toEqual([]);
    expect(hasUnlockIndicator(quests.find((quest) => quest.id === q.id)!)).toBe(
      false,
    );
    if (q.role === "hunter")
      expect(q.arenaInfo.weapons).toEqual(e.weaponPresets);
  }
  expect(new Set(quests.map((q) => q.id)).size).toBe(quests.length);
  expect(new Set(quests.map((q) => q.sources[0].url)).size).toBe(quests.length);
  expect(validateQuests(quests)).toEqual([]);
});

it("matches all 25 existing presets, with separate arena/challenge identities and multi-target evidence", () => {
  expect(changes.entries).toHaveLength(25);
  expect(new Set(changes.entries.map((e) => e.questId)).size).toBe(25);
  for (const e of evidence.existingHunterQuestWeaponPresets) {
    const matches = quests.filter(
      (q) =>
        q.category === e.category && q.name === e.name && q.role === "hunter",
    );
    expect(matches).toHaveLength(1);
    const q = matches[0];
    expect(q.arenaInfo!.weapons).toEqual(e.weaponPresets);
    expect(new Set(q.arenaInfo!.weapons).size).toBe(5);
    const ledger = changes.entries.find((c) => c.questId === q.id)!;
    expect(ledger.targets).toEqual(q.arenaInfo!.targets);
    if (q.name.startsWith("大連続")) {
      const db = database.find(
        (d) => d.fields?.クエスト名 === "イベント：" + q.name,
      )!;
      expect(db.fields.主なモンスター.split("、")).toEqual(
        q.arenaInfo!.targets,
      );
      expect(q.name).not.toContain("ＸＸ");
    }
    expect(q.arenaInfo!.evaluationNotation).toBeUndefined();
  }
});

it("retains the conflicting fire-dragon support observations without assigning a preset", () => {
  const fire = added.find((q) => q.name === "ＸＸイベント：火竜討伐")!;
  expect(fire.arenaInfo.supportTypes).toBeUndefined();
  expect(fire.arenaInfo.notes.join(" ")).toContain("相違があるため保留");
  for (const q of added.filter(
    (q) => q.role === "prowler" && q.id !== fire.id,
  )) {
    expect(q.arenaInfo.supportTypes).toHaveLength(5);
    expect(q.arenaInfo.supportTypes).toEqual(
      evidence.candidateQuests.find((c) => c.name === q.name)!.supportTypes,
    );
  }
});

it("adds only sourced grade thresholds, preserving literal under/notational boundaries instead of TA records", () => {
  expect(added.filter((q) => q.arenaInfo.evaluationNotation)).toHaveLength(16);
  for (const q of added) {
    const db = database.find((d) => q.sources.some((s) => s.url === d.url));
    if (db) expect(q.arenaInfo.evaluationNotation).toBe(db.fields.備考);
    else if (q.name === "ＸＸイベント：大連続狩猟４")
      expect(q.arenaInfo.evaluationNotation).toBe("S12:00　A25:00　B40:00");
    else expect(q.arenaInfo.evaluationNotation).toBeUndefined();
  }
});

it("keeps all 62 pre-PR13 audit files byte-identical", async () => {
  const files = import.meta.glob<string>("../../docs/*", {
    query: "?raw",
    import: "default",
    eager: true,
  });
  expect(Object.keys(historic)).toHaveLength(62);
  for (const [path, hash] of Object.entries(historic)) {
    const body = files[`../../${path}`];
    expect(body, path).toBeDefined();
    const digest = await crypto.subtle.digest(
      "SHA-256",
      new TextEncoder().encode(body),
    );
    expect(
      Array.from(new Uint8Array(digest), (b) =>
        b.toString(16).padStart(2, "0"),
      ).join(""),
      path,
    ).toBe(hash);
  }
});
