import type { CompGame } from '@offside/game/comps';
import { clubById } from '@offside/game/clubs';
import { scoreLine, type NatTourResult } from '@offside/game/national';
import type { PhaseResult } from '@offside/game/turn';
import { tn } from '@offside/game/i18n/names';
import { gameActionsText as L } from './i18n/ko/gameActions';
import { RES_LABEL, type NatGameView, type NatView, type TourView } from './sheets.js';

/** T-11-186 컵·대륙 대회 경기 줄 — 리그 페이즈는 승무패, 승부는 차전과 마지막 경기의 통과 여부. 상대·스코어는 엔진이 정하지 않는다. */
export function compGameViews(games: CompGame[]): NatGameView[] {
  let n = 0;
  return games.map((m) => {
    const stage = tn(m.stage);
    let line = m.res
      ? L.compLeagueGame({ n: ++n, res: RES_LABEL[m.res] })
      : m.leg
        ? L.compLeg({ stage, leg: m.leg })
        : stage;
    // T-11-261 대륙 대회 녹아웃은 상대 구단을 안다.
    if (m.opp) line += ` · ${L.compVs({ name: tn(clubById(m.opp)?.name ?? m.opp) })}`;
    if (m.won !== undefined)
      line += ` · ${m.stage === '결승' ? tn(m.won ? '우승' : '준우승') : m.won ? L.compThrough : L.compOut}`; // i18n-ignore 저장값(그릴 때 tn)
    return {
      line,
      hl: m.res === 'W' || m.won === true,
      detail: m.mins ? L.compDetail({ mins: m.mins, g: m.g, a: m.a }) : L.natBench,
    };
  });
}

export function natViews(nt: PhaseResult['nt']): NatView[] {
  // 명단에서 빠진 차출(called: false)은 대회명·경기가 없다.
  return (nt ?? []).map((x) => ({
    name: tn(x.name),
    comp: x.called ? tn(x.comp) : '',
    called: x.called,
    games: x.called
      ? x.games.map((m) => ({
          line: scoreLine(m),
          hl: m.res === 'W',
          detail: m.mins
            ? L.natDetail({ mins: m.mins, g: m.g, a: m.a, rating: m.rating })
            : L.natBench,
        }))
      : [],
  }));
}
// T-11-077 명단에 없던 선수는 대표팀이 우승해도 메달·병역 특례가 없다. 우승 표시만 보고 특례로 읽지 않게 적는다.
const MEDAL_STAGES = new Set(['우승', '금메달', '은메달', '동메달']);
export function tourView(x: NatTourResult): TourView {
  // 저장된 결산 시트(pending.res)에서 복원한 옛 세이브는 필드가 비어 있을 수 있다.
  const matches = x.matches ?? [];
  return {
    name: tn(x.name),
    stage: tn(x.stage),
    note: x.inSquad
      ? ''
      : [
          x.why || (matches.length ? L.natNotInSquad : ''),
          MEDAL_STAGES.has(x.stage) ? L.natNoMedal : '',
        ]
          .filter(Boolean)
          .join(' · '),
    lines: x.inSquad
      ? matches.map((m) =>
          L.natTourLine({
            stage: tn(m.stage || '조별리그'),
            score: scoreLine(m),
            mins: m.mins,
            g: m.g,
            a: m.a,
            rating: m.rating,
          }),
        )
      : [],
  };
}
