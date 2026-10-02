import { coachFeedback } from '@offside/app-core/career-feedback';
// 시즌 탭(웹 tabs/SeasonTab.svelte, T-11-025): 구간 리포트 → 다음 구간 준비(컨디션·훈련·자기 투자) → 시즌 현황(진행 막대·
// 누적 기록·순위표·대회) → 스토리 → 최근 소식. 진행·이벤트 확인 버튼은 화면 아래 고정 바(Game.tsx, T-11-036)에 있다.
// 리포트와 겹치는 숫자·소식은 다시 그리지 않는다.
// 새 리포트가 뜨면 아래 카드들을 차례로 비추며 내려가는 결과 안내가 돈다(useResultTour).
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Animated, View, type LayoutChangeEvent } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useSnapshot } from 'valtio';
import { visibleCareerLog } from '@offside/app-core/potential-view';
import { PHASES, LAST_PHASE } from '@offside/game/data';
import {
  roundRange,
  logLabel,
  TRAININGS,
  trainingLabel,
  trainingCard,
  trainingHelp,
  INVESTS,
  investCard,
  investHelp,
  investDef,
  fmtMoney,
  STORIES,
  turnNo,
} from '@offside/game/engine';
import { eventById } from '@offside/game/events-data';
import type { GameState } from '@offside/game/types';
import { seasonLabel } from '@offside/app-core/career';
import {
  RESULT_TOUR,
  TOUR_PICK_MS,
  TOUR_RANK_DELAY,
  TOUR_RANK_MS,
  type TourGate,
  type TourSpot,
} from '@offside/app-core/resultTour';
import type { PhaseReport as PhaseReportData } from '@offside/app-core/sheets';
import { save } from '../../game/host';
import { useTween } from '../../sheets/useTween';
import { appState, prefs } from '../../store';
import { alpha } from '../../theme/colors';
import { useColors } from '../../theme/useColors';
import { DISPLAY, rem } from '../../theme/type';
import { Card } from '../../ui/Card';
import { Opt, Pill } from '../../ui/bits';
import { Btn } from '../../ui/Btn';
import { scrollTo, scrollY, viewH } from '../../ui/scroll';
import { Txt } from '../../ui/Txt';
import { LeagueTable, SubTitle, type RankPlay } from './LeagueTable';
import { PhaseReport } from './PhaseReport';

function meterTone(v: number, badAt: number, warnAt: number): 'bad' | 'warn' | 'good' {
  return v < badAt ? 'bad' : v < warnAt ? 'warn' : 'good';
}

/** 컨디션·사기·인기 막대(웹 .meter: 이름 54 · 막대 · 값 34). 값이 바뀌면 막대가 0.4초 동안 따라간다. */
function Meter({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: 'good' | 'warn' | 'bad' | 'acc';
}) {
  const c = useColors();
  const pct = Math.min(100, Math.round(value));
  const [w] = useTween([pct], 400);
  const fill = tone === 'acc' ? c.accent : c[tone];
  return (
    <View
      accessible
      accessibilityLabel={`${label} ${Math.round(value)}`}
      style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}
    >
      <Txt style={{ width: 54, fontSize: rem(0.8125) }}>{label}</Txt>
      <View
        style={{
          flex: 1,
          height: 8,
          backgroundColor: c.surface2,
          borderRadius: 4,
          overflow: 'hidden',
          borderWidth: 1,
          borderColor: c.line,
        }}
      >
        <View style={{ width: `${w}%`, height: '100%', borderRadius: 4, backgroundColor: fill }} />
      </View>
      <Txt style={{ width: 34, textAlign: 'right', fontFamily: DISPLAY[600], fontSize: rem(1) }}>
        {Math.round(value)}
      </Txt>
    </View>
  );
}

/** 이름 · (점/문구) · (문구) 한 줄(웹 .story-row: 위에 구분선). */
function StoryRow({ children }: { children: ReactNode }) {
  const c = useColors();
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        paddingVertical: 9,
        borderTopWidth: 1,
        borderTopColor: c.line,
      }}
    >
      {children}
    </View>
  );
}
const RowMuted = ({ children }: { children: ReactNode }) => (
  <Txt
    tone="muted"
    style={{ fontSize: rem(0.75), minWidth: 64, textAlign: 'right', flexShrink: 1 }}
  >
    {children}
  </Txt>
);

