import type { CareerPos } from '@offside/contracts';
// 이적시장(웹 ui/Market.svelte, T-11-080) — 지금 시즌 은퇴 선수 카드를 구단 자금으로 사고판다. 구단주 화면의 '이적시장'으로 연다.
// T-11-080d 시안대로: 초록 머리에 구단 자금과 '자금 만들기', 탭 셋(선수 사기 · 팔기 · 내 거래), 카드 모양 목록,
// 카드 상세 영입 시트, 카드 고르기 + 슬라이더 판매, 방출 화면. 각 화면은 처음 열 때만 불러온다(미리 받기·폴링 없음).
import { FONT, RADIUS } from '@offside/app-core/design-tokens';
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Animated, Modal, PanResponder, Pressable, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Toast } from '../../ui/Toast';
import { useSnapshot } from 'valtio';

import { detailPosOf, type DetailPos } from '@offside/contracts/positions';
import { type MarketSale, type MarketCard } from '@offside/app-core/api/market';
import { type TeamPlayer } from '@offside/app-core/api/team';

import {
  marketDetailFilters,
  marketFindChips,
  marketTypeFilters,
  type MarketFilter,
  MARKET_TICKER_MS,
  cardStyle,
  marketName,
  cardAttrStrip,
  saleText,
} from '@offside/app-core/market';
import { agoKo, fmtValue } from '@offside/app-core/format';

import { DPOS } from '@offside/game/data';
import { prefs } from '../../store';

import { useColors } from '../../theme/useColors';
import { mix, type Colors } from '../../theme/colors';
import { alpha } from '../../theme/colors';
import { DISPLAY, rem } from '../../theme/type';
import { Press, Txt } from '../../ui';

import { PlayerCard } from '../../components/PlayerCard';

import Svg, { Circle, Path } from 'react-native-svg';
import { marketText as L } from '@offside/app-core/i18n/ko/market';

/** 목록·고르기용 카드 — 진짜 PlayerCard의 compact·mini판(OVR·자리·시즌·국기·등번호). 폭은 pitch 슬롯(62)과 거의 같은 64. */
export function MiniCard({
  c: card,
  name,
  dim,
}: {
  c: {
    careerId: string;
    look?: string | null | undefined;
    nation?: string | null | undefined;
    season?: number | undefined;
    peak: number;
    number: number | null;
    legendScore: number | null;
    pos: CareerPos;
    dpos: DetailPos | null;
    attrs: TeamPlayer['attrs'];
    locked?: boolean | undefined;
    enhance?: number | undefined;
  };
  name: string;
  dim?: boolean;
}) {
  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={{ width: 64, opacity: dim ? 0.45 : 1 }}
    >
      <PlayerCard
        compact
        mini
        animate={false}
        code={detailPosOf(card)}
        cell={{
          name,
          careerId: card.careerId,
          look: card.look,
          nation: card.nation,
          season: card.season,
          rating: card.peak,
          number: card.number,
          legendScore: card.legendScore,
          attrs: card.attrs,
          pos: card.pos,
          locked: card.locked,
          enhance: card.enhance,
          youth: false,
        }}
      />
    </View>
  );
}

export const toneColor = (c: Colors, tone: 'up' | 'down' | 'same') =>
  tone === 'up' ? c.warn : tone === 'down' ? c.good : c.muted;

