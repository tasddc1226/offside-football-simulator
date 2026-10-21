// T-10-092 구단주 팀(웹 team/Team.svelte) — 시즌마다 그 시즌에 뛰고 은퇴한 내 선수로 11명을 꾸려(빈 자리는 유스 선수가
// 채운다) 같은 시즌 다른 구단주의 팀과 겨룬다. 지난 시즌 팀은 보기만 한다. 경기 결과는 서버가 정한다(앱은 보여 주기만).
// 편성·후보·업적 표기 같은 순수 계산은 웹과 같은 @offside/app-core/teamOwner.
import { FONT, RADIUS } from '@offside/app-core/design-tokens';
import { teamNameIssues } from '@offside/app-core/careerGuide';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Alert, View } from 'react-native';
import { useSnapshot } from 'valtio';
import {
  FORMATION_IDS,
  presetLayout,
  positionedLayout,
  type TeamPosition,
  LINEUP_SIZE,
  MANAGER_NAME_MAX,
  MANAGER_NAME_MIN,
  PAST_SALARY_BUDGET,
  TEAM_NAME_MAX,
  TEAM_NAME_MIN,
  TEAM_RATING_START,
  YOUTH_NAME,
  YOUTH_OVR,
  slotRating,
  synergyApplies,
  teamOvr,
  SHAPE_IDS,
  shapeBase,
  shapeLayout,
  matchShape,
  type FormationId,
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
  type OwnerTeam,
  type OwnerTeamResponse,
  type PlayTeamMatchResponse,
  type TeamLive as TeamLiveData,
  type TeamMatch,
  type TeamStatsResponse,
  type TeamOpponent,
  type TeamPlayer,
} from '@offside/app-core/api/team';
import { type TeamView } from '@offside/app-core/state';
import { recordText, num } from '@offside/app-core/teamText';
import { teamHomeText as L } from '@offside/app-core/i18n/ko/teamHome';
import { hofOwnText as HO } from '@offside/app-core/i18n/ko/hofOwn';
import { loadAnonNames, publishAnonNames, type AnonName } from '@offside/app-core/cardNames';
import { shellText as S } from '@offside/app-core/i18n/ko/shell';
import {
  autoFillSlots,
  budgetOf,
  salaryBar,
  salaryBlocks,
  salaryFullText,
  draftLines,
  isPreseasonLegacy,
  matchHintOf,
  preseasonTeamNote,
  slotsSynergy,
  synergyFocus,
  teamEditableIn,
} from '@offside/app-core/teamOwner';
import { MARKET_TOAST, marketName, needsOwnerLogin } from '@offside/app-core/market';
import { onRetirementSynced, pendingRetirementIds, retryOutboxNow } from '@offside/app-core/outbox';
import { localCareerNames } from '@offside/game/hof-store';
import { LoadState, type LoadStatus } from '../../components/LoadState';
import { TeamLines } from '../../components/TeamPitch';
import { TeamSynergy } from '../../components/TeamSynergy';
import { toast } from '../../game/host';
import { setCardLock } from '@offside/app-core/api/market';
import { go } from '../../game/nav';
import { managerText as MG } from '@offside/app-core/i18n/ko/manager';
import { DisclosureRow } from '../../ui/Disclosure';
import { coachBreakdown, coachLineBonus, coachSummary } from '@offside/app-core/managerCard';
import { rem } from '../../theme/type';
import { achNudge } from '../../game/achNudge';
import { accountCache, appState, prefs } from '../../store';
import { notificationDestination } from '../../platform/notificationDestination';
import { useColors } from '../../theme/useColors';
import { BackBar, Btn, Card, Screen, Topbar, Txt, scrollTo } from '../../ui';
import { BarBelow } from '../../ui/Screen';
import { SkeletonFrame, useSkeletonBlock } from '../../ui/Skeleton';
import { useOnPull } from '../../ui/refresh';
import { TabBar, type TabItem } from '../../ui/TabBar';
import type { TabIconName } from '../../ui/TabIcon';
import { Field, SelectField, TextField } from '../settings/parts';
import { LoginButtons } from './LoginButtons';
import { TeamAchievements } from './TeamAchievements';
import { TeamFriends, OppSwitch, useFriends, type OppTab } from './TeamFriends';
import { TeamHistory } from './TeamHistory';
import { TeamStats } from './TeamStats';
import { TeamLive } from './TeamLive';
import { TeamOpponents } from './TeamOpponents';
import { OvrBadge } from './TeamParts';
import { TeamLineup } from './TeamLineup';
import { SalaryBar } from './SalaryGuide';
import { teamCoreText as TC } from '@offside/app-core/i18n/ko/teamCore';
import { TeamLogo } from '../../components/TeamLogo';
import { TeamLogoEditor } from './TeamLogoEditor';
import { TeamShare, type TeamShareData } from './TeamShare';
import { TeamDialog } from '../../components/TeamDialog';
import type { TeamLogo as Logo } from '@offside/contracts/team-logo';
import type { PutOwnerTeamBody } from '@offside/contracts';
import { readTeamDraft, writeTeamDraft, teamDraftBase, type TeamDraft } from './teamDraft';
import { RecordsChips as SortChips } from '../hof/RecordsControls';
import { TeamResult } from './TeamResult';
import { CupLockNotice, useCup } from './TeamCup';
import { cupLineupBar } from '@offside/app-core/cupLineupBar';
import { TeamPresets } from './TeamPresets';
import { loadPreset, presetOf, type TeamPreset } from '@offside/app-core/teamPresets';
import { teamSeasonLabel } from '@offside/app-core/seasonName';
import { fixSlot, slotName } from '@offside/app-core/matchReport';
import type { ReportLine } from '@offside/contracts/owner-team';

const between = (v: string, min: number, max: number) =>
  v.trim().length >= min && v.trim().length <= max;

// T-11-026 내 팀 하단 메뉴 — 편성 · 경기 · (가운데) 구단주 · 업적 · 기록. 경기 결과는 '경기' 탭 안이다.
const nav = (): [TeamView, string, TabIconName][] => [
  ['team', L.navLineup, 'lineup'],
  ['opponents', L.navMatches, 'season'],
  ['achievements', L.navAch, 'trophy'],
  ['history', L.navHistory, 'career'],
];

