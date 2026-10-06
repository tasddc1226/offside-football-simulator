import { measureOperation } from './measurement.js';
import type { Progress } from './player-metrics.js';
import { marketFeedback, offerFeedback } from './career-feedback.js';
// ───────── 게임 진행 액션 (웹·앱 공용, T-11-002) ─────────
// 게임 로직을 호출하고, 그 결과를 시트 뷰 모델(sheets.ts)로 바꿔 시트에 띄운다. 상태·시트·저장·업로드·분석은
// 클라이언트가 host로 넘긴다(웹은 Svelte `$state` 프록시, 앱은 자기 스토어 — 넘긴 객체를 그대로 고친다).
// 게임 로직 호출 순서(=RNG 소비 순서)는 포팅 전 ui.ts와 동일하게 유지한다.
import type { SeasonGrowth } from '@offside/contracts';
import { isHofEligible, SHORT_CAREER_NOTE } from '@offside/contracts/hof-rules';
import { PHASES, LAST_PHASE, type AttrKey } from '@offside/game/data';
import { clamp, createRng, freshSeed, setActiveRng } from '@offside/game/rng';
import { generateCandidates, type CandidatePotential } from '@offside/game/candidates';
import {
  leagueOf,
  clubsIn,
  fmtMoney,
  snapshot,
  diffChips,
  newGame,
  isPro,
  isSafe,
  resolveChoice,
  txt,
  roleOf,
  STORIES,
  teamRank,
  roundRange,
} from '@offside/game/engine';
import { playPhase, type PhaseResult } from '@offside/game/turn';
import { eventById } from '@offside/game/events-data';
import { applyLatestBalance, choiceOdds } from '@offside/game/balance';
import { offsetToRoll, tapOffset, timingNote, zoneLabel, zoneWidth } from '@offside/game/minigame';
import { isHiddenEvent } from '@offside/game/dexGroups';
import { scoreLine, type NatTourResult } from '@offside/game/national';
import { isMilOption } from '@offside/game/military';
import {
  endSeason,
  market,
  acceptOption,
  canAcceptRenewal,
  retire,
  MIN_RETIRE_AGE,
  loadKey,
  saveKey,
  type SeasonEndResult,
} from '@offside/game/season';
import { pickFanLines } from '@offside/game/fanfeed';
import { chLabel } from '@offside/game/records';
import { titleView } from '@offside/game/titles';
import type {
  CareerRecord,
  Choice,
  EventDef,
  EventLogEntry,
  GameState,
  HofEntry,
  MarketResult,
  MarketOption,
  OfferOption,
  RenewOption,
} from '@offside/game/types';
import { markDexSeen } from './dex.js';
import { pushEvLog, seasonLabel } from './career.js';
import { scoutHint } from './scoutHint.js';
import { recordPhaseOvr, takeSeasonGrowth } from './growth.js';
import { publicNameOf } from './namePublic.js';
import { fmtValue, seasonLabelOf } from './format.js';
import { crossesBorder, flightHours, hubOf } from './flight.js';
import { gameActionsText as L } from './i18n/ko/gameActions';
import { tn } from '@offside/game/i18n/names';

/** 비행 지도는 육지 데이터가 커서 해외 이적일 때만 불러온다(계약서를 여는 순간 미리 받아 둔다). */
const loadFlightMap = () => import('./flight-map.js');
import { matchRows, type SheetController } from './sheet-controller.js';
import {
  draftBody,
  draftCareerRules,
  randomName,
  randomNumber,
  type AppState,
  type Screen,
} from './state.js';
import type { NatView, TourView } from './sheets.js';

export interface GameHost {
  state: AppState;
  sheet: SheetController;
  /** 진행 중 세이브(state.G)를 저장한다. */
  save(): void;
  toast(text: string): void;
  /** 화면 맨 위로(smooth: 부드럽게 — 감속 모션이면 클라이언트가 바로 옮긴다). */
  scrollTop(smooth: boolean): void;
  uploadSeason(s: GameState, rec: CareerRecord, growth?: SeasonGrowth): void;
  uploadRetirement(careerId: string, entry: HofEntry): void;
  analytics: {
    complete?(p: Progress): void;
    replace(): void;
    start(s: GameState, previous: GameState | null): void;
    play(s: GameState, firstAction?: boolean): void;
    firstSeason(s: GameState): void;
    retire(s: GameState): void;
  };
  trackPage(screen: Screen): void;
}

