import connections from "../../docs/g-rank-connections.json";
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
      const change=connections.changes.find(c=>c.questId===q.id);
      expect(q.condition).toEqual(change?.after ?? b.condition);
      if(change) expect(change.before).toEqual(b.condition);
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

it("G2 urgent requires all five G1 keys, and hyper alternatives never bypass the six G2 keys",()=>{
  const named=(name:string)=>quests.find(q=>q.category==='g_rank'&&q.name===name)!;
  const urgent=named('泥まみれの商魂！');
  const keys1=quests.filter(q=>q.category==='g_rank'&&q.rank==='G1'&&q.tags.includes('key'));
  const save=(ids:string[],hr=9)=>({schemaVersion:1 as const,completedQuestIds:ids,hr});
  expect(keys1).toHaveLength(5);
  expect(evaluate(urgent.condition,save(keys1.map(q=>q.id)))).toBe('met');
  for(const key of keys1)expect(evaluate(urgent.condition,save(keys1.filter(q=>q!==key).map(q=>q.id)))).toBe('unmet');
  const hyper=named('逆襲の怪鳥');
  const keys2=quests.filter(q=>q.category==='g_rank'&&q.rank==='G2'&&q.tags.includes('key')).map(q=>q.id);
  expect(keys2).toHaveLength(6);
  for(const prior of ['つつかれて、またつつかれて','森丘の迷惑な怪鳥さん']){
    const ids=[urgent.id,...keys2,named(prior).id];
    expect(evaluate(hyper.condition,save(ids))).toBe('met');
    expect(evaluate(hyper.condition,save(ids.filter(id=>id!==keys2[0])))).toBe('unmet');
  }
  const village=quests.find(q=>q.id==='village-9-recipe-286221')!;
  expect(references(village.condition)).toContain(urgent.id);
  expect(dependents(urgent.id,quests)).toContain(village);
});
