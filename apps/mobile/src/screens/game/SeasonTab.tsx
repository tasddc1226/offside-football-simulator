// 시즌 탭(웹 tabs/SeasonTab.svelte, T-11-024): 구간 리포트 → 다음 구간 준비(컨디션·훈련·자기 투자) → 시즌 현황(진행 막대·
// 누적 기록·순위표·대회) → 스토리 → 최근 소식 → 버튼. 버튼은 고정 바 없이 탭 맨 아래 한 자리에 둔다 — 이벤트·시즌 결산이
// 대기 중이면 그걸 열고, 아니면 구간을 진행한다. 리포트와 겹치는 숫자·소식은 다시 그리지 않는다.
import { useState, type ReactNode } from 'react';
import { View } from 'react-native';
import { useSnapshot } from 'valtio';
import { PHASES, LAST_PHASE } from '@offside/game/data';
import {
  roundRange,
  leagueOf,
  blockMatches,
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
import type { PhaseReport as PhaseReportData } from '@offside/app-core/sheets';
import { advance, buzz, nextPending, save } from '../../game/host';
import { useTween } from '../../sheets/useTween';
import { appState } from '../../store';
import { useColors } from '../../theme/useColors';
import { DISPLAY, rem } from '../../theme/type';
import { Card } from '../../ui/Card';
import { Opt, Pill } from '../../ui/bits';
import { Btn } from '../../ui/Btn';
import { Txt } from '../../ui/Txt';
import { LeagueTable, SubTitle } from './LeagueTable';
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
 * T-11-024 카드에는 무엇이 오르는지(첫 효과)와 눈여겨볼 한 가지(주력·비용 등)만 두고, 나머지 효과는 고른 카드의 설명 칸에서. */
function ChoiceGrid({ testPrefix, items }: { testPrefix: string; items: Choice[] }) {
  const c = useColors();
  const rows: Choice[][] = [];
  for (let i = 0; i < items.length; i += 3) rows.push(items.slice(i, i + 3));
  return (
    <View style={{ gap: 8 }}>
      {rows.map((row, ri) => (
        <View key={ri} style={{ flexDirection: 'row', gap: 8 }}>
          {row.map((it) => (
            <View key={it.id} testID={`${testPrefix}-${it.id}`} style={{ flex: 1 }}>
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

export function SeasonTab({ s }: { s: GameState }) {
  const c = useColors();
  const { report: rep } = useSnapshot(appState);
  const report = rep && rep.year === s.year ? (rep as PhaseReportData) : null;
  const [feedAll, setFeedAll] = useState(false);
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
  const left = leagueOf(s.leagueId).matches - S.played;
  const btnLabel =
    phase === 0
      ? '프리시즌 훈련 진행'
      : `훈련 후 ${phase >= LAST_PHASE ? left : Math.min(blockMatches(s), left)}경기 진행`;
  // 최근 소식: 리포트에 이미 나온 구간 기록은 빼고 5줄만, '더 보기'로 14줄까지.
  const hide = report ? `${report.year} ${PHASES[report.ph]}` : null;
  const feed = s.log.filter((l) => l.t !== hide).slice(0, FEED_LONG);

  function setTraining(id: string) {
    appState.G!.training = id;
    save();
  }

  function setInvest(id: string) {
    appState.G!.invest = id;
    save();
  }

  const pendingLabel = s.pending?.type === 'event' ? '⚡ 이벤트 확인' : '시즌 결산 보기';

  function onAdvance() {
    buzz();
    void advance();
  }

  function onPending() {
    buzz();
    nextPending();
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
    <>
      {report ? <PhaseReport key={report.key} r={report} /> : null}

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
        <SubTitle>훈련 방향</SubTitle>
        <ChoiceGrid
          testPrefix="train"
          items={TRAININGS.map((tr) => {
            const cd = trainingCard(s, tr);
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
            effect={trainingCard(s, picked).effect}
            body={trainingHelp(s, picked)}
          />
        ) : null}
      </Card>

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
        <ChoiceGrid
          testPrefix="invest"
          items={INVESTS.map((d) => {
            const cd = investCard(s, d);
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
          effect={investCard(s, invest).effect}
          body={investHelp(s, invest)}
        />
      </Card>

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
        <LeagueTable s={s} />
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

      {activeStories.length ? (
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
      ) : null}

      {feed.length ? (
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
      ) : null}
      <View style={{ gap: 8 }}>
        {s.pending ? (
          <Btn block kind="accent" testID="resume" onPress={onPending}>
            {`${pendingLabel} →`}
          </Btn>
        ) : (
          <>
            <Txt tone="muted" center style={{ fontSize: rem(0.8125) }}>
              {'훈련 '}
              <Txt style={{ fontSize: rem(0.8125), fontWeight: '700' }}>
                {picked ? trainingLabel(s, picked) : '-'}
              </Txt>
              {' · 자기 투자 '}
              <Txt style={{ fontSize: rem(0.8125), fontWeight: '700' }}>{invest.label}</Txt>
            </Txt>
            <Btn block kind="primary" testID="advance" onPress={onAdvance}>
              {`${btnLabel} →`}
            </Btn>
          </>
        )}
      </View>
    </>
  );
}