/** 아래에서 올라오는 시트 — 영입 · 방출 확인이 함께 쓴다. */
export function MarketSheet({
  open,
  label,
  onClose,
  foot,
  children,
}: {
  open: boolean;
  label: string;
  onClose: () => void;
  /** 스크롤과 무관하게 아래에 붙어 있는 버튼들. */
  foot?: ReactNode;
  children: ReactNode;
}) {
  const c = useColors();
  const { motionOK } = useSnapshot(prefs);
  const insets = useSafeAreaInsets();
  return (
    <Modal
      visible={open}
      transparent
      animationType={motionOK ? 'slide' : 'none'}
      statusBarTranslucent
      navigationBarTranslucent
      onRequestClose={onClose}
    >
      <View style={{ flex: 1, justifyContent: 'flex-end' }}>
        <Pressable
          accessibilityLabel={L.close}
          onPress={onClose}
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: c.scrim,
          }}
        />
        <View
          accessibilityViewIsModal
          accessibilityLabel={label}
          style={{
            maxHeight: '92%',
            borderTopLeftRadius: 22,
            borderTopRightRadius: 22,
            overflow: 'hidden',
            backgroundColor: c.surface,
          }}
        >
          <ScrollView>{children}</ScrollView>
          {foot ? (
            <View
              style={{
                gap: 10,
                paddingHorizontal: 20,
                paddingTop: 12,
                paddingBottom: 12 + insets.bottom,
                borderTopWidth: 1,
                borderTopColor: c.line,
                backgroundColor: c.surface,
              }}
            >
              {foot}
            </View>
          ) : null}
          {/* 닫기는 오른쪽 위에 늘 보인다. */}
          <Press
            testID="market-sheet-close"
            accessibilityRole="button"
            accessibilityLabel={L.close}
            onPress={onClose}
            style={{
              position: 'absolute',
              top: 8,
              right: 8,
              width: 44,
              height: 44,
              borderRadius: 22,
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: alpha(c.surface, 0.8),
            }}
          >
            <Svg width={18} height={18} viewBox="0 0 20 20" accessible={false}>
              <Path
                d="m5 5 10 10M15 5 5 15"
                stroke={c.ink}
                strokeWidth={2}
                fill="none"
                strokeLinecap="round"
              />
            </Svg>
          </Press>
        </View>
      </View>
      {/* 모달은 앱 위 별도 층이라 알림을 이 안에서도 그린다. */}
      <Toast />
    </Modal>
  );
}

/** 왼쪽 이름, 오른쪽 값 한 줄(웹 .mk-lines). */
export function Line({
  label,
  value,
  strong,
  big,
  extra,
}: {
  label: string;
  value: string;
  strong?: boolean;
  big?: boolean;
  extra?: ReactNode;
}) {
  return (
    <View
      style={{
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'baseline',
        gap: 8,
      }}
    >
      <Txt
        tone={strong ? 'ink' : 'muted'}
        style={{ fontSize: rem(FONT.body2), fontWeight: strong ? '700' : '400' }}
      >
        {label}
      </Txt>
      <Txt
        num
        style={
          big
            ? { fontFamily: DISPLAY[700], fontSize: rem(FONT.title1) }
            : { fontSize: rem(FONT.body2), fontWeight: strong ? '700' : '400' }
        }
      >
        {value}
        {extra}
      </Txt>
    </View>
  );
}

/** 기준가 대비 판매가 슬라이더(%) — 네이티브 모듈 없이 PanResponder로 끈다. */
export function PctSlider({
  min,
  max,
  step,
  value,
  valueText,
  onChange,
}: {
  min: number;
  max: number;
  step: number;
  value: number;
  /** 화면의 판매가 — 상한에 걸리면 슬라이더 % 와 실제 값이 다르다. */
  valueText: string;
  onChange: (v: number) => void;
}) {
  const c = useColors();
  const width = useRef(1);
  const latest = useRef({ min, max, step, onChange });
  latest.current = { min, max, step, onChange };
  const at = (x: number) => {
    const { min: lo, max: hi, step: st, onChange: set } = latest.current;
    const ratio = Math.min(1, Math.max(0, x / width.current));
    set(Math.round((lo + ratio * (hi - lo)) / st) * st);
  };
  const pan = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: () => true,
        onPanResponderTerminationRequest: () => false,
        onPanResponderGrant: (e) => at(e.nativeEvent.locationX),
        onPanResponderMove: (e) => at(e.nativeEvent.locationX),
      }),
    [],
  );
  const ratio = (value - min) / (max - min);
  return (
    <View
      testID="market-sell-pct"
      accessible
      accessibilityRole="adjustable"
      accessibilityLabel={L.sliderLabelApp}
      accessibilityValue={{ min, max, now: value, text: valueText }}
      onAccessibilityAction={(e) =>
        onChange(
          Math.min(
            max,
            Math.max(min, value + (e.nativeEvent.actionName === 'increment' ? step : -step)),
          ),
        )
      }
      accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
      onLayout={(e) => (width.current = e.nativeEvent.layout.width || 1)}
      style={{ height: 32, justifyContent: 'center' }}
      {...pan.panHandlers}
    >
      <View pointerEvents="none" style={{ height: 6, borderRadius: 3, backgroundColor: c.line }}>
        <View
          style={{
            width: `${ratio * 100}%`,
            height: 6,
            borderRadius: 3,
            backgroundColor: c.accent,
          }}
        />
      </View>
      <View
        pointerEvents="none"
        style={{
          position: 'absolute',
          left: `${ratio * 100}%`,
          marginLeft: -11,
          width: 22,
          height: 22,
          borderRadius: RADIUS.sm,
          backgroundColor: c.surface,
          borderWidth: 3,
          borderColor: c.accent,
        }}
      />
    </View>
  );
}

