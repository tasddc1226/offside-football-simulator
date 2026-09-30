// 시즌 탭(웹 tabs/SeasonTab.svelte): 구간 리포트 · 시즌 진행 카드 · 순위표 · 컨디션/사기/인기 · 대회 · 스토리 · 훈련 · 최근 소식.
// 진행 버튼은 화면 아래 고정 액션바(Game)에 있다.
import { Fragment, type ReactNode } from 'react';
import { View } from 'react-native';
import { useSnapshot } from 'valtio';
import { PHASES, LAST_PHASE } from '@offside/game/data';
import {
  teamRank,
  roundRange,
  TRAININGS,
  trainingLabel,
  trainingCard,
  trainingHelp,
  TRAINING_NOTE,
  STORIES,
  turnNo,
} from '@offside/game/engine';
import { eventById } from '@offside/game/events-data';
import type { GameState } from '@offside/game/types';
import { seasonLabel } from '@offside/app-core/career';
import type { PhaseReport as PhaseReportData } from '@offside/app-core/sheets';
import { save } from '../../game/host';
import { StatGrid } from '../../sheets/parts';
import { useTween } from '../../sheets/useTween';
import { appState } from '../../store';
import { useColors } from '../../theme/useColors';
import { DISPLAY, rem } from '../../theme/type';
import { Card } from '../../ui/Card';
import { Opt, Pill } from '../../ui/bits';
import { Txt } from '../../ui/Txt';
import { LeagueTable } from './LeagueTable';
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

