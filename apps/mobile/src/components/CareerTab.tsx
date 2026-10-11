// 커리어 탭(웹 tabs/CareerTab.svelte, ui.ts careerTab 포트): 통산 기록 + 몸값 그래프 · 다음 목표 · 시즌별 기록 표 · 여정.
// 게임 화면의 커리어 탭과 은퇴 리포트 '자세히 보기'가 같이 쓴다.
import { useEffect, useRef, type ReactNode } from 'react';
import { Animated, Easing, ScrollView, View, type TextStyle } from 'react-native';
import { useSnapshot } from 'valtio';
import type { GameState, LegendSource } from '@offside/game/types';
import { fmtValue, seasonLabelOf, totals } from '@offside/app-core/format';
import { careerGoals, goalsNote, retiredNumberHint } from '@offside/app-core/career-feedback';
import { gameCareerText as L } from '@offside/app-core/i18n/ko/gameCareer';
import { peakValue, seasonValue } from '@offside/contracts/market-value';
import { prefs } from '../store';
import { alpha } from '../theme/colors';
import { useColors } from '../theme/useColors';
import { DISPLAY, num, rem } from '../theme/type';
import { Card } from '../ui/Card';
import { ClubMark } from '../ui/ClubBadge';
import { Txt } from '../ui/Txt';
import { RetiredNumberGuide } from './RetiredNumberGuide';
import { ValueChart } from './ValueChart';
import { tn } from '@offside/game/i18n/names';

/** 표 칸 너비(웹 table은 nowrap이라 좁은 화면에선 옆으로 밀어 본다). */
const COL = { season: 100, club: 184, n: 46, rating: 52 };

