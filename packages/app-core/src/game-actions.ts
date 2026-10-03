import { marketFeedback, offerFeedback } from './career-feedback.js';
// ───────── 게임 진행 액션 (웹·앱 공용, T-11-002) ─────────
// 게임 로직을 호출하고, 그 결과를 시트 뷰 모델(sheets.ts)로 바꿔 시트에 띄운다. 상태·시트·저장·업로드·분석은
// 클라이언트가 host로 넘긴다(웹은 Svelte `$state` 프록시, 앱은 자기 스토어 — 넘긴 객체를 그대로 고친다).
// 게임 로직 호출 순서(=RNG 소비 순서)는 포팅 전 ui.ts와 동일하게 유지한다.
import type { SeasonGrowth } from '@offside/contracts';
import { isHofEligible, SHORT_CAREER_NOTE } from '@offside/contracts/hof-rules';
import { PHASES, LAST_PHASE, type AttrKey } from '@offside/game/data';
import { clamp, createRng, freshSeed, setActiveRng } from '@offside/game/rng';
import { generateCandidates } from '@offside/game/candidates';
import {
  leagueOf,
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
import { choiceOdds } from '@offside/game/balance';
import { offsetToRoll, tapOffset, timingNote, zoneLabel, zoneWidth } from '@offside/game/minigame';
import { isHiddenEvent } from '@offside/game/dexGroups';
import { scoreLine, type NatTourResult } from '@offside/game/national';
import {
  endSeason,
  market,
  acceptOption,
  canAcceptRenewal,
  retire,
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
import { scoutHint } from './potential-view.js';
import { recordPhaseOvr, takeSeasonGrowth } from './growth.js';
import { publicNameOf } from './namePublic.js';
import { fmtValue, seasonLabelOf, waGwa, withRo } from './format.js';
import { crossesBorder, flightHours, hubOf } from './flight.js';

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
    name: x.name,
    comp: x.called ? x.comp : '',
    called: x.called,
    games: x.called
      ? x.games.map((m) => ({
          line: scoreLine(m),
          hl: m.res === 'W',
          detail: m.mins
            ? `${m.mins}분${m.g ? ` ${m.g}골` : ''}${m.a ? ` ${m.a}도움` : ''} · 평점 ${m.rating}`
            : '벤치',
        }))
      : [],
  }));
}
function tourView(x: NatTourResult): TourView {
  // 저장된 결산 시트(pending.res)에서 복원한 옛 세이브는 필드가 비어 있을 수 있다.
  const matches = x.matches ?? [];
  return {
    name: x.name,
    stage: x.stage,
    note: x.inSquad ? '' : x.why ? x.why : matches.length ? '명단 외' : '',
    lines: x.inSquad
      ? matches.map(
          (m) =>
            `${m.stage || '조별리그'} · ${scoreLine(m)}${m.mins ? ` · ${m.g ? m.g + '골 ' : ''}${m.a ? m.a + '도움 ' : ''}평점 ${m.rating}` : ''}`,
        )
      : [],
  };
}

