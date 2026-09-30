// 은퇴 리포트 본문(웹 LegendReport.svelte). 은퇴 직후 화면(Retired) · 명예의 전당 상세(Legend) · 공유 링크(Shared)가
// 함께 쓴다 — 진행 중 세이브(G)든 저장된 스냅샷이든 LegendView 하나로 그린다.
// T-10-062: 정보 나열 대신 한 편의 엔딩 크레딧처럼 — 타이틀 → 통산 기록 → 클럽별 챕터(우승·이정표·이야기) →
// 대표팀 → 우승·수상 롤 → 마지막 휘슬. 사용자가 스크롤해 내려가는 대로 장면이 화면에 들어올 때 하나씩 올라온다
// (credit.tsx Reveal). 점수 구성·시즌별 표는 맨 아래 '자세히 보기'에 접어 둔다.
import { useEffect, useState, type ReactNode } from 'react';
import {
  Animated,
  Easing,
  useWindowDimensions,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { useSnapshot } from 'valtio';
import { legendScoreBreakdown, legendTitle } from '@offside/game/season';
import {
  careerChapters,
  nationalEvents,
  honoursRoll,
  type ChapterEvent,
  type HonourLine,
} from '@offside/game/retirement-report';
import { POS_LABEL } from '@offside/game/pos-label';
import { potAchText } from '@offside/game/stats';
import { fmtValue, seasonLabelOf, totals } from '@offside/app-core/format';
import { EVENT_ICON, potVerdict, yearsOf } from '@offside/app-core/legendReport';
import { peakValue, retireValue } from '@offside/contracts/market-value';
import { titleById } from '@offside/game/titles';
import type { LegendView } from '@offside/app-core/state';
import { CareerTab } from '../../components/CareerTab';
import { CountUp } from '../../components/CountUp';
import { ValueChart } from '../../components/ValueChart';
import { pickedTitles, prefs, rnResults } from '../../store';
import { useColors } from '../../theme/useColors';
import { DISPLAY, rem } from '../../theme/type';
import { Card } from '../../ui/Card';
import { Press } from '../../ui/Press';
import { Txt } from '../../ui/Txt';
import { ClubMark } from '../../ui/ClubBadge';
import { LinearGradient } from 'expo-linear-gradient';
import { Pop, POP, Reveal, useProgress, useRevealed } from './credit';
import { FilmBackdrop, FilmPill, FText, H2, Kicker, useFilm } from './film';
import { LateCredits } from './LateCredits';

// end: 리포트 맨 아래(다음 행동 버튼 등).
export function LegendReport({ v, end }: { v: LegendView; end?: ReactNode }) {
  const c = useColors();
  const f = useFilm();
  const { width, height } = useWindowDimensions();
  const { motionOK } = useSnapshot(prefs);
  const rs = useSnapshot(rnResults);
  const pk = useSnapshot(pickedTitles);
  const d = v.d;
  const back = v.pos === 'GK' || v.pos === 'DF';
  const t = d ? totals(d) : null;
  const ownId = v.own?.id;
  const main = titleById((ownId && pk[ownId]) || v.title);

  const chapters = d ? careerChapters(d) : [];
  const national = d ? nationalEvents(d) : [];
  const caps = d ? d.nat.caps : v.totals.caps;
  const honours = d ? honoursRoll(d.trophies) : [];
  const awards = d ? honoursRoll(d.awards).slice(0, 8) : [];
  const span = d?.career.length ? `${d.career[0]!.year} — ${d.career.at(-1)!.year}` : null;
  const breakdown = d ? legendScoreBreakdown(d) : null;
  // T-10-100 은퇴 가치: 가장 비쌌던 세 시즌 몸값 평균에 레전드 점수만큼 웃돈.
  const worth = d ? retireValue(d.career, v.score) : 0;
  const peakV = d ? peakValue(d.career) : null;
  const maxAbs = breakdown ? Math.max(1, ...breakdown.items.map((i) => Math.abs(i.value))) : 1;

  // ───────── 스크롤 크레딧 ─────────
  // 장면이 화면 아래쪽 15%를 넘어 들어오면 한 번 올라온다(credit.tsx). 동작 줄이기면 처음부터 다 보인다.
  const playing = motionOK;
  /** 숫자를 세기 시작할 장면들(통산 기록·A매치)과, 스크롤 안내를 거둘 첫 장면(여정). */
  const [seen, setSeen] = useState({ highlights: false, national: false, journey: false });
  const see = (key: keyof typeof seen) => () => setSeen((s) => ({ ...s, [key]: true }));
  const [more, setMore] = useState(false);

  // ───────── T-10-076 영구결번 ─────────
  // 결번 배지만 여기서 그린다(세리머니는 LateCredits → RetiredNumberCredit). 내 선수는 이번 접속에서 받은 심사 결과
  // (이름 공개 직후 등)를 먼저 본다.
  const rnId = v.own?.id ?? v.shareId;
  const rnv = rnId && rnId in rs ? rs[rnId] : v.rn;
  const rnGranted = rnv?.kind === 'granted' ? rnv : null;

  const nameSize = Math.min(rem(4.5), Math.max(rem(2.75), width * 0.14));

  return (
    <>
      <FilmBackdrop>
        <Reveal
          now
          style={{ minHeight: height - 170, justifyContent: 'center', paddingVertical: 8 }}
        >
          <View
            testID="credit-player"
            style={{
              alignItems: 'center',
              justifyContent: 'center',
              gap: 10,
              flexGrow: 1,
              paddingBottom: playing ? 72 : 0,
            }}
          >
            <Kicker>{`Full Time${v.number != null ? ` · No.${v.number}` : ''}`}</Kicker>
            <FText
              accessibilityRole="header"
              center
              style={{
                fontFamily: DISPLAY[700],
                fontSize: nameSize,
                lineHeight: nameSize * 0.95,
                letterSpacing: -nameSize * 0.01,
                marginTop: 4,
              }}
            >
              {v.name}
            </FText>
            <FText tone="muted" size={0.875} center>
              {POS_LABEL[v.pos]}
              {span ? ` · ${span}` : ''} · {v.age}세 은퇴
            </FText>
            <View style={{ alignItems: 'center', marginTop: 14 }}>
              <FText
                tone="gold"
                display={700}
                size={4}
                lh={1}
                accessibilityLabel={`레전드 점수 ${v.score}`}
              >
                <CountUp value={v.score} animate={playing} ms={1800} />
              </FText>
              <FText
                tone="muted"
                size={0.6875}
                ls={0.24}
                style={{ textTransform: 'uppercase' }}
                importantForAccessibility="no"
              >
                Legend Score
              </FText>
            </View>
            {worth > 0 ? (
              <Pop
                on={playing}
                delay={1500}
                style={{ alignItems: 'center', marginTop: 10, gap: 2 }}
              >
                <View testID="legend-value" style={{ alignItems: 'center', gap: 2 }}>
                  <FText tone="muted" size={0.75}>
                    은퇴 가치
                  </FText>
                  <FText display={700} size={1.75} lh={1.1}>
                    {fmtValue(worth)}
                  </FText>
                  {peakV ? (
                    <FText tone="muted" size={0.75} center>
                      최고 몸값 {fmtValue(peakV.value)} · {seasonLabelOf(peakV.row)}{' '}
                      {peakV.row.club}
                    </FText>
                  ) : null}
                </View>
              </Pop>
            ) : null}
            <Pop
              on={playing}
              delay={1500}
              style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 6 }}
            >
              <FilmPill gold>{legendTitle(v.score, v.dpos)}</FilmPill>
              {main && main.cat !== 'legend' ? (
                <FilmPill testID="legend-title">{`‘${main.name}’`}</FilmPill>
              ) : null}
              <FilmPill>최고 OVR {v.peak}</FilmPill>
              {rnGranted ? (
                <FilmPill
                  rn
                  testID="legend-rn-pill"
                  label={`${rnGranted.club} 영구결번 ${rnGranted.number}번`}
                >
                  👑 {rnGranted.club} 영결 {rnGranted.number}
                </FilmPill>
              ) : null}
            </Pop>
            {/* 통산 기록은 레전드 점수 바로 아래(첫 화면에서 한눈에). */}
            <Reveal
              onSeen={see('highlights')}
              testID="credit-highlights"
              style={{ alignSelf: 'stretch', marginTop: 18 }}
            >
              <View
                accessibilityLabel="통산 기록"
                style={{
                  flexDirection: 'row',
                  flexWrap: 'wrap',
                  borderTopWidth: 1,
                  borderBottomWidth: 1,
                  borderColor: f.line,
                  paddingVertical: 18,
                  rowGap: 18,
                }}
              >
                <Stat
                  label="시즌"
                  value={d ? d.career.length : 0}
                  run={seen.highlights}
                  playing={playing}
                />
                <Stat
                  label="경기"
                  value={t ? t.p : v.totals.apps}
                  run={seen.highlights}
                  playing={playing}
                />
                {back && t ? (
                  <>
                    <Stat label="무실점" value={t.cs} run={seen.highlights} playing={playing} />
                    <Stat label="공격P" value={t.g + t.a} run={seen.highlights} playing={playing} />
                  </>
                ) : (
                  <>
                    <Stat
                      label="골"
                      value={t ? t.g : v.totals.goals}
                      run={seen.highlights}
                      playing={playing}
                    />
                    <Stat
                      label="도움"
                      value={t ? t.a : v.totals.assists}
                      run={seen.highlights}
                      playing={playing}
                    />
                  </>
                )}
                <Stat label="A매치" value={caps} run={seen.highlights} playing={playing} />
                <Stat
                  label="트로피"
                  value={v.totals.trophies}
                  run={seen.highlights}
                  playing={playing}
                />
              </View>
            </Reveal>
            {!d ? (
              <FText tone="muted" size={0.8125} center>
                시즌별 상세 기록이 없는 예전 기록이라 요약만 보여 드립니다.
              </FText>
            ) : null}
            {playing && !seen.journey ? <ScrollCue /> : null}
          </View>
        </Reveal>

        {chapters.length ? (
          <>
            <Reveal onSeen={see('journey')} testID="credit-journey" style={{ marginBottom: -20 }}>
              <View style={{ alignItems: 'center' }}>
                <Kicker>The Journey</Kicker>
                <H2>커리어 여정</H2>
              </View>
            </Reveal>
            <View>
              {chapters.map((ch, i) => (
                <Reveal key={i} testID={`credit-journey-${i}`}>
                  <Chapter last={i === chapters.length - 1}>
                    <FText display={600} size={1.125} tone="gold" ls={0.06}>
                      {ch.from}
                      {ch.to !== ch.from ? ` — ${ch.to}` : ''}
                    </FText>
                    <View
                      accessibilityRole="header"
                      style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        gap: 8,
                        marginTop: 2,
                        marginBottom: 4,
                      }}
                    >
                      <ClubMark name={ch.club} id={ch.clubId} size={24} />
                      <FText display={700} size={2} lh={1.05} style={{ flexShrink: 1 }}>
                        {ch.club}
                      </FText>
                    </View>
                    <FText tone="muted" size={0.8125}>
                      {ch.leagues.join(' → ')} ·{' '}
                      {ch.ageFrom === ch.ageTo ? `${ch.ageFrom}세` : `${ch.ageFrom}–${ch.ageTo}세`}{' '}
                      · {ch.seasons}시즌
                    </FText>
                    <View
                      style={{
                        flexDirection: 'row',
                        flexWrap: 'wrap',
                        columnGap: 14,
                        rowGap: 4,
                        marginTop: 8,
                      }}
                    >
                      <ChStat n={ch.apps} label="경기" />
                      {back ? <ChStat n={ch.cs} label="무실점" /> : null}
                      <ChStat n={ch.goals} label="골" />
                      <ChStat n={ch.assists} label="도움" />
                    </View>
                    {ch.events.length ? (
                      <Events list={ch.events} style={{ marginTop: 14 }} />
                    ) : null}
                  </Chapter>
                </Reveal>
              ))}
            </View>
          </>
        ) : null}

        {/* T-10-106 여정 다음에 몸값 흐름: 클럽을 옮겨 다닌 이야기를 숫자 하나의 곡선으로 되짚는다. */}
        {d && peakV ? (
          <Reveal testID="credit-value">
            <View style={{ alignItems: 'center' }}>
              <Kicker>Market Value</Kicker>
              <H2>몸값 흐름</H2>
              <ValueScene rows={d.career} />
            </View>
          </Reveal>
        ) : null}

        {caps > 0 || national.length ? (
          <Reveal onSeen={see('national')} testID="credit-national">
            <View style={{ alignItems: 'center' }}>
              <Kicker>For the Country</Kicker>
              <H2>국가대표</H2>
              <View style={{ marginTop: 10, flexDirection: 'row', alignItems: 'baseline' }}>
                <FText display={700} size={2.75} lh={1.55} tone="gold" style={{ marginRight: 4 }}>
                  <CountUp value={caps} animate={playing} run={seen.national} />
                </FText>
                <FText tone="muted" size={0.875}>
                  A매치
                </FText>
              </View>
              {d?.nat.goals !== undefined ? (
                <FText
                  tone="muted"
                  size={0.9375}
                  testID="nat-ga"
                  style={{ marginTop: 2, fontVariant: ['tabular-nums'] }}
                >
                  {d.nat.goals}골 · {d.nat.assists ?? 0}도움
                </FText>
              ) : null}
              {national.length ? (
                <Events
                  list={national}
                  style={{ marginTop: 14, maxWidth: 320, alignSelf: 'center' }}
                />
              ) : null}
            </View>
          </Reveal>
        ) : null}

        {honours.length || awards.length ? (
          <Reveal testID="credit-honours">
            <View style={{ gap: 10 }}>
              {honours.length ? (
                <>
                  <View style={{ alignItems: 'center', gap: 0 }}>
                    <Kicker>Honours</Kicker>
                    <H2 style={{ marginBottom: 8 }}>우승 연혁</H2>
                  </View>
                  <RollLines list={honours} from={0} />
                </>
              ) : null}
              {awards.length ? (
                <>
                  <Kicker style={{ textAlign: 'center', marginTop: 26 }}>Individual Awards</Kicker>
                  <RollLines list={awards} from={honours.length} />
                </>
              ) : null}
            </View>
          </Reveal>
        ) : null}

        {v.pot ? (
          <Reveal testID="credit-pot">
            <View testID="legend-pot" style={{ alignItems: 'center', gap: 4 }}>
              <Kicker>Scout Report</Kicker>
              <FText tone="muted" size={0.9375} center>
                끝까지 숨겨져 있던 잠재력
              </FText>
              <FText tone="gold" display={700} size={4} lh={1}>
                {v.pot.real}
              </FText>
              <FText tone="muted" size={0.9375} center>
                {potVerdict(v.pot)}
              </FText>
              <View
                testID="legend-ach"
                style={{
                  marginTop: 14,
                  paddingVertical: 12,
                  paddingHorizontal: 20,
                  borderWidth: 1,
                  borderColor: f.line,
                  borderRadius: 12,
                  alignItems: 'center',
                  gap: 2,
                }}
              >
                <FText tone="muted" size={0.8125}>
                  잠재력 달성도
                </FText>
                <FText display={700} size={2} lh={1.05}>
                  {v.pot.ach}%
                </FText>
                <FText tone="muted" size={0.8125} center>
                  최고 OVR {v.peak} · {potAchText(v.pot.ach)}
                </FText>
              </View>
            </View>
          </Reveal>
        ) : null}

        {d || rnGranted ? <LateCredits v={v} rn={rnv} /> : null}

        <Reveal id="finale" testID="credit-finale">
          <Finale v={v} />
        </Reveal>
      </FilmBackdrop>

      {d ? (
        // 펼칠 때만 그린다(시즌별 표가 길다).
        <Card>
          <Press
            scale={0.985}
            onPress={() => setMore(!more)}
            accessibilityState={{ expanded: more }}
            style={{ paddingVertical: 4 }}
          >
            <Txt style={{ fontWeight: '600', fontSize: rem(0.875) }}>
              {more ? '▾' : '▸'} 시즌별 기록 · 레전드 점수 구성 자세히 보기
            </Txt>
          </Press>
          {more && breakdown ? (
            <View style={{ gap: 10, marginBottom: 18 }}>
              <Txt v="h2" accessibilityRole="header">
                레전드 점수 구성
              </Txt>
              <Txt v="xs" tone="muted">
                포지션별 기여(공격수·미드필더는 골·도움, 수비수·골키퍼는 무실점 중심) + 출전 · 우승
                · 개인상 · A매치 · 최고 OVR · 발롱도르/월드컵 보너스
              </Txt>
              <View style={{ gap: 6 }}>
                {breakdown.items.map((it, i) => (
                  <View key={it.key}>
                    <View
                      style={{
                        flexDirection: 'row',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        paddingVertical: 6,
                        borderTopWidth: i ? 1 : 0,
                        borderTopColor: c.line,
                      }}
                    >
                      <Txt v="sm">{it.label}</Txt>
                      <Txt
                        style={{
                          fontFamily: DISPLAY[700],
                          fontSize: rem(1),
                          fontVariant: ['tabular-nums'],
                        }}
                      >
                        {Math.round(it.value)}
                      </Txt>
                    </View>
                    <View
                      style={{
                        height: 6,
                        borderRadius: 3,
                        backgroundColor: c.surface2,
                        overflow: 'hidden',
                        marginTop: -2,
                      }}
                    >
                      <View
                        style={{
                          height: '100%',
                          backgroundColor: c.accent,
                          width: `${Math.round((Math.abs(it.value) / maxAbs) * 100)}%`,
                        }}
                      />
                    </View>
                  </View>
                ))}
              </View>
            </View>
          ) : null}
          {more ? <CareerTab s={d} chart={false} /> : null}
        </Card>
      ) : null}
      {end ? <View style={{ gap: 14 }}>{end}</View> : null}
    </>
  );
}

