// ───────── 게임 진행 액션 ─────────
// 게임 로직을 호출하고, 그 결과를 시트 뷰 모델(sheets/types.ts)로 바꿔 showSheet에 넘긴다.
// 게임 로직 호출 순서(=RNG 소비 순서)는 포팅 전 ui.ts와 동일하게 유지한다.
import type { BoardKey } from '@offside/contracts/board-limits';
import { isHofEligible, SHORT_CAREER_NOTE } from '@offside/contracts/hof-rules';
import { getProfile, googleStartUrl } from '../api/client.js';
import { PHASES, LAST_PHASE, type AttrKey } from '../game/data.js';
import { clamp, createRng, freshSeed, setActiveRng } from '../game/rng.js';
import { generateCandidates } from '../game/candidates.js';
import {
  leagueOf, fmtMoney, snapshot, diffChips, log, newGame, isPro,
  applyTraining, simBlock, isSafe, rollEvent, resolveChoice, txt, roleOf, STORIES, teamRank, roundRange,
} from '../game/engine.js';
import { EVENTS } from '../game/events-data.js';
import { choiceOdds } from '../game/balance.js';
import { isHiddenEvent } from '../game/dexGroups.js';
import { markDexSeen } from './dex.js';
import { natWindow, scoreLine, type IntlResult } from '../game/national.js';
import { compsPhase } from '../game/comps.js';
import { endSeason, market, acceptOption, retire, loadHOF } from '../game/season.js';
import { pickFanLines } from '../game/fanfeed.js';
import { chLabel } from '../game/records.js';
import { checkTitles, titleView } from '../game/titles.js';
import type { NatTour, EventLogEntry, MarketOption } from '../game/types.js';
import { appState, randomName, type HofTab } from './state.svelte.js';
import { pushEvLog, save, seasonLabel, toast, uploadSeason, uploadRetirement } from './helpers.js';
import { seasonLabelOf } from './format.js';
import { motionOK } from './motion.js';
import { openLocalLegend, shareFocus } from './legend.js';
import {
  closeSheet, matchRows, playBlock, playJudge, playSteps, sheetState, showSheet,
  type BlockResultLike, type Chip,
} from './sheetState.svelte.js';
import type { NatView, TourView } from './sheets/types.js';

// T-10-024: 구간 진행 시트(T-10-028부터 경기는 중계 시트)를 닫은 뒤, 결과를 시즌 탭 맨 위 리포트 카드로
// 그린다. 이벤트·시즌 결산은 액션바 버튼으로 이어서 연다(nextPending).
export async function advance() {
  if (sheetState.busy || !appState.G) return;
  const s = appState.G,
    ph = s.phase;
  const before = snapshot(s);
  const rankBefore = teamRank(s);
  applyTraining(s);
  const block = s.phase > 0 ? (simBlock(s) as unknown as BlockResultLike) : null;
  const comp = compsPhase(s);
  comp.forEach((c) => log(s, c.t, c.k));
  const nt = natWindow(s);
  const chips = diffChips(s, before, snapshot(s));
  const ev = rollEvent(s);
  // 칭호 판정은 이벤트 추첨 뒤에 한다 — 칭호 인기 보상이 이벤트 조건(인기 N 이상)을 바꿔 RNG 흐름이 달라지지 않게.
  const titles = checkTitles(s).map(titleView);
  const title = s.phase === 0 ? '프리시즌 완료' : `${PHASES[s.phase]} 결과`;
  if (block) log(s, `${PHASES[s.phase]} ${block.n}경기 ${block.w}승 ${block.d}무 ${block.l}패 · 출전 ${block.apps} · ${block.goals}골 ${block.assists}도움`);
  if (block) block.hl.forEach((h) => log(s, h, 'good'));
  s.phase++;
  s.pending = ev ? { type: 'event', id: ev, then: s.phase > LAST_PHASE ? 'seasonEnd' : null } : s.phase > LAST_PHASE ? { type: 'seasonEnd' } : null;
  save();
  const b = block;
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
    await playBlock(
      { eyebrow: `${s.year} · ${PHASES[ph]} 진행 중`, title: `${range} · ${b.n}경기`, back, matches: leagueOf(s.leagueId).matches },
      b,
      games,
      extras,
    );
  }
  else await playSteps(`${s.year} · 프리시즌 진행 중`, [isPro(s) ? '전지훈련 캠프 입소' : '동계 훈련 시작', '체력 테스트', '전술 훈련', '연습 경기', ...extras]);
  closeSheet();
  appState.report = {
    key: Date.now(),
    year: s.year,
    eyebrow: `${s.year} · ${title}`,
    title: b ? `${range} · ${b.n}경기` : '시즌 준비를 마쳤습니다',
    back,
    block: b
      ? { w: b.w, d: b.d, l: b.l, apps: b.apps, goals: b.goals, assists: b.assists, rating: b.apps ? (b.rs / b.apps).toFixed(2) : null, cs: b.cs, hl: b.hl }
      : null,
    games,
    rank: { before: rankBefore, after: teamRank(s) },
    role: roleOf(s),
    comps: comp.map((c) => ({ t: c.t, good: c.k === 'good' })),
    nat: natViews(nt),
    chips: chips as Chip[],
    titles,
  };
  appState.tab = 'season';
  window.scrollTo({ top: 0, behavior: motionOK ? 'smooth' : 'auto' });
}

