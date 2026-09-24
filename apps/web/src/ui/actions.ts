// ───────── 게임 진행 액션 (ui.ts 583~863줄 포트) ─────────
import { PHASES, LAST_PHASE, type AttrKey } from '../game/data.js';
import { esc } from '../game/dom.js';
import { clamp, createRng, freshSeed, setActiveRng } from '../game/rng.js';
import { generateCandidates } from '../game/candidates.js';
import {
  leagueOf, fmtMoney, snapshot, diffChips, log, newGame, isPro,
  applyTraining, simBlock, isSafe, rollEvent, resolveChoice, txt, roleOf, STORIES,
} from '../game/engine.js';
import { EVENTS } from '../game/events-data.js';
import { natWindow, scoreLine, type IntlResult } from '../game/national.js';
import { compsPhase } from '../game/comps.js';
import { endSeason, market, acceptOption, retire } from '../game/season.js';
import { pickFanLines } from '../game/fanfeed.js';
import { chLabel } from '../game/records.js';
import type { NatTour, EventLogEntry, MarketOption } from '../game/types.js';
import { appState, randomName } from './state.svelte.js';
import { pushEvLog, save, seasonLabel, toast, uploadSeason, uploadRetirement } from './helpers.js';
import { seasonLabelOf } from './format.js';
import {
  busyAnim, chipsHtml, closeSheet, getSheetEl, playBlock, playJudge, playSteps, showSheet,
  type BlockResultLike, type Chip, type SheetButton,
} from './sheetState.svelte.js';

export async function advance() {
  if (busyAnim || !appState.G) return;
  const s = appState.G,
    ph = s.phase;
  const before = snapshot(s);
  applyTraining(s);
  const block = s.phase > 0 ? (simBlock(s) as unknown as BlockResultLike) : null;
  const comp = compsPhase(s);
  comp.forEach((c) => log(s, c.t, c.k));
  const nt = natWindow(s);
  const chips = diffChips(s, before, snapshot(s));
  const ev = rollEvent(s);
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
  if (b) await playBlock(s, ph, b, extras);
  else await playSteps(`${s.year} · 프리시즌 진행 중`, [isPro(s) ? '전지훈련 캠프 입소' : '동계 훈련 시작', '체력 테스트', '전술 훈련', '연습 경기', ...extras]);
  showSheet(
    `<div class="eyebrow">${s.year} · ${title}</div>
    ${
      b
        ? `<div class="row" style="align-items:baseline;gap:14px"><span class="result-big">${b.w}<span class="muted" style="font-size:20px">승</span> ${b.d}<span class="muted" style="font-size:20px">무</span> ${b.l}<span class="muted" style="font-size:20px">패</span></span></div>
      <p>${b.apps}경기 출전 · <b>${b.goals}골 ${b.assists}도움</b>${b.apps ? ` · 평균 평점 <b>${(b.rs / b.apps).toFixed(2)}</b>` : ''}${b.cs ? ` · 무실점 ${b.cs}` : ''}</p>
      ${b.hl.map((h) => `<p class="hl">${esc(h)}</p>`).join('')}`
        : `<h2>시즌 준비를 마쳤습니다</h2><p class="muted">예상 역할: ${roleOf(s)}</p>`
    }
    ${comp.length ? `<div><div class="eyebrow" style="margin-bottom:6px">컵 · 대륙 대회</div>${comp.map((c) => `<p class="${c.k === 'good' ? 'hl' : 'muted'}">${esc(c.t)}</p>`).join('')}</div>` : ''}
    ${ntHtml(nt)}
    <div><div class="eyebrow" style="margin-bottom:6px">변화</div>${chipsHtml(chips, true) || '<p class="muted">큰 변화 없음</p>'}</div>`,
    [{ label: '계속 →', cls: 'btn-primary', fn: nextPending }],
  );
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
    if (busyAnim) return;
    const res = endSeason(s);
    uploadSeason(s, res.rec);
    s.pending = { type: 'market', res, m: null };
    save();
    const steps = ['리그 최종 순위 확정', ...((res.tours ?? []).length ? ['국제 대회 결과 반영'] : []), '시즌 시상식', '커리어 기록 정리'];
    void playSteps(`${res.rec.year} · 시즌 결산 중`, steps, 420).then(nextPending);
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
  const tag = ev.story ? `<div class="story-tag">스토리 · ${STORY_NAME(ev.story)} <b>${ev.stage}/${STORY_TOTAL(ev.story)}</b></div>` : '';
  showSheet(
    `${tag}<div class="eyebrow">Event · ${s.year} ${PHASES[Math.max(0, s.phase - 1)]}</div><h2>${ev.title}</h2><p>${esc(ev.text(s))}</p>
    <div class="stack">${ev.choices
      .map(
        (c, i) =>
          `<button class="choice" data-choice="${i}"><span>${esc(txt(c.label, s))}</span>${c.p ? `<span class="odds">${Math.round(c.p(s) * 100)}%</span>` : isSafe(ev, c) ? '<span class="odds" title="확정이지만 보상이 줄고 가끔 대가가 따릅니다">안전</span>' : '<span class="odds">확정</span>'}</button>`,
      )
      .join('')}</div>`,
    [],
  );
}

