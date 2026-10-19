// T-10-097 팀 경기 문자중계(웹 team/TeamLive.svelte) — 한 화면에서 시계가 0'부터 90'+까지 흐르며 중계 줄이 하나씩
// 올라온다. 골이 가까우면 시계가 느려지고, 골이 들어가면 전광판이 번쩍인다. 결과는 이미 서버가 정했고 여기서는 보여
// 주기만 한다. 동작 줄이기여도 진행 템포는 그대로 두고(읽는 시간) 움직임 효과만 뺀다. '결과 바로 보기'로 언제든 끝낸다.
// 대본(liveScript)·시계 표기는 웹과 같은 @offside/app-core/teamLive.
// T-11-387 장면 경기(live)면 장면 분에 시계를 멈추고 선택지 카드를 띄운다. 고르면 서버가 결과를 정하고, 그 골이 중계에
// 끼어든다. 제한 시간이 지나거나 '결과 바로 보기'를 누르면 남은 장면은 감독에게 맡긴다.
import { FONT, RADIUS } from '@offside/app-core/design-tokens';
import { useEffect, useRef, useState } from 'react';
import { Animated, Easing, ScrollView, View } from 'react-native';
import { useSnapshot } from 'valtio';
import {
  chooseMoment,
  finishLiveMatch,
  type PlayTeamMatchResponse,
  type TeamLive as TeamLiveData,
  type TeamMatch,
  type TeamMoment,
} from '@offside/app-core/api/team';
import {
  FLASH_MS,
  MOMENTUM_START,
  PHASE_LABEL,
  clockText,
  lineWaitMs,
  liveScript,
  momentumAfter,
  momentumDecay,
  playbackPlan,
  waitMs,
  type LiveLine,
  type LivePhase,
} from '@offside/app-core/teamLive';
import {
  LiveScore,
  momentChoices,
  momentLines,
  momentScene,
  momentTitle,
} from '@offside/app-core/teamMoments';
import { teamLiveText as L } from '@offside/app-core/i18n/ko/teamLive';
import { teamMomentsText as M } from '@offside/app-core/i18n/ko/teamMoments';
import { prefs } from '../../store';
import { useColors } from '../../theme/useColors';
import { DISPLAY, rem } from '../../theme/type';
import { Btn, Card, Press, Txt } from '../../ui';
import { Grid2 } from './TeamParts';
import { TeamLogo } from '../../components/TeamLogo';
import { PopSheet } from '../../ui/PopSheet';

