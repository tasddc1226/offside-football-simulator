// T-11-150 대표 칭호 알약(웹 cup/TitleBadge.svelte) — 컵 트로피와 '제3회 챔피언'. 금·은·동 색은 트로피 팔레트를 따른다.
// 보통(md), 댓글 · 채팅 닉네임 옆은 작게(sm), 줄이 좁은 랭킹은 트로피만(icon — 이름은 접근성 글자로). 목록에 여러 개 그려지는
// sm · icon은 움직이지 않는 그림(TrophyArt)을 쓴다.
import Svg, { Path } from 'react-native-svg';
import { useColors } from '../theme/useColors';
import { View } from 'react-native';
import { cupTrophy } from '@offside/app-core/cupTrophy';
import { parseTitle, titleLabel, titleIconPath } from '@offside/app-core/ownerTitle';
import { ownerProfileText as L } from '@offside/app-core/i18n/ko/ownerProfile';
import { alpha } from '../theme/colors';
import { rem } from '../theme/type';
import { CupTrophy, TrophyArt } from '../ui/CupTrophy';
import { Txt } from '../ui/Txt';

export function TitleBadge({ title, size = 'md' }: { title: string; size?: 'md' | 'sm' | 'icon' }) {
  const c = useColors();
  const t = parseTitle(title);
  const label = titleLabel(title);
  if (!label) return null;
  const palette = t ? cupTrophy(t.stage).palette : { base: c.accent, light: c.accent };
  const icon = size === 'icon';
  return (
    <View
      testID={`title-badge-${title}`}
      accessible
      accessibilityRole="image"
      accessibilityLabel={L.titleAria({ title: label })}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: size === 'md' ? 4 : 2,
        ...(icon
          ? {}
          : {
              paddingVertical: size === 'md' ? 2 : 0,
              paddingLeft: size === 'md' ? 4 : 2,
              paddingRight: size === 'md' ? 10 : 7,
              borderRadius: 999,
              borderWidth: 1,
              borderColor: palette.base,
              backgroundColor: alpha(palette.light, 0.3),
            }),
      }}
    >
      {!t ? (
        <Svg width={size === 'md' ? 22 : 16} height={size === 'md' ? 22 : 16} viewBox="0 0 24 24">
          <Path
            d={titleIconPath(title)}
            fill="none"
            stroke={c.ink}
            strokeWidth={1.6}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </Svg>
      ) : size === 'md' ? (
        <CupTrophy stage={t.stage} size={22} />
      ) : (
        <TrophyArt stage={t.stage} size={16} />
      )}
      {icon ? null : (
        <Txt bold numberOfLines={1} style={{ fontSize: rem(size === 'md' ? 0.75 : 0.75) }}>
          {label}
        </Txt>
      )}
    </View>
  );
}
