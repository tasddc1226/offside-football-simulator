import type { CareerPos, CareerSeasonPayload, RetirementSummary } from '@offside/contracts';
import { isDefaultClubId } from '@offside/contracts/club-names';
import { controlPoints, legendTerms } from '@offside/contracts/hof-rules';
import { SLOT_OVER_PEAK } from '@offside/contracts/owner-team';
import type { PeakProfile } from '@offside/contracts/positions';
import { maxRetireAt } from '@offside/contracts/service-seasons';

// 클라이언트가 보낸 기록 값의 현실성 검사. 게임은 브라우저에서 돌고 서버는 결과만 받으므로, 모양(zod)만 맞으면
// 어떤 숫자든 들어올 수 있다. 거부하면 기기의 업로드 큐가 그 기록을 버리므로(400) 게임에서 나올 수 없는 값은
// 잘라서 저장한다. 은퇴 요약은 서버가 받아 둔 시즌 기록으로 다시 맞춘다 — 기록을 부풀리려면 시즌을 하나하나
// 그럴듯하게 지어내야 한다. 상한은 게임에서 나오는 값보다 넉넉하다(시뮬 3,000커리어·운영 상위 64명 실측: 시즌
// 출전 62·골 81·도움 62·무실점 22·A매치 17·영예 12, OVR 95, 은퇴 41세).

export const SEASON_CAP = {
  apps: 80,
  goals: 100,
  assists: 80,
  cs: 60,
  caps: 30,
  ovr: 99,
  honors: 20,
};
/**
 * 나이별 OVR 상한(만 18세부터). 새 선수의 시작 능력치는 70 이하라 어린 나이에는 OVR이 정해진 속도로만 오른다 — 운영 은퇴
 * 기록 실측 최고(조작 의심 2명 제외)가 만 18세 78·19세 84·20세 88이고, 상한은 거기에 2~3을 더했다. 만 18세에 OVR 99로
 * 시작한 커리어가 명예의 전당 1위에 오른 사례(T-11-023)를 막는다. 만 24세부터는 SEASON_CAP.ovr.
 * 서버 밸런스의 성장 수치(growthScale 등)를 올리면 이 표도 다시 구해야 한다 — 안 그러면 정상 선수가 잘려 저장된다.
 * 시즌 값에 실린 나이를 그대로 믿으므로 나이까지 꾸민 기록은 막지 못한다(시즌별 성장 폭 검사는 후속 과제).
 */
export const OVR_CAP_BY_AGE = [81, 87, 91, 94, 97, 97];
export const ovrCapAt = (age: number): number =>
  OVR_CAP_BY_AGE[Math.max(age, 18) - 18] ?? SEASON_CAP.ovr;
/**
 * 생애 나이 범위(고3 데뷔 전 · 정의된 시즌의 가장 높은 은퇴 나이까지 — 다음 시즌 은퇴 나이가 오르면 함께 오른다).
 * 커리어별 은퇴 나이(T-11-045)는 boundRetirement가 맞춘다.
 */
const MIN_AGE = 14;
/** 시즌 영예에 없이 따로 쌓이는 수상(푸스카스상 등)의 여유 — 실측 0–2개. */
const EXTRA_HONORS = 3;

/** 게임에 있는 클럽 id(병역 중의 상무 포함)면 그대로, 아니면 undefined. */
const knownClubId = (id: string | undefined) =>
  id && (id === 'sangmu' || isDefaultClubId(id)) ? id : undefined;

const cap = (v: number | undefined, max: number) =>
  v === undefined ? undefined : Math.min(v, max);

/** 시즌 한 줄을 게임에서 나올 수 있는 범위로 자른다. 영예는 중복을 지운다. */
export function sanitizeSeason(s: CareerSeasonPayload): CareerSeasonPayload {
  const apps = Math.min(s.apps, SEASON_CAP.apps);
  const goals = Math.min(s.goals, SEASON_CAP.goals, apps * 4 + 5);
  const assists = Math.min(s.assists, SEASON_CAP.assists, apps * 3 + 5);
  return {
    ...s,
    ...(s.clubId ? { clubId: knownClubId(s.clubId) } : {}),
    age: Math.min(s.age, maxRetireAt()),
    apps,
    goals,
    assists,
    ovr: Math.min(s.ovr, ovrCapAt(s.age)),
    honors: [...new Set(s.honors.map((h) => h.trim()).filter(Boolean))].slice(0, SEASON_CAP.honors),
    cs: cap(s.cs, Math.min(SEASON_CAP.cs, apps)),
    lgApps: cap(s.lgApps, apps),
    lgGoals: cap(s.lgGoals, goals),
    caps: cap(s.caps, SEASON_CAP.caps),
    comps: s.comps?.map((x) => ({
      ...x,
      apps: Math.min(x.apps, apps),
      g: Math.min(x.g, goals),
      a: Math.min(x.a, assists),
    })),
  };
}

