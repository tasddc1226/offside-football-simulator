// T-11-603 랭크 매칭 큐(웹 team/TeamRankQueue.svelte): 첫 화면(내 팀 정보 + 매칭 찾기) → 찾는 중(반경 · 시간 · 취소) →
// 매칭 완료(두 팀 · 걸린 RP · 경기 시작). 상대는 누른 뒤에야 받는다. 찾는 시간은 연출이고 서버 응답이 늦으면 그만큼 더 기다린다.
// 반복 움직임은 찾는 동안에만 돌고 화면을 벗어나면 멈춘다(T-11-602 ANR).
import { FONT } from '@offside/app-core/design-tokens';
import { useEffect, useRef, useState } from 'react';
import { View } from 'react-native';
import Animated, {
  cancelAnimation,
  Easing,
  FadeInDown,
  FadeInLeft,
  FadeInRight,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withTiming,
  ZoomIn,
} from 'react-native-reanimated';
import { useSnapshot } from 'valtio';
import { RANK_REPICKS_DAILY } from '@offside/contracts/owner-team';
import {
  fetchOpponents,
  type OwnerTeam,
  type TeamMatch,
  type TeamOpponent,
} from '@offside/app-core/api/team';
import { teamMatchText as L } from '@offside/app-core/i18n/ko/teamMatch';
import { queueClock, queueStep, queueWaitMs, rankStakes } from '@offside/app-core/rankQueue';
import { num, ratingGap, recordText, signedNum } from '@offside/app-core/teamText';
import { TeamLogo } from '../../components/TeamLogo';
import { TitleBadge } from '../../components/TitleBadge';
import { buzz } from '../../game/host';
import { adFree, adsOff } from '../../platform/adFree';
import { rankRepicksLeft, spendRankRepick } from '../../platform/rankRepick';
import { claimReward, prepareReward, rewardOffer } from '../../platform/rewarded';
import { prefs } from '../../store';
import { useColors } from '../../theme/useColors';
import { DISPLAY, rem } from '../../theme/type';
import { Btn, Txt } from '../../ui';
import { TeamRankInfo } from './TeamRankInfo';
import { TeamRankSquad } from './TeamRankSquad';

const RADAR = 180;

/** 내 엠블럼에서 번져 나가는 고리 하나. */
function Ring({ delay, on, color }: { delay: number; on: boolean; color: string }) {
  const t = useSharedValue(on ? 0 : 0.5);
  useEffect(() => {
    if (!on) return;
    t.value = withDelay(
      delay,
      withRepeat(withTiming(1, { duration: 2100, easing: Easing.out(Easing.quad) }), -1),
    );
    return () => cancelAnimation(t);
  }, [delay, on, t]);
  const style = useAnimatedStyle(() => ({
    opacity: 0.75 * (1 - t.value),
    transform: [{ scale: 0.42 + 0.58 * t.value }],
  }));
  return (
    <Animated.View
      style={[
        {
          position: 'absolute',
          width: RADAR,
          height: RADAR,
          borderRadius: RADAR / 2,
          borderWidth: 2,
          borderColor: color,
        },
        style,
      ]}
    />
  );
}