// T-11-025 결과 안내(웹 SeasonTab tour): 중계 시트를 닫고 새 리포트가 뜨면, 리포트를 읽을 시간을 준 뒤 아래 카드들을
// 차례로 화면 위쪽에 맞춰 부드럽게 내려가며 잠깐씩 테두리를 두르고, 최근 소식에서 멈춘다(T-11-036 진행 버튼은 아래 고정 바라
// 'go' 단계는 자리를 등록하지 않아 건너뛴다). 훈련·자기 투자 카드에서는
// 사용자가 하나를 고를 때까지 기다렸다가(고른 카드가 톡 튄다) 넘어가고, 시즌 현황에서는 순위표의 내 팀 순위 변동을
// 움직여 보여 준다. 기다리는 카드 밖의 단계에서 화면을 만지면 바로 그만둔다. 동작 줄이기면 돌지 않는다.
/** 안내를 이미 돈 리포트 — 탭을 오가며 다시 마운트돼도 한 리포트에 한 번만. */
let touredKey = 0;

interface Tour {
  /** 화면을 만졌다(고르기를 기다리는 중이 아니면 그만둔다). */
  touch: () => void;
  pick: (g: TourGate) => void;
}

function useResultTour(report: PhaseReportData | null) {
  const { motionOK } = useSnapshot(prefs);
  const insets = useSafeAreaInsets();
  const views = useRef<Partial<Record<TourSpot, View | null>>>({});
  const tour = useRef<Tour | null>(null);
  const [spot, setSpot] = useState<TourSpot | null>(null);
  const [wait, setWait] = useState<TourGate | null>(null);
  const [rankPlay, setRankPlay] = useState<RankPlay | null>(null);

  useEffect(() => {
    const k = report?.key;
    if (!report || !k || k === touredKey) return;
    touredKey = k;
    if (!motionOK) return;
    const timers: ReturnType<typeof setTimeout>[] = [];
    const later = (fn: () => void, ms: number) => void timers.push(setTimeout(fn, ms));
    let waiting: TourGate | null = null;
    let alive = true;
    const stop = () => {
      alive = false;
      timers.forEach(clearTimeout);
      waiting = null;
      tour.current = null;
      setSpot(null);
      setWait(null);
    };
    const steps = RESULT_TOUR.filter(([k]) => views.current[k]);
    const go = (i: number) => {
      if (i >= steps.length) return stop();
      const [k, w] = steps[i]!;
      const gate = typeof w !== 'number';
      if (i)
        views.current[k]?.measureInWindow((_x, y, _w, h) => {
          if (!alive) return;
          let to = scrollY() + y - insets.top - 12;
          // 고르기를 기다리는 카드가 화면보다 길면 선택지·설명이 있는 아래쪽이 보이게 바닥에 맞춘다.
          if (gate) to = Math.max(to, scrollY() + y + h - (viewH() - 12));
          scrollTo(Math.max(0, to), true);
        });
      setSpot(k);
      if (gate) {
        waiting = w;
        setWait(w);
        return;
      }
      let ms = w;
      const { before, after } = report.rank;
      if (k === 'status' && before != null && before !== after) {
        later(() => setRankPlay({ before, key: report.key }), TOUR_RANK_DELAY);
        ms += TOUR_RANK_MS;
      }
      later(() => go(i + 1), ms);
    };
    tour.current = {
      touch: () => void (waiting || stop()),
      pick: (g) => {
        if (g !== waiting) return;
        waiting = null;
        setWait(null);
        const i = steps.findIndex(([k]) => k === (g === 'train' ? 'prep' : 'invest'));
        later(() => go(i + 1), TOUR_PICK_MS);
      },
    };
    go(0);
    return stop;
    // 새 리포트(key)마다 한 번만 돈다.
  }, [report?.key]);

  /** Spotlight에 넘길 등록 함수 — 안내가 스크롤해 갈 카드 자리를 재 둔다. */
  const reg = (id: TourSpot) => (v: View | null) => void (views.current[id] = v);
  return { spot, wait, rankPlay, tour, reg };
}

