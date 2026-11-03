// 라운지 대화 사이에 끼는 영구결번 배너(웹 ChatNoticeBanner.svelte). 테마와 무관하게 금색 명판으로 그린다.
import { RADIUS } from '@offside/app-core/design-tokens';
import { playerName } from '@offside/app-core/format';
import { chatText as L } from '@offside/app-core/i18n/ko/chat';
import type { ChatNotice } from '@offside/contracts/chat';
import { tn } from '@offside/game/i18n/names';
import { useEffect, useRef, useState } from 'react';
import { Animated, Easing, StyleSheet, View } from 'react-native';
import Svg, { Defs, LinearGradient, Path, Rect, Stop } from 'react-native-svg';
import { useSnapshot } from 'valtio';
import { prefs } from '../store';
import { DISPLAY } from '../theme/type';
import { Press } from '../ui/Press';
import { Txt } from '../ui/Txt';

const SHIRT = 'M15.5 0 20 3.4h10L34.5 0 50 9.6 44 20.2l-5-2.9V48H11V17.3l-5 2.9L0 9.6Z';

function Shirt({
  width,
  height,
  id,
  from,
  to,
}: {
  width: number;
  height: number;
  id: string;
  from: string;
  to: string;
}) {
  return (
    <Svg width={width} height={height} viewBox="0 0 50 48" accessible={false}>
      <Defs>
        <LinearGradient id={id} x1="0" y1="0" x2="0.6" y2="1">
          <Stop offset="0" stopColor={from} />
          <Stop offset="1" stopColor={to} />
        </LinearGradient>
      </Defs>
      <Path d={SHIRT} fill={`url(#${id})`} />
    </Svg>
  );
}

export function ChatNoticeBanner({
  notice,
  onopen,
}: {
  notice: ChatNotice;
  onopen: (notice: ChatNotice) => void;
}) {
  const { motionOK } = useSnapshot(prefs);
  const [width, setWidth] = useState(0);
  const sweep = useRef(new Animated.Value(0)).current;
  // 처음 나타날 때 빛이 한 번 지나간다.
  useEffect(() => {
    if (!motionOK || !width) return;
    Animated.timing(sweep, {
      toValue: 1,
      duration: 1200,
      delay: 150,
      easing: Easing.out(Easing.quad),
      useNativeDriver: true,
    }).start();
  }, [motionOK, sweep, width]);
  const many = notice.n > 1;
  const club = tn(notice.club);
  const name = playerName(notice.name, notice.pos, notice.number);
  return (
    <Press
      testID={`chat-notice-${notice.id}`}
      accessibilityRole="button"
      accessibilityLabel={
        many
          ? L.noticeRetiredMany({ n: notice.n })
          : L.noticeRetired({ club, number: notice.number, name })
      }
      onPress={() => onopen(notice)}
      onLayout={(e) => setWidth(e.nativeEvent.layout.width)}
      style={{
        alignSelf: 'stretch',
        flexDirection: 'row',
        alignItems: 'center',
        gap: 14,
        minHeight: 72,
        marginVertical: 4,
        paddingVertical: 10,
        paddingLeft: 12,
        paddingRight: 14,
        overflow: 'hidden',
        borderWidth: 1,
        borderColor: '#b98a2c',
        borderRadius: RADIUS.md,
        backgroundColor: '#16140d',
      }}
    >
      <Svg
        style={StyleSheet.absoluteFill}
        width="100%"
        height="100%"
        accessible={false}
        preserveAspectRatio="none"
      >
        <Defs>
          <LinearGradient id="plaque" x1="0" y1="0" x2="1" y2="0">
            <Stop offset="0" stopColor="#3b2b0c" />
            <Stop offset="0.6" stopColor="#16140d" />
            <Stop offset="1" stopColor="#231a08" />
          </LinearGradient>
        </Defs>
        <Rect width="100%" height="100%" fill="url(#plaque)" />
      </Svg>
      {motionOK && width ? (
        <Animated.View
          pointerEvents="none"
          style={{
            ...StyleSheet.absoluteFill,
            transform: [
              {
                translateX: sweep.interpolate({ inputRange: [0, 1], outputRange: [-width, width] }),
              },
            ],
          }}
        >
          <Svg width={width} height="100%" accessible={false} preserveAspectRatio="none">
            <Defs>
              <LinearGradient id="sweep" x1="0" y1="0" x2="1" y2="0">
                <Stop offset="0.38" stopColor="#ffe8aa" stopOpacity={0} />
                <Stop offset="0.5" stopColor="#ffe8aa" stopOpacity={0.24} />
                <Stop offset="0.62" stopColor="#ffe8aa" stopOpacity={0} />
              </LinearGradient>
            </Defs>
            <Rect width="100%" height="100%" fill="url(#sweep)" />
          </Svg>
        </Animated.View>
      ) : null}
      <View
        accessible={false}
        style={{
          width: many ? 62 : 54,
          height: 50,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {many ? (
          <>
            <View
              style={{ position: 'absolute', top: 3, left: 0, transform: [{ rotate: '-13deg' }] }}
            >
              <Shirt width={40} height={40} id="back-l" from="#a98231" to="#6d5216" />
            </View>
            <View
              style={{ position: 'absolute', top: 3, right: 0, transform: [{ rotate: '13deg' }] }}
            >
              <Shirt width={40} height={40} id="back-r" from="#a98231" to="#6d5216" />
            </View>
          </>
        ) : null}
        <View style={{ width: 50, height: 48, alignItems: 'center', justifyContent: 'center' }}>
          <View style={StyleSheet.absoluteFill}>
            <Shirt width={50} height={48} id="front" from="#ffe39a" to="#a97716" />
          </View>
          <Txt
            num
            style={{
              marginTop: 7,
              color: '#2a1c00',
              fontFamily: DISPLAY[700],
              fontSize: 20,
              lineHeight: 22,
            }}
          >
            {notice.number}
          </Txt>
        </View>
      </View>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Txt style={{ color: '#f0c75e', fontSize: 11, fontWeight: '700', letterSpacing: 0.9 }}>
          {L.noticeRetiredTag}
        </Txt>
        <Txt style={{ color: '#fbf6e8', fontSize: 16, fontWeight: '800', marginTop: 1 }}>
          {many ? L.noticeRetiredManyTitle({ n: notice.n }) : name}
        </Txt>
        <Txt style={{ color: '#d7cdb4', fontSize: 12.5, marginTop: 1 }}>
          {many
            ? L.noticeRetiredManySub({ name, others: notice.n - 1 })
            : L.noticeRetiredSub({ club, number: notice.number })}
        </Txt>
      </View>
      <Txt style={{ color: '#f0c75e', fontSize: 20, fontWeight: '700' }}>›</Txt>
    </Press>
  );
}