/** 찾는 중 화면의 반경: 번지는 고리 셋 + 도는 호 + 내 엠블럼. */
function Radar({ team, logo }: { team: OwnerTeam; logo: OwnerTeam['logo'] }) {
  const c = useColors();
  const { motionOK } = useSnapshot(prefs);
  const spin = useSharedValue(0);
  useEffect(() => {
    if (!motionOK) return;
    spin.value = withRepeat(withTiming(1, { duration: 1600, easing: Easing.linear }), -1);
    return () => cancelAnimation(spin);
  }, [motionOK, spin]);
  const spinStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${spin.value * 360}deg` }],
  }));
  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={{ width: RADAR, height: RADAR, alignItems: 'center', justifyContent: 'center' }}
    >
      <Ring delay={0} on={motionOK} color={c.accent} />
      <Ring delay={700} on={motionOK} color={c.accent} />
      <Ring delay={1400} on={motionOK} color={c.accent} />
      <Animated.View
        style={[
          {
            position: 'absolute',
            width: 108,
            height: 108,
            borderRadius: 54,
            borderWidth: 3,
            borderColor: 'transparent',
            borderTopColor: c.accent,
          },
          spinStyle,
        ]}
      />
      <View
        style={{
          width: 84,
          height: 84,
          borderRadius: 42,
          alignItems: 'center',
          justifyContent: 'center',
          borderWidth: 2,
          borderColor: c.accent,
          backgroundColor: c.surface,
        }}
      >
        <TeamLogo logo={logo} name={team.name} size={56} decorative />
      </View>
    </View>
  );
}

type Phase = 'idle' | 'searching' | 'empty' | 'error';

export function TeamRankQueue({
  team,
  logo,
  matchesLeft,
  perDay,
  playing,
  found,
  setFound,
  pick,
  addPick,
  challenge,
  openMatch,
}: {
  team: OwnerTeam;
  logo: OwnerTeam['logo'];
  matchesLeft: number;
  perDay: number;
  playing: boolean;
  /** 찾은 상대(경기를 치르거나 상대가 무효가 되면 부모가 비운다). */
  found: TeamOpponent | null;
  setFound: (o: TeamOpponent) => void;
  /** 이번 경기에서 다시 찾은 횟수. */
  pick: number;
  addPick: () => void;
  challenge: (o: TeamOpponent) => void;
  openMatch: (m: TeamMatch) => void;
}) {
  const c = useColors();
  const { motionOK } = useSnapshot(prefs);
  const [phase, setPhase] = useState<Phase>('idle');
  const [sec, setSec] = useState(0);
  /** 방금 찾았을 때만 등장 효과를 준다(다른 탭을 다녀오면 바로 보인다). */
  const [reveal, setReveal] = useState(false);
  // T-11-702 다른 상대 찾기는 하루 5번이고, 보상형 광고를 본 뒤 찾는다(광고 제거 구매자 · 광고를 못 쓰는 기기는 바로).
  const owned = adsOff(useSnapshot(adFree));
  const viaAd = rewardOffer('repick', owned) === 'ad';
  const [repicksLeft, setRepicksLeft] = useState(rankRepicksLeft);
  const [adBusy, setAdBusy] = useState(false);
  const [adMessage, setAdMessage] = useState('');
  const adReady = !!found && viaAd && repicksLeft > 0;
  useEffect(() => {
    if (adReady) prepareReward('repick');
  }, [adReady]);
  const run = useRef(0);
  const timer = useRef<ReturnType<typeof setInterval> | undefined>(undefined);
  const stopTimer = () => {
    if (timer.current) clearInterval(timer.current);
    timer.current = undefined;
  };
  useEffect(
    () => () => {
      run.current += 1;
      stopTimer();
    },
    [],
  );

  async function search(repick = false) {
    const mine = ++run.current;
    setPhase('searching');
    setSec(0);
    stopTimer();
    timer.current = setInterval(() => setSec((s) => s + 1), 1000);
    const [r] = await Promise.all([
      fetchOpponents(repick ? pick + 1 : pick),
      new Promise((done) => setTimeout(done, queueWaitMs({ repick, motionOK }))),
    ]);
    // 취소했거나 화면을 떠났으면 응답을 버린다. 다시 찾기 횟수도 쓰지 않는다.
    if (mine !== run.current) return;
    stopTimer();
    if (!r.ok) return setPhase('error');
    const o = r.data.items[0];
    if (!o) return setPhase('empty');
    if (repick) {
      addPick();
      setRepicksLeft(spendRankRepick());
    }
    setFound(o);
    setReveal(motionOK);
    setPhase('idle');
    buzz();
  }
  async function repickWithReward() {
    if (adBusy) return;
    setAdBusy(true);
    setAdMessage('');
    try {
      setAdMessage(await claimReward('repick', () => void search(true), L.matchRepickAdSkip));
    } finally {
      setAdBusy(false);
    }
  }
  function cancel() {
    run.current += 1;
    stopTimer();
    setPhase('idle');
  }

  if (phase === 'searching')
    return (
      <View style={{ alignItems: 'center', gap: 10, paddingTop: 8 }} testID="queue-searching">
        <Radar team={team} logo={logo} />
        <Txt bold accessibilityLiveRegion="polite">
          {L.queueTitle}
        </Txt>
        <Txt
          tone="accent"
          accessibilityElementsHidden
          importantForAccessibility="no"
          testID="queue-clock"
          style={{
            fontFamily: DISPLAY[700],
            fontSize: rem(FONT.title2),
            lineHeight: rem(FONT.title2) * 1.2,
            fontVariant: ['tabular-nums'],
          }}
        >
          {queueClock(sec)}
        </Txt>
        <Txt tone="muted" v="xs">
          {queueStep(sec)}
        </Txt>
        <Btn sm style={{ marginTop: 6 }} onPress={cancel} testID="team-queue-cancel">
          {L.queueCancel}
        </Btn>
      </View>
    );

  if (found) {
    const stakes = rankStakes(team, found.rating);
    const gap = ratingGap(team.rating, found.rating);
    const side = {
      flex: 1,
      minWidth: 0,
      alignItems: 'center',
      gap: 3,
    } as const;
    const rp = {
      fontFamily: DISPLAY[700],
      fontSize: rem(FONT.title3),
      lineHeight: rem(FONT.title3) * 1.2,
    };
    const stakeCols = [
      { label: L.stakesWin, value: stakes.win, tone: 'accent' as const },
      { label: L.stakesDraw, value: stakes.draw, tone: undefined },
      { label: L.stakesLoss, value: stakes.loss, tone: 'bad' as const },
    ];
    return (
      <View style={{ alignItems: 'center', gap: 10 }} testID="queue-found">
        <Animated.View entering={reveal ? ZoomIn.duration(350) : undefined}>
          <Txt
            tone="accent"
            accessibilityLiveRegion="polite"
            style={{
              fontFamily: DISPLAY[700],
              fontSize: rem(FONT.title2),
              lineHeight: rem(FONT.title2) * 1.2,
            }}
          >
            {L.queueFound}
          </Txt>
        </Animated.View>
        <View
          style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 8, alignSelf: 'stretch' }}
        >
          <Animated.View entering={reveal ? FadeInLeft.duration(400) : undefined} style={side}>
            <TeamLogo logo={logo} name={team.name} size={56} decorative />
            <Txt bold style={{ textAlign: 'center' }}>
              {team.name}
            </Txt>
            <Txt tone="muted" v="xs">
              {L.queueMe}
            </Txt>
            <Txt tone="accent" style={rp}>
              {`${num(team.rating)} ${L.oppRp}`}
            </Txt>
          </Animated.View>
          <Animated.View
            entering={reveal ? ZoomIn.delay(350).duration(300) : undefined}
            style={{ marginTop: 14 }}
          >
            <Txt
              tone="muted"
              style={{
                fontFamily: DISPLAY[700],
                fontSize: rem(FONT.title2),
                lineHeight: rem(FONT.title2) * 1.2,
              }}
            >
              VS
            </Txt>
          </Animated.View>
          <Animated.View
            entering={reveal ? FadeInRight.duration(400) : undefined}
            style={side}
            testID={`opponent-${found.teamId}`}
          >
            <TeamLogo logo={found.logo} name={found.name} size={56} decorative />
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, maxWidth: '100%' }}>
              <Txt bold style={{ flexShrink: 1, textAlign: 'center' }}>
                {found.name}
              </Txt>
              {found.title ? <TitleBadge title={found.title} size="icon" /> : null}
            </View>
            <Txt tone="muted" v="xs">
              {found.owner}
            </Txt>
            <Txt tone="accent" style={rp}>
              {`${num(found.rating)} ${L.oppRp}`}
            </Txt>
            <Txt
              bold
              tone="muted"
              accessibilityLabel={gap.aria}
              testID={`opponent-gap-${found.teamId}`}
              style={{ fontSize: 11, lineHeight: 13, fontVariant: ['tabular-nums'] }}
            >
              {gap.text}
            </Txt>
          </Animated.View>
        </View>
        <Animated.View
          entering={reveal ? FadeInDown.delay(450).duration(300) : undefined}
          style={{ alignSelf: 'stretch', gap: 10 }}
        >
          <Txt tone="muted" v="sm" style={{ textAlign: 'center' }}>
            {`${found.shape ?? found.formation} · ${L.oppOvr({ n: found.ovr })} · ${recordText(found.record)}`}
          </Txt>
          <View style={{ gap: 6, padding: 10, borderRadius: 12, backgroundColor: c.surface2 }}>
            <Txt tone="muted" v="xs">
              {L.stakesTitle}
            </Txt>
            <View style={{ flexDirection: 'row', gap: 6 }}>
              {stakeCols.map((s) => (
                <View key={s.label} style={{ flex: 1, minWidth: 0 }}>
                  <Txt tone="muted" style={{ fontSize: 11, lineHeight: 14 }}>
                    {s.label}
                  </Txt>
                  <Txt bold {...(s.tone ? { tone: s.tone } : {})}>
                    {signedNum(s.value)}
                  </Txt>
                </View>
              ))}
            </View>
            {stakes.promote ? (
              <Txt bold tone="accent" v="sm" testID="stake-promote">
                {stakes.promote}
              </Txt>
            ) : null}
            {stakes.relegate ? (
              <Txt bold tone="bad" v="sm" testID="stake-relegate">
                {stakes.relegate}
              </Txt>
            ) : null}
          </View>
        </Animated.View>
        {found.odds ? (
          <View
            accessible
            accessibilityRole="image"
            accessibilityLabel={L.oddsAria(found.odds)}
            testID="rank-odds"
            style={{
              alignSelf: 'stretch',
              gap: 6,
              padding: 10,
              borderRadius: 12,
              backgroundColor: c.surface2,
            }}
          >
            <Txt tone="muted" v="xs">
              {L.oddsTitle}
            </Txt>
            <View
              style={{
                flexDirection: 'row',
                gap: 2,
                height: 6,
                borderRadius: 3,
                overflow: 'hidden',
              }}
            >
              <View style={{ flex: Math.max(found.odds.win, 1), backgroundColor: c.accent }} />
              <View style={{ flex: Math.max(found.odds.draw, 1), backgroundColor: c.line }} />
              <View style={{ flex: Math.max(found.odds.loss, 1), backgroundColor: c.bad }} />
            </View>
            <View style={{ flexDirection: 'row', gap: 6 }}>
              {[
                { label: L.oddsWin, value: found.odds.win, tone: 'accent' as const },
                { label: L.oddsDraw, value: found.odds.draw, tone: undefined },
                { label: L.oddsLoss, value: found.odds.loss, tone: 'bad' as const },
              ].map((o) => (
                <View key={o.label} style={{ flex: 1, minWidth: 0 }}>
                  <Txt tone="muted" style={{ fontSize: 11, lineHeight: 14 }}>
                    {o.label}
                  </Txt>
                  <Txt bold {...(o.tone ? { tone: o.tone } : {})}>
                    {`${o.value}%`}
                  </Txt>
                </View>
              ))}
            </View>
            <Txt tone="muted" v="xs">
              {L.oddsNote}
            </Txt>
          </View>
        ) : null}
        <View style={{ flexDirection: 'row', gap: 8, alignSelf: 'stretch' }}>
          <Btn
            kind="primary"
            style={{ flex: 1 }}
            testID="team-challenge"
            accessibilityLabel={L.matchStartAria({ name: found.name })}
            disabled={playing || matchesLeft === 0}
            onPress={() => challenge(found)}
          >
            {L.matchStart}
          </Btn>
          <Btn
            style={{ flex: 1 }}
            onPress={() => void (viaAd ? repickWithReward() : search(true))}
            disabled={playing || adBusy || repicksLeft <= 0}
            accessibilityLabel={(viaAd ? L.matchRepickAd : L.matchRepick)({
              left: repicksLeft,
              max: RANK_REPICKS_DAILY,
            })}
            testID="team-repick"
          >
            {(viaAd ? L.matchRepickAdBtn : L.matchRepickBtn)({
              left: repicksLeft,
              max: RANK_REPICKS_DAILY,
            })}
          </Btn>
        </View>
        {adMessage ? (
          <Txt tone="muted" v="xs" testID="team-repick-ad-message">
            {adMessage}
          </Txt>
        ) : null}
        {phase === 'error' ? <Txt tone="muted">{L.oppLoadFail}</Txt> : null}
        {phase === 'empty' ? <Txt tone="muted">{L.queueEmpty}</Txt> : null}
        <Txt tone="muted" v="xs" testID="opponent-gap-note">
          {L.matchGapNote}
        </Txt>
        <TeamRankSquad opponentId={found.teamId} myId={team.id} />
      </View>
    );
  }

  return (
    <TeamRankInfo
      team={team}
      matchesLeft={matchesLeft}
      perDay={perDay}
      open={openMatch}
      action={
        <View style={{ gap: 12 }}>
          {phase === 'error' ? <Txt tone="muted">{L.oppLoadFail}</Txt> : null}
          {phase === 'empty' ? <Txt tone="muted">{L.queueEmpty}</Txt> : null}
          <Btn
            kind="primary"
            block
            disabled={playing || matchesLeft === 0}
            onPress={() => void search()}
            testID="team-find-match"
          >
            {phase === 'idle' ? L.queueFind : L.queueAgain}
          </Btn>
        </View>
      }
    />
  );
}
