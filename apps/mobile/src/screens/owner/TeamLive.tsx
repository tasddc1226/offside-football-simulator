// T-10-097 팀 경기 문자중계(웹 team/TeamLive.svelte) — 한 화면에서 시계가 0'부터 90'+까지 흐르며 중계 줄이 하나씩
// 올라온다. 골이 가까우면 시계가 느려지고, 골이 들어가면 전광판이 번쩍인다. 결과는 이미 서버가 정했고 여기서는 보여
// 주기만 한다. 동작 줄이기여도 진행 템포는 그대로 두고(읽는 시간) 움직임 효과만 뺀다. '결과 바로 보기'로 언제든 끝낸다.
// 대본(liveScript)·시계 표기는 웹과 같은 @offside/app-core/teamLive.
import { useEffect, useRef, useState } from 'react';
import { Animated, ScrollView, View } from 'react-native';
import { useSnapshot } from 'valtio';
import type { TeamMatch } from '@offside/app-core/api/team';
import {
  FLASH_MS,
  MOMENTUM_START,
  PHASE_LABEL,
  clockText,
  liveScript,
  momentumAfter,
  momentumDecay,
  playbackPlan,
  waitMs,
  type LiveLine,
  type LivePhase,
} from '@offside/app-core/teamLive';
import { prefs } from '../../store';
import { useColors } from '../../theme/useColors';
import { DISPLAY, rem } from '../../theme/type';
import { Btn, Card, Txt } from '../../ui';
import { Grid2 } from './TeamParts';

/** 중계 줄 하나 — 나타날 때 위에서 살짝 내려앉는다(웹 tl-in). */
function FeedRow({ l, motionOK }: { l: LiveLine; motionOK: boolean }) {
  const c = useColors();
  const a = useRef(new Animated.Value(motionOK ? 0 : 1)).current;
  useEffect(() => {
    if (motionOK) Animated.timing(a, { toValue: 1, duration: 350, useNativeDriver: true }).start();
  }, [a, motionOK]);
  const goal = l.kind === 'goal';
  const marker = l.kind === 'ht' || l.kind === 'ft' || l.kind === 'kickoff';
  return (
    <Animated.View
      testID={`live-line-${l.kind}`}
      style={{
        opacity: a,
        transform: [
          { translateY: a.interpolate({ inputRange: [0, 1], outputRange: [-8, 0] }) },
          { scale: a.interpolate({ inputRange: [0, 1], outputRange: [0.98, 1] }) },
        ],
        flexDirection: 'row',
        gap: 8,
        paddingVertical: 6,
        paddingHorizontal: 10,
        borderRadius: 10,
        backgroundColor: goal ? c.pitch : marker ? 'transparent' : c.surface2,
        ...(marker ? { borderWidth: 1, borderStyle: 'dashed' as const, borderColor: c.line } : {}),
        overflow: 'hidden',
      }}
    >
      {l.side === 'home' ? (
        <View
          style={{
            position: 'absolute',
            left: 0,
            top: 0,
            bottom: 0,
            width: 3,
            backgroundColor: c.pitch2,
          }}
        />
      ) : l.side === 'away' ? (
        <View
          style={{
            position: 'absolute',
            right: 0,
            top: 0,
            bottom: 0,
            width: 3,
            backgroundColor: c.accent,
          }}
        />
      ) : null}
      <Txt
        num
        style={{
          width: rem(0.875) * 3.4,
          fontSize: rem(0.875),
          lineHeight: rem(0.875) * 1.45,
          color: goal ? c.pitchAccent : c.muted,
        }}
      >
        {clockText(l)}
      </Txt>
      <Txt
        style={{
          flex: 1,
          fontSize: rem(0.875),
          lineHeight: rem(0.875) * 1.45,
          fontWeight: goal || marker ? '700' : '400',
          color: goal ? c.onPitch : c.ink,
        }}
      >
        {l.text}
      </Txt>
    </Animated.View>
  );
}

