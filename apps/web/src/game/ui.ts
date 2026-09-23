// ───────── 화면 (ui.js 포트) ─────────
// 원본 풀타임의 전역 스크립트를 명시적 모듈로 옮겼습니다. DOM 렌더링/이벤트 위임 로직은
// 동작을 그대로 유지하는 것이 목표라 원본과 최대한 1:1로 대응합니다.
import {
  POS, TYPES, TRAITS, LEAGUES, LAST_PHASE, PHASES, SURNAMES, GIVEN,
} from './data.js';
import type { Pos } from './data.js';
import {
  ovr, mainRole, ROLES, ROLE_NAME, POS_ROLES, ovrRole, faceOf, RADAR_ORDER, FACE_ABBR, GK_ABBR, SUBS,
} from './attributes.js';
import { clamp, ri, pick, createRng, freshSeed, setActiveRng, getActiveRng } from './rng.js';
import {
  leagueOf, clubsIn, labelOf, fmtMoney, potGrade, roleOf, snapshot, diffChips, log, newGame, isPro,
  TRAININGS, trainingLabel, trainingDesc, applyTraining, simBlock, blockMatches, roundRange, teamRank,
  STORIES, turnNo, isSafe, rollEvent, resolveChoice, txt,
} from './engine.js';
import { EVENTS } from './events-data.js';
import './events.js';
import './stories.js';
import './military.js';
import './realevents.js';
import './positional.js';
import { natInit, natWindow, nextWC, HOSTS, scoreLine, type IntlResult } from './national.js';
import { compsPhase } from './comps.js';
import { milStatusText } from './military.js';
import {
  endSeason, market, acceptOption, marketValue, retire, legendScore, legendTitle, saveKey, loadKey, loadHOF,
} from './season.js';
import { initSubs, legacyOvr } from './attributes.js';
import type { GameState, CareerRecord, NatTour, HofEntry, MarketOption } from './types.js';
import { esc } from './dom.js';

const $app = document.getElementById('app')!;
const $modal = document.getElementById('modal')!;
const $sheet = document.getElementById('sheet')!;

// ───────── 저장 로드 + 마이그레이션 ─────────
let G: GameState | null = loadKey<GameState>('ft_save') || loadKey<GameState>('sl_save');
if (G && G.v !== 1) G = null;
if (G) {
  // 구버전 저장에는 RNG 상태가 없습니다 — 새 시드로 이어서 플레이합니다.
  if (G.rng && typeof G.rng.seed === 'number') setActiveRng(createRng(G.rng.seed));
  else {
    const seed = freshSeed();
    setActiveRng(createRng(seed));
    G.rng = { seed };
  }
  natInit(G);
  // 세부 능력치 도입 이전 저장 데이터: 카드 능력치와 기존 OVR 을 기준으로 세부 능력치를 만듭니다
  if (!G.sub) {
    const a = { ...G.attrs };
    initSubs(G, a, legacyOvr(G.pos, a));
    G.seasonStart = { ...G.attrs };
  }
  if (!G.seasonStartSub) G.seasonStartSub = { ...G.sub };
  // 숨은 잠재력(bloom) 도입 전 저장: 스카우트 평가 = 실제 잠재력으로 시작
  if (G.bloom == null) G.bloom = 0;
  // 4구간 → 전반기/후반기 저장 데이터 변환
  if (!G.halves) {
    const tot = leagueOf(G.leagueId).matches;
    const S = G.season || ({ played: 0 } as GameState['season']);
    G.phase = G.phase >= 5 ? 3 : G.phase === 0 ? 0 : S.played < tot / 2 ? 1 : 2;
    (G.chains || []).forEach((c) => {
      c.at = Math.round((c.at * 3) / 5);
      c.until = Math.round((c.until * 3) / 5);
    });
    G.halves = 1;
  }
  // 구단 이름이 바뀌어도 기존 저장의 현재 소속은 최신 이름으로
  const gClubId = G.club.id;
  const c = clubsIn(G.leagueId).concat(clubsIn('hs')).find((x) => x.id === gClubId);
  if (c) G.club.name = c.name;
} else {
  setActiveRng(createRng(freshSeed()));
}

const seasonLabel = (s: GameState, y = s.year): string =>
  leagueOf(s.leagueId).tier >= 4 ? `${y}-${String((y + 1) % 100).padStart(2, '0')}` : `${y}`;

let screen: 'home' | 'create' | 'retired' | 'game' = 'home';
let tab: 'season' | 'player' | 'career' | 'trophy' = 'season';
let lastRetired: HofEntry | null = null;
const C: { name: string; number: number; pos: Pos; foot: GameState['foot']; type: string; trait: string } = {
  name: randomName(), number: 10, pos: 'FW', foot: '오른발', type: 'poacher', trait: 'late',
};

function randomName(): string {
  return pick(SURNAMES) + pick(GIVEN);
}
function save() {
  if (G) G.rng = getActiveRng().getState();
  saveKey('ft_save', G);
}
let toastTimer: ReturnType<typeof setTimeout> | undefined;
function toast(t: string) {
  const el = document.getElementById('toast');
  if (!el) return;
  el.textContent = t;
  el.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => (el.hidden = true), 2200);
}

function topbar(right = ''): string {
  return `<header class="topbar"><img class="badge" src="/brand/offside-flag-v5-64.png" alt="" width="38" height="38" />
    <div class="brand"><small>풀타임: 휘슬이 울릴 때까지</small><b>오프사이드</b></div><div class="spacer"></div>${right}</header>`;
}
function render() {
  if (screen === 'home') renderHome();
  else if (screen === 'create') renderCreate();
  else if (screen === 'retired') renderRetired();
  else renderGame();
}

// ───────── 홈 ─────────
function renderHome() {
  const live = G && !G.retired;
  const hof = loadHOF();
  $app.innerHTML = `<div class="wrap">${topbar()}
    <section class="hero-home"><div class="chalk"></div>
      <div class="eyebrow">Kick-off · 0′</div>
      <h1>당신의 90분이<br>지금 시작됩니다</h1>
      <p>고교 3학년의 킥오프부터 은퇴의 종료 휘슬까지. 선택과 확률이 한 선수의 커리어를 만듭니다.</p>
      <button class="btn btn-accent btn-block" data-act="new">새 커리어 킥오프 →</button>
    </section>
    ${live && G ? `<button class="tile" data-act="continue" style="width:100%">
        <span class="eyebrow">Continue</span><b>${esc(G.name)} · ${G.age}세 · ${esc(G.club.name)}</b>
        <span class="muted" style="font-size:13px">${G.year} 시즌 ${PHASES[Math.min(G.phase, LAST_PHASE + 1)]} · OVR ${ovr(G)}</span></button>` : ''}
    <div class="tiles">
      <div class="tile"><span class="eyebrow">How to play</span><b>구간마다 훈련 선택</b><span class="muted" style="font-size:13px">한 시즌 = 프리시즌 + 전반기 + 후반기</span></div>
      <div class="tile"><span class="eyebrow">Events</span><b>확률 이벤트</b><span class="muted" style="font-size:13px">선택지마다 성공 확률 공개</span></div>
    </div>
    <section class="card"><div class="eyebrow">Legends</div><h2 style="margin-bottom:8px">명예의 전당</h2>
      ${hof.length ? hof.slice(0, 10).map((h, i) => `<div class="hof-row"><div class="hof-rank">${i + 1}</div>
        <div><b>${esc(h.name)}</b> <span class="pill">${POS[h.pos].label}</span><div class="muted" style="font-size:12px">${h.apps}경기 ${h.goals}골 ${h.assists}도움 · 트로피 ${h.trophies} · 최고 OVR ${h.peak}${h.ballon ? ` · 발롱도르 ${h.ballon}회` : ''}</div></div>
        <div class="num" style="font-size:22px;font-weight:700">${h.score}</div></div>`).join('')
      : `<p class="empty">아직 은퇴한 선수가 없습니다. 첫 번째 레전드가 되어보세요.</p>`}
    </section>
    ${accountSlot()}
  </div>`;
  mountAccount();
}

