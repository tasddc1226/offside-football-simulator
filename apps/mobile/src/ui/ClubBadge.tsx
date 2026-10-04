// 클럽 엠블럼(웹 ClubBadge.svelte · ClubMark.svelte). 유저 로고(이미지·글자)가 있으면 그걸, 없으면 기본 엠블럼
// (game/crests.ts)을 react-native-svg로 그린다.
import { useId } from 'react';
import { View } from 'react-native';
import { Image } from 'expo-image';
import Svg, { Circle, ClipPath, Defs, G, Path, Rect, Text as SvgText } from 'react-native-svg';
import { useSnapshot } from 'valtio';
import { crestOf, TRI_THIRD_PATH } from '@offside/game/crests';
import { clubById, clubByName } from '@offside/game/clubs';
import { clubCustom } from '../store';
import { useColors } from '../theme/useColors';
import { Txt } from './Txt';

export function ClubBadge({
  club,
  size = 22,
}: {
  club: { id: string; name: string };
  size?: number;
}) {
  const { map } = useSnapshot(clubCustom);
  const c = useColors();
  const clip = useId();
  const logo = map[club.id]?.logo;
  if (logo?.img)
    return (
      <Image
        source={{ uri: logo.img }}
        style={{ width: size, height: size, borderRadius: 4 }}
        accessibilityIgnoresInvertColors
      />
    );
  if (logo)
    return (
      <View
        style={{
          width: size,
          height: size,
          borderRadius: size * 0.22,
          backgroundColor: logo.bg,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Txt
          style={{
            color: logo.fg,
            fontWeight: '800',
            fontSize: Math.round(size * (logo.text.length > 1 ? 0.36 : 0.5)),
            lineHeight: size,
          }}
        >
          {logo.text}
        </Txt>
      </View>
    );
  const crest = crestOf(club);
  return (
    <Svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      <Defs>
        <ClipPath id={clip}>
          <Path d={crest.shape} />
        </ClipPath>
      </Defs>
      <Path
        d={crest.shape}
        fill="none"
        stroke={c.crestHalo}
        strokeWidth={6}
        strokeLinejoin="round"
      />
      <G clipPath={`url(#${clip})`}>
        <Rect width={64} height={64} fill={crest.base} />
        {crest.pattern ? <Path d={crest.pattern} fill={crest.accent} /> : null}
        {crest.third ? <Path d={TRI_THIRD_PATH} fill={crest.third} /> : null}
        {crest.disc ? <Circle cx={32} cy={32} r={15} fill="#fff" /> : null}
        {crest.icon ? (
          <G {...(crest.transform ? { transform: crest.transform } : {})}>
            <Path d={crest.icon.d} fill={crest.motifColor} />
            {crest.icon.k ? (
              <Path d={crest.icon.k} fill={crest.disc ? '#fff' : crest.base} />
            ) : null}
          </G>
        ) : crest.text ? (
          <SvgText
            x={32}
            y={33}
            textAnchor="middle"
            alignmentBaseline="central"
            fontSize={crest.text.length > 1 ? 19 : 25}
            fontWeight="800"
            fill={crest.motifColor}
          >
            {crest.text}
          </SvgText>
        ) : null}
      </G>
      {crest.edge ? (
        <Path
          d={crest.shape}
          fill="none"
          stroke={crest.edge}
          strokeWidth={3.5}
          strokeLinejoin="round"
        />
      ) : null}
    </Svg>
  );
}

/** 기록에 남은 클럽의 엠블럼 — id가 있으면 id로, 옛 기록만 이름으로 찾는다. 못 찾으면 그리지 않는다. */
export function ClubMark({
  name,
  id = null,
  size = 16,
}: {
  name: string | null | undefined;
  id?: string | null | undefined;
  size?: number;
}) {
  // 유저가 이름을 바꾸면 CLUBS[].name이 바뀐다 — clubCustom.map을 구독해 다시 찾는다.
  useSnapshot(clubCustom);
  const club = id ? clubById(id) : name ? clubByName(name) : null;
  return club ? <ClubBadge club={club} size={size} /> : null;
}
