<script lang="ts">
  // T-10-092 구단주 팀 — 시즌마다 그 시즌에 뛰고 은퇴한 내 선수로 11명을 꾸려(빈 자리는 유스 선수가 채운다) 같은 시즌
  // 다른 구단주의 팀과 겨룬다. 지난 시즌 팀은 보기만 한다. 구단주 화면에서 처음 열 때 불러오는 지연 청크다. 경기 결과는
  // 서버가 정한다(웹은 보여 주기만).
  import { onMount, untrack } from 'svelte';
  import {
    DETAIL_LABEL,
    FORMATION_IDS,
    FORMATIONS,
    LINEUP_SIZE,
    MANAGER_NAME_MAX,
    MANAGER_NAME_MIN,
    TEAM_NAME_MAX,
    TEAM_NAME_MIN,
    TEAM_REPEAT_WINDOW_DAYS,
    YOUTH_NAME,
    YOUTH_OVR,
    lineStrength,
    slotRating,
    teamOvr,
    type FormationId,
  } from '@offside/contracts/owner-team';
  import {
    fetchClubAchievements,
    fetchOpponents,
    fetchOwnerTeam,
    fetchTeamMatches,
    playMatch,
    saveOwnerTeam,
    type ClubAchievementsResponse,
    type OwnerTeam,
    type OwnerTeamResponse,
    type TeamMatch,
    type TeamOpponent,
    type TeamPlayer,
  } from '@offside/app-core/api/team';
  import { localCareerNames } from '@offside/game/season';
  import { kstMonthDayTime } from '@offside/app-core/boardText';
  import { go } from '../nav.js';
  import { POS_LABEL, anonName } from '@offside/game/pos-label';
  import { toast } from '../helpers.js';
  import { lockScroll } from '../scrollLock.js';
  import { doneOnEnter } from '../inputDone.js';
  import { startGoogleLogin } from '../login.js';
  import LoadState, { type LoadStatus } from '../LoadState.svelte';
  import { appState, hofStart, type TeamView } from '../state.svelte.js';
  import Topbar from '../Topbar.svelte';
  import BackBar from '../BackBar.svelte';
  import TeamLines from './TeamLines.svelte';
  import TeamLive from './TeamLive.svelte';
  import TeamPitch from './TeamPitch.svelte';
  import { num, recordText, signedNum } from '@offside/app-core/teamText';
  import {
    OUTCOME_TITLE, PICK_SORTS, achDone, achState, assignSlot, attrLine, autoFillSlots, outcomeOf as outcome,
    pct, pickCandidates, playHintOf, type PickSort,
  } from '@offside/app-core/teamOwner';

  let status = $state<LoadStatus>('loading');
  let needLogin = $state(false);
  let team = $state<OwnerTeam | null>(null);
  let players = $state<TeamPlayer[]>([]);
  let matchesLeft = $state(0);
  let perDay = $state(0);
  /** 보고 있는 시즌 · 지금 고치고 겨루는 시즌(휴식기면 null) · 고를 수 있는 시즌. */
  let season = $state(0);
  let current = $state<number | null>(null);
  let seasons = $state<OwnerTeamResponse['seasons']>([]);
  let lastManager = $state<string | null>(null);
  const editable = $derived(season === current);
  const seasonName = $derived(seasons.find((o) => o.id === season)?.name ?? '');

  // 편집 초안 — 저장하기 전까지 이 기기에만 있다.
  let name = $state('');
  let manager = $state('');
  let formation = $state<FormationId>('4-3-3');
  let slots = $state<(string | null)[]>(Array(LINEUP_SIZE).fill(null));
  let saving = $state(false);
  let picking = $state<number | null>(null);

  let opponents = $state<TeamOpponent[]>([]);
  let oppStatus = $state<LoadStatus>('loading');
  let playing = $state(false);
  let result = $state<TeamMatch | null>(null);
  /** 방금 치른 경기(또는 '다시 보기')를 문자중계로 보여 주는 중(T-10-097). */
  let live = $state(false);
  // T-10-130 팀 안의 화면은 appState.teamView — 뒤로 가기로 오간다. 결과는 이 화면에만 있어 다시 들어왔을 때(앞으로 가기)
  // 없으면 팀을 보여 준다.
  const view = $derived(appState.teamView === 'result' && !result ? 'team' : appState.teamView);
  const show = (v: TeamView) => (appState.teamView = v);
  let history = $state<TeamMatch[]>([]);
  let histStatus = $state<LoadStatus>('loading');
  let ach = $state<ClubAchievementsResponse | null>(null);
  let achStatus = $state<LoadStatus>('loading');
  /** 선수 고르기 정렬 — 그 자리 실력 · 레전드 점수 · 최고 OVR. */
  let pickSort = $state<PickSort>('fit');

  // 서버에는 비공개 이름이 없다 — 이 기기에서 은퇴한 선수는 이 기기에 남은 이름을 쓴다.
  const localNames = localCareerNames();
  const byId = $derived(new Map(players.map((p) => [p.careerId, p])));
  const nameOf = (p: TeamPlayer) =>
    localNames.get(p.careerId) ?? p.publicName ?? anonName(p.pos, p.number);
  const eventName = (id: string | null, fallback: string) => (id && localNames.get(id)) || fallback;

  const slotCodes = $derived(FORMATIONS[formation]);
  const ratings: (number | null)[] = $derived(
    slotCodes.map((slot, i) => {
      const id = slots[i];
      const p = id ? byId.get(id) : undefined;
      return p ? slotRating(slot, p) : null;
    }),
  );
  const ovr = $derived(teamOvr(ratings));
  // 공격·중원·수비·골키퍼 힘 — 자리별 실력에 포메이션의 줄 무게를 더한 값(서버 경기 계산과 같은 규칙).
  const lines = $derived(lineStrength(slotCodes, ratings));
  const filled = $derived(slots.filter((s) => s !== null).length);
  const dirty = $derived(
    !team ||
      name.trim() !== team.name ||
      manager.trim() !== team.manager ||
      formation !== team.formation ||
      slots.some((id, i) => id !== (team?.slots[i]?.careerId ?? null)),
  );
  const between = (v: string, min: number, max: number) => v.trim().length >= min && v.trim().length <= max;
  const nameOk = $derived(
    between(name, TEAM_NAME_MIN, TEAM_NAME_MAX) && between(manager, MANAGER_NAME_MIN, MANAGER_NAME_MAX),
  );
  const cells = $derived(
    slots.map((id, i) => {
      const p = id ? byId.get(id) : undefined;
      return { rating: ratings[i] ?? YOUTH_OVR, name: p ? nameOf(p) : YOUTH_NAME, youth: !p };
    }),
  );
  const playHint = $derived(playHintOf(team, dirty, matchesLeft));

  function applyTeam(t: OwnerTeam | null) {
    team = t;
    name = t?.name ?? '';
    manager = t?.manager || lastManager || '';
    formation = t?.formation ?? '4-3-3';
    slots = t ? t.slots.map((s) => s.careerId) : Array(LINEUP_SIZE).fill(null);
  }

  async function load(want?: number) {
    status = 'loading';
    const r = await fetchOwnerTeam(want);
    if (!r.ok) {
      needLogin = r.error.reason === 'GOOGLE_LOGIN_REQUIRED' || r.error.code === 'PROFILE_REQUIRED';
      status = needLogin ? 'ready' : 'error';
      return;
    }
    ({ season, current, seasons, lastManager, players, matchesLeft } = r.data);
    perDay = r.data.matchesPerDay;
    applyTeam(r.data.team);
    status = 'ready';
  }
  /** 시즌을 바꿔 본다(지난 시즌 팀은 보기만). */
  function pickSeason(id: number) {
    show('team');
    void load(id);
  }
  /** 기록실 라이브 랭킹에서 팀 프로필을 연다(id 없으면 랭킹 목록). */
  function openRanking(id: string | null = null) {
    appState.hof = { ...hofStart(), tab: 'teams', team: id };
    go('hof');
  }
  onMount(() => void load());

  // ───────── 편성 ─────────
  const candidates = $derived(
    picking === null ? [] : pickCandidates(slotCodes, picking, players, slots, pickSort),
  );

  /** 고른 자리에 선수를 넣는다. 이미 다른 자리에 있던 선수면 두 자리를 맞바꾼다. */
  function assign(id: string | null) {
    if (picking === null) return;
    slots = assignSlot(slots, picking, id);
    picking = null;
  }

  /** 자리마다 가장 잘 맞는 선수부터 채운다(유스 선수보다 나을 때만). */
  function autoFill() {
    slots = autoFillSlots(slotCodes, players);
  }

  async function save() {
    if (saving || !nameOk) return;
    saving = true;
    const r = await saveOwnerTeam({
      name: name.trim(),
      manager: manager.trim(),
      formation,
      slots,
    });
    saving = false;
    if (!r.ok) return toast(r.error.message);
    const created = !team;
    applyTeam(r.data.team);
    toast(created ? '팀을 만들었어요' : '편성을 저장했어요');
  }

  // ───────── 경기 ─────────
  async function loadOpponents() {
    oppStatus = 'loading';
    const r = await fetchOpponents();
    if (!r.ok) {
      oppStatus = 'error';
      return;
    }
    opponents = r.data.items;
    oppStatus = 'ready';
  }

  async function challenge(o: TeamOpponent) {
    if (playing) return;
    playing = true;
    const r = await playMatch(o.teamId);
    playing = false;
    if (!r.ok) {
      if (r.error.reason === 'TEAM_MATCH_DAILY_LIMIT') matchesLeft = 0;
      if (r.error.reason === 'TEAM_OPPONENT_DAILY_LIMIT')
        opponents = opponents.filter((x) => x.teamId !== o.teamId);
      return toast(r.error.message);
    }
    result = r.data.match;
    live = true;
    matchesLeft = r.data.matchesLeft;
    if (team) {
      team.record = r.data.record;
      team.rating = r.data.rating;
    }
    show('result');
    window.scrollTo(0, 0);
  }

  // ───────── 시즌 업적 ─────────
  async function loadAchievements(want = season) {
    achStatus = 'loading';
    const r = await fetchClubAchievements(want);
    if (!r.ok) {
      achStatus = 'error';
      return;
    }
    ach = r.data;
    achStatus = 'ready';
  }

  async function loadHistory() {
    histStatus = 'loading';
    const r = await fetchTeamMatches(season);
    if (!r.ok) {
      histStatus = 'error';
      return;
    }
    history = r.data.items;
    histStatus = 'ready';
  }

  // 화면마다 불러올 내용. 다른 화면에서 들어오면(뒤로·앞으로 가기 포함) 아래 $effect가, 이미 그 화면이면 open이 다시 불러온다.
  const LOAD = {
    opponents: loadOpponents,
    achievements: () => loadAchievements(),
    history: loadHistory,
  };
  function open(v: keyof typeof LOAD) {
    if (appState.teamView === v) void LOAD[v]();
    else show(v);
  }
  $effect(() => {
    const v = appState.teamView;
    if (status !== 'ready' || needLogin) return;
    if (v in LOAD) untrack(() => void LOAD[v as keyof typeof LOAD]());
  });
  /** 이전 기록이 없을 때 '← 이전으로'가 갈 곳. */
  function back() {
    if (view === 'team' || view === 'achievements') appState.screen = 'owner';
    else show('team');
  }
  // T-10-117 선수 고르기 시트가 열린 동안 뒤 페이지 스크롤을 잠근다(스크롤 위치는 그대로).
  $effect(() => {
    if (picking === null) return;
    return lockScroll();
  });
  function onKey(e: KeyboardEvent) {
    if (e.key === 'Escape' && picking !== null) picking = null;
  }