export function nextPending() {
  const s = appState.G;
  if (!s) return;
  const p = s.pending;
  if (!p) {
    closeSheet();
    return;
  }
  if (p.type === 'event') return showEvent(p as { type: 'event'; id: string });
  if (p.type === 'seasonEnd') {
    if (sheetState.busy) return;
    appState.report = null;
    const res = endSeason(s);
    uploadSeason(s, res.rec);
    s.pending = { type: 'market', res, m: null };
    save();
    const steps = ['리그 최종 순위 확정', ...((res.tours ?? []).length ? ['국제 대회 결과 반영'] : []), '시즌 시상식', '커리어 기록 정리'];
    void playSteps(`${res.rec.year} · 시즌 결산 중`, steps, 560).then(nextPending);
    return;
  }
  if (p.type === 'market') {
    if (p.res) return showSeasonEnd(p as { res: ReturnType<typeof endSeason> });
    if (!p.m) {
      p.m = market(s);
      save();
    }
    return showMarket(p.m as ReturnType<typeof market>);
  }
}

function showEvent(p: { type: 'event'; id: string }) {
  const s = appState.G!;
  const ev = EVENTS.find((e) => e.id === p.id)!;
  showSheet({
    kind: 'event',
    eyebrow: `Event · ${s.year} ${PHASES[Math.max(0, s.phase - 1)]}`,
    title: ev.title,
    text: ev.text(s),
    story: ev.story ? { name: STORIES[ev.story]!.name, stage: ev.stage ?? 0, total: STORIES[ev.story]!.total } : null,
    choices: ev.choices.map((c, i) =>
      c.p
        ? { label: txt(c.label, s), odds: `${Math.round(choiceOdds(c.p(s), ev.id, i) * 100)}%` }
        : isSafe(ev, c)
          ? { label: txt(c.label, s), odds: '안전', hint: '확정이지만 보상이 줄고 가끔 대가가 따릅니다' }
          : { label: txt(c.label, s), odds: '확정' },
    ),
  });
}

export async function chooseEvent(i: number) {
  if (sheetState.busy || !appState.G) return;
  const s = appState.G,
    p = s.pending as { type: 'event'; id: string; then?: string | null };
  const ev = EVENTS.find((e) => e.id === p.id)!,
    c = ev.choices[i]!,
    label = txt(c.label, s);
  const r = resolveChoice(s, p.id, i);
  // T-10-012: 처음 겪은 스토리·특별 이벤트는 도감에서 열린다 — 결과 시트 안에서 알린다(토스트는 확인 버튼을 가린다).
  const dexNew = markDexSeen(p.id) && isHiddenEvent(ev) ? ev.title : null;
  pushEvLog(s, { k: 'ev', id: p.id, c: i, ok: r.ok, h: s.phase });
  s.pending = p.then === 'seasonEnd' ? { type: 'seasonEnd' } : null;
  save();
  if (r.p < 1) await playJudge(label, r.p, r.roll);
  showSheet(
    {
      kind: 'eventResult',
      label,
      outcome: r.p < 1 ? (r.ok ? '성공' : '실패') : '결정',
      ok: r.ok,
      text: r.text,
      chips: r.chips as Chip[],
      twist: r.twist || null,
      story: r.story,
      dexNew,
    },
    [{ label: '확인', cls: 'btn-primary', fn: nextPending }],
  );
}

