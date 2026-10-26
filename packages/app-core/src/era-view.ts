// T-11-475 시대의 라이벌 화면 모델(결산 시트 카드 · 트로피 탭 카드, 웹 · 앱 공통). 표시만 하고 게임 상태를 바꾸지 않는다.
import { flagOf, NATION_BY_CODE } from '@offside/contracts/nations';
import { posLabel } from '@offside/game/data';
import { eraTotals, type EraNote, type EraRival, type EraState } from '@offside/game/era';
import { tn } from '@offside/game/i18n/names';
import { rivalDisplayName } from '@offside/game/rival-names';
import type { CareerRecord, GameState } from '@offside/game/types';
import { eraText as L } from './i18n/ko/era';

/** 한 줄 비교. win: 1 내가 앞섬 · -1 라이벌이 앞섬 · 0 같음(또는 견줄 수 없음). */
export type EraRow = { label: string; me: string; rival: string; win: 1 | -1 | 0 };
export type EraWho = { name: string; flag: string; line: string };

export type EraCardView = {
  kind: EraNote['kind'];
  title: string;
  intro: string | null;
  who: EraWho;
  rows: readonly EraRow[];
  ballon: string | null;
  verdict: string;
  honors: readonly string[];
};

export type EraTabView = {
  who: EraWho;
  status: string;
  rows: readonly EraRow[];
  verdict: string;
  seasons: readonly { year: number; line: string; honors: readonly string[] }[];
  past: readonly string[];
};

const COUNTRY_NATION: Record<string, string> = { GB: 'GB-ENG' };
const flag = (country: string) => {
  const code = COUNTRY_NATION[country] ?? country;
  return NATION_BY_CODE.has(code) ? flagOf(code) : '';
};
const back = (pos: string) => pos === 'DF' || pos === 'GK';
const cmp = (a: number, b: number): 1 | -1 | 0 => (a > b ? 1 : a < b ? -1 : 0);
const row = (
  label: string,
  me: number,
  rival: number,
  fmt: (v: number) => string = String,
): EraRow => ({ label, me: fmt(me), rival: fmt(rival), win: cmp(me, rival) });
const verdictOf = (rows: readonly EraRow[], me: string, rival: string, even: string) => {
  const sum = rows.reduce((t, r) => t + r.win, 0);
  return sum > 0 ? me : sum < 0 ? rival : even;
};

function who(
  v: Pick<EraRival, 'name' | 'country' | 'pos' | 'dpos'>,
  age: number,
  club: string,
): EraWho {
  return {
    name: rivalDisplayName(v.name),
    flag: flag(v.country),
    line: L.who({ age, pos: posLabel(v), club: tn(club) }),
  };
}

