<script lang="ts">
  // T-10-092 구단주 팀 — 시즌마다 그 시즌에 뛰고 은퇴한 내 선수로 11명을 꾸려(빈 자리는 유스 선수가 채운다) 같은 시즌
  // 다른 구단주의 팀과 겨룬다. 지난 시즌 팀은 보기만 한다. 구단주 화면에서 처음 열 때 불러오는 지연 청크다. 경기 결과는
  // 서버가 정한다(웹은 보여 주기만).
  import { onMount, untrack } from 'svelte';
  import {
    FORMATIONS,
    LINEUP_SIZE,
    MANAGER_NAME_MAX,
    MANAGER_NAME_MIN,
    TEAM_NAME_MAX,
    TEAM_NAME_MIN,
    YOUTH_NAME,
    YOUTH_OVR,
    lineStrength,
    slotRating,
    teamOvr,
    type AchCategory,
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
  import { go } from '../nav.js';
  import { anonName } from '@offside/game/pos-label';
  import { toast } from '../helpers.js';
  import { dur } from '../motion.js';
  import { lockScroll } from '../scrollLock.js';
  import { startGoogleLogin } from '../login.js';
  import LoadState, { type LoadStatus } from '../LoadState.svelte';
  import { appState, hofStart, type TeamView } from '../state.svelte.js';
  import Topbar from '../Topbar.svelte';
  import BackBar from '../BackBar.svelte';
  import TeamAchievements from './TeamAchievements.svelte';
  import TeamHead from './TeamHead.svelte';
  import TeamHistory from './TeamHistory.svelte';
  import TeamLineup from './TeamLineup.svelte';
  import TeamLive from './TeamLive.svelte';
  import TeamNav from './TeamNav.svelte';
  import TeamOpponents from './TeamOpponents.svelte';
  import TeamPicker from './TeamPicker.svelte';
  import TeamResult from './TeamResult.svelte';
  import { achNudge } from '../achNudge.js';
  import { assignSlot, autoFillSlots, matchHintOf, pickCandidates, type PickSort } from '@offside/app-core/teamOwner';

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
  /** 팀이 있으면 이름 칸은 '이름 바꾸기'를 눌렀을 때만 펼친다. */
  let renaming = $state(false);
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
  /** T-11-028 업적 화면에서 보고 있는 분류(선수·팀·구단주·감독). */
  let achCat = $state<AchCategory>('player');
  /** T-11-034 지난번 업적 탭을 본 뒤 새로 오른 업적(NEW). */
  let achNewIds = $state<ReadonlySet<string>>(new Set());
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
  const matchHint = $derived(matchHintOf(team, dirty, matchesLeft, season, current));

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
    needLogin = false;
    applyTeam(r.data.team);
    status = 'ready';
  }
  /** 시즌을 바꿔 본다(지난 시즌 팀은 보기만). */
  function pickSeason(id: number) {
    show('team');
    void load(id);
  }
  /** T-11-028 기록실 구단주 랭킹. */
  function openAchRanking() {
    appState.hof = { ...hofStart(), tab: 'ach' };
    go('hof');
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
    renaming = false;
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
    // T-11-034 가장 최근 시즌을 열면 본 것으로 적고, 지난번 뒤로 새로 오른 업적에 NEW를 붙여 그 분류·단계를 펼친다.
    const latest = Math.max(r.data.season, ...r.data.seasons.map((o) => o.id));
    achNewIds = r.data.season === latest ? achNudge.viewed(r.data) : new Set();
    const first = r.data.groups.find((g) => g.items.some((i) => achNewIds.has(i.id)));
    if (first) achCat = first.category;
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
    opponents: () => (matchHint ? undefined : loadOpponents()),
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
  const navOn = $derived(view === 'result' ? 'opponents' : view);
  /** 탭을 바꾸면 맨 위에서 시작하고, 보고 있는 탭을 다시 누르면 맨 위로 부드럽게 올린다(게임 화면 탭과 같다). */
  function switchView(v: TeamView) {
    if (view === v) return window.scrollTo({ top: 0, behavior: dur(1) ? 'smooth' : 'instant' });
    show(v);
    window.scrollTo({ top: 0, behavior: 'instant' });
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

<div class="wrap" class:has-tabbar={!needLogin}>
  <Topbar />

  <LoadState {status} failText="팀을 불러오지 못했어요." retry={load}>
    {#if needLogin}
      <section class="card stack" style="gap:10px">
        <div class="eyebrow">My team</div>
        <h1>내 팀</h1>
        <p class="muted">구글로 로그인한 구단주만 은퇴한 선수로 팀을 꾸릴 수 있어요.</p>
        <button class="btn btn-primary self-start" onclick={() => void startGoogleLogin(null)}>구글로 로그인</button>
      </section>
    {:else if view === 'achievements'}
      <TeamAchievements {ach} status={achStatus} newIds={achNewIds} bind:cat={achCat} load={(s) => void loadAchievements(s)} onrank={openAchRanking} />
    {:else if view === 'team'}
      <TeamHead
        {team}
        {seasonName}
        {editable}
        {ovr}
        {matchesLeft}
        {perDay}
        {seasons}
        {season}
        {current}
        bind:name
        bind:manager
        bind:renaming
        onseason={pickSeason}
        onranking={openRanking}
      />
      <TeamLineup
        {team}
        {editable}
        bind:formation
        {lines}
        {cells}
        {players}
        {seasonName}
        {filled}
        {saving}
        {nameOk}
        {dirty}
        onpick={(i) => (picking = i)}
        onauto={autoFill}
        onsave={save}
      />
    {:else if view === 'opponents'}
      <TeamOpponents
        ovr={team?.ovr ?? ovr}
        {matchesLeft}
        {perDay}
        {opponents}
        status={oppStatus}
        {playing}
        hint={matchHint}
        onreload={() => void loadOpponents()}
        onchallenge={(o) => void challenge(o)}
        onmore={() => open('opponents')}
        ontoTeam={editable ? () => switchView('team') : undefined}
      />
    {:else if view === 'result' && result}
      {#if live}
        {#key result.id}
          <TeamLive match={result} name={eventName} onend={() => ((live = false), window.scrollTo(0, 0))} />
        {/key}
      {:else}
        <TeamResult
          m={result}
          {team}
          {eventName}
          {matchesLeft}
          ontoTeam={() => show('team')}
          onreplay={() => (live = true)}
          onagain={() => open('opponents')}
        />
      {/if}
    {:else if view === 'history'}
      <TeamHistory
        {history}
        status={histStatus}
        onreload={() => void loadHistory()}
        onopen={(m) => ((result = m), (live = false), show('result'))}
      />
    {/if}
  </LoadState>
  {#if needLogin}<BackBar act="team-back" fallback={() => (appState.screen = 'owner')} />{/if}
</div>

{#if !needLogin}
  <TeamNav {navOn} onswitch={switchView} />
{/if}

<TeamPicker
  {picking}
  {slotCodes}
  {slots}
  bind:sort={pickSort}
  {candidates}
  {nameOf}
  onassign={assign}
  onclose={() => (picking = null)}
/>