/** 중계 줄 하나 — 나타날 때 위에서 살짝 내려앉는다(웹 tl-in). */
function FeedRow({ l, motionOK }: { l: LiveLine; motionOK: boolean }) {
  const c = useColors();
  const a = useRef(new Animated.Value(motionOK ? 0 : 1)).current;
  useEffect(() => {
    if (motionOK) Animated.timing(a, { toValue: 1, duration: 350, useNativeDriver: true }).start();
  }, [a, motionOK]);
  const goal = l.kind === 'goal';
  const marker = l.kind === 'ht' || l.kind === 'ft' || l.kind === 'kickoff';
  // T-11-387 고른 장면 줄은 눈에 띄게(웹 k-moment).
  const moment = l.kind === 'moment';
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
        borderRadius: RADIUS.sm,
        backgroundColor: goal ? c.pitch : marker ? 'transparent' : moment ? c.surface : c.surface2,
        ...(marker ? { borderWidth: 1, borderStyle: 'dashed' as const, borderColor: c.line } : {}),
        ...(moment ? { borderWidth: 1, borderColor: c.pitchAccent } : {}),
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
          fontSize: rem(FONT.body2),
          lineHeight: rem(FONT.body2) * 1.45,
          color: goal ? c.pitchAccent : c.muted,
        }}
      >
        {clockText(l)}
      </Txt>
      <Txt
        style={{
          flex: 1,
          fontSize: rem(FONT.body2),
          lineHeight: rem(FONT.body2) * 1.45,
          fontWeight: goal || marker || moment ? '700' : '400',
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
  neutral = false,
  live,
  onfinal,
}: {
  match: TeamMatch;
  name: (id: string | null, fallback: string) => string;
  onend: () => void;
  /** 내 팀이 없는 경기(컵 공개 경기) — 내 팀 강조 없이 그린다. */
  neutral?: boolean;
  /** T-11-387 고를 장면(장면 경기를 막 시작했을 때만). */
  live?: TeamLiveData | undefined;
  /** 장면 경기가 끝났을 때의 결과(스코어 · 기록 · 레이팅). */
  onfinal?: ((r: PlayTeamMatchResponse) => void) | undefined;
}) {
  const c = useColors();
  const { motionOK } = useSnapshot(prefs);
  // 경기 하나에 한 번 만든다(부모가 경기마다 key로 새로 그린다).
  const [script] = useState(() => liveScript(match, name, { neutral }));
  const [moments] = useState<TeamMoment[]>(() => live?.moments ?? []);
  const [choiceSec] = useState(() => live?.choiceSec ?? 15);
  const [plan] = useState(() =>
    playbackPlan(
      script,
      moments.map((m) => m.minute),
    ),
  );
  const [tally] = useState(() => (live ? new LiveScore(match, neutral) : null));

  // 중계 줄은 장면 줄이 끼어들므로 대본 인덱스가 아니라 고정 키로 센다.
  const [shown, setShown] = useState<{ k: number; l: LiveLine }[]>([]);
  const seq = useRef(0);
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
  const onfinalRef = useRef(onfinal);
  useEffect(() => {
    onendRef.current = onend;
    onfinalRef.current = onfinal;
  });

  /** 지금 고르는 장면과 남은 초. */
  const [active, setActive] = useState<{ m: TeamMoment; left: number } | null>(null);
  const [sending, setSending] = useState(false);
  const pickRef = useRef<((choice: string | null) => void) | null>(null);
  const countdownRef = useRef<ReturnType<typeof setInterval> | undefined>(undefined);
  const finalRef = useRef<PlayTeamMatchResponse | null>(null);
  /** 판정을 받지 못하면 남은 장면은 건너뛰고 끝에서 마감한다. */
  const brokenRef = useRef(false);
  const timer = useRef(new Animated.Value(1)).current;

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
    if (!active) return;
    if (!motionOK || active.left >= choiceSec) return timer.setValue(active.left / choiceSec);
    Animated.timing(timer, {
      toValue: active.left / choiceSec,
      duration: 1000,
      easing: Easing.linear,
      useNativeDriver: false,
    }).start();
  }, [active, choiceSec, motionOK, timer]);

  useEffect(() => {
    const run = { alive: true };
    runRef.current = run;
    const sleep = (ms: number) =>
      new Promise<void>((r) => setTimeout(r, waitMs(ms, fastRef.current)));

    function push(l: LiveLine) {
      const k = seq.current++;
      setShown((prev) => [{ k, l }, ...prev]);
      setMomentum((m) => momentumAfter(m, l));
      if (l.kind === 'goal' && l.score) {
        setScore(l.score);
        setFlash(l.side ?? null);
        clearTimeout(flashTimer.current);
        flashTimer.current = setTimeout(() => setFlash(null), FLASH_MS);
      }
    }

    function show(i: number) {
      const l = script[i]!;
      push(tally ? tally.line(l) : l);
    }

    /** 장면 카드를 띄우고 고른 선택지(시간이 지나면 'auto', 경기를 끝내면 null)를 기다린다. */
    function ask(m: TeamMoment): Promise<string | null> {
      return new Promise((resolve) => {
        let left = choiceSec;
        setActive({ m, left });
        pickRef.current = (choice) => {
          pickRef.current = null;
          clearInterval(countdownRef.current);
          resolve(choice);
        };
        countdownRef.current = setInterval(() => {
          left -= 1;
          setActive({ m, left });
          if (left <= 0) pickRef.current?.('auto');
        }, 1000);
      });
    }

    async function moment(k: number) {
      const m = moments[k];
      if (!m || brokenRef.current || !run.alive) return;
      const choice = await ask(m);
      if (choice === null || !run.alive) return;
      setSending(true);
      const r = await chooseMoment(match.id, m.index, choice);
      setSending(false);
      setActive(null);
      if (!r.ok) {
        brokenRef.current = true;
        push({ minute: m.minute, kind: 'moment', text: M.failed });
        return;
      }
      if (r.data.final) finalRef.current = r.data.final;
      for (const l of momentLines(r.data.moment, r.data.goals, name, tally!)) {
        if (!run.alive) return;
        push(l);
        await sleep(lineWaitMs(l.kind));
      }
    }

    // 순서·대기 시간은 app-core playbackPlan이 정한다. 여기서는 단계마다 상태를 반영하고 기다린다.
    async function loop() {
      for (const step of plan) {
        if (!run.alive) return;
        if (step.clock !== undefined) setClock(step.clock);
        if (step.extra !== undefined) setExtra(step.extra);
        if (step.moment !== undefined) {
          await moment(step.moment);
          if (!run.alive) return;
        }
        if (step.show !== undefined) show(step.show);
        if (step.phase) setPhase(step.phase);
        if (step.decay) setMomentum(momentumDecay);
        if (step.wait > 0) await sleep(step.wait);
      }
      void finish();
    }

    void loop();
    return () => {
      run.alive = false;
      pickRef.current?.(null);
      clearTimeout(flashTimer.current);
      clearInterval(countdownRef.current);
    };
    // 경기 하나에 한 번만 돈다.
  }, []);

  async function finish() {
    const run = runRef.current;
    if (!run.alive) return;
    run.alive = false;
    pickRef.current?.(null);
    setActive(null);
    if (live && !finalRef.current) {
      setSending(true);
      const r = await finishLiveMatch(match.id);
      setSending(false);
      if (r.ok) finalRef.current = r.data;
    }
    if (finalRef.current) onfinalRef.current?.(finalRef.current);
    onendRef.current();
  }

  const choices = active ? momentChoices(active.m, name) : [];
  const scored = shown
    .map((x) => x.l)
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
        {L.title({ home: match.home.name, away: match.away.name })}
      </Txt>
      {/* 전광판 */}
      <View
        style={{
          gap: 10,
          padding: 14,
          borderRadius: RADIUS.md,
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
              borderRadius: RADIUS.md,
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
              borderRadius: RADIUS.pill,
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
              style={{
                ...disp,
                fontSize: rem(FONT.label),
                color: '#fff',
                letterSpacing: 0.06 * 13,
              }}
            >
              {done ? 'FT' : 'LIVE'}
            </Txt>
          </View>
          <Txt
            testID="live-clock"
            style={{
              ...disp,
              fontSize: rem(FONT.title1),
              lineHeight: rem(FONT.title1) * 1.2,
              color: c.pitchAccent,
              minWidth: rem(1.5) * 3.4 * 0.5,
              fontVariant: ['tabular-nums'],
            }}
          >
            {clockLabel}
          </Txt>
          <Txt
            style={{
              marginLeft: 'auto',
              fontSize: rem(FONT.body2),
              color: c.onPitch,
              opacity: 0.85,
            }}
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
            <TeamLogo logo={match.home.logo} name={match.home.name} size={40} decorative />
            <Txt
              style={{
                fontWeight: '700',
                lineHeight: 19,
                color: !neutral && match.mine === 'home' ? c.pitchAccent : c.onPitch,
              }}
            >
              {match.home.name}
            </Txt>
            <Txt style={{ fontSize: rem(FONT.caption), color: c.onPitch, opacity: 0.75 }}>
              {match.home.owner}
            </Txt>
          </View>
          <Animated.View
            testID="live-score"
            accessibilityLiveRegion="polite"
            accessible
            accessibilityLabel={L.scoreAria({ a: score[0], b: score[1] })}
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
            <TeamLogo logo={match.away.logo} name={match.away.name} size={40} decorative />
            <Txt
              style={{
                fontWeight: '700',
                lineHeight: 19,
                textAlign: 'right',
                color: !neutral && match.mine === 'away' ? c.pitchAccent : c.onPitch,
              }}
            >
              {match.away.name}
            </Txt>
            <Txt style={{ fontSize: rem(FONT.caption), color: c.onPitch, opacity: 0.75 }}>
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
                borderRadius: RADIUS.xs,
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
          <Txt style={{ fontSize: rem(FONT.caption), color: c.onPitch }}>{L.flow}</Txt>
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

      {/* T-11-387 결정적 장면은 아래에서 올라오는 시트로 띄운다. 고르거나 시간이 다 돼야 닫힌다(웹 PopSheet와 같다). */}
      {active ? (
        <PopSheet label={momentTitle(active.m)} step={`${active.m.index}`}>
          <View testID="live-moment" style={{ gap: 10 }}>
            <View
              style={{
                flexDirection: 'row',
                justifyContent: 'space-between',
                alignItems: 'baseline',
              }}
            >
              <Txt
                accessibilityRole="header"
                style={{
                  ...disp,
                  fontSize: rem(FONT.title3),
                  color: active.m.kind === 'crisis' ? c.bad : c.pitch2,
                }}
              >
                {momentTitle(active.m)}
              </Txt>
              <Txt tone="muted" style={{ ...disp, fontVariant: ['tabular-nums'] }}>
                {`${active.m.minute}' · ${score[0]} : ${score[1]}`}
              </Txt>
            </View>
            <Txt style={{ lineHeight: rem(FONT.body) * 1.5 }}>{momentScene(active.m, name)}</Txt>
            <Txt style={{ lineHeight: rem(FONT.body) * 1.5 }}>
              {`${M.ask} `}
              <Txt tone="muted" style={{ fontSize: rem(FONT.label) }}>
                {active.m.kind === 'chance' ? M.chancePct : M.crisisPct}
              </Txt>
            </Txt>
            <View style={{ gap: 6 }}>
              {choices.map((ch) => (
                <Press
                  key={ch.id}
                  testID={`live-moment-choice-${ch.id}`}
                  disabled={sending}
                  onPress={() => pickRef.current?.(ch.id)}
                  accessibilityLabel={`${ch.label} ${M.pct({ p: ch.pct })}${ch.tags.length ? `, ${ch.tags.join(' · ')}` : ''}`}
                  accessibilityState={{ disabled: sending }}
                  style={{
                    flexDirection: 'row',
                    flexWrap: 'wrap',
                    alignItems: 'center',
                    columnGap: 10,
                    rowGap: 2,
                    minHeight: 48,
                    paddingVertical: 8,
                    paddingHorizontal: 12,
                    borderRadius: RADIUS.sm,
                    borderWidth: 1,
                    borderColor: 'transparent',
                    backgroundColor: c.surface2,
                    opacity: sending ? 0.6 : 1,
                  }}
                >
                  <Txt bold style={{ flex: 1, minWidth: 0 }}>
                    {ch.label}
                  </Txt>
                  <Txt
                    style={{ ...disp, fontSize: rem(FONT.title3), fontVariant: ['tabular-nums'] }}
                  >
                    {M.pct({ p: ch.pct })}
                  </Txt>
                  {ch.tags.length ? (
                    <Txt tone="muted" style={{ width: '100%', fontSize: rem(FONT.caption) }}>
                      {ch.tags.join(' · ')}
                    </Txt>
                  ) : null}
                </Press>
              ))}
            </View>
            <View
              accessibilityElementsHidden
              importantForAccessibility="no-hide-descendants"
              style={{ height: 4, borderRadius: 2, backgroundColor: c.line, overflow: 'hidden' }}
            >
              <Animated.View
                style={{
                  height: '100%',
                  backgroundColor: c.pitch2,
                  width: timer.interpolate({
                    inputRange: [0, 1],
                    outputRange: ['0%', '100%'],
                    extrapolate: 'clamp',
                  }),
                }}
              />
            </View>
            <Txt
              tone="muted"
              accessibilityLiveRegion="polite"
              style={{ fontSize: rem(FONT.label), lineHeight: rem(FONT.label) * 1.5 }}
            >
              {sending ? M.sending : M.timer({ s: active.left })}
            </Txt>
            <Btn testID="live-moment-skip" disabled={sending} onPress={() => void finish()}>
              {L.skip}
            </Btn>
          </View>
        </PopSheet>
      ) : null}

      {/* 중계 줄(새 줄이 맨 위) */}
      <ScrollView
        nestedScrollEnabled
        style={{ maxHeight: rem(22) }}
        contentContainerStyle={{ gap: 6 }}
      >
        {shown.map((x) => (
          <FeedRow key={x.k} l={x.l} motionOK={motionOK} />
        ))}
      </ScrollView>

      <Grid2>
        <Btn
          block
          testID="live-fast"
          accessibilityLabel={fast ? L.speedNormal : L.speedFast}
          onPress={() => {
            fastRef.current = !fast;
            setFast(!fast);
          }}
        >
          {fast ? L.speedNormal : L.speedFast}
        </Btn>
        <Btn
          block
          kind="primary"
          testID="live-skip"
          disabled={sending}
          onPress={() => void finish()}
        >
          {sending ? M.sending : L.skip}
        </Btn>
      </Grid2>
    </Card>
  );
}
