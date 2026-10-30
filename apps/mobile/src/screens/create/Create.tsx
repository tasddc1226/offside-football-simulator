// 선수 생성(웹 Create.svelte): 위쪽 라이브 카드가 고를 때마다 바로 바뀌고, 아래 고정 버튼이 남은 할 일을 알려 준다.
// 1단계(프로필 입력) → 2단계(후보 카드 비교·선택). appState.candidates가 있으면 2단계.
import { FONT, RADIUS } from '@offside/app-core/design-tokens';
import { careerGuideText as CG } from '@offside/app-core/i18n/ko/careerGuide';
import { useEffect, useState, useRef, type ReactNode } from 'react';
import { Alert, Animated, Easing, ScrollView, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useSnapshot } from 'valtio';
import {
  POS,
  DPOS,
  DETAILS_OF,
  TRAITS,
  ATTR_KEYS,
  FOCUS_PICK,
  attrLabels,
  defaultFocus,
  focusMod,
  posLabel,
} from '@offside/game/data';
import type { AttrKey, DetailPos, Pos } from '@offside/game/data';
import { baseline, candidatePotentialGrades } from '@offside/game/candidates';
// T-11-196 프리미엄 후보 식을 등록한다(첫 화면 번들에서 떼어 둠).
import '@offside/game/premiumScout';
import { CONFEDS, flagOf } from '@offside/contracts/nations';
import { BODY_DEFAULT, bmiOf, bodyError } from '@offside/contracts/body';
import { isKorean, nationOf } from '@offside/game/nation';
import {
  bodyNote,
  focusNote,
  hiddenStrength,
  scoutLine,
  startOvr,
  ovrFocusView,
} from '@offside/app-core/create-view';
import { adText } from '@offside/app-core/i18n/ko/ad';
import { createText as L } from '@offside/app-core/i18n/ko/create';
import { cupText as CL } from '@offside/app-core/i18n/ko/cup';
import { cupAppText as CA } from '@offside/app-core/i18n/ko/cupApp';
import { fetchItems, spendReroll, spendScout } from '@offside/app-core/api/cup';
import { scoutText as SL } from '@offside/app-core/i18n/ko/scout';
import { scoutWhatText } from '@offside/app-core/scoutOdds';
import {
  REROLL_MILEAGE,
  rerollMileageLeft,
  scoutPityAt,
  type ScoutPity,
} from '@offside/contracts/cup';
import { ScoutOdds } from '../owner/ScoutOdds';
import { ScoutPityGauge } from './ScoutPityGauge';
import {
  candidateTiers,
  gradeTier,
  revealTiming,
  revealTotal,
  type RevealTier,
  type RevealTiming,
} from '@offside/app-core/reveal';
import { revealText as RV } from '@offside/app-core/i18n/ko/reveal';
import { CountUp } from '../../components/CountUp';
import { flashEdge, revealBuzz, RevealGrade } from '../../components/RevealFx';
import { fundsText } from '@offside/app-core/funds';
import { gameBoostText as B } from '@offside/app-core/i18n/ko/gameBoost';
import { useClubReward } from '../../platform/clubShop';
import { watchDetailOpening } from '@offside/app-core/season-opening';
import { detailOpenNow, draftBody, draftDpos, randomName } from '@offside/app-core/state';
import {
  revealCandidatePotential,
  rerollCandidates,
  keepCandidate,
  keptDraft,
  restoreKeptDraft,
  premiumScoutCandidates,
  planPremiumScout,
  rollCandidates,
  startCareer,
  toast,
} from '../../game/host';
import { claimReward, prepareReward, rewardOffer } from '../../platform/rewarded';
import { adFree, adsOff } from '../../platform/adFree';
import { adRerollLeft, claimAdReroll } from '../../platform/adReroll';
import { goHome, goRerollShop } from '../../game/nav';
import { appState, prefs } from '../../store';
import { alpha } from '../../theme/colors';
import { DISPLAY, num, rem } from '../../theme/type';
import { useColors } from '../../theme/useColors';
import {
  ActionBar,
  Btn,
  Card,
  DisclosureRow,
  Opt,
  Pill,
  Press,
  Row,
  Topbar,
  Txt,
  useShadow,
} from '../../ui';
import { CoachTarget } from '../../components/Coachmark';
import { noteScrollY, revealFocusedInput } from '../../ui/scroll';
import { useFormKeyboardScroll } from '../../ui/useFormKeyboardScroll';
import { MiniRadar } from './MiniRadar';
import { NationPicker } from './NationPicker';
import { CreateLook } from './CreateLook';
import { ScoutScan } from './ScoutScan';
import { PositionGuide } from '../game/PositionGuide';
import { ItemsHint } from '../../components/ItemsHint';
import { BodyInput, Field, Seg, SegCell, mixHex, useInputStyle } from './parts';
import { tn } from '@offside/game/i18n/names';

// T-11-244 천장 카운트가 없는 구단주(아직 스카우트권을 쓴 적 없음).
const NO_PITY: ScoutPity = { used: 0, streak: 0, elites: 0 };

const posKeys = Object.keys(POS) as Pos[];
const feet = ['오른발', '왼발', '양발'] as const; // 저장값(화면에는 L.foot으로)

// ── 입력을 원본 상태(appState.C)에 쓰는 동작들 ──
// 세부 포지션을 바꾸면 주력 능력치도 그 포지션의 기본값으로 다시 켠다.
function pickDetail(d: DetailPos) {
  appState.C.dpos = d;
  appState.C.focus = [...DPOS[d].focus];
}
function setPos(v: Pos, detailOpen: boolean) {
  appState.C.pos = v;
  if (detailOpen) pickDetail(DETAILS_OF[v][0]!);
  else appState.C.focus = defaultFocus(v);
}
// 이미 두 개를 골랐으면 먼저 고른 쪽을 밀어낸다 — 한 번의 탭으로 바꿔 끼울 수 있게.
function toggleFocus(k: AttrKey) {
  const cur = appState.C.focus;
  appState.C.focus = cur.includes(k) ? cur.filter((f) => f !== k) : [...cur, k].slice(-FOCUS_PICK);
}
function backToForm() {
  appState.candidates = null;
}
function openAll() {
  appState.candidatesOpen = appState.candidatesOpen.map(() => true);
}
// 카드를 누르면(닫혀 있든 열려 있든) 바로 열리면서 그 후보가 선택된다 — 한 번의 탭으로
// "오픈 + 선택"이 끝나는 모바일 우선 상호작용. "모두 열기"는 선택 없이 전부 펼쳐만 준다.
function pick(i: number) {
  appState.candidatesOpen[i] = true;
  appState.candidatePick = i;
}
function confirmPick() {
  const cand =
    appState.candidatePick == null ? null : appState.candidates?.[appState.candidatePick];
  if (!cand) return;
  startCareer(appState.C.name, appState.C.number, { ...cand.attrs }, { ...cand.potential });
}