// ───────── 캐릭터 생성 ─────────
function renderCreate() {
  const types = TYPES[C.pos];
  if (!types.find((t) => t.id === C.type)) C.type = types[0]!.id;
  const o = (key: keyof typeof C, val: string, title: string, sub = ''): string =>
    `<button class="opt" data-set="${key}" data-val="${val}" aria-pressed="${C[key] === val}"><b>${title}</b>${sub ? `<small>${sub}</small>` : ''}</button>`;
  $app.innerHTML = `<div class="wrap">${topbar('<button class="icon-btn" data-act="home">취소</button>')}
    <section class="card stack" style="gap:16px">
      <div><div class="eyebrow">Player Creation</div><h1>고교 3학년, 나는 어떤 선수인가</h1></div>
      <div class="row" style="flex-wrap:nowrap">
        <div class="field" style="flex:1"><label for="f-name">이름</label><input type="text" id="f-name" maxlength="10" value="${esc(C.name)}"></div>
        <div class="field" style="width:84px"><label for="f-num">등번호</label><input type="number" id="f-num" min="1" max="99" value="${C.number}"></div>
      </div>
      <div class="field"><span class="lbl">포지션</span><div class="seg four">${(Object.keys(POS) as Pos[]).map((k) => o('pos', k, POS[k].label, k)).join('')}</div></div>
      <div class="field"><span class="lbl">주발</span><div class="seg">${(['오른발', '왼발', '양발'] as const).map((f) => o('foot', f, f)).join('')}</div></div>
      <div class="field"><span class="lbl">플레이 유형 · 강점과 약점</span><div class="seg">${types.map((t) => o('type', t.id, t.name, t.desc)).join('')}</div></div>
      <div class="field"><span class="lbl">성장 특성</span><div class="seg" style="grid-template-columns:1fr 1fr">${TRAITS.map((t) => o('trait', t.id, t.name, t.desc)).join('')}</div></div>
      <p class="muted" style="font-size:13px">잠재력은 숨겨져 있습니다. 스카우트 평가로만 짐작할 수 있어요.</p>
      <button class="btn btn-primary btn-block" data-act="start">킥오프 →</button>
    </section></div>`;
}

// ───────── 게임 ─────────
function renderGame() {
  const s = G!, L = leagueOf(s.leagueId), role = roleOf(s);
  const contract = s.contract ? `연봉 ${fmtMoney(s.contract.salary)}` : L.amateur ? '아마추어' : '';
  $app.innerHTML = `<div class="wrap">${topbar('<button class="icon-btn" data-act="home">메뉴</button>')}
    <section class="player"><div class="chalk"></div>
      <div><div class="shirt">No.${s.number} · ${POS[s.pos].label}</div><h2>${esc(s.name)}</h2>
        <div class="meta">${s.age}세 · ${esc(s.club.name)}<br>${L.name}${contract ? ` · ${contract}` : ''}</div></div>
      <div class="ovr"><div class="n">${ovr(s)}</div><div class="l">OVR</div></div>
      <div class="foot"><span class="pill role-${role}">${role}</span>${s.injury ? `<span class="pill" style="background:var(--bad);border-color:var(--bad)">부상 ${s.injury}경기</span>` : ''}
        <span class="pill">${TYPES[s.pos].find((t) => t.id === s.type)?.name ?? ''}</span><span class="pill">잠재력 ${potGrade(s)}</span></div>
    </section>
    <nav class="tabs" role="tablist">${([['season', '시즌'], ['player', '선수'], ['career', '커리어'], ['trophy', '트로피']] as const)
      .map(([k, l]) => `<button role="tab" data-tab="${k}" aria-selected="${tab === k}">${l}</button>`).join('')}</nav>
    ${tab === 'season' ? seasonTab(s) : tab === 'player' ? playerTab(s) : tab === 'career' ? careerTab(s) : trophyTab(s)}
  </div>`;
}

function meter(label: string, v: number, cls: string): string {
  return `<div class="meter"><span>${label}</span><div class="bar"><i class="${cls}" style="width:${Math.round(v)}%"></i></div><span class="v">${Math.round(v)}</span></div>`;
}
function seasonTab(s: GameState): string {
  const S = s.season, avg = S.apps ? (S.ratingSum / S.apps).toFixed(2) : '-';
  const rank = teamRank(s);
  const phase = Math.min(s.phase, LAST_PHASE);
  const label = phase === 0 ? '프리시즌' : `${PHASES[phase]} · ${roundRange(s, phase)}`;
  const busy = !!s.pending;
  const lastCol: [string, number] = s.pos === 'GK' || s.pos === 'DF' ? ['무실점', S.cs] : ['도움', S.assists];
  const btn = phase === 0 ? '프리시즌 훈련 진행' : `훈련 후 ${phase >= LAST_PHASE ? leagueOf(s.leagueId).matches - S.played : Math.min(blockMatches(s), leagueOf(s.leagueId).matches - S.played)}경기 진행`;
  return `<section class="card">
      <div class="row" style="justify-content:space-between"><div><div class="eyebrow">${seasonLabel(s)} Season</div><h2>${label}</h2></div>
        <span class="pill">${rank ? `팀 ${rank}위` : '개막 전'} · ${S.w}승 ${S.d}무 ${S.l}패</span></div>
      <div class="track">${[0, 1, 2].map((i) => `<div class="${i < phase ? 'done' : i === phase ? 'now' : ''}"></div>`).join('')}</div>
      <div class="track-lbl">${['프리시즌', '전반기', '후반기'].map((t) => `<span>${t}</span>`).join('')}</div>
      <div class="stats"><div><b>${S.apps}</b><span>출전</span></div><div><b>${S.goals}</b><span>골</span></div>
        <div><b>${s.pos === 'GK' || s.pos === 'DF' ? S.assists : S.starts}</b><span>${s.pos === 'GK' || s.pos === 'DF' ? '도움' : '선발'}</span></div>
        <div><b>${lastCol[1]}</b><span>${lastCol[0]}</span></div><div><b>${avg}</b><span>평점</span></div></div>
    </section>
    <section class="card meters">
      ${meter('컨디션', s.cond, s.cond < 40 ? 'bad' : s.cond < 65 ? 'warn' : '')}
      ${meter('사기', s.morale, s.morale < 40 ? 'bad' : s.morale < 60 ? 'warn' : '')}
      ${meter('인기', s.fame, 'acc')}
    </section>
    ${compsCard(s)}
    ${storiesCard(s)}
    <section class="card stack">
      <div><div class="eyebrow">Training</div><h2>이번 구간 훈련 방향</h2></div>
      <div class="train">${TRAININGS.map((t) => `<button class="opt" data-train="${t.id}" aria-pressed="${s.training === t.id}"><b>${trainingLabel(s, t)}</b><small>${trainingDesc(s, t)}</small></button>`).join('')}</div>
      <button class="btn btn-primary btn-block" data-act="${busy ? 'resume' : 'advance'}">${busy ? '진행 중인 이벤트 보기' : btn} →</button>
    </section>
    <section class="card"><div class="eyebrow">Timeline</div><h2 style="margin-bottom:6px">최근 소식</h2>
      <div class="feed">${s.log.slice(0, 14).map((l) => `<div><time>${l.t}</time><span class="${l.kind}">${esc(l.text)}</span></div>`).join('')}</div>
    </section>`;
}