/** 안내가 비추는 카드 감싸개 — 자리를 등록하고, 지금 비추는 카드면 바깥에 강조 테두리를 두른다(웹 [data-tour-spot]). */
function Spotlight({
  reg,
  on,
  onLayout,
  children,
}: {
  reg: (v: View | null) => void;
  on: boolean;
  onLayout?: (e: LayoutChangeEvent) => void;
  children: ReactNode;
}) {
  const c = useColors();
  return (
    <View
      ref={reg}
      collapsable={false}
      onLayout={onLayout}
      style={{
        margin: -5,
        padding: 3,
        borderWidth: 2,
        borderRadius: 21,
        borderColor: on ? c.accent : 'transparent',
      }}
    >
      {children}
    </View>
  );
}

/** 고르기를 기다리는 카드의 안내 줄(웹 .tour-hint). */
function TourHint({ children }: { children: string }) {
  const c = useColors();
  return (
    <View
      accessibilityLiveRegion="polite"
      style={{
        paddingVertical: 6,
        paddingHorizontal: 10,
        borderRadius: 10,
        backgroundColor: alpha(c.accent, 0.14),
      }}
    >
      <Txt style={{ fontSize: rem(0.8125), fontWeight: '700', color: c.accentText }}>
        {children}
      </Txt>
    </View>
  );
}

/** 고른 선택지가 톡 튄다(웹 .opt[data-picked] — 0.96배로 눌렸다가 1.03배로 튀고 제자리로). */
function PickPop({ on, children }: { on: boolean; children: ReactNode }) {
  const v = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    if (!on) return;
    const a = Animated.sequence([
      Animated.timing(v, { toValue: 0.96, duration: 180, useNativeDriver: true }),
      Animated.timing(v, { toValue: 1.03, duration: 180, useNativeDriver: true }),
      Animated.timing(v, { toValue: 1, duration: 240, useNativeDriver: true }),
    ]);
    a.start();
    return () => a.stop();
  }, [on, v]);
  return <Animated.View style={{ flex: 1, transform: [{ scale: v }] }}>{children}</Animated.View>;
}

interface Choice {
  id: string;
  label: string;
  effect: string[];
  tag: string;
  selected: boolean;
  disabled?: boolean;
  onPress: () => void;
}

/** 훈련·자기 투자 선택지(웹 .train grid 3열) — 3개씩 끊어 줄로 그리고, 모자란 칸은 빈 칸으로 폭을 맞춘다.
 * T-11-025 카드에는 무엇이 오르는지(첫 효과)와 눈여겨볼 한 가지(주력·비용 등)만 두고, 나머지 효과는 고른 카드의 설명 칸에서. */
function ChoiceGrid({
  testPrefix,
  items,
  popped,
}: {
  testPrefix: string;
  items: Choice[];
  /** 방금 고른 선택지(안내가 고르기를 기다리던 중에 고른 것만) — 톡 튀는 효과를 준다. */
  popped?: string | null;
}) {
  const c = useColors();
  const rows: Choice[][] = [];
  for (let i = 0; i < items.length; i += 3) rows.push(items.slice(i, i + 3));
  return (
    <View style={{ gap: 8 }}>
      {rows.map((row, ri) => (
        <View key={ri} style={{ flexDirection: 'row', gap: 8 }}>
          {row.map((it) => (
            <View key={it.id} testID={`${testPrefix}-${it.id}`} style={{ flex: 1 }}>
              <PickPop on={popped === it.id}>
                <Opt
                  selected={it.selected}
                  disabled={it.disabled}
                  onPress={it.onPress}
                  style={{
                    flex: 1,
                    paddingVertical: it.selected ? 7.5 : 9,
                    paddingHorizontal: it.selected ? 8.5 : 10,
                  }}
                >
                  <Txt style={{ fontSize: rem(0.875), fontWeight: '700' }}>{it.label}</Txt>
                  <Txt tone="muted" style={{ fontSize: rem(0.75), lineHeight: rem(0.75) * 1.35 }}>
                    {it.effect[0]}
                  </Txt>
                  {it.tag ? (
                    <Txt
                      style={{
                        fontSize: rem(0.75),
                        lineHeight: rem(0.75) * 1.35,
                        fontWeight: '600',
                        color: c.accentText,
                      }}
                    >
                      {it.tag}
                    </Txt>
                  ) : null}
                </Opt>
              </PickPop>
            </View>
          ))}
          {Array.from({ length: 3 - row.length }).map((_, i) => (
            <View key={`pad-${i}`} style={{ flex: 1 }} />
          ))}
        </View>
      ))}
    </View>
  );
}

