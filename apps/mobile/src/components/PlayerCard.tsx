import { useEffect, useRef, useState } from 'react';
import { Animated, Easing, Text, View } from 'react-native';
import Svg, { Defs, LinearGradient, Path, Stop } from 'react-native-svg';
import { useSnapshot } from 'valtio';
import { prefs } from '../store';
import { DISPLAY } from '../theme/type';
import { RnShirt } from './RnJersey';

/** Only overflowing names move; reduced motion keeps the full name accessible. */
function CardName({ name, color, animate }: { name: string; color: string; animate: boolean }) {
  const { motionOK } = useSnapshot(prefs);
  const [width, setWidth] = useState(0);
  const [textWidth, setTextWidth] = useState(0);
  const offset = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    offset.setValue(0);
    const distance = textWidth - width;
    if (distance <= 1 || !motionOK || !animate || !width) return;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.delay(2000),
        Animated.timing(offset, {
          toValue: -distance,
          duration: Math.max(4500, distance * 100),
          easing: Easing.linear,
          useNativeDriver: true,
        }),
        Animated.delay(2000),
        Animated.timing(offset, { toValue: 0, duration: 0, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [textWidth, width, name, motionOK, animate, offset]);
  const style = { fontSize: 11, lineHeight: 16, fontWeight: '700' as const, color };
  return (
    <View
      onLayout={(e) => setWidth(e.nativeEvent.layout.width)}
      style={{ width: '100%', height: 18, overflow: 'hidden' }}
    >
      <Text
        accessible={false}
        onTextLayout={(e) => setTextWidth(e.nativeEvent.lines[0]?.width ?? 0)}
        style={[style, { position: 'absolute', width: 2000, opacity: 0 }]}
      >
        {name}
      </Text>
      <Animated.Text
        accessibilityLabel={name}
        numberOfLines={1}
        style={[
          style,
          {
            width: Math.max(width, textWidth),
            textAlign: textWidth > width ? 'left' : 'center',
            transform: [{ translateX: offset }],
          },
        ]}
      >
        {name}
      </Animated.Text>
    </View>
  );
}

export type PlayerCardData = {
  name: string;
  rating: number;
  peak?: number;
  number?: number | null;
  legendScore?: number | null;
  youth: boolean;
};
export function PlayerCard({
  cell,
  code,
  compact = false,
  animate = true,
}: {
  cell: PlayerCardData;
  code: string;
  compact?: boolean;
  animate?: boolean;
}) {
  const gold = !cell.youth && (cell.legendScore ?? 0) >= 1000;
  const ink = cell.youth ? '#e9eee8' : gold ? '#4c3914' : '#24352d';
  const height = compact ? 88 : 126;
  return (
    <View
      style={{ width: '100%', height, paddingHorizontal: 6, paddingTop: 7, alignItems: 'center' }}
    >
      <Svg
        width="100%"
        height="100%"
        viewBox="0 0 100 140"
        preserveAspectRatio="none"
        style={{ position: 'absolute' }}
      >
        <Defs>
          <LinearGradient id="face" x1="0" y1="0" x2="1" y2="1">
            <Stop offset="0" stopColor={cell.youth ? '#29563f' : gold ? '#f6dda2' : '#ecf0eb'} />
            <Stop offset="1" stopColor={cell.youth ? '#163625' : gold ? '#c49a44' : '#a9bab0'} />
          </LinearGradient>
        </Defs>
        <Path
          d="M4 12L28 4H72L96 12V108L78 130L50 138L22 130L4 108Z"
          fill="url(#face)"
          stroke={cell.youth ? '#8aa990' : gold ? '#ecc46a' : '#cfdbd0'}
          strokeWidth="2"
        />
        <Path d="M6 106H94M12 15L50 6L88 15" fill="none" stroke={ink} opacity=".16" />
      </Svg>
      <View
        style={{
          flexDirection: 'row',
          width: '100%',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <Text style={{ fontFamily: DISPLAY[700], fontSize: compact ? 24 : 30, color: ink }}>
          {cell.peak ?? cell.rating}
        </Text>
        <Text style={{ fontFamily: DISPLAY[700], fontSize: 12, color: ink }}>{code}</Text>
      </View>
      {compact ? null : (
        <View style={{ marginTop: -5 }}>
          <RnShirt number={cell.number ?? 0} width={42} />
        </View>
      )}
      <CardName name={cell.name} color={ink} animate={animate} />
      {cell.peak !== undefined ? (
        <Text
          style={{ color: ink, fontSize: 9, lineHeight: 14 }}
        >{`배치 ${cell.rating}${cell.legendScore != null ? ` · LS ${cell.legendScore}` : ''}`}</Text>
      ) : !compact && cell.legendScore != null ? (
        <Text style={{ color: ink, fontSize: 9 }}>{`LS ${cell.legendScore}`}</Text>
      ) : null}
    </View>
  );
}
