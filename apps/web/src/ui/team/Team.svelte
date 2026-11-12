<script lang="ts">
  import { createTeamRecords } from './teamRecords.svelte.js';
  import { createTeamMatches } from './teamMatches.svelte.js';
  import { projectTeamDraft } from '@offside/app-core/teamDraftView';
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
    TEAM_RATING_START,
    YOUTH_NAME,
    YOUTH_OVR,
    usesRankLadder,
    type FormationId,
    type TeamPosition,
  } from '@offside/contracts/owner-team';
  import {
    fetchOwnerTeam,
    saveOwnerTeam,
    saveTeamPresets,
    type OwnerTeam,
    type OwnerTeamResponse,
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
  import { cupPresetOf, loadPreset, presetOf, presetSummary, withSeasonCupPreset, type TeamPreset } from '@offside/app-core/teamPresets';
  import { friendsUi } from '../friendInvite.svelte.js';
  import { shellText as S } from '@offside/app-core/i18n/ko/shell';
  import { fixSlot, slotName } from '@offside/app-core/matchReport';
  import type { ReportLine } from '@offside/contracts/owner-team';
  import { cupText as CT } from '@offside/app-core/i18n/ko/cup';
  import { cardSeasonBadge } from '@offside/app-core/format';
  import { assignSlot, autoFillSlots, matchHintOf, seasonCupSlots, teamEditableIn } from '@offside/app-core/teamOwner';
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
  import { takeDivisionChange } from '@offside/app-core/teamDivision';

  let status = $state<LoadStatus>('loading');
  let needLogin = $state(false);
  let team = $state<OwnerTeam | null>(null);
  let players = $state<TeamPlayer[]>([]);
  let matchesLeft = $state(0);
  let matchesNextAt = $state<string | null>(null);
  // 충전 시각이 되면 경기를 다시 열어 준다(서버가 다시 확인한다). 다음 시각은 경기 응답으로 받는다.
  $effect(() => {
    if (matchesLeft > 0 || !matchesNextAt) return;
    const timer = setTimeout(() => {
      matchesLeft = 1;
      matchesNextAt = null;
    }, Date.parse(matchesNextAt) - Date.now());
    return () => clearTimeout(timer);
  });
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
  // T-11-373 카드 강화 창(지연 청크). 강화가 열린 동안만 버튼을 보인다.
  let enhancing = $state<TeamPlayer | null>(null);
  let enhanceOpen = $state(false);

  let divisionNotice = $state<string | null>(null);
  const ladder = $derived(usesRankLadder(team?.season ?? 0));
  const matches = createTeamMatches({ team: () => team, season: () => season, setMatchesLeft: (n) => (matchesLeft = n), setMatchesNextAt: (at) => (matchesNextAt = at), clearDivisionNotice: () => (divisionNotice = null), show: (v) => show(v), openHistoryResult: () => switchView('result') });
  // T-10-130 팀 안의 화면은 appState.teamView — 뒤로 가기로 오간다. 결과는 이 화면에만 있어 다시 들어왔을 때(앞으로 가기)
  // 없으면 팀을 보여 준다.
  const view = $derived(appState.teamView === 'result' && !matches.result ? 'team' : appState.teamView);
  const show = (v: TeamView) => (appState.teamView = v);
  const records = createTeamRecords(() => season);

  // 서버에는 비공개 이름이 없다 — 이 기기에서 은퇴한 선수는 이 기기에 남은 이름을 쓴다.
  const localNames = localCareerNames();
  const byId = $derived(new Map(players.map((p) => [p.careerId, p])));
  let fatigue = $state<OwnerTeamResponse['fatigue'] | null>(null);
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

  // Keep web's local preset selection; the shared projection does not select presets.
  const cupPreset = $derived(cupPresetOf(presets));
  const projectedDraft = $derived(projectTeamDraft({ formation, layout, slots, byId, season, editable, cupPreset }));
  const previewLayout = $derived(projectedDraft.positions);
  const slotCodes = $derived(projectedDraft.slotCodes);
  const ratings = $derived(projectedDraft.ratings);
  const ovr = $derived(projectedDraft.ovr);
  const synergy = $derived(projectedDraft.synergy);
  const lines = $derived(projectedDraft.lines);
  const filled = $derived(projectedDraft.filled);
  const cupDraft = $derived(projectedDraft.cupDraft);
  const coachDetail = $derived(team?.coach ? coachBreakdown(team.coach, formation, synergy, season) : null);
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
      return { rating: ratings[i] ?? YOUTH_OVR, name: p ? nameOf(p) : YOUTH_NAME, youth: !p, player: p };
    }),
  );
  const matchHint = $derived(matchHintOf(team, dirty, matchesLeft, season, current, cupSeason, matchesNextAt));

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
  // T-11-657 명단 관리의 리그 선발 명단 요약(저장된 팀 명단).
  const leagueSummary = $derived(team ? presetSummary(presetOf('', team.formation as FormationId, team.slots.map((x) => x.careerId), team.layout ?? null)) : null);
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
  /** T-11-657 이번 시즌 카드만 자동 배치한 편성을 컵 명단 프리셋으로 둔다(팀 명단 · 초안은 그대로). */
  async function makeSeasonCup() {
    const ids = seasonCupSlots(slotCodes, players, season);
    if (!ids.some(Boolean)) return toast(CT.seasonCupEmpty);
    const name = CT.seasonCupName({ badge: cardSeasonBadge(season) });
    const next = withSeasonCupPreset(presets, presetOf(name, formation, ids, season > 0 ? previewLayout : null));
    if (!next) return toast(CT.seasonCupFull);
    if (await persistPresets(next)) toast(CT.seasonCupMade({ name }));
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
    matchesNextAt = r.data.matchesNextAt ?? null;
    cupSeason = r.data.cupSeason ?? null;
    perDay = r.data.matchesPerDay;
    enhanceOpen = !!r.data.enhanceOpen;
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
  /** 라커룸에서 넣거나, 이미 선발인 선수의 두 자리를 바꾼다. */
  function assign(index: number, id: string | null) {
    slots = assignSlot(slots, index, id);
  }

  /** 자리마다 가장 잘 맞는 선수부터 채운다(유스 선수보다 나을 때만). */
  function autoFill() {
    slots = autoFillSlots(slotCodes, players);
  }

  async function save(): Promise<boolean> {
    if (saving || !nameOk || !editable || pendingDraft) return false;
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
    if (appState.screen === 'team' && view === 'opponents' && !matchHint && !ladder) await matches.loadOpponents();
  }

  // ───────── 경기 ─────────
  // T-11-188 선수 잠금 — 잠긴 선수는 이적시장에 내놓거나 방출할 수 없다.
  async function toggleLock(p: TeamPlayer) {
    const r = await setCardLock(p.careerId, !p.locked);
    if (!r.ok) return toast(r.error.message);
    players = players.map((x) => (x.careerId === p.careerId ? { ...x, locked: r.data.locked } : x));
    toast(r.data.locked ? MARKET_TOAST.locked : MARKET_TOAST.unlocked);
  }

  // ───────── 시즌 업적 ─────────
  /** 지난 경기 결과를 연다(기록 탭 · T-11-603 랭크 매칭의 최근 전적). */
  function openStats(focus: string | null = null) {
    records.statsFocus = focus;
    switchView('stats');
  }

  // 화면마다 불러올 내용. 다른 화면에서 들어오면(뒤로·앞으로 가기 포함) 아래 $effect가, 이미 그 화면이면 open이 다시 불러온다.
  const LOAD = {
    // T-11-603 시즌 2는 매칭 찾기를 누를 때 상대를 받는다.
    opponents: () => (matchHint || ladder || friendsUi.mode === 'friends' ? undefined : matches.loadOpponents()),
    achievements: () => records.loadAchievements(),
    history: records.loadHistory,
    stats: records.loadStats,
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
  const navOn = $derived(view === 'result' ? matches.resultOrigin : view === 'stats' ? 'history' : view);
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
      <TeamAchievements ach={records.ach} status={records.achStatus} newIds={records.achNewIds} bind:cat={records.achCat} load={(s) => void records.loadAchievements(s)} onrank={openAchRanking} />
    {:else if view === 'team'}
      {#if pendingDraft}
        <section class="card draft-notice" role="status">
          <p>{L.draftChangedWeb}</p>
          <div><button class="btn btn-sm" onclick={() => pendingDraft && restoreDraft(pendingDraft)} data-act="team-draft-restore">{L.draftLoadWeb}</button><button class="btn btn-sm" onclick={discardDraft}>{L.draftKeep}</button></div>
        </section>
      {:else if restoredDraft && dirty}
        <section class="card draft-notice" role="status"><p>{L.draftRestoredWeb}</p><button class="btn btn-sm" onclick={discardDraft} data-act="team-draft-discard">{L.draftDiscardWeb}</button></section>
      {/if}
      {#if editable && (cupBar || (cupBand && (cupBand.locked || cupBand.when)))}<CupLineupBand locked={!!cupBand?.locked} when={cupBand?.when ?? null} bar={cupBar} preset={cupPreset?.name ?? null} onseason={cupBar?.past && !cupBand?.locked ? () => void makeSeasonCup() : undefined} />{/if}
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
        {fatigue}
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
        onenhance={editable && enhanceOpen ? (p) => (enhancing = p) : undefined}
        onpresets={() => (presetsOpen = true)}
        onach={season > 0 && season === current ? () => open('achievements') : undefined}
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
      {#if enhancing}
        {#await import('./EnhanceSheet.svelte') then { default: EnhanceSheet }}
          <EnhanceSheet player={enhancing} name={nameOf(enhancing)} onclose={() => (enhancing = null)} onresult={(id, r) => (players = players.map((x) => (x.careerId === id ? { ...x, enhance: r.card.level || undefined } : x)))} />
        {/await}
      {/if}
      <TeamPresets bind:open={presetsOpen} {presets} hasTeam={!!team} locked={!!cupBand?.locked && !cupPreset} cupLocked={!!cupBand?.locked} cup={season > 0} league={leagueSummary} seasonOnly={!!cupRule?.cup.cup.seasonCardsOnly} cupPast={cupPreset ? cupDraft.past : 0} onseason={() => void makeSeasonCup()} draft={presetDraft} persist={persistPresets} onload={applyPreset} />
    {:else if view === 'opponents'}
      <div class="seg two tm-mode" role="group" aria-label={L.matchKindLabel}>
        <button class="hof-sort" aria-pressed={friendsUi.mode === 'ranked'} data-match-mode="ranked" onclick={() => { if (friendsUi.mode === 'ranked') return; friendsUi.mode = 'ranked'; if (!matchHint && !ladder && matches.oppStatus !== 'ready') void matches.loadOpponents(); }}>{L.modeRanked}</button>
        <button class="hof-sort" aria-pressed={friendsUi.mode === 'friends'} data-match-mode="friends" onclick={() => (friendsUi.mode = 'friends')}>{L.modeFriends}{#if appState.friendReq}<span class="btn-dot" data-friend-dot><span class="sr-only">{S.friendReq({ n: appState.friendReq })}</span></span>{/if}</button>
      </div>
      {#if friendsUi.mode === 'friends'}
        <TeamFriends onplayed={(m, left) => matches.openFriendly(m, left, true)} onopen={(m, left) => matches.openFriendly(m, left, false)} onpreseason={() => pickSeason(0)} />
      {:else}
      <TeamOpponents
        rating={team?.rating ?? TEAM_RATING_START}
        {matchesLeft}
        {perDay}
        opponents={matches.opponents}
        status={matches.oppStatus}
        playing={matches.playing}
        hint={matchHint}
        onreload={() => void matches.loadOpponents()}
        onchallenge={(o) => void matches.challenge(o)}
        onmore={() => open('opponents')}
        {ladder}
        {team}
        teamLogo={logo}
        bind:found={matches.rankFound}
        bind:pick={matches.oppPick}
        onopenmatch={matches.openHistoryMatch}
        ontoTeam={editable ? () => switchView('team') : undefined}
        onsave={season === current && dirty && filled > 0 && matchesLeft > 0 ? () => void saveAndFindOpponents() : undefined}
        {saving}
        saveDisabled={!nameOk || !!pendingDraft}
      />
      {/if}
    {:else if view === 'result' && matches.result}
      {#if matches.live}
        {#key matches.result.id}
          <TeamLive
            match={matches.result}
            name={eventName}
            live={matches.liveMoments}
            onfinal={matches.liveFinal}
            onend={() => ((matches.live = false), (matches.liveMoments = undefined), window.scrollTo(0, 0))}
          />
        {/key}
      {:else}
        <TeamResult
          m={matches.result}
          {team}
          shift={matches.divisionShift}
          {eventName}
          matchesLeft={matches.result.friendly ? matches.friendlyLeft : matchesLeft}
          ontoTeam={() => switchView('team')}
          onreplay={() => (matches.live = true)}
          onagain={() => open('opponents')}
          onhistory={matches.resultOrigin === 'history' ? () => switchView('history') : undefined}
          onplayer={(id) => openStats(id)}
          fix={reportFix}
        />
      {/if}
    {:else if view === 'history'}
      <TeamHistory
        history={records.history}
        status={records.histStatus}
        record={team?.record ?? null}
        {seasonName}
        more={!!records.histNext}
        moreStatus={records.moreStatus}
        onreload={() => void records.loadHistory()}
        onopen={matches.openHistoryMatch}
        onmore={() => void records.loadMore()}
        onstats={() => openStats()}
      />
    {:else if view === 'stats'}
      <TeamStats
        stats={records.stats}
        status={records.statsStatus}
        {seasonName}
        focus={records.statsFocus}
        name={eventName}
        onreload={() => void records.loadStats()}
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