// ───────── 후보 선수 카드 (T-10-002) ─────────
// T-10-112 스카우트 시드: 한 번 정하면 커리어가 고3 첫 시즌을 마칠 때까지 유지한다. 뒤로 가기·새로 고침·
// 시작 직후 포기로 다시 와도 같은 조건이면 같은 후보가 나온다(다시 뽑아 고르는 리세 방지).
const SCOUT_SEED = 'ft_scout_seed';
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
  async function advance() {
    if (sheet.state.busy || !appState.G) return;
    const s = appState.G,
      ph = s.phase;
    const before = snapshot(s);
    const rankBefore = teamRank(s);
    // T-10-046: 한 구간의 게임 로직(훈련 → 경기 → 대회 → A매치 → 이벤트 추첨 → 칭호)은 game/turn.ts가 진행한다.
    recordPhaseOvr(s); // T-11-048 구간에 들어갈 때의 OVR(성장 기록).
    const r = playPhase(s);
    const { block: b, comp, nt, ev } = r;
    const chips = diffChips(s, before, r.after);
    const titles = r.titles.map(titleView);
    const title = ph === 0 ? '프리시즌 완료' : `${PHASES[ph]} 결과`;
    s.pending = ev
      ? { type: 'event', id: ev, then: s.phase > LAST_PHASE ? 'seasonEnd' : null }
      : s.phase > LAST_PHASE
        ? { type: 'seasonEnd' }
        : null;
    host.save();
    host.analytics.play(s, ph === 0 && s.career.length === 0);
    const extras = [
      ...(comp.length ? ['컵 · 대륙 대회 결과 집계'] : []),
      ...(nt ? ['A매치 소집 명단 발표'] : []),
      ...(ev ? ['주변에서 무언가 일이 벌어지고 있습니다…'] : []),
    ];
    const games = b ? matchRows(s, b) : [];
    const range = b ? roundRange(s, ph) : '';
    const back = s.pos === 'DF' || s.pos === 'GK';
    // T-10-028: 경기는 중계 시트로 한 경기씩 보여 주고(승무패·스코어가 쌓이는 맛), 끝나면 리포트로 넘어간다.
    if (b) {
      await sheet.playBlock(
        {
          eyebrow: `${s.year} · ${PHASES[ph]} 진행 중`,
          title: `${range} · ${b.n}경기`,
          back,
          matches: leagueOf(s.leagueId).matches,
        },
        b,
        games,
        extras,
      );
    } else
      await sheet.playSteps(`${s.year} · 프리시즌 진행 중`, [
        isPro(s) ? '전지훈련 캠프 입소' : '동계 훈련 시작',
        '체력 테스트',
        '전술 훈련',
        '연습 경기',
        ...extras,
      ]);
    sheet.closeSheet();
    appState.report = {
      key: Date.now(),
      year: s.year,
      ph,
      eyebrow: `${s.year} · ${title}`,
      title: b ? `${range} · ${b.n}경기` : '시즌 준비를 마쳤습니다',
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
  }

  function nextPending() {
    const s = appState.G;
    if (!s) return;
    const p = s.pending;
    if (!p) {
      sheet.closeSheet();
      return;
    }
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
        '리그 최종 순위 확정',
        ...(res.tours.length ? ['국제 대회 결과 반영'] : []),
        '시즌 시상식',
        '커리어 기록 정리',
      ];
      void sheet.playSteps(`${res.rec.year} · 시즌 결산 중`, steps, 560).then(nextPending);
      return;
    }
    if (p.type === 'market') {
      if (p.res) return showSeasonEnd(p.res);
      if (!p.m) {
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
        ? { label, odds: '안전', hint: '확정이지만 보상이 줄고, 가끔 대가가 따라요' }
        : { label, odds: '확정' };
    const odds = choiceOdds(c.p(s), ev.id, i);
    const mg = activeMg(c);
    if (!mg) return { label, odds: `${Math.round(odds * 100)}%` };
    return {
      label,
      odds: `원터치 · ${zoneLabel(zoneWidth(odds, mg.kind))}`,
      hint: '바늘이 초록 구간에 올 때 탭하면 성공해요. 구간 넓이는 능력치로 정해져요',
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
        ? { name: STORIES[ev.story]!.name, stage: ev.stage ?? 0, total: STORIES[ev.story]!.total }
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
        outcome: r.p < 1 ? (r.ok ? '성공' : '실패') : '결정',
        ok: r.ok,
        text: r.text,
        chips: r.chips,
        twist: r.twist || null,
        story: r.story,
        dexNew: r.dexNew,
        timing: r.timing,
      },
      [{ label: '확인', cls: 'btn-primary', fn: nextPending }],
    );
  }

  function showSeasonEnd(res: SeasonEndResult) {
    // pending.res로 복원된 옛 세이브에는 뒤에 추가된 필드(titles 등)가 없을 수 있다.
    const { rec, trophies, awards, notes, gala = [], tours = [], miles = [], titles = [] } = res;
    const s = appState.G!;
    // T-10-112 고3 첫 시즌이 끝났다. 다음 커리어는 새 후보를 받는다.
    const firstScout = s.career.length === 1;
    if (firstScout) releaseScoutSeed();
    const [col, colLabel] =
      s.pos === 'GK' || s.pos === 'DF' ? [rec.cs, '무실점'] : [rec.assists, '도움'];
    // T-10-034: indexOf(rec)는 $state 프록시라 늘 -1이었다(이적 팬 반응이 안 나옴) — 연도로 찾는다.
    const idx = s.career.findIndex((r) => r.year === rec.year);
    const prev = idx > 0 ? s.career[idx - 1] : null;
    const fans = pickFanLines(s, rec, {
      gotTrophy: trophies.length > 0,
      injuredThisSeason: s.log.some(
        (l) => l.t.startsWith(String(rec.year)) && l.text.includes('부상'),
      ),
      transferredThisSeason: !!prev && prev.club !== rec.club,
      hasMilestone: miles.length > 0,
    });
    sheet.showSheet(
      {
        kind: 'season',
        eyebrow: `${seasonLabelOf(rec)} Season Review`,
        title: `${rec.club} · ${rec.league} ${rec.rank}위`,
        ch: (rec.ch || []).map(chLabel),
        stats: {
          apps: rec.apps,
          goals: rec.goals,
          col: col ?? 0,
          colLabel,
          rating: rec.rating ? rec.rating.toFixed(2) : '-',
        },
        honors: [...trophies, ...awards],
        comps: (rec.comps || []).map(
          (c) => `${c.name} · ${c.stage} · ${c.apps}경기 ${c.g}골 ${c.a}도움`,
        ),
        tours: tours.map(tourView),
        gala,
        miles,
        titles,
        notes,
        scoutHint: scoutHint(s, rec.year),
        fans,
        age: s.age,
      },
      [
        {
          label: '이적 시장으로 →',
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
    sheet.showSheet(
      {
        kind: 'market',
        assessment: marketFeedback(G, m),
        eyebrow: `${seasonLabel(G)} Transfer Window`,
        note: m.note,
        options: m.options.map((o) => {
          if (o.kind === 'offer') {
            const extra = `${o.role ? ` · ${o.role}` : ''}${o.fee ? ` · 이적료 약 ${fmtValue(o.fee)}` : G.contract && !leagueOf(G.leagueId).amateur ? ' · 자유계약(FA)' : ''}`;
            return {
              clubId: o.clubId,
              reason: offerFeedback(G, o),
              name: o.name,
              lg: `${leagueOf(o.leagueId).name} · 팀 전력 ${o.str}`,
              salary: fmtMoney(o.salary),
              sub: `${o.years}년 계약${extra}`,
            };
          }
          if (o.kind === 'renew')
            return {
              clubId: G.club.id,
              name: o.name,
              lg: leagueOf(G.leagueId).name,
              salary: fmtMoney(o.salary),
              sub: o.extension
                ? `1년 남음 · ${o.extension.years}년 연장 · 총 ${o.years}년. ${o.desc}`
                : `${o.years}년 계약${o.desc ? ` · ${o.desc}` : ''}`,
            };
          return { name: o.name, lg: o.desc ?? '', salary: null, sub: null };
        }),
      },
      // T-10-029: 은퇴는 언제든 고를 수 있다. 은퇴할 때가 아니면(canRetire=false) 한 번 더 묻고, 취소하면 이 창으로 돌아온다.
      [{ label: '은퇴하기', fn: () => (m.canRetire ? doRetire() : retireAsk(nextPending)) }],
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
        ? '연장 계약서에 사인할까요?'
        : rookie
          ? '프로 계약서에 사인하시겠습니까?'
          : '이적 계약서에 사인하시겠습니까?',
      text: extension
        ? '남은 계약에 기간을 더해요. 새 연봉은 이번 시즌부터 적용돼요.'
        : `${o.name}${waGwa(o.name)} 함께 ${rookie ? '첫 프로 시즌을' : '새 시즌을'} 시작합니다.`,
      club: {
        id: o.kind === 'offer' ? o.clubId : G.club.id,
        name: o.kind === 'offer' ? o.name : G.club.name,
      },
      terms: [
        { label: '연봉', value: fmtMoney(o.salary) },
        ...(extension
          ? [
              { label: '남은 계약', value: '1년' },
              { label: '추가 연장', value: `${extension.years}년` },
              { label: '총 계약 기간', value: `${o.years}년` },
            ]
          : [{ label: '계약 기간', value: `${o.years}년` }]),
        ...(o.kind === 'offer' && o.fee
          ? [{ label: '이적료', value: `약 ${fmtValue(o.fee)}` }]
          : []),
        ...(o.kind === 'offer' && o.role ? [{ label: '역할', value: o.role }] : []),
      ],
      name: G.name,
      cta: extension ? '사인하고 계약 연장' : rookie ? '사인하고 프로 입단' : '사인하고 이적',
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
          title: `${withRo(to.city)} 날아가는 중`,
          sub: `${to.country} · ${leagueOf(o.leagueId).name} · 약 ${flightHours(from, to)}시간 비행`,
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
      k: o.kind === 'sangmu' || o.kind === 'army' || o.kind === 'serve' ? 'mil' : 'mkt',
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
        sheet.showSheet({ kind: 'notice', eyebrow: '병역', text: r.text }, [
          { label: '이적 시장으로 →', cls: 'btn-primary', fn: nextPending },
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
          eyebrow: '병역',
          big: { text: o.kind === 'serve' ? '복무' : r.ok ? '합격' : '결정', ok: r.ok !== false },
          text: r.text,
        },
        [
          {
            label: `${G.year} 시즌 시작 →`,
            cls: 'btn-primary',
            fn: () => sheet.closeSheet(),
          },
        ],
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
    sheet.closeSheet();
    appState.tab = 'season';
    host.toast(`${appState.G!.year} 시즌 시작!`);
  }

  function doRetire() {
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
        title: '새로 시작하시겠습니까?',
        muted: true,
        text: `진행 중인 ${appState.G!.name} 선수의 커리어는 사라집니다. 명예의 전당에는 은퇴한 선수만 남습니다.`,
      },
      [
        {
          label: '새 커리어 시작',
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
        { label: '취소', fn: sheet.closeSheet },
      ],
    );
  }

  /** 은퇴 확인. onCancel: '조금 더 뛴다'를 누르면 할 일(기본은 닫기, 이적 시장에선 시장으로 돌아간다). */
  function retireAsk(onCancel: () => void = sheet.closeSheet) {
    // T-10-032: 짧은 커리어는 전체 명예의 전당에 오르지 않는다 — 은퇴 전에 미리 알린다.
    const text = isHofEligible(appState.G!.age)
      ? '은퇴하면 이 선수의 커리어는 명예의 전당에 기록되고, 더 이상 플레이할 수 없어요.'
      : `은퇴하면 더 이상 플레이할 수 없어요. ${SHORT_CAREER_NOTE}`;
    sheet.showSheet(
      { kind: 'notice', eyebrow: 'Retirement', title: '정말 은퇴하시겠어요?', muted: true, text },
      [
        { label: '은퇴한다', cls: 'btn-primary', fn: doRetire },
        { label: '조금 더 뛴다', fn: onCancel },
      ],
    );
  }

  function startCareer(name: string, number: number, presetAttrs?: Record<AttrKey, number>) {
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
    );
    host.save();
    appState.screen = 'game';
    host.trackPage('game');
    host.analytics.start(appState.G!, previous);
    appState.tab = 'season';
    appState.candidates = null;
    appState.report = null;
    host.scrollTop(false);
    host.toast('고교 마지막 시즌이 시작됩니다');
  }

  function rollCandidates() {
    appState.candidates = generateCandidates(
      appState.C.pos,
      appState.C.focus,
      draftCareerRules(appState.C).dpos,
      scoutSeed(),
    );
    appState.candidatesOpen = [false, false, false];
    appState.candidatePick = null;
  }

  return {
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
