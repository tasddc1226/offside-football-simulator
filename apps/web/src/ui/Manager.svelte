<script lang="ts">
  // T-11-310 감독 커리어 — 구단주 화면의 '감독 커리어' 카드로 연다. 지금 가진 선수 카드로 감독 커리어를 시작하고(한 번에
  // 하나), 기기에서 시즌을 돌린 뒤 감독 카드로 확정해 우리 팀 감독 칸에 앉힌다. 화면을 열 때 목록을 한 번 받는다(메모 1분).
  import Topbar from './Topbar.svelte';
  import LoginButtons from './LoginButtons.svelte';
  import ManagerLive from './ManagerLive.svelte';
  import Chips from './sheets/Chips.svelte';
  import CountUp from './CountUp.svelte';
  import { buzz } from './motion.js';
  import type { Chip } from './sheetState.svelte.js';
  import type { ManagerCandidate, ManagerCareer, ManagersResponse } from '@offside/contracts';
  import { FORMATION_IDS, type FormationId } from '@offside/contracts/owner-team';
  import type { ManagerStyle } from '@offside/contracts/manager-rules';
  import {
    MANAGER_STYLES,
    acceptOffer,
    answerEvent,
    boardMinimum,
    closeEvents,
    continueAfterResult,
    currentEvent,
    endingDesc,
    endingName,
    leagueName,
    managerEventText,
    managerMatchday,
    managerResult,
    masteryGrade,
    snapshot,
    pickTransfer,
    restSeason,
    setupSeason,
    specialDesc,
    specialName,
    stayAtClub,
    styleDesc,
    styleName,
    targetName,
    targetOptions,
    transferDesc,
    transferName,
    type BoardTarget,
    type ManagerState,
  } from '@offside/game/manager';
  import { tn } from '@offside/game/i18n/names';
  import { POS_LABEL } from '@offside/game/pos-label';
  import { localCareerNames } from '@offside/game/hof-store';
  import {
    abandonManager,
    clearManagerState,
    coachEffectText,
    fetchManagers,
    finishManager,
    loadManagerState,
    managerName,
    masteryUpLine,
    seasonBadges,
    seasonChips,
    statChips,
    saveManagerState,
    setTeamCoach,
    startConfirmLines,
    startManager,
  } from '@offside/app-core/manager';
  import { managerText as M } from '@offside/app-core/i18n/ko/manager';

  const local = localCareerNames();
  let data = $state<ManagersResponse | null>(null);
  let failed = $state(false);
  let loginNeeded = $state(false);
  let busy = $state(false);
  let error = $state<string | null>(null);
  let confirm = $state<ManagerCandidate | null>(null);
  let confirmAbandon = $state(false);
  let st = $state.raw<ManagerState | null>(null);
  // 방금 답한 이벤트(결과 문장을 보여 준 뒤 '다음'으로 넘긴다).
  let answered = $state<string | null>(null);
  // 방금 답한 이벤트가 바꾼 상태(변화 칩).
  let evChips = $state<Chip[]>([]);
  // 경기 중계 중인 시즌 번호(새로 고치면 중계 없이 결산을 바로 보인다).
  let live = $state<number | null>(null);
  let pick = $state<{ formation: FormationId; style: ManagerStyle; target: BoardTarget }>({
    formation: '4-3-3',
    style: 'balance',
    target: 'mid',
  });

  async function load() {
    failed = false;
    const r = await fetchManagers();
    if (!r.ok) {
      loginNeeded = r.error.reason === 'GOOGLE_LOGIN_REQUIRED' || r.error.code === 'PROFILE_REQUIRED';
      failed = !loginNeeded;
      return;
    }
    data = r.data;
    st = r.data.active ? loadManagerState(r.data.active, nameOf(r.data.active)) : null;
    if (st) resetPick(st);
  }
  void load();

  function nameOf(m: Pick<ManagerCareer, 'careerId' | 'publicName' | 'number' | 'origin'>) {
    return managerName({ careerId: m.careerId, publicName: m.publicName, number: m.number, pos: m.origin.pos }, local);
  }
  function resetPick(s: ManagerState) {
    pick = { formation: s.formation, style: s.style, target: boardMinimum(s) };
  }
  /**
   * 엔진 함수로 상태를 바꾸고 저장한다. 엔진은 이벤트 · 시즌 객체를 제자리에서 바꾸므로 깊은 사본을 다시 넣어야
   * 파생값(지금 이벤트 등)이 새 객체가 되어 화면이 다시 그려진다.
   */
  function act(fn: (s: ManagerState) => unknown) {
    if (!st) return;
    const next = structuredClone(st);
    fn(next);
    saveManagerState(next);
    if (next.phase === 'setup') resetPick(next);
    st = next;
  }

  async function run<T>(fn: () => Promise<{ ok: true; data: T } | { ok: false; error: { message: string } }>) {
    busy = true;
    error = null;
    const r = await fn();
    busy = false;
    if (!r.ok) error = r.error.message;
    return r.ok;
  }
  async function start(c: ManagerCandidate) {
    if (await run(() => startManager(c.careerId))) {
      confirm = null;
      await load();
    }
  }
  async function abandon() {
    if (!st) return;
    const id = st.id;
    if (await run(() => abandonManager(id))) {
      clearManagerState();
      confirmAbandon = false;
      await load();
    }
  }
  async function finish() {
    const res = st && managerResult(st);
    if (!st || !res) return;
    const id = st.id;
    if (await run(() => finishManager(id, res))) {
      clearManagerState();
      await load();
    }
  }
  async function seat(id: string | null) {
    if (await run(() => setTeamCoach(id))) await load();
  }

  function answer(id: string, i: number) {
    if (!st) return;
    const before = snapshot(st);
    act((s) => {
      answered = id;
      answerEvent(s, i);
    });
    evChips = st ? statChips(before, snapshot(st)) : [];
  }
  function playSeason() {
    act(closeEvents);
    const h = st?.history.at(-1);
    if (h?.clubId) live = h.n;
  }
  function liveDone() {
    live = null;
    const h = st?.history.at(-1);
    if (h && seasonBadges(h).some((b) => !b.bad)) buzz(40);
  }

  const ev = $derived(st && st.phase === 'event' ? currentEvent(st) : null);
  const shownEv = $derived(st && answered ? (st.events.find((e) => e.id === answered) ?? null) : ev);
  const evIndex = $derived(st && shownEv ? st.events.indexOf(shownEv) + 1 : 0);
  const lastSeason = $derived(st?.history.at(-1) ?? null);
  const result = $derived(st && st.phase === 'done' ? managerResult(st) : null);
  const targets = $derived(st && st.phase === 'setup' ? targetOptions(st) : []);
  const minTarget = $derived(st && st.phase === 'setup' ? boardMinimum(st) : null);
  const RANK: Record<string, number> = { S: 3, A: 2, B: 1, C: 0 };
  /** 숙련이 가장 높은 포메이션(효과 미리보기 기준). */
  const bestFormation = (m: { mastery: Record<FormationId, string> }): FormationId =>
    FORMATION_IDS.reduce((a, f) => (RANK[m.mastery[f]!]! > RANK[m.mastery[a]!]! ? f : a));
