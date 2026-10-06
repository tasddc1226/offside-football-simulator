// 칭호 한 개를 등급 색 알약으로(웹 titles/TitleTag.svelte). 등급은 스크린 리더용 글자로도 알린다.
// pop: 결산에서 새로 딴 칭호 — d(ms) 뒤에 튀어 오른다(동작 줄이기면 바로).
import { useEffect, useRef } from 'react';
import { Animated } from 'react-native';
import { useSnapshot } from 'valtio';
import { RARITY_LABEL, type Rarity } from '@offside/game/titles';
import { titleText as L } from '@offside/app-core/i18n/ko/title';
import { prefs } from '../store';
import { alpha } from '../theme/colors';
import { useColors } from '../theme/useColors';
import { rem } from '../theme/type';
import { Txt } from '../ui/Txt';

export function TitleTag({
  name,
  rarity,
  pop = false,
  d = 0,
}: {
  name: string;
  rarity: Rarity;
  pop?: boolean;
  d?: number;
}) {
  const c = useColors();
  const { motionOK } = useSnapshot(prefs);
  const rc = rarity === 1 ? c.muted : c[`r${rarity}` as 'r2' | 'r3' | 'r4'];
  const s = useRef(new Animated.Value(pop && motionOK ? 0 : 1)).current;
  useEffect(() => {
    if (!pop || !motionOK) return;
    Animated.spring(s, {
      toValue: 1,
      delay: d,
      useNativeDriver: true,
      friction: 5,
      tension: 160,
    }).start();
  }, [pop, motionOK, d, s]);
  return (
    <Animated.View
      accessible
      accessibilityLabel={L.tagLabel({ rarity: RARITY_LABEL[rarity], name })}
      style={{
        alignSelf: 'flex-start',
        borderRadius: 999,
        paddingVertical: 2,
        paddingHorizontal: 9,
        backgroundColor: rarity === 4 ? alpha(c.accent, 0.14) : c.surface2,
        borderWidth: 1,
        borderColor: rc.startsWith('#') ? alpha(rc, 0.45) : rc,
        transform: [{ scale: s }],
      }}
    >
      <Txt numberOfLines={1} style={{ fontSize: rem(0.75), fontWeight: '700', color: rc }}>
        {name}
      </Txt>
    </Animated.View>
  );
}
