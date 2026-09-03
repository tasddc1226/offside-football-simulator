// SCR-029 전술실 구역: `deriveTacticalRoom`이 주는 값만 그린다(도메인 계산은 하지 않는다, D-34).
// 선발 순위 목록은 SCR-033에서도 재사용할 수 있도록 컴포넌트로 뽑는다.
import type { SelectionRanking } from '@offside/domain';
import { MATCH_APPEARANCE_LABEL_KO, SELECTION_EXCLUDED_LABEL_KO } from './labels.js';

const CAPTION_STYLE = { fontSize: 'var(--os-fs-caption)', lineHeight: 'var(--os-lh-caption)' } as const;
const BODY_STYLE = { fontSize: 'var(--os-fs-body)', lineHeight: 'var(--os-lh-body)' } as const;

/** RULE-PERF-001 familiarity(1.0/0.97/0.92 등급)를 퍼센트 문구로. */
export function familiarityPercentLabel(familiarity: number): string {
  return `${Math.round(familiarity * 100)}%`;
}

/** 선발 순위 후보 한 줄의 상태 문구: 제외 사유가 있으면 사유를, 없으면 선발/교체/결장. */
export function candidateAppearanceLabel(candidate: SelectionRanking['candidates'][number]): string {
  if (candidate.excluded !== null) return SELECTION_EXCLUDED_LABEL_KO[candidate.excluded];
  return MATCH_APPEARANCE_LABEL_KO[candidate.appearance];
}

export function SelectionRankingList({ ranking }: { ranking: SelectionRanking }) {
  return (
    <ol className="flex flex-col gap-os-1" aria-label={`${ranking.position} 선발 순위`}>
      {ranking.candidates.map((candidate) => {
        const isPlayer = candidate.id === 'PLAYER';
        return (
          <li
            key={candidate.id}
            className={[
              'flex items-center justify-between gap-os-2 rounded-os-s px-os-2 py-os-1 font-os',
              isPlayer ? 'bg-os-surface-2 font-semibold text-os-text' : 'text-os-text-2',
            ].join(' ')}
            style={CAPTION_STYLE}
          >
            <span>
              {candidate.rank}. {candidate.name}
              {isPlayer ? ' (나)' : ''}
            </span>
            <span className="os-num flex items-center gap-os-2">
              <span>OVR {candidate.baseOvr}</span>
              <span>점수 {candidate.score}</span>
              <span>{candidateAppearanceLabel(candidate)}</span>
            </span>
          </li>
        );
      })}
    </ol>
  );
}

export { BODY_STYLE as TACTICAL_ROOM_BODY_STYLE, CAPTION_STYLE as TACTICAL_ROOM_CAPTION_STYLE };
