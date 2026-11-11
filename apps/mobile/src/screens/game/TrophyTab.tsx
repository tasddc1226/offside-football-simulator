// 트로피 탭(웹 tabs/TrophyTab.svelte): 우승 연혁 · 개인 수상 · 발롱도르 순위 · 시대의 라이벌 · 완결된 스토리.
// 선수 상세(은퇴 화면)도 같은 카드를 쓸 수 있게 LegendSource를 받는다.
import { FONT } from '@offside/app-core/design-tokens';
import { CareerTrophy } from '../../ui/CareerTrophy';
import { careerTrophy, type CareerTrophy as TrophyArt } from '@offside/app-core/career-trophy';
import type { ReactNode } from 'react';
import { View } from 'react-native';
import type { LegendSource } from '@offside/game/types';
import { useColors } from '../../theme/useColors';
import { DISPLAY, rem } from '../../theme/type';
import { Card } from '../../ui/Card';
import { ClubMark } from '../../ui/ClubBadge';
import { Txt } from '../../ui/Txt';
import { gameTrophyText as L } from '@offside/app-core/i18n/ko/gameTrophy';
import { tn } from '@offside/game/i18n/names';
import type { EraState } from '@offside/game/era';
import { eraTab } from '@offside/app-core/era-view';
import { EraTabCard } from './EraRival';
import { compOfTrophy } from '@offside/app-core/compEmblem';
import { CompIcon } from '../../ui/CompIcon';
import { groupByYear } from '@offside/app-core/trophyYears';

/** 연도 + 내용 한 줄(웹 .trophy: 44px 연도 칸 + 본문, 위에 구분선). first면 구분선이 없다. */
export function TrophyRow({
  year,
  first,
  art,
  icon,
  children,
}: {
  year: ReactNode;
  first?: boolean;
  art?: TrophyArt;
  /** T-11-681 트로피 그림 대신 그릴 대회 로고(누르면 바꾼다). */
  icon?: ReactNode;
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
          fontSize: rem(FONT.title3),
          fontVariant: ['tabular-nums'],
        }}
      >
        {year}
      </Txt>
      {icon ?? (art ? <CareerTrophy art={art} size={30} color={c.accent} /> : null)}
      <View style={{ flex: 1 }}>{children}</View>
    </View>
  );
}

type YearItem = { year: number; t: string; club?: string; clubId?: string | undefined };
/** T-11-695 같은 해에 받은 우승 · 수상을 한 묶음으로(웹 TrophyYears.svelte). 연도는 왼쪽에 한 번(여럿이면 ×개수),
 *  오른쪽에 그해 것을 쌓는다. 구단 이름은 바로 앞 줄과 같으면 다시 적지 않는다. 트로피 탭과 은퇴 화면이 같이 쓴다. */
export function TrophyYears({
  items,
  icons = true,
  still,
  bare,
  film,
}: {
  items: readonly YearItem[];
  icons?: boolean;
  still?: boolean;
  /** 첫 묶음 위 구분선을 뺀다(은퇴 화면 상자 안). */
  bare?: boolean;
  /** 은퇴 화면(늘 어두운 필름 바탕)의 글자 · 선 색. 없으면 테마 색. */
  film?: { ink: string; muted: string; line: string; accent: string };
}) {
  const t = useColors();
  const c = film
    ? {
        line: film.line,
        accent: film.accent,
        accentText: film.accent,
        ink: film.ink,
        muted: film.muted,
      }
    : { line: t.line, accent: t.accent, accentText: t.accentText, ink: t.ink, muted: t.muted };
  return (
    <>
      {groupByYear(items).map((g, gi) => (
        <View
          key={g.year}
          testID={`trophy-year-${g.year}`}
          style={{
            flexDirection: 'row',
            alignItems: 'flex-start',
            gap: 10,
            paddingVertical: 9,
            borderTopWidth: bare && gi === 0 ? 0 : 1,
            borderTopColor: c.line,
          }}
        >
          <View style={{ width: 44, paddingTop: 4 }}>
            <Txt
              style={{
                color: c.muted,
                fontFamily: DISPLAY[600],
                fontSize: rem(FONT.title3),
                fontVariant: ['tabular-nums'],
              }}
            >
              {g.year}
            </Txt>
            {g.items.length > 1 ? (
              <Txt
                accessibilityElementsHidden
                importantForAccessibility="no"
                style={{
                  fontFamily: DISPLAY[600],
                  fontSize: rem(FONT.caption),
                  color: c.accentText,
                }}
              >
                ×{g.items.length}
              </Txt>
            ) : null}
          </View>
          <View style={{ flex: 1, gap: 10 }}>
            {g.items.map((x, i) => {
              const comp = icons ? compOfTrophy(x.t) : null;
              const club = x.club && (i === 0 || g.items[i - 1]!.club !== x.club) ? x.club : null;
              return (
                <View key={i} style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                  {icons ? (
                    comp ? (
                      <CompIcon ko={comp} size={30} still={still} />
                    ) : (
                      <CareerTrophy art={careerTrophy(x.t)} size={30} color={c.accent} />
                    )
                  ) : null}
                  <View style={{ flex: 1 }}>
                    <Txt style={{ fontWeight: '700', color: c.ink }}>{tn(x.t)}</Txt>
                    {club ? (
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                        <ClubMark name={club} id={x.clubId} size={14} />
                        <Txt style={{ fontSize: rem(FONT.caption), color: c.muted }}>
                          {tn(club)}
                        </Txt>
                      </View>
                    ) : null}
                  </View>
                </View>
              );
            })}
          </View>
        </View>
      ))}
    </>
  );
}

/** 카드 안 빈 목록 문구(웹 .empty). */
const Empty = () => (
  <Txt tone="muted" style={{ fontSize: rem(FONT.body2), paddingVertical: 8 }}>
    {L.empty}
  </Txt>
);

export function TrophyTab({ s }: { s: LegendSource & { era?: EraState | undefined } }) {
  const era = eraTab(s);
  const ballon = (s.ballon || []).slice().reverse();
  const stories = (s.storyLog || []).slice().reverse();
  return (
    <>
      <Card gap={4}>
        <Txt v="eyebrow">Team Honours</Txt>
        <Txt v="h2" accessibilityRole="header">
          {L.honours}
        </Txt>
        {s.trophies.length ? (
          // T-11-695 같은 해 우승은 한 묶음. 리그·대회 우승 · 금메달은 그 대회 로고.
          <TrophyYears items={s.trophies} />
        ) : (
          <Empty />
        )}
      </Card>

      <Card gap={4}>
        <Txt v="eyebrow">Individual</Txt>
        <Txt v="h2" accessibilityRole="header">
          {L.individual}
        </Txt>
        {s.awards.length ? <TrophyYears items={s.awards} icons={false} /> : <Empty />}
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
                <Txt tone="muted" style={{ fontSize: rem(FONT.caption) }}>
                  {` ${L.nominees}`}
                </Txt>
              </Txt>
            </TrophyRow>
          ))}
        </Card>
      ) : null}

      {era ? <EraTabCard v={era} /> : null}

      <Card gap={4}>
        <Txt v="eyebrow">Story Album</Txt>
        <Txt v="h2" accessibilityRole="header">
          {L.stories}
        </Txt>
        {stories.length ? (
          stories.map((x, i) => (
            <TrophyRow key={i} year={x.year}>
              <Txt style={{ fontWeight: '700' }}>{tn(x.ending)}</Txt>
              <Txt tone="muted" style={{ fontSize: rem(FONT.caption) }}>
                {tn(x.name)}
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