/** 카드가 세로축으로 뒤집히며 열린다. 동작 줄이기면 바로 표시. */
function FlipIn({ children, delay = 0 }: { children: ReactNode; delay?: number }) {
  const [v] = useState(() => new Animated.Value(prefs.motionOK ? 0 : 1));
  useEffect(() => {
    if (prefs.motionOK)
      Animated.timing(v, {
        toValue: 1,
        // T-11-371 대박은 뒷면에서 한 박자 쉬고 뒤집힌다.
        delay,
        duration: 360,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }).start();
    // 마운트 때 한 번만 뒤집는다.
  }, [v]);
  return (
    <Animated.View
      style={{
        opacity: v.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0, 1, 1] }),
        transform: [
          { perspective: 800 },
          { rotateY: v.interpolate({ inputRange: [0, 1], outputRange: ['90deg', '0deg'] }) },
        ],
      }}
    >
      {children}
    </Animated.View>
  );
}

/** 닫힌 카드가 아래에서 차례로 떠오른다. */
function FlyIn({ index, children }: { index: number; children: ReactNode }) {
  const [v] = useState(() => new Animated.Value(prefs.motionOK ? 0 : 1));
  useEffect(() => {
    if (prefs.motionOK)
      Animated.timing(v, {
        toValue: 1,
        duration: 280,
        delay: 90 * index,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }).start();
  }, [v, index]);
  return (
    <Animated.View
      style={{
        opacity: v,
        transform: [{ translateY: v.interpolate({ inputRange: [0, 1], outputRange: [14, 0] }) }],
      }}
    >
      {children}
    </Animated.View>
  );
}

