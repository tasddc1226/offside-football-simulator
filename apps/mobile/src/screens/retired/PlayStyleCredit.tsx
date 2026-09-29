// 은퇴 리포트의 '플레이 성향' 장면(웹 PlayStyleCredit.svelte, T-10-077) — 커리어 내내 유저가 한 선택으로 뽑은 유형 ·
// 주사위 기록 · 커리어 최고의 한 수. 선택 기록이 없는 옛 은퇴는 그리지 않는다.
import { View } from 'react-native';
import { styleReport } from '@offside/game/playStyleReport';
import type { LegendSource } from '@offside/game/types';
import { luckNote, luckText, pct } from '@offside/app-core/legendReport';
import { rem } from '../../theme/type';
import { Reveal } from './credit';
import { FilmPill, FText, H2, Kicker, useFilm } from './film';

export function PlayStyleCredit({ d }: { d: LegendSource }) {
  const f = useFilm();
  const r = styleReport(d.style, d.career);
  if (!r) return null;
  const cells: { b: string; up?: boolean; label: string; small: string }[] = [
    {
      b: String(r.bets),
      label: '주사위를 굴린 선택',
      small: `성공 ${r.betWins}번 · ${pct(r.betWins, r.bets)}%`,
    },
    { b: luckText(r.luck), up: r.luck > 0, label: '운', small: luckNote(r.luck) },
    { b: String(r.longshots), label: '40% 이하 승부수', small: `${r.longshotWins}번 적중` },
    {
      b: String(r.moves),
      label: '이적',
      small: `${r.tierUp ? `윗 리그로 ${r.tierUp}번` : '—'}${r.snubUp ? ` · 빅클럽 거절 ${r.snubUp}번` : ''}`,
    },
  ];
  return (
    <Reveal testID="credit-style">
      <View testID={`legend-style-${r.type.key}`} style={{ alignItems: 'center', gap: 18 }}>
        <View style={{ alignItems: 'center' }}>
          <Kicker>How You Played</Kicker>
          <H2>플레이 성향</H2>
        </View>
        <View style={{ alignItems: 'center', gap: 6 }}>
          <FText size={3.5} lh={1} accessibilityElementsHidden importantForAccessibility="no">
            {r.type.icon}
          </FText>
          <FText tone="gold" bold size={1.625} testID="style-name">
            {r.type.name}
          </FText>
          <FText tone="muted" size={0.9375} center style={{ marginBottom: 4 }}>
            {r.type.line}
          </FText>
          {r.also.length ? (
            <View
              style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 6 }}
            >
              {r.also.map((t) => (
                <FilmPill key={t.key}>{`${t.icon} ${t.name}`}</FilmPill>
              ))}
            </View>
          ) : null}
        </View>
        <View
          style={{
            alignSelf: 'stretch',
            flexDirection: 'row',
            flexWrap: 'wrap',
            borderTopWidth: 1,
            borderBottomWidth: 1,
            borderColor: f.line,
            paddingVertical: 18,
            rowGap: 18,
          }}
        >
          {cells.map((cell) => (
            <View key={cell.label} style={{ width: '50%', alignItems: 'center', gap: 1 }}>
              <FText tone={cell.up ? 'gold' : 'ink'} display={700} size={2} lh={1.05}>
                {cell.b}
              </FText>
              <FText size={0.8125} center>
                {cell.label}
              </FText>
              <FText tone="muted" size={0.75} center>
                {cell.small}
              </FText>
            </View>
          ))}
        </View>
        {r.best ? (
          <View testID="style-best" style={{ gap: 4 }}>
            <FText
              tone="muted"
              center
              style={{
                fontSize: rem(0.75),
                letterSpacing: rem(0.75) * 0.16,
                textTransform: 'uppercase',
              }}
            >
              커리어 최고의 한 수
            </FText>
            <FText size={0.9375} center>
              성공 확률{' '}
              <FText tone="gold" bold size={0.9375}>
                {r.best.pct}%
              </FText>
              의 ‘{r.best.title}’, 기어이 해냈다.
            </FText>
          </View>
        ) : null}
        <FText tone="muted" size={0.8125} center>
          선택 {r.choices}번 기준{r.since ? ` · ${r.since}세 이후 기록` : ''}
        </FText>
      </View>
    </Reveal>
  );
}
