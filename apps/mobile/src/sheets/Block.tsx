// 경기 중계 시트(웹 sheets/Block.svelte, T-10-028): 구간 경기가 한 경기씩 올라오며 승무패·출전 기록이 쌓인다.
// 진행·줄 추가는 sheet-controller가 뷰를 고치며 하고, 여기서는 읽어 그린다.
import { useEffect, useRef } from 'react';
import { Animated, Easing, View } from 'react-native';
import { useSnapshot } from 'valtio';
import type { SheetView } from '@offside/app-core/sheets';
import { prefs } from '../store';
import { useColors } from '../theme/useColors';
import { DISPLAY, fitLine, rem } from '../theme/type';
import { Press } from '../ui/Press';
import { Txt } from '../ui/Txt';
import { Enter } from './anim';
import { ProgBar, StatGrid } from './parts';
import { TickerLine } from './TickerLine';

/** 값이 바뀔 때마다 커졌다 돌아오는 숫자(웹 tally b.bump: 40%에서 1.25배 + 금색). 0·'-'은 그대로. */
function Bump({ value }: { value: number | string }) {
  const c = useColors();
  const { motionOK } = useSnapshot(prefs);
  const bump = value !== 0 && value !== '-' && motionOK;
  const t = useRef(new Animated.Value(bump ? 0 : 1)).current;
  useEffect(() => {
    if (!bump) return;
    t.setValue(0);
    const a = Animated.timing(t, {
      toValue: 1,
      duration: 300,
      easing: Easing.out(Easing.ease),
      useNativeDriver: false,
    });
    a.start();
    return () => a.stop();
  }, [value, bump, t]);
  return (
    <Animated.Text
      style={[
        fitLine({
          fontFamily: DISPLAY[700],
          fontSize: rem(1.5),
          lineHeight: rem(1.5) * 1.1,
          fontVariant: ['tabular-nums'],
        }),
        {
          color: t.interpolate({ inputRange: [0, 0.4, 1], outputRange: [c.ink, c.accent, c.ink] }),
          transform: [
            { scale: t.interpolate({ inputRange: [0, 0.4, 1], outputRange: [1, 1.25, 1] }) },
          ],
        },
      ]}
    >
      {value}
    </Animated.Text>
  );
}

export function Block({ v }: { v: Extract<SheetView, { kind: 'block' }> }) {
  const s = useSnapshot(v);
  const c = useColors();
  const tally = [
    { key: 'apps', k: s.tally.apps, l: '출전' },
    { key: 'g', k: s.tally.g, l: '골' },
    { key: 'a', k: s.back ? s.tally.cs : s.tally.a, l: s.back ? '무실점' : '도움' },
    { key: 'rating', k: s.tally.rating, l: '평점' },
  ];
  return (
    <>
      <Txt v="eyebrow">{s.eyebrow}</Txt>
      <Txt v="h2" accessibilityRole="header">
        {s.title}
      </Txt>
      <ProgBar progress={s.progress} fill={s.fill} />
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: -6 }}>
        <Txt tone="muted" style={{ fontSize: rem(0.75), fontVariant: ['tabular-nums'] }}>
          {s.round}
        </Txt>
        <Txt
          tone="muted"
          testID="block-wdl"
          style={{ fontSize: rem(0.75), fontVariant: ['tabular-nums'] }}
        >{`${s.wdl.w}승 ${s.wdl.d}무 ${s.wdl.l}패`}</Txt>
      </View>
      <StatGrid items={tally.map((t) => ({ key: t.key, l: t.l, v: <Bump value={t.k} /> }))} />
      {/* 새 경기 줄이 위에 붙고, 지난 줄은 muted로 누른다. */}
      <View style={{ minHeight: 124, gap: 4 }}>
        {s.ticker.map((m, i) => (
          <Enter key={m.key} kind="translateY" from={-6} ms={250}>
            <TickerLine m={m} muted={i > 0} bold={i === 0} />
          </Enter>
        ))}
      </View>
      <View style={{ gap: 6 }}>
        {s.extras.map((x, i) => (
          <Txt
            key={i}
            tone={x.done ? 'muted' : 'ink'}
            style={{ fontSize: rem(0.875), lineHeight: rem(0.875) * 1.55 }}
          >
            {x.done ? (
              <Txt style={{ color: c.good }}>{'✓ '}</Txt>
            ) : (
              <Txt style={{ color: c.accent }}>{'▸ '}</Txt>
            )}
            {x.text}
          </Txt>
        ))}
      </View>
      {s.skip ? (
        <Press
          testID="an-skip"
          onPress={() => v.skip?.()}
          hitSlop={{ top: 6, bottom: 6, left: 8, right: 8 }}
          style={{ alignSelf: 'center', paddingVertical: 6, paddingHorizontal: 2 }}
        >
          <Txt tone="muted" style={{ fontSize: rem(0.75), textDecorationLine: 'underline' }}>
            건너뛰기
          </Txt>
        </Press>
      ) : null}
    </>
  );
}
