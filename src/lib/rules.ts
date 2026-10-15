import type { Evaluation, Quest, Rule, SaveData } from "./types";
export function evaluate(rule: Rule, save: SaveData): Evaluation {
  switch (rule.kind) {
    case "none":
      return "met";
    case "unknown":
    case "external_flag":
      return "unknown";
    case "quest_cleared":
      return save.completedQuestIds.includes(rule.questId) ? "met" : "unmet";
    case "hr_at_least":
      return save.hr === undefined
        ? "unknown"
        : save.hr >= rule.value
          ? "met"
          : "unmet";
    case "all":
    case "any": {
      if (!rule.rules.length) return "unknown";
      const states = rule.rules.map((r) => evaluate(r, save));
      if (rule.kind === "all")
        return states.includes("unmet")
          ? "unmet"
          : states.includes("unknown")
            ? "unknown"
            : "met";
      return states.includes("met")
        ? "met"
        : states.includes("unknown")
          ? "unknown"
          : "unmet";
    }
  }
}
export function references(rule: Rule): string[] {
  if (rule.kind === "quest_cleared") return [rule.questId];
  if (rule.kind === "all" || rule.kind === "any")
    return [...new Set(rule.rules.flatMap(references))];
  return [];
}
export function dependents(id: string, quests: Quest[]): Quest[] {
  return quests.filter((q) => references(q.condition).includes(id));
}
export function validateQuests(quests: Quest[]): string[] {
  const errors: string[] = [];
  const ids = new Set<string>();
  for (const q of quests) {
    if (!q.id || ids.has(q.id)) errors.push(`ID重複・空: ${q.id}`);
    ids.add(q.id);
  }
  function checkRule(rule: Rule, id: string) {
    if (rule.kind === "all" || rule.kind === "any") {
      if (!rule.rules.length) errors.push(`空の条件: ${id}`);
      rule.rules.forEach((r) => checkRule(r, id));
    }
    if (
      rule.kind === "hr_at_least" &&
      (!Number.isInteger(rule.value) || rule.value < 1)
    )
      errors.push(`無効HR: ${id}`);
  }
  for (const q of quests) {
    checkRule(q.condition, q.id);
    for (const ref of references(q.condition))
      if (!ids.has(ref)) errors.push(`参照先欠落: ${q.id} → ${ref}`);
    if (!q.sources.length) errors.push(`出典なし: ${q.id}`);
    for (const source of q.sources) {
      try {
        if (new URL(source.url).protocol !== "https:") throw Error();
      } catch {
        errors.push(`無効URL: ${q.id}`);
      }
      if (q.verification === "verified" && !source.checkedAt)
        errors.push(`確認日なし: ${q.id}`);
    }
    const hasUnknown = (r: Rule): boolean =>
      r.kind === "unknown" ||
      ((r.kind === "all" || r.kind === "any") && r.rules.some(hasUnknown));
    if (q.verification === "verified" && hasUnknown(q.condition))
      errors.push(`未確認条件を検証済み扱い: ${q.id}`);
  }
  const active = new Set<string>(),
    done = new Set<string>();
  function visit(id: string) {
    if (active.has(id)) {
      errors.push(`循環依存: ${id}`);
      return;
    }
    if (done.has(id)) return;
    active.add(id);
    const q = quests.find((q) => q.id === id);
    if (q) references(q.condition).forEach(visit);
    active.delete(id);
    done.add(id);
  }
  quests.forEach((q) => visit(q.id));
  return errors;
}