/** T-11-474 포지션군을 고르면 열리는 세부 포지션 · 유형 줄(명예의 전당 필터와 같은 순서). */
export function SubFilters({
  filter,
  onPick,
}: {
  filter: MarketFilter;
  onPick: (next: MarketFilter) => void;
}) {
  const c = useColors();
  const details = marketDetailFilters(filter.pos);
  const filtered = !!(filter.dpos || filter.type);
  const reset = (
    <Press
      testID="market-filter-reset"
      accessibilityRole="button"
      hitSlop={6}
      onPress={() => onPick({ dpos: undefined, type: undefined })}
    >
      <Txt tone="muted" style={{ fontSize: rem(FONT.caption), textDecorationLine: 'underline' }}>
        {L.filterReset}
      </Txt>
    </Press>
  );
  // 웹 .mk-subfilters와 같은 모양 — 라벨은 위, 칩은 아래에 줄바꿈으로 놓는다.
  const row = (label: string, withReset: boolean, chips: ReactNode) => (
    <View style={{ gap: 6 }}>
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          paddingHorizontal: 14,
        }}
      >
        <Txt tone="muted" style={{ fontSize: rem(FONT.caption), fontWeight: '600' }}>
          {label}
        </Txt>
        {withReset && filtered ? reset : null}
      </View>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, paddingHorizontal: 14 }}>
        {chips}
      </View>
    </View>
  );
  return (
    <View
      testID="market-subfilters"
      style={{
        gap: 12,
        paddingVertical: 12,
        borderRadius: RADIUS.md,
        backgroundColor: c.surface,
      }}
    >
      {details.length
        ? row(
            L.detailPos,
            true,
            <>
              <FilterChip
                small
                on={!filter.dpos}
                label={L.posAll}
                testID="market-dpos-all"
                onPress={() => onPick({ dpos: undefined })}
              />
              {details.map((d) => (
                <FilterChip
                  key={d}
                  small
                  on={filter.dpos === d}
                  label={d}
                  a11yLabel={DPOS[d].label}
                  testID={`market-dpos-${d}`}
                  onPress={() => onPick({ dpos: d })}
                />
              ))}
            </>,
          )
        : null}
      {row(
        L.playerType,
        !details.length,
        <>
          <FilterChip
            small
            on={!filter.type}
            label={L.posAll}
            testID="market-type-all"
            onPress={() => onPick({ type: undefined })}
          />
          {marketTypeFilters(filter.pos).map(([id, name]) => (
            <FilterChip
              key={id}
              small
              on={filter.type === id}
              label={name}
              testID={`market-type-${id}`}
              onPress={() => onPick({ type: id })}
            />
          ))}
        </>,
      )}
    </View>
  );
}

/** T-11-500 '국적 · 팀' 여는 칩과 고른 것(누르면 지운다). 웹 .mk-find와 같은 모양. */
export function FindRow({
  filter,
  onOpen,
  onPick,
}: {
  filter: MarketFilter;
  onOpen: () => void;
  onPick: (next: MarketFilter) => void;
}) {
  const c = useColors();
  const chip = { minHeight: 34, paddingHorizontal: 13, borderRadius: RADIUS.pill, borderWidth: 1 };
  const x = (color: string) => (
    <Svg width={13} height={13} viewBox="0 0 24 24" fill="none">
      <Path d="M6 6l12 12M18 6 6 18" stroke={color} strokeWidth={2.6} strokeLinecap="round" />
    </Svg>
  );
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
      <Press
        testID="market-find-open"
        accessibilityRole="button"
        onPress={onOpen}
        style={{
          ...chip,
          flexDirection: 'row',
          alignItems: 'center',
          gap: 6,
          borderColor: c.accent,
          backgroundColor: c.surface,
        }}
      >
        <Svg width={16} height={16} viewBox="0 0 24 24" fill="none">
          <Circle cx={11} cy={11} r={7} stroke={c.accentText} strokeWidth={2.2} />
          <Path d="m20 20-3.5-3.5" stroke={c.accentText} strokeWidth={2.2} strokeLinecap="round" />
        </Svg>
        <Txt style={{ fontSize: rem(FONT.label), fontWeight: '600', color: c.accentText }}>
          {L.findOpen}
        </Txt>
      </Press>
      {marketFindChips(filter).map((f) => (
        <Press
          key={f.key}
          testID={`market-find-chip-${f.key}`}
          accessibilityRole="button"
          accessibilityLabel={L.findRemove({ name: f.name })}
          onPress={() => onPick({ [f.key]: undefined })}
          style={{
            ...chip,
            flexDirection: 'row',
            alignItems: 'center',
            gap: 6,
            borderColor: c.ink,
            backgroundColor: c.ink,
          }}
        >
          <Txt style={{ fontSize: rem(FONT.label), fontWeight: '600', color: c.surface }}>
            {f.name}
          </Txt>
          {x(c.surface)}
        </Press>
      ))}
    </View>
  );
}

