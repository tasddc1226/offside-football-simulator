// 방금 끝난 구간 결과를 시즌 탭 맨 위에서 순서대로 채워 보여 준다(웹 tabs/PhaseReport.svelte, T-10-024) — 경기 결과 점이
// 하나씩 켜지고, 숫자가 올라가고, 순위 변화·하이라이트·능력치 변화가 이어서 나타난다. 동작 줄이기면 즉시.
import { useState } from 'react';
import { Text, View } from 'react-native';
import { useSnapshot } from 'valtio';
import type { PhaseReport as Report } from '@offside/app-core/sheets';
import { Chips } from '../../sheets/Chips';
import { Enter, Pop } from '../../sheets/anim';
import { Hl, StatGrid, mixColor } from '../../sheets/parts';
import { ResBadge, TickerLine } from '../../sheets/TickerLine';
import { cubicOut, useTween } from '../../sheets/useTween';
import { prefs } from '../../store';
import { useColors } from '../../theme/useColors';
import { DISPLAY, fitLine, rem } from '../../theme/type';
import { Card } from '../../ui/Card';
import { Pill } from '../../ui/bits';
import { Press } from '../../ui/Press';
import { Txt } from '../../ui/Txt';
import { NewTitles } from './NewTitles';
import { gameReportText as L } from '@offside/app-core/i18n/ko/gameReport';

const DOT_MS = 60;

/** 점이 다 켜진 뒤(after ms)에 아래에서 8px 올라오며 나타나는 묶음(웹 .rp-later). */
function Later({ after, children }: { after: number; children: React.ReactNode }) {
  return (
    <Enter kind="translateY" from={8} ms={350} delay={after}>
      {children}
    </Enter>
  );
}