export function TeamLive({
  match,
  name,
  onend,
}: {
  match: TeamMatch;
  name: (id: string | null, fallback: string) => string;
  onend: () => void;
}) {
  const c = useColors();
  const { motionOK } = useSnapshot(prefs);
  // 경기 하나에 한 번 만든다(부모가 경기마다 key로 새로 그린다).
  const [script] = useState(() => liveScript(match, name));
  const [plan] = useState(() => playbackPlan(script));

  const [shown, setShown] = useState<number[]>([]);
  const [clock, setClock] = useState(0);
  const [extra, setExtra] = useState(0);
  const [phase, setPhase] = useState<LivePhase>('1st');
  const [score, setScore] = useState<[number, number]>([0, 0]);
  const [flash, setFlash] = useState<'home' | 'away' | null>(null);
  /** 경기 흐름(0 = 원정 쪽이 몰아침, 1 = 홈 쪽이 몰아침). */
  const [momentum, setMomentum] = useState(MOMENTUM_START);
  const [fast, setFast] = useState(false);
  const fastRef = useRef(false);
  const runRef = useRef({ alive: true });
  const flashTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const onendRef = useRef(onend);
  useEffect(() => {
    onendRef.current = onend;
  });

  // 골 배너 · 점수 튀어 오름 · 흐름 막대
  const banner = useRef(new Animated.Value(0)).current;
  const bump = useRef(new Animated.Value(1)).current;
  const pulse = useRef(new Animated.Value(1)).current;
  const mom = useRef(new Animated.Value(MOMENTUM_START)).current;

  useEffect(() => {
    if (!motionOK) return;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 0.3, duration: 600, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 1, duration: 600, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [motionOK, pulse]);

  useEffect(() => {
    if (!motionOK) return mom.setValue(momentum);
    Animated.timing(mom, { toValue: momentum, duration: 600, useNativeDriver: false }).start();
  }, [momentum, motionOK, mom]);

  useEffect(() => {
    if (!flash || !motionOK) return;
    banner.setValue(0);
    bump.setValue(1);
    Animated.parallel([
      Animated.sequence([
        Animated.timing(banner, { toValue: 1, duration: 360, useNativeDriver: true }),
        Animated.delay(1100),
        Animated.timing(banner, { toValue: 2, duration: 340, useNativeDriver: true }),
      ]),
      Animated.sequence([
        Animated.timing(bump, { toValue: 1.25, duration: 240, useNativeDriver: true }),
        Animated.timing(bump, { toValue: 1, duration: 360, useNativeDriver: true }),
      ]),
    ]).start();
  }, [flash, motionOK, banner, bump]);

  useEffect(() => {
    const run = { alive: true };
    runRef.current = run;
    const sleep = (ms: number) =>
      new Promise<void>((r) => setTimeout(r, waitMs(ms, fastRef.current)));

    function show(i: number) {
      const l = script[i]!;
      setShown((prev) => [i, ...prev]);
      setMomentum((m) => momentumAfter(m, l));
      if (l.kind === 'goal' && l.score) {
        setScore(l.score);
        setFlash(l.side ?? null);
        clearTimeout(flashTimer.current);
        flashTimer.current = setTimeout(() => setFlash(null), FLASH_MS);
      }
    }

    // 순서·대기 시간은 app-core playbackPlan이 정한다. 여기서는 단계마다 상태를 반영하고 기다린다.
    async function loop() {
      for (const step of plan) {
        if (!run.alive) return;
        if (step.clock !== undefined) setClock(step.clock);
        if (step.extra !== undefined) setExtra(step.extra);
        if (step.show !== undefined) show(step.show);
        if (step.phase) setPhase(step.phase);
        if (step.decay) setMomentum(momentumDecay);
        if (step.wait > 0) await sleep(step.wait);
      }
      finish();
    }

    void loop();
    return () => {
      run.alive = false;
      clearTimeout(flashTimer.current);
    };
    // 경기 하나에 한 번만 돈다.
  }, []);

  function finish() {
    const run = runRef.current;
    if (!run.alive) return;
    run.alive = false;
    onendRef.current();
  }

  const scored = shown
    .map((i) => script[i]!)
    .filter((l): l is LiveLine & { side: 'home' | 'away' } => l.kind === 'goal' && !!l.side);
  const clockLabel = extra ? `${clock}+${extra}'` : `${clock}'`;
  const done = phase === 'ft';
  const disp = { fontFamily: DISPLAY[700] } as const;

  return (
    <Card gap={12} style={{ padding: 18 }}>
      <Txt
        accessibilityRole="header"
        style={{ position: 'absolute', width: 1, height: 1, opacity: 0 }}
      >
        {`${match.home.name} 대 ${match.away.name} 문자중계`}
      </Txt>
      {/* 전광판 */}
      <View
        style={{
          gap: 10,
          padding: 14,
          borderRadius: 14,
          backgroundColor: c.pitch,
          overflow: 'hidden',
        }}
      >
        {/* 골이 들어가면 전광판 테두리가 번쩍인다(웹 tl-flash). */}
        {flash ? (
          <View
            pointerEvents="none"
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              borderWidth: 4,
              borderRadius: 14,
              borderColor: c.pitchAccent,
            }}
          />
        ) : null}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: 6,
              paddingVertical: 1,
              paddingHorizontal: 8,
              borderRadius: 999,
              backgroundColor: done ? c.chalk : c.bad,
            }}
          >
            {done ? null : (
              <Animated.View
                style={{
                  width: 7,
                  height: 7,
                  borderRadius: 4,
                  backgroundColor: '#fff',
                  opacity: pulse,
                }}
              />
            )}
            <Txt
              style={{ ...disp, fontSize: rem(0.8125), color: '#fff', letterSpacing: 0.06 * 13 }}
            >
              {done ? 'FT' : 'LIVE'}
            </Txt>
          </View>
          <Txt
            testID="live-clock"
            style={{
              ...disp,
              fontSize: rem(1.5),
              lineHeight: rem(1.5) * 1.2,
              color: c.pitchAccent,
              minWidth: rem(1.5) * 3.4 * 0.5,
              fontVariant: ['tabular-nums'],
            }}
          >
            {clockLabel}
          </Txt>
          <Txt
            style={{ marginLeft: 'auto', fontSize: rem(0.875), color: c.onPitch, opacity: 0.85 }}
          >
            {PHASE_LABEL[phase]}
          </Txt>
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          <View
            style={{
              flex: 1,
              minWidth: 0,
              gap: 2,
              transform: [{ scale: flash === 'home' && motionOK ? 1.06 : 1 }],
            }}
          >
            <Txt
              style={{
                fontWeight: '700',
                lineHeight: 19,
                color: match.mine === 'home' ? c.pitchAccent : c.onPitch,
              }}
            >
              {match.home.name}
            </Txt>
            <Txt style={{ fontSize: rem(0.75), color: c.onPitch, opacity: 0.75 }}>
              {match.home.owner}
            </Txt>
          </View>
          <Animated.View
            testID="live-score"
            accessibilityLiveRegion="polite"
            accessible
            accessibilityLabel={`${score[0]} 대 ${score[1]}`}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: 8,
              transform: [{ scale: bump }],
            }}
          >
            <Txt
              style={{
                fontFamily: DISPLAY[800],
                fontSize: rem(2.6),
                lineHeight: rem(2.6),
                color: flash ? c.pitchAccent : c.onPitch,
              }}
            >
              {score[0]}
            </Txt>
            <Txt
              accessible={false}
              style={{
                fontFamily: DISPLAY[800],
                fontSize: rem(2.6),
                lineHeight: rem(2.6),
                color: c.onPitch,
              }}
            >
              :
            </Txt>
            <Txt
              style={{
                fontFamily: DISPLAY[800],
                fontSize: rem(2.6),
                lineHeight: rem(2.6),
                color: flash ? c.pitchAccent : c.onPitch,
              }}
            >
              {score[1]}
            </Txt>
          </Animated.View>
          <View
            style={{
              flex: 1,
              minWidth: 0,
              gap: 2,
              alignItems: 'flex-end',
              transform: [{ scale: flash === 'away' && motionOK ? 1.06 : 1 }],
            }}
          >
            <Txt
              style={{
                fontWeight: '700',
                lineHeight: 19,
                textAlign: 'right',
                color: match.mine === 'away' ? c.pitchAccent : c.onPitch,
              }}
            >
              {match.away.name}
            </Txt>
            <Txt style={{ fontSize: rem(0.75), color: c.onPitch, opacity: 0.75 }}>
              {match.away.owner}
            </Txt>
          </View>
        </View>
        {/* 시간 막대: 채움 · 하프타임 눈금 · 골 점 */}
        <View
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
          style={{ height: 6, borderRadius: 3, backgroundColor: c.chalk }}
        >
          <View
            style={{
              height: '100%',
              width: `${Math.min(100, (clock / 90) * 100)}%`,
              borderRadius: 3,
              backgroundColor: c.pitchAccent,
            }}
          />
          <View
            style={{
              position: 'absolute',
              left: '50%',
              top: -3,
              width: 2,
              height: 12,
              backgroundColor: c.onPitch,
              opacity: 0.6,
            }}
          />
          {scored.map((g, k) => (
            <View
              key={k}
              style={{
                position: 'absolute',
                left: `${(g.minute / 90) * 100}%`,
                top: -4,
                width: 10,
                height: 10,
                marginLeft: -5,
                borderRadius: 5,
                backgroundColor: g.side === 'away' ? c.pitchAccent : c.onPitch,
                borderWidth: 2,
                borderColor: c.pitch,
              }}
            />
          ))}
        </View>
        <View
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
          style={{ flexDirection: 'row', alignItems: 'center', gap: 8, opacity: 0.85 }}
        >
          <Txt style={{ fontSize: rem(0.75), color: c.onPitch }}>흐름</Txt>
          <View
            style={{
              flex: 1,
              height: 4,
              borderRadius: 2,
              backgroundColor: c.pitchAccent,
              overflow: 'hidden',
            }}
          >
            <Animated.View
              style={{
                height: '100%',
                backgroundColor: c.onPitch,
                width: mom.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] }),
              }}
            />
          </View>
        </View>
        {flash ? (
          <Animated.View
            pointerEvents="none"
            accessibilityElementsHidden
            importantForAccessibility="no-hide-descendants"
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              alignItems: 'center',
              justifyContent: 'center',
              opacity: motionOK
                ? banner.interpolate({ inputRange: [0, 0.2, 1, 2], outputRange: [0, 1, 1, 0] })
                : 1,
              transform: [
                {
                  scale: motionOK
                    ? banner.interpolate({ inputRange: [0, 1, 2], outputRange: [0.6, 1, 1] })
                    : 1,
                },
              ],
            }}
          >
            <Txt
              style={{
                fontFamily: DISPLAY[800],
                fontSize: rem(3.4),
                letterSpacing: 0.12 * rem(3.4),
                color: c.pitchAccent,
                textShadowColor: 'rgba(0,0,0,0.45)',
                textShadowRadius: 12,
                textShadowOffset: { width: 0, height: 2 },
              }}
            >
              GOAL!
            </Txt>
          </Animated.View>
        ) : null}
      </View>

      {/* 중계 줄(새 줄이 맨 위) */}
      <ScrollView
        nestedScrollEnabled
        style={{ maxHeight: rem(22) }}
        contentContainerStyle={{ gap: 6 }}
      >
        {shown.map((i) => (
          <FeedRow key={i} l={script[i]!} motionOK={motionOK} />
        ))}
      </ScrollView>

      <Grid2>
        <Btn
          block
          testID="live-fast"
          accessibilityLabel={fast ? '보통 속도' : '빠르게'}
          onPress={() => {
            fastRef.current = !fast;
            setFast(!fast);
          }}
        >
          {fast ? '보통 속도' : '빠르게'}
        </Btn>
        <Btn block kind="primary" testID="live-skip" onPress={finish}>
          결과 바로 보기
        </Btn>
      </Grid2>
    </Card>
  );
}