/** 통산 기록 한 칸(웹 .film-stats div: 3열). */
function Stat({
  label,
  value,
  run,
  playing,
}: {
  label: string;
  value: number;
  run: boolean;
  playing: boolean;
}) {
  return (
    <View style={{ width: '33.333%', alignItems: 'center' }}>
      <FText display={700} size={2} lh={1.05}>
        <CountUp value={value} animate={playing} run={run} />
      </FText>
      <FText tone="muted" size={0.75}>
        {label}
      </FText>
    </View>
  );
}

/** 스크롤 안내(웹 .film-cue): 화살표가 위아래로 까딱인다. 첫 장면(여정)이 올라오면 거둔다. */
function ScrollCue() {
  const f = useFilm();
  const [p] = useState(() => new Animated.Value(0));
  useEffect(() => {
    const ease = Easing.inOut(Easing.ease);
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(p, { toValue: 1, duration: 800, easing: ease, useNativeDriver: true }),
        Animated.timing(p, { toValue: 0, duration: 800, easing: ease, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [p]);
  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={{ position: 'absolute', left: 0, right: 0, bottom: 18, alignItems: 'center', gap: 4 }}
    >
      <FText tone="muted" size={0.75}>
        스크롤해서 커리어 돌아보기
      </FText>
      <Animated.Text
        style={{
          fontSize: rem(1.125),
          color: f.gold,
          transform: [{ translateY: p.interpolate({ inputRange: [0, 1], outputRange: [0, 6] }) }],
        }}
      >
        ↓
      </Animated.Text>
    </View>
  );
}

/** 챕터 레일: 왼쪽 세로선 위에 클럽마다 금색 점 하나. 장면이 올라오면 선이 위에서 아래로 그려진다. */
function Chapter({ last, children }: { last: boolean; children: ReactNode }) {
  const f = useFilm();
  const revealed = useRevealed();
  const p = useProgress(revealed, 1100, { easing: Easing.bezier(0.3, 0.7, 0.3, 1) });
  return (
    <View style={{ paddingLeft: 26, paddingBottom: 34 }}>
      <Animated.View
        pointerEvents="none"
        style={{
          position: 'absolute',
          left: 5,
          top: 10,
          bottom: -10,
          width: 2,
          transformOrigin: 'top',
          transform: [{ scaleY: p }],
        }}
      >
        <LinearGradient
          colors={[f.gold, last ? 'rgba(240,180,55,0)' : f.line]}
          style={{ flex: 1 }}
        />
      </Animated.View>
      <View
        pointerEvents="none"
        style={{
          position: 'absolute',
          left: -4,
          top: 2,
          width: 20,
          height: 20,
          borderRadius: 10,
          backgroundColor: f.goldRing,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <View style={{ width: 12, height: 12, borderRadius: 6, backgroundColor: f.gold }} />
      </View>
      {children}
    </View>
  );
}

function ChStat({ n, label }: { n: number; label: string }) {
  return (
    <FText tone="muted" size={0.8125}>
      <FText display={700} size={1.125} style={{ marginRight: 2 }}>
        {n}
      </FText>
      {label}
    </FText>
  );
}

/** 챕터·대표팀의 사건 줄(웹 .ch-events): 한 줄씩 밀려 들어온다. */
function Events({ list, style }: { list: ChapterEvent[]; style?: StyleProp<ViewStyle> }) {
  return (
    <View style={[{ gap: 8 }, style]}>
      {list.map((e, j) => (
        <EventLine key={j} e={e} j={j} />
      ))}
    </View>
  );
}

function EventLine({ e, j }: { e: ChapterEvent; j: number }) {
  const revealed = useRevealed();
  const p = useProgress(revealed, 600, { delay: j * 160 + 350, easing: Easing.out(Easing.ease) });
  return (
    <Animated.View
      style={{
        flexDirection: 'row',
        alignItems: 'baseline',
        gap: 6,
        opacity: p,
        transform: [{ translateX: p.interpolate({ inputRange: [0, 1], outputRange: [-14, 0] }) }],
      }}
    >
      <FText
        tone="gold"
        size={e.kind === 'trophy' ? 0.9375 : 0.75}
        style={{ width: 20, textAlign: 'center' }}
        accessibilityElementsHidden
        importantForAccessibility="no"
      >
        {EVENT_ICON[e.kind]}
      </FText>
      <FText
        size={0.875}
        lh={1.4}
        tone={e.kind === 'story' ? 'muted' : 'ink'}
        bold={e.kind === 'trophy'}
        italic={e.kind === 'story'}
        style={{ flex: 1 }}
      >
        {e.text}
        {e.years.length > 1 ? (
          <FText tone="gold" size={0.875} lh={1.4} bold={e.kind === 'trophy'}>
            {' '}
            ×{e.years.length}
          </FText>
        ) : null}
        <FText tone="muted" display={500} size={0.8125} lh={1.4}>
          {'   '}
          {yearsOf(e.years)}
        </FText>
      </FText>
    </Animated.View>
  );
}

/** 우승 연혁: 엔딩 크레딧처럼 가운데 선을 두고 왼쪽엔 이름(오른쪽 정렬), 오른쪽엔 연도. */
function RollLines({ list, from }: { list: HonourLine[]; from: number }) {
  return (
    <>
      {list.map((h, j) => (
        <RollLine key={h.name} h={h} i={from + j} />
      ))}
    </>
  );
}
function RollLine({ h, i }: { h: HonourLine; i: number }) {
  const revealed = useRevealed();
  const p = useProgress(revealed, 600, { delay: i * 90 + 200, easing: Easing.out(Easing.ease) });
  return (
    <Animated.View
      style={{
        flexDirection: 'row',
        alignItems: 'baseline',
        columnGap: 16,
        transform: [{ translateY: p.interpolate({ inputRange: [0, 1], outputRange: [24, 0] }) }],
      }}
    >
      <FText bold size={0.9375} lh={1.35} style={{ flex: 1, textAlign: 'right' }}>
        {h.name}
        {h.years.length > 1 ? ` ×${h.years.length}` : ''}
      </FText>
      <FText tone="muted" display={400} size={0.9375} ls={0.06} style={{ flex: 1 }}>
        {yearsOf(h.years)}
      </FText>
    </Animated.View>
  );
}

/** 몸값 흐름 장면: 장면이 올라온 뒤에 선을 긋는다. */
function ValueScene({ rows }: { rows: NonNullable<LegendView['d']>['career'] }) {
  const go = useRevealed();
  return (
    <View style={{ alignSelf: 'stretch', marginTop: 16 }}>
      <ValueChart rows={rows} film go={go} />
    </View>
  );
}

/** 마지막 휘슬. 'Full Time'은 장면이 올라오고 1초 뒤 튀어 오른다. */
function Finale({ v }: { v: LegendView }) {
  const f = useFilm();
  const revealed = useRevealed();
  const p = useProgress(revealed, 600, { delay: 1000, easing: POP });
  return (
    <View style={{ alignItems: 'center', gap: 12, paddingTop: 36, paddingBottom: 8 }}>
      <ClubMark name={v.lastClub} id={v.lastClubId} size={56} />
      <Kicker>The Final Whistle</Kicker>
      <FText tone="muted" size={0.9375} lh={1.6} center style={{ marginTop: 6 }}>
        {v.age}세, {v.lastClub}에서{'\n'}마지막 휘슬이 울렸습니다.
      </FText>
      <H2 size={1.75}>수고했어요, {v.name}</H2>
      <Animated.View
        style={{
          marginTop: 18,
          borderTopWidth: 1,
          borderBottomWidth: 1,
          borderColor: f.goldLine,
          paddingVertical: 6,
          transform: [{ scale: p }],
        }}
      >
        <FText
          tone="gold"
          display={700}
          size={2.5}
          lh={1.55}
          style={{ letterSpacing: rem(2.5) * 0.22, paddingLeft: rem(2.5) * 0.22 }}
        >
          Full Time
        </FText>
      </Animated.View>
    </View>
  );
}
