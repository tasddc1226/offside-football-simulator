// T-11-128 구단주 시즌 결산(웹 SeasonRecap.svelte) — 끝난 시즌의 기록을 서버가 굳힌 그대로 보여 준다.
// 맨 위 시즌 카드(등급 · 한 줄 요약 · 자랑거리) → 숫자 → 이 시즌의 얼굴 → 카드 등급 → 팀 → 순위 → 기록 배지 → 남긴 선수 순.
// 끝난 시즌이 둘 이상이면 시즌 칩으로 고른다(기본은 가장 최근). '결산 공유하기'는 같은 값을 4:5 한 장으로 그린다(RecapShare.tsx).
// 결산을 열면 그 시즌을 '봤다'고 기록해 구단주 허브 카드의 NEW 표시를 끈다. 뒤로 가기는 구단주 허브로 돌아간다.
import { useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { Animated, Easing, useWindowDimensions, View } from 'react-native';
import Svg, { Defs, LinearGradient, Path, Rect, Stop } from 'react-native-svg';
import { useSnapshot } from 'valtio';
import type { SeasonRecap as Recap, SeasonRecapResponse } from '@offside/contracts';
import { detailPosOf } from '@offside/contracts/positions';
import { fetchOwnerHonors, fetchSeasonRecap } from '@offside/app-core/api/seasonRecap';
import { anonName, cardTier } from '@offside/app-core/format';
import { EMBLEM_PALETTE } from '@offside/app-core/gradeEmblem';
import { seasonRecapText as L } from '@offside/app-core/i18n/ko/seasonRecap';
import { ownerText as O } from '@offside/app-core/i18n/ko/owner';
import { recapTier, tierReason, tierTitle } from '@offside/app-core/ownerTier';
import { teamSeasonLabel } from '@offside/app-core/seasonName';
import {
  CARD_TIER_SWATCH,
  honorViews,
  markRecapSeen,
  rankText,
  recapCutoffText,
  recapHeadline,
  recapHighlights,
  recapNumbers,
  recapStatusText,
  recapTeamSummary,
  recapTierBars,
  signed,
  topPercent,
  type HonorView,
} from '@offside/app-core/seasonRecap';
import { num, recordText } from '@offside/app-core/teamText';
import { POS } from '@offside/game/data';
import { HonorEmblem } from '../../components/HonorEmblem';
import { useMedal } from '../../components/Laurel';
import { PlayerCard } from '../../components/PlayerCard';
import { GradeEmblem } from '../../ui/GradeEmblem';
import { go } from '../../game/nav';
import { appState, prefs } from '../../store';
import { alpha, mix } from '../../theme/colors';
import { DISPLAY, rem } from '../../theme/type';
import { useColors } from '../../theme/useColors';
import { BackBar, Btn, Card, Press, Screen, Topbar, Txt } from '../../ui';
import { useRefresh } from '../../ui/refresh';
import { Seg, TabOpt } from '../board/parts';
import { RECAP_INK, RecapBackdrop, RecapShare } from './RecapShare';
import { RecapCardReel } from './recap/RecapCardReel';
import { RecapTeamPhoto } from './recap/RecapTeamPhoto';

/** 카드 제목 줄(영문 eyebrow 없이 소제목만). */
const Sec = ({ children }: { children: string }) => (
  <Txt v="h2" accessibilityRole="header">
    {children}
  </Txt>
);

/** 카드 제목 아래 한 줄 설명(웹 .sec-lead). */
const Lead = ({ children }: { children: string }) => (
  <Txt tone="muted" style={{ fontSize: rem(0.875), marginTop: -4 }}>
    {children}
  </Txt>
);

/** 칸 격자(웹 grid) — 칸 수만큼 균등, 마지막 줄이 모자라도 칸 폭은 그대로다. 좁은 화면(≤380)은 한 칸 줄인다(웹 @media). */
function Grid({ cols, children }: { cols: number; children: ReactNode }) {
  const { width } = useWindowDimensions();
  const n = width <= 380 ? Math.max(2, cols - 1) : cols;
  const items = Array.isArray(children) ? children.flat() : [children];
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginHorizontal: -4 }}>
      {items.filter(Boolean).map((child, i) => (
        <View
          key={i}
          style={{ width: `${100 / n}%`, paddingHorizontal: 4, paddingBottom: 8, minWidth: 0 }}
        >
          {child}
        </View>
      ))}
    </View>
  );
}

