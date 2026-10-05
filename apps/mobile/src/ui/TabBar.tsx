// 하단 탭바(웹 .tabs) — 게임 탭(시즌·선수·홈·커리어·트로피), 홈 하단 메뉴(기록실·소식·홈·구단주·설정), 내 팀 메뉴
// (편성·경기·구단주·업적·기록, T-11-026)가 같은 모양.
// T-11-031 세 벌이 같은 모양이라 바뀐 걸 알아보게: 메뉴가 새로 붙으면 칸들이 왼쪽부터 차례로 올라오고, 게임·내 팀
// 메뉴(sub)는 위쪽 강조선과 가운데 나가기 버튼의 둥근 바탕으로 메인 메뉴와 구분하며, 처음 볼 때 한 번 말풍선을 띄운다.
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Animated, Easing, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useSnapshot } from 'valtio';
import { NAV_INTRO_MS, takeNavIntro, type SubNav } from '@offside/app-core/navIntro';
import { Enter } from '../sheets/anim';
import { prefs, sheetState } from '../store';
import { alpha } from '../theme/colors';
import { useColors } from '../theme/useColors';
import { rem } from '../theme/type';
import { Press } from './Press';
import { TabIcon, type TabIconName } from './TabIcon';
import { Txt } from './Txt';
import { shellText as L } from '@offside/app-core/i18n/ko/shell';

export interface TabItem {
  key: TabIconName;
  label: string;
  active: boolean;
  onPress: () => void;
  /** 기본은 tab-{key}. */
  testID?: string;
  /** T-11-034 아직 보지 않은 새 업적 수 — 있으면 아이콘 오른쪽 위에 점(웹 .tab-dot). */
  dot?: number;
}

export const TABBAR_H = 60;

/** 처음 볼 때 한 번 가운데 나가기 버튼 위에 뜨는 말풍선(웹 NavIntro.svelte). 시트가 덮고 있으면 닫힐 때까지 미룬다.
 * 터치는 아래로 통과하고(pointerEvents none) 화면 읽기에서는 숨긴다 — 메뉴 이름은 탭바 라벨로 읽힌다. */
function NavIntro({ kind, onShow }: { kind: SubNav; onShow: (on: boolean) => void }) {
  const c = useColors();
  const { open } = useSnapshot(sheetState);
  const [text, setText] = useState<string | null>(null);
  const done = useRef(false);
  useEffect(() => {
    if (open || done.current) return;
    let hide: ReturnType<typeof setTimeout> | undefined;
    const show = setTimeout(() => {
      done.current = true;
      const t = takeNavIntro(kind);
      if (!t) return;
      setText(t);
      onShow(true);
      hide = setTimeout(() => {
        setText(null);
        onShow(false);
      }, NAV_INTRO_MS);
    }, 360);
    return () => {
      clearTimeout(show);
      clearTimeout(hide);
    };
  }, [open, kind]);
  if (!text) return null;
  return (
    <View
      pointerEvents="none"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={{
        position: 'absolute',
        left: 16,
        right: 16,
        bottom: '100%',
        marginBottom: 10,
        alignItems: 'center',
      }}
    >
      <Enter kind="translateY" from={6} ms={180} style={{ alignItems: 'center' }}>
        <View
          style={{
            paddingVertical: 9,
            paddingHorizontal: 12,
            borderRadius: 12,
            backgroundColor: c.ink,
            shadowColor: '#000',
            shadowOpacity: 0.25,
            shadowRadius: 9,
            shadowOffset: { width: 0, height: 6 },
            elevation: 10,
          }}
        >
          <Txt center style={{ fontSize: rem(0.8125), fontWeight: '600', color: c.bg }}>
            {text}
          </Txt>
        </View>
        <View
          style={{
            width: 0,
            height: 0,
            borderLeftWidth: 7,
            borderRightWidth: 7,
            borderTopWidth: 7,
            borderLeftColor: 'transparent',
            borderRightColor: 'transparent',
            borderTopColor: c.ink,
          }}
        />
      </Enter>
    </View>
  );
}