</script>

<svelte:window onkeydown={onKey} />

<div class="wrap">
  <Topbar />

  <LoadState {status} failText="팀을 불러오지 못했어요." retry={load}>
    {#if needLogin}
      <section class="card stack" style="gap:10px">
        <div class="eyebrow">My team</div>
        <h1>내 팀</h1>
        <p class="muted">구글로 로그인한 구단주만 은퇴한 선수로 팀을 꾸릴 수 있어요.</p>
        <button class="btn btn-primary self-start" onclick={() => void startGoogleLogin(null)}>구글로 로그인</button>
      </section>
    {:else if view === 'team' || view === 'achievements'}
      <div class="seg two tm-tabs" role="group" aria-label="내 팀 메뉴">
        <button class="opt" aria-pressed={view === 'team'} onclick={() => show('team')} data-act="team-tab">팀</button>
        <button class="opt" aria-pressed={view === 'achievements'} onclick={() => open('achievements')} data-act="team-achievements">시즌 업적</button>
      </div>
      {#if view === 'achievements'}
        <section class="card stack" style="gap:12px" data-club-achievements>
          <div class="tm-title">
            <div>
              <div class="eyebrow">Season achievements</div>
              <h1>시즌 업적</h1>
            </div>
            {#if ach && ach.seasons.length > 1}
              <select class="tm-season" aria-label="시즌" value={ach.season} onchange={(e) => void loadAchievements(Number(e.currentTarget.value))}>
                {#each ach.seasons as o (o.id)}
                  <option value={o.id}>{o.name}</option>
                {/each}
              </select>
            {/if}
          </div>
          <LoadState status={achStatus} failText="업적을 불러오지 못했어요." retry={() => void loadAchievements(ach?.season)}>
            {#if ach}
              <p class="muted fs-sm">{ach.seasons.find((o) => o.id === ach?.season)?.name ?? ''}에 처음 뛰어 은퇴한 내 선수 {ach.players}명의 기록으로 채워요.</p>
              {#each ach.groups as g (g.id)}
                {#if g.locked}
                  <div class="tm-ach tm-ach-locked" data-ach-group={g.id}>
                    <span class="tm-ach-stage">{g.stage}</span>
                    <b>LOCKED</b>
                    <small class="muted">아직 발견하지 못했어요</small>
                  </div>
                {:else}
                <details class="tm-ach" data-ach-group={g.id}>
                  <summary>
                    <span class="tm-ach-stage">{g.stage}</span>
                    <b>{g.title}</b>
                    <span class="tm-ach-count">{achDone(g.items)} / {g.items.length}</span>
                  </summary>
                  <ul>
                    {#each g.items as i (i.id)}
                      <li class:done={i.done}><span>{i.label}</span><small>{achState(i)}</small></li>
                    {/each}
                  </ul>
                </details>
                {/if}
              {/each}
            {/if}
          </LoadState>
        </section>
      {:else}
      <section class="card stack tm-head" style="gap:12px">
        <div class="tm-title">
          <div>
            <div class="eyebrow">My team · {seasonName}</div>
            <h1>{team?.name ?? (editable ? '팀 만들기' : '팀 없음')}</h1>
          </div>
          <div class="tm-ovr-badge" aria-label="팀 OVR {ovr}"><small>OVR</small><b>{ovr}</b></div>
        </div>
        {#if seasons.length > 1}
          <select class="tm-season self-start" aria-label="시즌" value={season} onchange={(e) => pickSeason(Number(e.currentTarget.value))} data-team-season>
            {#each seasons as o (o.id)}
              <option value={o.id}>{o.name}{o.id === current ? ' (지금)' : ''}</option>
            {/each}
          </select>
        {/if}
        {#if team}
          <p class="muted tm-record" data-team-record>{recordText(team.record)} · 레이팅 {num(team.rating)}{editable ? ` · 오늘 남은 경기 ${matchesLeft}/${perDay}` : ''}</p>
        {:else if editable}
          <p class="muted">{seasonName}에 뛰고 은퇴한 내 선수로 11명을 꾸려요. 빈 자리는 유스 선수(OVR {YOUTH_OVR})가 채워서, 한 명만 넣어도 경기할 수 있어요. 팀은 시즌마다 새로 꾸려요.</p>
        {:else}
          <p class="muted">{seasonName}에는 팀을 꾸리지 않았어요.</p>
        {/if}
        {#if !editable && team}
          <p class="muted fs-sm" data-team-readonly>지난 시즌 팀이에요 — 보기만 할 수 있어요.</p>
        {/if}
        {#if editable}
          <div class="tm-names">
            <label class="field">
              <span class="lbl">팀 이름</span>
              <input type="text" bind:value={name} minlength={TEAM_NAME_MIN} maxlength={TEAM_NAME_MAX} placeholder="{TEAM_NAME_MIN}~{TEAM_NAME_MAX}자" data-team-name enterkeyhint="done" autocapitalize="off" autocorrect="off" spellcheck="false" use:doneOnEnter />
            </label>
            <label class="field">
              <span class="lbl">감독 이름</span>
              <input type="text" bind:value={manager} minlength={MANAGER_NAME_MIN} maxlength={MANAGER_NAME_MAX} placeholder="{MANAGER_NAME_MIN}~{MANAGER_NAME_MAX}자" data-team-manager enterkeyhint="done" autocapitalize="off" autocorrect="off" spellcheck="false" use:doneOnEnter />
            </label>
          </div>
        {:else if team}
          <p class="muted fs-sm">감독 <b>{team.manager}</b></p>
        {/if}
        {#if editable || team}
        <div class="seg three" role="group" aria-label="포메이션">
          {#each FORMATION_IDS as f (f)}
            <button class="opt tm-form" aria-pressed={formation === f} data-formation={f} disabled={!editable} onclick={() => (formation = f)}>{f}</button>
          {/each}
        </div>
        <TeamLines {lines} />
        {#if editable}<p class="muted fs-sm">포메이션을 바꾸면 공격·중원·수비 무게가 옮겨 가요. 선수는 자리마다 그 자리 능력치로 뛰어요.</p>{/if}
        {/if}
      </section>

      {#if editable || team}
        <TeamPitch {formation} {cells} onpick={editable ? (i) => (picking = i) : undefined} />
      {/if}

      <section class="card stack" style="gap:10px">
        {#if editable}
          {#if players.length === 0}
            <p class="muted">{seasonName}에 뛰고 은퇴한 선수가 아직 없어요. 이번 시즌에 커리어를 끝까지 뛰면 팀에 넣을 수 있어요.</p>
          {:else}
            <p class="muted fs-sm">선수 {filled}명 · 유스 {LINEUP_SIZE - filled}명. 자리를 누르면 선수를 바꿀 수 있어요.</p>
          {/if}
          <div class="tm-actions">
            <button class="btn" onclick={autoFill} disabled={players.length === 0} data-act="team-auto">자동 배치</button>
            <button class="btn btn-primary" onclick={save} disabled={saving || !nameOk || !dirty} data-act="team-save">{team ? '편성 저장' : '팀 만들기'}</button>
          </div>
          <button class="btn btn-accent btn-block" onclick={() => open('opponents')} disabled={!!playHint} data-act="team-play">경기하기</button>
          {#if playHint}<p class="muted fs-sm">{playHint}</p>{/if}
        {/if}
        <div class="tm-links">
          {#if team}
            <button class="icon-btn" onclick={() => openRanking(team?.id ?? null)} data-act="team-profile">팀 프로필 · 순위</button>
            <button class="icon-btn" onclick={() => open('history')} data-act="team-history">최근 경기</button>
          {/if}
          <button class="icon-btn" onclick={() => openRanking()} data-act="team-ranking">라이브 랭킹</button>
        </div>
      </section>
      {/if}
    {:else if view === 'opponents'}
      <section class="card stack" style="gap:12px">
        <div>
          <div class="eyebrow">Match</div>
          <h1>상대 고르기</h1>
          <p class="muted fs-sm">내 팀 OVR {team?.ovr ?? ovr}과 비슷한 팀이에요 · 오늘 남은 경기 {matchesLeft}/{perDay}</p>
          <p class="muted fs-xs">같은 팀에는 하루 한 번 도전할 수 있어요. 최근 {TEAM_REPEAT_WINDOW_DAYS}일 안에 다시 만난 팀이면 레이팅이 덜 움직여요.</p>
        </div>
        <LoadState status={oppStatus} failText="상대를 불러오지 못했어요." retry={loadOpponents}>
          {#each opponents as o (o.teamId)}
            <div class="tm-opp" data-opponent={o.teamId}>
              <div class="tm-opp-info">
                <b>{o.name}</b>
                <span class="muted fs-sm">{o.owner} · {o.formation} · {recordText(o.record)}</span>
              </div>
              <span class="tm-opp-ovr">{o.ovr}</span>
              <button class="btn btn-primary btn-sm" disabled={playing || matchesLeft === 0} onclick={() => void challenge(o)} data-act="team-challenge">도전</button>
            </div>
          {:else}
            <p class="muted">아직 겨룰 팀이 없어요. 다른 구단주가 팀을 꾸리면 여기에 나와요.</p>
          {/each}
          <button class="icon-btn self-start" onclick={() => open('opponents')} disabled={playing}>다른 상대 보기</button>
        </LoadState>
      </section>
    {:else if view === 'result' && result}
      {@const m = result}
      {@const gain = m[m.mine].ratingChange}
      {#if live}
        {#key m.id}
          <TeamLive match={m} name={eventName} onend={() => ((live = false), window.scrollTo(0, 0))} />
        {/key}
      {:else}
      <section class="card stack tm-result" style="gap:14px" data-team-result>
        <div>
          <div class="eyebrow">Full time</div>
          <h1>{OUTCOME_TITLE[outcome(m)]}</h1>
        </div>
        <div class="tm-score">
          <div class="tm-side" class:mine={m.mine === 'home'}>
            <b>{m.home.name}</b><small class="muted">{m.home.owner} · OVR {m.home.ovr}</small>
          </div>
          <div class="tm-goals"><b>{m.home.goals}</b><span aria-hidden="true">:</span><b>{m.away.goals}</b></div>
          <div class="tm-side away" class:mine={m.mine === 'away'}>
            <b>{m.away.name}</b><small class="muted">{m.away.owner} · OVR {m.away.ovr}</small>
          </div>
        </div>
        {#if m.events.length}
          <ol class="tm-events">
            {#each m.events as e, k (k)}
              <li class:away={e.side === 'away'}>
                <span class="tm-min">{e.minute}'</span>
                <span>
                  <b>{eventName(e.scorerId, e.scorer)}</b>
                  {#if e.assist}<small class="muted">도움 {eventName(e.assistId, e.assist)}</small>{/if}
                </span>
              </li>
            {/each}
          </ol>
        {:else}
          <p class="muted">골 없이 비겼어요.</p>
        {/if}
        <p class="muted fs-sm">{kstMonthDayTime(m.createdAt)}{team && m.mine === 'home' ? ` · 내 팀 ${recordText(team.record)}` : ''}</p>
        {#if gain != null}
          <p class="fs-sm" data-rating-change>내 팀 레이팅 <b>{signedNum(gain)}</b></p>
        {/if}
        <div class="tm-actions">
          <button class="btn" onclick={() => show('team')}>내 팀</button>
          <button class="btn" onclick={() => (live = true)} data-act="team-replay">중계 다시 보기</button>
          <button class="btn btn-primary" onclick={() => open('opponents')} disabled={matchesLeft === 0}>다시 경기하기</button>
        </div>
      </section>
      {/if}
    {:else if view === 'history'}
      <section class="card stack" style="gap:12px">
        <div>
          <div class="eyebrow">Matches</div>
          <h1>최근 경기</h1>
        </div>
        <LoadState status={histStatus} failText="경기 기록을 불러오지 못했어요." retry={loadHistory}>
          {#each history as m (m.id)}
            {@const opp = m[m.mine === 'home' ? 'away' : 'home']}
            <button class="tm-hist" onclick={() => ((result = m), (live = false), show('result'))} data-team-match={m.id}>
              <span class="tm-out" data-out={outcome(m)}>{outcome(m)}</span>
              <span class="tm-opp-info">
                <b>{m[m.mine].goals} : {opp.goals} {opp.name}</b>
                <span class="muted fs-sm">{m.mine === 'home' ? '도전' : '도전받음'} · {opp.owner} · {kstMonthDayTime(m.createdAt)}</span>
              </span>
            </button>
          {:else}
            <p class="muted">아직 치른 경기가 없어요.</p>
          {/each}
        </LoadState>
      </section>
    {/if}
  </LoadState>
  <BackBar act="team-back" fallback={back} />
</div>

{#if picking !== null}
  {@const slot = slotCodes[picking]!}
  <button class="tm-scrim" aria-label="닫기" onclick={() => (picking = null)}></button>
  <div class="tm-sheet" role="dialog" aria-modal="true" aria-label="{DETAIL_LABEL[slot]} 자리 선수 고르기">
    <div class="tm-sheet-head">
      <div>
        <div class="eyebrow">{slot}</div>
        <h2>{DETAIL_LABEL[slot]}</h2>
      </div>
      <button class="icon-btn" onclick={() => (picking = null)}>닫기</button>
    </div>
    <div class="seg three tm-sort" role="group" aria-label="정렬">
      {#each PICK_SORTS as [k, label] (k)}
        <button class="opt" aria-pressed={pickSort === k} onclick={() => (pickSort = k)} data-pick-sort={k}>{label}</button>
      {/each}
    </div>
    <div class="tm-list">
      <button class="tm-pick" aria-pressed={slots[picking] === null} onclick={() => assign(null)} data-pick="youth">
        <b class="tm-pick-ovr">{YOUTH_OVR}</b>
        <span class="tm-opp-info"><span>{YOUTH_NAME}</span><small class="muted">자리를 비워 두면 유스 선수가 뛰어요</small></span>
      </button>
      {#each candidates as c (c.p.careerId)}
        <button class="tm-pick" aria-pressed={slots[picking] === c.p.careerId} onclick={() => assign(c.p.careerId)} data-pick={c.p.careerId}>
          <b class="tm-pick-ovr">{c.rating}</b>
          <span class="tm-opp-info">
            <span>{nameOf(c.p)}</span>
            <small class="muted">{c.p.dpos ? DETAIL_LABEL[c.p.dpos] : POS_LABEL[c.p.pos]} · 최고 {c.p.peak} · 적합 {pct(c.fit)}{c.at >= 0 && c.at !== picking ? ` · ${slotCodes[c.at]} 자리에서 바꿈` : ''}</small>
            {#if attrLine(c.p)}<small class="muted tm-attrs">{attrLine(c.p)}</small>{/if}
          </span>
        </button>
      {:else}
        <p class="muted">넣을 수 있는 은퇴 선수가 없어요.</p>
      {/each}
    </div>
  </div>
{/if}

<style>
  .tm-title {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    gap: 12px;
  }
  .tm-title h1 {
    overflow-wrap: anywhere;
  }
  .tm-ovr-badge {
    flex: none;
    display: grid;
    place-items: center;
    min-width: 58px;
    padding: 6px 8px;
    border-radius: 12px;
    background: var(--pitch);
    color: var(--on-pitch);
    line-height: 1.1;
  }
  .tm-ovr-badge small {
    font-family: var(--display);
    font-size: 0.6875rem;
    letter-spacing: 0.12em;
  }
  .tm-ovr-badge b {
    font-family: var(--display);
    font-size: 1.625rem;
    color: var(--pitch-accent);
  }
  .tm-form {
    align-items: center;
    font-family: var(--display);
    font-weight: 700;
    font-size: 1.0625rem;
  }
  .tm-tabs {
    margin-bottom: 12px;
  }
  .tm-season {
    flex: none;
    max-width: 45%;
    min-height: 40px;
    padding: 0 8px;
    border: 1px solid var(--line);
    border-radius: 10px;
    background: var(--surface);
    color: var(--ink);
    font: inherit;
  }
  .tm-ach {
    border: 1px solid var(--line);
    border-radius: 12px;
    background: var(--surface);
  }
  .tm-ach summary {
    display: flex;
    align-items: center;
    gap: 8px;
    min-height: 48px;
    padding: 8px 12px;
    cursor: pointer;
  }
  .tm-ach-stage {
    flex: none;
    padding: 2px 6px;
    border-radius: 6px;
    font-size: 0.6875rem;
    font-weight: 700;
    background: var(--surface-2);
    color: var(--accent-text);
  }
  .tm-ach summary b {
    flex: 1;
    min-width: 0;
  }
  .tm-ach-count {
    flex: none;
    font-family: var(--display);
    font-weight: 700;
    color: var(--accent-text);
  }
  .tm-ach ul {
    list-style: none;
    margin: 0;
    padding: 0 12px 10px;
    display: flex;
    flex-direction: column;
    gap: 6px;
  }
  .tm-ach li {
    display: flex;
    justify-content: space-between;
    align-items: baseline;
    gap: 10px;
    padding: 8px 10px;
    border-radius: 10px;
    background: var(--surface-2);
  }
  .tm-ach li small {
    flex: none;
    color: var(--muted);
    text-align: right;
  }
  .tm-ach li.done small {
    color: var(--accent-text);
    font-weight: 700;
  }
  .tm-ach-locked {
    display: flex;
    align-items: center;
    gap: 8px;
    min-height: 48px;
    padding: 8px 12px;
    border-style: dashed;
    background: var(--surface-2);
    color: var(--muted);
  }
  .tm-ach-locked b {
    flex: 1;
  }
  .tm-names {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 8px;
  }
  .tm-links {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
  }
  .tm-sort {
    margin-bottom: 6px;
  }
  .tm-attrs {
    font-size: 0.6875rem;
  }
  .tm-actions {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 8px;
  }
  .tm-opp,
  .tm-hist,
  .tm-pick {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 10px 0;
    border-top: 1px solid var(--line);
  }
  .tm-hist,
  .tm-pick {
    width: 100%;
    background: none;
    border-inline: 0;
    border-bottom: 0;
    color: inherit;
    font: inherit;
    text-align: left;
    cursor: pointer;
    min-height: 52px;
  }
  .tm-pick[aria-pressed='true'] {
    background: var(--surface-2);
  }
  .tm-opp-info {
    display: flex;
    flex-direction: column;
    gap: 2px;
    flex: 1;
    min-width: 0;
    overflow-wrap: anywhere;
  }
  .tm-opp-ovr,
  .tm-pick-ovr {
    flex: none;
    min-width: 2.2em;
    font-family: var(--display);
    font-size: 1.375rem;
    font-weight: 700;
    text-align: center;
    color: var(--accent-text);
  }
  .tm-out {
    flex: none;
    display: grid;
    place-items: center;
    width: 32px;
    height: 32px;
    border-radius: 10px;
    font-weight: 700;
    background: var(--surface-2);
  }
  .tm-out[data-out='승'] {
    color: var(--good);
  }
  .tm-out[data-out='패'] {
    color: var(--bad);
  }
  .tm-score {
    display: grid;
    grid-template-columns: 1fr auto 1fr;
    align-items: center;
    gap: 10px;
  }
  .tm-side {
    display: flex;
    flex-direction: column;
    gap: 2px;
    min-width: 0;
    overflow-wrap: anywhere;
  }
  .tm-side.away {
    text-align: right;
  }
  .tm-side.mine b {
    color: var(--accent-text);
  }
  .tm-goals {
    display: flex;
    gap: 8px;
    font-family: var(--display);
    font-size: 2.5rem;
    font-weight: 700;
    line-height: 1;
  }
  .tm-events {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: 8px;
  }
  .tm-events li {
    display: flex;
    gap: 10px;
    align-items: baseline;
  }
  .tm-events li.away {
    flex-direction: row-reverse;
    text-align: right;
  }
  .tm-events li > span:last-child {
    display: flex;
    flex-direction: column;
  }
  .tm-min {
    flex: none;
    font-family: var(--display);
    font-weight: 700;
    color: var(--muted);
    min-width: 2.2em;
  }
  .tm-scrim {
    position: fixed;
    inset: 0;
    z-index: 60;
    border: 0;
    padding: 0;
    background: rgba(0, 0, 0, 0.45);
  }
  .tm-sheet {
    position: fixed;
    z-index: 61;
    left: 50%;
    bottom: 0;
    transform: translateX(-50%);
    width: min(100%, 560px);
    max-height: 78vh;
    display: flex;
    flex-direction: column;
    padding: 16px 16px calc(12px + var(--safe-b));
    border-radius: 18px 18px 0 0;
    background: var(--surface);
    color: var(--ink);
    box-shadow: var(--shadow);
  }
  .tm-sheet-head {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    gap: 12px;
    padding-bottom: 8px;
  }
  .tm-list {
    overflow-y: auto;
    overscroll-behavior: contain;
  }
</style>
