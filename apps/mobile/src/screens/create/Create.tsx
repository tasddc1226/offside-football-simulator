// 선수 생성(웹 Create.svelte): 위쪽 라이브 카드가 고를 때마다 바로 바뀌고, 아래 고정 버튼이 남은 할 일을 알려 준다.
// 1단계(프로필 입력) → 2단계(후보 카드 비교·선택). appState.candidates가 있으면 2단계.
import { useEffect, useState, type ReactNode } from 'react';
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
import { withRo } from '@offside/app-core/format';
import { detailOpenNow, draftBody, draftDpos, randomName } from '@offside/app-core/state';
import { rollCandidates, startCareer } from '../../game/host';
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

const posKeys = Object.keys(POS) as Pos[];
const feet = ['오른발', '왼발', '양발'] as const;
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
  startCareer(appState.C.name, appState.C.number, { ...cand.attrs });
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
  const c = useColors();
  const keyboardScroll = useFormKeyboardScroll();
  const insets = useSafeAreaInsets();
  const shadow = useShadow();
  const input = useInputStyle();

  // 세부 포지션은 시즌 1 개막부터 고른다. 프리시즌엔 선택지를 보이지 않고, 저장된 선택도 쓰지 않는다.
  const [detailOpen] = useState(() => detailOpenNow());
  useEffect(() => {
    if (detailOpen && !draftDpos(appState.C)) pickDetail(DETAILS_OF[appState.C.pos][0]!);
  }, [detailOpen]);
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
    `${nation.ko} 고교 경기 영상 분석`,
    `${posLabel({ pos: C.pos, dpos })} 후보군 추리기`,
    `주력 ${C.focus.map((k) => labels[k]).join('·')} 대조`,
    `체격 ${body.h}cm · ${body.w}kg 비교`,
    '능력치 확인 · 후보 3명 확정',
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
            {step === 'form' ? '고교 3학년, 나는 어떤 선수인가' : '스카우트 리포트를 비교해 보세요'}
          </Txt>
        </View>

        {/* 라이브 카드 — 1단계에서는 스크롤해도 위에 붙어 있다 */}
        <View style={{ paddingTop: 8 }}>
          <View
            testID="live-card"
            accessibilityLabel="내 선수 미리보기"
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
                {C.name.trim() || '이름 없음'}
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
                {nation.ko} · {posLabel({ pos: C.pos, dpos })} · {C.foot}
                {bodyErr ? '' : ` · ${body.h}cm ${body.w}kg`}
              </Txt>
              <Row gap={4} style={{ marginTop: 4 }}>
                {trait ? <LiveTag>{`${trait.icon} ${trait.name}`}</LiveTag> : null}
                {C.focus.length ? (
                  <LiveTag>{`주력 ${C.focus.map((k) => labels[k]).join('·')}`}</LiveTag>
                ) : null}
              </Row>
            </View>
            <View style={{ alignItems: 'center', gap: 2 }}>
              <MiniRadar pos={C.pos} attrs={cardAttrs} size={72} onPitch />
              <Txt style={{ fontSize: rem(0.6875), color: alpha(onPitch, 0.85) }}>
                {picked ? '시작' : '예상'} OVR{' '}
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
                <Field label="이름">
                  <View>
                    <TextInput
                      testID="f-name"
                      accessibilityLabel="이름"
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
                      accessibilityLabel="이름 랜덤으로 바꾸기"
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
                <Field label="등번호">
                  <TextInput
                    testID="f-num"
                    accessibilityLabel="등번호"
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

            <Field label="국적">
              <NationPicker
                testID="f-nation"
                value={C.nation}
                onChange={(code) => (appState.C.nation = code)}
              />
              <Txt v="sm" tone="muted" testID="nation-note">
                {foreign
                  ? `한국 고교로 축구 유학을 온 선수로 시작해요. ${nation.ko} 대표팀에 뽑히고 대륙컵은 ${CONFEDS[nation.conf].cup}예요. 병역은 없어요. `
                  : '대표팀 대륙컵은 AFC 아시안컵이에요. 병역(상무·현역)이 있고, 아시안게임·올림픽 메달로 특례를 받을 수 있어요. '}
                대표팀 발탁 기준은 어느 나라든 같아요.
              </Txt>
            </Field>

            <Field label="체격">
              <Row gap={8} wrap={false}>
                <BodyInput
                  testID="f-height"
                  label="키"
                  unit="cm"
                  value={C.height}
                  fallback={def.h}
                  invalid={!!bodyErr}
                  onChange={(v) => (appState.C.height = v)}
                />
                <BodyInput
                  testID="f-weight"
                  label="몸무게"
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
                {bodyErr
                  ? bodyErr
                  : `BMI ${bmiOf(body).toFixed(1)}${note ? ` · ${note}` : ' · 포지션 평균 체격'}. 시작 OVR은 같고, 세부 능력치 분포만 조금 달라져요.`}
              </Txt>
            </Field>

            <Field label="포지션">
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
              <Field label="세부 포지션">
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
                  세부 포지션은 은퇴까지 바뀌지 않아요. 능력치 성장·골과 도움 비중이 달라져요.
                </Txt>
              </Field>
            ) : null}

            <Field label="주발">
              <Seg>
                {feet.map((f) => (
                  <SegCell key={f} cols={3} testID={`foot-${f}`}>
                    <Opt
                      selected={C.foot === f}
                      onPress={() => (appState.C.foot = f)}
                      style={{ flex: 1 }}
                    >
                      <Txt bold>{f}</Txt>
                    </Opt>
                  </SegCell>
                ))}
              </Seg>
            </Field>

            <Field label={`주력 능력치 · ${FOCUS_PICK}개 선택`}>
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
                            ? `시작 +${d} · 성장 +${growthPct}%`
                            : d < 0
                              ? `시작 ${d}`
                              : '변화 없음'}
                        </Txt>
                      </Opt>
                    </SegCell>
                  );
                })}
              </Seg>
            </Field>

            <Field label="성장 특성">
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
              잠재력 평가는 은퇴할 때 공개돼요.
            </Txt>
          </Card>
        ) : s.candidates ? (
          <>
            <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 10 }}>
              <Txt v="sm" tone="muted" style={{ flex: 1 }}>
                세 후보는 능력치 총합이 같고 분포만 달라요. 카드를 눌러 리포트를 열어 보세요.
              </Txt>
              {s.candidatesOpen.some((o) => !o) ? (
                <Btn sm testID="open-all" onPress={openAll}>
                  모두 열기
                </Btn>
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
                        accessibilityLabel={`후보 ${i + 1}, OVR ${startOvr(C.pos, cand.attrs)}, ${scoutLine(C.pos, cand.attrs)}`}
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
                            후보 {i + 1}
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
                          {isPicked ? <Pill tone="good">✓ 선택</Pill> : null}
                        </View>
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
                      accessibilityLabel={`후보 ${i + 1}, 스카우트 메모: 숨은 무기는 ${labels[hiddenStrength(cand.attrs, C.focus)]}. 눌러서 열기`}
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
                          후보 {i + 1}
                        </Txt>
                        <Txt style={{ fontSize: rem(0.75), color: alpha(onPitch, 0.75) }}>
                          스카우트 메모: 숨은 무기는 {labels[hiddenStrength(cand.attrs, C.focus)]}
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
                        탭해서 열기
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
            취소
          </Btn>
          <Btn
            kind="primary"
            testID="next-candidates"
            disabled={focusLeft > 0 || !!bodyErr}
            onPress={() => setScouting(true)}
            style={{ flex: 1, minWidth: 0 }}
          >
            {bodyErr
              ? '키·몸무게를 확인해 주세요'
              : focusLeft > 0
                ? `주력 능력치를 ${focusLeft}개 더 골라주세요`
                : '후보 3명 보기 →'}
          </Btn>
        </ActionBar>
      ) : s.candidates ? (
        <ActionBar row>
          <Btn testID="home" onPress={backToForm}>
            ← 다시 입력
          </Btn>
          <Btn
            kind="primary"
            testID="start"
            disabled={s.candidatePick == null}
            onPress={confirmPick}
            style={{ flex: 1, minWidth: 0 }}
          >
            {s.candidatePick == null
              ? '후보를 한 명 골라주세요'
              : `${withRo(`후보 ${s.candidatePick + 1}`)} 킥오프 →`}
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