export default function Create() {
  const s = useSnapshot(appState, { sync: true });
  const C = s.C;
  const owned = adsOff(useSnapshot(adFree));
  const offer = rewardOffer('candidates', owned);
  const rewardLock = useRef(false);
  const [rewardBusy, setRewardBusy] = useState(false);
  const [guideOpen, setGuideOpen] = useState(false);
  const [rewardMessage, setRewardMessage] = useState('');
  // T-11-371 팩 오픈식 공개: 열 때 보이는 값(OVR · 보장 · 천장)으로만 강도를 정한다. 이 화면에서 연 카드만 연출하고,
  // 두 번째 카드부터는 짧게. 동작 줄이기 · "연출 짧게"면 결과만.
  const tiers: RevealTier[] = s.candidates
    ? candidateTiers(
        s.candidates.map((c) => ({
          ovr: startOvr(C.pos, c.attrs),
          guaranteed: c.guaranteed,
          pity: c.pity,
        })),
      )
    : [];
  const [fx, setFx] = useState<Record<number, RevealTiming & { done: boolean }>>({});
  const opened = useRef(0);
  const fxTimers = useRef<ReturnType<typeof setTimeout>[]>([]);
  useEffect(() => {
    // 다시 뽑기 · 프리미엄 스카우트로 후보가 바뀌면 새 카드로 다시 센다.
    setFx({});
    opened.current = 0;
  }, [s.candidates]);
  useEffect(() => () => fxTimers.current.forEach(clearTimeout), []);
  const land = (i: number) =>
    setFx((m) => {
      const f = m[i];
      if (!f || f.done) return m;
      const tier = tiers[i] ?? 'normal';
      revealBuzz(tier);
      if (tier === 'jackpot') flashEdge();
      return { ...m, [i]: { ...f, done: true } };
    });
  const stage = (i: number) => {
    if (appState.candidatesOpen[i] || fx[i]) return;
    const tier = tiers[i] ?? 'normal';
    const t = revealTiming(tier, {
      off: !prefs.motionOK,
      short: prefs.revealShort,
      repeat: opened.current++ > 0,
    });
    const total = revealTotal(t);
    if (total === 0) revealBuzz(tier);
    else fxTimers.current.push(setTimeout(() => land(i), total));
    setFx((m) => ({ ...m, [i]: { ...t, done: total === 0 } }));
  };
  const pickCard = (i: number) => {
    // 연출 중인 카드를 다시 누르면 바로 결과로 간다.
    if (fx[i] && !fx[i].done) land(i);
    stage(i);
    pick(i);
  };
  const openAllCards = () => {
    appState.candidatesOpen.forEach((_, i) => stage(i));
    openAll();
  };
  // 잠재력 범위를 이 화면에서 새로 열었을 때만 등급 연출.
  const potWas = useRef(s.candidatePotentialOpen);
  const [potFresh, setPotFresh] = useState(false);
  useEffect(() => {
    if (s.candidatePotentialOpen && !potWas.current) setPotFresh(true);
    potWas.current = s.candidatePotentialOpen;
  }, [s.candidatePotentialOpen]);
  const reveal = async () => {
    if (rewardLock.current || appState.candidatePotentialOpen) return;
    rewardLock.current = true;
    const batch = appState.candidates;
    setRewardBusy(true);
    setRewardMessage('');
    try {
      let saveFailed = false;
      const message = await claimReward(
        'candidates',
        () => {
          saveFailed = !revealCandidatePotential(batch);
        },
        L.potentialWatch,
      );
      setRewardMessage(saveFailed ? L.potentialSaveFailed : message);
    } catch {
      setRewardMessage(adText.rewardedUnavailable);
    } finally {
      rewardLock.current = false;
      setRewardBusy(false);
    }
  };
  // T-11-145 오프사이드 컵 보상 리롤권 — 로그인한 구단주가 한 장 이상 갖고 있을 때만 '후보 다시 뽑기'를 보여 준다.
  const [rerolls, setRerolls] = useState(0);
  // T-11-152 장수를 받았으면(로그인한 구단주) 0장일 때 구단 자금으로 사는 리롤권 상점으로 가는 안내를 보인다.
  const [owner, setOwner] = useState(false);
  const [rerolling, setRerolling] = useState(false);
  const rerollLock = useRef(false);
  // 한 번의 '다시 뽑기' 시도에 멱등 키 하나 — 응답을 못 받아(네트워크) 다시 누르면 같은 키로 보내 두 번 차감되지 않는다.
  const rerollKey = useRef<string | null>(null);
  // T-11-248 리롤권 마일리지 — 마지막 스카우트권 지급 뒤 쓴 장수. 차면 서버가 같은 응답에서 스카우트권을 준다.
  const [mileage, setMileage] = useState(0);
  const hasCandidates = !!s.candidates;
  // T-11-196 프리미엄 스카우트권 — 가진 장수가 있으면 버튼, 없으면 구단주에게 상점(구단주 화면)으로 가는 안내. 잠금 · 멱등 키는 리롤과 함께 쓴다.
  const [scouts, setScouts] = useState(0);
  const scoutKey = useRef<string | null>(null);
  // T-11-244 천장 카운트. 다시 보낼 때는 같은 시드 계획을 같은 멱등 키와 함께 쓴다.
  const [pity, setPity] = useState<ScoutPity>(NO_PITY);
  const scoutPlan = useRef<{ seed: number; hit: boolean } | null>(null);
  const premium = !!s.candidates?.some((x) => x.guaranteed);
  // T-11-437 쓸 도구(리롤권 · 스카우트권 · 천장 기록)가 없으면 상점 안내 · 능력치 설명을 '더 보기'로 접는다.
  const quiet = rerolls < 1 && scouts < 1 && pity.used < 1;
  useEffect(() => {
    if (!hasCandidates) return;
    let live = true;
    void fetchItems().then((r) => {
      if (!live) return;
      setOwner(r.ok);
      setRerolls(r.ok ? r.data.reroll : 0);
      setScouts(r.ok ? (r.data.scout ?? 0) : 0);
      setPity(r.ok ? (r.data.pity ?? NO_PITY) : NO_PITY);
      setMileage(r.ok ? (r.data.mileage ?? 0) : 0);
    });
    return () => {
      live = false;
    };
  }, [hasCandidates]);
  // T-11-153 광고 대신 구단 자금으로 후보 잠재력 보기(로그인한 구단주). 광고 제거 구매자는 이미 광고 없이 보므로 묻지 않는다.
  const club = useClubReward(
    'candidates',
    hasCandidates && !s.candidatePotentialOpen && offer !== 'free',
  );
  const revealWithClub = async () => {
    if (rewardLock.current || appState.candidatePotentialOpen) return;
    rewardLock.current = true;
    const batch = appState.candidates;
    setRewardBusy(true);
    setRewardMessage('');
    try {
      let saveFailed = false;
      const message = await club.pay(() => {
        saveFailed = !revealCandidatePotential(batch);
      });
      if (message !== null) setRewardMessage(saveFailed ? L.potentialSaveFailed : message);
    } finally {
      rewardLock.current = false;
      setRewardBusy(false);
    }
  };
  // T-11-154 광고 보고 다시 뽑기(리롤권 없이, 하루 2번, 이 기기에서 센다). 로그인하지 않아도 쓴다. 광고 단위 · 버튼 종류는
  // 후보 잠재력(offer)과 같다. 남은 횟수는 그릴 때마다 기기 저장소에서 읽는다(동기 · 작다).
  const adLeft = adRerollLeft();
  // T-11-558 광고 버튼(잠재력 보기 · 다시 뽑기)이 보이면 광고를 미리 불러 둔다.
  const adShown = offer === 'ad' && hasCandidates && (adLeft > 0 || !s.candidatePotentialOpen);
  useEffect(() => {
    if (adShown) prepareReward('candidates');
  }, [adShown]);
  async function rerollWithAd() {
    if (rerollLock.current || rewardLock.current) return;
    rerollLock.current = true;
    setRerolling(true);
    setRewardMessage('');
    try {
      const message = await claimAdReroll(rerollCandidates);
      toast(message || adText.adRerollDone({ n: adRerollLeft() }));
    } finally {
      rerollLock.current = false;
      setRerolling(false);
    }
  }
  const askAdReroll = () =>
    Alert.alert(CA.rerollAskTitle, adText.adRerollConfirm({ n: Math.max(0, adLeft - 1) }), [
      { text: CA.cancel, style: 'cancel' },
      { text: CA.rerollAction, onPress: () => void rerollWithAd() },
    ]);
  const askReroll = () =>
    Alert.alert(CA.rerollAskTitle, CL.rerollConfirm({ n: Math.max(0, rerolls - 1) }), [
      { text: CA.cancel, style: 'cancel' },
      { text: CA.rerollAction, onPress: () => void reroll() },
    ]);
  async function reroll() {
    if (rerollLock.current || rerolls < 1) return;
    rerollLock.current = true;
    setRerolling(true);
    try {
      rerollKey.current ??= crypto.randomUUID();
      const r = await spendReroll(rerollKey.current);
      if (r.ok || !r.error.retryable) rerollKey.current = null;
      if (!r.ok) {
        if (r.error.reason === 'NO_REROLL') setRerolls(0);
        toast(r.error.message || CL.rerollFail);
        return;
      }
      setRerolls(r.data.reroll);
      setScouts(r.data.scout);
      setMileage(r.data.mileage ?? 0);
      rerollCandidates();
      setRewardMessage('');
      toast(
        r.data.mileageScout
          ? CL.rerollMileageDone({ n: r.data.reroll, need: REROLL_MILEAGE })
          : CL.rerollDone({ n: r.data.reroll }),
      );
    } finally {
      rerollLock.current = false;
      setRerolling(false);
    }
  }
  const askScout = () =>
    Alert.alert(SL.askTitle, SL.confirm({ n: Math.max(0, scouts - 1) }), [
      { text: CA.cancel, style: 'cancel' },
      { text: SL.action, onPress: () => void premiumScout() },
    ]);
  async function premiumScout() {
    if (rerollLock.current || scouts < 1) return;
    rerollLock.current = true;
    setRerolling(true);
    try {
      scoutKey.current ??= crypto.randomUUID();
      scoutPlan.current ??= planPremiumScout();
      const plan = scoutPlan.current;
      const r = await spendScout(scoutKey.current, plan.hit);
      if (r.ok || !r.error.retryable) {
        scoutKey.current = null;
        scoutPlan.current = null;
      }
      if (!r.ok) {
        if (r.error.reason === 'NO_SCOUT') setScouts(0);
        toast(r.error.message || SL.fail);
        return;
      }
      setScouts(r.data.scout);
      if (r.data.pity) setPity(r.data.pity);
      const mode = r.data.scoutMode ?? 'normal';
      premiumScoutCandidates(plan.seed, mode);
      setRewardMessage('');
      const n = r.data.scout;
      // T-11-415 S가 그냥 나와 S 확정 칸이 0으로 돌아가면 그렇다고 알린다.
      const reset = mode === 'normal' && r.data.pity?.streak === 0;
      toast(
        mode === 'elite'
          ? SL.doneElite({ n, elite: scoutPityAt().elite })
          : mode === 'sure'
            ? SL.doneSure({ n })
            : reset
              ? SL.doneReset({ n })
              : SL.done({ n }),
      );
    } finally {
      rerollLock.current = false;
      setRerolling(false);
    }
  }
  const c = useColors();
  const keyboardScroll = useFormKeyboardScroll();
  const insets = useSafeAreaInsets();
  const shadow = useShadow();
  const input = useInputStyle();

  // 세부 포지션은 시즌 1 개막부터 고른다. 프리시즌엔 선택지를 보이지 않고, 저장된 선택도 쓰지 않는다.
  const [detailOpen, setDetailOpen] = useState(() => detailOpenNow());
  // T-11-294 입력은 저장하지 않아 다시 열면 기본값이다. 킵한 후보가 있으면 그 조건으로 맞춰 바로 다시 나오게 한다(T-11-327 앱을 연 뒤 한 번).
  useEffect(() => {
    restoreKeptDraft({ auto: true });
  }, []);
  useEffect(() => {
    if (detailOpen && !draftDpos(appState.C)) pickDetail(DETAILS_OF[appState.C.pos][0]!);
  }, [detailOpen]);
  useEffect(
    () =>
      watchDetailOpening(() => {
        // 개막 전 골라 둔 주력·후보 능력치는 유지한다.
        if (!draftDpos(appState.C)) appState.C.dpos = DETAILS_OF[appState.C.pos][0]!;
        setDetailOpen(true);
      }),
    [],
  );
  const dpos = draftDpos(C);
  const focusLeft = FOCUS_PICK - C.focus.length;
  // 고른 조합이 시작 분포를 어떻게 바꾸는지 버튼마다 미리 보여준다(주력 ▲ / 가장 덜 쓰는 능력치 ▼).
  const preview = focusMod(C.pos, C.focus);
  const ovrFocus = ovrFocusView(C.pos, C.focus, dpos);

  const step: 'form' | 'candidates' = s.candidates ? 'candidates' : 'form';
  const kept = step === 'form' ? keptDraft() : null;
  const labels = attrLabels(C.pos);
  const picked =
    s.candidates && s.candidatePick != null ? (s.candidates[s.candidatePick] ?? null) : null;
  // 라이브 카드의 레이더·OVR: 후보를 골랐으면 그 후보, 아니면 지금 조합의 기준 분포.
  const cardAttrs = picked?.attrs ?? baseline(C.pos, C.focus, dpos);
  const trait = TRAITS.find((t) => t.id === C.trait);

  // 국적·체격
  const nation = nationOf(C);
  const foreign = !isKorean(C);
  const body = draftBody(C);
  const bodyErr = bodyError(body);
  const note = bodyNote(C.pos, body);
  const def = BODY_DEFAULT[C.pos];

  // 후보를 바로 보여 주지 않고 스카우트가 추리는 연출(약 3초)이 끝난 뒤에 뽑는다.
  const [scouting, setScouting] = useState(false);
  const scoutSteps = [
    L.stepVideo({ nation: tn(nation.ko) }),
    L.stepPool({ pos: posLabel({ pos: C.pos, dpos }) }),
    L.stepFocus({ list: C.focus.map((k) => labels[k]).join('·') }),
    L.stepBody({ h: body.h, w: body.w }),
    L.stepDone,
  ];
  const scouted = () => {
    rollCandidates();
    setScouting(false);
  };

  const onPitch = c.onPitch;
  const small = { fontSize: rem(FONT.caption), lineHeight: rem(FONT.caption) * 1.35 };

  const ovrGuideBody = (showTitle: boolean) => (
    <View
      testID="ovr-guide"
      style={{ borderLeftWidth: 3, borderLeftColor: c.accent, paddingLeft: 12, gap: 4 }}
    >
      {showTitle ? (
        <Txt v="sm" bold>
          {ovrFocus.title}
        </Txt>
      ) : null}
      <Txt v="sm">{ovrFocus.groups}</Txt>
      <Txt v="sm" tone="muted">
        {ovrFocus.subs}
      </Txt>
      <Txt v="sm" tone="muted">
        {ovrFocus.note}
      </Txt>
      <Txt v="sm" tone="muted">
        {L.ovrStartNote}
      </Txt>
    </View>
  );
  const ovrGuide = ovrGuideBody(true);

  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      {/* 라이브 카드가 위에 붙어 다니려면 스크롤 밖 위쪽 안전 영역을 따로 비운다 */}
      <View style={{ height: insets.top, backgroundColor: c.bg }} />
      <ScrollView
        ref={keyboardScroll.ref}
        onLayout={keyboardScroll.onLayout}
        onContentSizeChange={revealFocusedInput}
        onScroll={(e) => noteScrollY(e.nativeEvent.contentOffset.y)}
        scrollEventThrottle={64}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        // iOS는 스크롤 여백만 키보드에 맞춘다. 하단 버튼 줄은 화면 끝에 고정한다.
        automaticallyAdjustKeyboardInsets
        stickyHeaderIndices={step === 'form' ? [2] : undefined}
        contentContainerStyle={{
          paddingHorizontal: 16,
          paddingBottom: 24 + keyboardScroll.bottomInset,
          gap: 14,
        }}
      >
        <Topbar />

        <View style={{ marginBottom: -8 }}>
          <Txt v="eyebrow">Player Creation · {step === 'form' ? 1 : 2}/2</Txt>
          <Txt v="h1" accessibilityRole="header">
            {step === 'form' ? L.titleForm : L.titleCandidates}
          </Txt>
        </View>

        {/* 라이브 카드 — 1단계에서는 스크롤해도 위에 붙어 있다 */}
        <View style={{ paddingTop: 8 }}>
          <View
            testID="live-card"
            accessibilityLabel={L.previewLabel}
            style={[
              {
                flexDirection: 'row',
                alignItems: 'center',
                gap: 14,
                backgroundColor: c.pitch,
                borderRadius: RADIUS.lg,
                paddingVertical: 14,
                paddingHorizontal: 16,
                shadowColor: '#000',
                shadowOpacity: 0.35,
                shadowRadius: 12,
                shadowOffset: { width: 0, height: 8 },
                elevation: 4,
              },
            ]}
          >
            <View style={{ alignItems: 'center', minWidth: 48 }}>
              <Txt
                num
                style={{
                  fontSize: rem(2.5),
                  lineHeight: rem(2.5),
                  color: onPitch,
                  includeFontPadding: false,
                }}
              >
                {C.number || '–'}
              </Txt>
              <Txt
                style={{
                  fontFamily: DISPLAY[700],
                  fontSize: rem(FONT.label),
                  letterSpacing: rem(0.8125) * 0.12,
                  color: c.pitchAccent,
                }}
              >
                {dpos ?? C.pos}
              </Txt>
            </View>
            <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
              <Txt
                bold
                numberOfLines={1}
                style={{
                  fontSize: rem(FONT.title2),
                  lineHeight: rem(FONT.title2) * 1.2,
                  color: onPitch,
                }}
              >
                {C.name.trim() || L.noName}
              </Txt>
              <Txt
                style={{
                  fontSize: rem(FONT.label),
                  lineHeight: rem(FONT.label) * 1.5,
                  color: alpha(onPitch, 0.75),
                }}
              >
                <Txt accessibilityElementsHidden style={{ fontSize: rem(FONT.label) }}>
                  {flagOf(nation.code)}
                </Txt>{' '}
                {tn(nation.ko)} · {posLabel({ pos: C.pos, dpos })} · {L.foot({ v: C.foot })}
                {bodyErr ? '' : ` · ${body.h}cm ${body.w}kg`}
              </Txt>
              <Row gap={4} style={{ marginTop: 4 }}>
                {trait ? <LiveTag>{`${trait.icon} ${trait.name}`}</LiveTag> : null}
                {C.focus.length ? (
                  <LiveTag>{L.focusTag({ list: C.focus.map((k) => labels[k]).join('·') })}</LiveTag>
                ) : null}
              </Row>
            </View>
            <View style={{ alignItems: 'center', gap: 2 }}>
              <MiniRadar pos={C.pos} attrs={cardAttrs} size={72} onPitch />
              <Txt style={{ fontSize: rem(FONT.caption2), color: alpha(onPitch, 0.85) }}>
                {picked ? L.ovrStart : L.ovrEst} OVR{' '}
                <Txt num style={{ fontSize: rem(FONT.title3), color: c.pitchAccent }}>
                  {startOvr(C.pos, cardAttrs)}
                </Txt>
              </Txt>
            </View>
          </View>
        </View>

        {step === 'form' ? (
          <Card gap={18}>
            <View style={{ flexDirection: 'row', gap: 10 }}>
              <View style={{ flex: 1 }}>
                <Field label={L.name}>
                  <View>
                    <TextInput
                      testID="f-name"
                      accessibilityLabel={L.name}
                      maxLength={12}
                      autoCorrect={false}
                      autoCapitalize="none"
                      spellCheck={false}
                      returnKeyType="done"
                      value={C.name}
                      onChangeText={(t) => (appState.C.name = t)}
                      onFocus={revealFocusedInput}
                      style={[input, { paddingRight: 48 }]}
                    />
                    <Press
                      testID="random-name"
                      accessibilityLabel={L.randomName}
                      onPress={() => (appState.C.name = randomName())}
                      style={{
                        position: 'absolute',
                        right: 4,
                        top: 0,
                        bottom: 0,
                        width: 44,
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      <Txt style={{ fontSize: rem(FONT.title2) }}>🎲</Txt>
                    </Press>
                  </View>
                </Field>
              </View>
              <View style={{ width: 84 }}>
                <Field label={L.number}>
                  <TextInput
                    testID="f-num"
                    accessibilityLabel={L.number}
                    keyboardType="number-pad"
                    returnKeyType="done"
                    maxLength={2}
                    placeholder="1–99"
                    placeholderTextColor={c.muted}
                    value={C.number ? String(C.number) : ''}
                    onChangeText={(t) => (appState.C.number = +t.replace(/\D/g, '') || 0)}
                    onFocus={revealFocusedInput}
                    style={input}
                  />
                </Field>
              </View>
            </View>

            <Field label={L.nation}>
              <NationPicker
                testID="f-nation"
                value={C.nation}
                onChange={(code) => (appState.C.nation = code)}
              />
              <Txt v="sm" tone="muted" testID="nation-note">
                {`${
                  foreign
                    ? L.nationForeign({ nation: tn(nation.ko), cup: tn(CONFEDS[nation.conf].cup) })
                    : L.nationHome
                } ${L.nationSame}`}
              </Txt>
            </Field>

            <Field label={L.body}>
              <Row gap={8} wrap={false}>
                <BodyInput
                  testID="f-height"
                  label={L.height}
                  unit="cm"
                  value={C.height}
                  fallback={def.h}
                  invalid={!!bodyErr}
                  onChange={(v) => (appState.C.height = v)}
                />
                <BodyInput
                  testID="f-weight"
                  label={L.weight}
                  unit="kg"
                  value={C.weight}
                  fallback={def.w}
                  invalid={!!bodyErr}
                  onChange={(v) => (appState.C.weight = v)}
                />
              </Row>
              <Txt
                v="sm"
                tone={bodyErr ? 'bad' : 'muted'}
                bold={!!bodyErr}
                testID="body-note"
                accessibilityLiveRegion="polite"
              >
                {bodyErr ? bodyErr : L.bodyNote({ bmi: bmiOf(body).toFixed(1), note })}
              </Txt>
            </Field>

            <CreateLook />

            <CoachTarget id="pos">
              <Field label={L.position}>
                <Seg>
                  {posKeys.map((k) => (
                    <SegCell key={k} cols={2} testID={`pos-${k}`}>
                      <PosOpt
                        code={k}
                        title={POS[k].label}
                        blurb={POS[k].blurb}
                        selected={C.pos === k}
                        onPress={() => setPos(k, detailOpen)}
                      />
                    </SegCell>
                  ))}
                </Seg>
              </Field>
            </CoachTarget>

            {detailOpen && DETAILS_OF[C.pos].length > 1 ? (
              <Field label={L.detailPosition}>
                <Seg>
                  {DETAILS_OF[C.pos].map((d) => (
                    <SegCell key={d} cols={2} testID={`dpos-${d}`}>
                      <PosOpt
                        code={d}
                        title={DPOS[d].label}
                        blurb={DPOS[d].blurb}
                        selected={C.dpos === d}
                        onPress={() => pickDetail(d)}
                      />
                    </SegCell>
                  ))}
                </Seg>
                <Txt v="sm" tone="muted">
                  {L.detailNote}
                </Txt>
              </Field>
            ) : null}

            {ovrGuide}
            {/* T-11-234 유형별 주력 능력치를 생성 중에도 본다(시즌 탭과 같은 안내). */}
            <PositionGuide pos={C.pos} />
            <Field label={L.footLabel}>
              <Seg>
                {feet.map((f) => (
                  <SegCell key={f} cols={3} testID={`foot-${f}`}>
                    <Opt
                      selected={C.foot === f}
                      onPress={() => (appState.C.foot = f)}
                      style={{ flex: 1 }}
                    >
                      <Txt bold>{L.foot({ v: f })}</Txt>
                    </Opt>
                  </SegCell>
                ))}
              </Seg>
            </Field>

            <CoachTarget id="focus">
              <Field label={L.focusTitle({ n: FOCUS_PICK })}>
                <Seg>
                  {ATTR_KEYS.map((k) => {
                    const d = preview[k] ?? 0;
                    const on = C.focus.includes(k);
                    return (
                      <SegCell key={k} cols={2} testID={`focus-${k}`}>
                        <Opt selected={on} onPress={() => toggleFocus(k)} style={{ flex: 1 }}>
                          <Txt bold>{labels[k]}</Txt>
                          <Txt
                            style={[
                              small,
                              { color: d > 0 ? c.good : d < 0 ? c.bad : c.muted },
                              d > 0 && { fontWeight: '600' },
                            ]}
                          >
                            {focusNote(on, d)}
                          </Txt>
                        </Opt>
                      </SegCell>
                    );
                  })}
                </Seg>
              </Field>
            </CoachTarget>

            <Field label={L.trait}>
              <Seg>
                {TRAITS.map((t) => (
                  <SegCell key={t.id} cols={2} testID={`trait-${t.id}`}>
                    <Opt
                      selected={C.trait === t.id}
                      onPress={() => (appState.C.trait = t.id)}
                      style={{ flex: 1 }}
                    >
                      <Txt bold accessibilityHint={t.desc}>
                        {t.icon} {t.name}
                      </Txt>
                      <Txt tone="muted" style={small}>
                        {t.short}
                      </Txt>
                    </Opt>
                  </SegCell>
                ))}
              </Seg>
            </Field>
            <Txt v="sm" tone="muted">
              {L.potentialNote}
            </Txt>
            {kept ? (
              <View testID="kept-elsewhere" style={{ gap: 8 }}>
                <Txt v="sm">
                  {L.keptElsewhere({
                    pos: posLabel(kept),
                    focus: kept.focus.map((k) => labels[k]).join('·'),
                  })}
                </Txt>
                <Btn
                  testID="restore-kept"
                  onPress={() => restoreKeptDraft()}
                  style={{ alignSelf: 'flex-start' }}
                >
                  {L.keptRestore}
                </Btn>
              </View>
            ) : null}
          </Card>
        ) : s.candidates ? (
          <>
            <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 10 }}>
              <Txt v="sm" tone="muted" style={{ flex: 1 }}>
                {L.candIntro}
              </Txt>
              {s.candidatesOpen.some((o) => !o) ? (
                <Btn sm testID="open-all" onPress={openAllCards}>
                  {L.openAll}
                </Btn>
              ) : null}
            </View>
            {/* T-11-437 카드의 OVR이 확정값처럼 보이지 않게 소개 바로 아래에 둔다(웹과 같은 자리). */}
            <Txt v="sm" tone="muted" testID="candidate-stats-note">
              {CG.candidateNote}
            </Txt>
            <CoachTarget id="cands" style={{ gap: 10 }}>
              {s.candidates.map((cand, i) => {
                const isOpen = s.candidatesOpen[i];
                const isPicked = s.candidatePick === i;
                const f = fx[i];
                const tier = tiers[i] ?? 'normal';
                const running = !!f && !f.done;
                const landed = !!f && f.done && revealTotal(f) > 0;
                const glow = tier !== 'normal' && (landed || (running && tier === 'jackpot'));
                if (isOpen)
                  return (
                    <FlipIn key={`open-${i}`} delay={running ? f.back : 0}>
                      <Press
                        scale={0.985}
                        accessibilityLabel={`${landed && tier !== 'normal' ? `${tier === 'jackpot' ? RV.jackpot : RV.good}! ` : ''}${L.candOpenA11y(
                          {
                            n: i + 1,
                            ovr: startOvr(C.pos, cand.attrs),
                            line: scoutLine(C.pos, cand.attrs),
                          },
                        )}`}
                        testID={`cand-${i}`}
                        {...(landed ? { accessibilityLiveRegion: 'polite' as const } : {})}
                        accessibilityState={{ selected: isPicked }}
                        onPress={() => pickCard(i)}
                        style={[
                          {
                            gap: 8,
                            borderRadius: RADIUS.lg,
                            backgroundColor: c.surface,
                            borderColor: isPicked || glow ? c.accent : c.line,
                            // 고른 카드는 안쪽으로 한 겹 더 두른다(웹 inset 1.5px)
                            borderWidth: isPicked ? 3 : 1.5,
                            padding: isPicked ? 14.5 : 16,
                          },
                          shadow,
                        ]}
                      >
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                          <Txt
                            style={{
                              fontFamily: DISPLAY[700],
                              fontSize: rem(FONT.title3),
                              letterSpacing: rem(1.125) * 0.02,
                            }}
                          >
                            {L.candNo({ n: i + 1 })}
                          </Txt>
                          <Txt
                            tone="muted"
                            style={{
                              marginLeft: 'auto',
                              fontSize: rem(FONT.caption),
                              lineHeight: rem(FONT.title1),
                            }}
                          >
                            OVR{' '}
                            <Txt num style={{ fontSize: rem(FONT.title2) }}>
                              {running && f.hint > 0 ? (
                                <CountUp value={startOvr(C.pos, cand.attrs)} ms={f.back + f.hint} />
                              ) : (
                                startOvr(C.pos, cand.attrs)
                              )}
                            </Txt>
                          </Txt>
                          {cand.pity ? (
                            <Pill tone="good">
                              {cand.pity === 'elite' ? SL.pillElite : SL.pillSure}
                            </Pill>
                          ) : cand.guaranteed ? (
                            <Pill>{SL.sure}</Pill>
                          ) : null}
                          {cand.kept ? <Pill>{L.kept}</Pill> : null}
                          {isPicked ? <Pill tone="good">{L.picked}</Pill> : null}
                        </View>
                        <Txt
                          v="sm"
                          tone={
                            s.candidatePotentialOpen || cand.kept?.revealed ? 'accent' : 'muted'
                          }
                          testID={`candidate-potential-${i}`}
                        >
                          {s.candidatePotentialOpen || cand.kept?.revealed ? (
                            potFresh && !cand.kept?.revealed ? (
                              <RevealGrade
                                grade={`${candidatePotentialGrades(cand.potential).min}~${candidatePotentialGrades(cand.potential).max}`}
                                text={L.potentialRange(candidatePotentialGrades(cand.potential))}
                                tier={gradeTier(candidatePotentialGrades(cand.potential).max)}
                              />
                            ) : (
                              L.potentialRange(candidatePotentialGrades(cand.potential))
                            )
                          ) : (
                            L.potentialLocked
                          )}
                        </Txt>
                        <Txt
                          tone="accent"
                          style={{ fontSize: rem(FONT.body2), fontWeight: '600' }}
                        >{`“${scoutLine(C.pos, cand.attrs)}”`}</Txt>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
                          <MiniRadar pos={C.pos} attrs={cand.attrs} size={84} />
                          <View style={{ flex: 1, gap: 3, minWidth: 0 }}>
                            {ATTR_KEYS.map((k) => {
                              const v = Math.round(cand.attrs[k]);
                              const hi = cand.hintKeys.includes(k);
                              return (
                                <View
                                  key={k}
                                  style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}
                                >
                                  <Txt
                                    numberOfLines={1}
                                    style={{
                                      width: 56,
                                      fontSize: rem(FONT.caption),
                                      color: hi ? c.ink : c.muted,
                                      ...(hi ? { fontWeight: '600' as const } : {}),
                                      ...(ovrFocus.keys.includes(k)
                                        ? { textDecorationLine: 'underline' as const }
                                        : {}),
                                    }}
                                  >
                                    {labels[k]}
                                  </Txt>
                                  <View
                                    style={{
                                      flex: 1,
                                      height: 6,
                                      borderRadius: 3,
                                      backgroundColor: c.surface2,
                                      overflow: 'hidden',
                                    }}
                                  >
                                    <View
                                      style={{
                                        width: `${v}%`,
                                        height: '100%',
                                        borderRadius: 3,
                                        backgroundColor: hi
                                          ? c.accent
                                          : mixHex(c.pitch, c.muted, 0.55),
                                      }}
                                    />
                                  </View>
                                  <Txt
                                    style={[
                                      num(700),
                                      {
                                        width: 26,
                                        textAlign: 'right',
                                        fontSize: rem(FONT.body1),
                                        color: c.ink,
                                      },
                                    ]}
                                  >
                                    {v}
                                  </Txt>
                                </View>
                              );
                            })}
                          </View>
                        </View>
                      </Press>
                    </FlipIn>
                  );
                return (
                  <FlyIn key={`closed-${i}`} index={i}>
                    <Press
                      scale={0.985}
                      testID={`cand-${i}`}
                      accessibilityLabel={L.candClosedA11y({
                        n: i + 1,
                        k: labels[hiddenStrength(cand.attrs, C.focus)],
                      })}
                      onPress={() => pickCard(i)}
                      style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        gap: 14,
                        borderWidth: 1.5,
                        borderColor: c.line,
                        borderRadius: RADIUS.lg,
                        backgroundColor: c.pitch,
                        padding: 16,
                      }}
                    >
                      <View
                        style={{
                          width: 48,
                          height: 48,
                          borderRadius: RADIUS.lg,
                          alignItems: 'center',
                          justifyContent: 'center',
                          borderWidth: 2,
                          borderStyle: 'dashed',
                          borderColor: alpha(onPitch, 0.4),
                        }}
                      >
                        <Txt
                          style={{
                            fontFamily: DISPLAY[700],
                            fontSize: rem(FONT.title1),
                            lineHeight: rem(FONT.title1) * 1.15,
                            color: onPitch,
                          }}
                        >
                          ?
                        </Txt>
                      </View>
                      <View style={{ flex: 1, minWidth: 0 }}>
                        <Txt bold style={{ fontSize: rem(FONT.body), color: onPitch }}>
                          {L.candNo({ n: i + 1 })}
                        </Txt>
                        <Txt style={{ fontSize: rem(FONT.caption), color: alpha(onPitch, 0.75) }}>
                          {L.scoutMemo({ k: labels[hiddenStrength(cand.attrs, C.focus)] })}
                        </Txt>
                      </View>
                      <Txt
                        accessibilityElementsHidden
                        style={{
                          fontSize: rem(FONT.caption2),
                          fontWeight: '600',
                          color: alpha(onPitch, 0.7),
                        }}
                      >
                        {L.tapToOpen}
                      </Txt>
                    </Press>
                  </FlyIn>
                );
              })}
            </CoachTarget>
            {s.candidatePick != null && s.candidates[s.candidatePick] ? (
              <View style={{ gap: 6 }}>
                <Btn
                  sm
                  testID="keep-candidate"
                  onPress={() =>
                    keepCandidate(s.candidates![s.candidatePick!]!.kept ? null : s.candidatePick)
                  }
                >
                  {s.candidates[s.candidatePick]!.kept
                    ? L.unkeepBtn({ n: s.candidatePick + 1 })
                    : L.keepBtn({ n: s.candidatePick + 1 })}
                </Btn>
                <Txt v="sm" tone="muted">
                  {L.keepHelp}
                </Txt>
              </View>
            ) : null}
            {scouts > 0 ? (
              <View style={{ gap: 6 }}>
                <Btn
                  block
                  kind="primary"
                  testID="candidate-premium-scout"
                  disabled={rerolling || rewardBusy}
                  onPress={askScout}
                >
                  {rerolling ? SL.busy : SL.btn({ n: scouts })}
                </Btn>
                <Txt v="sm" tone="muted">
                  {scoutWhatText()}
                </Txt>
                <ScoutPityGauge pity={pity} />
                <ScoutOdds />
              </View>
            ) : owner ? (
              <View style={{ gap: 6 }}>
                {pity.used > 0 ? <ScoutPityGauge pity={pity} empty /> : null}
                <Btn sm kind="ghost" testID="premium-scout-go" onPress={goRerollShop}>
                  {SL.shopGo}
                </Btn>
              </View>
            ) : null}
            {premium ? (
              <Txt v="sm" tone="muted" testID="premium-note">
                {SL.premiumNote}
              </Txt>
            ) : null}
            {rerolls > 0 ? (
              <View style={{ gap: 6 }}>
                <Btn
                  block
                  testID="candidate-reroll"
                  disabled={rerolling || rewardBusy}
                  onPress={askReroll}
                >
                  {rerolling ? CL.rerollBusy : CL.rerollBtn({ n: rerolls })}
                </Btn>
                <Txt v="sm" tone="muted" testID="reroll-mileage">
                  {CL.rerollMileage({ n: rerollMileageLeft(mileage), need: REROLL_MILEAGE })}
                </Txt>
              </View>
            ) : owner ? (
              <View style={{ gap: 6 }} testID="reroll-hint">
                <Txt v="sm" tone="muted">
                  {CL.createShopHint}
                </Txt>
                <Btn sm kind="ghost" testID="reroll-shop-go" onPress={goRerollShop}>
                  {CL.createShopGo}
                </Btn>
              </View>
            ) : null}
            {/* T-11-355 상품 위치 안내(설정과 같은 카드, 기기마다 닫을 때까지). T-11-437 쓸 도구가 없으면 아래 '더 보기'로 접는다. */}
            {quiet ? null : <ItemsHint />}
            {/* T-11-221 광고 두 개(다시 뽑기 · 잠재력 보기)는 후보 카드 아래 반폭 톤 버튼 한 줄로. 전에는 카드 위에 전폭으로 쌓여
                첫 화면에 후보가 보이지 않았다. 접근성 이름은 전체 문구. */}
            {(offer && adLeft > 0) || (offer && !s.candidatePotentialOpen) ? (
              <View style={{ flexDirection: 'row', gap: 8 }}>
                {offer && adLeft > 0 ? (
                  <Btn
                    kind="tonal"
                    testID="candidate-ad-reroll"
                    disabled={rerolling || rewardBusy}
                    onPress={askAdReroll}
                    accessibilityLabel={(offer === 'free'
                      ? adText.adRerollFreeBtn
                      : adText.adRerollBtn)({
                      n: adLeft,
                    })}
                    badge={
                      rerolling
                        ? undefined
                        : adText.adRerollBadge({ n: adLeft, ad: offer !== 'free' })
                    }
                    style={{ flex: 1, minWidth: 0, paddingHorizontal: 10 }}
                  >
                    {rerolling ? CL.rerollBusy : adText.adRerollShort}
                  </Btn>
                ) : null}
                {offer && !s.candidatePotentialOpen ? (
                  <Btn
                    kind="tonal"
                    testID="candidate-potential-reward"
                    disabled={rewardBusy}
                    onPress={() => void reveal()}
                    accessibilityLabel={offer === 'free' ? L.potentialFree : L.potentialAd}
                    badge={rewardBusy || offer === 'free' ? undefined : B.adCost}
                    style={{ flex: 1, minWidth: 0, paddingHorizontal: 10 }}
                  >
                    {rewardBusy ? L.potentialBusy : L.potentialShort}
                  </Btn>
                ) : null}
              </View>
            ) : null}
            <View style={{ gap: 8 }}>
              {s.candidatePotentialOpen ? (
                <Txt v="sm" tone="muted">
                  {premium ? SL.premiumHelp : L.potentialHelp}
                </Txt>
              ) : offer || club.offer ? (
                <>
                  {club.offer ? (
                    <Btn
                      block
                      testID="candidate-potential-club"
                      disabled={rewardBusy}
                      onPress={() => void revealWithClub()}
                    >
                      {B.clubCandidates({ price: fundsText(club.offer.price) })}
                    </Btn>
                  ) : null}
                  <Txt v="sm" tone="muted">
                    {offer === 'free'
                      ? L.potentialHelp
                      : club.offer
                        ? B.clubNote
                        : L.potentialWatch}
                  </Txt>
                </>
              ) : null}
              {rewardMessage ? (
                <Txt v="sm" tone="muted" accessibilityLiveRegion="polite">
                  {rewardMessage}
                </Txt>
              ) : null}
            </View>
            {quiet ? (
              // T-11-437 쓸 도구(리롤권 · 스카우트권 · 천장 기록)가 없으면 상점 위치 · 능력치 설명을 한 번에 접어 둔다.
              <Card gap={0} style={{ paddingVertical: 0 }}>
                <DisclosureRow
                  border={false}
                  open={guideOpen}
                  onToggle={() => setGuideOpen(!guideOpen)}
                  label={L.moreTools}
                  testID="more-tools-toggle"
                />
                {guideOpen ? (
                  <View style={{ paddingBottom: 14, gap: 8 }}>
                    <ItemsHint />
                    {ovrGuideBody(true)}
                    <Txt v="sm" tone="muted">
                      {L.ovrCore}
                    </Txt>
                    <PositionGuide pos={C.pos} />
                  </View>
                ) : null}
              </Card>
            ) : (
              <>
                {/* T-11-221 OVR 주요 능력치 설명은 펼침 행으로 접어 둔다. */}
                <Card gap={0} style={{ paddingVertical: 0 }}>
                  <DisclosureRow
                    border={false}
                    open={guideOpen}
                    onToggle={() => setGuideOpen(!guideOpen)}
                    label={ovrFocus.title}
                    testID="ovr-guide-toggle"
                  />
                  {guideOpen ? (
                    <View style={{ paddingBottom: 14, gap: 8 }}>
                      {ovrGuideBody(false)}
                      <Txt v="sm" tone="muted">
                        {L.ovrCore}
                      </Txt>
                    </View>
                  ) : null}
                </Card>
                <Card gap={0} style={{ paddingVertical: 0 }}>
                  <PositionGuide pos={C.pos} />
                </Card>
              </>
            )}
          </>
        ) : null}
      </ScrollView>

      {step === 'form' ? (
        <ActionBar row>
          <Btn testID="home" onPress={goHome} style={{ width: '32%' }}>
            {L.cancel}
          </Btn>
          <CoachTarget
            id="candidates"
            enabled={!(focusLeft > 0 || !!bodyErr)}
            style={{ flex: 1, minWidth: 0 }}
          >
            <Btn
              kind="primary"
              testID="next-candidates"
              disabled={focusLeft > 0 || !!bodyErr}
              onPress={() => setScouting(true)}
            >
              {bodyErr
                ? L.checkBody
                : focusLeft > 0
                  ? L.focusMore({ n: focusLeft })
                  : L.seeCandidates}
            </Btn>
          </CoachTarget>
        </ActionBar>
      ) : s.candidates ? (
        <ActionBar row>
          <Btn testID="home" disabled={rewardBusy} onPress={backToForm} style={{ width: '32%' }}>
            {L.back}
          </Btn>
          <CoachTarget
            id="start"
            enabled={s.candidatePick != null && !rewardBusy}
            style={{ flex: 1, minWidth: 0 }}
          >
            <Btn
              kind="primary"
              testID="start"
              disabled={s.candidatePick == null || rewardBusy}
              onPress={confirmPick}
            >
              {s.candidatePick == null ? L.pickOne : L.kickoff({ n: s.candidatePick + 1 })}
            </Btn>
          </CoachTarget>
        </ActionBar>
      ) : null}
      {scouting ? <ScoutScan pos={C.pos} steps={scoutSteps} onDone={scouted} /> : null}
    </View>
  );
}

