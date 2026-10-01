// 하단 탭바(웹 .tabs) — 게임 탭(시즌·선수·홈·커리어·트로피), 홈 하단 메뉴(기록실·소식·홈·구단주·설정), 내 팀 메뉴
// (편성·경기·구단주·업적·기록, T-11-026)가 같은 모양.
import { View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useColors } from '../theme/useColors';
import { rem } from '../theme/type';
import { Press } from './Press';
import { TabIcon, type TabIconName } from './TabIcon';
import { Txt } from './Txt';

export interface TabItem {
  key: TabIconName;
  label: string;
  active: boolean;
  onPress: () => void;
  /** 기본은 tab-{key}. */
  testID?: string;
}

export const TABBAR_H = 60;

export function TabBar({ items, label }: { items: TabItem[]; label: string }) {
  const c = useColors();
  const insets = useSafeAreaInsets();
  return (
    <View
      accessibilityRole="tablist"
      accessibilityLabel={label}
      style={{
        flexDirection: 'row',
        backgroundColor: c.surface,
        borderTopWidth: 1,
        borderTopColor: c.line,
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
      {items.map((t) => {
        const color = t.active ? c.tabOn : c.muted;
        return (
          <Press
            key={t.key}
            accessibilityRole="tab"
            accessibilityState={{ selected: t.active }}
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
              <TabIcon name={t.key} color={color} />
            </View>
            <Txt
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
        );
      })}
    </View>
  );
}