function natViews(nt: unknown): NatView[] {
  if (!nt) return [];
  if (Array.isArray(nt)) return nt.flatMap(natViews);
  const x = nt as { called: boolean; name: string; comp: string; games: IntlResult[] };
  return [
    {
      name: x.name,
      comp: x.comp,
      called: x.called,
      games: x.called
        ? x.games.map((m) => ({
            line: scoreLine(m),
            hl: m.res === 'W',
            detail: m.mins ? `${m.mins}분${m.g ? ` ${m.g}골` : ''}${m.a ? ` ${m.a}도움` : ''} · 평점 ${m.rating}` : '벤치',
          }))
        : [],
    },
  ];
}
function tourView(x: NatTour): TourView {
  const matches = (x.matches || []) as (IntlResult & { stage?: string })[];
  return {
    name: x.name,
    stage: x.stage,
    note: x.inSquad ? '' : x.why ? x.why : matches.length ? '명단 외' : '',
    lines: x.inSquad
      ? matches.map((m) => `${m.stage || '조별리그'} · ${scoreLine(m)}${m.mins ? ` · ${m.g ? m.g + '골 ' : ''}${m.a ? m.a + '도움 ' : ''}평점 ${m.rating}` : ''}`)
      : [],
  };
}

function showSeasonEnd(p: { res: ReturnType<typeof endSeason> }) {
  const { rec, trophies, awards, notes, gala = [], tours = [], miles = [], titles = [] } = p.res;
  const s = appState.G!;
  const [col, colLabel] = s.pos === 'GK' || s.pos === 'DF' ? [rec.cs, '무실점'] : [rec.assists, '도움'];
  const idx = s.career.indexOf(rec);
  const prev = idx > 0 ? s.career[idx - 1] : null;
  const fans = pickFanLines(s, rec, {
    gotTrophy: trophies.length > 0,
    injuredThisSeason: s.log.some((l) => l.t.startsWith(String(rec.year)) && l.text.includes('부상')),
    transferredThisSeason: !!prev && prev.club !== rec.club,
    hasMilestone: miles.length > 0,
  });
  showSheet(
    {
      kind: 'season',
      eyebrow: `${seasonLabelOf(rec)} Season Review`,
      title: `${rec.club} · ${rec.league} ${rec.rank}위`,
      ch: (rec.ch || []).map(chLabel),
      stats: { apps: rec.apps, goals: rec.goals, col: col ?? 0, colLabel, rating: rec.rating ? rec.rating.toFixed(2) : '-' },
      honors: [...trophies, ...awards],
      comps: (rec.comps || []).map((c) => `${c.name} · ${c.stage} · ${c.apps}경기 ${c.g}골 ${c.a}도움`),
      tours: tours.map(tourView),
      gala,
      miles,
      titles,
      notes,
      fans,
      age: s.age,
    },
    [
      {
        label: '이적 시장으로 →',
        cls: 'btn-primary',
        fn: () => {
          (appState.G!.pending as { res: unknown }).res = null;
          save();
          nextPending();
        },
      },
    ],
  );
}

function showMarket(m: { options: MarketOption[]; note: string; canRetire: boolean }) {
  const G = appState.G!;
  showSheet(
    {
      kind: 'market',
      eyebrow: `${seasonLabel(G)} Transfer Window`,
      note: m.note,
      options: m.options.map((o) => {
        if (o.kind === 'offer') {
          const extra = `${o.role ? ` · ${o.role}` : ''}${o.fee ? ` · 이적료 약 ${fmtMoney(o.fee)}` : G.contract && !leagueOf(G.leagueId).amateur ? ' · 자유계약(FA)' : ''}`;
          return { clubId: o.clubId, name: o.name, lg: `${leagueOf(o.leagueId).name} · 팀 전력 ${o.str}`, salary: fmtMoney(o.salary), sub: `${o.years}년 계약${extra}` };
        }
        if (o.kind === 'renew') return { clubId: G.club.id, name: o.name, lg: leagueOf(G.leagueId).name, salary: fmtMoney(o.salary), sub: `${o.years}년 계약` };
        return { name: o.name, lg: o.desc ?? '', salary: null, sub: null };
      }),
    },
    // T-10-029: 은퇴는 언제든 고를 수 있다. 은퇴할 때가 아니면(canRetire=false) 한 번 더 묻고, 취소하면 이 창으로 돌아온다.
    [{ label: '은퇴하기', fn: () => (m.canRetire ? doRetire() : retireAsk(nextPending)) }],
  );
}

