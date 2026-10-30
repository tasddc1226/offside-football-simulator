import {
  TITLE_CATEGORIES,
  titleLadderOf,
  type TitleCategory,
} from '@offside/contracts/owner-title';
import type { OwnerTitlesResponse } from './api/ownerProfile.js';
import { ownerProfileText as L } from './i18n/ko/ownerProfile.js';
import { parseTitle, permanentTitleOf, titleLabel } from './ownerTitle.js';
import { divisionName } from './teamDivision.js';

type Permanent = OwnerTitlesResponse['permanent'][number];
export type TitleGroupKey = TitleCategory | 'trophy';

/**
 * One selectable card per earned title; nearest unfinished goals first, ties keep catalog order.
 * T-11-556 locked shows only the next tier of each ladder (same metric), so a long catalog stays short.
 */
export function titleCollection(hall: Pick<OwnerTitlesResponse, 'titles' | 'permanent'>) {
  const earned = [
    ...new Set([...hall.permanent.filter((t) => t.earnedAt).map((t) => t.id), ...hall.titles]),
  ].filter((id) => permanentTitleOf(id) || parseTitle(id));
  const metricSeen = new Set<string>();
  const locked = hall.permanent
    .filter((t) => !t.earnedAt)
    .sort((a, b) => a.target - b.target)
    .filter((t) => {
      const metric = permanentTitleOf(t.id)?.metric ?? t.id;
      if (metricSeen.has(metric)) return false;
      metricSeen.add(metric);
      return true;
    })
    .sort(
      (a, b) =>
        b.value / b.target - a.value / a.target ||
        hall.permanent.indexOf(a) - hall.permanent.indexOf(b),
    );
  return { earned, locked, cups: earned.filter((id) => parseTitle(id)) };
}

/** T-11-556 Hall groups: permanent categories in catalog order, trophies (cup · league) last. Empty groups are dropped. */
export function titleGroups(hall: Pick<OwnerTitlesResponse, 'titles' | 'permanent'>) {
  const { earned, locked } = titleCollection(hall);
  const keys: TitleGroupKey[] = [...TITLE_CATEGORIES, 'trophy'];
  const groupOf = (id: string): TitleGroupKey => permanentTitleOf(id)?.category ?? 'trophy';
  return {
    earned: keys
      .map((key) => ({ key, ids: earned.filter((id) => groupOf(id) === key) }))
      .filter((g) => g.ids.length),
    locked: keys
      .map((key) => ({ key, items: locked.filter((t) => groupOf(t.id) === key) }))
      .filter((g) => g.items.length),
  };
}

/** '4/10', or division names for the division ladder ('프로 II / 엘리트 II'). */
export function titleProgressText(t: Pick<Permanent, 'id' | 'value' | 'target'>): string {
  if (permanentTitleOf(t.id)?.metric !== 'division') return L.progress(t);
  return `${t.value ? divisionName(t.value) : L.divisionNone} / ${divisionName(t.target)}`;
}

/** Tier label ('2/3단계') for titles on a ladder of two or more; null for single titles. */
export function titleTierText(id: string): string | null {
  const l = titleLadderOf(id);
  return l && l.steps > 1 ? L.tierStep(l) : null;
}

/** For an earned title, the next unearned tier above it with progress ('다음 단계 · 스타 공장 4/10'). */
export function titleNextTier(
  hall: Pick<OwnerTitlesResponse, 'permanent'>,
  id: string,
): string | null {
  const l = titleLadderOf(id);
  if (!l) return null;
  const next = l.ladder
    .slice(l.step)
    .map((x) => hall.permanent.find((p) => p.id === x.id))
    .find((p) => p && !p.earnedAt);
  return next
    ? L.nextTier({ name: titleLabel(next.id) ?? next.id, progress: titleProgressText(next) })
    : null;
}
