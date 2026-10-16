import { describe, expect, it } from "vitest";
import { quests } from "./quests";
import audit from "../../docs/g-rank-audit.json";
import baseline from "../../docs/progress-baseline-709.json";
import { dependents, evaluate, references, validateQuests } from "../lib/rules";
import { parseSave, SAVE_KEY } from "../lib/storage";

describe("G-rank observed rosters and legacy compatibility", () => {
  for (const rank of audit.ranks) {
    it(`G${rank.rank} matches the observed names, URLs, roles, flags and order`, () => {
      const group = quests.filter(q => q.category === "g_rank" && q.rank === `G${rank.rank}`);
      expect(group.map(q => [q.name,q.sources[0].url,q.role,q.tags])).toEqual(rank.entries.map(e => [e.name,e.recipeUrl,e.role,e.tags]));
      expect(group).toHaveLength(rank.observedCount);
      group.forEach((q,i) => {
        expect(q.order).toBe(i);
        expect(rank.entries[i].detailTitle.replaceAll(" ","")).toContain(`G★${rank.rank}${q.name}`.replaceAll(" ",""));
        expect(q.sources.some(s => s.url === rank.recipeListUrl && s.checkedAt === audit.checkedAt)).toBe(true);
        for (const id of references(q.condition)) expect(dependents(id,quests)).toContain(q);
      });
      expect(new Set(group.map(q=>q.sources[0].url)).size).toBe(group.length);
      expect(validateQuests(quests)).toEqual([]);
    });
  }
  it("retains all 709 IDs, names, source URLs and unlock facts", () => {
    expect(baseline).toHaveLength(709);
    for (const b of baseline) {
      const q = quests.find(q=>q.id===b.id)!;
      expect([q.name,q.category,q.rank,q.sources[0].url]).toEqual([b.name,b.category,b.rank,b.recipeUrl]);
      expect(q.unlocks.map(u=>[u.kind,u.label])).toEqual(expect.arrayContaining(b.unlocks.map(u=>[u.kind,u.label])));
    }
  });
  it("restores version 1 HR, all previous checks, and unknown IDs without migrations", () => {
    expect(SAVE_KEY).toBe("qlog.mhxx.progress.v1");
    const result=parseSave(JSON.stringify({schemaVersion:1,completedQuestIds:[...baseline.map(q=>q.id),'future-quest-id'],hr:35,updatedAt:'2026-01-01T00:00:00.000Z'}));
    expect(result.hr).toBe(35);
    expect(result.completedQuestIds).toContain('future-quest-id');
    for(const q of baseline)expect(result.completedQuestIds).toContain(q.id);
  });
});