// ───────── 능력치 카드: 육각형 레이더 · 세부 포지션 OVR · 세부 능력치 ─────────
function radarSvg(s: GameState): string {
  const order = s.pos === 'GK' ? RADAR_ORDER.GK : RADAR_ORDER.field;
  const abbr = s.pos === 'GK' ? GK_ABBR : FACE_ABBR;
  const CX = 150, R = 92, n = order.length;
  const pt = (i: number, v: number): [number, number] => {
    const a = -Math.PI / 2 + (i * 2 * Math.PI) / n;
    return [CX + (Math.cos(a) * R * v) / 100, CX + (Math.sin(a) * R * v) / 100];
  };
  const poly = (vals: number[]) => vals.map((v, i) => pt(i, v).map((x) => x.toFixed(1)).join(',')).join(' ');
  const rings = [20, 40, 60, 80, 100].map((r) => `<polygon class="rd-ring" points="${poly(order.map(() => r))}"/>`).join('');
  const spokes = order.map((_, i) => {
    const [x, y] = pt(i, 100);
    return `<line class="rd-ring" x1="${CX}" y1="${CX}" x2="${x.toFixed(1)}" y2="${y.toFixed(1)}"/>`;
  }).join('');
  const prev = s.seasonStart ? `<polygon class="rd-prev" points="${poly(order.map((k) => s.seasonStart[k]))}"/>` : '';
  const labels = order.map((k, i) => {
    const [x, y] = pt(i, 126);
    const v = Math.round(s.attrs[k]);
    const d = s.seasonStart ? v - Math.round(s.seasonStart[k]) : 0;
    const anchor = Math.abs(x - CX) < 4 ? 'middle' : x > CX ? 'start' : 'end';
    return `<text x="${x.toFixed(1)}" y="${(y - 7).toFixed(1)}" text-anchor="${anchor}" class="rd-abbr">${abbr[k]} <tspan class="rd-kr">${labelOf(s, k)}</tspan></text>
      <text x="${x.toFixed(1)}" y="${(y + 13).toFixed(1)}" text-anchor="${anchor}" class="rd-val">${v}${d > 0 ? `<tspan class="rd-up"> +${d}</tspan>` : d < 0 ? `<tspan class="rd-down"> ${d}</tspan>` : ''}</text>`;
  }).join('');
  const dots = order.map((k, i) => {
    const [x, y] = pt(i, s.attrs[k]);
    return `<circle class="rd-dot" cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="3"/>`;
  }).join('');
  return `<svg class="radar" viewBox="0 0 300 300" role="img" aria-label="${order.map((k) => `${labelOf(s, k)} ${Math.round(s.attrs[k])}`).join(', ')}">
    ${rings}${spokes}${prev}<polygon class="rd-now" points="${poly(order.map((k) => s.attrs[k]))}"/>${dots}${labels}</svg>`;
}
function attrCard(s: GameState): string {
  const role = mainRole(s), W = ROLES[role]!, F = faceOf(s);
  const order = s.pos === 'GK' ? RADAR_ORDER.GK : RADAR_ORDER.field;
  const abbr = s.pos === 'GK' ? GK_ABBR : FACE_ABBR;
  const tier = (v: number) => (v >= 80 ? 't4' : v >= 70 ? 't3' : v >= 50 ? 't2' : 't1');
  const roles = [...new Set([role, ...POS_ROLES[s.pos]])]
    .map((r) => `<span class="${r === role ? 'on' : ''}" title="${ROLE_NAME[r]}">${r} <b class="num">${Math.round(ovrRole(s, r))}</b></span>`).join('');
  const groups = order.map((g) => {
    const rows = Object.keys(F[g]!).sort((x, y) => (W[y] || 0) - (W[x] || 0) || s.sub[y]! - s.sub[x]!).map((k) => {
      const v = Math.round(s.sub[k]!);
      return `<li class="${(W[k] || 0) >= 0.05 ? 'key' : ''}"><span>${SUBS[k]}</span><b class="num ${tier(v)}">${v}</b></li>`;
    }).join('');
    return `<div class="stat-grp"><div class="stat-head"><span><small>${abbr[g]}</small>${labelOf(s, g)}</span><b class="num ${tier(s.attrs[g])}">${Math.round(s.attrs[g])}</b></div><ul>${rows}</ul></div>`;
  }).join('');
  return `<section class="card"><div class="eyebrow">Attributes</div>
      <div class="attr-head"><h2>능력치</h2><span class="pill">${ROLE_NAME[role]} · OVR ${ovr(s)}</span></div>
      ${radarSvg(s)}
      <p class="radar-legend muted"><i class="lg-now"></i>현재 <i class="lg-prev"></i>시즌 시작</p>
      <div class="role-line"><span class="muted">포지션별 OVR</span>${roles}</div>
      <div class="stat-list">${groups}</div>
      <p class="muted stat-note"><b>굵은 글씨</b>가 ${ROLE_NAME[role]} OVR을 결정하는 능력치예요.</p>
    </section>`;
}