/** 가운데 나가기 버튼의 둥근 바탕 — 말풍선이 떠 있는 동안은 고리가 세 번 퍼진다(웹 .tab-ping). */
function ExitChip({ ping, children }: { ping: boolean; children: ReactNode }) {
  const c = useColors();
  const { motionOK } = useSnapshot(prefs);
  const v = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (!ping || !motionOK) return;
    v.setValue(0);
    const a = Animated.loop(
      Animated.timing(v, {
        toValue: 1,
        duration: 1200,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      }),
      { iterations: 3 },
    );
    a.start();
    return () => a.stop();
  }, [ping, motionOK, v]);
  return (
    <View style={{ alignItems: 'center', justifyContent: 'center', margin: -4 }}>
      {ping ? (
        <Animated.View
          style={{
            position: 'absolute',
            width: 28,
            height: 28,
            borderRadius: 14,
            borderWidth: 2,
            borderColor: c.accent,
            opacity: v.interpolate({ inputRange: [0, 1], outputRange: [0.8, 0] }),
            transform: [{ scale: v.interpolate({ inputRange: [0, 1], outputRange: [1, 1.7] }) }],
          }}
        />
      ) : null}
      <View style={{ padding: 4, borderRadius: 999, backgroundColor: alpha(c.accent, 0.22) }}>
        {children}
      </View>
    </View>
  );
}

/** sub: 게임·내 팀 메뉴 — 가운데(3번째) 칸이 그 화면에서 나가는 버튼이다. */
export function TabBar({ items, label, sub }: { items: TabItem[]; label: string; sub?: SubNav }) {
  const c = useColors();
  const insets = useSafeAreaInsets();
  const [ping, setPing] = useState(false);
  return (
    <View
      accessibilityRole="tablist"
      accessibilityLabel={label}
      style={{
        flexDirection: 'row',
        backgroundColor: c.surface,
        borderTopWidth: sub ? 2 : 1,
        borderTopColor: sub ? c.accent : c.line,
        paddingTop: 6,
        paddingHorizontal: 4,
        paddingBottom: 6 + insets.bottom,
        shadowColor: '#14201a',
        shadowOpacity: 0.12,
        shadowRadius: 10,
        shadowOffset: { width: 0, height: -4 },
        elevation: 8,
      }}
    >
      {sub ? <NavIntro kind={sub} onShow={setPing} /> : null}
      {items.map((t, i) => {
        const color = t.active ? c.tabOn : c.muted;
        const icon = <TabIcon name={t.key} color={color} />;
        return (
          <Enter
            key={t.key}
            kind="translateY"
            from={14}
            ms={320}
            delay={i * 40}
            style={{ flex: 1 }}
          >
            <Press
              accessibilityRole="tab"
              accessibilityState={{ selected: t.active }}
              accessibilityLabel={t.dot ? `${t.label}, ${L.achNew({ n: t.dot })}` : undefined}
              onPress={t.onPress}
              testID={t.testID ?? `tab-${t.key}`}
              style={(pressed) => ({
                flex: 1,
                minHeight: 44,
                borderRadius: 9,
                alignItems: 'center',
                justifyContent: 'center',
                gap: 3,
                paddingVertical: 6,
                backgroundColor: pressed ? 'rgba(128,128,128,0.12)' : 'transparent',
              })}
            >
              <View
                style={t.active ? { transform: [{ translateY: -1 }, { scale: 1.06 }] } : undefined}
              >
                {sub && i === 2 ? <ExitChip ping={ping}>{icon}</ExitChip> : icon}
                {t.dot ? (
                  <View
                    testID={`${t.testID ?? `tab-${t.key}`}-dot`}
                    style={{
                      position: 'absolute',
                      top: -4,
                      right: -8,
                      width: 12,
                      height: 12,
                      borderRadius: 6,
                      backgroundColor: c.bad,
                      borderWidth: 2,
                      borderColor: c.surface,
                    }}
                  />
                ) : null}
              </View>
              {/* T-11-038 아주 큰 글씨 설정에서 탭 이름이 옆 칸까지 번져 겹쳤다 — 한 줄, 확대는 1.3배까지. */}
              <Txt
                numberOfLines={1}
                maxFontSizeMultiplier={1.3}
                adjustsFontSizeToFit
                style={{
                  fontSize: rem(0.6875),
                  lineHeight: rem(0.6875) * 1.3,
                  fontWeight: '600',
                  color,
                }}
              >
                {t.label}
              </Txt>
            </Press>
          </Enter>
        );
      })}
    </View>
  );
}
