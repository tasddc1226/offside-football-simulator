// T-10-092 구단주 팀(웹 team/Team.svelte) — 시즌마다 그 시즌에 뛰고 은퇴한 내 선수로 11명을 꾸려(빈 자리는 유스 선수가
// 채운다) 같은 시즌 다른 구단주의 팀과 겨룬다. 지난 시즌 팀은 보기만 한다. 경기 결과는 서버가 정한다(앱은 보여 주기만).
// 편성·후보·업적 표기 같은 순수 계산은 웹과 같은 @offside/app-core/teamOwner.
import { useEffect, useMemo, useRef, useState } from 'react';
import { View } from 'react-native';
import { useSnapshot } from 'valtio';
import {
  FORMATION_IDS,
  presetLayout,
  type TeamPosition,
  LINEUP_SIZE,
  MANAGER_NAME_MAX,
  MANAGER_NAME_MIN,
  TEAM_NAME_MAX,
  TEAM_NAME_MIN,
  YOUTH_NAME,
  YOUTH_OVR,
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
import { type TeamView } from '@offside/app-core/state';
import { recordText, num } from '@offside/app-core/teamText';
import {
  autoFillSlots,
  draftLines,
  matchHintOf,
  slotsSynergy,
  synergyFocus,
} from '@offside/app-core/teamOwner';
import { anonName } from '@offside/game/pos-label';
import { localCareerNames } from '@offside/game/season';
import { LoadState, type LoadStatus } from '../../components/LoadState';
import { TeamLines } from '../../components/TeamPitch';
import { TeamSynergy } from '../../components/TeamSynergy';
import { toast } from '../../game/host';
import { go } from '../../game/nav';
import { achNudge } from '../../game/achNudge';
import { accountCache, appState, prefs } from '../../store';
import { notificationDestination } from '../../platform/notificationDestination';
import { useColors } from '../../theme/useColors';
import { BackBar, Btn, Card, Screen, Topbar, Txt, scrollTo } from '../../ui';
import { BarBelow } from '../../ui/Screen';
import { TabBar, type TabItem } from '../../ui/TabBar';
import type { TabIconName } from '../../ui/TabIcon';
import { Field, SelectField, TextField } from '../settings/parts';
import { LoginButtons } from './LoginButtons';
import { TeamAchievements } from './TeamAchievements';
import { TeamFriends, OppSwitch, useFriends, type OppTab } from './TeamFriends';
import { TeamHistory } from './TeamHistory';
import { TeamLive } from './TeamLive';
import { TeamOpponents } from './TeamOpponents';
import { OvrBadge } from './TeamParts';
import { TeamLineup } from './TeamLineup';
import { TeamLogo } from '../../components/TeamLogo';
import { TeamLogoEditor } from './TeamLogoEditor';
import { TeamShare, type TeamShareData } from './TeamShare';
import { TeamDialog } from '../../components/TeamDialog';
import type { TeamLogo as Logo } from '@offside/contracts/team-logo';
import type { PutOwnerTeamBody } from '@offside/contracts';
import { readTeamDraft, writeTeamDraft, teamDraftBase, type TeamDraft } from './teamDraft';
import { RecordsChips as SortChips } from '../hof/RecordsControls';
import { TeamResult } from './TeamResult';

const between = (v: string, min: number, max: number) =>
  v.trim().length >= min && v.trim().length <= max;

// T-11-026 내 팀 하단 메뉴 — 편성 · 경기 · (가운데) 구단주 · 업적 · 기록. 경기 결과는 '경기' 탭 안이다.
const NAV: [TeamView, string, TabIconName][] = [
  ['team', '편성', 'lineup'],
  ['opponents', '경기', 'season'],
  ['achievements', '업적', 'trophy'],
  ['history', '경기 기록', 'career'],
];

export default function Team() {
  const c = useColors();
  const { teamView, achNew } = useSnapshot(appState);
  const [status, setStatus] = useState<LoadStatus>('loading');
  const [needLogin, setNeedLogin] = useState(false);
  const [team, setTeam] = useState<OwnerTeam | null>(null);
  const [players, setPlayers] = useState<TeamPlayer[]>([]);
  const [matchesLeft, setMatchesLeft] = useState(0);
  const [perDay, setPerDay] = useState(0);
  /** 보고 있는 시즌 · 지금 고치고 겨루는 시즌(휴식기면 null) · 고를 수 있는 시즌. */
  const [season, setSeason] = useState(0);
  const [synFocus, setSynFocus] = useState<string | null>(null);
  const [current, setCurrent] = useState<number | null>(null);
  const [seasons, setSeasons] = useState<OwnerTeamResponse['seasons']>([]);
  const [lastManager, setLastManager] = useState<string | null>(null);
  const editable = season === current;
  const seasonName = seasons.find((o) => o.id === season)?.name ?? '';

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
  const [resultOrigin, setResultOrigin] = useState<'opponents' | 'history'>('opponents');
  const [history, setHistory] = useState<TeamMatch[]>([]);
  const [histStatus, setHistStatus] = useState<LoadStatus>('loading');
  const [ach, setAch] = useState<ClubAchievementsResponse | null>(null);
  const [achStatus, setAchStatus] = useState<LoadStatus>('loading');
  /** T-11-034 지난번 업적 탭을 본 뒤 새로 오른 업적(NEW). */
  const [achNewIds, setAchNewIds] = useState<ReadonlySet<string>>(new Set());

  // T-10-130 팀 안의 화면은 appState.teamView — 뒤로 가기로 오간다. 결과는 이 화면에만 있어 다시 들어왔을 때(앞으로
  // 가기) 없으면 팀을 보여 준다.
  const view: TeamView = teamView === 'result' && !result ? 'team' : teamView;
  const show = (v: TeamView) => {
    appState.teamView = v;
  };

  // 서버에는 비공개 이름이 없다 — 이 기기에서 은퇴한 선수는 이 기기에 남은 이름을 쓴다.
  const localNames = useMemo(() => localCareerNames(), []);
  const byId = new Map(players.map((p) => [p.careerId, p]));
  const nameOf = (p: TeamPlayer) =>
    localNames.get(p.careerId) ?? p.publicName ?? anonName(p.pos, p.number);
  const eventName = (id: string | null, fallback: string) => (id && localNames.get(id)) || fallback;

  const positions = layout ?? presetLayout(formation);
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
  const filled = slots.filter((s) => s !== null).length;
  const dirty =
    !team ||
    name.trim() !== team.name ||
    manager.trim() !== team.manager ||
    JSON.stringify(logo) !== JSON.stringify(team.logo ?? null) ||
    JSON.stringify(layout) !== JSON.stringify(team.layout ?? null) ||
    formation !== team.formation ||
    slots.some((id, i) => id !== (team.slots[i]?.careerId ?? null));
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
        ? { peak: p.peak, number: p.number, legendScore: p.legendScore, nation: p.nation }
        : {}),
    };
  });
  const matchHint = matchHintOf(team, dirty, matchesLeft, season, current);
  const draftValue: PutOwnerTeamBody = { name, manager, logo, formation, slots, layout };
  draftNow.current = draftValue;
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

  async function load(want?: number) {
    const sequence = ++loadSequence.current;
    setDraftKey(null);
    setPendingDraft(null);
    setRestored(false);
    setStatus('loading');
    const r = await fetchOwnerTeam(want);
    if (sequence !== loadSequence.current) return;
    if (!r.ok) {
      const login =
        r.error.reason === 'GOOGLE_LOGIN_REQUIRED' || r.error.code === 'PROFILE_REQUIRED';
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
    setNeedLogin(false);
    applyTeam(d.team, d.lastManager);
    const profile = accountCache.value;
    const key =
      d.team?.id ??
      (profile && typeof profile === 'object' ? `new:${profile.id}:${d.season}` : null);
    if (d.season === d.current && key) {
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

  // ───────── 편성 ─────────
  async function save(): Promise<boolean> {
    if (savingRef.current || !nameOk) return false;
    savingRef.current = true;
    setSaving(true);
    const snapshot = JSON.stringify(draftNow.current);
    const body = { ...draftValue, name: name.trim(), manager: manager.trim() };
    try {
      const r = await saveOwnerTeam(body);
      if (!r.ok) {
        toast(r.error.message);
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
      toast(created ? '팀을 만들었어요' : '편성을 저장했어요');
      return unchanged;
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  }
  async function saveAndFind() {
    if (await save()) await loadOpponents();
  }

  // ───────── 경기 ─────────
  async function loadOpponents() {
    oppLoaded.current = true;
    setOppStatus('loading');
    const r = await fetchOpponents();
    if (!r.ok) return setOppStatus('error');
    setOpponents(r.data.items);
    setOppStatus('ready');
  }

  async function challenge(o: TeamOpponent) {
    if (playing) return;
    setPlaying(true);
    const r = await playMatch(o.teamId);
    setPlaying(false);
    if (!r.ok) {
      if (r.error.reason === 'TEAM_MATCH_DAILY_LIMIT') setMatchesLeft(0);
      if (r.error.reason === 'TEAM_OPPONENT_DAILY_LIMIT')
        setOpponents((list) => list.filter((x) => x.teamId !== o.teamId));
      return toast(r.error.message);
    }
    setResultOrigin('opponents');
    setResult(r.data.match);
    setLive(true);
    setMatchesLeft(r.data.matchesLeft);
    setTeam((t) => (t ? { ...t, record: r.data.record, rating: r.data.rating } : t));
    show('result');
    scrollTo(0);
  }

  /** 친구 칸에서 친선전을 치렀거나(중계부터) 최근 친선전을 열 때(결과부터). 친선전은 레이팅·전적을 건드리지 않는다. */
  function showFriendly(m: TeamMatch, withLive: boolean) {
    setResultOrigin('opponents');
    setResult(m);
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
  async function loadAchievements(want = season) {
    setAchStatus('loading');
    const r = await fetchClubAchievements(want);
    if (!r.ok) return setAchStatus('error');
    setAch(r.data);
    // T-11-034 가장 최근 시즌을 열면 본 것으로 적고, 지난번 뒤로 새로 오른 업적에 NEW를 붙인다(웹 Team.svelte).
    const latest = Math.max(r.data.season, ...r.data.seasons.map((o) => o.id));
    setAchNewIds(r.data.season === latest ? achNudge.viewed(r.data) : new Set());
    setAchStatus('ready');
  }

  async function loadHistory() {
    setHistStatus('loading');
    const r = await fetchTeamMatches(season);
    if (!r.ok) return setHistStatus('error');
    setHistory(r.data.items);
    setHistStatus('ready');
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
    // 화면·상태가 바뀔 때만(시즌 등 다른 값 변화로는 다시 부르지 않는다).
  }, [teamView, status, needLogin]);

  /** 탭을 바꾸면 맨 위에서 시작하고, 보고 있는 탭을 다시 누르면 맨 위로 부드럽게 올린다(게임 화면 탭과 같다). */
  function switchView(v: TeamView) {
    if (view === v) return scrollTo(0, prefs.motionOK);
    show(v);
    scrollTo(0);
  }
  const navOn = view === 'result' ? resultOrigin : view;
  const navItems: TabItem[] = NAV.map(([k, label, icon]) => ({
    key: icon,
    label,
    active: navOn === k,
    onPress: () => switchView(k),
    testID: `team-tab-${k}`,
    ...(k === 'achievements' ? { dot: achNew } : {}),
  }));
  navItems.splice(2, 0, {
    key: 'owner',
    label: '구단주',
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
          내 팀
        </Txt>
        <Txt tone="muted">로그인한 구단주만 은퇴한 선수로 팀을 꾸릴 수 있어요.</Txt>
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
              label="시즌"
              testID="team-season"
              value={season}
              options={seasons.map((o) => ({
                value: o.id,
                label: `${o.name}${o.id === current ? ' (지금)' : ''}`,
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
                {name || team?.name || (editable ? '팀 만들기' : '팀 없음')}
              </Txt>
              <Txt
                v="sm"
                tone="muted"
              >{`${manager || team?.manager || '나의'} 감독${dirty && team ? ' · 저장 전' : ''}`}</Txt>
            </View>
            <OvrBadge ovr={ovr} />
          </View>
          {team ? (
            <Txt
              v="sm"
              tone="muted"
              testID="team-record"
            >{`${recordText(team.record)} · 레이팅 ${num(team.rating)} · ${editable ? `오늘 ${matchesLeft}/${perDay}경기` : '지난 시즌'}`}</Txt>
          ) : (
            <Txt v="sm" tone="muted">
              빈 자리는 유스 선수(OVR {YOUTH_OVR})가 채워요. 한 명만 넣어도 경기할 수 있어요.
            </Txt>
          )}
          {editable ? (
            <Btn sm kind="ghost" testID="team-more" onPress={() => setMenu(true)}>
              더보기
            </Btn>
          ) : (
            <Txt v="sm" tone="muted" testID="team-readonly">
              지난 시즌 팀이라 보기만 할 수 있어요.
            </Txt>
          )}
          {editable && (!team || renaming) ? (
            <View style={{ gap: 10 }}>
              <Field label="팀 이름">
                <TextField
                  value={name}
                  onChangeText={setName}
                  maxLength={TEAM_NAME_MAX}
                  testID="team-name"
                  accessibilityLabel="팀 이름"
                />
              </Field>
              <Field label="감독 이름">
                <TextField
                  value={manager}
                  onChangeText={setManager}
                  maxLength={MANAGER_NAME_MAX}
                  testID="team-manager"
                  accessibilityLabel="감독 이름"
                />
              </Field>
            </View>
          ) : null}
        </Card>
        {pendingDraft ? (
          <Card>
            <Txt v="sm">저장된 팀이 바뀌었어요. 이 기기에 남아 있는 편성을 불러올까요?</Txt>
            <Btn
              onPress={() => {
                applyDraft(pendingDraft.value);
                setPendingDraft(null);
              }}
            >
              이 기기 편성 불러오기
            </Btn>
            <Btn
              kind="ghost"
              onPress={() => {
                if (draftKey) writeTeamDraft(draftKey, null);
                setPendingDraft(null);
              }}
            >
              저장된 팀 유지
            </Btn>
          </Card>
        ) : restored ? (
          <Card>
            <Txt v="sm">저장 전 편성을 복원했어요. 편성 저장을 누르면 팀에 반영돼요.</Txt>
            <Btn
              sm
              kind="ghost"
              onPress={() => {
                applyTeam(team);
                setRestored(false);
                if (draftKey) writeTeamDraft(draftKey, null);
              }}
            >
              저장된 팀으로 되돌리기
            </Btn>
          </Card>
        ) : null}
        {editable || team ? (
          <>
            <Card gap={8}>
              <View
                style={{
                  flexDirection: 'row',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                }}
              >
                <Txt v="h2">그라운드</Txt>
                <Txt v="sm" tone="muted">{`선발 ${filled} · 유스 ${LINEUP_SIZE - filled}`}</Txt>
              </View>
              {editable ? (
                <SortChips
                  label="포메이션 기본 배치"
                  value={layout ? 'custom' : formation}
                  items={FORMATION_IDS.map((key) => ({ key, label: key }))}
                  onPick={(key) => {
                    setFormation(key as FormationId);
                    setLayout(null);
                  }}
                  testIDPrefix="formation"
                />
              ) : null}
              <TeamLines lines={lines} />
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
                    onPress={() => setSlots(autoFillSlots(slotCodes, players))}
                  >
                    자동 배치
                  </Btn>
                ) : null}
                <Btn
                  sm
                  testID="team-share"
                  style={{ flex: 1 }}
                  onPress={() =>
                    setShare({
                      name: name || team?.name || '나의 팀',
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
                  이미지 공유
                </Btn>
              </View>
              {editable ? (
                <Txt v="xs" tone="muted">
                  선수 카드를 길게 눌러 옮겨요.
                </Txt>
              ) : null}
            </Card>
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
              change={(nextSlots, nextLayout) => {
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
        <OppSwitch value={oppTab} onPick={pickOppTab} />
        {oppTab === 'friends' ? (
          <TeamFriends
            friends={friends}
            onPlayed={(m) => showFriendly(m, true)}
            onOpen={(m) => showFriendly(m, false)}
          />
        ) : (
          <TeamOpponents
            ovr={team?.ovr ?? ovr}
            matchesLeft={matchesLeft}
            perDay={perDay}
            opponents={opponents}
            status={oppStatus}
            playing={playing}
            reload={() => void loadOpponents()}
            challenge={(o) => void challenge(o)}
            hint={matchHint}
            toTeam={editable ? () => switchView('team') : undefined}
            saveAndFind={editable && dirty && team ? () => void saveAndFind() : undefined}
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
        onend={() => {
          setLive(false);
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
        backLabel={resultOrigin === 'history' ? '기록으로 돌아가기' : '편성으로'}
        replay={() => setLive(true)}
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
          setLive(false);
          show('result');
        }}
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
                          : '선수 선택'}
                      </Txt>
                      <Btn sm onPress={() => jump.current?.()}>
                        그라운드로
                      </Btn>
                      <Btn sm kind="ghost" onPress={() => setSelected(null)}>
                        취소
                      </Btn>
                    </View>
                  ) : null}
                  {dirty ? (
                    <Btn
                      kind="primary"
                      block
                      testID="team-save"
                      disabled={saving || !nameOk || !!pendingDraft}
                      onPress={() => void save()}
                    >
                      {saving ? '저장 중…' : team ? '편성 저장' : '팀 만들기'}
                    </Btn>
                  ) : null}
                </View>
              ) : undefined
            }
          >
            <Topbar />
            <LoadState status={status} failText="팀을 불러오지 못했어요." retry={() => void load()}>
              {body}
            </LoadState>
          </Screen>
          {needLogin ? null : <TabBar label="내 팀 메뉴" items={navItems} sub="team" />}
        </View>
      </BarBelow.Provider>
      {menu ? (
        <TeamDialog title="내 팀 설정" close={() => setMenu(false)}>
          <Btn
            testID="team-logo-edit"
            onPress={() => {
              setMenu(false);
              setEditingLogo(true);
            }}
          >
            로고 설정
          </Btn>
          <Btn
            testID="team-rename"
            onPress={() => {
              setMenu(false);
              setRenaming(true);
              scrollTo(0);
            }}
          >
            이름 바꾸기
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