/** 이름 · 값 칸(웹 .recap-stats div) — 위에 이름, 아래에 큰 값. */
function Stat({ label, value, testID }: { label: string; value: string; testID?: string }) {
  const c = useColors();
  return (
    <View
      testID={testID}
      accessible
      accessibilityLabel={`${label} ${value}`}
      style={{
        flex: 1,
        gap: 2,
        paddingVertical: 10,
        paddingHorizontal: 12,
        borderRadius: 12,
        backgroundColor: c.surface2,
      }}
    >
      <Txt tone="muted" style={{ fontSize: rem(0.75) }}>
        {label}
      </Txt>
      <Txt num style={{ fontSize: rem(1.125) }}>
        {value}
      </Txt>
    </View>
  );
}

/** 숫자가 0에서 차오른다(~1.1초, 끝이 느린 세제곱). 동작 줄이기면 바로 값. */
function useCountUp(to: number): number {
  const { motionOK } = useSnapshot(prefs);
  const [v, setV] = useState(motionOK ? 0 : to);
  useEffect(() => {
    if (!motionOK || to === 0) {
      setV(to);
      return;
    }
    const start = Date.now();
    let raf = 0;
    const step = () => {
      const k = Math.min(1, (Date.now() - start) / 1100);
      setV(Math.round(to * (1 - (1 - k) ** 3)));
      if (k < 1) raf = requestAnimationFrame(step);
    };
    setV(0);
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [to, motionOK]);
  return v;
}

/** 차오르는 숫자 글자. 스크린 리더에는 처음부터 최종 값을 읽어 준다. */
function CountUp({ value, style, testID }: { value: number; style: object; testID?: string }) {
  const shown = useCountUp(value);
  return (
    <Txt num testID={testID} accessibilityLabel={num(value)} style={style}>
      {num(shown)}
    </Txt>
  );
}

/** 큰 숫자 칸(웹 .big-numbers div) — 골 · 발롱도르 칸은 금색. */
function BigNumber({ n }: { n: { key: string; label: string; value: number } }) {
  const c = useColors();
  const lead = n.key === 'goals' || n.key === 'ballon';
  return (
    <View
      testID={`recap-stat-${n.key}`}
      accessible
      accessibilityLabel={`${n.label} ${num(n.value)}`}
      style={{
        alignItems: 'center',
        gap: 2,
        paddingTop: 12,
        paddingBottom: 10,
        paddingHorizontal: 6,
        borderRadius: 14,
        backgroundColor: lead ? mix(c.accent, c.surface2, 0.14) : c.surface2,
      }}
    >
      <CountUp
        value={n.value}
        style={{
          fontSize: rem(1.75),
          lineHeight: rem(1.75) * 1.05,
          color: lead ? c.accentText : c.ink,
          textAlign: 'center',
        }}
      />
      <Txt tone="muted" center style={{ fontSize: rem(0.75) }}>
        {n.label}
      </Txt>
    </View>
  );
}

const SHARE_ICON = 'M10 13V3M6 7l4-4 4 4M4 11v5h12v-5';

/** 공유 버튼 — 맨 위 시즌 카드에서는 금색, 맨 아래에서는 초록(웹 .recap-share-btn). */
function ShareButton({ where, onPress }: { where: 'hero' | 'end'; onPress: () => void }) {
  const hero = where === 'hero';
  const c = useColors();
  const fg = hero ? RECAP_INK.goldInk : c.onPitch;
  return (
    <Press
      testID={hero ? 'recap-share' : 'recap-share-end'}
      accessibilityLabel={L.shareBtn}
      onPress={onPress}
      style={{
        minHeight: 44,
        marginTop: 8,
        paddingHorizontal: 20,
        borderRadius: 12,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
        backgroundColor: hero ? RECAP_INK.gold : c.pitch,
        ...(hero
          ? {
              shadowColor: RECAP_INK.gold,
              shadowOpacity: 0.45,
              shadowRadius: 9,
              shadowOffset: { width: 0, height: 5 },
            }
          : {}),
      }}
    >
      <Svg width={18} height={18} viewBox="0 0 20 20">
        <Path
          d={SHARE_ICON}
          fill="none"
          stroke={fg}
          strokeWidth={1.8}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </Svg>
      <Txt style={{ color: fg, fontSize: rem(0.9375), fontWeight: '600' }}>{L.shareBtn}</Txt>
    </Press>
  );
}

/** 기록 배지 진열(웹 .recap-honor) — 칸 없이 문장만 세 개씩(76px). 문장 아래에 이름(굵게)과 단계(메달 글자색). */
function HonorBadge({ h }: { h: HonorView }) {
  const { leaf, text } = useMedal(h.medal);
  return (
    <View
      testID={`recap-honor-${h.kind}`}
      accessible
      accessibilityLabel={`${h.title} ${h.detail}`}
      style={{ width: '33.3333%', alignItems: 'center', gap: 4, paddingHorizontal: 3 }}
    >
      {/* 웹 drop-shadow — 메달 색 빛(iOS만 그려지고 안드로이드는 생략). */}
      <View
        style={{
          shadowColor: leaf,
          shadowOpacity: 0.35,
          shadowRadius: 5,
          shadowOffset: { width: 0, height: 4 },
        }}
      >
        <HonorEmblem h={h} size={76} />
      </View>
      <View style={{ gap: 1, alignItems: 'center', minWidth: 0 }} accessibilityElementsHidden>
        <Txt bold center style={{ fontSize: rem(0.8125), lineHeight: rem(0.8125) * 1.25 }}>
          {h.title}
        </Txt>
        <Txt num={600} center style={{ fontSize: rem(0.75), color: text, fontWeight: '600' }}>
          {h.detail}
        </Txt>
      </View>
    </View>
  );
}

type State = { kind: 'loading' } | { kind: 'error' } | { kind: 'ok'; res: SeasonRecapResponse };

export default function SeasonRecap() {
  // 끝난 시즌(오래된 순)과 고른 시즌 — 고르지 않았으면 가장 최근.
  const [seasons, setSeasons] = useState<number[] | null>(null);
  const [picked, setPicked] = useState<number | null>(null);
  const [st, setSt] = useState<State>({ kind: 'loading' });
  const [retryN, setRetryN] = useState(0);
  const [sharing, setSharing] = useState(false);
  const { tick, track, pulled } = useRefresh();
  const season = picked ?? seasons?.at(-1) ?? null;

  useEffect(() => {
    let alive = true;
    void track(fetchOwnerHonors()).then((r) => alive && r.ok && setSeasons(r.data.seasons));
    return () => {
      alive = false;
    };
  }, [tick, track]);

  useEffect(() => {
    // 시즌 목록이 오기 전에는 서버가 정한 가장 최근 시즌을 받는다(season 생략).
    if (!pulled) setSt({ kind: 'loading' });
    let alive = true; // 더 늦게 고른 시즌의 응답만 쓴다.
    void track(fetchSeasonRecap(season ?? undefined)).then((r) => {
      if (!alive) return;
      if (!r.ok) return setSt({ kind: 'error' });
      setSt({ kind: 'ok', res: r.data });
      if (r.data.status === 'ready') {
        markRecapSeen(r.data.season);
        appState.recapNew = false;
      }
    });
    return () => {
      alive = false;
    };
  }, [season, tick, retryN, track]);

  const res = st.kind === 'ok' ? st.res : null;
  const recap = res?.recap ?? null;
  const shown = res ? teamSeasonLabel(res.season) : '';
  const honors = res ? honorViews(res.honors) : [];
  const muted = { fontSize: rem(0.875) } as const;

  return (
    <Screen footer={<BackBar testID="owner" fallback={() => go('owner')} />}>
      <Topbar />
      <Card gap={8} testID="recap">
        <View style={{ gap: 2 }}>
          <Txt v="eyebrow">Season recap</Txt>
          <Txt v="h1" accessibilityRole="header">
            {res ? L.title({ season: shown }) : L.cardTitle}
          </Txt>
          {recap ? (
            <Txt tone="muted" style={muted}>
              {recapCutoffText(recap)}
            </Txt>
          ) : null}
        </View>
        {seasons && seasons.length > 1 ? (
          <Seg cols={Math.min(seasons.length, 3)} label={L.pickSeason} style={{ marginTop: 4 }}>
            {seasons.map((id) => (
              <TabOpt
                key={id}
                title={teamSeasonLabel(id)}
                selected={season === id}
                testID={`recap-season-${id}`}
                onPress={() => setPicked(id)}
              />
            ))}
          </Seg>
        ) : null}
        {st.kind === 'loading' ? (
          <Txt tone="muted" accessibilityLiveRegion="polite" style={muted}>
            {'…'}
          </Txt>
        ) : st.kind === 'error' ? (
          <View style={{ gap: 8 }}>
            <Txt tone="muted" style={muted}>
              {L.loadFail}
            </Txt>
            <Btn
              sm
              testID="recap-retry"
              style={{ alignSelf: 'flex-start' }}
              onPress={() => setRetryN((n) => n + 1)}
            >
              {L.retry}
            </Btn>
          </View>
        ) : res && res.status !== 'ready' ? (
          <Txt tone="muted" testID={`recap-${res.status}`} style={muted}>
            {recapStatusText(res)}
          </Txt>
        ) : null}
      </Card>

      {res && recap ? (
        <>
          <Hero recap={recap} onShare={() => setSharing(true)} />
          <Squad recap={recap} season={shown} />
          <Numbers recap={recap} />
          <Faces recap={recap} />
          <Cards recap={recap} />
          <TeamSection recap={recap} />
          <Ranks recap={recap} />

          <Card gap={10} testID="recap-honors">
            <Sec>{L.secBadges}</Sec>
            {honors.length > 0 ? (
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', rowGap: 14, paddingTop: 4 }}>
                {honors.map((h) => (
                  <HonorBadge key={`${h.season}-${h.kind}`} h={h} />
                ))}
              </View>
            ) : (
              <Txt tone="muted" style={muted}>
                {L.honorsNone}
              </Txt>
            )}
          </Card>

          <Card gap={8} testID="recap-activity">
            <Sec>{L.secLegacy}</Sec>
            <Grid cols={2}>
              <Stat
                label={L.retiredNumbers}
                value={num(recap.retiredNumbers)}
                testID="recap-stat-retired-numbers"
              />
              <Stat
                label={L.wallOfHonor}
                value={num(recap.wallOfHonor)}
                testID="recap-stat-wall-of-honor"
              />
              <Stat label={L.firsts} value={num(recap.firsts)} testID="recap-stat-firsts" />
              {recap.stats ? (
                <Stat
                  label={L.numAssists}
                  value={num(recap.stats.assists)}
                  testID="recap-stat-assists"
                />
              ) : null}
            </Grid>
          </Card>

          <View style={{ alignItems: 'center', gap: 4, paddingBottom: 4 }}>
            <ShareButton where="end" onPress={() => setSharing(true)} />
            <Txt tone="muted" center testID="recap-next" style={muted}>
              {L.next({ season: teamSeasonLabel(res.season + 1) })}
            </Txt>
          </View>

          {sharing ? <RecapShare recap={recap} close={() => setSharing(false)} /> : null}
        </>
      ) : null}
    </Screen>
  );
}

/** 시즌 카드 — 테마와 상관없이 어두운 바탕(공유 이미지와 같은 첫인상). 등급 색 빛이 가운데서 번진다. */
function Hero({ recap, onShare }: { recap: Recap; onShare: () => void }) {
  const tier = recapTier(recap);
  const palette = EMBLEM_PALETTE[tier];
  const highlights = recapHighlights(recap);
  const title = tierTitle({ tier, season: recap.season });
  const { motionOK } = useSnapshot(prefs);
  // 엠블럼이 튀어 나오듯 들어온다(웹 pop). 동작 줄이기면 바로.
  const pop = useRef(new Animated.Value(motionOK ? 0 : 1)).current;
  useEffect(() => {
    if (!motionOK) return;
    Animated.timing(pop, {
      toValue: 1,
      duration: 700,
      delay: 150,
      easing: Easing.out(Easing.back(1.6)),
      useNativeDriver: true,
    }).start();
  }, [motionOK, pop]);
  return (
    <View
      testID={`recap-tier-${tier}`}
      style={{
        borderRadius: 20,
        overflow: 'hidden',
        alignItems: 'center',
        gap: 6,
        paddingTop: 18,
        paddingHorizontal: 18,
        paddingBottom: 20,
        backgroundColor: RECAP_INK.bg,
      }}
    >
      <RecapBackdrop tier={tier} />
      <View
        style={{ alignSelf: 'stretch', flexDirection: 'row', justifyContent: 'space-between' }}
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
      >
        <Txt
          style={{
            color: RECAP_INK.gold,
            fontFamily: DISPLAY[700],
            fontSize: rem(1.125),
            letterSpacing: 1,
          }}
        >
          OFFSIDE
        </Txt>
        <Txt
          style={{
            color: RECAP_INK.muted,
            fontFamily: DISPLAY[700],
            fontSize: rem(0.875),
            letterSpacing: 1,
          }}
        >
          SEASON RECAP
        </Txt>
      </View>
      <Txt
        center
        accessibilityRole="header"
        style={{
          marginTop: 4,
          color: RECAP_INK.ink,
          fontSize: rem(2.25),
          fontWeight: '800',
          lineHeight: rem(2.25) * 1.15,
          letterSpacing: -0.3,
        }}
      >
        {teamSeasonLabel(recap.season)}
      </Txt>
      <Animated.View
        style={{
          marginVertical: 14,
          opacity: pop,
          transform: [
            { scale: pop.interpolate({ inputRange: [0, 1], outputRange: [0.6, 1] }) },
            { rotate: pop.interpolate({ inputRange: [0, 1], outputRange: ['-8deg', '0deg'] }) },
          ],
        }}
      >
        <GradeEmblem id={tier} size={128} />
      </Animated.View>
      <View
        accessible
        accessibilityLabel={`${title} ${tierReason(recap)}`}
        style={{ alignItems: 'center', gap: 2 }}
      >
        <Txt
          style={{
            color: palette.light,
            fontFamily: DISPLAY[700],
            fontSize: rem(1.5),
            letterSpacing: 0.3,
          }}
        >
          {title}
        </Txt>
        <Txt num style={{ color: RECAP_INK.muted, fontSize: rem(0.8125) }}>
          {tierReason(recap)}
        </Txt>
      </View>
      <Txt
        center
        testID="recap-headline"
        style={{
          marginTop: 8,
          maxWidth: 300,
          color: RECAP_INK.ink,
          fontSize: rem(1.0625),
          fontWeight: '700',
          lineHeight: rem(1.0625) * 1.5,
        }}
      >
        {recapHeadline(recap)}
      </Txt>
      {highlights.length > 0 ? (
        <View
          testID="recap-highlights"
          style={{
            flexDirection: 'row',
            flexWrap: 'wrap',
            justifyContent: 'center',
            gap: 6,
            marginTop: 6,
          }}
        >
          {highlights.map((h) => (
            <View
              key={h}
              style={{
                paddingVertical: 5,
                paddingHorizontal: 12,
                borderRadius: 999,
                borderWidth: 1,
                borderColor: alpha(palette.light, 0.55),
                backgroundColor: alpha(palette.base, 0.22),
              }}
            >
              <Txt style={{ color: palette.mark, fontSize: rem(0.8125), fontWeight: '700' }}>
                {h}
              </Txt>
            </View>
          ))}
        </View>
      ) : null}
      <ShareButton where="hero" onPress={onShare} />
    </View>
  );
}

/** 숫자로 본 시즌 — 은퇴한 선수들이 남긴 통산 기록을 큰 숫자로. */
function Numbers({ recap }: { recap: Recap }) {
  return (
    <Card gap={8} testID="recap-section-numbers">
      <Sec>{L.secNumbers}</Sec>
      {recap.stats ? <Lead>{L.numbersLead}</Lead> : null}
      <Grid cols={3}>
        {recapNumbers(recap).map((n) => (
          <BigNumber key={n.key} n={n} />
        ))}
      </Grid>
    </Card>
  );
}

/** 이 시즌의 선수단 — 단체사진과 끝없이 흐르는 카드(웹 data-recap-section=squad). 선수단이 없으면 그리지 않는다. */
function Squad({ recap, season }: { recap: Recap; season: string }) {
  const { squad } = recap;
  if (!squad || squad.length === 0) return null;
  return (
    <Card gap={10} testID="recap-section-squad">
      <Sec>{L.secSquad}</Sec>
      <Lead>{L.squadLead({ n: num(recap.retired) })}</Lead>
      <RecapTeamPhoto squad={squad} season={season} />
      <RecapCardReel squad={squad} />
    </Card>
  );
}

/** 이 시즌의 얼굴 — 대표 선수는 카드 등급 색(선수 카드가 있으면 카드와 함께), 최다 득점 선수는 큰 골 수. 둘 다 누르지 않는다. */
function Faces({ recap }: { recap: Recap }) {
  const { best } = recap;
  const scorer = recap.stats?.scorer ?? null;
  if (!best && !scorer) return null;
  return (
    <Card gap={8} testID="recap-legacy">
      <Sec>{L.secFace}</Sec>
      <View style={{ gap: 8 }}>
        {best ? <BestFace best={best} /> : null}
        {scorer ? <ScorerFace scorer={scorer} /> : null}
      </View>
    </Card>
  );
}

type Best = NonNullable<Recap['best']>;

/** 마감 전 은퇴한 선수 가운데 레전드 점수가 가장 높은 선수. 결산 화면 밖으로 나가지 않아 누를 수 없다. */
function BestFace({ best }: { best: Best }) {
  const tier = cardTier(best.score, best.peak ?? 0);
  const sw = CARD_TIER_SWATCH[tier];
  const uid = useId().replace(/[^a-zA-Z0-9]/g, '');
  const name = best.name ?? anonName(best.pos, null);
  const { card } = best;
  const { motionOK } = useSnapshot(prefs);
  // 선수 카드가 튀어 나오듯 들어온다(웹 .face-card pop).
  const pop = useRef(new Animated.Value(motionOK ? 0 : 1)).current;
  useEffect(() => {
    if (!motionOK) return;
    Animated.timing(pop, {
      toValue: 1,
      duration: 700,
      easing: Easing.out(Easing.back(1.6)),
      useNativeDriver: true,
    }).start();
  }, [motionOK, pop]);
  const label = `${L.best} ${name} ${L.bestScore({ score: num(best.score) })}`;
  const body = (
    <View
      style={{
        flexDirection: card ? 'row' : 'column',
        alignItems: card ? 'center' : 'stretch',
        gap: 14,
      }}
    >
      {card ? (
        <Animated.View
          testID="recap-best-card"
          style={{
            width: 148,
            opacity: pop,
            transform: [{ scale: pop.interpolate({ inputRange: [0, 1], outputRange: [0.6, 1] }) }],
          }}
        >
          <PlayerCard
            animate={false}
            code={detailPosOf(card)}
            cell={{
              name,
              nation: card.nation,
              season: card.season,
              rating: card.peak,
              number: card.number,
              legendScore: card.legendScore,
              attrs: card.attrs,
              attrsEstimated: card.attrsEstimated,
              cardValue: card.cardValue,
              pos: card.pos,
              youth: false,
            }}
          />
        </Animated.View>
      ) : null}
      <View style={{ flex: card ? 1 : undefined, minWidth: 0, gap: 2 }}>
        <Txt style={{ color: sw.ink, opacity: 0.8, fontSize: rem(0.75), fontWeight: '600' }}>
          {`${L.best} · ${L.cardTierName({ tier })}`}
        </Txt>
        <Txt
          style={{
            color: sw.ink,
            fontSize: rem(1.125),
            lineHeight: rem(1.125) * 1.3,
            fontWeight: '700',
          }}
        >
          {name}
        </Txt>
        <Txt style={{ color: sw.ink, opacity: 0.8, fontSize: rem(0.8125) }}>
          {[POS[best.pos].label, best.lastClub].filter(Boolean).join(' · ')}
        </Txt>
        <Txt num style={{ color: sw.ink, marginTop: 6, fontSize: rem(1.125) }}>
          {L.bestScore({ score: num(best.score) })}
        </Txt>
        {best.peak ? (
          <Txt num style={{ color: sw.ink, opacity: 0.85, fontSize: rem(0.9375) }}>
            {`${L.peak} ${best.peak}`}
          </Txt>
        ) : null}
      </View>
    </View>
  );
  const box = {
    minHeight: 44,
    padding: 14,
    borderRadius: 14,
    borderWidth: 2,
    borderColor: sw.line,
    overflow: 'hidden',
  } as const;
  const bg = (
    <Svg
      width="100%"
      height="100%"
      style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
      pointerEvents="none"
    >
      <Defs>
        <LinearGradient id={`${uid}b`} x1="0" y1="0" x2="0.35" y2="1">
          <Stop offset="0" stopColor={sw.base} />
          <Stop offset="1" stopColor={sw.dark} />
        </LinearGradient>
      </Defs>
      <Rect width="100%" height="100%" fill={`url(#${uid}b)`} />
    </Svg>
  );
  return (
    <View testID="recap-best" accessible accessibilityLabel={label} style={box}>
      {bg}
      {body}
    </View>
  );
}

/** 가장 많이 넣은 선수 — 큰 골 수(차오른다). */
function ScorerFace({ scorer }: { scorer: NonNullable<NonNullable<Recap['stats']>['scorer']> }) {
  const c = useColors();
  const name = scorer.name ?? anonName(scorer.pos, null);
  const body = (
    <View style={{ gap: 2 }}>
      <Txt style={{ opacity: 0.8, fontSize: rem(0.75), fontWeight: '600' }}>{L.scorer}</Txt>
      <Txt bold style={{ fontSize: rem(1.125), lineHeight: rem(1.125) * 1.3 }}>
        {name}
      </Txt>
      <Txt tone="muted" style={{ fontSize: rem(0.8125) }}>
        {POS[scorer.pos].label}
      </Txt>
      <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 4, paddingTop: 6 }}>
        <CountUp
          value={scorer.goals}
          style={{ fontSize: rem(2.25), lineHeight: rem(2.25), color: c.accentText }}
        />
        <Txt tone="muted" style={{ fontSize: rem(0.8125) }}>
          {L.numGoals}
        </Txt>
      </View>
    </View>
  );
  const label = `${L.scorer} ${name} ${L.scorerGoals({ n: num(scorer.goals) })}`;
  const box = {
    minHeight: 44,
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: c.line,
    backgroundColor: c.surface2,
  } as const;
  return (
    <View testID="recap-scorer" accessible accessibilityLabel={label} style={box}>
      {body}
    </View>
  );
}

