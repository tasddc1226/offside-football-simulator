// 트로피 탭(웹 tabs/TrophyTab.svelte): 우승 연혁 · 개인 수상 · 발롱도르 순위 · 완결된 스토리.
// 선수 상세(은퇴 화면)도 같은 카드를 쓸 수 있게 LegendSource를 받는다.
import type { ReactNode } from 'react';
import { View } from 'react-native';
import type { LegendSource } from '@offside/game/types';
import { useColors } from '../../theme/useColors';
import { DISPLAY, rem } from '../../theme/type';
import { Card } from '../../ui/Card';
import { ClubMark } from '../../ui/ClubBadge';
import { Txt } from '../../ui/Txt';
import { gameTrophyText as L } from '@offside/app-core/i18n/ko/gameTrophy';

/** 연도 + 내용 한 줄(웹 .trophy: 44px 연도 칸 + 본문, 위에 구분선). first면 구분선이 없다. */
export function TrophyRow({
  year,
  first,
  children,
}: {
  year: ReactNode;
  first?: boolean;
  children: ReactNode;
}) {
  const c = useColors();
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
        paddingVertical: 9,
        borderTopWidth: first ? 0 : 1,
        borderTopColor: c.line,
      }}
    >
      <Txt
        tone="muted"
        style={{
          width: 44,
          fontFamily: DISPLAY[600],
          fontSize: rem(1.125),
          fontVariant: ['tabular-nums'],
        }}
      >
        {year}
      </Txt>
      <View style={{ flex: 1 }}>{children}</View>
    </View>
  );
}

/** 카드 안 빈 목록 문구(웹 .empty). */
const Empty = () => (
  <Txt tone="muted" style={{ fontSize: rem(0.875), paddingVertical: 8 }}>
    {L.empty}
  </Txt>
);

export function TrophyTab({ s }: { s: LegendSource }) {
  const trophies = s.trophies.slice().reverse();
  const awards = s.awards.slice().reverse();
  const ballon = (s.ballon || []).slice().reverse();
  const stories = (s.storyLog || []).slice().reverse();
  return (
    <>
      <Card gap={4}>
        <Txt v="eyebrow">Team Honours</Txt>
        <Txt v="h2" accessibilityRole="header">
          {L.honours}
        </Txt>
        {trophies.length ? (
          trophies.map((x, i) => (
            <TrophyRow key={i} year={x.year}>
              <Txt style={{ fontWeight: '700' }}>{x.t}</Txt>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                <ClubMark name={x.club} id={x.clubId} size={14} />
                <Txt tone="muted" style={{ fontSize: rem(0.75) }}>
                  {x.club}
                </Txt>
              </View>
            </TrophyRow>
          ))
        ) : (
          <Empty />
        )}
      </Card>

      <Card gap={4}>
        <Txt v="eyebrow">Individual</Txt>
        <Txt v="h2" accessibilityRole="header">
          {L.individual}
        </Txt>
        {awards.length ? (
          awards.map((x, i) => (
            <TrophyRow key={i} year={x.year}>
              <Txt style={{ fontWeight: '700' }}>{x.t}</Txt>
            </TrophyRow>
          ))
        ) : (
          <Empty />
        )}
      </Card>

      {ballon.length ? (
        <Card gap={4}>
          <Txt v="eyebrow">Ballon d&apos;Or</Txt>
          <Txt v="h2" accessibilityRole="header">
            {L.ballon}
          </Txt>
          {ballon.map((b, i) => (
            <TrophyRow key={i} year={b.year}>
              <Txt>
                <Txt style={{ fontWeight: '700' }}>
                  {b.rank === 1 ? L.ballonWon : L.ballonRank({ n: b.rank })}
                </Txt>
                <Txt tone="muted" style={{ fontSize: rem(0.75) }}>
                  {` ${L.nominees}`}
                </Txt>
              </Txt>
            </TrophyRow>
          ))}
        </Card>
      ) : null}

      <Card gap={4}>
        <Txt v="eyebrow">Story Album</Txt>
        <Txt v="h2" accessibilityRole="header">
          {L.stories}
        </Txt>
        {stories.length ? (
          stories.map((x, i) => (
            <TrophyRow key={i} year={x.year}>
              <Txt style={{ fontWeight: '700' }}>{x.ending}</Txt>
              <Txt tone="muted" style={{ fontSize: rem(0.75) }}>
                {x.name}
              </Txt>
            </TrophyRow>
          ))
        ) : (
          <Empty />
        )}
      </Card>
    </>
  );
}