function playerTab(s: GameState): string {
  const L = leagueOf(s.leagueId);
  const value = marketValue(s);
  return `${attrCard(s)}
    <section class="card"><div class="eyebrow">Profile</div><h2 style="margin-bottom:10px">선수 정보</h2>
      <dl class="kv">
        <dt>주발</dt><dd>${s.foot}</dd>
        <dt>성장 특성</dt><dd>${TRAITS.find((t) => t.id === s.trait)?.name ?? ''}</dd>
        <dt>스카우트 잠재력 평가</dt><dd>${potGrade(s)}등급</dd>
        <dt>최고 OVR</dt><dd>${Math.max(s.peak, ovr(s))}</dd>
        <dt>감독 신뢰</dt><dd>${s.trust >= 2 ? '두터움' : s.trust >= 0 ? '보통' : '냉랭함'}</dd>
        <dt>계약</dt><dd>${s.contract ? `${s.contract.years}년 남음 · ${fmtMoney(s.contract.salary)}/년` : L.amateur ? '아마추어' : '-'}</dd>
        <dt>보유 자금</dt><dd>${fmtMoney(s.money)}원</dd>
        ${L.amateur ? '' : `<dt>추정 시장가치</dt><dd>${fmtMoney(value)}원</dd>`}
      </dl>
    </section>
    ${nationalCard(s)}
    ${s.age >= 32 && !L.amateur ? `<button class="btn btn-block" data-act="retire-ask">은퇴 선언하기</button>` : ''}`;
}