/** 카드 등급 — 한 줄 막대와 범례(0명 등급도 자리를 지킨다). */
function Cards({ recap }: { recap: Recap }) {
  const c = useColors();
  const bars = recapTierBars(recap);
  if (bars.length === 0) return null;
  return (
    <Card gap={10} testID="recap-section-cards">
      <Sec>{L.secCards}</Sec>
      <Lead>{L.cardsLead({ n: num(recap.retired) })}</Lead>
      <View
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
        style={{ flexDirection: 'row', gap: 2, height: 18, borderRadius: 9, overflow: 'hidden' }}
      >
        {bars
          .filter((b) => b.n > 0)
          .map((b) => (
            <View
              key={b.tier}
              style={{
                flexGrow: b.n,
                flexBasis: 0,
                minWidth: 6,
                backgroundColor: mix(
                  CARD_TIER_SWATCH[b.tier].base,
                  CARD_TIER_SWATCH[b.tier].dark,
                  0.6,
                ),
              }}
            />
          ))}
      </View>
      <Grid cols={3}>
        {bars.map((b) => {
          const sw = CARD_TIER_SWATCH[b.tier];
          return (
            <View
              key={b.tier}
              testID={`recap-card-tier-${b.tier}`}
              accessible
              accessibilityLabel={`${b.label} ${L.tierCount({ n: b.n })}`}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: 6,
                opacity: b.n === 0 ? 0.45 : 1,
              }}
            >
              <View
                style={{
                  width: 12,
                  height: 12,
                  borderRadius: 3,
                  backgroundColor: sw.base,
                  borderWidth: 1,
                  borderColor: sw.line,
                }}
              />
              <Txt numberOfLines={1} style={{ fontSize: rem(0.8125), flexShrink: 1, color: c.ink }}>
                {b.label}
              </Txt>
              <Txt num style={{ marginLeft: 'auto', fontSize: rem(0.9375) }}>
                {L.tierCount({ n: b.n })}
              </Txt>
            </View>
          );
        })}
      </Grid>
    </Card>
  );
}

