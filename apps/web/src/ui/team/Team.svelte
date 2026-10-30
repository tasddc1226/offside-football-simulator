<script lang="ts">
  import LoginButtons from '../LoginButtons.svelte';
  import { seasonLabel } from '@offside/app-core/seasonName';
  import { needsOwnerLogin } from '@offside/app-core/market';
  // T-10-092 구단주 팀 — 시즌마다 그 시즌에 뛰고 은퇴한 내 선수로 11명을 꾸려(빈 자리는 유스 선수가 채운다) 같은 시즌
  // 다른 구단주의 팀과 겨룬다. 지난 시즌 팀은 보기만 한다. 구단주 화면에서 처음 열 때 불러오는 지연 청크다. 경기 결과는
  // 서버가 정한다(웹은 보여 주기만).
  import { onDestroy, onMount, untrack } from 'svelte';
  import {
    LINEUP_SIZE,
    MANAGER_NAME_MAX,
    MANAGER_NAME_MIN,
    TEAM_NAME_MAX,
    TEAM_NAME_MIN,
    PAST_SALARY_BUDGET,
    RANK_MATCH_REPICKS,
    TEAM_RATING_START,
    YOUTH_NAME,
    YOUTH_OVR,
    presetLayout,
    positionedLayout,
    slotRating,
    teamOvr,
    usesRankLadder,
    type AchCategory,
    type FormationId,
    type TeamPosition,
  } from '@offside/contracts/owner-team';
  import {
    fetchClubAchievements,
    fetchOpponents,
    fetchOwnerTeam,
    fetchTeamMatches,
    fetchTeamStats,
    playLiveMatch,
    saveOwnerTeam,
    saveTeamPresets,
    type ClubAchievementsResponse,
    type TeamStatsResponse,
    type OwnerTeam,
    type OwnerTeamResponse,
    type PlayTeamMatchResponse,
    type TeamLive as TeamLiveData,
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
  import TeamStats from './TeamStats.svelte';
  import TeamLineup from './TeamLineup.svelte';
  import TeamLive from './TeamLive.svelte';
  import TeamNav from './TeamNav.svelte';
  import TeamOpponents from './TeamOpponents.svelte';
  import TeamResult from './TeamResult.svelte';
  import TeamFriends from './TeamFriends.svelte';
  import TeamPresets from './TeamPresets.svelte';
  import { cupPresetOf, loadPreset, presetOf, type TeamPreset } from '@offside/app-core/teamPresets';
  import { friendsUi } from '../friendInvite.svelte.js';
  import { shellText as S } from '@offside/app-core/i18n/ko/shell';
  import { achNudge } from '../achNudge.js';
  import { fixSlot, slotName } from '@offside/app-core/matchReport';
  import type { ReportLine } from '@offside/contracts/owner-team';
  import { assignSlot, autoFillSlots, draftLines, matchHintOf, slotsSynergy, teamEditableIn, budgetOf, salaryBar, salaryBlocks, salaryFullText, salaryIn } from '@offside/app-core/teamOwner';
  import { teamCoreText as TC } from '@offside/app-core/i18n/ko/teamCore';
  import { accountCache } from '../account-state.svelte.js';
  import { teamHomeText as L } from '@offside/app-core/i18n/ko/teamHome';
  import { managerText as MG } from '@offside/app-core/i18n/ko/manager';
  import { coachBreakdown, coachSummary } from '@offside/app-core/managerCard';
  import { hofOwnText as HO } from '@offside/app-core/i18n/ko/hofOwn';
  import { loadAnonNames, publishAnonNames, type AnonName } from '@offside/app-core/cardNames';
  import { fetchCup, fetchCupMe, type CupMeResponse, type CupResponse } from '@offside/app-core/api/cup';
  import { cupLineupBar } from '@offside/app-core/cupLineupBar';
  import CupLineupBand from '../cup/CupLineupBand.svelte';
  import { involves, lockAtOf, lockWhen } from '../cup/cupView.js';
  import { readTeamDraft, teamDraftBase, writeTeamDraft, type TeamDraft } from './teamDraft.js';
  import { markDivisionSeen, takeDivisionChange, type DivisionShift } from '@offside/app-core/teamDivision';

  let status = $state<LoadStatus>('loading');
  let needLogin = $state(false);
  let team = $state<OwnerTeam | null>(null);
  let players = $state<TeamPlayer[]>([]);
  let matchesLeft = $state(0);
  let perDay = $state(0);
  /** 보고 있는 시즌 · 지금 고치고 겨루는 시즌(휴식기면 null) · 고를 수 있는 시즌. */
  let season = $state(0);
  let current = $state<number | null>(null);
  /** T-11-552 끝나지 않은 컵에 참가 중인 지난 시즌(그 시즌 팀은 컵 명단으로 고친다). */
  let cupSeason = $state<number | null>(null);
  let seasons = $state<OwnerTeamResponse['seasons']>([]);
  let lastManager = $state<string | null>(null);
  // T-11-113 개막 뒤에도 프리시즌 팀은 친선전용으로 고칠 수 있다.
  const editable = $derived(teamEditableIn(season, current, cupSeason));
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
  /** T-11-436 컵 규칙 줄(팀 OVR · 상한, 선발 · 최소 인원)에 쓰는 대회 · 내 참가 응답. 참가 중이거나 접수 중일 때만. */
  let cupRule = $state<{ cup: CupResponse; me: CupMeResponse } | null>(null);
  /** T-11-217 팀 프리셋(서버에 있는 목록)과 시트. */
  let presets = $state<TeamPreset[]>([]);
  let presetsOpen = $state(false);

  let opponents = $state<TeamOpponent[]>([]);
  let oppStatus = $state<LoadStatus>('loading');
  /** T-11-510 시즌 2 자동 매칭에서 이번 경기의 '다른 상대 찾기' 횟수(경기를 치르면 0으로). */
  let oppPick = $state(0);
  const ladder = $derived(usesRankLadder(team?.season ?? 0));
  let playing = $state(false);
  let result = $state<TeamMatch | null>(null);
  /** T-11-375 방금 치른 경기의 내 디비전 전후(결과 창 승격 · 강등), 받은 경기로 바뀐 디비전 알림. */
  let divisionShift = $state<DivisionShift | null>(null);
  let divisionNotice = $state<string | null>(null);
  let resultOrigin = $state<'opponents' | 'history'>('opponents');
  /** 방금 치른 경기(또는 '다시 보기')를 문자중계로 보여 주는 중(T-10-097). */
  let live = $state(false);
  /** T-11-387 방금 시작한 장면 경기의 고를 장면(중계가 끝나면 비운다). */
  let liveMoments = $state<TeamLiveData | undefined>();
  /** T-11-098 오늘 남은 친선전(친선전 결과 화면의 '다시 경기하기'). */
  let friendlyLeft = $state(0);
  // T-10-130 팀 안의 화면은 appState.teamView — 뒤로 가기로 오간다. 결과는 이 화면에만 있어 다시 들어왔을 때(앞으로 가기)
  // 없으면 팀을 보여 준다.
  const view = $derived(appState.teamView === 'result' && !result ? 'team' : appState.teamView);
  const show = (v: TeamView) => (appState.teamView = v);
  let history = $state<TeamMatch[]>([]);
  let histStatus = $state<LoadStatus>('loading');
  /** T-11-269 경기 기록 다음 쪽 커서('더 보기'), 시즌 통계와 경기 결과에서 누른 선수. */
  let histNext = $state<string | null>(null);
  let moreStatus = $state<'idle' | 'loading' | 'error'>('idle');
  let stats = $state<TeamStatsResponse | null>(null);
  let statsStatus = $state<LoadStatus>('loading');
  let statsFocus = $state<string | null>(null);
  let ach = $state<ClubAchievementsResponse | null>(null);
  let achStatus = $state<LoadStatus>('loading');
  /** T-11-028 업적 화면에서 보고 있는 분류(선수·팀·구단주·감독). */
  let achCat = $state<AchCategory>('player');
  /** T-11-034 지난번 업적 탭을 본 뒤 새로 오른 업적(NEW). */
  let achNewIds = $state<ReadonlySet<string>>(new Set());

  // 서버에는 비공개 이름이 없다 — 이 기기에서 은퇴한 선수는 이 기기에 남은 이름을 쓴다.
  const localNames = localCareerNames();
  const byId = $derived(new Map(players.map((p) => [p.careerId, p])));
  // T-11-376 지난 시즌 선수 급여 예산(서버가 팀 시즌에 맞춰 계산한 값, 옛 응답이면 기본 80).
  let budget = $state(PAST_SALARY_BUDGET);
  let fatigue = $state<OwnerTeamResponse['fatigue'] | null>(null);
  const salary = $derived(salaryBar(slots, byId, season, budget));
  const nameOf = (p: TeamPlayer) => marketName(p, localNames);
  const eventName = (id: string | null, fallback: string) => (id && localNames.get(id)) || fallback;
  // T-11-266 익명으로 은퇴한 내 선수 중 이 기기가 이름을 아는 카드(이적시장에 팔린 선수 포함) — 한꺼번에 이름을 공개할 수 있다.
  let anonNames = $state<AnonName[]>([]);
  $effect(() => {
    if (editable && status === 'ready' && !needLogin) void loadAnonNames(localNames).then((x) => (anonNames = x));
  });
  let namesStep = $state<'idle' | 'confirm' | 'busy'>('idle');
  async function publishNames() {
    const items = anonNames;
    namesStep = 'busy';
    const n = await publishAnonNames(items);
    namesStep = 'idle';
    if (n === null) return toast(HO.anonCardsFail);
    const named = new Map(items.map((x) => [x.careerId, x.publicName]));
    players = players.map((p) => (named.has(p.careerId) ? { ...p, publicName: named.get(p.careerId)! } : p));
    anonNames = [];
    toast(HO.anonCardsDone({ n }));
  }

  const previewLayout = $derived(editable && season > 0 ? positionedLayout(layout ?? presetLayout(formation)) : layout ?? presetLayout(formation));
  const slotCodes = $derived(previewLayout.map(p => p.slot));
  const ratings: (number | null)[] = $derived(
    slotCodes.map((slot, i) => {
      const id = slots[i];
      const p = id ? byId.get(id) : undefined;
      return p ? slotRating(slot, p) : null;
    }),
  );
  const ovr = $derived(teamOvr(ratings));
  // T-11-105 선발 시너지 — 늘 보여 주고, 반영 시즌부터 줄 힘에도 더한다.
  const synergy = $derived(slotsSynergy(previewLayout, slots, byId, season));
  const coachDetail = $derived(team?.coach ? coachBreakdown(team.coach, formation, synergy, season) : null);
  // 공격·중원·수비·골키퍼 힘 — 자리별 실력에 포메이션의 줄 무게를 더한 값(서버 경기 계산과 같은 규칙).
  const lines = $derived(draftLines(slotCodes, ratings, synergy, season));
  const filled = $derived(slots.filter((s) => s !== null).length);
  // T-11-570 컵 명단 프리셋이 있으면 컵은 그 편성으로 뛴다 — 줄은 프리셋 값을 보이고 팀 저장은 막지 않는다.
  const cupPreset = $derived(cupPresetOf(presets));
  const cupDraft = $derived(cupPreset ? { ovr: cupPreset.ovr ?? 0, filled: cupPreset.filled ?? cupPreset.slots.filter(Boolean).length } : { ovr, filled });
  // T-11-436 서버 저장 검사와 같은 판정. block이 있으면 저장을 막고 이유를 보인다.
  const cupBar = $derived(editable && cupRule ? cupLineupBar(cupRule.cup, cupRule.me, cupDraft, new Date().toISOString()) : null);
  const cupBlock = $derived(cupPreset ? null : (cupBar?.block ?? null));
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
      return { rating: ratings[i] ?? YOUTH_OVR, name: p ? nameOf(p) : YOUTH_NAME, youth: !p, player: p, salary: p ? salaryIn(p, season) : 0 };
    }),
  );
  const matchHint = $derived(matchHintOf(team, dirty, matchesLeft, season, current, cupSeason));

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
    presets = t?.presets ?? [];
  }

  // ───────── 프리셋 (T-11-217) ─────────
  const presetDraft = (presetName: string) => presetOf(presetName, formation, slots, season > 0 ? previewLayout : null);
  async function persistPresets(next: TeamPreset[], saved = false): Promise<boolean> {
    const r = await saveTeamPresets({ presets: next, ...(season !== current ? { season } : {}) });
    if (!r.ok) {
      toast(r.error.message);
      // T-11-570 컵 명단 검사에 걸렸으면 띠를 다시 받는다.
      if (r.error.reason?.startsWith('CUP_')) void loadCupBand(season);
      return false;
    }
    presets = r.data.presets;
    if (team) team = { ...team, presets: r.data.presets };
    if (saved) toast(L.tpSaved);
    return true;
  }
  function applyPreset(p: TeamPreset) {
    const r = loadPreset(p, new Set(players.map((x) => x.careerId)));
    formation = r.formation;
    layout = r.layout;
    slots = r.slots;
    toast(r.missing ? L.tpLoadedMissing({ n: r.missing }) : L.tpLoaded);
  }

  /** 컵이 접수 · 추첨 대기 · 조별 · 토너먼트 중일 때만 내 참가 상태를 묻는다(그 밖에는 요청 없음). */
  async function loadCupBand(forSeason: number) {
    const c = await fetchCup();
    if (!c.ok || c.data.cup.season !== forSeason || !['open', 'closed', 'group', 'knockout'].includes(c.data.phase)) {
      cupBand = null;
      cupRule = null;
      return;
    }
    const m = await fetchCupMe();
    cupRule = m.ok ? { cup: c.data, me: m.data } : null;
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
    cupSeason = r.data.cupSeason ?? null;
    perDay = r.data.matchesPerDay;
    budget = budgetOf(r.data);
    fatigue = r.data.fatigue ?? null;
    needLogin = false;
    applyTeam(r.data.team);
    divisionNotice =
      editable && team && season === current ? (takeDivisionChange(season, team.division)?.text ?? null) : null;
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
  // T-11-301 올리기가 멈춘 것 같을 때 사용자가 바로 다시 보낸다.
  let retireRetry = $state<'idle' | 'busy' | 'failed'>('idle');
  let outboxMod: typeof import('../../sync/outbox.js') | undefined;
  async function retryRetireSync() {
    if (!outboxMod || retireRetry === 'busy') return;
    retireRetry = 'busy';
    await outboxMod.retryOutboxNow();
    retireSyncing = outboxMod.pendingRetirementIds().size > 0;
    retireRetry = retireSyncing ? 'failed' : 'idle';
  }
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
      outboxMod = outbox;
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
  /** 라커룸에서 넣거나, 이미 선발인 선수의 두 자리를 바꾼다. T-11-376 지난 시즌 선수는 급여 예산 안에서만. */
  function assign(index: number, id: string | null) {
    const next = assignSlot(slots, index, id);
    if (salaryBlocks(slots, next, byId, season, budget)) return toast(salaryFullText(next, id, byId, season, budget));
    slots = next;
  }

  /** 자리마다 가장 잘 맞는 선수부터 채운다(유스 선수보다 나을 때만, 급여 예산 안에서). */
  function autoFill() {
    slots = autoFillSlots(slotCodes, players, season, budget);
  }

  async function save(): Promise<boolean> {
    if (saving || !nameOk || !editable || pendingDraft) return false;
    if (salary && salary.state === 'over') { toast(TC.salaryOverSave({ n: salary.sum, max: salary.budget })); return false; }
    if (cupBlock) { toast(cupBlock); return false; }
    const key = draftKey;
    const sequence = loadSequence;
    const submitted = JSON.parse(JSON.stringify(draftValue())) as ReturnType<typeof draftValue>;
    saving = true;
    const r = await saveOwnerTeam({
      ...submitted, name: submitted.name.trim(), manager: submitted.manager.trim(),
      ...(season > 0 ? { layout: previewLayout } : {}),
      ...(season !== current ? { season } : {}),
    });
    saving = false;
    if (!r.ok) {
      toast(r.error.message);
      // 컵 검사에 걸렸으면(잠금 · 상한 · 최소 인원) 띠를 다시 받는다. 서버는 사유를 details.reason에 담는다.
      if (r.error.reason?.startsWith('CUP_')) void loadCupBand(season);
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
    const r = await fetchOpponents(oppPick);
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
    // T-11-387 랭크 경기는 문자중계 도중 장면을 고르는 경기로 시작한다(결과는 중계가 끝날 때 onfinal로 온다).
    const r = await playLiveMatch(o.teamId);
    playing = false;
    if (!r.ok) {
      if (r.error.reason === 'TEAM_MATCH_DAILY_LIMIT') matchesLeft = 0;
      if (r.error.reason === 'TEAM_OPPONENT_DAILY_LIMIT')
        opponents = opponents.filter((x) => x.teamId !== o.teamId);
      // T-11-510 상대 RP가 그새 멀어졌다 — 같은 횟수로 새 상대를 받는다.
      if (r.error.reason === 'TEAM_OPPONENT_STALE') void loadOpponents();
      return toast(r.error.message);
    }
    oppPick = 0;
    result = r.data.match;
    liveMoments = r.data.live;
    resultOrigin = 'opponents';
    live = true;
    matchesLeft = r.data.matchesLeft;
    divisionNotice = null;
    applyPlayed(r.data);
    show('result');
    window.scrollTo(0, 0);
  }

  /** 경기 결과의 기록 · 레이팅을 내 팀에 반영한다(장면 경기는 시작 때 경기 전 값, 끝날 때 결과 값이 온다). */
  function applyPlayed(r: PlayTeamMatchResponse) {
    // T-11-375 승격 · 강등 띠는 마감한 결과에만 온다(장면 경기 시작 응답에는 없다).
    divisionShift = r.division ?? null;
    if (!team) return;
    team.record = r.record;
    team.rating = r.rating;
    if (r.division) {
      team.division = r.division.to;
      markDivisionSeen(season, r.division.to);
    }
  }

  /** 장면 경기가 끝났다 — 결과 화면을 마감한 경기로 바꾼다. */
  function liveFinal(r: PlayTeamMatchResponse) {
    result = r.match;
    liveMoments = undefined;
    matchesLeft = r.matchesLeft;
    applyPlayed(r);
  }

  // T-11-098 친선전 결과(방금 치른 경기는 중계부터, 최근 친선전은 결과부터). 결과에서 돌아가면 '경기' 탭의 친구 쪽이다.
  function openFriendly(m: TeamMatch, left: number, fresh: boolean) {
    result = m;
    divisionShift = null;
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
    histNext = r.data.next ?? null;
    moreStatus = 'idle';
    histStatus = 'ready';
  }
  async function loadMore() {
    if (!histNext || moreStatus === 'loading') return;
    moreStatus = 'loading';
    const cursor = histNext;
    const r = await fetchTeamMatches(season, cursor);
    if (histNext !== cursor) return;
    if (!r.ok) {
      moreStatus = 'error';
      return;
    }
    const seen = new Set(history.map((m) => m.id));
    history = [...history, ...r.data.items.filter((m) => !seen.has(m.id))];
    histNext = r.data.next ?? null;
    moreStatus = 'idle';
  }
  async function loadStats() {
    statsStatus = 'loading';
    const r = await fetchTeamStats(season);
    if (!r.ok) {
      statsStatus = 'error';
      return;
    }
    stats = r.data;
    statsStatus = 'ready';
  }
  function openStats(focus: string | null = null) {
    statsFocus = focus;
    switchView('stats');
  }

  // 화면마다 불러올 내용. 다른 화면에서 들어오면(뒤로·앞으로 가기 포함) 아래 $effect가, 이미 그 화면이면 open이 다시 불러온다.
  const LOAD = {
    opponents: () => (matchHint || friendsUi.mode === 'friends' ? undefined : loadOpponents()),
    achievements: () => loadAchievements(),
    history: loadHistory,
    stats: loadStats,
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
  const navOn = $derived(view === 'result' ? resultOrigin : view === 'stats' ? 'history' : view);
  /** T-11-379 리포트 '고칠 곳'으로 고른 자리 — 편성 화면이 그 자리를 골라 둔 채 열린다. */
  let focusSlot = $state<number | null>(null);
  function reportFix(line: ReportLine): { pos: string; go: () => void } | null {
    if (!editable || season !== current) return null;
    const i = fixSlot(slotCodes, ratings, line, YOUTH_OVR);
    if (i === null) return null;
    return { pos: slotName(slotCodes[i]!), go: () => ((focusSlot = i), switchView('team')) };
  }
  /** 탭을 바꾸면 맨 위에서 시작하고, 보고 있는 탭을 다시 누르면 맨 위로 부드럽게 올린다(게임 화면 탭과 같다). */
  function switchView(v: TeamView) {
    if (view === v) return window.scrollTo({ top: 0, behavior: dur(1) ? 'smooth' : 'instant' });
    show(v);
    window.scrollTo({ top: 0, behavior: 'instant' });
  }
</script>

<!-- T-11-392 팀을 불러오는 동안: 팀 이름 줄 + 4-3-3 자리 점이 찍힌 그라운드(요소 하나의 배경). -->
{#snippet pitchSkeleton()}
  <div class="tm-sk" role="status" aria-busy="true" data-skeleton>
    <span class="sr-only">{S.loading}</span>
    <div class="tm-sk-title"></div>
    <div class="tm-sk-pitch"></div>
  </div>
{/snippet}

<div class="wrap" class:has-tabbar={!needLogin}>
  <Topbar />

  <LoadState {status} failText={L.loadFail} retry={load} skeleton={pitchSkeleton}>
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
      {#if editable && (cupBar || (cupBand && (cupBand.locked || cupBand.when)))}<CupLineupBand locked={!!cupBand?.locked} when={cupBand?.when ?? null} bar={cupBar} preset={cupPreset?.name ?? null} />{/if}
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
        {divisionNotice}
        {cupSeason}
      />
      {#if retireSyncing && editable}
        <div class="row" style="gap:8px;align-items:center;flex-wrap:wrap" data-retire-syncing>
          <p class="muted fs-sm">{retireRetry === 'failed' ? L.retireSyncFailed : L.retireSyncing}</p>
          <button class="btn btn-sm" disabled={retireRetry === 'busy'} onclick={retryRetireSync} data-act="retire-retry">
            {retireRetry === 'busy' ? L.retireSyncRetrying : L.retireSyncRetry}
          </button>
        </div>
      {/if}
      {#if editable && anonNames.length}
        <section class="card anon-names" role="status" data-anon-names>
          <p class="fs-sm">{namesStep === 'idle' ? HO.anonCardsNote({ n: anonNames.length }) : HO.anonCardsConfirm({ n: anonNames.length })}</p>
          <div class="row" style="gap:8px;flex-wrap:wrap">
            {#if namesStep === 'idle'}<button class="btn btn-sm" onclick={() => (namesStep = 'confirm')} data-act="anon-names">{HO.anonCardsBtn}</button>
            {:else}<button class="btn btn-sm btn-primary" disabled={namesStep === 'busy'} onclick={publishNames} data-act="anon-names-confirm">{HO.anonCardsBtn}</button><button class="btn btn-sm" disabled={namesStep === 'busy'} onclick={() => (namesStep = 'idle')}>{L.cancel}</button>{/if}
          </div>
        </section>
      {/if}
      {#if editingLogo && editable}<TeamLogoEditor {logo} name={name.trim() || L.myTeam} onapply={(value) => { logo = value; editingLogo = false; }} onclose={() => (editingLogo = false)} />{/if}
      <TeamLineup
        {team}
        teamLogo={logo}
        teamName={name.trim()}
        managerName={manager.trim()}
        {editable}
        {salary}
        {fatigue}
        {budget}
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
        nameOk={nameOk && !pendingDraft && !cupBlock}
        saveBlock={cupBlock}
        {dirty}
        onassign={assign}
        onauto={autoFill}
        onsave={save}
        onlock={toggleLock}
        onpresets={() => (presetsOpen = true)}
        bind:focusSlot
      />
      {#if team && season === current}
        <!-- T-11-310 감독 칸: 감독은 감독 커리어 화면에서 고른다. -->
        <section class="card tm-coach" data-team-coach>
          <span class="tm-coach-info"><b>{MG.teamCoach}</b><span class="muted fs-sm">{team.coach ? coachSummary(team.coach, formation, localNames) : MG.teamCoachEmpty}</span></span>
          <button class="btn btn-sm" data-act="team-coach" onclick={() => go('manager')}>{MG.teamCoachManage}</button>
          <!-- T-11-382 줄 칸의 "감독 +3.0"이 어디서 왔는지(갈래별 값 · 상한에 잘린 몫 · 꺼진 특기). -->
          {#if coachDetail}
            <details class="tm-coach-detail" data-coach-breakdown>
              <summary>{MG.breakdown}</summary>
              <ul>
                {#each coachDetail.rows as r (r.line)}
                  <li data-coach-row={r.line}><b>{r.label} {r.total}</b><span class="muted fs-sm">{r.parts}</span>{#if r.capped}<span class="fs-sm" data-coach-capped>{r.capped}</span>{/if}</li>
                {/each}
              </ul>
              {#if coachDetail.off.length}<p class="muted fs-sm" data-coach-off>{MG.breakdownOff({ names: coachDetail.off.join(' · ') })}</p>{/if}
              <p class="muted fs-sm">{MG.breakdownNote}</p>
            </details>
          {/if}
        </section>
      {/if}
      <TeamPresets bind:open={presetsOpen} {presets} hasTeam={!!team} locked={!!cupBand?.locked && !cupPreset} cupLocked={!!cupBand?.locked} cup={season > 0} draft={presetDraft} persist={persistPresets} onload={applyPreset} />
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
        onmore={ladder ? () => ((oppPick += 1), void loadOpponents()) : () => open('opponents')}
        {ladder}
        repicksLeft={RANK_MATCH_REPICKS - oppPick}
        ontoTeam={editable ? () => switchView('team') : undefined}
        onsave={season === current && dirty && filled > 0 && matchesLeft > 0 ? () => void saveAndFindOpponents() : undefined}
        {saving}
        saveDisabled={!nameOk || !!pendingDraft}
      />
      {/if}
    {:else if view === 'result' && result}
      {#if live}
        {#key result.id}
          <TeamLive
            match={result}
            name={eventName}
            live={liveMoments}
            onfinal={liveFinal}
            onend={() => ((live = false), (liveMoments = undefined), window.scrollTo(0, 0))}
          />
        {/key}
      {:else}
        <TeamResult
          m={result}
          {team}
          shift={divisionShift}
          {eventName}
          matchesLeft={result.friendly ? friendlyLeft : matchesLeft}
          ontoTeam={() => switchView('team')}
          onreplay={() => (live = true)}
          onagain={() => open('opponents')}
          onhistory={resultOrigin === 'history' ? () => switchView('history') : undefined}
          onplayer={(id) => openStats(id)}
          fix={reportFix}
        />
      {/if}
    {:else if view === 'history'}
      <TeamHistory
        {history}
        status={histStatus}
        record={team?.record ?? null}
        {seasonName}
        more={!!histNext}
        {moreStatus}
        onreload={() => void loadHistory()}
        onopen={(m) => { result = m; divisionShift = null; resultOrigin = 'history'; live = false; switchView('result'); }}
        onmore={() => void loadMore()}
        onstats={() => openStats()}
      />
    {:else if view === 'stats'}
      <TeamStats
        {stats}
        status={statsStatus}
        {seasonName}
        focus={statsFocus}
        name={eventName}
        onreload={() => void loadStats()}
        onback={() => switchView('history')}
      />
    {/if}
  </LoadState>
  {#if needLogin}<BackBar act="team-back" fallback={() => (appState.screen = 'owner')} />{/if}
</div>

{#if !needLogin}
  <TeamNav {navOn} onswitch={switchView} />
{/if}

<style>
  .tm-sk {display:grid;gap:14px;padding-block:4px;opacity:0;animation:sk-in .2s ease-out .2s forwards;}
  .tm-sk-title,.tm-sk-pitch {animation:sk-pulse 1.4s ease-in-out .4s infinite;}
  .tm-sk-title {width:52%;height:24px;border-radius:var(--radius-sm);background:var(--line);}
  .tm-sk-pitch {
    --d:var(--line);
    width:100%;max-width:640px;aspect-ratio:5/6;margin:0 auto;border-radius:var(--radius-md);border:1px solid var(--line);
    background:
      radial-gradient(circle 16px at 50% 90%,var(--d) 98%,transparent),
      radial-gradient(circle 16px at 14% 70%,var(--d) 98%,transparent),
      radial-gradient(circle 16px at 38% 73%,var(--d) 98%,transparent),
      radial-gradient(circle 16px at 62% 73%,var(--d) 98%,transparent),
      radial-gradient(circle 16px at 86% 70%,var(--d) 98%,transparent),
      radial-gradient(circle 16px at 25% 48%,var(--d) 98%,transparent),
      radial-gradient(circle 16px at 50% 51%,var(--d) 98%,transparent),
      radial-gradient(circle 16px at 75% 48%,var(--d) 98%,transparent),
      radial-gradient(circle 16px at 20% 22%,var(--d) 98%,transparent),
      radial-gradient(circle 16px at 50% 18%,var(--d) 98%,transparent),
      radial-gradient(circle 16px at 80% 22%,var(--d) 98%,transparent),
      var(--surface-2);
  }
  @media(max-width:440px) { .tm-sk-pitch {aspect-ratio:2/3;} }
  @media(prefers-reduced-motion:reduce) { .tm-sk-title,.tm-sk-pitch {animation:none;} }
  .tm-mode { margin-bottom: 12px; }
  .draft-notice {display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:10px;padding:12px 16px;}
  .draft-notice p {margin:0;font-size:13px;flex:1 1 200px;}
  .draft-notice > div {display:flex;flex-wrap:wrap;gap:8px;}
  .draft-notice .btn {min-height:44px;}
  .anon-names {display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:10px;padding:12px 16px;}
  .anon-names p {margin:0;flex:1 1 200px;}
  .anon-names .btn {min-height:44px;}
  .tm-coach {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 10px;
  }
  .tm-coach-detail {
    flex: 1 1 100%;
  }
  .tm-coach-detail summary {
    cursor: pointer;
    min-height: 44px;
    display: flex;
    align-items: center;
    font-weight: 600;
  }
  .tm-coach-detail ul {
    list-style: none;
    margin: 0 0 8px;
    padding: 0;
    display: grid;
    gap: 8px;
  }
  .tm-coach-detail li {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }
  .tm-coach-detail p {
    margin: 0 0 6px;
  }
  .tm-coach-info {
    display: flex;
    flex: 1;
    min-width: 0;
    flex-direction: column;
    gap: 2px;
  }
</style>
