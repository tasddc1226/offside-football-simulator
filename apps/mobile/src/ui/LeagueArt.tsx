// T-11-640 리그 아이콘 · 우승 트로피(모양 · 색은 app-core leagueArt.ts, 웹과 공용). 여러 개가 한꺼번에 그려지므로 움직임은 넣지 않는다.
import { Text, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import {
  LEAGUE_ART_VIEWBOX,
  LEAGUE_TROPHY_PLATE as P,
  leagueEmblem,
  leagueTrophy,
  type LeagueArt,
} from '@offside/app-core/leagueArt';

function Art({ art, size }: { art: LeagueArt; size: number }) {
  return (
    <Svg width={size} height={size} viewBox={LEAGUE_ART_VIEWBOX}>
      {art.layers.map((layer, i) => (
        <Path key={i} d={layer.d} fill={art.palette[layer.tone]} />
      ))}
    </Svg>
  );
}

export function LeagueEmblem({
  tier,
  league,
  size = 28,
}: {
  tier: number;
  league: number;
  size?: number;
}) {
  return (
    <View testID={`league-emblem-${tier}-${league}`} accessibilityElementsHidden>
      <Art art={leagueEmblem(tier, league)} size={size} />
    </View>
  );
}

export function LeagueTrophy({
  tier,
  league,
  name,
  size = 60,
}: {
  tier: number;
  league: number;
  name?: string | undefined;
  size?: number;
}) {
  const art = leagueTrophy(tier, league);
  const u = size / 64;
  return (
    <View
      testID={`league-trophy-${tier}-${league}`}
      accessibilityElementsHidden
      style={{ width: size, height: size }}
    >
      <Art art={art} size={size} />
      {name ? (
        <Text
          numberOfLines={1}
          allowFontScaling={false}
          style={{
            position: 'absolute',
            left: P.x * u,
            top: P.y * u,
            width: P.w * u,
            height: P.h * u,
            fontSize: P.font * u,
            lineHeight: P.h * u,
            fontWeight: '800',
            textAlign: 'center',
            color: art.palette.engrave,
          }}
        >
          {name}
        </Text>
      ) : null}
    </View>
  );
}
