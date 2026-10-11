<script lang="ts">
  import LoginButtons from '../LoginButtons.svelte';
  import { seasonLabel } from '@offside/app-core/seasonName';
  import { needsOwnerLogin } from '@offside/app-core/market';
  // T-10-092 구단주 팀 — 시즌마다 그 시즌에 뛰고 은퇴한 내 선수로 11명을 꾸려(빈 자리는 유스 선수가 채운다) 같은 시즌
  // 다른 구단주의 팀과 겨룬다. 지난 시즌 팀은 보기만 한다. 구단주 화면에서 처음 열 때 불러오는 지연 청크다. 경기 결과는
  // 서버가 정한다(웹은 보여 주기만).
  import { onDestroy, onMount, untrack } from 'svelte';
  import {
    FORMATIONS,
    LINEUP_SIZE,
    MANAGER_NAME_MAX,
    MANAGER_NAME_MIN,
    TEAM_NAME_MAX,
    TEAM_NAME_MIN,
    TEAM_RATING_START,
    YOUTH_NAME,
    YOUTH_OVR,
    presetLayout,
    slotRating,
    teamOvr,
    type AchCategory,
    type FormationId,
    type TeamPosition,
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
  import { localCareerNames } from '@offside/game/hof-store';
  import type { TeamLogo } from '@offside/contracts/team-logo';
  import TeamLogoEditor from './TeamLogoEditor.svelte';
  import { go } from '../nav.js';
  import { MARKET_TOAST, marketName } from '@offside/app-core/market';
  import { toast } from '../helpers.js';
  import { setCardLock } from '@offside/app-core/api/market';
  import { dur } from '../motion.js';
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
  import TeamResult from './TeamResult.svelte';
  import TeamFriends from './TeamFriends.svelte';
  import { friendsUi } from '../friendInvite.svelte.js';
  import { shellText as S } from '@offside/app-core/i18n/ko/shell';
  import { achNudge } from '../achNudge.js';
  import { assignSlot, autoFillSlots, draftLines, isPreseasonLegacy, matchHintOf, slotsSynergy, teamEditableIn, tooManyWildcards, wildcardFullText, wildcardLabel } from '@offside/app-core/teamOwner';
  import { accountCache } from '../account-state.svelte.js';
  import { teamHomeText as L } from '@offside/app-core/i18n/ko/teamHome';
  import { fetchCup, fetchCupMe } from '@offside/app-core/api/cup';
  import CupLineupBand from '../cup/CupLineupBand.svelte';
  import { involves, lockAtOf, lockWhen } from '../cup/cupView.js';
  import { readTeamDraft, teamDraftBase, writeTeamDraft, type TeamDraft } from './teamDraft.js';

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
  // T-11-113 개막 뒤에도 프리시즌 팀은 친선전용으로 고칠 수 있다.
  const editable = $derived(teamEditableIn(season, current));
  const seasonName = $derived(((o) => (o ? seasonLabel(o.id, o.name) : ''))(seasons.find((o) => o.id === season)));

  // 편집 초안 — 저장하기 전까지 이 기기에만 있다.
  let name = $state('');
  let manager = $state('');
  let logo = $state<TeamLogo | null>(null);
  let editingLogo = $state(false);
  let formation = $state<FormationId>('4-3-3');
  let layout = $state<TeamPosition[] | null>(null);
  let slots = $state<(string | null)[]>(Array(LINEUP_SIZE).fill(null));
  let saving = $state(false);
  /** 팀이 있으면 이름 칸은 '이름 바꾸기'를 눌렀을 때만 펼친다. */
  let renaming = $state(false);
  let draftKey = $state<string | null>(null);
  let pendingDraft = $state<TeamDraft | null>(null);
  let restoredDraft = $state(false);
  let loadSequence = 0;
  /** T-11-145 컵에 참가 중이면 편성 화면에 명단 마감 띠(잠겼는지 · 다음 마감 시각). */
  let cupBand = $state<{ locked: boolean; when: string | null } | null>(null);

  let opponents = $state<TeamOpponent[]>([]);
  let oppStatus = $state<LoadStatus>('loading');
  let playing = $state(false);
  let result = $state<TeamMatch | null>(null);
  let resultOrigin = $state<'opponents' | 'history'>('opponents');
  /** 방금 치른 경기(또는 '다시 보기')를 문자중계로 보여 주는 중(T-10-097). */
  let live = $state(false);
  /** T-11-098 오늘 남은 친선전(친선전 결과 화면의 '다시 경기하기'). */
  let friendlyLeft = $state(0);
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

  // 서버에는 비공개 이름이 없다 — 이 기기에서 은퇴한 선수는 이 기기에 남은 이름을 쓴다.
  const localNames = localCareerNames();
  const byId = $derived(new Map(players.map((p) => [p.careerId, p])));
  const nameOf = (p: TeamPlayer) => marketName(p, localNames);
  const eventName = (id: string | null, fallback: string) => (id && localNames.get(id)) || fallback;

  const slotCodes = $derived(layout?.map((p) => p.slot) ?? FORMATIONS[formation]);
  const ratings: (number | null)[] = $derived(
    slotCodes.map((slot, i) => {
      const id = slots[i];
      const p = id ? byId.get(id) : undefined;
      return p ? slotRating(slot, p) : null;
    }),
  );
  const ovr = $derived(teamOvr(ratings));
  // T-11-105 선발 시너지 — 늘 보여 주고, 반영 시즌부터 줄 힘에도 더한다.
  const synergy = $derived(slotsSynergy(layout ?? presetLayout(formation), slots, byId));
  // 공격·중원·수비·골키퍼 힘 — 자리별 실력에 포메이션의 줄 무게를 더한 값(서버 경기 계산과 같은 규칙).
  const lines = $derived(draftLines(slotCodes, ratings, synergy, season));
  const filled = $derived(slots.filter((s) => s !== null).length);
  const dirty = $derived(
    !team ||
      name.trim() !== team.name ||
      manager.trim() !== team.manager ||
      JSON.stringify(logo) !== JSON.stringify(team.logo ?? null) ||
      formation !== team.formation ||
      JSON.stringify(layout) !== JSON.stringify(team.layout ?? null) ||
      slots.some((id, i) => id !== (team?.slots[i]?.careerId ?? null)),
  );
  const between = (v: string, min: number, max: number) => v.trim().length >= min && v.trim().length <= max;
  const nameOk = $derived(
    between(name, TEAM_NAME_MIN, TEAM_NAME_MAX) && between(manager, MANAGER_NAME_MIN, MANAGER_NAME_MAX),
  );
  const cells = $derived(
    slots.map((id, i) => {
      const p = id ? byId.get(id) : undefined;
      return { rating: ratings[i] ?? YOUTH_OVR, name: p ? nameOf(p) : YOUTH_NAME, youth: !p, player: p };
    }),
  );
  const matchHint = $derived(matchHintOf(team, dirty, matchesLeft, season, current));

  const draftValue = () => ({ name, manager, logo, formation, layout, slots });
  function preserveDraft() {
    if (status !== 'ready' || !editable || !draftKey || pendingDraft) return;
    const hasChanges = team ? dirty : !!name || !!logo || !!layout || slots.some(Boolean) || formation !== '4-3-3' || manager !== (lastManager ?? '');
    writeTeamDraft(draftKey, hasChanges ? { base: teamDraftBase(team), value: draftValue() } : null);
  }
  $effect(preserveDraft);
  onDestroy(preserveDraft);

  function restoreDraft(draft: TeamDraft) {
    ({ name, manager, formation, slots } = draft.value);
    logo = draft.value.logo ?? null;
    layout = draft.value.layout ?? null;
    renaming = !!team && (name !== team.name || manager !== team.manager);
    pendingDraft = null;
    restoredDraft = true;
  }
  function discardDraft() {
    if (draftKey) writeTeamDraft(draftKey, null);
    pendingDraft = null;
    restoredDraft = false;
    applyTeam(team);
    renaming = false;
  }

  function applyTeam(t: OwnerTeam | null) {
    team = t;
    name = t?.name ?? '';
    manager = t?.manager || lastManager || '';
    logo = t?.logo ?? null;
    editingLogo = false;
    formation = t?.formation ?? '4-3-3';
    layout = t?.layout?.map((p) => ({ ...p })) ?? null;
    slots = t ? t.slots.map((s) => s.careerId) : Array(LINEUP_SIZE).fill(null);
  }

  /** 컵이 조별·토너먼트 중일 때만 내 참가 상태를 묻는다(그 밖에는 요청 없음). */
  async function loadCupBand(forSeason: number) {
    const c = await fetchCup();
    if (!c.ok || c.data.cup.season !== forSeason || (c.data.phase !== 'group' && c.data.phase !== 'knockout')) {
      cupBand = null;
      return;
    }
    const m = await fetchCupMe();
    if (!m.ok || m.data.entry?.status !== 'active') {
      cupBand = null;
      return;
    }
    const next = m.data.next;
    const at = next && involves(next, m.data.entry.teamId) ? lockAtOf(c.data.cup, next.round) : null;
    cupBand = { locked: m.data.locked, when: at ? lockWhen(at, Date.now()) : null };
  }

  async function load(want?: number) {
    preserveDraft();
    const sequence = ++loadSequence;
    status = 'loading';
    const r = await fetchOwnerTeam(want);
    if (sequence !== loadSequence) return;
    if (!r.ok) {
      needLogin = needsOwnerLogin(r.error);
      status = needLogin ? 'ready' : 'error';
      return;
    }
    ({ season, current, seasons, lastManager, players, matchesLeft } = r.data);
    perDay = r.data.matchesPerDay;
    needLogin = false;
    applyTeam(r.data.team);
    const account = accountCache.value;
    draftKey = team?.id ?? (account && account !== 'error' ? `${account.id}:${season}` : null);
    pendingDraft = null;
    restoredDraft = false;
    const draft = editable && draftKey ? readTeamDraft(draftKey) : null;
    if (draft) {
      if (draft.base === teamDraftBase(team)) restoreDraft(draft);
      else pendingDraft = draft;
    }
    status = 'ready';
    void loadCupBand(season);
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
  // T-11-182 은퇴 기록이 아직 서버에 없으면 알리고, 올라가면 라커룸 선수 목록만 다시 받는다(편집 중인 팀은 그대로).
  let retireSyncing = $state(false);
  async function refreshPlayers() {
    if (status !== 'ready' || needLogin || !editable) return;
    const sequence = loadSequence;
    const r = await fetchOwnerTeam(season);
    if (sequence === loadSequence && r.ok) players = r.data.players;
  }
  onMount(() => {
    void load();
    let off: (() => void) | undefined;
    let gone = false;
    void import('../../sync/outbox.js').then((outbox) => {
      retireSyncing = outbox.pendingRetirementIds().size > 0;
      if (gone) return;
      off = outbox.onRetirementSynced(() => {
        retireSyncing = outbox.pendingRetirementIds().size > 0;
        void refreshPlayers();
      });
    });
    return () => {
      gone = true;
      off?.();
    };
  });

  // ───────── 편성 ─────────
  /** 라커룸에서 넣거나, 이미 선발인 선수의 두 자리를 바꾼다. T-11-114 지난 시즌 선수는 와일드카드 상한까지만. */
  function assign(index: number, id: string | null) {
    const next = assignSlot(slots, index, id);
    if (tooManyWildcards(next, byId, season)) return toast(wildcardFullText());
    slots = next;
  }

  /** 자리마다 가장 잘 맞는 선수부터 채운다(유스 선수보다 나을 때만). */
  function autoFill() {
    slots = autoFillSlots(slotCodes, players, season);
  }

  async function save(): Promise<boolean> {
    if (saving || !nameOk || !editable || pendingDraft) return false;
    const key = draftKey;
    const sequence = loadSequence;
    const submitted = JSON.parse(JSON.stringify(draftValue())) as ReturnType<typeof draftValue>;
    saving = true;
    const r = await saveOwnerTeam({
      ...submitted, name: submitted.name.trim(), manager: submitted.manager.trim(),
      ...(isPreseasonLegacy(season, current) ? { season: 0 } : {}),
    });
    saving = false;
    if (!r.ok) {
      toast(r.error.message);
      if (r.error.code === 'CUP_LINEUP_LOCKED') void loadCupBand(season);
      return false;
    }
    if (sequence !== loadSequence) { if (key) writeTeamDraft(key, null); return false; }
    const created = !team;
    const unchanged = JSON.stringify(submitted) === JSON.stringify(draftValue());
    if (!unchanged) {
      team = r.data.team;
      preserveDraft();
      toast(L.savedPartial);
      return false;
    }
    if (key) writeTeamDraft(key, null);
    applyTeam(r.data.team);
    draftKey = r.data.team.id;
    pendingDraft = null;
    restoredDraft = false;
    renaming = false;
    toast(created ? L.toastCreated : L.toastSavedWeb);
    return true;
  }

  async function saveAndFindOpponents() {
    if (!await save()) return;
    if (appState.screen === 'team' && view === 'opponents' && !matchHint) await loadOpponents();
  }

  // ───────── 경기 ─────────
  // T-11-188 선수 잠금 — 잠긴 선수는 이적시장에 내놓거나 방출할 수 없다.
  async function toggleLock(p: TeamPlayer) {
    const r = await setCardLock(p.careerId, !p.locked);
    if (!r.ok) return toast(r.error.message);
    players = players.map((x) => (x.careerId === p.careerId ? { ...x, locked: r.data.locked } : x));
    toast(r.data.locked ? MARKET_TOAST.locked : MARKET_TOAST.unlocked);
  }

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
    resultOrigin = 'opponents';
    live = true;
    matchesLeft = r.data.matchesLeft;
    if (team) {
      team.record = r.data.record;
      team.rating = r.data.rating;
    }
    show('result');
    window.scrollTo(0, 0);
  }

  // T-11-098 친선전 결과(방금 치른 경기는 중계부터, 최근 친선전은 결과부터). 결과에서 돌아가면 '경기' 탭의 친구 쪽이다.
  function openFriendly(m: TeamMatch, left: number, fresh: boolean) {
    result = m;
    resultOrigin = 'opponents';
    live = fresh;
    friendlyLeft = left;
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
    opponents: () => (matchHint || friendsUi.mode === 'friends' ? undefined : loadOpponents()),
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
  const navOn = $derived(view === 'result' ? resultOrigin : view);
  /** 탭을 바꾸면 맨 위에서 시작하고, 보고 있는 탭을 다시 누르면 맨 위로 부드럽게 올린다(게임 화면 탭과 같다). */
  function switchView(v: TeamView) {
    if (view === v) return window.scrollTo({ top: 0, behavior: dur(1) ? 'smooth' : 'instant' });
    show(v);
    window.scrollTo({ top: 0, behavior: 'instant' });
  }
</script>

<div class="wrap" class:has-tabbar={!needLogin}>
  <Topbar />

  <LoadState {status} failText={L.loadFail} retry={load}>
    {#if needLogin}
      <section class="card stack" style="gap:10px">
        <div class="eyebrow">My team</div>
        <h1>{L.myTeam}</h1>
        <p class="muted">{L.loginOnly}</p>
        <LoginButtons back={null} />
      </section>
    {:else if view === 'achievements'}
      <TeamAchievements {ach} status={achStatus} newIds={achNewIds} bind:cat={achCat} load={(s) => void loadAchievements(s)} onrank={openAchRanking} />
    {:else if view === 'team'}
      {#if pendingDraft}
        <section class="card draft-notice" role="status">
          <p>{L.draftChangedWeb}</p>
          <div><button class="btn btn-sm" onclick={() => pendingDraft && restoreDraft(pendingDraft)} data-act="team-draft-restore">{L.draftLoadWeb}</button><button class="btn btn-sm" onclick={discardDraft}>{L.draftKeep}</button></div>
        </section>
      {:else if restoredDraft && dirty}
        <section class="card draft-notice" role="status"><p>{L.draftRestoredWeb}</p><button class="btn btn-sm" onclick={discardDraft} data-act="team-draft-discard">{L.draftDiscardWeb}</button></section>
      {/if}
      {#if cupBand && editable && (cupBand.locked || cupBand.when)}<CupLineupBand locked={cupBand.locked} when={cupBand.when} />{/if}
      <TeamHead
        {team}
        {logo}
        onlogo={() => (editingLogo = true)}
        {seasonName}
        {editable}
        {dirty}
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
      />
      {#if retireSyncing && editable}<p class="muted fs-sm" data-retire-syncing>{L.retireSyncing}</p>{/if}
      {#if editingLogo && editable}<TeamLogoEditor {logo} name={name.trim() || L.myTeam} onapply={(value) => { logo = value; editingLogo = false; }} onclose={() => (editingLogo = false)} />{/if}
      <TeamLineup
        {team}
        teamLogo={logo}
        teamName={name.trim()}
        managerName={manager.trim()}
        {editable}
        wildcards={wildcardLabel(slots, byId, season)}
        bind:formation
        bind:layout
        {slots}
        {nameOf}
        {lines}
        {synergy}
        {season}
        {cells}
        {players}
        {seasonName}
        {filled}
        {saving}
        nameOk={nameOk && !pendingDraft}
        {dirty}
        onassign={assign}
        onauto={autoFill}
        onsave={save}
        onlock={toggleLock}
      />
    {:else if view === 'opponents'}
      <div class="seg two tm-mode" role="group" aria-label={L.matchKindLabel}>
        <button class="hof-sort" aria-pressed={friendsUi.mode === 'ranked'} data-match-mode="ranked" onclick={() => { if (friendsUi.mode === 'ranked') return; friendsUi.mode = 'ranked'; if (!matchHint && oppStatus !== 'ready') void loadOpponents(); }}>{L.modeRanked}</button>
        <button class="hof-sort" aria-pressed={friendsUi.mode === 'friends'} data-match-mode="friends" onclick={() => (friendsUi.mode = 'friends')}>{L.modeFriends}{#if appState.friendReq}<span class="btn-dot" data-friend-dot><span class="sr-only">{S.friendReq({ n: appState.friendReq })}</span></span>{/if}</button>
      </div>
      {#if friendsUi.mode === 'friends'}
        <TeamFriends onplayed={(m, left) => openFriendly(m, left, true)} onopen={(m, left) => openFriendly(m, left, false)} onpreseason={() => pickSeason(0)} />
      {:else}
      <TeamOpponents
        rating={team?.rating ?? TEAM_RATING_START}
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
        onsave={season === current && dirty && filled > 0 && matchesLeft > 0 ? () => void saveAndFindOpponents() : undefined}
        {saving}
        saveDisabled={!nameOk || !!pendingDraft}
      />
      {/if}
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
          matchesLeft={result.friendly ? friendlyLeft : matchesLeft}
          ontoTeam={() => switchView('team')}
          onreplay={() => (live = true)}
          onagain={() => open('opponents')}
          onhistory={resultOrigin === 'history' ? () => switchView('history') : undefined}
        />
      {/if}
    {:else if view === 'history'}
      <TeamHistory
        {history}
        status={histStatus}
        onreload={() => void loadHistory()}
        onopen={(m) => { result = m; resultOrigin = 'history'; live = false; switchView('result'); }}
      />
    {/if}
  </LoadState>
  {#if needLogin}<BackBar act="team-back" fallback={() => (appState.screen = 'owner')} />{/if}
</div>

{#if !needLogin}
  <TeamNav {navOn} onswitch={switchView} />
{/if}

<style>
  .tm-mode { margin-bottom: 12px; }
  .draft-notice {display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:10px;padding:12px 16px;}
  .draft-notice p {margin:0;font-size:13px;flex:1 1 200px;}
  .draft-notice > div {display:flex;flex-wrap:wrap;gap:8px;}
  .draft-notice .btn {min-height:44px;}
</style>