function natViews(nt: PhaseResult['nt']): NatView[] {
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
function tourView(x: NatTourResult): TourView {
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

// ───────── 후보 선수 카드 (T-10-002) ─────────
// T-10-112 스카우트 시드: 한 번 정하면 커리어가 고3 첫 시즌을 마칠 때까지 유지한다. 뒤로 가기·새로 고침·
// 시작 직후 포기로 다시 와도 같은 조건이면 같은 후보가 나온다(다시 뽑아 고르는 리세 방지).
const SCOUT_SEED = 'ft_scout_seed';
const SCOUT_REVEAL = 'ft_scout_reveal';
function scoutSeed(): number {
  const kept = loadKey<number>(SCOUT_SEED);
  if (typeof kept === 'number') return kept;
  const seed = freshSeed();
  saveKey(SCOUT_SEED, seed);
  return seed;
}
const releaseScoutSeed = () => saveKey(SCOUT_SEED, null);

export function createGameActions(host: GameHost) {
  const appState = host.state;
  const sheet = host.sheet;

  // T-10-024: 구간 진행 시트(T-10-028부터 경기는 중계 시트)를 닫은 뒤, 결과를 시즌 탭 맨 위 리포트 카드로
  // 그린다. 이벤트·시즌 결산은 액션바 버튼으로 이어서 연다(nextPending).
  let advancing = false;
  async function advance() {
    if (
      advancing ||
      sheet.state.busy ||
      !appState.G ||
      appState.G.retired ||
      appState.G.pending ||
      appState.G.phase > LAST_PHASE
    )
      return;
    advancing = true;
    try {
      const s = appState.G,
        ph = s.phase;
      const before = snapshot(s);
      const rankBefore = teamRank(s);
      // T-10-046: 한 구간의 게임 로직(훈련 → 경기 → 대회 → A매치 → 이벤트 추첨 → 칭호)은 game/turn.ts가 진행한다.
      recordPhaseOvr(s); // T-11-048 구간에 들어갈 때의 OVR(성장 기록).
      let r: PhaseResult;
      try {
        r = playPhase(s);
        measureOperation('progress', 'success');
      } catch (error) {
        measureOperation('progress', 'failed', 'progress_blocked');
        throw error;
      }
      host.analytics.complete?.({ cid: s.cid, year: s.year, phase: ph, matches: r.block?.n ?? 0 });
      const { block: b, comp, nt, ev } = r;
      // 부상 소식은 로그 문장이 아니라 엔진이 알려 주는 신호로 기록한다(언어가 달라도 같다).
      if (b?.injured) s.flags.injuredYear = s.year;
      const chips = diffChips(s, before, r.after);
      const titles = r.titles.map(titleView);
      const title = ph === 0 ? L.preseasonDone : L.phaseResult({ phase: PHASES[ph]! });
      s.pending = ev
        ? { type: 'event', id: ev, then: s.phase > LAST_PHASE ? 'seasonEnd' : null }
        : s.phase > LAST_PHASE
          ? { type: 'seasonEnd' }
          : null;
      host.save();
      host.analytics.play(s, ph === 0 && s.career.length === 0);
      const extras = [
        ...(comp.length ? [L.stepComps] : []),
        ...(nt ? [L.stepNat] : []),
        ...(ev ? [L.stepEvent] : []),
      ];
      const games = b ? matchRows(s, b) : [];
      const range = b ? roundRange(s, ph) : '';
      const back = s.pos === 'DF' || s.pos === 'GK';
      // T-10-028: 경기는 중계 시트로 한 경기씩 보여 주고(승무패·스코어가 쌓이는 맛), 끝나면 리포트로 넘어간다.
      if (b) {
        await sheet.playBlock(
          {
            eyebrow: L.phaseRunning({ year: s.year, phase: PHASES[ph]! }),
            title: L.blockTitle({ range, n: b.n }),
            back,
            matches: leagueOf(s.leagueId).matches,
          },
          b,
          games,
          extras,
        );
      } else
        await sheet.playSteps(L.preseasonRunning({ year: s.year }), [
          isPro(s) ? L.stepCampPro : L.stepCampAmateur,
          L.stepFitness,
          L.stepTactics,
          L.stepFriendly,
          ...extras,
        ]);
      sheet.closeSheet();
      appState.report = {
        key: Date.now(),
        year: s.year,
        ph,
        eyebrow: `${s.year} · ${title}`,
        title: b ? L.blockTitle({ range, n: b.n }) : L.preseasonReady,
        back,
        block: b
          ? {
              w: b.w,
              d: b.d,
              l: b.l,
              apps: b.apps,
              goals: b.goals,
              assists: b.assists,
              rating: b.apps ? (b.rs / b.apps).toFixed(2) : null,
              cs: b.cs,
              hl: b.hl,
            }
          : null,
        games,
        rank: { before: rankBefore, after: teamRank(s) },
        role: roleOf(s),
        comps: comp.map((c) => ({ t: c.t, good: c.k === 'good' })),
        nat: natViews(nt),
        chips,
        titles,
      };
      appState.tab = 'season';
      host.scrollTop(true);
    } finally {
      advancing = false;
    }
  }

  function nextPending() {
    const s = appState.G;
    if (!s) return;
    const p = s.pending;
    if (!p) return backToSeason();
    if (p.type === 'event') return showEvent(p.id);
    if (p.type === 'seasonEnd') {
      if (sheet.state.busy) return;
      appState.report = null;
      const growth = takeSeasonGrowth(s); // endSeason이 시즌 끝 값을 다음 시즌으로 넘기기 전에 뜬다.
      const res = endSeason(s);
      host.uploadSeason(s, res.rec, growth);
      s.pending = { type: 'market', res, m: null };
      host.save();
      host.analytics.play(s);
      host.analytics.firstSeason(s);
      const steps = [
        L.endTable,
        ...(res.tours.length ? [L.endTours] : []),
        L.endAwards,
        L.endRecords,
      ];
      void sheet.playSteps(L.endRunning({ year: res.rec.year }), steps, 560).then(nextPending);
      return;
    }
    if (p.type === 'market') {
      if (p.res) return showSeasonEnd(p.res);
      // Old saves may be paused at a forced retirement before the new minimum.
      if (!p.m || (s.age < MIN_RETIRE_AGE && !p.m.options.length)) {
        p.m = market(s);
        host.save();
      }
      return showMarket(p.m);
    }
  }

  /** T-10-089: 원터치 미니게임으로 가릴 선택지의 장면(감속 모션이면 지금처럼 확률 판정). */
  const activeMg = (c: Choice) => (sheet.motionOK() && c.p ? c.mg : undefined);

  function choiceView(s: GameState, ev: EventDef, c: Choice, i: number) {
    const label = txt(c.label, s);
    if (!c.p)
      return isSafe(ev, c)
        ? { label, odds: L.oddsSafe, hint: L.oddsSafeHint }
        : { label, odds: L.oddsSure };
    const odds = choiceOdds(c.p(s), ev.id, i);
    const mg = activeMg(c);
    if (!mg) return { label, odds: `${Math.round(odds * 100)}%` };
    return {
      label,
      odds: L.oddsMinigame({ zone: zoneLabel(zoneWidth(odds, mg.kind)) }),
      hint: L.oddsMinigameHint,
    };
  }

  function showEvent(id: string) {
    const s = appState.G!;
    const ev = eventById(id)!;
    sheet.showSheet({
      kind: 'event',
      eyebrow: `Event · ${s.year} ${PHASES[Math.max(0, s.phase - 1)]}`,
      title: ev.title,
      text: ev.text(s),
      story: ev.story
        ? {
            name: tn(STORIES[ev.story]!.name),
            stage: ev.stage ?? 0,
            total: STORIES[ev.story]!.total,
          }
        : null,
      choices: ev.choices.map((c, i) => choiceView(s, ev, c, i)),
    });
  }

  async function chooseEvent(i: number) {
    if (sheet.state.busy || !appState.G) return;
    const s = appState.G,
      p = s.pending;
    if (p?.type !== 'event') return;
    const ev = eventById(p.id)!,
      c = ev.choices[i]!,
      label = txt(c.label, s);
    // 판정·기록·저장은 한 번에 끝낸다(연출 도중 새로고침해도 결과가 바뀌지 않게). 미니게임이면 탭 결과로 판정한다.
    const settle = (tap?: { roll: number; d: number }) => {
      const r = resolveChoice(s, p.id, i, tap?.roll);
      // T-10-012: 처음 겪은 스토리·특별 이벤트는 도감에서 열린다 — 결과 시트 안에서 알린다(토스트는 확인 버튼을 가린다).
      const dexNew = markDexSeen(p.id, appState.G) && isHiddenEvent(ev) ? ev.title : null;
      const entry: EventLogEntry = { k: 'ev', id: p.id, c: i, ok: r.ok, h: s.phase };
      if (tap) entry.mg = Math.min(1000, Math.round(tap.d * 100));
      pushEvLog(s, entry);
      s.pending = p.then === 'seasonEnd' ? { type: 'seasonEnd' } : null;
      host.save();
      host.analytics.play(s);
      return { ...r, dexNew, timing: tap ? timingNote(tap.d) : null };
    };
    const mg = activeMg(c);
    let r: ReturnType<typeof settle>;
    if (mg) {
      const odds = choiceOdds(c.p?.(s), p.id, i),
        w = zoneWidth(odds, mg.kind);
      r = await sheet.playMinigame(label, mg.kind, w, mg.side ?? null, (x, center) => {
        const d = tapOffset(x, center, w);
        return settle({ roll: offsetToRoll(d, odds), d });
      });
    } else {
      r = settle();
      if (r.p < 1) await sheet.playJudge(label, r.p, r.roll);
    }
    sheet.showSheet(
      {
        kind: 'eventResult',
        label,
        outcome: r.p < 1 ? (r.ok ? L.outcomeOk : L.outcomeFail) : L.outcomeDecided,
        ok: r.ok,
        text: r.text,
        chips: r.chips,
        twist: r.twist || null,
        story: r.story && {
          ...r.story,
          name: tn(r.story.name),
          ending: r.story.ending && tn(r.story.ending),
        },
        dexNew: r.dexNew,
        timing: r.timing,
      },
      [{ label: L.ok, cls: 'btn-primary', fn: nextPending }],
      backToSeason,
    );
  }

  function showSeasonEnd(res: SeasonEndResult) {
    // pending.res로 복원된 옛 세이브에는 뒤에 추가된 필드(titles 등)가 없을 수 있다.
    const {
      rec,
      trophies,
      awards,
      notes,
      gala = [],
      tours = [],
      miles = [],
      titles = [],
      promo,
    } = res;
    const s = appState.G!;
    // T-10-112 고3 첫 시즌이 끝났다. 다음 커리어는 새 후보를 받는다.
    const firstScout = s.career.length === 1;
    if (firstScout) releaseScoutSeed();
    const [col, colLabel] =
      s.pos === 'GK' || s.pos === 'DF' ? [rec.cs, L.colCs] : [rec.assists, L.colAssists];
    // T-10-034: indexOf(rec)는 $state 프록시라 늘 -1이었다(이적 팬 반응이 안 나옴) — 연도로 찾는다.
    const idx = s.career.findIndex((r) => r.year === rec.year);
    const prev = idx > 0 ? s.career[idx - 1] : null;
    const fans = pickFanLines(s, rec, {
      gotTrophy: trophies.length > 0,
      // 구간 경기에서 다친 시즌이거나 지금도 결장 중이면(로그 문장을 읽지 않는다).
      injuredThisSeason: s.flags.injuredYear === rec.year || s.injury > 0,
      transferredThisSeason: !!prev && prev.club !== rec.club,
      hasMilestone: miles.length > 0,
    });
    sheet.showSheet(
      {
        kind: 'season',
        eyebrow: `${seasonLabelOf(rec)} Season Review`,
        title: L.seasonTitle({ club: tn(rec.club), league: tn(rec.league), rank: rec.rank }),
        ch: (rec.ch || []).map(chLabel),
        stats: {
          apps: rec.apps,
          goals: rec.goals,
          col: col ?? 0,
          colLabel,
          rating: rec.rating ? rec.rating.toFixed(2) : '-',
        },
        honors: [...trophies, ...awards].map(tn),
        comps: (rec.comps || []).map((c) =>
          L.compLine({ name: tn(c.name), stage: tn(c.stage), apps: c.apps, g: c.g, a: c.a }),
        ),
        tours: tours.map(tourView),
        gala,
        miles: miles.map(tn),
        titles,
        promo: promo && { club: tn(promo.club), down: tn(promo.down) },
        notes,
        scoutHint: scoutHint(s, rec.year),
        fans,
        age: s.age,
      },
      [
        {
          label: L.toMarket,
          cls: 'btn-primary',
          fn: () => {
            const p = appState.G!.pending;
            if (p?.type === 'market') p.res = null;
            host.save();
            nextPending();
          },
        },
      ],
    );
  }

  function showMarket(m: MarketResult) {
    const G = appState.G!;
    // T-11-076 구단 전력 옆에 그 리그 구단들의 평균 전력(커리어 승강 반영)을 붙여 리그 안 수준을 가늠하게 한다.
    // League.avg는 경기 계산 기준값이라 구단 평균보다 2 낮다 — 여기서는 쓰지 않는다.
    const strLine = (leagueId: string, str: number) => {
      const cs = clubsIn(leagueId, G);
      const avg = Math.round(cs.reduce((t, c) => t + c.str, 0) / Math.max(1, cs.length));
      return L.strLine({ league: tn(leagueOf(leagueId).name), str, avg });
    };
    // 지금 구단(잔류·재계약·연장)도 제의처럼 팀 전력을 보여 줘야 비교할 수 있다.
    const own = () => ({ clubId: G.club.id, lg: strLine(G.leagueId, G.club.str) });
    sheet.showSheet(
      {
        kind: 'market',
        assessment: marketFeedback(G, m),
        eyebrow: `${seasonLabel(G)} Transfer Window`,
        note: m.note,
        options: m.options.map((o) => {
          if (o.kind === 'offer') {
            const extra = `${o.role ? ` · ${tn(o.role)}` : ''}${o.fee ? ` · ${L.feeAbout({ fee: fmtValue(o.fee) })}` : G.contract && !leagueOf(G.leagueId).amateur ? ` · ${L.freeAgent}` : ''}`;
            return {
              clubId: o.clubId,
              reason: offerFeedback(G, o),
              name: tn(o.name),
              lg: strLine(o.leagueId, o.str),
              salary: fmtMoney(o.salary),
              sub: `${L.contractYears({ years: o.years })}${extra}`,
            };
          }
          if (o.kind === 'renew')
            return {
              ...own(),
              name: o.name,
              salary: fmtMoney(o.salary),
              sub: o.extension
                ? L.renewExtension({ ext: o.extension.years, total: o.years, desc: o.desc })
                : `${L.contractYears({ years: o.years })}${o.desc ? ` · ${o.desc}` : ''}`,
            };
          if (o.kind === 'stay') return { ...own(), name: o.name, salary: null, sub: o.desc };
          return { name: o.name, lg: o.desc ?? '', salary: null, sub: null };
        }),
      },
      // T-11-118: 25세부터 은퇴할 수 있다. 병역 등으로 시장에서 은퇴를 권하지 않으면 한 번 더 묻는다.
      G.age >= MIN_RETIRE_AGE
        ? [{ label: L.retireBtn, fn: () => (m.canRetire ? doRetire() : retireAsk(nextPending)) }]
        : [],
    );
  }

  function pickOption(i: number) {
    // 이적시장 옵션은 G.pending.m에 이미 저장돼 있다(nextPending이 만든 그 목록).
    const p = appState.G?.pending;
    const options = p?.type === 'market' ? (p.m?.options ?? []) : [];
    const o = options[i];
    if (!o || !appState.G) return;
    // T-11-039 다른 구단의 오퍼는 계약서에 사인해야 확정된다(×로 닫으면 이적시장으로 돌아온다).
    if (o.kind === 'offer' || (o.kind === 'renew' && o.extension))
      return showContract(i, o, options);
    if (settleOption(i, o, options)) startSeason();
  }

  /** T-11-039 계약서. 아마추어(고교·대학)에서 처음 프로 구단에 가면 입단 계약, 그 밖에는 이적 계약. */
  function showContract(i: number, o: OfferOption | RenewOption, options: MarketOption[]) {
    const G = appState.G!;
    const extension = o.kind === 'renew' ? o.extension : undefined;
    const rookie = o.kind === 'offer' && !!leagueOf(G.leagueId).amateur;
    if (o.kind === 'offer' && crossesBorder(G.leagueId, o.leagueId))
      void loadFlightMap().catch(() => {});
    sheet.showSheet({
      kind: 'contract',
      eyebrow: extension ? 'Extension Contract' : rookie ? 'Rookie Contract' : 'Transfer Contract',
      title: extension
        ? L.contractTitleExt
        : rookie
          ? L.contractTitleRookie
          : L.contractTitleTransfer,
      text: extension ? L.contractTextExt : L.contractTextStart({ club: tn(o.name), rookie }),
      club: {
        id: o.kind === 'offer' ? o.clubId : G.club.id,
        name: o.kind === 'offer' ? o.name : G.club.name,
      },
      terms: [
        { label: L.termSalary, value: fmtMoney(o.salary) },
        ...(extension
          ? [
              { label: L.termLeft, value: L.termLeftValue },
              { label: L.termExtra, value: L.termYears({ n: extension.years }) },
              { label: L.termTotal, value: L.termYears({ n: o.years }) },
            ]
          : [{ label: L.termPeriod, value: L.termYears({ n: o.years }) }]),
        ...(o.kind === 'offer' && o.fee
          ? [{ label: L.termFee, value: L.termFeeValue({ fee: fmtValue(o.fee) }) }]
          : []),
        ...(o.kind === 'offer' && o.role ? [{ label: L.termRole, value: tn(o.role) }] : []),
      ],
      name: G.name,
      cta: extension ? L.ctaExt : rookie ? L.ctaRookie : L.ctaTransfer,
      // 두 번 눌러도 한 번만 부른다(본문이 도장을 찍으며 버튼을 잠근다).
      onSign: () => void signContract(i, o, options),
      onClose: nextPending,
    });
  }

  /** 사인한 오퍼를 확정하고, 나라가 바뀌면 새 리그의 나라로 날아가는 장면을 보여 준 뒤 시즌을 연다. */
  async function signContract(i: number, o: OfferOption | RenewOption, options: MarketOption[]) {
    const fromLg = appState.G?.leagueId;
    if (!fromLg) return;
    if (!settleOption(i, o, options)) return;
    if (o.kind === 'offer' && crossesBorder(fromLg, o.leagueId)) {
      const from = hubOf(fromLg),
        to = hubOf(o.leagueId);
      // 지도를 못 불러오면(오프라인 등) 비행 장면만 건너뛴다 — 이적은 이미 확정됐다.
      const map = await loadFlightMap().then(
        (m) => m.flightMap(from, to),
        () => null,
      );
      if (map)
        await sheet.playFlight({
          eyebrow: 'Transfer Flight',
          title: L.flyingTo({ city: to.city }),
          sub: L.flightSub({
            country: to.country,
            league: tn(leagueOf(o.leagueId).name),
            hours: flightHours(from, to),
          }),
          from: { code: from.code, city: from.city },
          to: { code: to.code, city: to.city },
          map,
        });
    }
    startSeason();
  }

  /** 고른 옵션을 확정·저장한다. 병역 결과처럼 따로 시트를 띄웠으면 false(시즌 시작은 그 시트가 맡는다). */
  function settleOption(i: number, o: MarketOption, options: MarketOption[]): boolean {
    const G = appState.G;
    const p = G?.pending;
    // 계약서의 오래된 콜백·중복 사인은 이미 소비한 시장을 다시 확정할 수 없다.
    if (!G || p?.type !== 'market' || p.m?.options !== options || options[i] !== o) return false;
    if (o.kind === 'renew' && !canAcceptRenewal(G, o)) return false;
    const r = acceptOption(G, o, options);
    const logEntry: EventLogEntry = {
      k: isMilOption(o) ? 'mil' : 'mkt',
      id: o.kind,
      c: o.kind === 'offer' ? o.clubId : i,
      h: G.phase,
    };
    if (r?.ok !== undefined) logEntry.ok = r.ok;
    pushEvLog(G, logEntry);
    if (r) {
      G.training = 'rest';
      if (r.reopen) {
        G.pending = { type: 'market', res: null, m: market(G) };
        host.save();
        host.analytics.play(G);
        sheet.showSheet({ kind: 'notice', eyebrow: L.milEyebrow, text: r.text }, [
          { label: L.toMarket, cls: 'btn-primary', fn: nextPending },
        ]);
        return false;
      }
      G.pending = null;
      host.save();
      host.analytics.play(G);
      appState.tab = 'season';
      sheet.showSheet(
        {
          kind: 'notice',
          eyebrow: L.milEyebrow,
          big: {
            text: o.kind === 'serve' ? L.milServe : r.ok ? L.milPass : L.milDecided,
            ok: r.ok !== false,
          },
          text: r.text,
        },
        [
          {
            label: L.startSeasonBtn({ year: G.year }),
            cls: 'btn-primary',
            fn: backToSeason,
          },
        ],
        backToSeason,
      );
      return false;
    }
    G.pending = null;
    G.training = 'rest';
    host.save();
    host.analytics.play(G);
    return true;
  }

  function startSeason() {
    backToSeason();
    host.toast(L.startSeasonToast({ year: appState.G!.year }));
  }

  /** T-11-090 이벤트·이적시장 시트를 닫고 시즌 탭 맨 위로 돌아간다(훈련을 마친 뒤와 같다). */
  function backToSeason() {
    sheet.closeSheet();
    appState.tab = 'season';
    host.scrollTop(true);
  }

  function doRetire() {
    if (!appState.G || appState.G.retired || appState.G.age < MIN_RETIRE_AGE) return;
    appState.lastRetired = retire(appState.G!, publicNameOf(appState.G!.name) !== null);
    host.uploadRetirement(appState.G!.cid, appState.lastRetired);
    appState.G!.pending = null;
    host.save();
    sheet.closeSheet();
    appState.screen = 'retired';
    host.trackPage('retired');
    host.analytics.retire(appState.G!);
    host.scrollTop(false);
  }

  function confirmNew() {
    sheet.showSheet(
      {
        kind: 'notice',
        eyebrow: 'New Life',
        title: L.newTitle,
        muted: true,
        text: L.newText({ name: appState.G!.name }),
      },
      [
        {
          label: L.newBtn,
          cls: 'btn-primary',
          fn: () => {
            host.analytics.replace();
            appState.G = null;
            host.save();
            sheet.closeSheet();
            appState.screen = 'create';
            appState.C.name = randomName();
            appState.C.number = randomNumber();
          },
        },
        { label: L.cancel, fn: sheet.closeSheet },
      ],
    );
  }

  /** 은퇴 확인. onCancel: '조금 더 뛴다'를 누르면 할 일(기본은 닫기, 이적 시장에선 시장으로 돌아간다). */
  function retireAsk(onCancel: () => void = sheet.closeSheet) {
    if (!appState.G || appState.G.age < MIN_RETIRE_AGE) {
      host.toast(L.retireAgeLimit({ age: MIN_RETIRE_AGE }));
      return;
    }
    // T-10-032: 짧은 커리어는 전체 명예의 전당에 오르지 않는다 — 은퇴 전에 미리 알린다.
    const text = isHofEligible(appState.G!.age)
      ? L.retireTextHof
      : L.retireTextShort({ note: SHORT_CAREER_NOTE });
    sheet.showSheet(
      { kind: 'notice', eyebrow: 'Retirement', title: L.retireTitle, muted: true, text },
      [
        { label: L.retireYes, cls: 'btn-primary', fn: doRetire },
        { label: L.retireStay, fn: onCancel },
      ],
    );
  }

  function startCareer(
    name: string,
    number: number,
    presetAttrs?: Record<AttrKey, number>,
    presetPotential?: CandidatePotential,
  ) {
    const previous = appState.G;
    const finalName = name.trim() || randomName();
    const finalNumber = clamp(+number || randomNumber(), 1, 99);
    const seed = freshSeed();
    setActiveRng(createRng(seed));
    appState.G = newGame(
      {
        ...appState.C,
        ...draftCareerRules(appState.C),
        body: draftBody(appState.C),
        name: finalName,
        number: finalNumber,
      },
      seed,
      presetAttrs,
      presetPotential,
    );
    host.save();
    appState.screen = 'game';
    host.trackPage('game');
    host.analytics.start(appState.G!, previous);
    appState.tab = 'season';
    appState.candidates = null;
    appState.report = null;
    host.scrollTop(false);
    host.toast(L.careerStartToast);
  }

  function rollCandidates() {
    applyLatestBalance();
    appState.candidatePotentialOpen = loadKey<number>(SCOUT_REVEAL) === scoutSeed();
    appState.candidates = generateCandidates(
      appState.C.pos,
      appState.C.focus,
      draftCareerRules(appState.C).dpos,
      scoutSeed(),
    );
    appState.candidatesOpen = [false, false, false];
    appState.candidatePick = null;
  }

  function revealCandidatePotential(batch = appState.candidates): boolean {
    if (!batch || batch !== appState.candidates) return false;
    if (!saveKey(SCOUT_REVEAL, scoutSeed())) return false;
    appState.candidatePotentialOpen = true;
    appState.candidatesOpen = batch.map(() => true);
    return true;
  }

  return {
    revealCandidatePotential,
    advance,
    nextPending,
    chooseEvent,
    pickOption,
    doRetire,
    confirmNew,
    retireAsk,
    startCareer,
    rollCandidates,
  };
}
