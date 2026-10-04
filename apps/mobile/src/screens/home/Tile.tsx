// 홈 타일(웹 .tile.tile-link): 눈썹 · 굵은 제목 · 작은 설명. 서버 최초 기록·확률 이벤트가 한 줄에 둘씩 놓인다.
import { View } from 'react-native';
import { rem } from '../../theme/type';
import { useColors } from '../../theme/useColors';
import { Press, Txt, useShadow } from '../../ui';

export function Tile({
  eyebrow,
  title,
  sub,
  subNum,
  onPress,
  testID,
  wide,
}: {
  eyebrow: string;
  title: string;
  sub: string;
  /** 설명 글에 숫자 서체(.num)를 쓴다. */
  subNum?: boolean;
  onPress: () => void;
  testID: string;
  /** 한 줄을 혼자 다 쓴다(웹 .tile-wide). 기본은 옆 타일과 반씩 나눈다. */
  wide?: boolean;
}) {
  const c = useColors();
  const shadow = useShadow();
  return (
    <Press
      scale={0.985}
      testID={testID}
      accessibilityLabel={`${eyebrow}, ${title}, ${sub}`}
      onPress={onPress}
      style={[
        {
          ...(wide ? null : { flex: 1 }),
          backgroundColor: c.surface,
          borderRadius: 14,
          padding: 14,
        },
        shadow,
      ]}
    >
      <View style={{ gap: 2 }}>
        <Txt v="eyebrow">{eyebrow}</Txt>
        <Txt bold style={{ fontSize: rem(0.9375) }}>
          {title}
        </Txt>
        <Txt v="sm" tone="muted" {...(subNum ? { num: true } : {})}>
          {sub}
        </Txt>
      </View>
    </Press>
  );
}