/** 고른 선택지의 자세한 설명(웹 .train-help) — 제목 옆에 효과 전체를 붙인다. */
function HelpBox({
  testID,
  title,
  effect,
  body,
}: {
  testID: string;
  title: string;
  effect: string[];
  body: string;
}) {
  const c = useColors();
  return (
    <View
      testID={testID}
      accessibilityLiveRegion="polite"
      style={{
        gap: 4,
        paddingVertical: 10,
        paddingHorizontal: 12,
        borderRadius: 10,
        backgroundColor: c.surface2,
      }}
    >
      <Txt style={{ fontSize: rem(0.8125), lineHeight: rem(0.8125) * 1.5, fontWeight: '700' }}>
        {title}
        <Txt tone="muted" style={{ fontSize: rem(0.8125), fontWeight: '700' }}>
          {` · ${effect.join(' · ')}`}
        </Txt>
      </Txt>
      <Txt style={{ fontSize: rem(0.8125), lineHeight: rem(0.8125) * 1.5 }}>{body}</Txt>
    </View>
  );
}

const FEED_SHORT = 5;
const FEED_LONG = 14;

/** onPrepY: '다음 구간 준비' 카드가 탭 맨 위에서 떨어진 거리 — 아래 고정 바의 준비 요약을 누르면 Game이 그리로 스크롤한다. */
export function SeasonTab({ s, onPrepY }: { s: GameState; onPrepY?: (y: number) => void }) {
  const c = useColors();
  const { report: rep } = useSnapshot(appState);
  const report = rep && rep.year === s.year ? (rep as PhaseReportData) : null;
  const [feedAll, setFeedAll] = useState(false);
  const coach = coachFeedback(s);
  const S = s.season;
  const avg = S.apps ? (S.ratingSum / S.apps).toFixed(2) : '-';
  const phase = Math.min(s.phase, LAST_PHASE);
  const label = phase === 0 ? '프리시즌' : `${PHASES[phase]} · ${roundRange(s, phase)}`;
  const back = s.pos === 'GK' || s.pos === 'DF';
  const lastCol = (back ? ['무실점', S.cs] : ['도움', S.assists]) as [string, number];
  const comps = s.season.comps || [];
  const activeStories = Object.entries(s.story || {}).filter(([, v]) => !v.done);
  const t = turnNo(s);
  const picked = TRAININGS.find((x) => x.id === s.training);
  const invest = investDef(s);
  // 리포트가 개막 후 첫 구간이면 시즌 누적 = 구간 기록이라 누적 칸을 숨긴다. 개막 전(0경기)에도 숨긴다.
  const showTotals = S.played > 0 && !(report?.block && S.played === report.games.length);
  // 최근 소식: 리포트에 이미 나온 구간 기록은 빼고 5줄만, '더 보기'로 14줄까지.
  const hide = report ? logLabel(report.year, report.ph) : null;
  const feed = visibleCareerLog(s.log)
    .filter((l) => l.t !== hide)
    .slice(0, FEED_LONG);
  // 안내가 단계마다 탭을 다시 그리므로 선택지 카드 계산은 게임 상태가 바뀔 때만 한다(설명 칸도 같은 값을 쓴다).
  const trainCards = useMemo(
    () => new Map(TRAININGS.map((tr) => [tr.id, trainingCard(s, tr)])),
    [s],
  );
  const investCards = useMemo(() => new Map(INVESTS.map((d) => [d.id, investCard(s, d)])), [s]);
  const { spot, wait, rankPlay, tour, reg } = useResultTour(report);
  const [popped, setPopped] = useState<{ g: TourGate; id: string } | null>(null);

  function pick(g: TourGate, id: string) {
    if (wait === g) {
      setPopped({ g, id });
      setTimeout(() => setPopped(null), TOUR_PICK_MS);
    }
    tour.current?.pick(g);
  }

  function setTraining(id: string) {
    appState.G!.training = id;
    save();
    pick('train', id);
  }

  function setInvest(id: string) {
    appState.G!.invest = id;
    save();
    pick('invest', id);
  }

  function waitText(k: string): string {
    const ch = (s.chains || []).find((x) => {
      const e = eventById(x.id);
      return e && e.story === k;
    });
    if (!ch) return '';
    return ch.at <= t ? '곧 이어짐' : `약 ${ch.at - t}구간 후`;
  }

  return (
    <View style={{ gap: 14 }} onTouchStart={() => tour.current?.touch()}>
      {report ? (
        <Spotlight reg={reg('report')} on={spot === 'report'}>
          <PhaseReport key={report.key} r={report} />
        </Spotlight>
      ) : null}

      <Spotlight
        reg={reg('prep')}
        on={spot === 'prep'}
        onLayout={(e) => onPrepY?.(e.nativeEvent.layout.y)}
      >
        <Card gap={10}>
          <View>
            <Txt v="eyebrow">{`Next · ${label}`}</Txt>
            <Txt v="h2" accessibilityRole="header">
              다음 구간 준비
            </Txt>
          </View>
          <View style={{ gap: 9 }}>
            <Meter label="컨디션" value={s.cond} tone={meterTone(s.cond, 40, 65)} />
            <Meter label="사기" value={s.morale} tone={meterTone(s.morale, 40, 60)} />
            <Meter label="인기" value={s.fame} tone="acc" />
          </View>
          <View style={{ gap: 6 }} testID="coach-feedback">
            <SubTitle>코치 메모</SubTitle>
            <Txt v="sm">{coach.summary}</Txt>
            {coach.notes.map((note) => (
              <Txt key={note} v="sm" tone="muted">
                {note}
              </Txt>
            ))}
          </View>
          <SubTitle>훈련 방향</SubTitle>
          {wait === 'train' ? <TourHint>이번 구간 훈련을 고르면 다음으로 넘어가요</TourHint> : null}
          <ChoiceGrid
            testPrefix="train"
            popped={popped?.g === 'train' ? popped.id : null}
            items={TRAININGS.map((tr) => {
              const cd = trainCards.get(tr.id)!;
              return {
                id: tr.id,
                label: trainingLabel(s, tr),
                effect: cd.effect,
                tag: cd.tag,
                selected: s.training === tr.id,
                onPress: () => setTraining(tr.id),
              };
            })}
          />
          {picked ? (
            <HelpBox
              testID="train-help"
              title={trainingLabel(s, picked)}
              effect={trainCards.get(picked.id)!.effect}
              body={trainingHelp(s, picked)}
            />
          ) : null}
        </Card>
      </Spotlight>

      <Spotlight reg={reg('invest')} on={spot === 'invest'}>
        <Card gap={10}>
          <View
            style={{
              flexDirection: 'row',
              justifyContent: 'space-between',
              alignItems: 'center',
              gap: 10,
            }}
          >
            <View style={{ flex: 1 }}>
              <Txt v="eyebrow">Invest</Txt>
              <Txt v="h2" accessibilityRole="header">
                자기 투자
              </Txt>
            </View>
            <Pill>{`보유 ${fmtMoney(s.money)}원`}</Pill>
          </View>
          {wait === 'invest' ? (
            <TourHint>투자를 고르면 넘어가요 · 아끼려면 투자 안 함</TourHint>
          ) : null}
          <ChoiceGrid
            testPrefix="invest"
            popped={popped?.g === 'invest' ? popped.id : null}
            items={INVESTS.map((d) => {
              const cd = investCards.get(d.id)!;
              return {
                id: d.id,
                label: d.label,
                effect: cd.effect,
                tag: cd.tag,
                selected: invest.id === d.id,
                disabled: !cd.affordable,
                onPress: () => setInvest(d.id),
              };
            })}
          />
          <HelpBox
            testID="invest-help"
            title={invest.label}
            effect={investCards.get(invest.id)!.effect}
            body={investHelp(s, invest)}
          />
        </Card>
      </Spotlight>

      <Spotlight reg={reg('status')} on={spot === 'status'}>
        <Card gap={14}>
          <View>
            <Txt v="eyebrow">{`${seasonLabel(s)} Season`}</Txt>
            <Txt v="h2" accessibilityRole="header">
              {label}
            </Txt>
            <View style={{ flexDirection: 'row', gap: 4, marginTop: 10 }}>
              {[0, 1, 2].map((i) => (
                <View
                  key={i}
                  style={{
                    flex: 1,
                    height: 6,
                    borderRadius: 3,
                    backgroundColor: i < phase ? c.pitch2 : i === phase ? c.accent : c.line,
                  }}
                />
              ))}
            </View>
            <View style={{ flexDirection: 'row', gap: 4, marginTop: 4 }}>
              {['프리시즌', '전반기', '후반기'].map((tl) => (
                <Txt key={tl} tone="muted" center style={{ flex: 1, fontSize: rem(0.6875) }}>
                  {tl}
                </Txt>
              ))}
            </View>
          </View>
          {showTotals ? (
            <Txt testID="season-totals" tone="muted" style={{ fontSize: rem(0.8125) }}>
              {`시즌 누적 · ${S.w}승 ${S.d}무 ${S.l}패 · 출전 ${S.apps} · ${S.goals}골 · ${lastCol[0]} ${lastCol[1]} · 평점 ${avg}`}
            </Txt>
          ) : null}
          <LeagueTable s={s} play={rankPlay} />
          {comps.length ? (
            <View>
              <SubTitle>이번 시즌 대회</SubTitle>
              {comps.map((cp) => (
                <StoryRow key={cp.name}>
                  <Txt style={{ flex: 1, fontSize: rem(0.875), fontWeight: '700' }}>{cp.name}</Txt>
                  <RowMuted>
                    {`${cp.stage || (cp.type === 'super' ? '개막 전 단판' : '1구간 시작')}${cp.alive && cp.stage ? ' · 진행 중' : ''}`}
                  </RowMuted>
                  <RowMuted>{`${cp.apps}경기 ${cp.g}골`}</RowMuted>
                </StoryRow>
              ))}
            </View>
          ) : null}
        </Card>
      </Spotlight>

      {activeStories.length ? (
        <Spotlight reg={reg('stories')} on={spot === 'stories'}>
          <Card gap={0}>
            <Txt v="eyebrow">Storylines</Txt>
            <Txt v="h2" accessibilityRole="header" style={{ marginBottom: 6 }}>
              진행 중인 스토리
            </Txt>
            {activeStories.map(([k, v]) => (
              <StoryRow key={k}>
                <Txt style={{ flex: 1, fontSize: rem(0.875), fontWeight: '700' }}>
                  {STORIES[k]!.name}
                </Txt>
                <View style={{ flexDirection: 'row', gap: 4 }}>
                  {Array.from({ length: STORIES[k]!.total }).map((_, i) => (
                    <View
                      key={i}
                      style={{
                        width: 18,
                        height: 6,
                        borderRadius: 3,
                        backgroundColor: i < v.stage ? c.accent : c.line,
                      }}
                    />
                  ))}
                </View>
                <RowMuted>{waitText(k)}</RowMuted>
              </StoryRow>
            ))}
          </Card>
        </Spotlight>
      ) : null}

      {feed.length ? (
        <Spotlight reg={reg('feed')} on={spot === 'feed'}>
          <Card gap={0}>
            <Txt v="eyebrow">Timeline</Txt>
            <Txt v="h2" accessibilityRole="header" style={{ marginBottom: 6 }}>
              최근 소식
            </Txt>
            <View>
              {(feedAll ? feed : feed.slice(0, FEED_SHORT)).map((l, i) => (
                <View
                  key={i}
                  style={{
                    flexDirection: 'row',
                    gap: 8,
                    paddingVertical: 8,
                    borderTopWidth: i ? 1 : 0,
                    borderTopColor: c.line,
                  }}
                >
                  <Txt
                    tone="muted"
                    style={{
                      width: 76,
                      fontFamily: DISPLAY[400],
                      fontSize: rem(0.75),
                      letterSpacing: rem(0.75) * 0.03,
                    }}
                  >
                    {l.t}
                  </Txt>
                  <Txt
                    style={{
                      flex: 1,
                      fontSize: rem(0.8125),
                      lineHeight: rem(0.8125) * 1.5,
                      fontWeight: l.kind === 'big' ? '600' : '400',
                      color: l.kind === 'good' ? c.good : l.kind === 'bad' ? c.bad : c.ink,
                    }}
                  >
                    {l.text}
                  </Txt>
                </View>
              ))}
            </View>
            {feed.length > FEED_SHORT ? (
              <Btn
                sm
                testID="feed-more"
                accessibilityLabel={feedAll ? '최근 소식 접기' : '최근 소식 더 보기'}
                onPress={() => setFeedAll(!feedAll)}
                style={{ alignSelf: 'flex-start', marginTop: 8 }}
              >
                {feedAll ? '접기' : '더 보기'}
              </Btn>
            ) : null}
          </Card>
        </Spotlight>
      ) : null}
    </View>
  );
}