// 이벤트 선택지(data-choice)는 시트가 열려 있는 동안 내용만 {@html}로 교체되고 DOM 컨테이너
// 자체는 계속 같은 노드이므로(ui.ts처럼 매번 innerHTML을 통째로 갈아끼우는 것과 달리), 호출마다
// 리스너를 새로 붙이면 쌓인다. 앱 생명주기 동안 단 하나만 붙는 위임 리스너로 처리한다(원본의
// document 전역 클릭 위임과 동일한 패턴).
if (typeof document !== 'undefined') {
  document.addEventListener('click', (e) => {
    const t = (e.target as HTMLElement).closest<HTMLButtonElement>('button[data-choice]');
    if (!t) return;
    void chooseEvent(+t.dataset.choice!);
  });
}

function STORY_NAME(k: string): string {
  return STORIES[k]!.name;
}
function STORY_TOTAL(k: string): number {
  return STORIES[k]!.total;
}

async function chooseEvent(i: number) {
  if (busyAnim || !appState.G) return;
  const s = appState.G,
    p = s.pending as { type: 'event'; id: string; then?: string | null };
  const c = EVENTS.find((e) => e.id === p.id)!.choices[i]!,
    label = txt(c.label, s);
  const r = resolveChoice(s, p.id, i);
  pushEvLog(s, { k: 'ev', id: p.id, c: i, ok: r.ok, h: s.phase });
  s.pending = p.then === 'seasonEnd' ? { type: 'seasonEnd' } : null;
  save();
  if (r.p < 1) await playJudge(label, r.p, r.roll);
  showSheet(
    `<div class="eyebrow">결과 · ${esc(label)}</div><div class="result-big pop ${r.ok ? 'ok' : 'ng'}">${r.p < 1 ? (r.ok ? '성공' : '실패') : '결정'}</div>
    <p>${esc(r.text)}</p>${chipsHtml(r.chips as Chip[], true)}${r.twist ? `<p class="twist">${esc(r.twist)}</p>` : ''}${storyNote(r.story)}`,
    [{ label: '확인', cls: 'btn-primary', fn: nextPending }],
  );
}
function storyNote(st: { name: string; ending: string | null; started: boolean } | null): string {
  if (!st) return '';
  if (st.ending) return `<div class="story-end"><span class="eyebrow">스토리 완결 · ${st.name}</span><b>${esc(st.ending)}</b></div>`;
  return `<div class="story-next">${st.started ? `새 스토리 시작: <b>${st.name}</b> — ` : ''}이 이야기는 다음에 이어집니다…</div>`;
}

function ntHtml(nt: unknown): string {
  if (!nt) return '';
  if (Array.isArray(nt)) return nt.map(ntHtml).join('');
  const x = nt as { called: boolean; name: string; comp: string; games: IntlResult[] };
  if (!x.called) return `<div><div class="eyebrow" style="margin-bottom:6px">${x.name}</div><p class="muted">이번 A매치 명단에서 제외됐습니다.</p></div>`;
  return `<div><div class="eyebrow" style="margin-bottom:6px">${x.name} · ${esc(x.comp)}</div>
    ${x.games.map((m) => `<p class="${m.res === 'W' ? 'hl' : ''}">${esc(scoreLine(m))} <span class="muted">· ${m.mins ? `${m.mins}분${m.g ? ` ${m.g}골` : ''}${m.a ? ` ${m.a}도움` : ''} · 평점 ${m.rating}` : '벤치'}</span></p>`).join('')}</div>`;
}
function tourHtml(x: NatTour): string {
  const matches = (x.matches || []) as IntlResult[];
  const ms = matches
    .map(
      (m) =>
        `<div class="muted" style="font-size:12px">${(m as unknown as { stage?: string }).stage || '조별리그'} · ${esc(scoreLine(m))}${m.mins ? ` · ${m.g ? m.g + '골 ' : ''}${m.a ? m.a + '도움 ' : ''}평점 ${m.rating}` : ''}</div>`,
    )
    .join('');
  return `<div class="stack" style="gap:2px"><p><b>${esc(x.name)}</b> — ${x.stage}${x.inSquad ? '' : x.why ? ` <span class="muted">(${x.why})</span>` : matches.length ? ' <span class="muted">(명단 외)</span>' : ''}</p>${x.inSquad ? ms : ''}</div>`;
}

