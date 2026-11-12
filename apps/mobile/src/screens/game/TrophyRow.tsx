import { FONT } from '@offside/app-core/design-tokens';
import { CareerTrophy } from '../../ui/CareerTrophy';
import type { CareerTrophy as TrophyArt } from '@offside/app-core/career-trophy';
import type { ReactNode } from 'react';
import { View } from 'react-native';
import { useColors } from '../../theme/useColors';
import { DISPLAY, rem } from '../../theme/type';
import { Txt } from '../../ui/Txt';

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