// 은퇴 상세(LegendSource)에는 '다음 목표'가 없다 — 진행 중인 커리어(GameState)에서만 계산한다.
// chart: 몸값 그래프·최고 몸값 줄. 은퇴 크레딧은 자기 '몸값 흐름' 장면이 있어 끈다(T-10-106).
export function CareerTab({ s, chart = true }: { s: LegendSource | GameState; chart?: boolean }) {
  const c = useColors();
  const t = totals(s);
  const rows = s.career.slice().reverse();
  const miles = (s.miles || []).slice().reverse();
  const next = 'attrs' in s && !s.retired ? careerGoals(s) : [];
  // 진행 중인 커리어에만 있다. 다음 목표 카드도 이 값으로 보인다.
  const rnHint = 'attrs' in s && !s.retired ? retiredNumberHint(s) : null;
  const peakV = chart ? peakValue(s.career) : null;
  const back = s.pos === 'GK' || s.pos === 'DF';
  const totalCells: [number, string][] = [
    [t.p, L.apps],
    [t.g, L.goals],
    back ? [t.cs, L.cleanSheets] : [t.a, L.assists],
    [s.trophies.length + s.awards.length, L.awards],
  ];
  return (
    <>
      <Card>
        <View>
          <Txt v="eyebrow">Career</Txt>
          <Txt v="h2" accessibilityRole="header">
            {L.totalsTitle}
          </Txt>
        </View>
        <View style={{ flexDirection: 'row', gap: 6 }}>
          {totalCells.map(([n, label]) => (
            <View
              key={label}
              style={{
                flex: 1,
                backgroundColor: c.surface2,
                borderRadius: 10,
                padding: 8,
                alignItems: 'center',
              }}
            >
              <Txt
                style={{
                  ...num(700),
                  fontSize: rem(1.625),
                  lineHeight: rem(1.625) * 1.1,
                }}
              >
                {n}
              </Txt>
              <Txt tone="muted" style={{ fontSize: rem(0.6875), lineHeight: rem(0.6875) * 1.5 }}>
                {label}
              </Txt>
            </View>
          ))}
        </View>
        {peakV ? (
          <>
            <ValueChart rows={s.career} />
            <Txt v="sm" tone="muted" testID="peak-value">
              {L.peakValue}{' '}
              <Txt v="sm" bold>
                {fmtValue(peakV.value)}
              </Txt>{' '}
              · {seasonLabelOf(peakV.row)} {tn(peakV.row.club)}
            </Txt>
          </>
        ) : null}
      </Card>
      {'attrs' in s && !s.retired ? <RetiredNumberGuide s={s} /> : null}
      {rnHint ? (
        <Card>
          <View>
            <Txt v="eyebrow">Next Goals</Txt>
            <Txt v="h2" accessibilityRole="header">
              {L.goalsTitle}
            </Txt>
          </View>
          <Txt v="sm" tone="muted">
            {goalsNote()}
          </Txt>
          <View style={{ gap: 10 }} testID="career-goals">
            {next.map((m, i) => (
              <View key={m.key} style={{ gap: 4 }}>
                <View style={{ gap: 4 }}>
                  <Txt v="sm" style={{ fontWeight: '600' }}>
                    {m.label}
                  </Txt>
                  <Txt v="sm" tone="muted" style={{ fontVariant: ['tabular-nums'] }}>
                    {L.goalLine({ have: m.have, target: m.target, remaining: m.remaining })}
                  </Txt>
                </View>
                <Fill pct={Math.min(100, Math.round((m.have / m.target) * 100))} delay={i * 90} />
              </View>
            ))}
          </View>
        </Card>
      ) : null}
      <Card>
        {s.career.length ? (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} nestedScrollEnabled>
            <View>
              <View style={{ flexDirection: 'row' }}>
                <Th w={COL.season}>{L.colSeason}</Th>
                <Th w={COL.club}>{L.colClub}</Th>
                <Th w={COL.n} n>
                  {L.apps}
                </Th>
                <Th w={COL.n} n>
                  {L.goals}
                </Th>
                <Th w={COL.n} n>
                  {L.assists}
                </Th>
                <Th w={COL.rating} n>
                  {L.colRating}
                </Th>
                <Th w={COL.n} n>
                  {L.colRank}
                </Th>
                <Th w={COL.n} n>
                  OVR
                </Th>
              </View>
              {rows.map((r, i) => {
                const sv = seasonValue(r);
                return (
                  <View key={i} style={{ flexDirection: 'row' }}>
                    <Td w={COL.season}>
                      <Txt style={cell}>
                        {r.mil ? r.year : seasonLabelOf(r)}{' '}
                        <Txt tone="muted" style={cell}>
                          ({r.age})
                        </Txt>
                      </Txt>
                      {r.ch?.length ? (
                        <View
                          style={{
                            alignSelf: 'flex-start',
                            borderRadius: 999,
                            paddingVertical: 2,
                            paddingHorizontal: 6,
                            backgroundColor: alpha(c.accent, 0.22),
                            borderWidth: 1,
                            borderColor: alpha(c.accent, 0.55),
                          }}
                        >
                          <Txt
                            style={{
                              fontSize: rem(0.625),
                              fontWeight: '700',
                              letterSpacing: rem(0.625) * 0.04,
                              color: c.accentText,
                            }}
                          >
                            CH×{r.ch.length}
                          </Txt>
                        </View>
                      ) : null}
                    </Td>
                    <Td w={COL.club}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                        <ClubMark name={r.club} id={r.clubId} />
                        <Txt style={[cell, { flexShrink: 1 }]}>{tn(r.club)}</Txt>
                      </View>
                      <Txt
                        tone="muted"
                        style={{ fontSize: rem(0.6875), lineHeight: rem(0.6875) * 1.5 }}
                      >
                        {tn(r.league)}
                        {sv ? ' · ' : ''}
                        {sv ? (
                          <Txt style={{ fontSize: rem(0.6875), fontWeight: '600' }}>
                            {L.seasonValue({ value: fmtValue(sv) })}
                          </Txt>
                        ) : null}
                        {r.honors.length ? ' · ' : ''}
                        {r.honors.length ? (
                          <Txt
                            style={{
                              fontSize: rem(0.6875),
                              fontWeight: '600',
                              color: c.accentText,
                            }}
                          >
                            {r.honors.map(tn).join(', ')}
                          </Txt>
                        ) : null}
                      </Txt>
                    </Td>
                    <Td w={COL.n}>
                      <Txt style={numCell}>{r.apps}</Txt>
                    </Td>
                    <Td w={COL.n}>
                      <Txt style={numCell}>{r.goals}</Txt>
                    </Td>
                    <Td w={COL.n}>
                      <Txt style={numCell}>{r.assists}</Txt>
                    </Td>
                    <Td w={COL.rating}>
                      <Txt style={numCell}>{r.rating ? r.rating.toFixed(2) : '-'}</Txt>
                    </Td>
                    <Td w={COL.n}>
                      <Txt style={numCell}>{r.rank}</Txt>
                    </Td>
                    <Td w={COL.n}>
                      <Txt style={numCell}>{r.ovr}</Txt>
                    </Td>
                  </View>
                );
              })}
            </View>
          </ScrollView>
        ) : (
          <Txt tone="muted" style={{ fontSize: rem(0.875), paddingVertical: 8 }}>
            {L.emptyRecords}
          </Txt>
        )}
        <Txt v="xs" tone="muted">
          {L.recordsNote}
        </Txt>
      </Card>
      <Card gap={0}>
        <Txt v="eyebrow">Journey</Txt>
        <Txt v="h2" accessibilityRole="header" style={{ marginBottom: 4 }}>
          {L.journeyTitle}
        </Txt>
        {miles.length ? (
          miles.map((m, i) => (
            <View
              key={i}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: 10,
                paddingVertical: 9,
                borderTopWidth: i ? 1 : 0,
                borderTopColor: c.line,
              }}
            >
              <Txt
                tone="muted"
                style={{
                  width: 44,
                  fontFamily: DISPLAY[600],
                  fontSize: rem(1.125),
                }}
              >
                {m.year}
              </Txt>
              <Txt style={{ flex: 1, fontWeight: '700' }}>{m.t}</Txt>
            </View>
          ))
        ) : (
          <Txt tone="muted" style={{ fontSize: rem(0.875), paddingVertical: 8 }}>
            {L.emptyJourney}
          </Txt>
        )}
      </Card>
    </>
  );
}

