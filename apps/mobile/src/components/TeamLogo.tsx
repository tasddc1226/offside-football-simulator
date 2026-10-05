import { useId, useState } from 'react';
import { Image } from 'expo-image';
import Svg, { ClipPath, Defs, G, Path, Rect, Text } from 'react-native-svg';
import { CREST_SHAPES, CREST_PATTERNS } from '@offside/game/crests';
import { defaultTeamLogo, type TeamLogo as Logo } from '@offside/contracts/team-logo';
import { teamHomeText as L } from '@offside/app-core/i18n/ko/teamHome';
export function TeamLogo({
  logo,
  name,
  size = 48,
  decorative = false,
}: {
  logo?: Logo | null;
  name: string;
  size?: number;
  decorative?: boolean;
}) {
  const value = logo ?? defaultTeamLogo(name);
  const clip = useId().replace(/:/g, '');
  const [failed, setFailed] = useState('');
  if (value.img && value.img !== failed)
    return (
      <Image
        source={{ uri: value.img }}
        onError={() => setFailed(value.img ?? '')}
        accessible={!decorative}
        accessibilityElementsHidden={decorative}
        importantForAccessibility={decorative ? 'no-hide-descendants' : 'auto'}
        accessibilityLabel={decorative ? undefined : L.logoAlt({ name })}
        contentFit="contain"
        style={{ width: size, height: size, borderRadius: size * 0.12 }}
      />
    );
  return (
    <Svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      accessible={!decorative}
      accessibilityElementsHidden={decorative}
      importantForAccessibility={decorative ? 'no-hide-descendants' : 'auto'}
      accessibilityLabel={decorative ? undefined : L.logoAlt({ name })}
    >
      <Defs>
        <ClipPath id={clip}>
          <Path d={CREST_SHAPES[value.shape]} />
        </ClipPath>
      </Defs>
      <G clipPath={`url(#${clip})`}>
        <Rect width="64" height="64" fill={value.bg} />
        {value.pattern !== 'plain' ? (
          <Path d={CREST_PATTERNS[value.pattern]} fill={value.fg} opacity={0.22} />
        ) : null}
        <Text
          x="32"
          y="33"
          textAnchor="middle"
          alignmentBaseline="central"
          fontSize={value.text.length > 2 ? 17 : value.text.length > 1 ? 22 : 28}
          fontWeight="700"
          fill={value.fg}
        >
          {value.text}
        </Text>
      </G>
      <Path
        d={CREST_SHAPES[value.shape]}
        fill="none"
        stroke={value.fg}
        strokeWidth="2"
        strokeLinejoin="round"
      />
    </Svg>
  );
}
