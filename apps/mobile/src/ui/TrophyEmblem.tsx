// 트로피 한 개의 그림(웹 TrophyEmblem.svelte). 우승 · 금메달은 그 대회 로고, 은 · 동메달은 유저가 그 대회 로고를 바꿨을 때만
// 그 로고 위에 메달 표시(2 · 3)를 얹고, 아니면 트로피 · 메달 그림. 시즌 결산과 트로피 탭이 같이 쓴다.
import { View } from 'react-native';
import { useSnapshot } from 'valtio';
import { MEDAL_BADGE, type MedalColor } from '@offside/app-core/compEmblem';
import type { CareerTrophy as Art } from '@offside/app-core/career-trophy';
import { compIcons } from '../store';
import { CareerTrophy } from './CareerTrophy';
import { CompIcon } from './CompIcon';
import { Txt } from './Txt';

export function TrophyEmblem({
  art,
  comp,
  medal,
  size = 48,
  still,
  color,
}: {
  art: Art;
  comp?: string | null | undefined;
  medal?: { comp: string; medal: MedalColor } | null | undefined;
  size?: number;
  still?: boolean | undefined;
  color: string;
}) {
  const { map } = useSnapshot(compIcons);
  if (comp) return <CompIcon ko={comp} size={size} still={still} />;
  const onLogo = medal && map[medal.comp] ? medal : null;
  if (!onLogo) return <CareerTrophy art={art} size={size} color={color} />;
  const b = MEDAL_BADGE[onLogo.medal];
  const bs = Math.max(14, Math.round(size * 0.42));
  return (
    <View testID={`medal-logo-${onLogo.medal}`}>
      <CompIcon ko={onLogo.comp} size={size} still={still} />
      <View
        pointerEvents="none"
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
        style={{
          position: 'absolute',
          right: -3,
          bottom: -3,
          width: bs,
          height: bs,
          borderRadius: bs / 2,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: b.fill,
          borderWidth: 1.5,
          borderColor: b.ring,
        }}
      >
        <Txt
          allowFontScaling={false}
          style={{
            fontSize: Math.round(bs * 0.58),
            lineHeight: Math.round(bs * 0.7),
            fontWeight: '800',
            color: b.ink,
          }}
        >
          {b.n}
        </Txt>
      </View>
    </View>
  );
}