/** 팀 경쟁 — 승 · 무 · 패 비율 막대와 기록 칸. */
function TeamSection({ recap }: { recap: Recap }) {
  const c = useColors();
  const t = recap.team;
  const sum = t ? recapTeamSummary(t) : null;
  return (
    <Card gap={10} testID="recap-team">
      <Sec>{L.secTeam}</Sec>
      {t && sum ? (
        <>
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'baseline',
              justifyContent: 'space-between',
              gap: 8,
            }}
          >
            <Txt bold style={{ flex: 1, fontSize: rem(1.0625) }}>
              {t.name}
            </Txt>
            <Txt tone="muted" num style={{ fontSize: rem(0.875) }}>
              {L.played({ n: num(sum.played) })}
            </Txt>
          </View>
          {sum.played > 0 ? (
            <View
              accessibilityElementsHidden
              importantForAccessibility="no-hide-descendants"
              style={{
                flexDirection: 'row',
                gap: 2,
                height: 26,
                borderRadius: 8,
                overflow: 'hidden',
              }}
            >
              {(
                [
                  [t.wins, c.good],
                  [t.draws, mix(c.muted, c.surface, 0.7)],
                  [t.losses, c.bad],
                ] as const
              )
                .filter(([n]) => n > 0)
                .map(([n, bg]) => (
                  <View
                    key={bg}
                    style={{
                      flexGrow: n,
                      flexBasis: 0,
                      minWidth: 22,
                      backgroundColor: bg,
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <Txt num style={{ color: '#ffffff', fontSize: rem(0.875) }}>
                      {String(n)}
                    </Txt>
                  </View>
                ))}
            </View>
          ) : null}
          <Grid cols={3}>
            <Stat
              label={O.statRecord}
              value={recordText({ w: t.wins, d: t.draws, l: t.losses })}
              testID="recap-stat-record"
            />
            <Stat label={L.winRate} value={`${sum.winRate}%`} testID="recap-stat-win-rate" />
            <Stat label={L.rating} value={num(t.rating)} testID="recap-stat-rating" />
            <Stat label={L.goals} value={num(t.goalsFor)} testID="recap-stat-team-goals" />
            {t.goalsAgainst !== null ? (
              <Stat
                label={L.goalsAgainst}
                value={num(t.goalsAgainst)}
                testID="recap-stat-goals-against"
              />
            ) : null}
            {sum.goalDiff !== null ? (
              <Stat label={L.goalDiff} value={signed(sum.goalDiff)} testID="recap-stat-goal-diff" />
            ) : null}
            <Stat label={L.bestStreak} value={num(t.bestStreak)} testID="recap-stat-streak" />
            {t.bestMargin ? (
              <Stat
                label={L.bestMargin}
                value={L.marginGoals({ n: t.bestMargin })}
                testID="recap-stat-best-margin"
              />
            ) : null}
          </Grid>
        </>
      ) : (
        <Txt tone="muted" style={{ fontSize: rem(0.875) }}>
          {L.noTeam}
        </Txt>
      )}
    </Card>
  );
}

