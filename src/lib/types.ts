import { permitGroups } from "../data/permit-groups";
export type Category =
  | "village"
  | "hub"
  | "g_rank"
  | "permit"
  | "event"
  | "arena"
  | "challenge";
export type QuestTag = "key" | "urgent" | "request" | "normal";
export type Rule =
  | { kind: "none" }
  | { kind: "all" | "any"; rules: Rule[] }
  | { kind: "quest_cleared"; questId: string }
  | { kind: "hr_at_least"; value: number }
  | { kind: "external_flag"; label: string }
  | { kind: "unknown"; note?: string };
export type Quest = {
  id: string;
  name: string;
  category: Category;
  rank: string;
  order: number;
  /** Display-only special-permit stage; unrelated to saved progress or QuestTag. */
  permitStage?: string;
  role: "hunter" | "prowler" | "either";
  tags: QuestTag[];
  condition: Rule;
  /** Ordinary NPC operations are instructions, not automatic eligibility gates. */
  npcNotes?: string[];
  /** Important unresolved facts, shown separately from internal verification status. */
  warnings?: string[];
  unlocks: {
    kind: "food" | "hunter_art" | "trade" | "facility" | "other";
    label: string;
    note?: string;
  }[];
  sources: {
    site: string;
    url: string;
    kind: "detail" | "list" | "home";
    checkedAt?: string;
  }[];
  verification: "verified" | "partial" | "unverified";
  verificationNote?: string;
};
export type SaveData = {
  schemaVersion: 1;
  completedQuestIds: string[];
  hr?: number;
};
export type Evaluation = "met" | "unmet" | "unknown";
export const categories: { id: Category; label: string; ranks: string[] }[] = [
  {
    id: "village",
    label: "村",
    ranks: Array.from({ length: 10 }, (_, i) => String(i + 1)),
  },
  { id: "hub", label: "集会所", ranks: ["1", "2", "3", "4", "5", "6", "7"] },
  { id: "g_rank", label: "G級", ranks: ["G1", "G2", "G3", "G4"] },
  { id: "permit", label: "特殊許可", ranks: permitGroups.map((g) => g.id) },
  { id: "event", label: "イベント", ranks: ["下位", "上位", "G級"] },
  { id: "arena", label: "闘技大会", ranks: ["全ランク"] },
  { id: "challenge", label: "チャレンジ", ranks: ["全ランク"] },
];
export const tagLabels: Record<QuestTag, string> = {
  key: "キー",
  urgent: "緊急",
  request: "依頼",
  normal: "通常",
};