function seasonLabelOf(r: CareerRecord): string {
  const L = LEAGUES.find((l) => l.name === r.league);
  return L && L.tier >= 4 ? `${r.year}-${String((r.year + 1) % 100).padStart(2, '0')}` : `${r.year}`;
}
function compsCard(s: GameState): string {
  const list = s.season.comps || [];
  if (!list.length) return '';
  return `<section class="card"><div class="eyebrow">Competitions</div><h2 style="margin-bottom:6px">이번 시즌 대회</h2>
    ${list.map((c) => `<div class="story-row"><b>${esc(c.name)}</b><span class="muted">${c.stage || (c.type === 'super' ? '개막 전 단판' : '1구간 시작')}${c.alive && c.stage ? ' · 진행 중' : ''}</span><span class="muted">${c.apps}경기 ${c.g}골</span></div>`).join('')}</section>`;
}
function nationalCard(s: GameState): string {
  const n = s.nat;
  const milTxt = milStatusText(s);
  const tours = n.tours.filter((x) => x.inSquad);
  return `<section class="card"><div class="eyebrow">Korea Republic</div><h2 style="margin-bottom:10px">국가대표</h2>
    <div class="totals"><div><b>${n.caps}</b><span>A매치</span></div><div><b>${n.goals}</b><span>골</span></div><div><b>${n.assists}</b><span>도움</span></div><div><b>${n.captain ? 'C' : '-'}</b><span>주장</span></div></div>
    <dl class="kv" style="margin-top:10px"><dt>A매치 데뷔</dt><dd>${n.debutYear || '미발탁'}</dd><dt>병역</dt><dd>${milTxt}</dd>
      <dt>다음 월드컵</dt><dd>${nextWC(s.year - 1)} · ${(HOSTS.wc as Record<number, string>)[nextWC(s.year - 1)] || '개최지 미정'}</dd></dl>
    ${tours.length ? `<div style="margin-top:8px">${tours.slice().reverse().map((x) => `<div class="trophy"><span class="y">${x.year}</span><div><b>${esc(x.name.replace(/^\d{4} /, ''))}</b> <span class="muted" style="font-size:12px">${x.stage} · ${x.apps}경기 ${x.goals}골</span></div></div>`).join('')}</div>` : ''}
  </section>`;
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
  const ms = matches.map((m) => `<div class="muted" style="font-size:12px">${(m as unknown as { stage?: string }).stage || '조별리그'} · ${esc(scoreLine(m))}${m.mins ? ` · ${m.g ? m.g + '골 ' : ''}${m.a ? m.a + '도움 ' : ''}평점 ${m.rating}` : ''}</div>`).join('');
  return `<div class="stack" style="gap:2px"><p><b>${esc(x.name)}</b> — ${x.stage}${x.inSquad ? '' : x.why ? ` <span class="muted">(${x.why})</span>` : matches.length ? ' <span class="muted">(명단 외)</span>' : ''}</p>${x.inSquad ? ms : ''}</div>`;
}
function totals(s: GameState) {
  return s.career.reduce((a, r) => ({ p: a.p + r.apps, g: a.g + r.goals, a: a.a + r.assists, cs: a.cs + (r.cs || 0) }), { p: 0, g: 0, a: 0, cs: 0 });
}
function careerTab(s: GameState): string {
  const t = totals(s);
  return `<section class="card stack"><div><div class="eyebrow">Career</div><h2>통산 기록</h2></div>
      <div class="totals"><div><b>${t.p}</b><span>경기</span></div><div><b>${t.g}</b><span>골</span></div>${s.pos === 'GK' || s.pos === 'DF' ? `<div><b>${t.cs}</b><span>무실점</span></div>` : `<div><b>${t.a}</b><span>도움</span></div>`}<div><b>${s.trophies.length + s.awards.length}</b><span>수상</span></div></div>
      ${s.career.length ? `<div class="table-wrap"><table><thead><tr><th>시즌</th><th>소속</th><th class="n">경기</th><th class="n">골</th><th class="n">도움</th><th class="n">평점</th><th class="n">순위</th><th class="n">OVR</th></tr></thead>
        <tbody>${s.career.slice().reverse().map((r) => `<tr><td>${r.mil ? r.year : seasonLabelOf(r)} <span class="muted">(${r.age})</span></td><td>${esc(r.club)}<div class="muted" style="font-size:11px">${r.league}${r.honors.length ? ` · <span class="honor">${r.honors.join(', ')}</span>` : ''}</div></td>
          <td class="n">${r.apps}</td><td class="n">${r.goals}</td><td class="n">${r.assists}</td><td class="n">${r.rating ? r.rating.toFixed(2) : '-'}</td><td class="n">${r.rank}</td><td class="n">${r.ovr}</td></tr>`).join('')}</tbody></table></div>`
      : `<p class="empty">첫 시즌을 마치면 기록이 쌓입니다.</p>`}
      <p class="muted" style="font-size:12px">경기·골·도움은 리그·컵·대륙 대회를 합친 공식전 기록입니다.</p>
    </section>
    <section class="card"><div class="eyebrow">Journey</div><h2 style="margin-bottom:4px">커리어 여정</h2>
      ${(s.miles || []).length ? (s.miles || []).slice().reverse().map((m) => `<div class="trophy"><span class="y">${m.year}</span><div><b>${esc(m.t)}</b></div></div>`).join('') : '<p class="empty">프로 데뷔부터 여정이 기록됩니다.</p>'}
    </section>`;
}
function trophyTab(s: GameState): string {
  const list = <T extends { year: number; t: string }>(arr: T[], sub: (x: T) => string): string =>
    arr.length ? arr.slice().reverse().map((x) => `<div class="trophy"><span class="y">${x.year}</span><div><b>${x.t}</b>${sub(x)}</div></div>`).join('') : `<p class="empty">아직 없습니다.</p>`;
  return `<section class="card"><div class="eyebrow">Team Honours</div><h2 style="margin-bottom:4px">우승 연혁</h2>${list(s.trophies, (x) => `<span class="muted" style="font-size:12px">${esc(x.club)}</span>`)}</section>
    <section class="card"><div class="eyebrow">Individual</div><h2 style="margin-bottom:4px">개인 수상</h2>${list(s.awards, () => '')}</section>
    ${(s.ballon || []).length ? `<section class="card"><div class="eyebrow">Ballon d'Or</div><h2 style="margin-bottom:4px">발롱도르 순위</h2>${(s.ballon || []).slice().reverse().map((b) => `<div class="trophy"><span class="y">${b.year}</span><div><b>${b.rank === 1 ? '수상' : `${b.rank}위`}</b> <span class="muted" style="font-size:12px">30인 후보</span></div></div>`).join('')}</section>` : ''}
    <section class="card"><div class="eyebrow">Story Album</div><h2 style="margin-bottom:4px">완결된 스토리</h2>${list((s.storyLog || []).map((x) => ({ year: x.year, t: x.ending, name: x.name })), (x) => `<span class="muted" style="font-size:12px">${x.name}</span>`)}</section>`;
}

// ───────── 은퇴 화면 ─────────
function renderRetired() {
  const s = G!, t = totals(s), e = lastRetired || { score: legendScore(s) };
  $app.innerHTML = `<div class="wrap">${topbar()}
    <section class="player"><div class="chalk"></div>
      <div><div class="shirt">Full Time · No.${s.number}</div><h2>${esc(s.name)}</h2><div class="meta">${s.age}세 은퇴 · 마지막 소속 ${esc(s.club.name)}</div></div>
      <div class="ovr"><div class="n">${e.score}</div><div class="l">LEGEND</div></div>
      <div class="foot"><span class="pill role-주전">${legendTitle(e.score)}</span><span class="pill">최고 OVR ${s.peak}</span></div>
    </section>
    <section class="card stack"><div class="eyebrow">Career Highlights</div>
      <div class="totals"><div><b>${t.p}</b><span>경기</span></div>${s.pos === 'GK' || s.pos === 'DF' ? `<div><b>${t.cs}</b><span>무실점</span></div><div><b>${t.g + t.a}</b><span>공격P</span></div>` : `<div><b>${t.g}</b><span>골</span></div><div><b>${t.a}</b><span>도움</span></div>`}<div><b>${s.nat.caps}</b><span>A매치</span></div></div>
      <p>${s.career.length}시즌 동안 ${new Set(s.career.map((r) => r.club)).size}개 팀에서 뛰며 트로피 ${s.trophies.length}개, 개인상 ${s.awards.length}개를 들어 올렸습니다.</p>
      <p class="muted" style="font-size:12px">레전드 점수 = 포지션별 기여(공격수·미드필더는 골·도움, 수비수·골키퍼는 무실점 중심) + 출전 · 우승 · 개인상 · A매치 · 최고 OVR · 발롱도르/월드컵 보너스</p>
    </section>
    ${trophyTab(s)}${careerTab(s)}
    <button class="btn btn-primary btn-block" data-act="new">새 커리어 킥오프 →</button>
    <button class="btn btn-block" data-act="home">명예의 전당 보기</button></div>`;
}

// ───────── 모달 ─────────
function openSheet(html: string) {
  $sheet.innerHTML = html;
  ($modal as HTMLElement).hidden = false;
  $sheet.scrollTop = 0;
  const b = $sheet.querySelector<HTMLButtonElement>('button');
  if (b) b.focus({ preventScroll: true });
}
function closeSheet() {
  ($modal as HTMLElement).hidden = true;
  $sheet.innerHTML = '';
}
type Chip = { label: string; d: number; money?: boolean; text?: string; bad?: boolean };
function chipsHtml(chips: Chip[], pop = false): string {
  if (!chips.length) return '';
  return `<div class="chips">${chips.map((c, i) => `<span class="chip ${pop ? 'pop' : ''} ${c.bad || c.d < 0 ? 'down' : 'up'}" style="--d:${i * 70}ms">${c.label} ${c.text || (c.money ? (c.d > 0 ? '+' : '') + fmtMoney(c.d) : (c.d > 0 ? '+' : '') + c.d)}</span>`).join('')}</div>`;
}
let onSheet: (() => void)[] | null = null;
function sheetButtons(btns: { label: string; cls?: string; fn: () => void }[]): string {
  return btns.map((b, i) => `<button class="btn ${b.cls || ''} btn-block" data-sheet="${i}">${b.label}</button>`).join('');
}
function showSheet(html: string, btns: { label: string; cls?: string; fn: () => void }[]) {
  onSheet = btns.map((b) => b.fn);
  openSheet(html + sheetButtons(btns));
}

// ───────── 진행 연출 ─────────
let busyAnim = false;
const motionOK = (() => {
  try {
    return !matchMedia('(prefers-reduced-motion: reduce)').matches;
  } catch {
    return true;
  }
})();
const wait = (ms: number) => new Promise<void>((r) => setTimeout(r, motionOK ? ms : 0));
const $q = <T extends Element = Element>(sel: string): T | null => $sheet.querySelector<T>(sel);

type MatchGame = { rd: number; res: 'W' | 'D' | 'L'; mins: number; g: number; a: number; rating: number; cs?: boolean; inj?: boolean };
function fakeScore(m: MatchGame): string {
  let gf = Math.max(m.g || 0, m.res === 'W' ? ri(1, 3) : ri(0, 2));
  let ga: number;
  if (m.res === 'W') ga = m.cs ? 0 : ri(0, gf - 1);
  else if (m.res === 'D') {
    if (m.cs) gf = 0;
    ga = gf;
  } else ga = gf + ri(1, 2);
  return `${gf}-${ga}`;
}
async function playSteps(title: string, steps: string[], ms = 380) {
  busyAnim = true;
  onSheet = [];
  openSheet(`<div class="eyebrow">${title}</div><div class="prog"><i id="an-bar"></i></div><div class="steps">${steps.map((t) => `<div>${t}</div>`).join('')}</div>`);
  const rows = [...$sheet.querySelectorAll<HTMLElement>('.steps div')];
  for (let i = 0; i < rows.length; i++) {
    rows[i]!.className = 'on';
    const bar = $q<HTMLElement>('#an-bar');
    if (bar) bar.style.width = `${((i + 1) / rows.length) * 100}%`;
    await wait(ms);
    rows[i]!.className = 'done';
  }
  await wait(150);
  busyAnim = false;
}
interface BlockResultLike {
  games: MatchGame[];
  n: number;
  w: number;
  d: number;
  l: number;
  apps: number;
  goals: number;
  assists: number;
  cs: number;
  rs: number;
  hl: string[];
}
function playBlock(s: GameState, ph: number, b: BlockResultLike, extras: string[]): Promise<void> {
  return new Promise((resolve) => {
    busyAnim = true;
    onSheet = [];
    const back = s.pos === 'DF' || s.pos === 'GK';
    const opps = clubsIn(s.leagueId).filter((c) => c.id !== s.club.id);
    const n = b.games.length, step = clamp(2600 / Math.max(1, n), 70, 170);
    openSheet(`<div class="eyebrow">${s.year} · ${PHASES[ph]} 진행 중</div><h2>${roundRange(s, ph)} · ${n}경기</h2>
      <div class="prog"><i id="an-bar"></i></div><div class="prog-meta"><span id="an-rd">킥오프</span><span id="an-wdl">0승 0무 0패</span></div>
      <div class="tally"><div><b id="t-apps">0</b><span>출전</span></div><div><b id="t-g">0</b><span>골</span></div><div><b id="t-a">0</b><span>${back ? '무실점' : '도움'}</span></div><div><b id="t-r">-</b><span>평점</span></div></div>
      <div class="ticker" id="an-tk"></div><div class="steps" id="an-steps"></div>
      <button class="skip" id="an-skip">건너뛰기</button>`);
    let i = 0, w = 0, d = 0, l = 0, apps = 0, g = 0, a = 0, cs = 0, rs = 0, timer: ReturnType<typeof setTimeout> | null = null, done = false;
    const set = (id: string, v: string | number) => {
      const el = $q<HTMLElement>(id);
      if (el && el.textContent !== String(v)) {
        el.textContent = String(v);
        el.classList.remove('bump');
        void el.offsetWidth;
        el.classList.add('bump');
      }
    };
    const finish = async (skipped: boolean) => {
      if (done) return;
      done = true;
      if (timer) clearTimeout(timer);
      if (!skipped && extras.length) {
        const box = $q<HTMLElement>('#an-steps');
        for (const t of extras) {
          if (!box) break;
          box.insertAdjacentHTML('beforeend', `<div class="on">${t}</div>`);
          await wait(420);
          (box.lastElementChild as HTMLElement).className = 'done';
        }
        await wait(200);
      }
      busyAnim = false;
      resolve();
    };
    const tick = () => {
      if (!$q('#an-tk')) return void finish(true);
      if (i >= n) return void finish(false);
      const m = b.games[i++]!;
      if (m.res === 'W') w++;
      else if (m.res === 'D') d++;
      else l++;
      if (m.mins) {
        apps++;
        g += m.g;
        a += m.a;
        rs += m.rating;
        if (m.cs) cs++;
      }
      const opp = opps.length ? opps[m.rd % opps.length]!.name : '상대 팀';
      const info = m.mins ? `${m.mins}분${m.g ? ` · <b>${m.g}골</b>` : ''}${m.a ? ` · ${m.a}도움` : ''} · ${m.rating}` : m.inj ? '부상 결장' : '출전 없음';
      $q('#an-tk')!.insertAdjacentHTML('afterbegin', `<div><span class="rd">${m.rd}R</span><span class="res ${m.res}">${{ W: '승', D: '무', L: '패' }[m.res]}</span><span>${esc(opp)} ${fakeScore(m)} <span class="muted">· ${info}</span></span></div>`);
      const tk = $q('#an-tk')!;
      while (tk.children.length > 5) tk.lastElementChild!.remove();
      $q<HTMLElement>('#an-bar')!.style.width = `${(i / n) * 100}%`;
      $q('#an-rd')!.textContent = `${m.rd}R / ${leagueOf(s.leagueId).matches}R`;
      $q('#an-wdl')!.textContent = `${w}승 ${d}무 ${l}패`;
      set('#t-apps', apps);
      set('#t-g', g);
      set('#t-a', back ? cs : a);
      set('#t-r', apps ? (rs / apps).toFixed(2) : '-');
      timer = setTimeout(tick, motionOK ? step : 0);
    };
    $q('#an-skip')!.addEventListener('click', () => finish(true));
    tick();
  });
}
function playJudge(label: string, p: number, roll: number): Promise<void> {
  return new Promise((resolve) => {
    busyAnim = true;
    onSheet = [];
    openSheet(`<div class="eyebrow">판정 중</div><h2>${esc(label)}</h2>
      <div class="judge"><div class="ok" style="width:${p * 100}%"></div><div class="ng"></div><i class="needle"></i></div>
      <div class="judge-lbl"><span>성공 ${Math.round(p * 100)}%</span><span>실패 ${100 - Math.round(p * 100)}%</span></div>`);
    const needle = $q<HTMLElement>('.needle'), dur = motionOK ? 1150 : 0, t0 = performance.now();
    const frame = () => {
      const t = dur ? Math.min(1, (performance.now() - t0) / dur) : 1, ease = 1 - Math.pow(1 - t, 3);
      const sweep = (Math.sin(t * 17) + 1) / 2;
      if (needle) needle.style.left = `calc(${(sweep * (1 - ease) + roll * ease) * 100}% - 1px)`;
      if (t < 1) setTimeout(frame, 16);
      else setTimeout(() => { busyAnim = false; resolve(); }, motionOK ? 280 : 0);
    };
    frame();
  });
}

async function advance() {
  if (busyAnim || !G) return;
  const s = G, ph = s.phase;
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
  render();
  const b = block;
  const extras = [...(comp.length ? ['컵 · 대륙 대회 결과 집계'] : []), ...(nt ? ['A매치 소집 명단 발표'] : []), ...(ev ? ['주변에서 무언가 일이 벌어지고 있습니다…'] : [])];
  if (b) await playBlock(s, ph, b, extras);
  else await playSteps(`${s.year} · 프리시즌 진행 중`, [isPro(s) ? '전지훈련 캠프 입소' : '동계 훈련 시작', '체력 테스트', '전술 훈련', '연습 경기', ...extras]);
  showSheet(`<div class="eyebrow">${s.year} · ${title}</div>
    ${b ? `<div class="row" style="align-items:baseline;gap:14px"><span class="result-big">${b.w}<span class="muted" style="font-size:20px">승</span> ${b.d}<span class="muted" style="font-size:20px">무</span> ${b.l}<span class="muted" style="font-size:20px">패</span></span></div>
      <p>${b.apps}경기 출전 · <b>${b.goals}골 ${b.assists}도움</b>${b.apps ? ` · 평균 평점 <b>${(b.rs / b.apps).toFixed(2)}</b>` : ''}${b.cs ? ` · 무실점 ${b.cs}` : ''}</p>
      ${b.hl.map((h) => `<p class="hl">${esc(h)}</p>`).join('')}` : `<h2>시즌 준비를 마쳤습니다</h2><p class="muted">예상 역할: ${roleOf(s)}</p>`}
    ${comp.length ? `<div><div class="eyebrow" style="margin-bottom:6px">컵 · 대륙 대회</div>${comp.map((c) => `<p class="${c.k === 'good' ? 'hl' : 'muted'}">${esc(c.t)}</p>`).join('')}</div>` : ''}
    ${ntHtml(nt)}
    <div><div class="eyebrow" style="margin-bottom:6px">변화</div>${chipsHtml(chips, true) || '<p class="muted">큰 변화 없음</p>'}</div>`,
    [{ label: '계속 →', cls: 'btn-primary', fn: nextPending }]);
}

function nextPending() {
  const s = G;
  if (!s) return;
  const p = s.pending;
  if (!p) {
    closeSheet();
    render();
    return;
  }
  if (p.type === 'event') return showEvent(p as { type: 'event'; id: string });
  if (p.type === 'seasonEnd') {
    if (busyAnim) return;
    const res = endSeason(s);
    s.pending = { type: 'market', res, m: null };
    save();
    render();
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
  const s = G!;
  const ev = EVENTS.find((e) => e.id === p.id)!;
  const tag = ev.story ? `<div class="story-tag">스토리 · ${STORIES[ev.story]!.name} <b>${ev.stage}/${STORIES[ev.story]!.total}</b></div>` : '';
  showSheet(`${tag}<div class="eyebrow">Event · ${s.year} ${PHASES[Math.max(0, s.phase - 1)]}</div><h2>${ev.title}</h2><p>${esc(ev.text(s))}</p>
    <div class="stack">${ev.choices.map((c, i) => `<button class="choice" data-choice="${i}"><span>${esc(txt(c.label, s))}</span>${c.p ? `<span class="odds">${Math.round(c.p(s) * 100)}%</span>` : (isSafe(ev, c) ? '<span class="odds" title="확정이지만 보상이 줄고 가끔 대가가 따릅니다">안전</span>' : '<span class="odds">확정</span>')}</button>`).join('')}</div>`, []);
}
async function chooseEvent(i: number) {
  if (busyAnim || !G) return;
  const s = G, p = s.pending as { type: 'event'; id: string; then?: string | null };
  const c = EVENTS.find((e) => e.id === p.id)!.choices[i]!, label = txt(c.label, s);
  const r = resolveChoice(s, p.id, i);
  s.pending = p.then === 'seasonEnd' ? { type: 'seasonEnd' } : null;
  save();
  render();
  if (r.p < 1) await playJudge(label, r.p, r.roll);
  showSheet(`<div class="eyebrow">결과 · ${esc(label)}</div><div class="result-big pop ${r.ok ? 'ok' : 'ng'}">${r.p < 1 ? (r.ok ? '성공' : '실패') : '결정'}</div>
    <p>${esc(r.text)}</p>${chipsHtml(r.chips as Chip[], true)}${r.twist ? `<p class="twist">${esc(r.twist)}</p>` : ''}${storyNote(r.story)}`, [{ label: '확인', cls: 'btn-primary', fn: nextPending }]);
}
function storyNote(st: { name: string; ending: string | null; started: boolean } | null): string {
  if (!st) return '';
  if (st.ending) return `<div class="story-end"><span class="eyebrow">스토리 완결 · ${st.name}</span><b>${esc(st.ending)}</b></div>`;
  return `<div class="story-next">${st.started ? `새 스토리 시작: <b>${st.name}</b> — ` : ''}이 이야기는 다음에 이어집니다…</div>`;
}
function storiesCard(s: GameState): string {
  const act = Object.entries(s.story || {}).filter(([, v]) => !v.done);
  if (!act.length) return '';
  const t = turnNo(s);
  return `<section class="card"><div class="eyebrow">Storylines</div><h2 style="margin-bottom:6px">진행 중인 스토리</h2>
    ${act.map(([k, v]) => {
      const c = (s.chains || []).find((x) => {
        const e = EVENTS.find((y) => y.id === x.id);
        return e && e.story === k;
      });
      const waitTxt = c ? (c.at <= t ? '곧 이어짐' : `약 ${c.at - t}구간 후`) : '';
      return `<div class="story-row"><b>${STORIES[k]!.name}</b><span class="dots">${Array.from({ length: STORIES[k]!.total }, (_, i) => `<i class="${i < v.stage ? 'on' : ''}"></i>`).join('')}</span><span class="muted">${waitTxt}</span></div>`;
    }).join('')}</section>`;
}

function showSeasonEnd(p: { res: ReturnType<typeof endSeason> }) {
  const { rec, trophies, awards, notes, gala = [], tours = [], miles = [] } = p.res;
  const cols = G!.pos === 'GK' || G!.pos === 'DF' ? `${rec.cs} 무실점` : `${rec.assists} 도움`;
  showSheet(`<div class="eyebrow">${seasonLabelOf(rec)} Season Review</div><h2>${esc(rec.club)} · ${rec.league} ${rec.rank}위</h2>
    <div class="stats" style="grid-template-columns:repeat(4,1fr)"><div><b>${rec.apps}</b><span>출전</span></div><div><b>${rec.goals}</b><span>골</span></div><div><b>${cols.split(' ')[0]}</b><span>${cols.split(' ')[1]}</span></div><div><b>${rec.rating ? rec.rating.toFixed(2) : '-'}</b><span>평점</span></div></div>
    ${trophies.length || awards.length ? `<div class="stack">${[...trophies, ...awards].map((t) => `<p class="hl"><b>${t}</b></p>`).join('')}</div>` : '<p class="muted">이번 시즌 수상은 없었습니다.</p>'}
    ${(rec.comps || []).length ? `<div><div class="eyebrow" style="margin-bottom:6px">대회별 성적</div>${(rec.comps || []).map((c) => `<p class="muted">${esc(c.name)} · ${c.stage} · ${c.apps}경기 ${c.g}골 ${c.a}도움</p>`).join('')}</div>` : ''}
    ${tours.length ? `<div><div class="eyebrow" style="margin-bottom:6px">국가대표 · 국제대회</div>${tours.map(tourHtml).join('')}</div>` : ''}
    ${gala.length ? `<div><div class="eyebrow" style="margin-bottom:6px">Ballon d'Or 시상식</div>${gala.map((g) => `<p class="hl"><b>${g}</b></p>`).join('')}</div>` : ''}
    ${miles.length ? `<div><div class="eyebrow" style="margin-bottom:6px">커리어 여정</div>${miles.map((m) => `<p>· ${esc(m)}</p>`).join('')}</div>` : ''}
    ${notes.length ? `<p class="muted">${notes.join(' · ')}</p>` : ''}
    <p class="muted">나이 ${G!.age}세가 되었습니다. 이제 다음 시즌을 준비합니다.</p>`,
    [{ label: '이적 시장으로 →', cls: 'btn-primary', fn: () => { (G!.pending as { res: unknown }).res = null; save(); nextPending(); } }]);
}

function showMarket(m: { options: MarketOption[]; note: string; canRetire: boolean }) {
  const opts = m.options;
  let html = `<div class="eyebrow">${seasonLabel(G!)} Transfer Window</div><h2>다음 시즌, 어디서 뛸까요?</h2><p class="muted">${esc(m.note)}</p><div class="stack">`;
  html += opts.map((o, i) => {
    if (o.kind === 'offer') {
      const lg = leagueOf(o.leagueId).name;
      return `<button class="offer" data-opt="${i}"><div><b>${esc(o.name)}</b><div class="lg">${lg} · 팀 전력 ${o.str}</div></div>
        <div class="sal">${fmtMoney(o.salary)}<div class="lg" style="text-align:right">연봉</div></div>
        <div class="sub">${o.years}년 계약${o.role ? ` · ${o.role}` : ''}${o.fee ? ` · 이적료 약 ${fmtMoney(o.fee)}` : G!.contract && !leagueOf(G!.leagueId).amateur ? ' · 자유계약(FA)' : ''}</div></button>`;
    }
    if (o.kind === 'renew') {
      const lg = leagueOf(G!.leagueId).name;
      return `<button class="offer" data-opt="${i}"><div><b>${esc(o.name)}</b><div class="lg">${lg}</div></div>
        <div class="sal">${fmtMoney(o.salary)}<div class="lg" style="text-align:right">연봉</div></div>
        <div class="sub">${o.years}년 계약</div></button>`;
    }
    return `<button class="offer" data-opt="${i}"><div><b>${esc(o.name)}</b><div class="lg">${esc(o.desc ?? '')}</div></div></button>`;
  }).join('');
  html += `</div>`;
  const btns = m.canRetire ? [{ label: '은퇴를 선언한다', fn: () => doRetire() }] : [];
  showSheet(html, btns);
  $sheet.querySelectorAll<HTMLButtonElement>('[data-opt]').forEach((b) => b.addEventListener('click', () => {
    const o = opts[+b.dataset.opt!]!;
    const r = acceptOption(G!, o);
    if (r) {
      G!.training = 'rest';
      if (r.reopen) {
        G!.pending = { type: 'market', res: null, m: market(G!) };
        save();
        render();
        return showSheet(`<div class="eyebrow">병역</div><p>${esc(r.text)}</p>`, [{ label: '이적 시장으로 →', cls: 'btn-primary', fn: nextPending }]);
      }
      G!.pending = null;
      save();
      render();
      tab = 'season';
      return showSheet(`<div class="eyebrow">병역</div><div class="result-big ${r.ok === false ? 'ng' : 'ok'}">${o.kind === 'serve' ? '복무' : r.ok ? '합격' : '결정'}</div><p>${esc(r.text)}</p>`, [{ label: `${G!.year} 시즌 시작 →`, cls: 'btn-primary', fn: () => { closeSheet(); render(); } }]);
    }
    G!.pending = null;
    G!.training = 'rest';
    save();
    closeSheet();
    tab = 'season';
    render();
    toast(`${G!.year} 시즌 시작!`);
  }));
}

function doRetire() {
  lastRetired = retire(G!);
  G!.pending = null;
  save();
  closeSheet();
  screen = 'retired';
  render();
  window.scrollTo(0, 0);
}

// ───────── 계정 영역 (구글 로그인) ─────────
function accountSlot(): string {
  return `<section class="card" id="account-slot"></section>`;
}
function mountAccount() {
  const el = document.getElementById('account-slot');
  if (el) void import('./account.js').then((m) => m.mountAccount(el));
}

// ───────── 이벤트 위임 ─────────
document.addEventListener('click', (e) => {
  const t = (e.target as HTMLElement).closest('button');
  if (!t) return;
  const d = t.dataset;
  if (d.sheet !== undefined) {
    const fn = onSheet && onSheet[+d.sheet];
    if (fn) fn();
    return;
  }
  if (d.choice !== undefined) return void chooseEvent(+d.choice);
  if (d.tab) {
    tab = d.tab as typeof tab;
    return render();
  }
  if (d.train) {
    if (G) G.training = d.train;
    save();
    return render();
  }
  if (d.set) {
    const key = d.set as keyof typeof C;
    if (key === 'pos') {
      C.pos = d.val as Pos;
      C.type = TYPES[C.pos][0]!.id;
    } else (C[key] as string) = d.val!;
    C.name = (document.getElementById('f-name') as HTMLInputElement).value;
    C.number = +((document.getElementById('f-num') as HTMLInputElement).value) || C.number;
    return render();
  }
  switch (d.act) {
    case 'new':
      if (G && !G.retired) return confirmNew();
      screen = 'create';
      return render();
    case 'continue':
      screen = 'game';
      render();
      if (G && G.pending) nextPending();
      return;
    case 'home':
      screen = 'home';
      closeSheet();
      return render();
    case 'start': {
      const name = (document.getElementById('f-name') as HTMLInputElement).value.trim() || randomName();
      const number = clamp(+((document.getElementById('f-num') as HTMLInputElement).value) || 10, 1, 99);
      const seed = freshSeed();
      setActiveRng(createRng(seed));
      G = newGame({ ...C, name, number }, seed);
      save();
      screen = 'game';
      tab = 'season';
      render();
      window.scrollTo(0, 0);
      return toast('고교 마지막 시즌이 시작됩니다');
    }
    case 'advance':
      return void advance();
    case 'resume':
      return nextPending();
    case 'retire-ask':
      return showSheet(`<div class="eyebrow">Retirement</div><h2>정말 은퇴하시겠어요?</h2><p class="muted">은퇴하면 이 선수의 커리어는 명예의 전당에 기록되고 더 이상 플레이할 수 없습니다.</p>`,
        [{ label: '은퇴한다', cls: 'btn-primary', fn: doRetire }, { label: '조금 더 뛴다', fn: closeSheet }]);
  }
});
function confirmNew() {
  showSheet(`<div class="eyebrow">New Life</div><h2>새로 시작하시겠습니까?</h2><p class="muted">진행 중인 ${esc(G!.name)} 선수의 커리어는 사라집니다. 명예의 전당에는 은퇴한 선수만 남습니다.</p>`,
    [{ label: '새 커리어 시작', cls: 'btn-primary', fn: () => { G = null; save(); closeSheet(); screen = 'create'; C.name = randomName(); render(); } },
     { label: '취소', fn: closeSheet }]);
}
$modal.addEventListener('click', (e) => {
  if (e.target === $modal && !busyAnim && !(G && G.pending)) closeSheet();
});

// ───────── 구글 OAuth 콜백 (/settings?google=linked|switched|error) ─────────
function handleOAuthReturn() {
  const url = new URL(window.location.href);
  const google = url.searchParams.get('google');
  if (!google) return;
  const reason = url.searchParams.get('reason');
  const msg =
    google === 'linked' ? '구글 계정을 연결했습니다.'
    : google === 'switched' ? '다른 구글 계정으로 전환했습니다.'
    : `구글 로그인에 실패했습니다${reason ? ` (${reason})` : ''}.`;
  toast(msg);
  window.history.replaceState({}, '', '/');
}

export function start() {
  handleOAuthReturn();
  render();
}
