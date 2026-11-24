// T-11-825 원정 투어(내 구단 화면 '원정 투어' 칸으로 연다, 웹 owner/SquadTour.svelte). T-11-826부터 팝업이 아니라 전용 화면(tour)이다.
// 열 때 투어 홈과 내 팀(선수 목록, 1분 메모)만 받는다. 사다리 · 제한 · 자동 편성은 app-core/contracts 계산이라 따로 부르지 않는다.
// 여정 지도 → 편성(상대 분석 · 선발 · 교체 명단 · 전술) → 작전 경기(30분 · 60분 작전 타임) → 결과. 주간 순위는 탭을 열 때만 받는다.
// 그라운드 · 선수 카드는 팀 화면의 것을 그대로 쓴다. 경기는 서버가 30분씩 계산해 돌려주고, 화면은 그 30분을 시계와 함께 다시 보여 준다
// (골이 난 분에 멈춘다). 시계는 JS 타이머와 상태로 돌리고, 애니메이션은 한 번 돌고 멈추는 것만 쓴다(끝없이 도는 반짝임 금지, T-11-730).
// 동작 줄이기면 재생 없이 바로 결과 · 작전 타임을 보여 준다.
import {
  createContext,
  memo,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import {
  Animated,
  BackHandler,
  Easing,
  View,
  type LayoutChangeEvent,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import { useSnapshot } from 'valtio';
import { fetchOwnerTeam, type TeamPlayer } from '@offside/app-core/api/team';
import {
  fetchTour,
  fetchTourHistory,
  fetchTourRanking,
  orderTourMatch,
  startTourMatch,
} from '@offside/app-core/api/tour';
import type {
  TourMatchView,
  TourHistoryResponse,
  TourRankingResponse,
  TourStage,
  TourStateResponse,
} from '@offside/contracts';
import { FORMATIONS, FORMATION_IDS, type FormationId } from '@offside/contracts/owner-team';
import { detailPosOf, type DetailPos } from '@offside/contracts/positions';
import { TOUR_TRIES_PER_DAY } from '@offside/contracts/squad-tour';
import { fmtValue } from '@offside/contracts/market-value';
import {
  TOUR_LIVE,
  TOUR_MAIN_STAGES,
  TOUR_TACTICS,
  tourAutoDraft,
  tourBenchOptions,
  tourCells,
  tourChances,
  tourEdge,
  tourOptions,
  tourPicks,
  tourRuleText,
  tourSpan,
  tourStageName,
  tourStageState,
  tourTacticDesc,
  tourTacticName,
  tourTired,
  tourWeekLabel,
  tourWeekLeft,
  type TourDraft,
  type TourTactic,
} from '@offside/app-core/tour';
import { RADIUS } from '@offside/app-core/design-tokens';
import { marketName } from '@offside/app-core/market';
import { localCareerNames } from '@offside/game/hof-store';
import { tourText as L } from '@offside/app-core/i18n/ko/tour';
import { mix } from '../../theme/colors';
import { useColors } from '../../theme/useColors';
import { DISPLAY, rem } from '../../theme/type';
import { Btn, Opt, Press, Screen, Txt } from '../../ui';
import type { TxtProps } from '../../ui/Txt';
import { scrollTo, viewH } from '../../ui/scroll';
import { prefs, sheetState } from '../../store';
import { go, goBack } from '../../game/nav';
import { hapticsOn } from '../../game/host';
import { PlayerCard, type PlayerCardData } from '../../components/PlayerCard';
import { TeamPitch } from '../../components/TeamPitch';
import { playSfx } from '../../platform/sfx';

type Step = 'map' | 'prep' | 'live' | 'result' | 'rank' | 'history';
type Goal = TourMatchView['events'][number];

// 경기 재생 박자(웹 SquadTour.svelte와 같다). 한 구간은 90 / TOUR_LIVE.segments분.
const SEG = 90 / TOUR_LIVE.segments;
const MIN_MS = 210;
const GOAL_MS = 1900;
const KICKOFF_MS = 1500;
const wait = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

const digit = { fontFamily: DISPLAY[700], fontSize: rem(3.4), lineHeight: rem(3.6) } as const;
const flashTitle = { fontFamily: DISPLAY[700], fontSize: rem(2.6), lineHeight: rem(2.9) } as const;

/** 경기 · 결과 화면은 밤 경기장처럼 어둡다. 그 위에 바로 놓이는 글자(카드 · 버튼 안이 아닌)는 Tx로 밝게 그린다. */
const NightCtx = createContext(false);
function Tx(props: TxtProps) {
  const night = useContext(NightCtx);
  const c = useColors();
  if (!night) return <Txt {...props} />;
  const { tone, style, ...rest } = props;
  const gold = tone === 'accent' || tone === 'good' || tone === 'pitchAccent' || tone === 'warn';
  return (
    <Txt
      {...rest}
      tone={gold ? 'pitchAccent' : 'onPitch'}
      style={[
        style,
        tone === 'bad' && { color: mix(c.bad, '#ffffff', 0.4) },
        tone === 'muted' && { opacity: 0.8 },
      ]}
    />
  );
}

/** 한 번 튀어 오르며 나타난다(스프링 하나, 반복 없음). from이 1보다 크면 커졌다가 줄어든다. 동작 줄이기면 그냥 보인다. */
function Pop({
  children,
  from = 0,
  delay = 0,
}: {
  children: ReactNode;
  from?: number;
  delay?: number;
}) {
  const { motionOK } = useSnapshot(prefs);
  const v = useRef(new Animated.Value(motionOK ? from : 1)).current;
  useEffect(() => {
    if (!motionOK) return;
    const a = Animated.sequence([
      Animated.delay(delay),
      Animated.spring(v, { toValue: 1, friction: 4, tension: 110, useNativeDriver: true }),
    ]);
    a.start();
    return () => a.stop();
  }, [motionOK, delay, v]);
  return (
    <Animated.View
      style={{
        opacity:
          from < 1
            ? v.interpolate({ inputRange: [0, 0.6], outputRange: [0, 1], extrapolate: 'clamp' })
            : 1,
        transform: [{ scale: v }],
      }}
    >
      {children}
    </Animated.View>
  );
}

/** 아래에서 떠오르며 나타난다(한 번). */
function Rise({
  children,
  delay = 0,
  dy = 14,
  ms = 450,
  style,
  onLayout,
}: {
  children: ReactNode;
  delay?: number;
  dy?: number;
  ms?: number;
  style?: StyleProp<ViewStyle>;
  onLayout?: (e: LayoutChangeEvent) => void;
}) {
  const { motionOK } = useSnapshot(prefs);
  const v = useRef(new Animated.Value(motionOK ? 0 : 1)).current;
  useEffect(() => {
    if (!motionOK) return;
    const a = Animated.sequence([
      Animated.delay(delay),
      Animated.timing(v, {
        toValue: 1,
        duration: ms,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
    ]);
    a.start();
    return () => a.stop();
  }, [motionOK, delay, ms, v]);
  return (
    <Animated.View
      {...(onLayout ? { onLayout } : {})}
      style={[
        style,
        {
          opacity: v,
          transform: [{ translateY: v.interpolate({ inputRange: [0, 1], outputRange: [dy, 0] }) }],
        },
      ]}
    >
      {children}
    </Animated.View>
  );
}

/** on이 켜지는 순간 좌우로 한 번 흔든다(실점). */
function Shake({ on, children }: { on: object | null; children: ReactNode }) {
  const { motionOK } = useSnapshot(prefs);
  const v = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (!on || !motionOK) return;
    const a = Animated.sequence(
      [-6, 6, -4, 3, 0].map((toValue) =>
        Animated.timing(v, { toValue, duration: 90, useNativeDriver: true }),
      ),
    );
    a.start();
    return () => a.stop();
  }, [on, motionOK, v]);
  return <Animated.View style={{ transform: [{ translateX: v }] }}>{children}</Animated.View>;
}

/** 킥오프 · 골 장면: 점수판 위를 덮는다. */
function Flash({ children, testID }: { children: ReactNode; testID: string }) {
  const c = useColors();
  return (
    <View
      testID={testID}
      accessibilityLiveRegion="polite"
      style={{
        position: 'absolute',
        top: 0,
        right: 0,
        bottom: 0,
        left: 0,
        alignItems: 'center',
        justifyContent: 'center',
        gap: 4,
        padding: 12,
        backgroundColor: c.pitch,
      }}
    >
      {children}
    </View>
  );
}

// 재생 중 시계 틱마다 화면이 다시 그려져도 그라운드(선수 카드 11장)는 다시 그리지 않는다.
const MemoPitch = memo(TeamPitch);

/** 선수 한 명을 그라운드 · 목록 카드 값으로(빈 자리는 팀 화면의 유소년 카드 모양). */
const cellOf = (p: TeamPlayer | undefined, name: string, rating: number): PlayerCardData =>
  p
    ? {
        name,
        rating,
        youth: false,
        peak: p.peak,
        number: p.number,
        legendScore: p.legendScore,
        specials: p.specials,
        daily: p.daily,
        careerId: p.careerId,
        look: p.look,
        nation: p.nation,
        season: p.season,
        enhance: p.enhance,
        locked: p.locked,
      }
    : { name, rating, youth: true };

/** 선수 고르기 · 교체 명단의 작은 카드(팀 화면 카드의 compact · mini판)와 이름. */
function Mini({
  player,
  name,
  rating,
  code,
  note,
  noteTone,
}: {
  player: TeamPlayer;
  name: string;
  rating: number;
  code: DetailPos;
  note?: string | null;
  noteTone?: 'bad' | 'muted';
}) {
  return (
    <View style={{ width: 76, alignItems: 'center', gap: 4 }}>
      <View
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
        style={{ width: 64 }}
      >
        <PlayerCard compact mini animate={false} code={code} cell={cellOf(player, name, rating)} />
      </View>
      <Tx v="xs" numberOfLines={1} style={{ maxWidth: 76 }}>
        {name}
      </Tx>
      {note ? (
        <Tx v="xs" tone={noteTone ?? 'muted'} center>
          {note}
        </Tx>
      ) : null}
    </View>
  );
}

export default function SquadTour() {
  const c = useColors();
  const [local] = useState(() => localCareerNames());
  const [view, setView] = useState<Step>('map');
  const [tour, setTour] = useState<TourStateResponse | null>(null);
  const [players, setPlayers] = useState<TeamPlayer[]>([]);
  const [failed, setFailed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  // 편성
  const [draftFormation, setDraftFormation] = useState<FormationId | null>(null);
  const [stage, setStage] = useState<TourStage | null>(null);
  const [draft, setDraft] = useState<TourDraft | null>(null);
  const [slotOpen, setSlotOpen] = useState<number | null>(null);
  const [benchOpen, setBenchOpen] = useState(false);

  // 작전 경기
  const [match, setMatch] = useState<TourMatchView | null>(null);
  const [orderTactic, setOrderTactic] = useState<TourTactic>('possession');
  const [subs, setSubs] = useState<{ slot: number; cardId: string }[]>([]);
  const [outSlot, setOutSlot] = useState<number | null>(null);

  // 주간 순위
  const [ranking, setRanking] = useState<TourRankingResponse | null>(null);
  const [rankFailed, setRankFailed] = useState(false);
  const [history, setHistory] = useState<TourHistoryResponse | null>(null);
  const [historyFailed, setHistoryFailed] = useState(false);

  // 경기 재생
  const [playing, setPlaying] = useState(false);
  const [kickoff, setKickoff] = useState(false);
  const [clock, setClock] = useState(0);
  const [banner, setBanner] = useState<Goal | null>(null);
  // 골 장면 도중에 점수가 올라간다(웹과 같다).
  const [scored, setScored] = useState(false);
  const run = useRef(0);
  const alive = useRef(true);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
      run.current++;
    };
  }, []);
  // 방금 이긴 경기(지도에서 도장이 찍히고 다음 경기가 열린다, 한 번).
  const [justWon, setJustWon] = useState<number | null>(null);

  const resetOrder = (m: TourMatchView | null) => {
    setOrderTactic(m?.tactic ?? 'possession');
    setSubs([]);
    setOutSlot(null);
  };

  const load = useCallback(async () => {
    setFailed(false);
    const [t, team] = await Promise.all([fetchTour(), fetchOwnerTeam()]);
    if (!t.ok || !team.ok) return setFailed(true);
    setTour(t.data);
    setPlayers(team.data.players);
    if (team.data.team) setDraftFormation((f) => f ?? team.data.team!.formation);
    if (t.data.live) {
      setMatch(t.data.live);
      setClock(t.data.live.done * SEG);
      resetOrder(t.data.live);
      setView('live');
    }
  }, []);
  useEffect(() => {
    void load();
  }, [load]);

  const byId = useMemo(() => new Map(players.map((p) => [p.careerId, p])), [players]);
  const picks = useMemo(() => tourPicks(players), [players]);
  const pickById = useMemo(() => new Map(picks.map((p) => [p.id, p])), [picks]);
  const nameOf = useCallback(
    (id: string | null) => {
      const p = id ? byId.get(id) : undefined;
      return p ? marketName(p, local) : L.mercName;
    },
    [byId, local],
  );
  const totalStars = (tour?.stages ?? []).reduce((a, s) => a + s.stars, 0);
  const left = tourWeekLeft(new Date().toISOString());

  function openStage(s: TourStage) {
    if (!tour) return;
    setStage(s);
    setJustWon(null);
    setDraft(tourAutoDraft(s, picks, tour.season, draftFormation ?? '4-3-3'));
    setSlotOpen(null);
    setBenchOpen(false);
    setError('');
    setView('prep');
  }
  function setFormation(f: FormationId) {
    if (!tour || !stage || !draft) return;
    setDraftFormation(f);
    setDraft({ ...tourAutoDraft(stage, picks, tour.season, f), tactic: draft.tactic });
    setSlotOpen(null);
  }
  function auto() {
    if (!tour || !stage || !draft) return;
    setDraft({
      ...tourAutoDraft(stage, picks, tour.season, draft.formation),
      tactic: draft.tactic,
    });
    setSlotOpen(null);
  }
  function place(id: string | null) {
    if (!draft || slotOpen === null) return;
    const slotIds = [...draft.slotIds];
    slotIds[slotOpen] = id;
    setDraft({ ...draft, slotIds });
    setSlotOpen(null);
  }
  function toggleBench(id: string) {
    if (!draft) return;
    const has = draft.bench.includes(id);
    if (!has && draft.bench.length >= TOUR_LIVE.bench) return;
    setDraft({ ...draft, bench: has ? draft.bench.filter((x) => x !== id) : [...draft.bench, id] });
  }
  async function depart() {
    if (!stage || !draft || busy) return;
    setBusy(true);
    setError('');
    const r = await startTourMatch({ stage: stage.stage, ...draft });
    if (!alive.current) return;
    setBusy(false);
    if (!r.ok) return setError(r.error.message || L.departFail);
    setMatch(r.data.match);
    setTour((t) => (t ? { ...t, triesLeft: r.data.triesLeft } : t));
    resetOrder(r.data.match);
    setView('live');
    void playSegment(r.data.match);
  }

  // ── 경기 재생 ── 방금 계산된 30분을 시계로 흘려 보낸다. 골이 난 분에 멈춰 득점자를 보여 주고 점수를 올린다.
  function endSegment(m: TourMatchView) {
    setPlaying(false);
    setKickoff(false);
    setBanner(null);
    setClock(m.done * SEG);
    if (m.status === 'live') return playSfx('whistle');
    if (m.status === 'won') setJustWon(m.stage);
    playSfx(m.status === 'won' ? 'trophy' : 'fulltime');
    setView('result');
  }
  async function playSegment(m: TourMatchView) {
    const id = ++run.current;
    const to = m.done * SEG;
    const from = to - SEG;
    if (!prefs.motionOK) return endSegment(m);
    const live = () => id === run.current && alive.current;
    setPlaying(true);
    setClock(from);
    if (from === 0) {
      setKickoff(true);
      playSfx('found');
      await wait(KICKOFF_MS);
      if (!live()) return;
      setKickoff(false);
    }
    const goals = m.events.filter((e) => e.minute > from && e.minute <= to);
    for (let min = from + 1; min <= to; min++) {
      await wait(MIN_MS);
      if (!live()) return;
      setClock(min);
      for (const g of goals.filter((e) => e.minute === min)) {
        setScored(false);
        setBanner(g);
        playSfx(g.side === 'away' ? 'good' : 'bad');
        if (hapticsOn())
          void Haptics.impactAsync(
            g.side === 'away'
              ? Haptics.ImpactFeedbackStyle.Medium
              : Haptics.ImpactFeedbackStyle.Light,
          ).catch(() => {});
        await wait(700);
        if (!live()) return;
        setScored(true);
        await wait(GOAL_MS - 700);
        if (!live()) return;
        setBanner(null);
      }
    }
    await wait(400);
    if (live()) endSegment(m);
  }
  function skip() {
    run.current++;
    if (match) endSegment(match);
  }

  const cells = useMemo(
    () => (stage && draft ? tourCells(draft, pickById, stage.rules, stage.merc) : []),
    [stage, draft, pickById],
  );
  const pitchCells = cells.map((x) =>
    cellOf(x.id ? byId.get(x.id) : undefined, nameOf(x.id), x.rating),
  );
  const options =
    tour && stage && draft && slotOpen !== null
      ? tourOptions(draft, slotOpen, picks, stage.rules, tour.season)
      : [];
  const benchOptions =
    tour && stage && draft && benchOpen
      ? tourBenchOptions(draft, picks, stage.rules, tour.season)
      : [];

  // 작전 경기
  const liveStage = match ? (tour?.stages.find((s) => s.stage === match.stage) ?? null) : null;
  const liveSlots = match
    ? match.slotIds.map((id, i) => subs.find((s) => s.slot === i)?.cardId ?? id)
    : [];
  const liveCells = useMemo(
    () =>
      match
        ? liveSlots.map((id, i) => {
            const p = id ? byId.get(id) : undefined;
            const fresh = subs.some((s) => s.slot === i);
            const base = tourCells(
              { formation: match.formation, slotIds: liveSlots },
              pickById,
              liveStage?.rules ?? [],
              liveStage?.merc ?? 0,
            )[i]!;
            const t = tourTired(base.rating, fresh ? 100 : (match.stamina[i] ?? 100));
            return {
              i,
              id,
              slot: FORMATIONS[match.formation][i]!,
              name: nameOf(id),
              player: p,
              ...t,
            };
          })
        : [],
    // liveSlots는 match · subs에서 나온다.
    [match, subs, byId, pickById, liveStage, nameOf],
  );
  const livePitch = useMemo(
    () => liveCells.map((x) => cellOf(x.player, x.name, Math.round(x.rating))),
    [liveCells],
  );
  // 재생 중에는 시계까지 난 골만 센다. home이 상대(AI), away가 나다.
  const shown = useMemo(() => {
    if (!match) return { mine: 0, opp: 0, events: [] as Goal[] };
    if (!playing) return { mine: match.goalsFor, opp: match.goalsAgainst, events: match.events };
    const events = match.events.filter(
      (e) => e.minute < clock || (e.minute === clock && (banner !== e || scored)),
    );
    return {
      mine: events.filter((e) => e.side === 'away').length,
      opp: events.filter((e) => e.side === 'home').length,
      events,
    };
  }, [match, playing, clock, banner, scored]);
  // 골을 넣은 선수의 자리(그라운드에서 테두리로 빛난다).
  const scorerSlot =
    banner && banner.side === 'away' && banner.scorerId && match
      ? match.slotIds.indexOf(banner.scorerId)
      : -1;
  const focus = useMemo(() => (scorerSlot >= 0 ? [scorerSlot] : null), [scorerSlot]);
  const over = !!match && match.status !== 'live' && !playing;
  const benchLeft = match ? match.bench.filter((id) => !subs.some((s) => s.cardId === id)) : [];
  const chances = match ? tourChances(match) : [];
  const span = match ? tourSpan(match.done) : { from: 0, to: 30 };
  function pickOut(i: number) {
    if (!match || subs.length >= match.subsLeft || subs.some((s) => s.slot === i)) return;
    setOutSlot((cur) => (cur === i ? null : i));
  }
  function pickIn(cardId: string) {
    if (outSlot === null) return;
    setSubs((cur) => [...cur, { slot: outSlot, cardId }]);
    setOutSlot(null);
  }
  async function sendOrder() {
    if (!match || busy) return;
    setBusy(true);
    setError('');
    const r = await orderTourMatch(match.id, {
      done: match.done,
      ...(orderTactic !== match.tactic ? { tactic: orderTactic } : {}),
      ...(subs.length ? { subs } : {}),
    });
    if (!alive.current) return;
    setBusy(false);
    if (!r.ok) return setError(r.error.message || L.orderFail);
    const next = r.data.match;
    setMatch(next);
    setTour((t) => (t ? { ...t, triesLeft: r.data.triesLeft } : t));
    resetOrder(next);
    // 끝난 경기면 진행 · 순위 · 별이 바뀌었다(지시 요청이 메모를 비웠다). 재생하는 동안 받아 둔다.
    if (next.status !== 'live')
      void fetchTour().then((t) => {
        if (t.ok && alive.current) setTour(t.data);
      });
    void playSegment(next);
  }
  const goalText = (e: TourMatchView['events'][number]) =>
    e.side === 'away' ? (e.scorerId ? nameOf(e.scorerId) : e.scorer) : L.oppGoal;

  async function openRank() {
    setView('rank');
    setRankFailed(false);
    const r = await fetchTourRanking();
    if (r.ok) setRanking(r.data);
    else setRankFailed(true);
  }
  // 주간 참여 기록도 열 때만 받는다.
  async function openHistory() {
    setView('history');
    setHistoryFailed(false);
    const r = await fetchTourHistory();
    if (r.ok) setHistory(r.data);
    else setHistoryFailed(true);
  }
  const nextStage = tour ? (tour.stages.find((s) => s.stage === tour.cleared + 1) ?? null) : null;

  const box = {
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: c.line,
    backgroundColor: c.surface,
  } as const;
  const band = {
    gap: 10,
    padding: 16,
    borderRadius: RADIUS.md,
    backgroundColor: c.pitch,
  } as const;
  const tone = (n: number) =>
    (n > 0 ? 'good' : n < 0 ? 'bad' : 'muted') as 'good' | 'bad' | 'muted';
  const rule = (text: string, key: string) => (
    <View
      key={key}
      style={{
        alignSelf: 'flex-start',
        minHeight: 26,
        justifyContent: 'center',
        paddingHorizontal: 10,
        borderRadius: RADIUS.pill,
        borderWidth: 1,
        borderColor: c.line,
        backgroundColor: c.surface2,
      }}
    >
      <Txt v="xs" bold>
        {text}
      </Txt>
    </View>
  );
  const stats = (rows: { label: string; value: string; gold?: boolean; testID?: string }[]) => (
    <View style={{ flexDirection: 'row', gap: 8 }}>
      {rows.map((r) => (
        <View key={r.label} style={{ flex: 1, gap: 2 }}>
          <Txt v="xs" tone="onPitch" style={{ opacity: 0.75 }}>
            {r.label}
          </Txt>
          <Txt
            tone={r.gold ? 'pitchAccent' : 'onPitch'}
            testID={r.testID}
            style={{ fontFamily: DISPLAY[700], fontSize: rem(1.4) }}
          >
            {r.value}
          </Txt>
        </View>
      ))}
    </View>
  );
  const tacticGrid = (
    items: {
      tactic: TourTactic;
      text: string;
      textTone: 'good' | 'bad' | 'muted';
      now?: boolean;
    }[],
    value: TourTactic,
    onPick: (t: TourTactic) => void,
    label: string,
  ) => (
    <View
      accessibilityRole="radiogroup"
      accessibilityLabel={label}
      style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}
    >
      {items.map((it) => (
        <View key={it.tactic} style={{ flexBasis: '48%', flexGrow: 1 }}>
          <Opt
            testID={`tour-tactic-${it.tactic}`}
            selected={value === it.tactic}
            accessibilityLabel={`${tourTacticName(it.tactic)}, ${it.text}`}
            onPress={() => onPick(it.tactic)}
            style={{ minHeight: 56 }}
          >
            <Txt bold>
              {it.now ? `${tourTacticName(it.tactic)} · ${L.now}` : tourTacticName(it.tactic)}
            </Txt>
            <Txt v="xs" tone={it.textTone}>
              {it.text}
            </Txt>
          </Opt>
        </View>
      ))}
    </View>
  );

  // ── 뒤로 가기 ── 지도에서는 구단주 화면(이전 기록)으로, 그 밖의 단계에서는 지도로. 재생 중에는 뒤로 가기가 빨리 보기다.
  const night = (view === 'live' || view === 'result') && !!match && !!tour?.open && !failed;
  const nightColor = useMemo(() => mix(c.pitch, '#000000', 0.42), [c.pitch]);
  function back() {
    if (view === 'map') return goBack(() => go('owner'));
    setView('map');
  }
  const onBack = useRef(() => {});
  useEffect(() => {
    onBack.current = playing ? skip : back;
  });
  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      // 열린 시트(업적 알림 등)는 앱 루트가 먼저 닫는다.
      if (sheetState.open) return false;
      onBack.current();
      return true;
    });
    return () => sub.remove();
  }, []);

  // ── 여정 지도 ── 들어오면 다음 경기가 보이게 내려가고, 다른 단계로 가면 맨 위로 올린다.
  // onLayout과 아래 효과 중 어느 쪽이 먼저 오든 맞도록, 원하는 경기 번호를 적어 두고 둘 다 맞으면 한 번 내려간다.
  const mapY = useRef<number | null>(null);
  const nextBox = useRef<{ stage: number; y: number; height: number } | null>(null);
  const wantStage = useRef<number | null>(null);
  const settleScroll = useCallback(() => {
    const box = nextBox.current;
    if (wantStage.current === null || mapY.current === null || !box) return;
    if (box.stage !== wantStage.current) return;
    wantStage.current = null;
    const bottom = mapY.current + box.y + box.height - viewH() + 24;
    const y = Math.min(bottom, mapY.current + box.y - 12);
    if (y > 0) scrollTo(y, prefs.motionOK);
  }, []);
  const nextNo =
    tour && tour.stages.some((s) => s.stage === tour.cleared + 1) ? tour.cleared + 1 : null;
  const ready = !!tour?.open;
  useEffect(() => {
    wantStage.current = view === 'map' && ready ? nextNo : null;
    if (wantStage.current === null) scrollTo(0);
    else settleScroll();
  }, [view, ready, nextNo, settleScroll]);

  const header =
    view === 'rank'
      ? L.rankingTitle
      : view === 'history'
        ? L.historyTitle
        : stage && view === 'prep'
          ? tourStageName(stage.stage)
          : match && (view === 'live' || view === 'result')
            ? tourStageName(match.stage)
            : L.title;

  return (
    <NightCtx.Provider value={night}>
      <Screen {...(night ? { background: nightColor } : {})}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: 44 }}>
          {!playing ? (
            <Btn sm testID="tour-back" accessibilityLabel={L.back} onPress={back}>
              ‹
            </Btn>
          ) : null}
          <Tx v="h2" style={{ flex: 1 }} accessibilityRole="header" testID="squad-tour">
            {header}
          </Tx>
          {playing ? (
            <Btn sm testID="tour-skip" onPress={skip}>
              {L.skip}
            </Btn>
          ) : null}
        </View>

        {failed ? (
          <>
            <Txt tone="bad">{L.loadFail}</Txt>
            <Btn testID="tour-retry" onPress={() => void load()}>
              {L.retry}
            </Btn>
          </>
        ) : !tour ? (
          <Txt tone="muted">{L.loading}</Txt>
        ) : !tour.open ? (
          <Txt tone="muted" testID="tour-closed">
            {L.closedTitle}
          </Txt>
        ) : view === 'map' ? (
          <>
            <View testID="tour-summary" style={band}>
              <View
                style={{
                  flexDirection: 'row',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  gap: 12,
                }}
              >
                <Txt v="sm" tone="onPitch" style={{ flex: 1 }}>
                  {L.weekEnds(left)}
                </Txt>
                <Btn sm kind="ghost" testID="tour-history" onPress={() => void openHistory()}>
                  {L.historyTitle}
                </Btn>
                <Btn sm kind="ghost" testID="tour-rank" onPress={() => void openRank()}>
                  {L.rankingTitle}
                </Btn>
              </View>
              {stats([
                { label: L.score, value: String(tour.score) },
                { label: L.rankingTitle, value: tour.rank ? L.rank({ n: tour.rank }) : L.rankNone },
                {
                  label: L.starsOf({ n: totalStars, max: TOUR_MAIN_STAGES * 3 }),
                  value: `★ ${totalStars}`,
                  gold: true,
                },
              ])}
              <Txt v="sm" tone="onPitch" testID="tour-tries">
                {L.triesLeft({ n: tour.triesLeft, max: TOUR_TRIES_PER_DAY })}
              </Txt>
            </View>
            <Txt v="sm" tone="muted">
              {L.lead}
            </Txt>
            <View
              testID="tour-map"
              style={{ gap: 12 }}
              onLayout={(e) => {
                mapY.current = e.nativeEvent.layout.y;
                settleScroll();
              }}
            >
              {tour.stages.map((s, k) => {
                const state = tourStageState(s, tour.cleared);
                const next = state === 'next';
                const unlock = justWon !== null && justWon + 1 === s.stage;
                const badge = (
                  <View
                    style={{
                      width: 44,
                      height: 44,
                      borderRadius: 22,
                      borderWidth: 2,
                      borderColor: state === 'done' ? c.good : next ? c.accentText : c.line,
                      backgroundColor: state === 'done' ? c.good : c.surface,
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <Txt
                      accessible={false}
                      style={{
                        fontFamily: DISPLAY[700],
                        fontSize: rem(1.2),
                        color: state === 'done' ? c.surface : next ? c.accentText : c.muted,
                      }}
                    >
                      {state === 'done' ? '✓' : String(s.stage)}
                    </Txt>
                  </View>
                );
                return (
                  <Rise
                    key={s.stage}
                    dy={10}
                    ms={350}
                    delay={k * 45}
                    {...(next
                      ? {
                          onLayout: (e: LayoutChangeEvent) => {
                            nextBox.current = { stage: s.stage, ...e.nativeEvent.layout };
                            settleScroll();
                          },
                        }
                      : {})}
                  >
                    <View
                      testID={`tour-stage-${s.stage}`}
                      style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 12 }}
                    >
                      {justWon === s.stage ? (
                        <Pop from={0} delay={300}>
                          {badge}
                        </Pop>
                      ) : (
                        badge
                      )}
                      <View
                        style={[
                          box,
                          {
                            flex: 1,
                            minWidth: 0,
                            gap: 6,
                            padding: 12,
                            borderColor: next ? c.accentText : c.line,
                            opacity: state === 'locked' ? 0.6 : 1,
                          },
                        ]}
                      >
                        <View
                          style={{
                            flexDirection: 'row',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            gap: 8,
                          }}
                        >
                          <Txt bold>{tourStageName(s.stage)}</Txt>
                          <Txt
                            accessibilityLabel={L.starsOf({ n: s.stars, max: 3 })}
                            style={{ color: c.warn, letterSpacing: 2 }}
                          >
                            {'★'.repeat(s.stars)}
                            <Txt style={{ color: c.line, letterSpacing: 2 }}>
                              {'★'.repeat(3 - s.stars)}
                            </Txt>
                          </Txt>
                        </View>
                        <Txt v="xs" tone="muted">
                          {`${L.oppOvr({ n: s.opp })} · ${s.formation} · ${tourTacticName(s.tactic)}`}
                        </Txt>
                        {s.rules.map((r, k) => rule(tourRuleText(r), String(k)))}
                        <Txt
                          v="xs"
                          bold={state !== 'done'}
                          tone={state === 'done' ? 'muted' : 'accent'}
                        >
                          {state === 'done' ? L.cleared : L.fee({ v: fmtValue(s.fee) })}
                        </Txt>
                        {next ? (
                          tour.triesLeft > 0 ? (
                            <Btn kind="primary" testID="tour-go" onPress={() => openStage(s)}>
                              {L.go}
                            </Btn>
                          ) : (
                            <Txt v="xs" tone="muted" testID="tour-no-tries">
                              {L.noTries}
                            </Txt>
                          )
                        ) : state === 'locked' ? (
                          <Txt v="xs" tone="muted">
                            {L.locked}
                          </Txt>
                        ) : null}
                        {unlock ? (
                          <Rise delay={1000} dy={8} ms={400}>
                            <Txt v="xs" bold tone="accent" testID="tour-unlocked">
                              {L.unlocked}
                            </Txt>
                          </Rise>
                        ) : null}
                      </View>
                    </View>
                  </Rise>
                );
              })}
            </View>
            <View style={{ gap: 4 }}>
              {[L.infoTries({ n: TOUR_TRIES_PER_DAY }), L.infoFee, L.infoDraw, L.infoWeek].map(
                (t) => (
                  <Txt key={t} v="xs" tone="muted">
                    {`· ${t}`}
                  </Txt>
                ),
              )}
            </View>
          </>
        ) : view === 'prep' && stage && draft ? (
          <>
            <View testID="tour-scout" style={[box, { gap: 6, padding: 14 }]}>
              <Txt bold>{L.scoutTitle}</Txt>
              <Txt>{`${L.oppOvr({ n: stage.opp })} · ${stage.formation} · ${L.oppTactic({ name: tourTacticName(stage.tactic) })}`}</Txt>
              <Txt v="xs" tone="muted">
                {L.oppHabit}
              </Txt>
              <Txt bold>{L.restriction}</Txt>
              {stage.rules.map((r, k) => rule(tourRuleText(r), String(k)))}
              <Txt v="xs" tone="muted">
                {L.merc({ n: stage.merc })}
              </Txt>
            </View>
            <Txt bold>{L.lineupTitle}</Txt>
            <View
              accessibilityRole="radiogroup"
              accessibilityLabel={L.lineupTitle}
              style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}
            >
              {FORMATION_IDS.map((f) => (
                <Opt
                  key={f}
                  testID={`tour-formation-${f}`}
                  selected={draft.formation === f}
                  accessibilityLabel={f}
                  onPress={() => setFormation(f)}
                >
                  <Txt bold>{f}</Txt>
                </Opt>
              ))}
              <Btn testID="tour-auto" onPress={auto}>
                {L.auto}
              </Btn>
            </View>
            <Txt v="xs" tone="muted">
              {L.pickSlot}
            </Txt>
            <TeamPitch
              formation={draft.formation}
              cells={pitchCells}
              selected={slotOpen}
              animate={false}
              onpick={(i) => {
                setSlotOpen((cur) => (cur === i ? null : i));
                setBenchOpen(false);
              }}
            />
            {slotOpen !== null ? (
              <View testID="tour-options" style={{ gap: 8 }}>
                <Press
                  testID="tour-clear"
                  accessibilityLabel={`${L.emptySlot}, ${L.mercName} ${stage.merc}`}
                  onPress={() => place(null)}
                  style={[box, { minHeight: 44, justifyContent: 'center', paddingHorizontal: 12 }]}
                >
                  <Txt bold>{L.emptySlot}</Txt>
                  <Txt v="xs" tone="muted">{`${L.mercName} ${stage.merc}`}</Txt>
                </Press>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                  {options.map((o) => {
                    const p = byId.get(o.id);
                    if (!p) return null;
                    const nm = marketName(p, local);
                    const off = !!o.blocked;
                    return (
                      <Press
                        key={o.id}
                        testID={`tour-option-${o.id}`}
                        accessibilityLabel={`${nm} ${o.rating}${off ? `, ${o.blocked === 'rule' ? L.blocked : L.capFull}` : ''}`}
                        accessibilityState={{ disabled: off }}
                        disabled={off}
                        onPress={() => place(o.id)}
                        style={{ opacity: off ? 0.5 : 1, minHeight: 44 }}
                      >
                        <Mini
                          player={p}
                          name={nm}
                          rating={o.rating}
                          code={FORMATIONS[draft.formation][slotOpen]!}
                          note={off ? (o.blocked === 'rule' ? L.blocked : L.capFull) : null}
                          noteTone="bad"
                        />
                      </Press>
                    );
                  })}
                </View>
              </View>
            ) : null}
            <View
              style={{
                flexDirection: 'row',
                justifyContent: 'space-between',
                alignItems: 'center',
                gap: 8,
              }}
            >
              <Txt bold testID="tour-bench-count" style={{ flexShrink: 1 }}>
                {L.benchTitle({ n: draft.bench.length, max: TOUR_LIVE.bench })}
              </Txt>
              <Btn
                sm
                testID="tour-bench"
                onPress={() => {
                  setBenchOpen((v) => !v);
                  setSlotOpen(null);
                }}
              >
                {benchOpen ? L.close : L.pickBench}
              </Btn>
            </View>
            <View
              testID="tour-bench-list"
              style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}
            >
              {draft.bench.map((id) => {
                const p = byId.get(id);
                if (!p) return null;
                return (
                  <Press
                    key={id}
                    testID={`tour-bench-on-${id}`}
                    accessibilityLabel={marketName(p, local)}
                    accessibilityState={{ selected: true }}
                    onPress={() => toggleBench(id)}
                    style={{
                      minHeight: 44,
                      padding: 2,
                      borderRadius: RADIUS.sm,
                      borderWidth: 2,
                      borderColor: c.accentText,
                    }}
                  >
                    <Mini
                      player={p}
                      name={marketName(p, local)}
                      rating={p.peak}
                      code={detailPosOf(p)}
                    />
                  </Press>
                );
              })}
              {benchOpen
                ? benchOptions.map((o) => {
                    const p = byId.get(o.id);
                    if (!p) return null;
                    const full = draft.bench.length >= TOUR_LIVE.bench;
                    return (
                      <Press
                        key={o.id}
                        testID={`tour-bench-option-${o.id}`}
                        accessibilityLabel={marketName(p, local)}
                        accessibilityState={{ disabled: full }}
                        disabled={full}
                        onPress={() => toggleBench(o.id)}
                        style={{ opacity: full ? 0.5 : 1, minHeight: 44, padding: 2 }}
                      >
                        <Mini
                          player={p}
                          name={marketName(p, local)}
                          rating={p.peak}
                          code={detailPosOf(p)}
                        />
                      </Press>
                    );
                  })
                : null}
            </View>
            <Txt bold>{L.tacticPick}</Txt>
            {tacticGrid(
              TOUR_TACTICS.map((t) => {
                const e = tourEdge(t, stage.tactic);
                return { tactic: t, text: e.text, textTone: tone(e.edge) };
              }),
              draft.tactic,
              (t) => setDraft({ ...draft, tactic: t }),
              L.tacticPick,
            )}
            <Txt v="xs" tone="muted">
              {`${tourTacticDesc(draft.tactic)} · ${tourEdge(draft.tactic, stage.tactic).text}`}
            </Txt>
            {error ? (
              <Txt tone="bad" accessibilityRole="alert">
                {error}
              </Txt>
            ) : null}
            <Btn
              kind="primary"
              block
              testID="tour-depart"
              disabled={busy}
              onPress={() => void depart()}
            >
              {L.depart}
            </Btn>
          </>
        ) : (view === 'live' || view === 'result') && match ? (
          <>
            <Shake on={banner?.side === 'home' ? banner : null}>
              <View testID="tour-match" style={[band, { overflow: 'hidden' }]}>
                <View
                  style={{
                    flexDirection: 'row',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    gap: 12,
                  }}
                >
                  <Txt v="sm" tone="onPitch">
                    {liveStage ? L.oppOvr({ n: liveStage.opp }) : ''}
                  </Txt>
                  <Txt v="sm" tone="pitchAccent" testID="tour-clock">
                    {over
                      ? match.status === 'won'
                        ? L.winTitle
                        : L.loseTitle
                      : playing
                        ? L.minute({ n: clock })
                        : `${L.minute({ n: span.from })} · ${L.timeout}`}
                  </Txt>
                </View>
                <View
                  testID="tour-score"
                  accessible
                  accessibilityLabel={`${shown.opp} : ${shown.mine}`}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: 12,
                  }}
                >
                  <View style={{ flex: 1, gap: 2 }}>
                    <Txt v="xs" tone="onPitch" style={{ opacity: 0.8 }}>
                      {L.oppGoal}
                    </Txt>
                    <Txt v="sm" bold tone="onPitch">
                      {liveStage?.formation ?? ''}
                    </Txt>
                  </View>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    <Pop key={`o${shown.opp}`} from={1.7}>
                      <Txt tone="onPitch" style={digit}>
                        {String(shown.opp)}
                      </Txt>
                    </Pop>
                    <Txt tone="onPitch" style={digit}>
                      :
                    </Txt>
                    <Pop key={`m${shown.mine}`} from={1.7}>
                      <Txt tone="pitchAccent" style={digit}>
                        {String(shown.mine)}
                      </Txt>
                    </Pop>
                  </View>
                  <View style={{ flex: 1, gap: 2, alignItems: 'flex-end' }}>
                    <Txt v="xs" tone="onPitch" style={{ opacity: 0.8 }}>
                      {L.vsAway}
                    </Txt>
                    <Txt v="sm" bold tone="onPitch">
                      {match.formation}
                    </Txt>
                  </View>
                </View>
                <View
                  accessible={false}
                  style={{
                    height: 6,
                    borderRadius: RADIUS.pill,
                    backgroundColor: c.chalk,
                    justifyContent: 'center',
                  }}
                >
                  <View
                    style={{
                      position: 'absolute',
                      left: 0,
                      top: 0,
                      bottom: 0,
                      width: `${Math.min(100, ((playing ? clock : match.done * SEG) / 90) * 100)}%`,
                      borderRadius: RADIUS.pill,
                      backgroundColor: c.pitchAccent,
                    }}
                  />
                  {Array.from({ length: TOUR_LIVE.segments - 1 }, (_, i) => (
                    <View
                      key={i}
                      style={{
                        position: 'absolute',
                        left: `${((i + 1) * 100) / TOUR_LIVE.segments}%`,
                        top: -3,
                        width: 2,
                        height: 12,
                        backgroundColor: c.onPitch,
                        opacity: 0.7,
                      }}
                    />
                  ))}
                </View>
                <Txt v="xs" tone="onPitch">
                  {`${L.oppNow({ name: tourTacticName(match.oppTactic) })} · ${tourTacticName(match.tactic)}`}
                </Txt>
                {kickoff ? (
                  <Flash testID="tour-kickoff">
                    <Pop from={0}>
                      <Txt tone="pitchAccent" style={flashTitle}>
                        {L.kickoff}
                      </Txt>
                    </Pop>
                  </Flash>
                ) : banner ? (
                  <Flash testID="tour-goal">
                    <Pop from={0}>
                      <Txt
                        tone={banner.side === 'away' ? 'pitchAccent' : 'onPitch'}
                        style={flashTitle}
                      >
                        {banner.side === 'away' ? L.goalMine : L.goalOpp}
                      </Txt>
                    </Pop>
                    <Txt tone="onPitch" bold center>
                      {`${banner.minute}' ${goalText(banner)}${
                        banner.side === 'away' && banner.assist
                          ? ` · ${L.assist({ name: banner.assistId ? nameOf(banner.assistId) : banner.assist })}`
                          : ''
                      }`}
                    </Txt>
                  </Flash>
                ) : null}
              </View>
            </Shake>
            {playing ? (
              <MemoPitch formation={match.formation} cells={livePitch} focus={focus} />
            ) : null}
            <View testID="tour-events" style={{ gap: 6 }}>
              {shown.events.length ? (
                shown.events.map((e, k) => (
                  <View key={k} style={{ flexDirection: 'row', gap: 10 }}>
                    <Tx v="sm" num style={{ width: 36 }}>{`${e.minute}'`}</Tx>
                    <Tx
                      v="sm"
                      bold={e.side === 'away'}
                      tone={e.side === 'away' ? 'accent' : 'ink'}
                      style={{ flex: 1 }}
                    >
                      {goalText(e)}
                      {e.side === 'away' && e.assist
                        ? ` · ${L.assist({ name: e.assistId ? nameOf(e.assistId) : e.assist })}`
                        : ''}
                    </Tx>
                  </View>
                ))
              ) : (
                <Tx v="sm" tone="muted">
                  {L.noGoals}
                </Tx>
              )}
            </View>
            {playing ? null : !over ? (
              <Rise dy={18} style={{ gap: 12 }}>
                <Tx bold>{L.timeout}</Tx>
                <Tx v="xs" tone="muted">
                  {L.timeoutLead}
                </Tx>
                {tacticGrid(
                  chances.map((x) => ({
                    tactic: x.tactic,
                    text: L.chance({ n: x.pct }),
                    textTone: tone(x.diff),
                    now: x.tactic === match.tactic,
                  })),
                  orderTactic,
                  setOrderTactic,
                  L.timeout,
                )}
                <View
                  style={{
                    flexDirection: 'row',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    gap: 8,
                  }}
                >
                  <Tx bold testID="tour-subs" style={{ flexShrink: 1 }}>
                    {L.subsLeft({ n: match.subsLeft - subs.length })}
                  </Tx>
                  <Tx v="xs" tone="muted" style={{ flex: 1, textAlign: 'right' }}>
                    {outSlot === null ? L.subPickOut : L.subPickIn}
                  </Tx>
                </View>
                <MemoPitch
                  formation={match.formation}
                  cells={livePitch}
                  selected={outSlot}
                  animate={false}
                  onpick={pickOut}
                />
                {liveCells
                  .filter((x) => x.tired)
                  .map((x) => (
                    <View
                      key={x.i}
                      style={{
                        flexDirection: 'row',
                        justifyContent: 'space-between',
                        gap: 8,
                      }}
                    >
                      <Tx v="sm" bold style={{ flex: 1 }}>{`${x.slot} ${x.name}`}</Tx>
                      <Tx v="sm" tone="bad">
                        {L.stamina({ n: x.stamina })}
                      </Tx>
                    </View>
                  ))}
                <View
                  testID="tour-live-bench"
                  style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}
                >
                  {benchLeft.map((id) => {
                    const p = byId.get(id);
                    if (!p) return null;
                    const nm = marketName(p, local);
                    return (
                      <Press
                        key={id}
                        testID={`tour-sub-in-${id}`}
                        accessibilityLabel={nm}
                        accessibilityState={{ disabled: outSlot === null }}
                        disabled={outSlot === null}
                        onPress={() => pickIn(id)}
                        style={{
                          opacity: outSlot === null ? 0.5 : 1,
                          minHeight: 44,
                          padding: 2,
                        }}
                      >
                        <Mini
                          player={p}
                          name={nm}
                          rating={p.peak}
                          code={
                            outSlot !== null
                              ? FORMATIONS[match.formation][outSlot]!
                              : detailPosOf(p)
                          }
                        />
                      </Press>
                    );
                  })}
                </View>
                {subs.map((s, k) => (
                  <View
                    key={s.slot}
                    testID="tour-sub"
                    style={[
                      box,
                      {
                        flexDirection: 'row',
                        alignItems: 'center',
                        gap: 8,
                        padding: 8,
                        paddingLeft: 12,
                      },
                    ]}
                  >
                    <Txt v="sm" style={{ flex: 1 }}>
                      <Txt v="sm" bold tone="bad">
                        {L.subOut}
                      </Txt>
                      {` ${nameOf(match.slotIds[s.slot] ?? null)} → `}
                      <Txt v="sm" bold tone="good">
                        {L.subIn}
                      </Txt>
                      {` ${nameOf(s.cardId)}`}
                    </Txt>
                    <Btn sm onPress={() => setSubs((cur) => cur.filter((_, i) => i !== k))}>
                      {L.subCancel}
                    </Btn>
                  </View>
                ))}
                {error ? (
                  <Tx tone="bad" accessibilityRole="alert">
                    {error}
                  </Tx>
                ) : null}
                <Btn
                  kind="primary"
                  block
                  testID="tour-continue"
                  disabled={busy}
                  onPress={() => void sendOrder()}
                >
                  {L.continueBtn(span)}
                </Btn>
              </Rise>
            ) : (
              <>
                {match.result ? (
                  <>
                    {match.result.pens ? (
                      <Tx v="sm" tone="muted">
                        {L.pens}
                      </Tx>
                    ) : null}
                    {match.status === 'won' ? (
                      <>
                        <View
                          testID="tour-result-stars"
                          accessibilityLabel={L.starsOf({ n: match.result.stars, max: 3 })}
                          style={{ flexDirection: 'row', gap: 8 }}
                        >
                          {[L.starWin, L.starFirst, L.starMargin].map((label, i) => {
                            const got =
                              i === 0 ||
                              (i === 1 && match.tryNo === 1) ||
                              (i === 2 &&
                                !match.result!.pens &&
                                match.goalsFor - match.goalsAgainst >= 2);
                            const star = (
                              <Txt
                                accessible={false}
                                style={{
                                  fontSize: rem(3),
                                  lineHeight: rem(3.2),
                                  color: got ? c.pitchAccent : c.chalk,
                                }}
                              >
                                ★
                              </Txt>
                            );
                            return (
                              <View key={label} style={{ flex: 1, alignItems: 'center', gap: 2 }}>
                                {got ? (
                                  <Pop from={0} delay={200 + i * 250}>
                                    {star}
                                  </Pop>
                                ) : (
                                  star
                                )}
                                <Tx v="xs" tone="muted" center>
                                  {label}
                                </Tx>
                              </View>
                            );
                          })}
                        </View>
                        <Rise delay={1000}>
                          <View style={band}>
                            {stats([
                              {
                                label: L.feeGot,
                                value: `+${fmtValue(match.result.fee)}`,
                                gold: true,
                                testID: 'tour-fee',
                              },
                              { label: L.scoreGot, value: `+${match.result.score}` },
                            ])}
                          </View>
                        </Rise>
                        {nextStage ? (
                          <Rise delay={1400}>
                            <Tx bold center tone="accent" testID="tour-next-open">
                              {L.unlocked}
                            </Tx>
                          </Rise>
                        ) : null}
                      </>
                    ) : (
                      <Tx tone="muted">{L.loseHint}</Tx>
                    )}
                  </>
                ) : null}
                <View style={{ flexDirection: 'row', gap: 8 }}>
                  <View style={{ flex: 1 }}>
                    <Btn block testID="tour-map-btn" onPress={() => setView('map')}>
                      {L.toMap}
                    </Btn>
                  </View>
                  {nextStage && tour.triesLeft > 0 ? (
                    <View style={{ flex: 1 }}>
                      <Btn
                        block
                        kind="primary"
                        testID="tour-next"
                        onPress={() => openStage(nextStage)}
                      >
                        {match.status === 'won' ? L.nextStage : L.again}
                      </Btn>
                    </View>
                  ) : null}
                </View>
              </>
            )}
          </>
        ) : view === 'rank' ? (
          <>
            <Txt v="xs" tone="muted">
              {L.rankingLead}
            </Txt>
            {rankFailed ? (
              <Txt tone="muted">{L.rankingFail}</Txt>
            ) : !ranking ? (
              <Txt tone="muted">{L.loading}</Txt>
            ) : !ranking.rows.length ? (
              <Txt tone="muted" testID="tour-rank-empty">
                {L.rankingEmpty}
              </Txt>
            ) : (
              <View testID="tour-ranking">
                {ranking.rows.map((r) => (
                  <View
                    key={r.rank}
                    accessible
                    accessibilityLabel={`${L.rank({ n: r.rank })}, ${r.name}, ${L.rankingCleared({ n: r.cleared })}, ${r.stars}, ${r.score}`}
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      gap: 10,
                      minHeight: 52,
                      paddingVertical: 8,
                      borderTopWidth: 1,
                      borderTopColor: c.line,
                    }}
                  >
                    <Txt num style={{ width: 32 }}>
                      {String(r.rank)}
                    </Txt>
                    <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
                      <Txt bold numberOfLines={1}>
                        {r.name}
                      </Txt>
                      <Txt
                        v="xs"
                        tone="muted"
                      >{`${L.rankingCleared({ n: r.cleared })} · ★ ${r.stars}`}</Txt>
                    </View>
                    <Txt num style={{ fontSize: rem(1.2) }}>
                      {String(r.score)}
                    </Txt>
                  </View>
                ))}
              </View>
            )}
          </>
        ) : view === 'history' ? (
          <>
            <Txt v="xs" tone="muted">
              {L.historyLead}
            </Txt>
            {historyFailed ? (
              <Txt tone="muted">{L.historyFail}</Txt>
            ) : !history ? (
              <Txt tone="muted">{L.loading}</Txt>
            ) : !history.rows.length ? (
              <Txt tone="muted" testID="tour-history-empty">
                {L.historyEmpty}
              </Txt>
            ) : (
              <View testID="tour-history-list">
                {history.rows.map((r) => {
                  const week = tourWeekLabel(r.week, history.week);
                  const line = [
                    L.rankingCleared({ n: r.cleared }),
                    `★ ${r.stars}`,
                    L.historyTries({ n: r.tries }),
                    ...(r.fee ? [L.fee({ v: fmtValue(r.fee) })] : []),
                  ].join(' · ');
                  const rank = r.rank ? L.rank({ n: r.rank }) : L.rankNone;
                  return (
                    <View
                      key={r.week}
                      accessible
                      accessibilityLabel={`${week}, ${rank}, ${line}, ${L.score} ${r.score}`}
                      style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        gap: 10,
                        minHeight: 52,
                        paddingVertical: 8,
                        borderTopWidth: 1,
                        borderTopColor: c.line,
                      }}
                    >
                      <Txt num style={{ width: 32 }}>
                        {r.rank ? String(r.rank) : '–'}
                      </Txt>
                      <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
                        <Txt bold numberOfLines={1}>
                          {week}
                        </Txt>
                        <Txt v="xs" tone="muted">
                          {line}
                        </Txt>
                      </View>
                      <Txt num style={{ fontSize: rem(1.2) }}>
                        {String(r.score)}
                      </Txt>
                    </View>
                  );
                })}
              </View>
            )}
          </>
        ) : null}
      </Screen>
    </NightCtx.Provider>
  );
}
