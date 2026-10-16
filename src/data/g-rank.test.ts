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

it("G3 entry uses all six G2 keys and keeps the prowler alternatives separate",()=>{
 const urgent=quests.find(q=>q.category==='g_rank'&&q.name==='巨大龍の侵攻')!;
 const keys=quests.filter(q=>q.category==='g_rank'&&q.rank==='G2'&&q.tags.includes('key')).map(q=>q.id);
 expect(evaluate(urgent.condition,{schemaVersion:1,completedQuestIds:keys,hr:9})).toBe('met');
 for(const id of keys)expect(evaluate(urgent.condition,{schemaVersion:1,completedQuestIds:keys.filter(x=>x!==id),hr:9})).toBe('unmet');
 const prowler=quests.find(q=>q.category==='g_rank'&&q.name==='影蜘蛛の背中破壊に挑戦！')!;
 for(const name of ['火山ウロザミ戦線','密林のポイント招きネコ']){
  const prior=quests.find(q=>q.category==='g_rank'&&q.name===name)!;
  expect(evaluate(prowler.condition,{schemaVersion:1,completedQuestIds:[urgent.id,prior.id],hr:9})).toBe('met');
 }
});

it("G4 entrance and final urgent use distinct, closed key collections and HR gates",()=>{
 const named=(name:string)=>quests.find(q=>q.category==='g_rank'&&q.name===name)!;
 const entrance=named('天を貫く凶星'),final=named('蠢く墟城');
 for(const [quest,rank,hr] of [[entrance,'G3',9],[final,'G4',12]] as const){
  const keys=quests.filter(q=>q.category==='g_rank'&&q.rank===rank&&q.tags.includes('key')).map(q=>q.id);
  expect(keys).toHaveLength(6);
  const ids=[...keys,...(quest===final?[entrance.id]:[])];
  expect(evaluate(quest.condition,{schemaVersion:1,completedQuestIds:ids,hr})).toBe('met');
  for(const id of keys)expect(evaluate(quest.condition,{schemaVersion:1,completedQuestIds:ids.filter(x=>x!==id),hr})).toBe('unmet');
  expect(evaluate(quest.condition,{schemaVersion:1,completedQuestIds:ids,hr:hr-1})).toBe('unmet');
 }
 const firstKeys=quests.filter(q=>q.category==='g_rank'&&q.rank==='G4'&&q.tags.includes('key')).slice(0,4);
 expect(references(named('斬鉄の剣、不壊の鎧').condition)).toEqual(expect.arrayContaining(firstKeys.map(q=>q.id)));
 expect(references(named('斬鉄の剣、不壊の鎧').condition)).not.toContain(final.id);
});
it("resolves the HR-cap quest without erasing independent delivery and unknown target conditions",()=>{
 const all=quests.map(q=>q.id),cap='g-rank-4-recipe-294013';
 for(const c of connections.changes){
  const q=quests.find(q=>q.id===c.questId)!;
  expect(q.condition).toEqual(c.after);
  expect(c.sourceUrls.length).toBeGreaterThan(0);
  for(const id of references(q.condition))expect(dependents(id,quests)).toContain(q);
 }
 const snow=quests.find(q=>q.name==='高難度：雪山に佇む轟竜')!;
 expect(references(snow.condition)).toContain(cap);
 expect(evaluate(snow.condition,{schemaVersion:1,completedQuestIds:all,hr:999})).toBe('met');
 expect(evaluate(snow.condition,{schemaVersion:1,completedQuestIds:all.filter(id=>id!==cap),hr:999})).toBe('unmet');
 const delivery=quests.find(q=>q.name==='高難度：喧嘩の仲裁は村を救う')!;
 expect(JSON.stringify(delivery.condition)).toContain('ユクモの木');
 expect(evaluate(delivery.condition,{schemaVersion:1,completedQuestIds:all,hr:999})).toBe('unknown');
 const six=quests.find(q=>q.category==='g_rank'&&q.name==='戦慄の遺群嶺')!;
 expect(JSON.stringify(six.condition)).toContain('6つ以上');
 expect(evaluate(six.condition,{schemaVersion:1,completedQuestIds:all,hr:999})).toBe('unknown');
});
it("has unique source URLs and sourced, exact primary predecessor/backlink references",()=>{
 expect(new Set(quests.map(q=>q.sources[0].url)).size).toBe(quests.length);
 const owners=new Map<string,string>();
 for(const rank of audit.ranks)for(const row of rank.entries){
  const own=row.observations.find(p=>p.title==='依頼')?.links[0]?.url;
  if(own)owners.set(own,row.recipeUrl);
 }
 for(const rank of audit.ranks)for(const row of rank.entries){
  const q=quests.find(q=>q.sources[0].url===row.recipeUrl)!;
  for(const p of row.observations)for(const a of p.links){
   const other=quests.find(q=>q.sources[0].url===a.url||q.sources[0].url===owners.get(a.url));
   if(!other||q===other)continue;
   if(p.title==='備考'||p.title==='依頼')expect(references(q.condition)).toContain(other.id);
   if(p.title==='他のクエスト発生に必要')expect(dependents(q.id,quests)).toContain(other);
  }
 }
});