export function SeasonTab({ s }: { s: GameState }) {
  const c = useColors();
  const { report } = useSnapshot(appState);
  const S = s.season;
  const avg = S.apps ? (S.ratingSum / S.apps).toFixed(2) : '-';
  const rank = teamRank(s);
  const phase = Math.min(s.phase, LAST_PHASE);
  const label = phase === 0 ? '프리시즌' : `${PHASES[phase]} · ${roundRange(s, phase)}`;
  const back = s.pos === 'GK' || s.pos === 'DF';
  const lastCol = (back ? ['무실점', S.cs] : ['도움', S.assists]) as [string, number];
  const comps = s.season.comps || [];
  const activeStories = Object.entries(s.story || {}).filter(([, v]) => !v.done);
  const t = turnNo(s);
  const picked = TRAININGS.find((x) => x.id === s.training);

  function setTraining(id: string) {
    appState.G!.training = id;
    save();
  }

  function waitText(k: string): string {
    const ch = (s.chains || []).find((x) => {
      const e = eventById(x.id);
      return e && e.story === k;
    });
    if (!ch) return '';
    return ch.at <= t ? '곧 이어짐' : `약 ${ch.at - t}구간 후`;
  }

  // 훈련 선택지는 웹 grid 3열 — 3개씩 끊어 줄로 그린다.
  const trainRows: (typeof TRAININGS)[] = [];
  for (let i = 0; i < TRAININGS.length; i += 3) trainRows.push(TRAININGS.slice(i, i + 3));

  return (
    <>
      {report && report.year === s.year ? (
        <PhaseReport key={report.key} r={report as PhaseReportData} />
      ) : null}

      <Card gap={0}>
        <View
          style={{
            flexDirection: 'row',
            justifyContent: 'space-between',
            alignItems: 'center',
            gap: 10,
          }}
        >
          <View style={{ flex: 1 }}>
            <Txt v="eyebrow">{`${seasonLabel(s)} Season`}</Txt>
            <Txt v="h2" accessibilityRole="header">
              {label}
            </Txt>
          </View>
          <Pill>{`${rank ? `팀 ${rank}위` : '개막 전'} · ${S.w}승 ${S.d}무 ${S.l}패`}</Pill>
        </View>
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
        <StatGrid
          mt={14}
          items={[
            { key: 'apps', v: S.apps, l: '출전' },
            { key: 'goals', v: S.goals, l: '골' },
            { key: 'third', v: back ? S.assists : S.starts, l: back ? '도움' : '선발' },
            { key: 'last', v: lastCol[1], l: lastCol[0] },
            { key: 'avg', v: avg, l: '평점' },
          ]}
        />
      </Card>

      <LeagueTable s={s} />

      <Card gap={9}>
        <Meter label="컨디션" value={s.cond} tone={meterTone(s.cond, 40, 65)} />
        <Meter label="사기" value={s.morale} tone={meterTone(s.morale, 40, 60)} />
        <Meter label="인기" value={s.fame} tone="acc" />
      </Card>

      {comps.length ? (
        <Card gap={0}>
          <Txt v="eyebrow">Competitions</Txt>
          <Txt v="h2" accessibilityRole="header" style={{ marginBottom: 6 }}>
            이번 시즌 대회
          </Txt>
          {comps.map((cp) => (
            <StoryRow key={cp.name}>
              <Txt style={{ flex: 1, fontSize: rem(0.875), fontWeight: '700' }}>{cp.name}</Txt>
              <RowMuted>
                {`${cp.stage || (cp.type === 'super' ? '개막 전 단판' : '1구간 시작')}${cp.alive && cp.stage ? ' · 진행 중' : ''}`}
              </RowMuted>
              <RowMuted>{`${cp.apps}경기 ${cp.g}골`}</RowMuted>
            </StoryRow>
          ))}
        </Card>
      ) : null}

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

      <Card gap={10}>
        <View>
          <Txt v="eyebrow">Training</Txt>
          <Txt v="h2" accessibilityRole="header">
            이번 구간 훈련 방향
          </Txt>
        </View>
        <View style={{ gap: 8 }}>
          {trainRows.map((row, ri) => (
            <View key={ri} style={{ flexDirection: 'row', gap: 8 }}>
              {row.map((tr) => {
                const cd = trainingCard(s, tr);
                const on = s.training === tr.id;
                return (
                  <View key={tr.id} testID={`train-${tr.id}`} style={{ flex: 1 }}>
                    <Opt
                      selected={on}
                      onPress={() => setTraining(tr.id)}
                      style={{
                        flex: 1,
                        paddingVertical: on ? 7.5 : 9,
                        paddingHorizontal: on ? 8.5 : 10,
                      }}
                    >
                      <Txt style={{ fontSize: rem(0.875), fontWeight: '700' }}>
                        {trainingLabel(s, tr)}
                      </Txt>
                      <Txt
                        tone="muted"
                        style={{ fontSize: rem(0.75), lineHeight: rem(0.75) * 1.35 }}
                      >
                        {cd.effect.map((part, i) => (
                          <Fragment key={i}>
                            {i ? ' · ' : ''}
                            {part}
                          </Fragment>
                        ))}
                      </Txt>
                      {cd.tag ? (
                        <Txt
                          style={{
                            fontSize: rem(0.75),
                            lineHeight: rem(0.75) * 1.35,
                            fontWeight: '600',
                            color: c.accentText,
                          }}
                        >
                          {cd.tag}
                        </Txt>
                      ) : null}
                    </Opt>
                  </View>
                );
              })}
              {/* 마지막 줄이 모자라면 칸 폭을 맞추려 빈 칸으로 채운다. */}
              {Array.from({ length: 3 - row.length }).map((_, i) => (
                <View key={`pad-${i}`} style={{ flex: 1 }} />
              ))}
            </View>
          ))}
        </View>
        {picked ? (
          <View
            testID="train-help"
            accessibilityLiveRegion="polite"
            style={{
              gap: 4,
              paddingVertical: 10,
              paddingHorizontal: 12,
              borderRadius: 10,
              backgroundColor: c.surface2,
            }}
          >
            <Txt
              style={{ fontSize: rem(0.8125), lineHeight: rem(0.8125) * 1.5, fontWeight: '700' }}
            >
              {trainingLabel(s, picked)}
            </Txt>
            <Txt style={{ fontSize: rem(0.8125), lineHeight: rem(0.8125) * 1.5 }}>
              {trainingHelp(s, picked)}
            </Txt>
            <Txt tone="muted" style={{ fontSize: rem(0.75) }}>
              {TRAINING_NOTE}
            </Txt>
          </View>
        ) : null}
        <Txt tone="muted" style={{ fontSize: rem(0.75) }}>
          진행 버튼은 화면 아래 고정 액션바에 있습니다.
        </Txt>
      </Card>

      <Card gap={0}>
        <Txt v="eyebrow">Timeline</Txt>
        <Txt v="h2" accessibilityRole="header" style={{ marginBottom: 6 }}>
          최근 소식
        </Txt>
        <View>
          {s.log.slice(0, 14).map((l, i) => (
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
      </Card>
    </>
  );
}