/** 시즌 순위 — 팀 · 업적 · 명예의 전당, 상위 몇 %인지 막대로. */
function Ranks({ recap }: { recap: Recap }) {
  const c = useColors();
  const rows = [
    {
      key: 'team',
      label: L.honorTeam,
      rank: recap.team?.rank ?? null,
      total: recap.team ? recap.team.ranked : 0,
      show: !!recap.team,
    },
    {
      key: 'ach',
      label: L.honorAchievements,
      rank: recap.achievements?.rank ?? null,
      total: recap.achievements?.ranked ?? 0,
      show: !!recap.achievements,
    },
    {
      key: 'hof',
      label: L.hofRank,
      rank: recap.hofRank,
      total: recap.hofRanked,
      show: recap.retired > 0,
    },
  ].filter((x) => x.show);
  if (rows.length === 0) return null;
  return (
    <Card gap={12} testID="recap-section-ranks">
      <Sec>{L.secRanks}</Sec>
      {rows.map((r) => {
        const pct = topPercent(r.rank, r.total);
        const hot = pct !== null && pct <= 10;
        return (
          <View
            key={r.key}
            testID={`recap-rank-${r.key}`}
            accessible
            accessibilityLabel={`${r.label} ${rankText(r.rank, r.total)}${pct === null ? '' : ` ${L.topPct({ pct })}`}`}
            style={{ gap: 6 }}
          >
            <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 8 }}>
              <Txt style={{ fontSize: rem(0.875) }}>{r.label}</Txt>
              <Txt num style={{ marginLeft: 'auto', fontSize: rem(1.0625) }}>
                {rankText(r.rank, r.total)}
              </Txt>
              {pct !== null ? (
                <View
                  style={{
                    paddingVertical: 2,
                    paddingHorizontal: 8,
                    borderRadius: 999,
                    backgroundColor: hot ? mix(c.accent, c.surface, 0.18) : c.surface2,
                  }}
                >
                  <Txt
                    style={{
                      fontSize: rem(0.75),
                      fontWeight: '700',
                      color: hot ? c.accentText : c.muted,
                    }}
                  >
                    {L.topPct({ pct })}
                  </Txt>
                </View>
              ) : null}
            </View>
            <View
              style={{
                height: 6,
                borderRadius: 3,
                backgroundColor: c.surface2,
                overflow: 'hidden',
              }}
            >
              <View
                style={{
                  height: '100%',
                  borderRadius: 3,
                  width: `${pct === null ? 0 : Math.max(4, 101 - pct)}%`,
                  backgroundColor: c.accent,
                }}
              />
            </View>
          </View>
        );
      })}
      {recap.achievements ? (
        <Txt tone="muted" style={{ fontSize: rem(0.875) }}>
          {`${L.achScore} ${num(recap.achievements.score)} · ${L.achDone({ n: recap.achievements.done })}`}
        </Txt>
      ) : null}
    </Card>
  );
}