</script>

<div class="wrap manager" data-manager>
  <Topbar />
  <header class="settings-head">
    <div class="eyebrow">{M.eyebrow}</div>
    <h1>{M.title}</h1>
  </header>

  {#if loginNeeded}
    <section class="card mg-col">
      <p class="muted">{M.loginNeeded}</p>
      <LoginButtons back={null} />
    </section>
  {:else if failed && !data}
    <section class="card mg-col">
      <p class="muted">{M.loadFail}</p>
      <button class="btn self-start" data-act="manager-retry" onclick={() => void load()}>{M.retry}</button>
    </section>
  {:else if !data}
    <section class="card"><p class="muted" aria-live="polite">{M.loading}</p></section>
  {:else if st && data.active}
    <!-- 진행 중 감독 커리어 -->
    <section class="card mg-col" data-manager-play={st.phase}>
      <div class="mg-head">
        <b>{nameOf(data.active)}</b>
        <span class="muted fs-sm">{M.progress({ season: Math.min(st.season + (st.phase === 'done' ? 0 : 1), st.seasonsTotal), total: st.seasonsTotal, age: st.age })}</span>
        <span class="fs-sm">{st.club ? `${tn(st.club.name)} · ${leagueName(st.club.leagueId)}` : M.noClub}</span>
      </div>
      <dl class="mg-stats">
        <div><dt>{M.statFame}</dt><dd>{st.fame}</dd></div>
        <div><dt>{M.statTrust}</dt><dd>{st.trust}</dd></div>
        <div><dt>{M.statMorale}</dt><dd>{st.morale}</dd></div>
        <div><dt>{M.statFans}</dt><dd>{st.fans}</dd></div>
        <div><dt>{M.statControl}</dt><dd>{st.control}</dd></div>
        <div><dt>{M.statAdapt}</dt><dd>{st.adapt}</dd></div>
      </dl>
      <p class="muted fs-sm">{M.record({ w: st.wins, d: st.draws, l: st.losses })} · {M.honors({ titles: st.titles, cups: st.cups, promotions: st.promotions })}</p>
      {#each st.log as line, i (i)}<p class="mg-log">{line}</p>{/each}
    </section>

    {#if st.phase === 'offers'}
      <section class="card mg-col" data-manager-offers>
        <h2>{M.offersHeading}</h2>
        {#if st.offers.length}
          <p class="muted fs-sm">{M.offersLead}</p>
          {#each st.offers as o, i (o.clubId)}
            <div class="mg-row">
              <span class="mg-info"><b>{tn(o.name)}</b><small>{leagueName(o.leagueId)}</small></span>
              <button class="btn btn-sm btn-primary" data-act="manager-accept" onclick={() => act((s) => acceptOffer(s, i))}>{M.accept}</button>
            </div>
          {/each}
          {#if st.club}<button class="btn" data-act="manager-stay" onclick={() => act(stayAtClub)}>{M.stay}</button>{/if}
        {:else}
          <p class="muted fs-sm">{M.restLead}</p>
          <button class="btn" data-act="manager-rest" onclick={() => act(restSeason)}>{M.rest}</button>
        {/if}
      </section>
    {:else if st.phase === 'setup'}
      <section class="card mg-col" data-manager-setup>
        <h2>{M.setupHeading}</h2>
        <h3>{M.formation}</h3>
        <div class="mg-chips" role="radiogroup" aria-label={M.formation}>
          {#each FORMATION_IDS as f (f)}
            <button class="mg-chip" role="radio" aria-checked={pick.formation === f} onclick={() => (pick.formation = f)}>
              {f}<small>{M.mastery({ grade: masteryGrade(st.masteryXp[f]) })}</small>
            </button>
          {/each}
        </div>
        <h3>{M.style}</h3>
        <div class="mg-chips" role="radiogroup" aria-label={M.style}>
          {#each MANAGER_STYLES as k (k)}
            <button class="mg-chip" role="radio" aria-checked={pick.style === k} onclick={() => (pick.style = k)}>{styleName(k)}</button>
          {/each}
        </div>
        <p class="muted fs-sm">{styleDesc(pick.style)}</p>
        <h3>{M.target}</h3>
        <div class="mg-chips" role="radiogroup" aria-label={M.target}>
          {#each targets as t (t)}
            <button class="mg-chip" role="radio" aria-checked={pick.target === t} onclick={() => (pick.target = t)}>
              {targetName(t)}{#if t === minTarget}<small>{M.targetMin}</small>{/if}
            </button>
          {/each}
        </div>
        <p class="muted fs-sm">{M.targetLead}</p>
        <button class="btn btn-primary btn-block" data-act="manager-season" onclick={() => act((s) => setupSeason(s, pick))}>{M.startSeason}</button>
      </section>
    {:else if st.phase === 'transfer'}
      <section class="card mg-col" data-manager-transfer>
        <h2>{M.transferHeading}</h2>
        <p class="muted fs-sm">{M.transferLead}</p>
        {#each st.transfers as t, i (i)}
          <button class="mg-row mg-pick" data-act="manager-transfer" onclick={() => act((s) => pickTransfer(s, i))}>
            <span class="mg-info"><b>{transferName(t.kind)}</b><small>{M.transferSpec({ pos: tn(POS_LABEL[t.pos]), ovr: t.ovr, age: t.age })}</small><small class="muted">{transferDesc(t.kind)}</small></span>
            <span class="tap-go" aria-hidden="true">›</span>
          </button>
        {/each}
        <button class="btn" data-act="manager-skip" onclick={() => act((s) => pickTransfer(s, -1))}>{M.skip}</button>
      </section>
    {:else if st.phase === 'event'}
      <section class="card mg-col" data-manager-event>
        {#if shownEv}
          {@const t = managerEventText(shownEv.id)}
          <span class="eyebrow">{M.eventHeading({ n: evIndex, total: st.events.length })}</span>
          <h2>{t.t}</h2>
          <p>{t.b}</p>
          {#if shownEv.result !== null}
            <p class="mg-result" data-manager-event-result>{shownEv.result}</p>
            <Chips chips={evChips} pop />
            <button class="btn btn-primary btn-block" data-act="manager-next" onclick={() => ((answered = null), (evChips = []))}>{M.next}</button>
          {:else}
            {#each t.choices as c, i (i)}
              <button class="btn btn-block mg-choice" data-act="manager-choice" onclick={() => answer(shownEv.id, i)}>{c}</button>
            {/each}
          {/if}
        {:else}
          <button class="btn btn-primary btn-block" data-act="manager-result" onclick={playSeason}>{M.toResult}</button>
        {/if}
      </section>
    {:else if st.phase === 'result' && lastSeason && live === lastSeason.n && lastSeason.club}
      <ManagerLive n={lastSeason.n} club={tn(lastSeason.club)} matches={managerMatchday(st.id, lastSeason)} ondone={liveDone} />
    {:else if st.phase === 'result' && lastSeason}
      {@const badges = seasonBadges(lastSeason)}
      {@const chips = seasonChips(lastSeason)}
      {@const up = masteryUpLine(lastSeason)}
      <section class="card mg-col" data-manager-result>
        <h2>{M.resultHeading({ n: lastSeason.n })}</h2>
        {#if badges.length}
          <div class="mg-badges" data-manager-badges>
            {#each badges as b, i (b.k)}<span class="mg-trophy" class:bad={b.bad} style="--d:{i * 120}ms">{b.label}</span>{/each}
          </div>
        {/if}
        {#if lastSeason.clubId}<p class="muted fs-sm">{M.record({ w: lastSeason.w, d: lastSeason.d, l: lastSeason.l })}</p>{/if}
        {#each lastSeason.lines as line, i (i)}<p class="mg-log">{line}</p>{/each}
        {#if chips.length || up}
          <div class="mg-change" data-manager-change>
            <h3>{M.seasonChange}</h3>
            <Chips {chips} pop split />
            {#if up}<p class="mg-up">{up}</p>{/if}
          </div>
        {/if}
        <button class="btn btn-primary btn-block" data-act="manager-continue" onclick={() => act(continueAfterResult)}>{M.nextSeason}</button>
      </section>
    {:else if st.phase === 'done' && result}
      <section class="card mg-col" data-manager-done>
        <h2>{M.doneHeading}</h2>
        <div class="tally" data-manager-totals>
          <div><b><CountUp value={result.wins} /></b><span>{M.tallyW}</span></div>
          <div><b><CountUp value={result.titles} /></b><span>{M.badgeTitle}</span></div>
          <div><b><CountUp value={result.cups} /></b><span>{M.badgeCup}</span></div>
          <div><b><CountUp value={result.promotions} /></b><span>{M.badgePromoted}</span></div>
        </div>
        <div class="mg-card">
          <b class="mg-grade mg-grade-pop">{M.grade({ grade: result.grade })}</b>
          <b>{endingName(result.ending)}</b>
          <p class="muted fs-sm">{endingDesc(result.ending)}</p>
          {@render cardBody(result)}
        </div>
        <p class="muted fs-sm">{M.doneLead}</p>
        {#if error}<p class="mg-err" role="alert">{error}</p>{/if}
        <button class="btn btn-primary btn-block" data-act="manager-finish" disabled={busy} onclick={() => void finish()}>{M.finish}</button>
      </section>
    {/if}

    {#if st.history.length}
      <details class="card" data-manager-history>
        <summary class="disc-row">{M.history}<span class="disc-chev" aria-hidden="true"></span></summary>
        <ul class="mg-hist">
          {#each st.history as h (h.n)}
            <li>{h.clubId && h.club ? M.historyRow({ n: h.n, club: tn(h.club), rank: h.rank, teams: h.teams }) : M.historyRest({ n: h.n })}</li>
          {/each}
        </ul>
      </details>
    {/if}
    {#if st.phase !== 'done'}
      <button class="btn mg-abandon" data-act="manager-abandon" onclick={() => ((confirmAbandon = true), (error = null))}>{M.abandon}</button>
    {/if}
  {:else}
    <!-- 시작 · 내 감독 -->
    <section class="card mg-col" data-manager-start>
      <h2>{M.startHeading}</h2>
      <p class="muted fs-sm">{M.startLead}</p>
      {#each data.candidates as c (c.careerId)}
        <div class="mg-row" data-manager-candidate>
          <span class="mg-info">
            <b>{managerName(c, local)}</b>
            <small>{tn(POS_LABEL[c.pos])} · OVR {c.peak}{#if c.inLineup} · {M.inLineup}{/if}{#if c.listed} · {M.listed}{/if}</small>
          </span>
          <button class="btn btn-sm" data-act="manager-pick" onclick={() => ((confirm = c), (error = null))}>{M.pick}</button>
        </div>
      {:else}
        <p class="muted fs-sm" data-manager-empty>{M.noCandidates}</p>
      {/each}
    </section>
  {/if}

  {#if data && !loginNeeded}
    <section class="card mg-col" data-manager-list>
      <h2>{M.myManagers}</h2>
      {#if data.managers.length}<p class="muted fs-sm">{M.effectNote}</p>{/if}
      {#if !data.hasTeam && data.managers.length}<p class="muted fs-sm">{M.needTeam}</p>{/if}
      {#each data.managers as m (m.id)}
        {@const r = m.result!}
        {@const seated = data.coachId === m.careerId}
        <div class="mg-card" data-manager-card={m.careerId}>
          <div class="mg-card-head">
            <b>{nameOf(m)}</b>
            <span class="mg-grade">{M.grade({ grade: r.grade })}</span>
            {#if seated}<span class="mg-badge">{M.coachNow}</span>{/if}
          </div>
          <span class="fs-sm">{endingName(r.ending)} · {M.seasons({ n: r.seasons })} · {M.honors({ titles: r.titles, cups: r.cups, promotions: r.promotions })}</span>
          {@render cardBody(r)}
          {#if data.hasTeam}
            <button class="btn btn-sm self-start {seated ? '' : 'btn-primary'}" data-act={seated ? 'manager-unseat' : 'manager-seat'} disabled={busy} onclick={() => void seat(seated ? null : m.careerId)}>{seated ? M.unseat : M.seat}</button>
          {/if}
        </div>
      {:else}
        <p class="muted fs-sm">{M.noManagers}</p>
      {/each}
      {#if error && !confirm && !confirmAbandon && st?.phase !== 'done'}<p class="mg-err" role="alert">{error}</p>{/if}
    </section>
  {/if}
</div>

{#snippet cardBody(r: { mastery: Record<FormationId, string>; style: ManagerStyle; specials: readonly ('wing' | 'midfield' | 'defense' | 'counter' | 'youth')[] })}
  <div class="mg-chips">
    {#each FORMATION_IDS as f (f)}<span class="mg-chip mg-static">{f}<small>{M.mastery({ grade: r.mastery[f]! })}</small></span>{/each}
  </div>
  <span class="fs-sm">{M.style} {styleName(r.style)} · {M.specials} {r.specials.length ? r.specials.map(specialName).join(' · ') : M.noSpecials}</span>
  {#each r.specials as k (k)}<small class="muted">{specialName(k)}: {specialDesc(k)}</small>{/each}
  {@const f = bestFormation(r)}
  <span class="fs-sm">{M.effect} ({M.effectFor({ formation: f })}) {coachEffectText(r as never, f)}</span>
{/snippet}

{#if confirm}
  <button class="mg-scrim" aria-label={M.cancel} onclick={() => (confirm = null)}></button>
  <div class="mg-sheet" role="dialog" aria-modal="true" aria-label={M.confirmTitle({ name: managerName(confirm, local) })} data-manager-confirm>
    <h2>{M.confirmTitle({ name: managerName(confirm, local) })}</h2>
    <ul class="mg-lines">{#each startConfirmLines(confirm) as line, i (i)}<li>{line}</li>{/each}</ul>
    {#if data?.active}<p class="muted fs-sm">{M.activeOther}</p>{/if}
    {#if error}<p class="mg-err" role="alert">{error}</p>{/if}
    <div class="mg-actions">
      <button class="btn" onclick={() => (confirm = null)}>{M.cancel}</button>
      <button class="btn btn-primary" data-act="manager-start" disabled={busy} onclick={() => confirm && void start(confirm)}>{M.confirmOk}</button>
    </div>
  </div>
{/if}

{#if confirmAbandon}
  <button class="mg-scrim" aria-label={M.cancel} onclick={() => (confirmAbandon = false)}></button>
  <div class="mg-sheet" role="dialog" aria-modal="true" aria-label={M.abandon} data-manager-abandon>
    <h2>{M.abandon}</h2>
    <p>{M.abandonConfirm}</p>
    {#if error}<p class="mg-err" role="alert">{error}</p>{/if}
    <div class="mg-actions">
      <button class="btn" onclick={() => (confirmAbandon = false)}>{M.cancel}</button>
      <button class="btn mg-danger" data-act="manager-abandon-confirm" disabled={busy} onclick={() => void abandon()}>{M.abandonOk}</button>
    </div>
  </div>
{/if}

<style>
  .manager {
    display: flex;
    flex-direction: column;
    gap: 14px;
  }
  .mg-col {
    display: flex;
    flex-direction: column;
    gap: 10px;
  }
  .mg-col h2,
  .mg-col h3,
  .mg-col p {
    margin: 0;
  }
  .mg-col h2 {
    font-size: 1.0625rem;
  }
  .mg-col h3 {
    font-size: 0.8125rem;
    color: var(--muted);
  }
  .mg-head {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }
  .mg-head b {
    font-size: 1.125rem;
  }
  .mg-stats {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 6px;
    margin: 0;
  }
  .mg-stats div {
    padding: 8px 10px;
    border-radius: 10px;
    background: var(--surface-2);
  }
  .mg-stats dt {
    font-size: 0.75rem;
    color: var(--muted);
  }
  .mg-stats dd {
    margin: 0;
    font-weight: 700;
    font-variant-numeric: tabular-nums;
  }
  .mg-log {
    font-size: 0.875rem;
    line-height: 1.5;
  }
  .mg-row {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 10px 12px;
    border: 1px solid var(--line);
    border-radius: 12px;
    background: var(--surface);
    color: var(--ink);
    text-align: left;
    font: inherit;
  }
  .mg-pick {
    cursor: pointer;
    width: 100%;
  }
  .mg-info {
    display: flex;
    flex: 1;
    min-width: 0;
    flex-direction: column;
    gap: 2px;
  }
  .mg-info small {
    font-size: 0.75rem;
  }
  .mg-chips {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
  }
  .mg-chip {
    display: inline-flex;
    flex-direction: column;
    align-items: center;
    min-width: 64px;
    padding: 8px 12px;
    border: 1px solid var(--line);
    border-radius: 10px;
    background: var(--surface);
    color: var(--ink);
    font: inherit;
    font-weight: 600;
    cursor: pointer;
  }
  .mg-chip small {
    font-size: 0.6875rem;
    font-weight: 500;
    color: var(--muted);
  }
  .mg-chip[aria-checked='true'] {
    border-color: var(--accent);
    background: var(--accent-soft, var(--surface-2));
  }
  .mg-static {
    cursor: default;
    min-width: 56px;
    padding: 6px 10px;
  }
  .mg-result {
    padding: 10px 12px;
    border-radius: 10px;
    background: var(--surface-2);
    line-height: 1.5;
  }
  .mg-badges {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
  }
  .mg-trophy {
    padding: 4px 12px;
    border-radius: 999px;
    background: var(--pitch);
    color: var(--on-pitch);
    font-weight: 700;
    font-size: 0.875rem;
    animation: mg-pop 0.42s cubic-bezier(0.2, 1.4, 0.4, 1) var(--d, 0ms) both;
  }
  .mg-trophy.bad {
    background: var(--bad);
    color: #fff;
  }
  .mg-change {
    display: flex;
    flex-direction: column;
    gap: 6px;
    padding-top: 4px;
    border-top: 1px solid var(--line);
  }
  .mg-up {
    font-weight: 700;
    color: var(--accent-text, var(--accent));
  }
  .mg-grade-pop {
    display: inline-block;
    font-size: 1.25rem;
    animation: mg-pop 0.5s cubic-bezier(0.2, 1.4, 0.4, 1) 0.3s both;
  }
  @keyframes mg-pop {
    from {
      transform: scale(0.6);
    }
  }
  @media (prefers-reduced-motion: reduce) {
    .mg-trophy,
    .mg-grade-pop {
      animation: none;
    }
  }
  .mg-choice {
    text-align: left;
    justify-content: flex-start;
  }
  .mg-card {
    display: flex;
    flex-direction: column;
    gap: 6px;
    padding: 12px;
    border: 1px solid var(--line);
    border-radius: 12px;
  }
  .mg-card-head {
    display: flex;
    align-items: center;
    gap: 8px;
  }
  .mg-grade {
    font-weight: 700;
    color: var(--accent-text, var(--accent));
  }
  .mg-badge {
    padding: 2px 8px;
    border-radius: 999px;
    background: var(--surface-2);
    font-size: 0.75rem;
    font-weight: 600;
  }
  .mg-hist {
    margin: 8px 0 0;
    padding-left: 18px;
    font-size: 0.875rem;
    line-height: 1.6;
  }
  .mg-abandon {
    align-self: center;
    color: var(--bad);
  }
  .mg-err {
    color: var(--bad);
    font-weight: 600;
  }
  .mg-scrim {
    position: fixed;
    inset: 0;
    z-index: 60;
    border: 0;
    padding: 0;
    background: rgb(0 0 0 / 0.45);
  }
  .mg-sheet {
    position: fixed;
    z-index: 61;
    left: 50%;
    bottom: 0;
    transform: translateX(-50%);
    width: min(100%, 560px);
    max-height: 92vh;
    overflow-y: auto;
    display: flex;
    flex-direction: column;
    gap: 12px;
    padding: 16px 20px calc(16px + var(--safe-b));
    border-radius: 22px 22px 0 0;
    background: var(--surface);
    color: var(--ink);
    box-shadow: var(--shadow);
  }
  .mg-sheet h2,
  .mg-sheet p {
    margin: 0;
  }
  .mg-sheet h2 {
    font-size: 1.0625rem;
  }
  .mg-lines {
    margin: 0;
    padding-left: 18px;
    font-size: 0.875rem;
    line-height: 1.6;
  }
  .mg-actions {
    display: grid;
    grid-template-columns: 1fr 2fr;
    gap: 8px;
  }
  .mg-actions .btn {
    min-height: 50px;
  }
  .mg-danger {
    border: 0;
    background: var(--bad);
    color: #fff;
  }
</style>
