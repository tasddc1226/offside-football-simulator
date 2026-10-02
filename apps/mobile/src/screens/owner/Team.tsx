// T-10-092 구단주 팀(웹 team/Team.svelte) — 시즌마다 그 시즌에 뛰고 은퇴한 내 선수로 11명을 꾸려(빈 자리는 유스 선수가
// 채운다) 같은 시즌 다른 구단주의 팀과 겨룬다. 지난 시즌 팀은 보기만 한다. 경기 결과는 서버가 정한다(앱은 보여 주기만).
// 편성·후보·업적 표기 같은 순수 계산은 웹과 같은 @offside/app-core/teamOwner.
import { useEffect, useMemo, useState } from 'react';
import { View } from 'react-native';
import { useSnapshot } from 'valtio';
import {
  FORMATION_IDS,
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
import { hofStart, type TeamView } from '@offside/app-core/state';
import { recordText, num } from '@offside/app-core/teamText';
import {
  assignSlot,
  autoFillSlots,
  matchHintOf,
  pickCandidates,
  type PickSort,
} from '@offside/app-core/teamOwner';
import { anonName } from '@offside/game/pos-label';
import { localCareerNames } from '@offside/game/season';
import { LoadState, type LoadStatus } from '../../components/LoadState';
import { TeamLines, TeamPitch } from '../../components/TeamPitch';
import { toast } from '../../game/host';
import { go } from '../../game/nav';
import { achNudge } from '../../game/achNudge';
import { appState, prefs } from '../../store';
import { useColors } from '../../theme/useColors';
import { DISPLAY, rem } from '../../theme/type';
import { BackBar, Btn, Card, Screen, Topbar, Txt, scrollTo } from '../../ui';
import { BarBelow } from '../../ui/Screen';
import { TabBar, type TabItem } from '../../ui/TabBar';
import type { TabIconName } from '../../ui/TabIcon';
import { Field, SelectField, TextField } from '../settings/parts';
import { LoginButtons } from './LoginButtons';
import { TeamAchievements } from './TeamAchievements';
import { TeamHistory } from './TeamHistory';
import { TeamLive } from './TeamLive';
import { TeamOpponents } from './TeamOpponents';
import { Grid2, OvrBadge, Seg, SegBtn, Stats, TmTitle } from './TeamParts';
import { TeamPicker } from './TeamPicker';
import { TeamResult } from './TeamResult';

const between = (v: string, min: number, max: number) =>
  v.trim().length >= min && v.trim().length <= max;

// T-11-026 내 팀 하단 메뉴 — 편성 · 경기 · (가운데) 구단주 · 업적 · 기록. 경기 결과는 '경기' 탭 안이다.
const NAV: [TeamView, string, TabIconName][] = [
  ['team', '편성', 'lineup'],
  ['opponents', '경기', 'season'],
  ['achievements', '업적', 'trophy'],
  ['history', '기록', 'career'],
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
  const [picking, setPicking] = useState<number | null>(null);
  const [pickSort, setPickSort] = useState<PickSort>('fit');

  const [opponents, setOpponents] = useState<TeamOpponent[]>([]);
  const [oppStatus, setOppStatus] = useState<LoadStatus>('loading');
  const [playing, setPlaying] = useState(false);
  const [result, setResult] = useState<TeamMatch | null>(null);
  /** 방금 치른 경기(또는 '다시 보기')를 문자중계로 보여 주는 중(T-10-097). */
  const [live, setLive] = useState(false);
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

  const slotCodes = FORMATIONS[formation];
  const ratings: (number | null)[] = slotCodes.map((slot, i) => {
    const id = slots[i];
    const p = id ? byId.get(id) : undefined;
    return p ? slotRating(slot, p) : null;
  });
  const ovr = teamOvr(ratings);
  // 공격·중원·수비·골키퍼 힘 — 자리별 실력에 포메이션의 줄 무게를 더한 값(서버 경기 계산과 같은 규칙).
  const lines = lineStrength(slotCodes, ratings);
  const filled = slots.filter((s) => s !== null).length;
  const dirty =
    !team ||
    name.trim() !== team.name ||
    manager.trim() !== team.manager ||
    formation !== team.formation ||
    slots.some((id, i) => id !== (team.slots[i]?.careerId ?? null));
  const nameOk =
    between(name, TEAM_NAME_MIN, TEAM_NAME_MAX) &&
    between(manager, MANAGER_NAME_MIN, MANAGER_NAME_MAX);
  const cells = slots.map((id, i) => {
    const p = id ? byId.get(id) : undefined;
    return { rating: ratings[i] ?? YOUTH_OVR, name: p ? nameOf(p) : YOUTH_NAME, youth: !p };
  });
  const matchHint = matchHintOf(team, dirty, matchesLeft, season, current);

  function applyTeam(t: OwnerTeam | null, lm: string | null = lastManager) {
    setTeam(t);
    setName(t?.name ?? '');
    setManager(t?.manager || lm || '');
    setFormation(t?.formation ?? '4-3-3');
    setSlots(t ? t.slots.map((s) => s.careerId) : Array(LINEUP_SIZE).fill(null));
  }

  async function load(want?: number) {
    setStatus('loading');
    const r = await fetchOwnerTeam(want);
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
    setStatus('ready');
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
  useEffect(() => {
    void load();
    // 처음 한 번만.
  }, []);

  // ───────── 편성 ─────────
  const candidates =
    picking === null ? [] : pickCandidates(slotCodes, picking, players, slots, pickSort);

  /** 고른 자리에 선수를 넣는다. 이미 다른 자리에 있던 선수면 두 자리를 맞바꾼다. */
  function assign(id: string | null) {
    if (picking === null) return;
    setSlots(assignSlot(slots, picking, id));
    setPicking(null);
  }

  async function save() {
    if (saving || !nameOk) return;
    setSaving(true);
    const r = await saveOwnerTeam({ name: name.trim(), manager: manager.trim(), formation, slots });
    setSaving(false);
    if (!r.ok) return toast(r.error.message);
    const created = !team;
    applyTeam(r.data.team);
    setRenaming(false);
    toast(created ? '팀을 만들었어요' : '편성을 저장했어요');
  }

  // ───────── 경기 ─────────
  async function loadOpponents() {
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
    setResult(r.data.match);
    setLive(true);
    setMatchesLeft(r.data.matchesLeft);
    setTeam((t) => (t ? { ...t, record: r.data.record, rating: r.data.rating } : t));
    show('result');
    scrollTo(0);
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
    opponents: () => (matchHint ? undefined : loadOpponents()),
    achievements: () => loadAchievements(),
    history: loadHistory,
  };
  function open(v: keyof typeof LOAD) {
    if (appState.teamView === v) void LOAD[v]();
    else show(v);
  }
  useEffect(() => {
    if (status !== 'ready' || needLogin) return;
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
  const navOn = view === 'result' ? 'opponents' : view;
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
        <Txt tone="muted">구글로 로그인한 구단주만 은퇴한 선수로 팀을 꾸릴 수 있어요.</Txt>
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
        <Card gap={12}>
          <TmTitle
            eyebrow={`My team · ${seasonName}`}
            title={team?.name ?? (editable ? '팀 만들기' : '팀 없음')}
            right={<OvrBadge ovr={ovr} />}
          />
          {team ? (
            <Txt tone="muted" v="sm" style={{ marginTop: -8 }}>
              {`${team.manager} 감독`}
            </Txt>
          ) : null}
          {team ? (
            <View testID="team-record">
              <Stats
                first={1.5}
                items={[
                  ['전적', recordText(team.record)],
                  ['레이팅', num(team.rating)],
                  editable ? ['오늘 경기', `${matchesLeft}/${perDay}`] : ['시즌', '지난 시즌'],
                ]}
              />
            </View>
          ) : editable ? (
            <Txt tone="muted">{`${seasonName}에 뛰고 은퇴한 내 선수로 11명을 꾸려요. 빈 자리는 유스 선수(OVR ${YOUTH_OVR})가 채워서, 한 명만 넣어도 경기할 수 있어요. 팀은 시즌마다 새로 꾸려요.`}</Txt>
          ) : (
            <Txt tone="muted">{`${seasonName}에는 팀을 꾸리지 않았어요.`}</Txt>
          )}
          {!editable && team ? (
            <Txt tone="muted" v="sm" testID="team-readonly">
              지난 시즌 팀이에요 — 보기만 할 수 있어요.
            </Txt>
          ) : null}
          {editable && (!team || renaming) ? (
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <Field label="팀 이름" style={{ flex: 1 }}>
                <TextField
                  value={name}
                  onChangeText={setName}
                  maxLength={TEAM_NAME_MAX}
                  placeholder={`${TEAM_NAME_MIN}~${TEAM_NAME_MAX}자`}
                  testID="team-name"
                  accessibilityLabel="팀 이름"
                  spellCheck={false}
                />
              </Field>
              <Field label="감독 이름" style={{ flex: 1 }}>
                <TextField
                  value={manager}
                  onChangeText={setManager}
                  maxLength={MANAGER_NAME_MAX}
                  placeholder={`${MANAGER_NAME_MIN}~${MANAGER_NAME_MAX}자`}
                  testID="team-manager"
                  accessibilityLabel="감독 이름"
                  spellCheck={false}
                />
              </Field>
            </View>
          ) : null}
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 6 }}>
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
                style={{ minHeight: 40 }}
              />
            ) : null}
            {editable && team && !renaming ? (
              <Btn sm onPress={() => setRenaming(true)} testID="team-rename">
                이름 바꾸기
              </Btn>
            ) : null}
            {team ? (
              <Btn sm onPress={() => openRanking(team.id)} testID="team-profile">
                팀 프로필 · 순위
              </Btn>
            ) : null}
            <Btn sm onPress={() => openRanking()} testID="team-ranking">
              라이브 랭킹
            </Btn>
          </View>
        </Card>

        {editable || team ? (
          <>
            <Card gap={10}>
              <Seg label="포메이션">
                {FORMATION_IDS.map((f) => (
                  <SegBtn
                    key={f}
                    center
                    selected={formation === f}
                    disabled={!editable}
                    testID={`formation-${f}`}
                    label={`포메이션 ${f}`}
                    onPress={() => setFormation(f)}
                  >
                    <Txt
                      style={{
                        fontFamily: DISPLAY[700],
                        fontSize: rem(1.0625),
                        lineHeight: rem(1.0625) * 1.3,
                      }}
                    >
                      {f}
                    </Txt>
                  </SegBtn>
                ))}
              </Seg>
              <TeamLines lines={lines} />
              {editable ? (
                <Txt tone="muted" v="sm">
                  포메이션을 바꾸면 공격·중원·수비 무게가 옮겨 가요. 선수는 자리마다 그 자리
                  능력치로 뛰어요.
                </Txt>
              ) : null}
            </Card>
            <TeamPitch
              formation={formation}
              cells={cells}
              onpick={editable ? (i) => setPicking(i) : undefined}
            />
          </>
        ) : null}

        {editable ? (
          <Card gap={10}>
            {players.length === 0 ? (
              <Txt tone="muted">{`${seasonName}에 뛰고 은퇴한 선수가 아직 없어요. 이번 시즌에 커리어를 끝까지 뛰면 팀에 넣을 수 있어요.`}</Txt>
            ) : (
              <Txt
                tone="muted"
                v="sm"
              >{`선수 ${filled}명 · 유스 ${LINEUP_SIZE - filled}명. 자리를 누르면 선수를 바꿀 수 있어요.`}</Txt>
            )}
            <Grid2>
              <Btn
                block
                onPress={() => setSlots(autoFillSlots(slotCodes, players))}
                disabled={players.length === 0}
                testID="team-auto"
              >
                자동 배치
              </Btn>
              <Btn
                block
                kind="primary"
                onPress={() => void save()}
                disabled={saving || !nameOk || !dirty}
                testID="team-save"
              >
                {team ? (dirty ? '편성 저장' : '저장됨') : '팀 만들기'}
              </Btn>
            </Grid2>
          </Card>
        ) : null}
      </>
    );
  } else if (view === 'opponents') {
    body = (
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
      />
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
        toTeam={() => show('team')}
        replay={() => setLive(true)}
        again={() => open('opponents')}
      />
    );
  } else if (view === 'history') {
    body = (
      <TeamHistory
        history={history}
        status={histStatus}
        reload={() => void loadHistory()}
        open={(m) => {
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
            footer={
              needLogin ? (
                <BackBar fallback={() => (appState.screen = 'owner')} testID="team-back" />
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
      <TeamPicker
        slot={picking === null ? null : (slotCodes[picking] ?? null)}
        slotCodes={slotCodes}
        current={picking === null ? null : (slots[picking] ?? null)}
        sort={pickSort}
        setSort={setPickSort}
        candidates={candidates}
        nameOf={nameOf}
        onAssign={assign}
        onClose={() => setPicking(null)}
      />
    </>
  );
}
