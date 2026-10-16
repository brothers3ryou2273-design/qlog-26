import { describe, expect, it } from "vitest";
import { quests } from "./quests";
import { permitGroups } from "./permit-groups";
import audit from "../../docs/permit-roster-audit.json";
import { dependents, evaluate, references, validateQuests } from "../lib/rules";
import { hasUnlockIndicator } from "../lib/unlocks";

describe("special permit observed groups",()=>{
 for(const group of audit.groups)it(`${group.id}: exact roster, stage order, attributes, URLs and dependencies`,()=>{
  const qs=quests.filter(q=>q.category==='permit'&&q.rank===group.id);
  expect(qs).toHaveLength(group.observedCount);
  expect(qs.map(q=>[q.id,q.name,q.order,q.permitStage,q.role,q.tags,q.sources[0].url])).toEqual(group.entries.map(r=>[r.questId,r.name,r.order,r.permitStage,r.role,r.tags,r.url]));
  expect(qs.map(q=>q.permitStage)).toEqual([...(group.legacy?Array.from({length:10},(_,i)=>`LV${i+1}`):[]),...Array.from({length:5},(_,i)=>`G${i+1}`),'超特殊許可']);
  for(const [i,q] of qs.entries()){
   expect(q.sources[0].url.startsWith('http://wiki.mhxg.org/ida/')).toBe(true);
   expect(group.entries[i].detailTitle.startsWith(q.name)).toBe(true);
   for(const panel of group.entries[i].panels)if(panel.title==='備考')for(const a of panel.links){
    const prior=quests.find(x=>x.sources[0].url===a.url);
    if(prior)expect(references(q.condition)).toContain(prior.id);
   }
   for(const id of references(q.condition))expect(dependents(id,quests)).toContain(q);
  }
  const superQuest=qs.at(-1)!;const g5=qs.at(-2)!;
  const all=quests.map(q=>q.id);
  expect(evaluate(superQuest.condition,{schemaVersion:1,completedQuestIds:all,hr:99})).toBe('unmet');
  expect(evaluate(superQuest.condition,{schemaVersion:1,completedQuestIds:all.filter(id=>id!==g5.id),hr:100})).toBe('unmet');
  expect(evaluate(superQuest.condition,{schemaVersion:1,completedQuestIds:all,hr:100})).toBe('met');
  expect(hasUnlockIndicator(superQuest)).toBe(true);
  expect(hasUnlockIndicator(qs.find(q=>q.permitStage==='G5')!)).toBe(false);
  expect(qs.every(q=>!q.tags.includes('unlock' as never))).toBe(true);
 });
 it("has 18 distinct stable selector groups and no missing/cyclic or duplicate quest references",()=>{
  expect(permitGroups).toHaveLength(18);
  expect(new Set(permitGroups.map(g=>g.id)).size).toBe(18);
  expect(new Set(quests.map(q=>q.sources[0].url)).size).toBe(quests.length);
  expect(validateQuests(quests)).toEqual([]);
 });
});

it("observed permit rosters total 228 with 12 original and 6 new groups, including 18 separate supers",()=>{
 const permits=quests.filter(q=>q.category==='permit');
 expect(permits).toHaveLength(228);
 expect(audit.groups.filter(g=>g.legacy)).toHaveLength(12);
 expect(audit.groups.filter(g=>!g.legacy)).toHaveLength(6);
 expect(permits.filter(q=>q.permitStage==='超特殊許可')).toHaveLength(18);
 expect(permits.filter(q=>q.permitStage==='G5')).toHaveLength(18);
 for(const group of audit.groups)for(const row of group.entries){
  const q=permits.find(q=>q.id===row.questId)!;
  expect(q.role).toBe(row.icons.includes('ニャンター')?'prowler':'hunter');
  const flags=[['キー','key'],['緊急','urgent'],['依頼','request']].filter(([icon])=>row.icons.includes(icon)).map(([,tag])=>tag);
  expect(q.tags).toEqual(flags.length?flags:['normal']);
 }
});
it("new G1 alternatives are OR, while Bloodbath preserves all five G1s, final urgent, HR and ordered action",()=>{
 const named=(group:string,stage:string)=>quests.find(q=>q.category==='permit'&&q.rank===group&&q.permitStage===stage)!;
 for(const group of ['朧隠','鎧裂','天眼','青電主','銀嶺']){
  const q=named(group,'G1');
  const refs=references(q.condition);
  expect(refs.length).toBe(group==='朧隠'?3:2);
  for(const id of refs)expect(evaluate(q.condition,{schemaVersion:1,completedQuestIds:[id],hr:999})).toBe('met');
 }
 const blood=named('鏖魔','G1');const refs=references(blood.condition);
 expect(refs).toHaveLength(6);
 expect(refs).toContain('g-rank-4-recipe-294013');
 expect(evaluate(blood.condition,{schemaVersion:1,completedQuestIds:quests.map(q=>q.id),hr:999})).toBe('unknown');
 for(const id of refs)expect(evaluate(blood.condition,{schemaVersion:1,completedQuestIds:refs.filter(x=>x!==id),hr:999})).toBe('unmet');
 expect(JSON.stringify(blood.condition)).toContain('クエスト1回');
 expect(blood.unlocks.filter(u=>u.label.includes('特別入手'))).toHaveLength(2);
});
