// 선수 생성(웹 Create.svelte): 위쪽 라이브 카드가 고를 때마다 바로 바뀌고, 아래 고정 버튼이 남은 할 일을 알려 준다.
// 1단계(프로필 입력) → 2단계(후보 카드 비교·선택). appState.candidates가 있으면 2단계.
import { useEffect, useState, useRef, type ReactNode } from 'react';
import { Animated, Easing, ScrollView, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useSnapshot } from 'valtio';
import {
  POS,
  DPOS,
  DETAILS_OF,
  TRAITS,
  ATTR_KEYS,
  FOCUS_PICK,
  FOCUS_GROWTH,
  attrLabels,
  defaultFocus,
  focusMod,
  posLabel,
} from '@offside/game/data';
import type { AttrKey, DetailPos, Pos } from '@offside/game/data';
import { baseline } from '@offside/game/candidates';
import { CONFEDS, flagOf } from '@offside/contracts/nations';
import { BODY_DEFAULT, bmiOf, bodyError } from '@offside/contracts/body';
import { isKorean, nationOf } from '@offside/game/nation';
import { bodyNote, hiddenStrength, scoutLine, startOvr } from '@offside/app-core/create-view';
import { adText } from '@offside/app-core/i18n/ko/ad';
import { createText as L } from '@offside/app-core/i18n/ko/create';
import { watchDetailOpening } from '@offside/app-core/season-opening';
import { detailOpenNow, draftBody, draftDpos, randomName } from '@offside/app-core/state';
import { revealCandidatePotential, rollCandidates, startCareer } from '../../game/host';
import { claimReward, rewardOffer } from '../../platform/rewarded';
import { adFree } from '../../platform/adFree';
import { goHome } from '../../game/nav';
import { appState, prefs } from '../../store';
import { alpha } from '../../theme/colors';
import { DISPLAY, num, rem } from '../../theme/type';
import { useColors } from '../../theme/useColors';
import { ActionBar, Btn, Card, Opt, Pill, Press, Row, Topbar, Txt, useShadow } from '../../ui';
import { noteScrollY, revealFocusedInput } from '../../ui/scroll';
import { useFormKeyboardScroll } from '../../ui/useFormKeyboardScroll';
import { MiniRadar } from './MiniRadar';
import { NationPicker } from './NationPicker';
import { ScoutScan } from './ScoutScan';
import { BodyInput, Field, Seg, SegCell, mixHex, useInputStyle } from './parts';
import { tn } from '@offside/game/i18n/names';