/** 라이브 카드의 작은 태그(웹 .lc-tag). */
function LiveTag({ children }: { children: string }) {
  const c = useColors();
  return (
    <View
      style={{
        borderRadius: RADIUS.pill,
        borderWidth: 1,
        borderColor: alpha(c.onPitch, 0.3),
        paddingVertical: 1,
        paddingHorizontal: 8,
      }}
    >
      <Txt
        style={{
          fontSize: rem(FONT.caption2),
          lineHeight: rem(FONT.caption2) * 1.5,
          fontWeight: '600',
          color: c.onPitch,
        }}
      >
        {children}
      </Txt>
    </View>
  );
}

/** 포지션 선택 버튼(웹 .pos-opt): 오른쪽 위에 포지션 코드. */
function PosOpt({
  code,
  title,
  blurb,
  selected,
  onPress,
}: {
  code: string;
  title: string;
  blurb: string;
  selected: boolean;
  onPress: () => void;
}) {
  const c = useColors();
  return (
    <Opt selected={selected} onPress={onPress} style={{ flex: 1, paddingRight: 44 }}>
      <Txt
        num
        style={{
          position: 'absolute',
          right: 10,
          top: 8,
          fontSize: rem(FONT.body1),
          letterSpacing: rem(0.9375) * 0.06,
          color: selected ? c.accentText : c.muted,
        }}
      >
        {code}
      </Txt>
      <Txt bold>{title}</Txt>
      <Txt
        tone="muted"
        style={{ fontSize: rem(FONT.caption), lineHeight: rem(FONT.caption) * 1.35 }}
      >
        {blurb}
      </Txt>
    </Opt>
  );
}
