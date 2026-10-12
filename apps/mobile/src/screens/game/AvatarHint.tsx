// T-11-191 커리어 화면 도트 선수가 누를 수 있다는 표시(웹 .avatar-chip · .avatar-btn.fresh).
// 오른쪽 아래 '✎ 꾸미기' 칩, 꾸미기를 한 번도 안 열었으면 둘레 고리가 깜빡인다('동작 줄이기'면 고리만 고정).
import { useEffect, useState } from 'react';
import { Animated, Easing, View } from 'react-native';
import { avatarLookText as LK } from '@offside/app-core/i18n/ko/avatarLook';
import { prefs } from '../../store';
import { rem } from '../../theme/type';
import { useColors } from '../../theme/useColors';
import { Txt } from '../../ui/Txt';

export function AvatarHint({ fresh }: { fresh: boolean }) {
  const c = useColors();
  const [t] = useState(() => new Animated.Value(0));
  useEffect(() => {
    if (!fresh || !prefs.motionOK) return;
    const loop = Animated.loop(
      Animated.timing(t, {
        toValue: 1,
        duration: 1600,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      }),
    );
    loop.start();
    return () => loop.stop();
  }, [fresh, t]);
  return (
    <>
      {fresh ? (
        <Animated.View
          pointerEvents="none"
          style={{
            position: 'absolute',
            top: -6,
            left: -6,
            right: -6,
            bottom: -6,
            borderRadius: 14,
            borderWidth: 2,
            borderColor: c.accent,
            opacity: prefs.motionOK
              ? t.interpolate({ inputRange: [0, 0.7, 1], outputRange: [1, 0, 0] })
              : 1,
            transform: [
              {
                scale: t.interpolate({ inputRange: [0, 0.7, 1], outputRange: [0.94, 1.08, 1.08] }),
              },
            ],
          }}
        />
      ) : null}
      <View
        pointerEvents="none"
        style={{
          position: 'absolute',
          right: -8,
          bottom: -6,
          paddingHorizontal: 6,
          paddingVertical: 1,
          borderRadius: 999,
          backgroundColor: c.accent,
        }}
      >
        <Txt bold style={{ fontSize: rem(0.6875), color: c.accentInk }}>
          {`✎ ${LK.chip}`}
        </Txt>
      </View>
    </>
  );
}