/** T-11-477 매물 줄 아래 능력치 6개(웹 .mk-attrs). 능력치가 없는 옛 카드는 그리지 않는다. */
export function AttrStrip({ card }: { card: MarketCard }) {
  const c = useColors();
  const attrs = cardAttrStrip(card);
  if (!attrs.length) return null;
  return (
    <View
      testID="market-listing-attrs"
      style={{
        width: '100%',
        flexDirection: 'row',
        paddingTop: 8,
        borderTopWidth: 1,
        borderTopColor: c.line,
      }}
    >
      {attrs.map((a) => (
        <View key={a.key} style={{ flex: 1, alignItems: 'center', gap: 1, minWidth: 0 }}>
          <Txt tone="muted" numberOfLines={1} style={{ fontSize: rem(FONT.caption2) }}>
            {a.label}
          </Txt>
          <Txt
            num
            style={{
              fontSize: rem(FONT.body2),
              fontWeight: a.tone === 'lo' ? '500' : '700',
              color: a.tone === 'hi' ? c.accentText : a.tone === 'lo' ? c.muted : c.ink,
            }}
          >
            {a.value}
          </Txt>
        </View>
      ))}
    </View>
  );
}

export function FilterChip({
  on,
  label,
  onPress,
  testID,
  small: sm = false,
  a11yLabel,
}: {
  on: boolean;
  label: string;
  onPress: () => void;
  testID?: string;
  small?: boolean;
  a11yLabel?: string;
}) {
  const c = useColors();
  return (
    <Press
      testID={testID}
      accessibilityRole="button"
      accessibilityState={{ selected: on }}
      {...(a11yLabel ? { accessibilityLabel: a11yLabel } : {})}
      onPress={onPress}
      style={{
        minHeight: sm ? 30 : 34,
        paddingHorizontal: sm ? 12 : 13,
        borderRadius: RADIUS.pill,
        borderWidth: 1,
        // 세부 칩(small)은 바탕색 위에 강조색 톤으로 골라 위 포지션 칩과 위계를 나눈다(웹 .mk-chip-sm).
        borderColor: sm ? (on ? c.accent : c.line) : on ? c.ink : c.line,
        backgroundColor: sm ? (on ? mix(c.accent, c.surface, 0.18) : c.bg) : on ? c.ink : c.surface,
        justifyContent: 'center',
      }}
    >
      <Txt
        style={{
          fontSize: rem(FONT.label),
          fontWeight: on ? '600' : '400',
          color: sm ? (on ? c.accentText : c.ink) : on ? c.surface : c.ink,
        }}
      >
        {label}
      </Txt>
    </Press>
  );
}