export function pickOption(i: number) {
  // 이적시장 옵션은 G.pending.m에 이미 저장돼 있다(nextPending이 만든 그 목록).
  const o = (appState.G?.pending as { m?: { options: MarketOption[] } } | null)?.m?.options[i];
  if (!o || !appState.G) return;
  const r = acceptOption(appState.G, o);
  const logEntry: EventLogEntry = {
    k: o.kind === 'sangmu' || o.kind === 'army' || o.kind === 'serve' ? 'mil' : 'mkt',
    id: o.kind,
    c: o.kind === 'offer' ? o.clubId : i,
    h: appState.G.phase,
  };
  if (r?.ok !== undefined) logEntry.ok = r.ok;
  pushEvLog(appState.G, logEntry);
  if (r) {
    appState.G.training = 'rest';
    if (r.reopen) {
      appState.G.pending = { type: 'market', res: null, m: market(appState.G) };
      save();
      return showSheet({ kind: 'notice', eyebrow: '병역', text: r.text }, [{ label: '이적 시장으로 →', cls: 'btn-primary', fn: nextPending }]);
    }
    appState.G.pending = null;
    save();
    appState.tab = 'season';
    return showSheet(
      { kind: 'notice', eyebrow: '병역', big: { text: o.kind === 'serve' ? '복무' : r.ok ? '합격' : '결정', ok: r.ok !== false }, text: r.text },
      [{ label: `${appState.G.year} 시즌 시작 →`, cls: 'btn-primary', fn: () => closeSheet() }],
    );
  }
  appState.G.pending = null;
  appState.G.training = 'rest';
  save();
  closeSheet();
  appState.tab = 'season';
  toast(`${appState.G.year} 시즌 시작!`);
}

export function doRetire() {
  appState.lastRetired = retire(appState.G!);
  uploadRetirement(appState.G!.cid, appState.lastRetired);
  appState.G!.pending = null;
  save();
  closeSheet();
  appState.screen = 'retired';
  window.scrollTo(0, 0);
}

export function confirmNew() {
  showSheet(
    { kind: 'notice', eyebrow: 'New Life', title: '새로 시작하시겠습니까?', muted: true, text: `진행 중인 ${appState.G!.name} 선수의 커리어는 사라집니다. 명예의 전당에는 은퇴한 선수만 남습니다.` },
    [
      {
        label: '새 커리어 시작',
        cls: 'btn-primary',
        fn: () => {
          appState.G = null;
          save();
          closeSheet();
          appState.screen = 'create';
          appState.C.name = randomName();
        },
      },
      { label: '취소', fn: closeSheet },
    ],
  );
}

/** 은퇴 확인. onCancel: '조금 더 뛴다'를 누르면 할 일(기본은 닫기, 이적 시장에선 시장으로 돌아간다). */
export function retireAsk(onCancel: () => void = closeSheet) {
  // T-10-032: 짧은 커리어는 전체 명예의 전당에 오르지 않는다 — 은퇴 전에 미리 알린다.
  const text = isHofEligible(appState.G!.age)
    ? '은퇴하면 이 선수의 커리어는 명예의 전당에 기록되고 더 이상 플레이할 수 없습니다.'
    : `은퇴하면 더 이상 플레이할 수 없습니다. ${SHORT_CAREER_NOTE}`;
  showSheet({ kind: 'notice', eyebrow: 'Retirement', title: '정말 은퇴하시겠어요?', muted: true, text }, [
    { label: '은퇴한다', cls: 'btn-primary', fn: doRetire },
    { label: '조금 더 뛴다', fn: onCancel },
  ]);
}

