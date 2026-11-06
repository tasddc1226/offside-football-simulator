// T-11-648 감독 커리어 3 결과(감독 카드). 감독 칸 효과가 바뀌지 않게 커리어 2 결과의 필드를 그대로 채우고, 3 전용 값을 더한다.
import { FORMATION_IDS, type FormationId } from '@offside/contracts/owner-team';
import {
  MANAGER_SPECIALS,
  MANAGER_SPECIALS_MAX,
  MANAGER_STYLES,
  type ManagerEnding,
  type ManagerGrade,
  type ManagerOrigin,
  type ManagerSpecial,
  type ManagerStyle,
  type MasteryGrade,
} from '@offside/contracts/manager-rules';
import {
  M3_FORMATIONS,
  M3_FORMATION_BASE,
  M3_SAVE_VERSION,
  type M3Attrs,
  type M3License,
} from './rules.js';
import { avgAttr, baseAttrs, clamp } from './people.js';
import { startRep, startStyle } from './season.js';
import type { M3State } from './types.js';

/** 바탕 포메이션 숙련: 가장 높았던 익숙함과 쓴 구간 수(변형 포메이션은 바탕으로 합친다). */
export function mastery3(s: M3State): Record<FormationId, MasteryGrade> {
  const peak: Record<FormationId, number> = { '4-3-3': 0, '4-4-2': 0, '3-5-2': 0 };
  const used: Record<FormationId, number> = { '4-3-3': 0, '4-4-2': 0, '3-5-2': 0 };
  for (const f of M3_FORMATIONS) {
    const b = M3_FORMATION_BASE[f];
    peak[b] = Math.max(peak[b], s.famPeak[f]);
    used[b] += s.blocksBy[f];
  }
  return Object.fromEntries(
    FORMATION_IDS.map((f) => {
      // 익숙함을 높게 오래 유지하고 전술 이해까지 키워야 S.
      const score = peak[f] * 0.45 + s.attrs.tac * 0.35 + Math.min(used[f], 60) * 0.3;
      return [f, score >= 86 ? 'S' : score >= 70 ? 'A' : score >= 50 ? 'B' : 'C'];
    }),
  ) as Record<FormationId, MasteryGrade>;
}

function mainStyle(s: M3State): ManagerStyle {
  return MANAGER_STYLES.reduce((a, b) => (s.styleUse[b] > s.styleUse[a] ? b : a));
}

/** 특기: 능력치 · 쓴 전술 · 기록에서 점수를 매겨 위 둘(점수 66 이상). */
export function specials3(s: M3State): ManagerSpecial[] {
  const blocks = Math.max(
    1,
    Object.values(s.styleUse).reduce((t, x) => t + x, 0),
  );
  const by = s.blocksBy;
  const wingy = (by['4-3-3'] + by['4-2-3-1'] + by['4-4-2'] * 0.5) / blocks;
  const mid = (by['3-5-2'] + by['4-2-3-1'] + by['5-3-2'] * 0.5) / blocks;
  const score: Record<ManagerSpecial, number> = {
    wing: s.attrs.atk * 0.6 + wingy * 40,
    midfield: s.attrs.tac * 0.6 + mid * 40,
    defense: s.attrs.def * 0.7 + (s.styleUse.defense / blocks) * 40,
    counter: s.attrs.tac * 0.3 + (s.styleUse.counter / blocks) * 80,
    youth: s.attrs.youth * 0.6 + Math.min(s.youthStars, 8) * 5,
  };
  return MANAGER_SPECIALS.filter((k) => score[k] >= 66)
    .sort((a, b) => score[b] - score[a])
    .slice(0, MANAGER_SPECIALS_MAX);
}

/** 표시 등급: 명성 · 우승 · 컵 · 승격 · 감독상 · 능력치, 경질은 깎는다. S는 리그 우승이 있어야 한다. */
export function grade3(s: M3State): ManagerGrade {
  const score =
    s.rep * 0.55 +
    s.titles * 7 +
    s.cups * 3 +
    s.promotions * 3 +
    s.awards * 2 +
    (avgAttr(s.attrs) - 40) * 0.5 -
    s.sacked * 5;
  return score >= 72 && s.titles > 0 ? 'S' : score >= 50 ? 'A' : score >= 34 ? 'B' : 'C';
}

export function ending3(s: M3State, grade = grade3(s)): ManagerEnding {
  const coached = s.history.filter((h) => h.clubId).length;
  if (grade === 'S' && s.titles >= 3) return 'legend';
  if (s.comeback) return 'comeback';
  if (s.promotions >= 2) return 'promoter';
  if (specials3(s)[0] === 'youth' && s.youthStars >= 4) return 'youth';
  if (s.clubs.length === 1 && coached >= 6) return 'oneclub';
  if (s.clubs.length >= 5) return 'journeyman';
  return 'steady';
}

/** 끝낸 감독 커리어 3의 결과. 끝나기 전이면 null. */
export function managerResult3(s: M3State) {
  if (s.phase !== 'done') return null;
  const grade = grade3(s);
  return {
    mastery: mastery3(s),
    style: mainStyle(s),
    specials: specials3(s),
    grade,
    ending: ending3(s, grade),
    seasons: clamp(s.season, 1, 99),
    titles: s.titles,
    cups: s.cups,
    promotions: s.promotions,
    sacked: s.sacked,
    clubs: Math.max(1, s.clubs.length),
    topLeague: s.topLeague,
    wins: s.wins,
    draws: s.draws,
    losses: s.losses,
    /** 3 전용(contracts Manager3ResultExtraSchema). */
    v3: {
      attrs: { ...s.attrs } as M3Attrs,
      license: s.license as M3License,
      rep: s.rep,
      awards: s.awards,
      youthStars: s.youthStars,
    },
  };
}

/** 커리어 최고 시즌(감독 카드 화면). 우승이 먼저, 그다음 순위 비율. */
export function bestSeason3(s: M3State) {
  return (
    [...s.history]
      .filter((h) => h.clubId)
      .sort(
        (a, b) => Number(b.title) - Number(a.title) || a.rank / a.teams - b.rank / b.teams,
      )[0] ?? null
  );
}
export type Manager3Result = NonNullable<ReturnType<typeof managerResult3>>;

/** 후보 이력서 미리 보기: 흔들림 없는 시작 능력치 · 명성 · 성향 · 첫 포메이션 · 첫 제의 리그 등급. */
export function previewManager3(o: ManagerOrigin) {
  const rep = startRep(o);
  const top = clamp(Math.floor(rep / 11), 0, 4);
  return {
    attrs: baseAttrs(o),
    rep,
    style: startStyle(o),
    formation: (o.pos === 'FW' ? '4-3-3' : o.pos === 'MF' ? '3-5-2' : '4-4-2') as FormationId,
    license: 'C' as M3License,
    firstTiers: [Math.max(0, top - 2), Math.max(0, top - 1)] as const,
  };
}

/** 저장된 세이브를 읽는다. 모양이나 버전이 다르면 null. */
export function migrateManager3Save(raw: unknown): M3State | null {
  if (!raw || typeof raw !== 'object') return null;
  const s = raw as Partial<M3State>;
  if (s.v !== M3_SAVE_VERSION || typeof s.id !== 'string' || typeof s.careerId !== 'string')
    return null;
  if (
    !s.rng ||
    typeof s.rng.seed !== 'number' ||
    !s.origin ||
    !Array.isArray(s.squad) ||
    !Array.isArray(s.history)
  )
    return null;
  return s as M3State;
}