/** 방출할 선수 고르기 칸. */
export function Check({ on, disabled }: { on: boolean; disabled?: boolean }) {
  const c = useColors();
  return (
    <View
      style={{
        width: 22,
        height: 22,
        borderRadius: RADIUS.xs,
        borderWidth: 2,
        borderColor: on ? c.bad : c.line,
        backgroundColor: on ? c.bad : disabled ? c.surface2 : c.surface,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      {on ? (
        <Txt style={{ color: '#fff', fontSize: rem(FONT.caption), fontWeight: '700' }}>✓</Txt>
      ) : null}
    </View>
  );
}

/** '방금 이적' 띠(웹 .mk-live) — 첫 페이지 응답의 최근 거래를 한 줄씩 넘긴다. 서버는 다시 부르지 않는다. */
export function LiveStrip({
  recent,
  local,
}: {
  recent: MarketSale[];
  local: ReadonlyMap<string, string>;
}) {
  const c = useColors();
  const { motionOK } = useSnapshot(prefs);
  const [tick, setTick] = useState(0);
  const [openAll, setOpenAll] = useState(false);
  const fade = useRef(new Animated.Value(1)).current;
  const pulse = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (openAll || recent.length < 2) return;
    const t = setInterval(() => setTick((n) => n + 1), MARKET_TICKER_MS);
    return () => clearInterval(t);
  }, [openAll, recent]);
  useEffect(() => {
    if (!motionOK) return;
    fade.setValue(0);
    Animated.timing(fade, { toValue: 1, duration: 350, useNativeDriver: true }).start();
  }, [tick, motionOK, fade]);
  useEffect(() => {
    if (!motionOK) return;
    const loop = Animated.loop(
      Animated.timing(pulse, { toValue: 1, duration: 1600, useNativeDriver: true }),
    );
    loop.start();
    return () => loop.stop();
  }, [motionOK, pulse]);
  const live = recent[tick % recent.length];
  if (!live) return null;
  return (
    <View
      testID="market-live"
      style={{
        borderWidth: 1,
        borderColor: 'transparent',
        borderRadius: RADIUS.md,
        backgroundColor: c.surface,
      }}
    >
      <Press
        scale={0.99}
        accessibilityRole="button"
        accessibilityLabel={L.liveAll({ n: recent.length })}
        accessibilityState={{ expanded: openAll }}
        onPress={() => setOpenAll((v) => !v)}
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: 8,
          minHeight: 44,
          paddingHorizontal: 12,
        }}
      >
        <View style={{ width: 8, height: 8 }}>
          <Animated.View
            style={{
              position: 'absolute',
              width: 8,
              height: 8,
              borderRadius: 4,
              backgroundColor: c.bad,
              opacity: pulse.interpolate({ inputRange: [0, 1], outputRange: [0.5, 0] }),
              transform: [
                { scale: pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 2.6] }) },
              ],
            }}
          />
          <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: c.bad }} />
        </View>
        <Txt style={{ fontSize: rem(FONT.caption), fontWeight: '700', color: c.bad }}>
          {L.justSold}
        </Txt>
        <Animated.View
          style={{
            flex: 1,
            minWidth: 0,
            opacity: fade,
            transform: [
              { translateY: fade.interpolate({ inputRange: [0, 1], outputRange: [8, 0] }) },
            ],
          }}
        >
          <Txt numberOfLines={1} style={{ fontSize: rem(FONT.label) }}>
            {saleText(live, local)}
          </Txt>
        </Animated.View>
        <Txt tone="muted" style={{ fontSize: rem(FONT.caption2) }}>
          {agoKo(Date.now() - Date.parse(live.soldAt))}
        </Txt>
      </Press>
      {openAll ? (
        <View style={{ paddingHorizontal: 12, borderTopWidth: 1, borderTopColor: c.line }}>
          {recent.map((s, i) => (
            <View
              key={s.id}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: 10,
                paddingVertical: 8,
                borderTopWidth: i ? 1 : 0,
                borderTopColor: c.line,
              }}
            >
              <MiniCard c={s.card} name={marketName(s.card, local)} />
              <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
                <Txt bold numberOfLines={1}>
                  {marketName(s.card, local)}
                </Txt>
                <Txt tone="muted" style={{ fontSize: rem(FONT.caption) }}>
                  <StyleTag card={s.card} />
                  {L.liveBase({
                    ago: agoKo(Date.now() - Date.parse(s.soldAt)),
                    value: fmtValue(s.card.cardValue),
                  })}
                </Txt>
              </View>
              <Txt bold num style={{ fontSize: rem(FONT.body2) }}>
                {fmtValue(s.price)}
              </Txt>
            </View>
          ))}
        </View>
      ) : null}
    </View>
  );
}

export const small = { fontSize: rem(FONT.body2) } as const;
export const tiny = { fontSize: rem(FONT.caption) } as const;

/** T-11-356 선수 유형(스피드스터 등) — 줄 아래 한 줄 앞에 굵게(카드 상세의 유형 띠와 같은 이름). 없으면 그리지 않는다. */
export function StyleTag({ card }: { card: MarketCard }) {
  const style = cardStyle(card);
  return style ? <Txt bold style={tiny}>{`${style} · `}</Txt> : null;
}