export function PhaseReport({ r }: { r: Report }) {
  const c = useColors();
  const { motionOK } = useSnapshot(prefs);
  const [openGames, setOpenGames] = useState(false);
  const dur = (ms: number) => (motionOK ? ms : 0);
  // 점이 다 켜진 뒤에 다음 요소가 나오도록 지연을 잡는다.
  const after = dur(Math.min(r.games.length * DOT_MS, 1200) + 150);
  const rankDelta =
    r.rank.before != null && r.rank.after != null ? r.rank.before - r.rank.after : 0;
  const b = r.block;

  // 숫자는 0에서 카운트업한다. 카드는 리포트마다 key로 새로 마운트되므로 마운트 때 한 번만 목표를 준다.
  const zeros = [0, 0, 0, 0, 0, 0, 0];
  const [w, d, l, apps, goals, col, rating] = useTween(
    b
      ? [b.w, b.d, b.l, b.apps, b.goals, r.back ? b.cs : b.assists, b.rating ? Number(b.rating) : 0]
      : zeros,
    900,
    { from: zeros, ease: cubicOut },
  ) as [number, number, number, number, number, number, number];
  const tally = [
    { key: 'apps', l: L.tallyApps, v: apps.toFixed(0) },
    { key: 'goals', l: L.tallyGoals, v: goals.toFixed(0) },
    { key: 'col', l: r.back ? L.tallyCs : L.tallyAssists, v: col.toFixed(0) },
    { key: 'rating', l: L.tallyRating, v: b?.rating ? rating.toFixed(2) : '-' },
  ];
  const small = { fontSize: rem(1.25), color: c.muted } as const;

  return (
    <Card gap={14} style={{ borderWidth: 1.5, borderColor: mixColor(c.accent, c.line, 45) }}>
      <View
        testID="report"
        accessibilityLabel={r.title}
        style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}
      >
        <View style={{ flex: 1 }}>
          <Txt v="eyebrow">{r.eyebrow}</Txt>
          <Txt v="h2" accessibilityRole="header">
            {r.title}
          </Txt>
        </View>
        {r.rank.after ? (
          <Pill tone={rankDelta > 0 ? 'good' : rankDelta < 0 ? 'bad' : undefined}>
            {`${L.teamRank({ n: r.rank.after })}${rankDelta > 0 ? ` ▲${rankDelta}` : rankDelta < 0 ? ` ▼${-rankDelta}` : ''}`}
          </Pill>
        ) : null}
      </View>

      {b ? (
        <>
          <View
            accessible
            accessibilityLabel={L.dotsLabel({ w: b.w, d: b.d, l: b.l })}
            style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 4 }}
          >
            {r.games.map((m, i) => (
              <Pop key={m.key} ms={300} delay={i * DOT_MS}>
                <ResBadge res={m.res} size="dot" />
              </Pop>
            ))}
          </View>
          <Text
            accessibilityElementsHidden
            importantForAccessibility="no-hide-descendants"
            style={fitLine({
              color: c.ink,
              fontFamily: DISPLAY[700],
              fontSize: rem(2.5),
              lineHeight: rem(2.5),
              fontVariant: ['tabular-nums'],
            })}
          >
            {`${Math.round(w)}`}
            <Text style={small}>{L.win}</Text>
            {` ${Math.round(d)}`}
            <Text style={small}>{L.draw}</Text>
            {` ${Math.round(l)}`}
            <Text style={small}>{L.loss}</Text>
          </Text>
          <StatGrid items={tally.map((x) => ({ key: x.key, l: x.l, v: x.v }))} />
          {b.hl.length ? (
            <Later after={after}>
              <View style={{ gap: 6 }}>
                {b.hl.map((h, i) => (
                  <Hl key={i}>{h}</Hl>
                ))}
              </View>
            </Later>
          ) : null}
        </>
      ) : (
        <Txt tone="muted">
          {`${L.expectedRole} `}
          <Txt style={{ fontWeight: '700' }}>{r.role}</Txt>
        </Txt>
      )}

      {r.comps.length ? (
        <Later after={after}>
          <Txt v="eyebrow" style={{ marginBottom: 6 }}>
            {L.cups}
          </Txt>
          {r.comps.map((x, i) => (
            <View key={i}>
              {x.good ? <Hl>{x.t}</Hl> : <Txt tone="muted">{x.t}</Txt>}
              {(x.games ?? []).map((m, j) => {
                const line = (
                  <Txt v="sm" style={{ paddingLeft: 10 }}>
                    {`${m.line} `}
                    <Txt v="sm" tone="muted">{`· ${m.detail}`}</Txt>
                  </Txt>
                );
                return m.hl ? <Hl key={j}>{line}</Hl> : <View key={j}>{line}</View>;
              })}
            </View>
          ))}
        </Later>
      ) : null}
      {r.nat.map((x, i) => (
        <Later key={i} after={after}>
          {x.called ? (
            <>
              <Txt v="eyebrow" style={{ marginBottom: 6 }}>{`${x.name} · ${x.comp}`}</Txt>
              {x.games.map((m, j) => {
                const line = (
                  <Txt>
                    {`${m.line} `}
                    <Txt tone="muted">{`· ${m.detail}`}</Txt>
                  </Txt>
                );
                return m.hl ? <Hl key={j}>{line}</Hl> : <View key={j}>{line}</View>;
              })}
            </>
          ) : (
            <>
              <Txt v="eyebrow" style={{ marginBottom: 6 }}>
                {x.name}
              </Txt>
              <Txt tone="muted">{L.notCalled}</Txt>
            </>
          )}
        </Later>
      ))}

      {r.titles.length ? (
        <Later after={after}>
          <NewTitles titles={r.titles} pop delay={after} />
        </Later>
      ) : null}

      <Later after={after}>
        <Txt v="eyebrow" style={{ marginBottom: 6 }}>
          {L.changes}
        </Txt>
        {r.chips.length ? (
          <Chips chips={r.chips} pop delay={after} split />
        ) : (
          <Txt tone="muted">{L.noChange}</Txt>
        )}
      </Later>

      {r.games.length ? (
        <View>
          <Press
            testID="report-games-toggle"
            accessibilityState={{ expanded: openGames }}
            onPress={() => setOpenGames(!openGames)}
            style={{ paddingVertical: 4 }}
          >
            <Txt tone="muted" style={{ fontSize: rem(0.8125), fontWeight: '600' }}>
              {`${openGames ? '▾' : '▸'} ${L.gamesSummary({ n: r.games.length })}`}
            </Txt>
          </Press>
          {openGames ? (
            <View style={{ marginTop: 8, gap: 4 }}>
              {r.games.map((m) => (
                <TickerLine key={m.key} m={m} />
              ))}
            </View>
          ) : null}
        </View>
      ) : null}
    </Card>
  );
}