/** 서버에 저장된 시즌 한 줄(판정에 쓰는 부분). */
export interface StoredSeason {
  year: number;
  age: number;
  apps: number;
  goals: number;
  assists: number;
  /** 시즌 평균 평점(경기 장악 점수). */
  rating: number;
  cs: number | null;
  caps: number | null;
  ovr: number;
  honors: string[];
}

/**
 * 한 선수의 생애로 이어지는 시즌만 연도 순으로. 마지막 시즌의 출생 연도(연도 − 나이)와 맞지 않거나 게임에 없는
 * 나이의 행은 뺀다. retireAge를 주면 은퇴 뒤 나이의 행(은퇴 뒤에 덧붙인 시즌)도 뺀다.
 */
export function lifeSeasons<T extends { year: number; age: number }>(
  rows: readonly T[],
  retireAge?: number | null,
): T[] {
  const sorted = [...rows].sort((a, b) => a.year - b.year);
  const last = sorted.at(-1);
  if (!last) return [];
  const birth = last.year - last.age;
  const maxAge = Math.min(maxRetireAt(), (retireAge ?? Infinity) - 1);
  return sorted.filter((r) => r.year - r.age === birth && r.age >= MIN_AGE && r.age <= maxAge);
}

/**
 * 은퇴 요약을 받아 둔 시즌 기록에 맞춘다: 통산 출전·골·도움은 시즌 합계, 은퇴 나이는 마지막 시즌 + 1, 최고
 * OVR·발롱도르·우승·수상·A매치는 시즌 기록이 허락하는 만큼, 레전드 점수는 그 값들로 낼 수 있는 최댓값까지.
 * 보낸 값이 더 작으면 그대로 둔다. 받아 둔 시즌이 없으면 null.
 */
export function boundRetirement(
  pos: CareerPos,
  summary: RetirementSummary,
  rows: readonly StoredSeason[],
  /** T-10-091 세부 포지션(레전드 점수 가중 보정). */
  dpos?: string | null,
  /** T-11-045 커리어 서비스 시즌의 은퇴 나이. 주면 그 나이 이후 시즌은 생애에서 뺀다(프리시즌 선수는 41세). */
  retireAt?: number,
): RetirementSummary | null {
  const life = lifeSeasons(rows, retireAt);
  const last = life.at(-1);
  if (!last) return null;
  const sum = (get: (r: StoredSeason) => number) => life.reduce((t, r) => t + get(r), 0);
  const honors = life.flatMap((r) => r.honors);
  const count = (h: string) => honors.filter((x) => x === h).length;

  const apps = Math.min(
    summary.apps,
    sum((r) => r.apps),
  );
  const goals = Math.min(
    summary.goals,
    sum((r) => r.goals),
  );
  const assists = Math.min(
    summary.assists,
    sum((r) => r.assists),
  );
  const cs = sum((r) => r.cs ?? 0);
  // 옛 클라이언트 시즌엔 A매치 수가 없다 — 그 시즌은 상한만큼 허용한다.
  const caps = Math.min(
    summary.caps,
    sum((r) => r.caps ?? SEASON_CAP.caps),
  );
  const peak = Math.min(summary.peak, Math.max(...life.map((r) => r.ovr)));
  const ballon = Math.min(summary.ballon, count('발롱도르'));
  const trophies = Math.min(summary.trophies, honors.length + EXTRA_HONORS);
  const awards = Math.min(summary.awards, honors.length + EXTRA_HONORS - trophies);
  const ceiling = Object.values(
    legendTerms(
      pos,
      {
        goals,
        assists,
        cs,
        apps,
        trophies,
        awards,
        caps,
        peak,
        ballon,
        // 발롱도르 순위 점수(1위 30점)는 시즌 기록에 남지 않아 뛴 해마다 1위로 친다.
        ballonRankPoints: life.length * 30,
        worldCups: count('FIFA 월드컵 우승'),
        control: controlPoints(life),
      },
      dpos,
    ),
  ).reduce((t, v) => t + v, 0);

  return {
    ...summary,
    retireAge: Math.min(summary.retireAge, last.age + 1),
    peak,
    legendScore: Math.min(summary.legendScore, Math.ceil(ceiling)),
    apps,
    goals,
    assists,
    trophies,
    awards,
    caps,
    ballon,
    ...(summary.lastClubId ? { lastClubId: knownClubId(summary.lastClubId) } : {}),
  };
}

/**
 * T-10-092 최고 시점 능력치. 세부 능력치는 서버에 없어 다시 셀 수 없다 — 자리별 실력을 (보정한) 최고 OVR +
 * SLOT_OVER_PEAK(T-11-197) 아래로 잘라, 보낸 값을 부풀려도 구단주 팀에서 그보다 세게 뛰지 못하게 한다. 대표 능력치는
 * 표시용이라 모양만 본다.
 */
export function boundProfile(profile: PeakProfile, peak: number): PeakProfile {
  const roles = Object.fromEntries(
    Object.entries(profile.roles).map(([k, v]) => [k, Math.min(v, peak + SLOT_OVER_PEAK)]),
  ) as PeakProfile['roles'];
  return { attrs: profile.attrs, roles };
}
