// SCR-015 CompareCards: 06 "핵심 컴포넌트" "항목 하나씩 세그먼트 전환·차이만 보기·고정 기준 행".
// 기준 카드("이번 시즌")는 항상 첫 카드로 고정하고, 두 번째 카드만 세그먼트(지난 시즌/계약 약속)를
// 전환한다. 360px는 CompareCards 자체가 세로 스택만 렌더한다(3열 가로 스크롤 없음).
import { useEffect, useRef, useState } from 'react';
import { CompareCards, Tabs, TabsList, TabsTrigger, type CompareCardItem, type CompareRow } from '@offside/ui';
import type { SeasonResultView } from './season-result-view.js';
import { ratingText } from './season-schedule.js';
import { SQUAD_ROLE_LABELS } from './labels.js';

const CAPTION_STYLE = { fontSize: 'var(--os-fs-caption)', lineHeight: 'var(--os-lh-caption)' } as const;

export type CompareTarget = 'PREVIOUS_SEASON' | 'PROMISE';

export type CompareRowView = { id: string; label: string; baselineText: string; comparisonText: string; same: boolean };

export const COMPARE_TARGET_LABEL_KO: Record<CompareTarget, string> = {
  PREVIOUS_SEASON: '지난 시즌',
  PROMISE: '계약 약속',
};

/** 지난 시즌 결과가 있을 때만 그 세그먼트를 더한다. 첫 시즌은 계약 약속만(브리프). */
export function availableCompareTargets(view: SeasonResultView): CompareTarget[] {
  const targets: CompareTarget[] = [];
  if (view.previousResult !== null) targets.push('PREVIOUS_SEASON');
  targets.push('PROMISE');
  return targets;
}

function buildPreviousSeasonRows(view: SeasonResultView): CompareRowView[] {
  const previous = view.previousResult;
  if (previous === null) return [];
  const previousAvgTenths =
    previous.playerStats.ratedMatches === 0
      ? null
      : Math.round(previous.playerStats.ratingSumTenths / previous.playerStats.ratedMatches);

  return [
    {
      id: 'appearances',
      label: '출전',
      baselineText: String(view.common.total),
      comparisonText: String(previous.playerStats.appearances.total),
      same: view.common.total === previous.playerStats.appearances.total,
    },
    {
      id: 'minutes',
      label: '출전 시간(분)',
      baselineText: String(view.common.minutes),
      comparisonText: String(previous.playerStats.minutes),
      same: view.common.minutes === previous.playerStats.minutes,
    },
    {
      id: 'avgRating',
      label: '평균 평점',
      baselineText: ratingText(view.common.avgRatingTenths),
      comparisonText: ratingText(previousAvgTenths),
      same: view.common.avgRatingTenths === previousAvgTenths,
    },
    {
      id: 'baseOvr',
      label: 'Base OVR',
      baselineText: String(view.baseOvr.after),
      comparisonText: String(previous.baseOvr.after),
      same: view.baseOvr.after === previous.baseOvr.after,
    },
  ];
}

function buildPromiseRows(view: SeasonResultView): CompareRowView[] {
  const { promise } = view;
  const actualPercent = Math.round(promise.minutesShareBp / 100);
  const targetPercent = Math.round(view.promiseThresholdBp / 100);
  return [
    {
      id: 'role',
      label: '역할',
      baselineText: SQUAD_ROLE_LABELS[promise.delivered],
      comparisonText: SQUAD_ROLE_LABELS[promise.promised],
      same: promise.delivered === promise.promised,
    },
    {
      id: 'minutesShare',
      label: '출전 비율',
      baselineText: `${actualPercent}%`,
      comparisonText: `${targetPercent}% 이상`,
      same: actualPercent === targetPercent,
    },
  ];
}

export function buildCompareRows(view: SeasonResultView, target: CompareTarget): CompareRowView[] {
  return target === 'PREVIOUS_SEASON' ? buildPreviousSeasonRows(view) : buildPromiseRows(view);
}

export function filterCompareRows(rows: CompareRowView[], diffOnly: boolean): CompareRowView[] {
  return diffOnly ? rows.filter((row) => !row.same) : rows;
}

export function SeasonCompareSection({
  view,
  onTargetChange,
}: {
  view: SeasonResultView;
  onTargetChange?: (target: CompareTarget) => void;
}) {
  const targets = availableCompareTargets(view);
  const [target, setTarget] = useState<CompareTarget>(targets[0] ?? 'PROMISE');
  const [diffOnly, setDiffOnly] = useState(false);
  const onTargetChangeRef = useRef(onTargetChange);
  onTargetChangeRef.current = onTargetChange;

  useEffect(() => {
    // target이 바뀔 때만(마운트 포함) 통지한다. ref로 콜백 identity 변화는 무시한다.
    onTargetChangeRef.current?.(target);
  }, [target]);

  const rows = filterCompareRows(buildCompareRows(view, target), diffOnly);
  const cards: CompareCardItem[] = [
    { id: 'current', title: '이번 시즌' },
    { id: 'target', title: COMPARE_TARGET_LABEL_KO[target] },
  ];
  const compareRows: CompareRow[] = rows.map((row) => ({
    id: row.id,
    label: row.label,
    cells: [{ value: row.baselineText }, { value: row.comparisonText, highlighted: !row.same }],
  }));

  return (
    <div className="flex flex-col gap-os-3">
      {targets.length > 1 ? (
        <Tabs value={target} onValueChange={(value) => setTarget(value as CompareTarget)}>
          <TabsList aria-label="비교 대상">
            {targets.map((candidate) => (
              <TabsTrigger key={candidate} value={candidate}>
                {COMPARE_TARGET_LABEL_KO[candidate]}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
      ) : null}
      <label className="inline-flex items-center gap-os-2 font-os text-os-text-2" style={CAPTION_STYLE}>
        <input type="checkbox" checked={diffOnly} onChange={(event) => setDiffOnly(event.target.checked)} />
        차이만 보기
      </label>
      {compareRows.length === 0 ? (
        <p className="font-os text-os-text-2" style={CAPTION_STYLE}>
          차이가 없습니다.
        </p>
      ) : (
        <CompareCards cards={cards} rows={compareRows} />
      )}
    </div>
  );
}