const posKeys = Object.keys(POS) as Pos[];
const feet = ['오른발', '왼발', '양발'] as const; // 저장값(화면에는 L.foot으로)
const growthPct = Math.round((FOCUS_GROWTH - 1) * 100);

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
function FlipIn({ children }: { children: ReactNode }) {
  const [v] = useState(() => new Animated.Value(prefs.motionOK ? 0 : 1));
  useEffect(() => {
    if (prefs.motionOK)
      Animated.timing(v, {
        toValue: 1,
        duration: 360,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }).start();
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
  const owned = useSnapshot(adFree).owned;
  const offer = rewardOffer('candidates', owned);
  const rewardLock = useRef(false);
  const [rewardBusy, setRewardBusy] = useState(false);
  const [rewardMessage, setRewardMessage] = useState('');
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
  const c = useColors();
  const keyboardScroll = useFormKeyboardScroll();
  const insets = useSafeAreaInsets();
  const shadow = useShadow();
  const input = useInputStyle();

  // 세부 포지션은 시즌 1 개막부터 고른다. 프리시즌엔 선택지를 보이지 않고, 저장된 선택도 쓰지 않는다.
  const [detailOpen, setDetailOpen] = useState(() => detailOpenNow());
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

  const step: 'form' | 'candidates' = s.candidates ? 'candidates' : 'form';
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
  const small = { fontSize: rem(0.75), lineHeight: rem(0.75) * 1.35 };

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
                borderRadius: 18,
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
                  fontSize: rem(0.8125),
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
                style={{ fontSize: rem(1.25), lineHeight: rem(1.25) * 1.2, color: onPitch }}
              >
                {C.name.trim() || L.noName}
              </Txt>
              <Txt
                style={{
                  fontSize: rem(0.8125),
                  lineHeight: rem(0.8125) * 1.5,
                  color: alpha(onPitch, 0.75),
                }}
              >
                <Txt accessibilityElementsHidden style={{ fontSize: rem(0.8125) }}>
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
              <Txt style={{ fontSize: rem(0.6875), color: alpha(onPitch, 0.85) }}>
                {picked ? L.ovrStart : L.ovrEst} OVR{' '}
                <Txt num style={{ fontSize: rem(1.0625), color: c.pitchAccent }}>
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
                      maxLength={10}
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
                      <Txt style={{ fontSize: rem(1.25) }}>🎲</Txt>
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

            {detailOpen && DETAILS_OF[C.pos].length > 1 ? (
              <Field label={L.detailPosition}>
                <Seg>
                  {DETAILS_OF[C.pos].map((d) => (
                    <SegCell
                      key={d}
                      cols={DETAILS_OF[C.pos].length === 2 ? 2 : 3}
                      testID={`dpos-${d}`}
                    >
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
                          {on
                            ? L.focusUp({ d, pct: growthPct })
                            : d < 0
                              ? L.focusDown({ d })
                              : L.focusNone}
                        </Txt>
                      </Opt>
                    </SegCell>
                  );
                })}
              </Seg>
            </Field>

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
          </Card>
        ) : s.candidates ? (
          <>
            <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 10 }}>
              <Txt v="sm" tone="muted" style={{ flex: 1 }}>
                {L.candIntro}
              </Txt>
              {s.candidatesOpen.some((o) => !o) ? (
                <Btn sm testID="open-all" onPress={openAll}>
                  {L.openAll}
                </Btn>
              ) : null}
            </View>
            <View style={{ gap: 8 }}>
              {s.candidatePotentialOpen ? (
                <Txt v="sm" tone="muted">
                  {L.potentialHelp}
                </Txt>
              ) : offer ? (
                <>
                  <Btn
                    block
                    testID="candidate-potential-reward"
                    disabled={rewardBusy}
                    onPress={() => void reveal()}
                  >
                    {rewardBusy
                      ? L.potentialBusy
                      : offer === 'free'
                        ? L.potentialFree
                        : L.potentialAd}
                  </Btn>
                  <Txt v="sm" tone="muted">
                    {offer === 'free' ? L.potentialHelp : L.potentialWatch}
                  </Txt>
                </>
              ) : null}
              {rewardMessage ? (
                <Txt v="sm" tone="muted" accessibilityLiveRegion="polite">
                  {rewardMessage}
                </Txt>
              ) : null}
            </View>
            <View style={{ gap: 10 }}>
              {s.candidates.map((cand, i) => {
                const isOpen = s.candidatesOpen[i];
                const isPicked = s.candidatePick === i;
                if (isOpen)
                  return (
                    <FlipIn key={`open-${i}`}>
                      <Press
                        scale={0.985}
                        testID={`cand-${i}`}
                        accessibilityLabel={L.candOpenA11y({
                          n: i + 1,
                          ovr: startOvr(C.pos, cand.attrs),
                          line: scoutLine(C.pos, cand.attrs),
                        })}
                        accessibilityState={{ selected: isPicked }}
                        onPress={() => pick(i)}
                        style={[
                          {
                            gap: 8,
                            borderRadius: 16,
                            backgroundColor: c.surface,
                            borderColor: isPicked ? c.accent : c.line,
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
                              fontSize: rem(1.125),
                              letterSpacing: rem(1.125) * 0.02,
                            }}
                          >
                            {L.candNo({ n: i + 1 })}
                          </Txt>
                          <Txt
                            tone="muted"
                            style={{
                              marginLeft: 'auto',
                              fontSize: rem(0.75),
                              lineHeight: rem(1.6),
                            }}
                          >
                            OVR{' '}
                            <Txt num style={{ fontSize: rem(1.375) }}>
                              {startOvr(C.pos, cand.attrs)}
                            </Txt>
                          </Txt>
                          {isPicked ? <Pill tone="good">{L.picked}</Pill> : null}
                        </View>
                        <Txt
                          v="sm"
                          tone={s.candidatePotentialOpen ? 'accent' : 'muted'}
                          testID={`candidate-potential-${i}`}
                        >
                          {s.candidatePotentialOpen
                            ? L.potentialRange(cand.potential)
                            : L.potentialLocked}
                        </Txt>
                        <Txt
                          tone="accent"
                          style={{ fontSize: rem(0.875), fontWeight: '600' }}
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
                                      fontSize: rem(0.75),
                                      color: hi ? c.ink : c.muted,
                                      ...(hi ? { fontWeight: '600' as const } : {}),
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
                                        fontSize: rem(0.9375),
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
                      onPress={() => pick(i)}
                      style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        gap: 14,
                        borderWidth: 1.5,
                        borderColor: c.line,
                        borderRadius: 16,
                        backgroundColor: c.pitch,
                        padding: 16,
                      }}
                    >
                      <View
                        style={{
                          width: 48,
                          height: 48,
                          borderRadius: 24,
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
                            fontSize: rem(1.625),
                            lineHeight: rem(1.625) * 1.15,
                            color: onPitch,
                          }}
                        >
                          ?
                        </Txt>
                      </View>
                      <View style={{ flex: 1, minWidth: 0 }}>
                        <Txt bold style={{ fontSize: rem(1), color: onPitch }}>
                          {L.candNo({ n: i + 1 })}
                        </Txt>
                        <Txt style={{ fontSize: rem(0.75), color: alpha(onPitch, 0.75) }}>
                          {L.scoutMemo({ k: labels[hiddenStrength(cand.attrs, C.focus)] })}
                        </Txt>
                      </View>
                      <Txt
                        accessibilityElementsHidden
                        style={{
                          fontSize: rem(0.6875),
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
            </View>
          </>
        ) : null}
      </ScrollView>

      {step === 'form' ? (
        <ActionBar row>
          <Btn testID="home" onPress={goHome}>
            {L.cancel}
          </Btn>
          <Btn
            kind="primary"
            testID="next-candidates"
            disabled={focusLeft > 0 || !!bodyErr}
            onPress={() => setScouting(true)}
            style={{ flex: 1, minWidth: 0 }}
          >
            {bodyErr
              ? L.checkBody
              : focusLeft > 0
                ? L.focusMore({ n: focusLeft })
                : L.seeCandidates}
          </Btn>
        </ActionBar>
      ) : s.candidates ? (
        <ActionBar row>
          <Btn testID="home" disabled={rewardBusy} onPress={backToForm}>
            {L.back}
          </Btn>
          <Btn
            kind="primary"
            testID="start"
            disabled={s.candidatePick == null || rewardBusy}
            onPress={confirmPick}
            style={{ flex: 1, minWidth: 0 }}
          >
            {s.candidatePick == null ? L.pickOne : L.kickoff({ n: s.candidatePick + 1 })}
          </Btn>
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
        borderRadius: 999,
        borderWidth: 1,
        borderColor: alpha(c.onPitch, 0.3),
        paddingVertical: 1,
        paddingHorizontal: 8,
      }}
    >
      <Txt
        style={{
          fontSize: rem(0.6875),
          lineHeight: rem(0.6875) * 1.5,
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
          fontSize: rem(0.9375),
          letterSpacing: rem(0.9375) * 0.06,
          color: selected ? c.accentText : c.muted,
        }}
      >
        {code}
      </Txt>
      <Txt bold>{title}</Txt>
      <Txt tone="muted" style={{ fontSize: rem(0.75), lineHeight: rem(0.75) * 1.35 }}>
        {blurb}
      </Txt>
    </Opt>
  );
}
