import indicators from "../data/unlock-indicators.json";
import type { Quest } from "./types";
const otherRewards = new Map<string, Set<string>>(
  Object.entries(indicators.otherRewards).map(([id, labels]) => [id, new Set(labels)]),
);
const confirmedMarkers = new Set<string>(indicators.confirmedMarkers);
/** Missing evidence means no badge, not a claim that the quest has no rewards. */
export function hasUnlockIndicator(quest: Quest): boolean {
  return confirmedMarkers.has(quest.id) || quest.unlocks.some(
    (unlock) => unlock.kind !== "other" || otherRewards.get(quest.id)?.has(unlock.label) === true,
  );
}