export default function Team() {
  const c = useColors();
  const { teamView, achNew, friendReq } = useSnapshot(appState);
  const [status, setStatus] = useState<LoadStatus>('loading');
  const [needLogin, setNeedLogin] = useState(false);
  const [team, setTeam] = useState<OwnerTeam | null>(null);
  const [players, setPlayers] = useState<TeamPlayer[]>([]);
  const [matchesLeft, setMatchesLeft] = useState(0);
  const [perDay, setPerDay] = useState(0);
  /** 보고 있는 시즌 · 지금 고치고 겨루는 시즌(휴식기면 null) · 고를 수 있는 시즌. */
  const [season, setSeason] = useState(0);
  const [budget, setBudget] = useState(PAST_SALARY_BUDGET);
  const [synFocus, setSynFocus] = useState<string | null>(null);
  const [current, setCurrent] = useState<number | null>(null);
  const [seasons, setSeasons] = useState<OwnerTeamResponse['seasons']>([]);
  const [lastManager, setLastManager] = useState<string | null>(null);
  // T-11-113 개막 뒤 프리시즌 팀은 친선전 전용으로 고칠 수 있다(랭크 경기는 지금 시즌 팀만).
  const legacy = isPreseasonLegacy(season, current);
  const editable = teamEditableIn(season, current);
  const seasonName = seasons.find((o) => o.id === season) ? teamSeasonLabel(season) : '';

  // 편집 초안 — 저장하기 전까지 이 기기에만 있다.
  const [name, setName] = useState('');
  const [manager, setManager] = useState('');
  const [formation, setFormation] = useState<FormationId>('4-3-3');
  const [slots, setSlots] = useState<(string | null)[]>(Array(LINEUP_SIZE).fill(null));
  const [saving, setSaving] = useState(false);
  /** 팀이 있으면 이름 칸은 '이름 바꾸기'를 눌렀을 때만 펼친다. */
  const [renaming, setRenaming] = useState(false);
  const [layout, setLayout] = useState<TeamPosition[] | null>(null);
  const [logo, setLogo] = useState<Logo | null>(null);
  const [editingLogo, setEditingLogo] = useState(false);
  const [menu, setMenu] = useState(false);
  /** T-11-217 팀 프리셋 시트. */
  const [presetsOpen, setPresetsOpen] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const [share, setShare] = useState<TeamShareData | null>(null);
  const jump = useRef<(() => void) | null>(null);
  const [draftKey, setDraftKey] = useState<string | null>(null);
  const [pendingDraft, setPendingDraft] = useState<TeamDraft | null>(null);
  const [restored, setRestored] = useState(false);
  const loadSequence = useRef(0);
  const savingRef = useRef(false);
  const draftNow = useRef<PutOwnerTeamBody | null>(null);
  // T-11-111 당겨서 새로고침이 편집 중인 초안·열려 있는 팀을 덮지 않도록 지금 값을 들고 있는다.
  const dirtyNow = useRef(false);
  const teamNow = useRef<OwnerTeam | null>(null);

  /** T-11-098 '경기' 탭의 두 칸(랭크 경기 · 친구). 친구 칸은 처음 열 때만 불러온다. */
  const destination = useSnapshot(notificationDestination);
  const [oppTab, setOppTab] = useState<OppTab>(destination.friends ? 'friends' : 'ranked');
  const friends = useFriends();
  useEffect(() => {
    if (status !== 'ready' || needLogin) return;
    if (destination.friends) {
      setOppTab('friends');
      notificationDestination.friends = false;
      friends.reload();
    }
    if (destination.history) {
      notificationDestination.history = false;
      void loadHistory();
    }
  }, [destination.friends, destination.history, status, needLogin]);
  const oppLoaded = useRef(false);
  const [opponents, setOpponents] = useState<TeamOpponent[]>([]);
  const [oppStatus, setOppStatus] = useState<LoadStatus>('loading');
  const [playing, setPlaying] = useState(false);
  const [result, setResult] = useState<TeamMatch | null>(null);
  /** 방금 치른 경기(또는 '다시 보기')를 문자중계로 보여 주는 중(T-10-097). */
  const [live, setLive] = useState(false);
  /** T-11-387 방금 시작한 장면 경기의 고를 장면(중계가 끝나면 비운다). */
  const [liveMoments, setLiveMoments] = useState<TeamLiveData | undefined>();
  const [resultOrigin, setResultOrigin] = useState<'opponents' | 'history'>('opponents');
  const [history, setHistory] = useState<TeamMatch[]>([]);
  const [histStatus, setHistStatus] = useState<LoadStatus>('loading');
  // T-11-269 경기 기록 다음 쪽 커서('더 보기'), 시즌 통계와 경기 결과에서 누른 선수.
  const [histNext, setHistNext] = useState<string | null>(null);
  const [moreStatus, setMoreStatus] = useState<'idle' | 'loading' | 'error'>('idle');
  const [stats, setStats] = useState<TeamStatsResponse | null>(null);
  const [statsStatus, setStatsStatus] = useState<LoadStatus>('loading');
  const [statsFocus, setStatsFocus] = useState<string | null>(null);
  const [ach, setAch] = useState<ClubAchievementsResponse | null>(null);
  const [achStatus, setAchStatus] = useState<LoadStatus>('loading');
  /** T-11-034 지난번 업적 탭을 본 뒤 새로 오른 업적(NEW). */
  const [achNewIds, setAchNewIds] = useState<ReadonlySet<string>>(new Set());
  // T-11-145 오프사이드 컵 — 지금 시즌 팀을 볼 때만 명단 마감 안내를 위해 불러온다.
  const cupState = useCup(status === 'ready' && !needLogin && editable && !legacy);

  // T-10-130 팀 안의 화면은 appState.teamView — 뒤로 가기로 오간다. 결과는 이 화면에만 있어 다시 들어왔을 때(앞으로
  // 가기) 없으면 팀을 보여 준다.
  const view: TeamView = teamView === 'result' && !result ? 'team' : teamView;
  const show = (v: TeamView) => {
    appState.teamView = v;
  };

  // 서버에는 비공개 이름이 없다 — 이 기기에서 은퇴한 선수는 이 기기에 남은 이름을 쓴다.
  const localNames = useMemo(() => localCareerNames(), []);
  const byId = new Map(players.map((p) => [p.careerId, p]));
  // T-11-376 지난 시즌 선수 급여 예산(서버 밸런스 값, 옛 응답이면 기본 60).
  const salary = salaryBar(slots, byId, season, budget);
  const nameOf = (p: TeamPlayer) => marketName(p, localNames);
  const eventName = (id: string | null, fallback: string) => (id && localNames.get(id)) || fallback;
  // T-11-266 익명으로 은퇴한 내 선수 중 이 기기가 이름을 아는 카드(이적시장에 팔린 선수 포함) — 한꺼번에 이름을 공개할 수 있다.
  const [anonNames, setAnonNames] = useState<AnonName[]>([]);
  useEffect(() => {
    if (!editable || status !== 'ready' || needLogin) return;
    let live = true;
    void loadAnonNames(localNames).then((x) => live && setAnonNames(x));
    return () => {
      live = false;
    };
  }, [editable, status, needLogin, localNames]);
  const [namesBusy, setNamesBusy] = useState(false);
  async function publishNames() {
    const items = anonNames;
    setNamesBusy(true);
    const n = await publishAnonNames(items);
    setNamesBusy(false);
    if (n === null) return toast(HO.anonCardsFail);
    const named = new Map(items.map((x) => [x.careerId, x.publicName]));
    setPlayers((prev) =>
      prev.map((p) => (named.has(p.careerId) ? { ...p, publicName: named.get(p.careerId)! } : p)),
    );
    setAnonNames([]);
    toast(HO.anonCardsDone({ n }));
  }
  const askPublishNames = () =>
    Alert.alert(HO.anonCardsBtn, HO.anonCardsConfirm({ n: anonNames.length }), [
      { text: L.cancel, style: 'cancel' },
      { text: HO.anonCardsBtn, onPress: () => void publishNames() },
    ]);

  const positions =
    editable && season > 0
      ? positionedLayout(layout ?? presetLayout(formation))
      : (layout ?? presetLayout(formation));
  const slotCodes = positions.map((p) => p.slot);
  const ratings: (number | null)[] = slotCodes.map((slot, i) => {
    const id = slots[i];
    const p = id ? byId.get(id) : undefined;
    return p ? slotRating(slot, p) : null;
  });
  const ovr = teamOvr(ratings);
  // T-11-105 선발 시너지 — 늘 보여 주고, 반영 시즌부터 줄 힘에도 더한다.
  const synergy = slotsSynergy(positions, slots, byId);
  const syn = synergyFocus(synergy, synFocus);
  // 공격·중원·수비·골키퍼 힘 — 자리별 실력에 포메이션의 줄 무게를 더한 값(서버 경기 계산과 같은 규칙).
  const lines = draftLines(slotCodes, ratings, synergy, season);
  // T-11-379 리포트 '고칠 곳' — 지금 편성에서 약한 줄을 가장 많이 올릴 자리를 골라 둔 채 편성 화면으로.
  const [focusSlot, setFocusSlot] = useState<number | null>(null);
  const reportFix = (line: ReportLine) => {
    if (!editable || season !== current) return null;
    const i = fixSlot(slotCodes, ratings, line, YOUTH_OVR);
    if (i === null) return null;
    return {
      pos: slotName(slotCodes[i]!),
      go: () => {
        setFocusSlot(i);
        show('team');
        scrollTo(0);
      },
    };
  };
  // T-11-323 감독 칸 보정(경기 계산과 같은 값) — 줄 힘 칸에 더해 보인다.
  const [coachOpen, setCoachOpen] = useState(false);
  const coachBonus = team?.coach ? coachLineBonus(team.coach, formation, synergy, season) : null;
  // T-11-382 줄 칸의 감독 보정이 어디서 왔는지(갈래별 값 · 상한에 잘린 몫 · 꺼진 특기).
  const coachDetail = team?.coach ? coachBreakdown(team.coach, formation, synergy, season) : null;
  const filled = slots.filter((s) => s !== null).length;
  // T-11-436 컵 규칙 줄 — 서버 저장 검사와 같은 판정. block이 있으면 저장을 막고 이유를 보인다.
  const cupBar =
    editable && !legacy && cupState.cup?.cup.season === season
      ? cupLineupBar(cupState.cup, cupState.me, { ovr, filled }, new Date().toISOString())
      : null;
  const dirty =
    !team ||
    name.trim() !== team.name ||
    manager.trim() !== team.manager ||
    JSON.stringify(logo) !== JSON.stringify(team.logo ?? null) ||
    JSON.stringify(layout) !== JSON.stringify(team.layout ?? null) ||
    formation !== team.formation ||
    slots.some((id, i) => id !== (team.slots[i]?.careerId ?? null));
  const nameIssues = teamNameIssues(name, manager);
  const nameOk =
    between(name, TEAM_NAME_MIN, TEAM_NAME_MAX) &&
    between(manager, MANAGER_NAME_MIN, MANAGER_NAME_MAX);
  const cells = slots.map((id, i) => {
    const p = id ? byId.get(id) : undefined;
    return {
      rating: ratings[i] ?? YOUTH_OVR,
      name: p ? nameOf(p) : YOUTH_NAME,
      youth: !p,
      ...(p
        ? {
            peak: p.peak,
            number: p.number,
            legendScore: p.legendScore,
            careerId: p.careerId,
            look: p.look,
            nation: p.nation,
            season: p.season,
          }
        : {}),
    };
  });
  const matchHint = matchHintOf(team, dirty, matchesLeft, season, current);
  const draftValue: PutOwnerTeamBody = { name, manager, logo, formation, slots, layout };
  draftNow.current = draftValue;
  dirtyNow.current = dirty;
  teamNow.current = team;
  useEffect(() => {
    if (status !== 'ready' || !editable || !draftKey || pendingDraft) return;
    writeTeamDraft(draftKey, dirty ? { base: teamDraftBase(team), value: draftValue } : null);
  }, [
    name,
    manager,
    logo,
    formation,
    slots,
    layout,
    status,
    editable,
    draftKey,
    pendingDraft,
    team,
  ]);
  function applyDraft(value: PutOwnerTeamBody) {
    setName(value.name);
    setManager(value.manager);
    setLogo(value.logo ?? null);
    setFormation(value.formation);
    setSlots([...value.slots]);
    setLayout(value.layout ? [...value.layout] : null);
    setRestored(true);
  }

  function applyTeam(t: OwnerTeam | null, lm: string | null = lastManager) {
    setTeam(t);
    setName(t?.name ?? '');
    setManager(t?.manager || lm || '');
    setFormation(t?.formation ?? '4-3-3');
    setLayout(t?.layout ? [...t.layout] : null);
    setLogo(t?.logo ?? null);
    setSelected(null);
    setSlots(t ? t.slots.map((s) => s.careerId) : Array(LINEUP_SIZE).fill(null));
  }

  /** silent: T-11-111 당겨서 새로고침 — 화면을 비우지 않고, 편집 중인 초안·고른 칸은 그대로 두고 바뀐 값만 반영한다. */
  async function load(want?: number, silent = false) {
    const sequence = ++loadSequence.current;
    if (!silent) {
      setDraftKey(null);
      setPendingDraft(null);
      setRestored(false);
      setStatus('loading');
    }
    const r = await fetchOwnerTeam(want);
    if (sequence !== loadSequence.current) return;
    if (silent && !r.ok) return;
    if (!r.ok) {
      const login = needsOwnerLogin(r.error);
      setNeedLogin(login);
      setStatus(login ? 'ready' : 'error');
      return;
    }
    const d = r.data;
    setSeason(d.season);
    setCurrent(d.current);
    setSeasons(d.seasons);
    setLastManager(d.lastManager);
    setPlayers(d.players);
    setMatchesLeft(d.matchesLeft);
    setPerDay(d.matchesPerDay);
    setBudget(budgetOf(d));
    if (silent) {
      if (JSON.stringify(d.team) !== JSON.stringify(teamNow.current)) {
        if (dirtyNow.current) setTeam(d.team);
        else applyTeam(d.team, d.lastManager);
      }
      return;
    }
    setNeedLogin(false);
    applyTeam(d.team, d.lastManager);
    const profile = accountCache.value;
    const key =
      d.team?.id ??
      (profile && typeof profile === 'object' ? `new:${profile.id}:${d.season}` : null);
    if (teamEditableIn(d.season, d.current) && key) {
      const draft = readTeamDraft(key);
      setDraftKey(key);
      if (draft) {
        if (draft.base === teamDraftBase(d.team)) applyDraft(draft.value);
        else setPendingDraft(draft);
      }
    }
    setStatus('ready');
  }
  /** 시즌을 바꿔 본다(지난 시즌 팀은 보기만). */
  function pickSeason(id: number) {
    show('team');
    void load(id);
  }
  useEffect(() => {
    void load();
    // 처음 한 번만.
  }, []);
  // T-11-182 은퇴 기록이 아직 서버에 없으면 알리고, 올라가면 팀·라커룸을 조용히 다시 받는다(편집 중인 팀은 그대로).
  const [retireSyncing, setRetireSyncing] = useState(() => pendingRetirementIds().size > 0);
  // T-11-301 올리기가 멈춘 것 같을 때 사용자가 바로 다시 보낸다.
  const [retireRetry, setRetireRetry] = useState<'idle' | 'busy' | 'failed'>('idle');
  async function retryRetireSync() {
    if (retireRetry === 'busy') return;
    setRetireRetry('busy');
    await retryOutboxNow();
    const still = pendingRetirementIds().size > 0;
    setRetireSyncing(still);
    setRetireRetry(still ? 'failed' : 'idle');
  }
  useEffect(
    () =>
      onRetirementSynced(() => {
        setRetireSyncing(pendingRetirementIds().size > 0);
        if (editable) void load(season, true);
      }),
    [season, editable],
  );

  // ───────── 편성 ─────────
  async function save(): Promise<boolean> {
    if (savingRef.current || !nameOk) return false;
    if (salary?.state === 'over') {
      toast(TC.salaryOverSave({ n: salary.sum, max: salary.budget }));
      return false;
    }
    if (cupBar?.block) {
      toast(cupBar.block);
      return false;
    }
    savingRef.current = true;
    setSaving(true);
    const snapshot = JSON.stringify(draftNow.current);
    const body = {
      ...draftValue,
      name: name.trim(),
      manager: manager.trim(),
      ...(season > 0 ? { layout: positions } : {}),
    };
    try {
      const r = await saveOwnerTeam(legacy ? { ...body, season: 0 } : body);
      if (!r.ok) {
        toast(r.error.message);
        // 컵 검사(잠금 · 상한 · 최소 인원)에 걸렸으면 띠를 다시 받는다.
        if (r.error.reason?.startsWith('CUP_')) void cupState.reload(true);
        return false;
      }
      const unchanged = JSON.stringify(draftNow.current) === snapshot;
      const created = !team;
      if (unchanged) {
        applyTeam(r.data.team);
        setRenaming(false);
        setRestored(false);
      } else setTeam(r.data.team);
      if (draftKey)
        writeTeamDraft(
          draftKey,
          unchanged ? null : { base: teamDraftBase(r.data.team), value: draftNow.current! },
        );
      setDraftKey(r.data.team.id);
      toast(created ? L.toastCreated : L.toastSavedApp);
      return unchanged;
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  }
  // T-11-188 선수 잠금 — 잠긴 선수는 이적시장에 내놓거나 방출할 수 없다.
  async function toggleLock(p: TeamPlayer) {
    const r = await setCardLock(p.careerId, !p.locked);
    if (!r.ok) return toast(r.error.message);
    setPlayers((prev) =>
      prev.map((x) => (x.careerId === p.careerId ? { ...x, locked: r.data.locked } : x)),
    );
    toast(r.data.locked ? MARKET_TOAST.locked : MARKET_TOAST.unlocked);
  }

  // ───────── 프리셋 (T-11-217) ─────────
  async function persistPresets(next: TeamPreset[], saved = false) {
    const r = await saveTeamPresets(legacy ? { presets: next, season: 0 } : { presets: next });
    if (!r.ok) {
      toast(r.error.message);
      return false;
    }
    setTeam((t) => (t ? { ...t, presets: r.data.presets } : t));
    if (saved) toast(L.tpSaved);
    return true;
  }
  function applyPreset(p: TeamPreset) {
    const r = loadPreset(p, new Set(players.map((x) => x.careerId)));
    setFormation(r.formation);
    setLayout(r.layout);
    setSlots(r.slots);
    setSelected(null);
    setPresetsOpen(false);
    toast(r.missing ? L.tpLoadedMissing({ n: r.missing }) : L.tpLoaded);
  }

  async function saveAndFind() {
    if (await save()) await loadOpponents();
  }

  // ───────── 경기 ─────────
  async function loadOpponents(silent = false) {
    oppLoaded.current = true;
    if (!silent) setOppStatus('loading');
    const r = await fetchOpponents();
    if (!r.ok) return silent ? undefined : setOppStatus('error');
    setOpponents(r.data.items);
    setOppStatus('ready');
  }

  async function challenge(o: TeamOpponent) {
    if (playing) return;
    setPlaying(true);
    // T-11-387 랭크 경기는 문자중계 도중 장면을 고르는 경기로 시작한다(결과는 중계가 끝날 때 onfinal로 온다).
    const r = await playLiveMatch(o.teamId);
    setPlaying(false);
    if (!r.ok) {
      if (r.error.reason === 'TEAM_MATCH_DAILY_LIMIT') setMatchesLeft(0);
      if (r.error.reason === 'TEAM_OPPONENT_DAILY_LIMIT')
        setOpponents((list) => list.filter((x) => x.teamId !== o.teamId));
      return toast(r.error.message);
    }
    setResultOrigin('opponents');
    setResult(r.data.match);
    setLiveMoments(r.data.live);
    setLive(true);
    setMatchesLeft(r.data.matchesLeft);
    applyPlayed(r.data);
    show('result');
    scrollTo(0);
  }

  /** 경기 결과의 기록 · 레이팅을 내 팀에 반영한다(장면 경기는 시작 때 경기 전 값, 끝날 때 결과 값이 온다). */
  function applyPlayed(r: PlayTeamMatchResponse) {
    setTeam((t) => (t ? { ...t, record: r.record, rating: r.rating } : t));
  }

  /** 장면 경기가 끝났어요. 결과 화면을 마감한 경기로 바꾼다. */
  function liveFinal(r: PlayTeamMatchResponse) {
    setResult(r.match);
    setLiveMoments(undefined);
    setMatchesLeft(r.matchesLeft);
    applyPlayed(r);
  }

  /** 친구 칸에서 친선전을 치렀거나(중계부터) 최근 친선전을 열 때(결과부터). 친선전은 레이팅·전적을 건드리지 않는다. */
  function showFriendly(m: TeamMatch, withLive: boolean) {
    setResultOrigin('opponents');
    setResult(m);
    setLiveMoments(undefined);
    setLive(withLive);
    show('result');
    scrollTo(0);
  }
  function pickOppTab(t: OppTab) {
    setOppTab(t);
    if (t === 'friends') friends.ensure();
    else if (!oppLoaded.current && !matchHint) void loadOpponents();
  }

  // ───────── 시즌 업적 ─────────
  async function loadAchievements(want = season, silent = false) {
    if (!silent) setAchStatus('loading');
    const r = await fetchClubAchievements(want);
    if (!r.ok) return silent ? undefined : setAchStatus('error');
    setAch(r.data);
    // T-11-034 가장 최근 시즌을 열면 본 것으로 적고, 지난번 뒤로 새로 오른 업적에 NEW를 붙인다(웹 Team.svelte).
    const latest = Math.max(r.data.season, ...r.data.seasons.map((o) => o.id));
    setAchNewIds(r.data.season === latest ? achNudge.viewed(r.data) : new Set());
    setAchStatus('ready');
  }

  async function loadHistory(silent = false) {
    if (!silent) setHistStatus('loading');
    const r = await fetchTeamMatches(season);
    if (!r.ok) return silent ? undefined : setHistStatus('error');
    setHistory(r.data.items);
    setHistNext(r.data.next ?? null);
    setMoreStatus('idle');
    setHistStatus('ready');
  }
  async function loadMore() {
    if (!histNext || moreStatus === 'loading') return;
    setMoreStatus('loading');
    const r = await fetchTeamMatches(season, histNext);
    if (!r.ok) return setMoreStatus('error');
    setHistory((prev) => {
      const seen = new Set(prev.map((m) => m.id));
      return [...prev, ...r.data.items.filter((m) => !seen.has(m.id))];
    });
    setHistNext(r.data.next ?? null);
    setMoreStatus('idle');
  }
  async function loadStats(silent = false) {
    if (!silent) setStatsStatus('loading');
    const r = await fetchTeamStats(season);
    if (!r.ok) return silent ? undefined : setStatsStatus('error');
    setStats(r.data);
    setStatsStatus('ready');
  }
  function openStats(focus: string | null = null) {
    setStatsFocus(focus);
    switchView('stats');
  }

  // 화면마다 불러올 내용. 다른 화면에서 들어오면(뒤로·앞으로 가기 포함) 아래 effect가, 이미 그 화면이면 open이 다시 불러온다.
  const LOAD = {
    opponents: () =>
      destination.friends || oppTab === 'friends'
        ? friends.ensure()
        : matchHint
          ? undefined
          : loadOpponents(),
    achievements: () => loadAchievements(),
    history: loadHistory,
    stats: loadStats,
  };
  function open(v: keyof typeof LOAD) {
    if (appState.teamView === v) void LOAD[v]();
    else show(v);
  }
  useEffect(() => {
    if (status !== 'ready' || needLogin) return;
    if (destination.friends || destination.history) return;
    if (teamView === 'opponents') void LOAD.opponents();
    else if (teamView === 'achievements') void loadAchievements();
    else if (teamView === 'history') void loadHistory();
    else if (teamView === 'stats') void loadStats();
    // 화면·상태가 바뀔 때만(시즌 등 다른 값 변화로는 다시 부르지 않는다).
  }, [teamView, status, needLogin]);

  // T-11-111 당겨서 새로고침 — 팀(전적·남은 경기·선수)과 지금 보는 탭의 목록을 조용히 다시 받는다.
  // 저장·경기 중이면 건너뛰고, 아직 불러온 적 없는 탭은 열 때 불러오므로 건드리지 않는다.
  useOnPull(() => {
    if (status !== 'ready' || needLogin || savingRef.current || playing) return;
    return Promise.all([
      load(season, true),
      teamView === 'opponents'
        ? oppTab === 'friends'
          ? friends.refresh()
          : oppLoaded.current && !matchHint
            ? loadOpponents(true)
            : null
        : teamView === 'achievements'
          ? loadAchievements(season, true)
          : teamView === 'history'
            ? loadHistory(true)
            : teamView === 'stats'
              ? loadStats(true)
              : null,
    ]);
  });

  /** 탭을 바꾸면 맨 위에서 시작하고, 보고 있는 탭을 다시 누르면 맨 위로 부드럽게 올린다(게임 화면 탭과 같다). */
  function switchView(v: TeamView) {
    if (view === v) return scrollTo(0, prefs.motionOK);
    show(v);
    scrollTo(0);
  }
  const navOn = view === 'result' ? resultOrigin : view === 'stats' ? 'history' : view;
  const navItems: TabItem[] = nav().map(([k, label, icon]) => ({
    key: icon,
    label,
    active: navOn === k,
    onPress: () => switchView(k),
    testID: `team-tab-${k}`,
    ...(k === 'achievements' ? { dot: achNew } : {}),
    ...(k === 'opponents' && friendReq
      ? { dot: friendReq, dotLabel: S.friendReq({ n: friendReq }) }
      : {}),
  }));
  navItems.splice(2, 0, {
    key: 'owner',
    label: L.navOwner,
    active: false,
    onPress: () => go('owner'),
    testID: 'team-back',
  });

  let body;
  if (needLogin) {
    body = (
      <Card gap={10}>
        <Txt v="eyebrow">My team</Txt>
        <Txt v="h1" accessibilityRole="header">
          {L.myTeam}
        </Txt>
        <Txt tone="muted">{L.loginOnly}</Txt>
        <LoginButtons block={false} />
      </Card>
    );
  } else if (view === 'achievements') {
    body = (
      <TeamAchievements
        ach={ach}
        status={achStatus}
        newIds={achNewIds}
        load={(s) => void loadAchievements(s)}
      />
    );
  } else if (view === 'team') {
    body = (
      <>
        <Card gap={10}>
          {seasons.length > 1 ? (
            <SelectField
              label={L.seasonLabel}
              testID="team-season"
              value={season}
              options={seasons.map((o) => ({
                value: o.id,
                label: `${o.name}${o.id === current ? L.seasonNow : ''}`,
              }))}
              onChange={pickSeason}
            />
          ) : (
            <Txt v="eyebrow">{`My team · ${seasonName}`}</Txt>
          )}
          <View style={{ flexDirection: 'row', gap: 10, alignItems: 'center' }}>
            <TeamLogo name={name || team?.name || 'FC'} logo={logo} />
            <View style={{ flex: 1, minWidth: 0 }}>
              <Txt v="h2" accessibilityRole="header">
                {name || team?.name || (editable ? L.createTeam : L.noTeam)}
              </Txt>
              <Txt
                v="sm"
                tone="muted"
              >{`${manager || team?.manager ? L.managerLine({ name: (manager || team?.manager)! }) : L.managerMine}${dirty && team ? ` · ${L.unsaved}` : ''}`}</Txt>
            </View>
            <OvrBadge ovr={ovr} />
          </View>
          {team ? (
            <Txt v="sm" tone="muted" testID="team-record">
              {L.recordLineApp({
                record: recordText(team.record),
                rating: num(team.rating),
                tail: legacy
                  ? L.friendlyOnly
                  : editable
                    ? L.todayApp({ left: matchesLeft, per: perDay })
                    : L.statPast,
              })}
            </Txt>
          ) : legacy ? null : (
            <Txt v="sm" tone="muted">
              {L.introApp({ ovr: YOUTH_OVR })}
            </Txt>
          )}
          {legacy ? (
            <Txt v="sm" tone="muted" testID="team-legacy">
              {preseasonTeamNote()}
            </Txt>
          ) : null}
          {editable ? (
            <Btn sm kind="ghost" testID="team-more" onPress={() => setMenu(true)}>
              {L.more}
            </Btn>
          ) : (
            <Txt v="sm" tone="muted" testID="team-readonly">
              {L.readonlyNote}
            </Txt>
          )}
          {editable && (!team || renaming) ? (
            <View style={{ gap: 10 }}>
              <Field label={L.teamNameLabel}>
                <TextField
                  value={name}
                  onChangeText={setName}
                  maxLength={TEAM_NAME_MAX}
                  testID="team-name"
                  accessibilityLabel={L.teamNameLabel}
                  accessibilityHint={nameIssues.name}
                />
                {nameIssues.name ? (
                  <Txt v="sm" tone="muted">
                    {nameIssues.name}
                  </Txt>
                ) : null}
              </Field>
              <Field label={L.managerNameLabel}>
                <TextField
                  value={manager}
                  onChangeText={setManager}
                  maxLength={MANAGER_NAME_MAX}
                  testID="team-manager"
                  accessibilityLabel={L.managerNameLabel}
                  accessibilityHint={nameIssues.manager}
                />
                {nameIssues.manager ? (
                  <Txt v="sm" tone="muted">
                    {nameIssues.manager}
                  </Txt>
                ) : null}
                <Txt v="sm" tone="muted" testID="team-manager-note">
                  {L.managerNameNote}
                </Txt>
              </Field>
            </View>
          ) : null}
        </Card>
        {pendingDraft ? (
          <Card>
            <Txt v="sm">{L.draftChangedApp}</Txt>
            <Btn
              onPress={() => {
                applyDraft(pendingDraft.value);
                setPendingDraft(null);
              }}
            >
              {L.draftLoadApp}
            </Btn>
            <Btn
              kind="ghost"
              onPress={() => {
                if (draftKey) writeTeamDraft(draftKey, null);
                setPendingDraft(null);
              }}
            >
              {L.draftKeep}
            </Btn>
          </Card>
        ) : restored ? (
          <Card>
            <Txt v="sm">{L.draftRestoredApp}</Txt>
            <Btn
              sm
              kind="ghost"
              onPress={() => {
                applyTeam(team);
                setRestored(false);
                if (draftKey) writeTeamDraft(draftKey, null);
              }}
            >
              {L.draftRevertApp}
            </Btn>
          </Card>
        ) : null}
        {editable || team ? (
          <>
            {editable && !legacy ? <CupLockNotice state={cupState} bar={cupBar} /> : null}
            <Card gap={8}>
              <View
                style={{
                  flexDirection: 'row',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                }}
              >
                <Txt v="h2">{L.groundTitle}</Txt>
                <Txt v="sm" tone="muted">
                  {L.startersYouthApp({ n: filled, y: LINEUP_SIZE - filled })}
                </Txt>
              </View>
              {editable ? (
                <View style={{ flexDirection: 'row', justifyContent: 'flex-end' }}>
                  <Btn sm onPress={() => setPresetsOpen(true)} testID="team-presets">
                    {L.tpButton}
                  </Btn>
                </View>
              ) : null}
              {editable ? (
                <SortChips
                  label={L.formationLabelApp}
                  value={layout ? (matchShape(layout) ?? '') : formation}
                  // T-11-216 시즌 1 배치 프리셋(세부 포지션 자리). 프리시즌 팀은 옛 세 가지만.
                  items={[...FORMATION_IDS, ...(season > 0 ? SHAPE_IDS : [])].map((key) => ({
                    key,
                    label: key,
                  }))}
                  onPick={(key) => {
                    const id = SHAPE_IDS.find((s) => s === key);
                    setFormation(id ? shapeBase(id) : (key as FormationId));
                    setLayout(id ? shapeLayout(id) : null);
                  }}
                  testIDPrefix="formation"
                />
              ) : null}
              <TeamLines lines={lines} coach={coachBonus} />
              <TeamSynergy
                synergy={synergy}
                season={season}
                focus={synFocus}
                setFocus={setSynFocus}
              />
              <View style={{ flexDirection: 'row', gap: 8 }}>
                {editable ? (
                  <Btn
                    sm
                    testID="team-auto"
                    disabled={!players.length}
                    style={{ flex: 1 }}
                    onPress={() => setSlots(autoFillSlots(slotCodes, players, season, budget))}
                  >
                    {L.autoPlace}
                  </Btn>
                ) : null}
                <Btn
                  sm
                  testID="team-share"
                  style={{ flex: 1 }}
                  onPress={() =>
                    setShare({
                      name: name || team?.name || L.shareDefaultNameApp,
                      manager,
                      logo,
                      formation,
                      layout: positions,
                      cells,
                      ovr,
                      lines,
                      draft: dirty,
                      season: seasonName,
                    })
                  }
                >
                  {L.shareImageApp}
                </Btn>
              </View>
              {salary ? <SalaryBar salary={salary} /> : null}
              {editable ? (
                <Txt v="xs" tone="muted">
                  {L.dragHintApp}
                </Txt>
              ) : null}
              {editable && retireSyncing ? (
                <View style={{ gap: 6 }}>
                  <Txt v="xs" tone="muted" testID="team-retire-syncing">
                    {retireRetry === 'failed' ? L.retireSyncFailed : L.retireSyncing}
                  </Txt>
                  <Btn
                    sm
                    testID="team-retire-retry"
                    disabled={retireRetry === 'busy'}
                    onPress={() => void retryRetireSync()}
                  >
                    {retireRetry === 'busy' ? L.retireSyncRetrying : L.retireSyncRetry}
                  </Btn>
                </View>
              ) : null}
            </Card>
            {editable && anonNames.length ? (
              <Card testID="team-anon-names">
                <Txt v="sm">{HO.anonCardsNote({ n: anonNames.length })}</Txt>
                <Btn sm testID="anon-names" disabled={namesBusy} onPress={askPublishNames}>
                  {HO.anonCardsBtn}
                </Btn>
              </Card>
            ) : null}
            {team && season === current ? (
              // T-11-310 감독 칸: 감독은 감독 커리어 화면에서 고른다.
              <Card gap={8} testID="team-coach">
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                  <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
                    <Txt bold>{MG.teamCoach}</Txt>
                    <Txt tone="muted" style={{ fontSize: rem(FONT.label) }}>
                      {team.coach
                        ? coachSummary(team.coach, formation, localNames)
                        : MG.teamCoachEmpty}
                    </Txt>
                  </View>
                  <Btn sm testID="team-coach-manage" onPress={() => go('manager')}>
                    {MG.teamCoachManage}
                  </Btn>
                </View>
                {coachDetail ? (
                  <>
                    <DisclosureRow
                      open={coachOpen}
                      onToggle={() => setCoachOpen((v) => !v)}
                      label={MG.breakdown}
                      testID="team-coach-breakdown"
                    />
                    {coachOpen ? (
                      <View style={{ gap: 8 }}>
                        {coachDetail.rows.map((r) => (
                          <View key={r.line} style={{ gap: 2 }} testID={`coach-line-${r.line}`}>
                            <Txt bold>
                              {r.label} {r.total}
                            </Txt>
                            <Txt tone="muted" style={{ fontSize: rem(FONT.label) }}>
                              {r.parts}
                            </Txt>
                            {r.capped ? (
                              <Txt style={{ fontSize: rem(FONT.label) }}>{r.capped}</Txt>
                            ) : null}
                          </View>
                        ))}
                        {coachDetail.off.length ? (
                          <Txt tone="muted" style={{ fontSize: rem(FONT.label) }}>
                            {MG.breakdownOff({ names: coachDetail.off.join(' · ') })}
                          </Txt>
                        ) : null}
                        <Txt tone="muted" style={{ fontSize: rem(FONT.label) }}>
                          {MG.breakdownNote}
                        </Txt>
                      </View>
                    ) : null}
                  </>
                ) : null}
              </Card>
            ) : null}
            <TeamLineup
              formation={formation}
              layout={positions}
              slots={slots}
              cells={cells}
              players={players}
              editable={editable}
              nameOf={nameOf}
              selected={selected}
              select={setSelected}
              dragging={setDragging}
              jumpRef={jump}
              synLinks={syn.links}
              synFocus={syn.members}
              synApplied={syn.applied}
              synCaption={synergyApplies(season) ? syn.caption : null}
              onLock={(p) => void toggleLock(p)}
              focusSlot={focusSlot}
              onFocused={() => setFocusSlot(null)}
              season={season}
              salary={salary}
              change={(nextSlots, nextLayout) => {
                // T-11-376 지난 시즌 선수는 급여 예산 안에서만.
                if (salaryBlocks(slots, nextSlots, byId, season, budget)) {
                  const added = nextSlots.find((id) => id !== null && !slots.includes(id)) ?? null;
                  return toast(salaryFullText(nextSlots, added, byId, season, budget));
                }
                setSlots(nextSlots);
                setLayout(nextLayout);
              }}
            />
          </>
        ) : null}
      </>
    );
  } else if (view === 'opponents') {
    body = (
      <>
        <OppSwitch value={oppTab} onPick={pickOppTab} pending={friendReq} />
        {oppTab === 'friends' ? (
          <TeamFriends
            friends={friends}
            onPlayed={(m) => showFriendly(m, true)}
            onOpen={(m) => showFriendly(m, false)}
            onPreseason={() => {
              // T-11-113 프리시즌 팀 꾸리기 — 시즌 고르기에서 프리시즌을 고르고 팀 탭으로 가는 것과 같다.
              pickSeason(0);
              scrollTo(0);
            }}
          />
        ) : (
          <TeamOpponents
            rating={team?.rating ?? TEAM_RATING_START}
            matchesLeft={matchesLeft}
            perDay={perDay}
            opponents={opponents}
            status={oppStatus}
            playing={playing}
            reload={() => void loadOpponents()}
            challenge={(o) => void challenge(o)}
            hint={matchHint}
            toTeam={editable ? () => switchView('team') : undefined}
            saveAndFind={
              editable && !legacy && dirty && team ? () => void saveAndFind() : undefined
            }
            saving={saving}
            canSave={nameOk}
          />
        )}
      </>
    );
  } else if (view === 'result' && result) {
    body = live ? (
      <TeamLive
        key={result.id}
        match={result}
        name={eventName}
        live={liveMoments}
        onfinal={liveFinal}
        onend={() => {
          setLive(false);
          setLiveMoments(undefined);
          scrollTo(0);
        }}
      />
    ) : (
      <TeamResult
        m={result}
        team={team}
        eventName={eventName}
        matchesLeft={matchesLeft}
        toTeam={() => show(resultOrigin === 'history' ? 'history' : 'team')}
        backLabel={resultOrigin === 'history' ? L.backToHistoryApp : L.backToLineupApp}
        onPlayer={(id) => openStats(id)}
        fix={reportFix}
        replay={() => {
          setLiveMoments(undefined);
          setLive(true);
        }}
        again={() => {
          if (result.friendly) {
            setOppTab('friends');
            show('opponents');
            scrollTo(0);
          } else {
            setOppTab('ranked');
            open('opponents');
          }
        }}
      />
    );
  } else if (view === 'history') {
    body = (
      <TeamHistory
        history={history}
        status={histStatus}
        reload={() => void loadHistory()}
        open={(m) => {
          setResultOrigin('history');
          setResult(m);
          setLiveMoments(undefined);
          setLive(false);
          show('result');
        }}
        record={team?.record ?? null}
        seasonName={seasonName}
        more={!!histNext}
        moreStatus={moreStatus}
        onMore={() => void loadMore()}
        onStats={() => openStats()}
      />
    );
  } else if (view === 'stats') {
    body = (
      <TeamStats
        stats={stats}
        status={statsStatus}
        seasonName={seasonName}
        focus={statsFocus}
        name={eventName}
        reload={() => void loadStats()}
        back={() => switchView('history')}
      />
    );
  }

  return (
    <>
      <BarBelow.Provider value={!needLogin}>
        <View style={{ flex: 1, backgroundColor: c.bg }}>
          <Screen
            scrollEnabled={!dragging}
            footer={
              needLogin ? (
                <BackBar fallback={() => (appState.screen = 'owner')} testID="team-back" />
              ) : view === 'team' && editable && (selected || dirty) ? (
                <View
                  style={{
                    paddingHorizontal: 16,
                    paddingVertical: 8,
                    gap: 6,
                    borderTopWidth: 1,
                    borderColor: c.line,
                    backgroundColor: c.surface,
                  }}
                >
                  {selected ? (
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                      <Txt v="sm" numberOfLines={1} style={{ flex: 1 }}>
                        {players.find((p) => p.careerId === selected)
                          ? nameOf(players.find((p) => p.careerId === selected)!)
                          : L.pickPlayerApp}
                      </Txt>
                      <Btn sm onPress={() => jump.current?.()}>
                        {L.toGround}
                      </Btn>
                      <Btn sm kind="ghost" onPress={() => setSelected(null)}>
                        {L.cancel}
                      </Btn>
                    </View>
                  ) : null}
                  {dirty && (!nameOk || cupBar?.block) ? (
                    <Txt
                      v="sm"
                      tone="muted"
                      accessibilityLiveRegion="polite"
                      testID="team-save-reason"
                    >
                      {nameIssues.name || nameIssues.manager || cupBar?.block}
                    </Txt>
                  ) : null}
                  {dirty ? (
                    <Btn
                      kind="primary"
                      block
                      testID="team-save"
                      disabled={saving || !nameOk || !!pendingDraft || !!cupBar?.block}
                      onPress={() => void save()}
                    >
                      {saving ? L.saving : team ? L.saveLineupApp : L.createTeam}
                    </Btn>
                  ) : null}
                </View>
              ) : undefined
            }
          >
            <Topbar />
            <LoadState
              status={status}
              failText={L.loadFail}
              retry={() => void load()}
              skeleton={<PitchSkeleton />}
            >
              {body}
            </LoadState>
          </Screen>
          {needLogin ? null : <TabBar label={L.navLabel} items={navItems} sub="team" />}
        </View>
      </BarBelow.Provider>
      {presetsOpen ? (
        <TeamPresets
          close={() => setPresetsOpen(false)}
          presets={team?.presets ?? []}
          hasTeam={!!team}
          locked={!!cupState.me?.locked}
          draft={(presetName) =>
            presetOf(presetName, formation, slots, season > 0 ? positions : null)
          }
          persist={persistPresets}
          onLoad={applyPreset}
        />
      ) : null}
      {menu ? (
        <TeamDialog title={L.menuTitleApp} close={() => setMenu(false)}>
          <Btn
            testID="team-logo-edit"
            onPress={() => {
              setMenu(false);
              setEditingLogo(true);
            }}
          >
            {L.menuLogo}
          </Btn>
          <Btn
            testID="team-rename"
            onPress={() => {
              setMenu(false);
              setRenaming(true);
              scrollTo(0);
            }}
          >
            {L.menuRename}
          </Btn>
        </TeamDialog>
      ) : null}
      {editingLogo ? (
        <TeamLogoEditor
          name={name}
          logo={logo}
          apply={setLogo}
          close={() => setEditingLogo(false)}
        />
      ) : null}
      {share ? <TeamShare data={share} close={() => setShare(null)} /> : null}
    </>
  );
}

// T-11-392 팀을 불러오는 동안: 팀 이름 줄 + 4-3-3 자리 점이 찍힌 그라운드(웹 Team.svelte .tm-sk).
const SK_DOTS = [
  [50, 90],
  [14, 70],
  [38, 73],
  [62, 73],
  [86, 70],
  [25, 48],
  [50, 51],
  [75, 48],
  [20, 22],
  [50, 18],
  [80, 22],
] as const;
function PitchSkeleton() {
  const block = useSkeletonBlock();
  return (
    <SkeletonFrame testID="team-skeleton">
      <View style={[block, { width: '52%', height: 24, borderRadius: RADIUS.sm }]} />
      <View style={[block, { width: '100%', aspectRatio: 2 / 3, borderRadius: RADIUS.md }]}>
        {SK_DOTS.map(([x, y], i) => (
          <View
            key={i}
            style={{
              position: 'absolute',
              left: `${x}%`,
              top: `${y}%`,
              width: 32,
              height: 32,
              marginLeft: -16,
              marginTop: -16,
              borderRadius: RADIUS.lg,
              backgroundColor: block.borderColor,
            }}
          />
        ))}
      </View>
    </SkeletonFrame>
  );
}