/** 결산 시트 카드. rec는 이번 시즌 내 기록. */
export function eraCard(
  s: Pick<GameState, 'pos' | 'awards' | 'ballon'>,
  note: EraNote,
  rec: CareerRecord,
): EraCardView {
  const x = note.rival;
  const name = rivalDisplayName(note.name);
  const myAwards = s.awards.filter((a) => a.year === rec.year).length;
  const myBallon = s.ballon?.find((b) => b.year === rec.year)?.rank ?? null;
  const rows: EraRow[] = [
    row(L.rowOvr, rec.ovr, x.ovr),
    row(L.rowApps, rec.apps, x.apps),
    back(s.pos) ? row(L.rowCs, rec.cs ?? 0, x.cs) : row(L.rowGoals, rec.goals, x.goals),
    row(L.rowAssists, rec.assists, x.assists),
    row(L.rowRating, rec.rating, x.rating, (v) => (v ? v.toFixed(2) : '-')),
    row(L.rowAwards, myAwards, x.honors.length),
  ];
  if (myBallon != null || x.ballon != null) {
    const rank = (n: number | null | undefined) => (n == null ? L.ballonNone : L.ballonRank({ n }));
    rows.push({
      label: L.rowBallon,
      me: rank(myBallon),
      rival: rank(x.ballon),
      win: cmp(x.ballon ?? 99, myBallon ?? 99),
    });
  }
  const ballon =
    x.ballon === 1
      ? L.ballonRivalWon({ name })
      : myBallon === 1 && x.ballon
        ? L.ballonMeWon({ n: x.ballon })
        : myBallon && x.ballon
          ? L.ballonBoth({ me: myBallon, rival: x.ballon })
          : null;
  return {
    kind: note.kind,
    title:
      note.kind === 'new'
        ? L.titleNew
        : note.kind === 'next'
          ? L.titleNext
          : note.kind === 'retired'
            ? L.titleRetired
            : L.titleSeason,
    intro:
      note.kind === 'new'
        ? L.introNew
        : note.kind === 'next'
          ? L.introNext({ prev: rivalDisplayName(note.prev ?? ''), age: note.age })
          : note.kind === 'retired'
            ? L.introRetired({ name })
            : null,
    who: who(note, note.age, x.club),
    rows,
    ballon,
    verdict: verdictOf(rows, L.verdictMe, L.verdictRival, L.verdictEven),
    honors: x.honors.map(tn),
  };
}

/** 트로피 탭 카드: 라이벌이 나타난 해부터 통산 비교와 시즌별 기록. 라이벌이 없으면 null. */
export function eraTab(
  s: Pick<GameState, 'pos' | 'career' | 'awards'> & { era?: EraState | undefined },
): EraTabView | null {
  const v = s.era?.cur;
  const last = v?.seasons[v.seasons.length - 1];
  if (!v || !last) return null;
  const since = v.since;
  const mine = s.career.filter((r) => r.pro && r.year >= since && !r.mil);
  const them = v.seasons.filter((x) => mine.some((r) => r.year === x.year));
  const t = eraTotals(them);
  const m = mine.reduce(
    (a, r) => ({
      apps: a.apps + r.apps,
      goals: a.goals + r.goals,
      assists: a.assists + r.assists,
      cs: a.cs + (r.cs ?? 0),
    }),
    { apps: 0, goals: 0, assists: 0, cs: 0 },
  );
  const myAwards = s.awards.filter((a) => a.year >= since);
  const rows: EraRow[] = [
    row(L.rowSeasons, mine.length, them.length),
    row(L.rowApps, m.apps, t.apps),
    back(s.pos) ? row(L.rowCs, m.cs, t.cs) : row(L.rowGoals, m.goals, t.goals),
    row(L.rowAssists, m.assists, t.assists),
    row(L.rowAwards, myAwards.length, t.awards),
    row(L.rowBallonWins, myAwards.filter((a) => a.t === '발롱도르').length, t.ballonWins), // i18n-ignore 저장값
    row(
      L.rowPeak,
      Math.max(0, ...mine.map((r) => r.ovr)),
      Math.max(0, ...v.seasons.map((x) => x.ovr)),
    ),
  ];
  const past = (s.era?.past ?? []).map((p) =>
    L.pastLine({
      name: rivalDisplayName(p.name),
      from: p.since,
      to: p.seasons[p.seasons.length - 1]?.year ?? p.since,
    }),
  );
  return {
    who: who(v, last.age, last.club),
    status: v.retired != null ? L.tabRetired({ year: v.retired }) : L.tabSince({ year: since }),
    rows,
    verdict: verdictOf(rows, L.careerMe, L.careerRival, L.careerEven),
    seasons: v.seasons
      .slice()
      .reverse()
      .map((x) => ({
        year: x.year,
        line: back(v.pos)
          ? L.seasonLineBack({ ovr: x.ovr, apps: x.apps, cs: x.cs })
          : L.seasonLine({ ovr: x.ovr, apps: x.apps, g: x.goals, a: x.assists }),
        honors: x.honors.map(tn),
      })),
    past,
  };
}