function showSeasonEnd(p: { res: ReturnType<typeof endSeason> }) {
  const { rec, trophies, awards, notes, gala = [], tours = [], miles = [] } = p.res;
  const s = appState.G!;
  const cols = s.pos === 'GK' || s.pos === 'DF' ? `${rec.cs} 무실점` : `${rec.assists} 도움`;
  const idx = s.career.indexOf(rec);
  const prev = idx > 0 ? s.career[idx - 1] : null;
  const fanLines = pickFanLines(s, rec, {
    gotTrophy: trophies.length > 0,
    injuredThisSeason: s.log.some((l) => l.t.startsWith(String(rec.year)) && l.text.includes('부상')),
    transferredThisSeason: !!prev && prev.club !== rec.club,
    hasMilestone: miles.length > 0,
  });
  const chBadges = (rec.ch || []).map((k) => `<span class="badge-ch">CH · ${esc(chLabel(k))}</span>`).join(' ');
  showSheet(
    `<div class="eyebrow">${seasonLabelOf(rec)} Season Review</div><h2>${esc(rec.club)} · ${rec.league} ${rec.rank}위</h2>
    ${chBadges ? `<div class="row" style="gap:4px">${chBadges}</div>` : ''}
    <div class="stats" style="grid-template-columns:repeat(4,1fr)"><div><b>${rec.apps}</b><span>출전</span></div><div><b>${rec.goals}</b><span>골</span></div><div><b>${cols.split(' ')[0]}</b><span>${cols.split(' ')[1]}</span></div><div><b>${rec.rating ? rec.rating.toFixed(2) : '-'}</b><span>평점</span></div></div>
    ${trophies.length || awards.length ? `<div class="stack">${[...trophies, ...awards].map((t) => `<p class="hl"><b>${t}</b></p>`).join('')}</div>` : '<p class="muted">이번 시즌 수상은 없었습니다.</p>'}
    ${(rec.comps || []).length ? `<div><div class="eyebrow" style="margin-bottom:6px">대회별 성적</div>${(rec.comps || []).map((c) => `<p class="muted">${esc(c.name)} · ${c.stage} · ${c.apps}경기 ${c.g}골 ${c.a}도움</p>`).join('')}</div>` : ''}
    ${tours.length ? `<div><div class="eyebrow" style="margin-bottom:6px">국가대표 · 국제대회</div>${tours.map(tourHtml).join('')}</div>` : ''}
    ${gala.length ? `<div><div class="eyebrow" style="margin-bottom:6px">Ballon d'Or 시상식</div>${gala.map((g) => `<p class="hl"><b>${g}</b></p>`).join('')}</div>` : ''}
    ${miles.length ? `<div><div class="eyebrow" style="margin-bottom:6px">커리어 여정</div>${miles.map((m) => `<p>· ${esc(m)}</p>`).join('')}</div>` : ''}
    ${notes.length ? `<p class="muted">${notes.join(' · ')}</p>` : ''}
    <div><div class="eyebrow" style="margin-bottom:6px">팬 반응</div><div class="fan-feed">${fanLines.map((f) => `<div class="fan-line"><b>팬</b>${esc(f)}</div>`).join('')}</div></div>
    <p class="muted">나이 ${appState.G!.age}세가 되었습니다. 이제 다음 시즌을 준비합니다.</p>`,
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
  const opts = m.options;
  let html = `<div class="eyebrow">${seasonLabel(appState.G!)} Transfer Window</div><h2>다음 시즌, 어디서 뛸까요?</h2><p class="muted">${esc(m.note)}</p><div class="stack">`;
  const contractCard = (i: number, name: string, lg: string, salary: number, sub: string) =>
    `<button class="offer" data-opt="${i}"><div><b>${esc(name)}</b><div class="lg">${lg}</div></div>
        <div class="sal">${fmtMoney(salary)}<div class="lg" style="text-align:right">연봉</div></div>
        <div class="sub">${sub}</div></button>`;
  html += opts
    .map((o, i) => {
      if (o.kind === 'offer') {
        const extra = `${o.role ? ` · ${o.role}` : ''}${o.fee ? ` · 이적료 약 ${fmtMoney(o.fee)}` : appState.G!.contract && !leagueOf(appState.G!.leagueId).amateur ? ' · 자유계약(FA)' : ''}`;
        return contractCard(i, o.name, `${leagueOf(o.leagueId).name} · 팀 전력 ${o.str}`, o.salary, `${o.years}년 계약${extra}`);
      }
      if (o.kind === 'renew') return contractCard(i, o.name, leagueOf(appState.G!.leagueId).name, o.salary, `${o.years}년 계약`);
      return `<button class="offer" data-opt="${i}"><div><b>${esc(o.name)}</b><div class="lg">${esc(o.desc ?? '')}</div></div></button>`;
    })
    .join('');
  html += `</div>`;
  const btns: SheetButton[] = m.canRetire ? [{ label: '은퇴를 선언한다', fn: () => doRetire() }] : [];
  showSheet(html, btns);
  queueMicrotask(() => {
    const el = getSheetEl();
    el?.querySelectorAll<HTMLButtonElement>('[data-opt]').forEach((b) =>
      b.addEventListener('click', () => {
        const o = opts[+b.dataset.opt!]!;
        const r = acceptOption(appState.G!, o);
        const logEntry: EventLogEntry = {
          k: o.kind === 'sangmu' || o.kind === 'army' || o.kind === 'serve' ? 'mil' : 'mkt',
          id: o.kind,
          c: o.kind === 'offer' ? o.clubId : +b.dataset.opt!,
          h: appState.G!.phase,
        };
        if (r?.ok !== undefined) logEntry.ok = r.ok;
        pushEvLog(appState.G!, logEntry);
        if (r) {
          appState.G!.training = 'rest';
          if (r.reopen) {
            appState.G!.pending = { type: 'market', res: null, m: market(appState.G!) };
            save();
            return showSheet(`<div class="eyebrow">병역</div><p>${esc(r.text)}</p>`, [{ label: '이적 시장으로 →', cls: 'btn-primary', fn: nextPending }]);
          }
          appState.G!.pending = null;
          save();
          appState.tab = 'season';
          return showSheet(
            `<div class="eyebrow">병역</div><div class="result-big ${r.ok === false ? 'ng' : 'ok'}">${o.kind === 'serve' ? '복무' : r.ok ? '합격' : '결정'}</div><p>${esc(r.text)}</p>`,
            [{ label: `${appState.G!.year} 시즌 시작 →`, cls: 'btn-primary', fn: () => closeSheet() }],
          );
        }
        appState.G!.pending = null;
        appState.G!.training = 'rest';
        save();
        closeSheet();
        appState.tab = 'season';
        toast(`${appState.G!.year} 시즌 시작!`);
      }),
    );
  });
}

export function doRetire() {
  appState.lastRetired = retire(appState.G!);
  uploadRetirement(appState.G!, appState.lastRetired);
  appState.G!.pending = null;
  save();
  closeSheet();
  appState.screen = 'retired';
  window.scrollTo(0, 0);
}

export function confirmNew() {
  showSheet(
    `<div class="eyebrow">New Life</div><h2>새로 시작하시겠습니까?</h2><p class="muted">진행 중인 ${esc(appState.G!.name)} 선수의 커리어는 사라집니다. 명예의 전당에는 은퇴한 선수만 남습니다.</p>`,
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

export function retireAsk() {
  showSheet(`<div class="eyebrow">Retirement</div><h2>정말 은퇴하시겠어요?</h2><p class="muted">은퇴하면 이 선수의 커리어는 명예의 전당에 기록되고 더 이상 플레이할 수 없습니다.</p>`, [
    { label: '은퇴한다', cls: 'btn-primary', fn: doRetire },
    { label: '조금 더 뛴다', fn: closeSheet },
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
  window.scrollTo(0, 0);
  toast('고교 마지막 시즌이 시작됩니다');
}

// ───────── 후보 선수 카드 (T-10-002) ─────────
export function rollCandidates() {
  appState.candidates = generateCandidates(appState.C.pos, appState.C.type);
  appState.candidatesOpen = [false, false, false];
  appState.candidatePick = null;
}

// ───────── 구글 OAuth 콜백 (/settings?google=linked|switched|error) ─────────
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
}