// ───────── 화면 전환 액션 (ui.ts 799~825줄의 data-act 분기 포트) ─────────
export function goNew() {
  if (appState.G && !appState.G.retired) return confirmNew();
  appState.screen = 'create';
}
export function goContinue() {
  appState.screen = 'game';
  if (appState.G && appState.G.pending) nextPending();
}
export function goHome() {
  appState.screen = 'home';
  closeSheet();
}
export function goSettings() {
  appState.screen = 'settings';
  window.scrollTo(0, 0);
}
export function goDex() {
  appState.screen = 'dex';
  window.scrollTo(0, 0);
}
/** T-10-027 서버 최초 기록. */
export function goFirsts() {
  appState.screen = 'firsts';
  window.scrollTo(0, 0);
}
/** 명예의 전당 전체 보기(100명씩 페이지). */
export function openHof(tab: HofTab) {
  appState.hof = { tab, page: 1, sort: 'score' };
  appState.screen = 'hof';
  window.scrollTo(0, 0);
}
/** 소식 화면을 연다. postId가 있으면 그 글을 바로 연다(홈의 소식 섹션에서). */
export function openBoard(board: BoardKey, postId: string | null = null) {
  appState.board = board;
  appState.boardPost = postId;
  appState.screen = 'board';
  window.scrollTo(0, 0);
}
export function startCareer(name: string, number: number, presetAttrs?: Record<AttrKey, number>) {
  const finalName = name.trim() || randomName();
  const finalNumber = clamp(+number || 10, 1, 99);
  const seed = freshSeed();
  setActiveRng(createRng(seed));
  appState.G = newGame({ ...appState.C, name: finalName, number: finalNumber }, seed, presetAttrs);
  save();
  appState.screen = 'game';
  appState.tab = 'season';
  appState.candidates = null;
  appState.report = null;
  window.scrollTo(0, 0);
  toast('고교 마지막 시즌이 시작됩니다');
}

// ───────── 후보 선수 카드 (T-10-002) ─────────
export function rollCandidates() {
  appState.candidates = generateCandidates(appState.C.pos, appState.C.focus);
  appState.candidatesOpen = [false, false, false];
  appState.candidatePick = null;
}

// ───────── 구글 OAuth 콜백 (/settings?google=linked|switched|error) ─────────
/** 로그인을 마치고 돌아와 다시 열 곳. T-10-028 소식 글(댓글), T-10-029 내 은퇴 선수(공유). */
export type LoginReturn = { board: BoardKey; postId: string | null } | { career: string };
const LOGIN_RETURN_KEY = 'ft_board_return';
/** null이면 기록을 지운다(설정에서 로그인할 때). */
export function rememberLoginReturn(to: LoginReturn | null) {
  try {
    if (to) sessionStorage.setItem(LOGIN_RETURN_KEY, JSON.stringify(to));
    else sessionStorage.removeItem(LOGIN_RETURN_KEY);
  } catch {
    // 저장소를 못 쓰면 평소처럼 설정 화면으로 돌아온다.
  }
}
function takeLoginReturn(): LoginReturn | null {
  try {
    const raw = sessionStorage.getItem(LOGIN_RETURN_KEY);
    sessionStorage.removeItem(LOGIN_RETURN_KEY);
    return raw ? (JSON.parse(raw) as LoginReturn) : null;
  } catch {
    return null;
  }
}
/** 구글 로그인을 시작한다. 로그인은 프로필 세션이 있어야 시작된다 — 없으면 GET /v1/profile이 익명
 * 프로필을 만든다. */
export async function startGoogleLogin(back: LoginReturn | null) {
  rememberLoginReturn(back);
  await getProfile();
  window.location.assign(googleStartUrl());
}
export function handleOAuthReturn() {
  const url = new URL(window.location.href);
  const google = url.searchParams.get('google');
  if (!google) return;
  const reason = url.searchParams.get('reason');
  const msg =
    google === 'linked'
      ? '구글 계정을 연결했습니다.'
      : google === 'switched'
        ? '다른 구글 계정으로 전환했습니다.'
        : `구글 로그인에 실패했습니다${reason ? ` (${reason})` : ''}.`;
  toast(msg);
  window.history.replaceState({}, '', '/');
  const back = takeLoginReturn();
  if (back && google !== 'error') {
    if ('board' in back) return openBoard(back.board, back.postId);
    // 은퇴 화면에서 공유하려고 로그인했으면 그 선수의 상세(공유 카드가 있다)로 돌아온다.
    const h = loadHOF().find((x) => x.id === back.career);
    if (h) {
      shareFocus.pending = true;
      return openLocalLegend(h);
    }
  }
  // 계정 패널이 설정 화면에 있으므로, 로그인을 마치고 돌아오면 설정 화면을 연다.
  appState.screen = 'settings';
}