const cell: TextStyle = { fontSize: rem(0.8125), lineHeight: rem(0.8125) * 1.4 };
const numCell: TextStyle = { ...cell, textAlign: 'right', fontVariant: ['tabular-nums'] };

function Th({ w, n, children }: { w: number; n?: boolean; children: string }) {
  const c = useColors();
  return (
    <View style={{ width: w, padding: 6, borderBottomWidth: 1, borderBottomColor: c.line }}>
      <Txt
        tone="muted"
        style={{
          fontSize: rem(0.75),
          fontWeight: '600',
          textAlign: n ? 'right' : 'left',
        }}
      >
        {children}
      </Txt>
    </View>
  );
}
function Td({ w, children }: { w: number; children: ReactNode }) {
  const c = useColors();
  return (
    <View
      style={{
        width: w,
        paddingVertical: 7,
        paddingHorizontal: 6,
        borderBottomWidth: 1,
        borderBottomColor: c.line,
        gap: 2,
      }}
    >
      {children}
    </View>
  );
}

/** 목표 진행 막대(웹 .legend-bar + fill 0.7s): 처음 그려질 때 왼쪽부터 찬다. */
function Fill({ pct, delay }: { pct: number; delay: number }) {
  const c = useColors();
  const { motionOK } = useSnapshot(prefs);
  const p = useRef(new Animated.Value(motionOK ? 0 : 1)).current;
  useEffect(() => {
    if (!motionOK) return p.setValue(1);
    const a = Animated.timing(p, {
      toValue: 1,
      duration: 700,
      delay,
      easing: Easing.bezier(0.2, 0.8, 0.2, 1),
      useNativeDriver: false,
    });
    a.start();
    return () => a.stop();
  }, [motionOK, delay, p]);
  return (
    <View
      style={{ height: 6, borderRadius: 3, backgroundColor: c.surface2, overflow: 'hidden' }}
      accessibilityRole="progressbar"
      accessibilityValue={{ min: 0, max: 100, now: pct }}
    >
      <Animated.View
        style={{
          height: '100%',
          backgroundColor: c.accent,
          width: p.interpolate({ inputRange: [0, 1], outputRange: ['0%', `${pct}%`] }),
        }}
      />
    </View>
  );
}
