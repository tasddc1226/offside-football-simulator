import { useEffect, useId, useRef, useState } from 'react';
import { Animated, Easing, Text, View } from 'react-native';
import Svg, { Defs, LinearGradient, Path, Stop, Text as SvgText } from 'react-native-svg';
import { useSnapshot } from 'valtio';
import { prefs } from '../store';
import { DISPLAY } from '../theme/type';
import { RN_SHIRT, RN_TRIM } from '@offside/app-core/rnStyle';
import { FACE_ABBR, GK_ABBR } from '@offside/game/attributes';
import type { TeamPlayer } from '@offside/app-core/api/team';
import { DEFAULT_NATION, NATION_BY_CODE, flagOf } from '@offside/contracts/nations';
import { teamHomeText as L } from '@offside/app-core/i18n/ko/teamHome';
import { cardFootNote, cardSeasonBadge, cardSeasonColor, cardTier } from '@offside/app-core/format';
import { intlLocale } from '@offside/app-core/i18n/core';
import { tn } from '@offside/game/i18n/names';
import { teamSeasonLabel } from '@offside/app-core/seasonName';

/** Only overflowing names move; reduced motion keeps the full name accessible. */
function CardName({
  name,
  color,
  animate,
  compact,
}: {
  name: string;
  color: string;
  animate: boolean;
  compact: boolean;
}) {
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
  const style = {
    fontSize: compact ? 10.5 : 12,
    lineHeight: compact ? 16 : 19,
    fontWeight: '700' as const,
    color,
    includeFontPadding: false,
  };
  return (
    <View
      onLayout={(e) => setWidth(e.nativeEvent.layout.width)}
      style={{
        width: '100%',
        height: compact ? 18 : 23,
        overflow: 'hidden',
        justifyContent: 'center',
      }}
    >
      <Text
        accessible={false}
        maxFontSizeMultiplier={1.2}
        onTextLayout={(e) => setTextWidth(e.nativeEvent.lines[0]?.width ?? 0)}
        style={[style, { position: 'absolute', width: 2000, opacity: 0 }]}
      >
        {name}
      </Text>
      <Animated.Text
        accessibilityLabel={name}
        maxFontSizeMultiplier={1.2}
        numberOfLines={1}
        adjustsFontSizeToFit={!animate || !motionOK}
        minimumFontScale={0.5}
        style={[
          style,
          {
            width: animate && motionOK ? Math.max(width, textWidth) : width,
            textAlign: animate && motionOK && textWidth > width ? 'left' : 'center',
            transform: [{ translateX: offset }],
          },
        ]}
      >
        {name}
      </Animated.Text>
    </View>
  );
}

/** Collectible-card materials stay readable against both app themes and the pitch. */
export const CARD_TONES = {
  bronze: {
    light: '#f6dcc6',
    base: '#dcab84',
    shade: '#b97e55',
    line: '#8f5a35',
    ink: '#3a1f0e',
    shirt: '#6b3d20',
    shirtInk: '#f6dcc6',
  },
  silver: {
    light: '#f5f8fa',
    base: '#d8e2e6',
    shade: '#b2c3cd',
    line: '#839ba9',
    ink: '#223743',
    shirt: '#365464',
    shirtInk: '#f5f8fa',
  },
  gold: {
    light: '#fff2cd',
    base: '#ead096',
    shade: '#c29b50',
    line: '#a97b2f',
    ink: '#46320f',
    shirt: '#705025',
    shirtInk: '#fff2cd',
  },
  elite: {
    light: '#fff4c4',
    base: '#f2c95c',
    shade: '#d39a26',
    line: '#a8700f',
    ink: '#3b2604',
    shirt: '#7a5008',
    shirtInk: '#fff4c4',
  },
  legend: {
    light: '#3c5448',
    base: '#1d3529',
    shade: '#10271c',
    line: '#d7b56b',
    ink: '#ffedbd',
    shirt: '#d7b56b',
    shirtInk: '#10271c',
  },
  icon: {
    light: '#4a5a92',
    base: '#1d2547',
    shade: '#0f1633',
    line: '#e6c369',
    ink: '#ffe9b0',
    shirt: '#e6c369',
    shirtInk: '#0f1633',
  },
  youth: {
    light: '#edf5ed',
    base: '#d4e5d5',
    shade: '#acc8b2',
    line: '#78987f',
    ink: '#284b35',
    shirt: '#375e42',
    shirtInk: '#edf5ed',
  },
} as const;

function CardShirt({
  number,
  youth,
  width,
  tone,
}: {
  number: number | null | undefined;
  youth: boolean;
  width: number;
  tone: (typeof CARD_TONES)[keyof typeof CARD_TONES];
}) {
  return (
    <Svg
      width={width}
      height={(width * 124) / 120}
      viewBox="0 0 120 124"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      <Path d={RN_SHIRT} fill={tone.shirt} stroke={tone.ink} strokeOpacity={0.4} strokeWidth={2} />
      <Path d={RN_TRIM} fill="none" stroke={tone.light} strokeWidth={4} />
      <SvgText
        x={60}
        y={92}
        textAnchor="middle"
        fontFamily={DISPLAY[700]}
        fontSize={46}
        fill={tone.shirtInk}
      >
        {number ?? (youth ? '+' : '')}
      </SvgText>
    </Svg>
  );
}

export type PlayerCardData = {
  name: string;
  nation?: string | null;
  rating: number;
  peak?: number;
  number?: number | null;
  legendScore?: number | null;
  attrs?: TeamPlayer['attrs'];
  attrsEstimated?: boolean;
  /** T-11-080 카드 기준가(만 원). */
  cardValue?: number | null | undefined;
  pos?: TeamPlayer['pos'];
  /** T-11-114 카드 시즌(0 = 프리시즌) — 뱃지. 모르면 없다. */
  season?: number | undefined;
  youth: boolean;
};

/** T-11-114 카드 시즌 뱃지(웹 PlayerCard .card-season) — 카드 위쪽 가운데. */
function SeasonBadge({ season, compact }: { season: number; compact: boolean }) {
  return (
    <View
      pointerEvents="none"
      style={{
        position: 'absolute',
        top: compact ? 2 : 8,
        left: 0,
        right: 0,
        alignItems: 'center',
      }}
    >
      <View
        accessibilityLabel={teamSeasonLabel(season)}
        style={{
          paddingHorizontal: compact ? 3 : 5,
          paddingVertical: 1,
          borderRadius: 3,
          backgroundColor: cardSeasonColor(season),
          borderWidth: 0.5,
          borderColor: '#ffffff55',
        }}
      >
        <Text
          maxFontSizeMultiplier={1.1}
          style={{
            color: '#fff',
            fontSize: compact ? 7 : 9,
            lineHeight: compact ? 9 : 11,
            fontWeight: '800',
            letterSpacing: 0.5,
            includeFontPadding: false,
          }}
        >
          {cardSeasonBadge(season)}
        </Text>
      </View>
    </View>
  );
}

const CARD_STATS = {
  field: ['pac', 'sho', 'dri', 'pas', 'def', 'phy'],
  GK: ['def', 'phy', 'pas', 'pac', 'sho', 'dri'],
} as const;

function CardAttributes({ cell, color }: { cell: PlayerCardData; color: string }) {
  const order = CARD_STATS[cell.pos === 'GK' ? 'GK' : 'field'];
  const labels = cell.pos === 'GK' ? GK_ABBR : FACE_ABBR;
  const foot = cardFootNote(cell);
  return (
    <View style={{ width: '100%', marginTop: 8 }}>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', rowGap: 4 }}>
        {order.map((key) => (
          <View key={key} style={{ width: '33.333%', height: 34, alignItems: 'center' }}>
            <Text
              maxFontSizeMultiplier={1.15}
              style={{
                color,
                fontSize: 10,
                lineHeight: 12,
                fontWeight: '600',
                includeFontPadding: false,
              }}
            >
              {labels[key]}
            </Text>
            <Text
              numberOfLines={1}
              adjustsFontSizeToFit
              maxFontSizeMultiplier={1.1}
              style={{
                color,
                fontFamily: DISPLAY[700],
                fontSize: 19,
                lineHeight: 22,
                includeFontPadding: false,
              }}
            >
              {cell.attrs ? Math.round(cell.attrs[key]) : '—'}
            </Text>
          </View>
        ))}
      </View>
      {foot ? (
        <Text
          maxFontSizeMultiplier={1.15}
          style={{ color, fontSize: 10, lineHeight: 14, textAlign: 'center', marginTop: 4 }}
        >
          {foot}
        </Text>
      ) : null}
    </View>
  );
}

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
  const country = !cell.youth ? NATION_BY_CODE.get(cell.nation ?? DEFAULT_NATION) : undefined;
  const tone =
    CARD_TONES[cell.youth ? 'youth' : cardTier(cell.legendScore, cell.peak ?? cell.rating)];
  const uid = useId().replace(/[^a-zA-Z0-9]/g, '');
  const [cardWidth, setCardWidth] = useState(compact ? 62 : 100);
  const shirtWidth = compact ? 25 : Math.min(43, Math.max(24, cardWidth - 56));
  // 자리 OVR은 최고 OVR과 다를 때(제 자리가 아닐 때)만 — 같으면 같은 숫자가 두 번 보인다(웹 PlayerCard).
  const deployed = cell.peak !== undefined && cell.peak !== cell.rating;
  const height = compact ? 88 : 242 + (deployed ? 31 : 0);
  const shield = 'M2 14H17L25 5L50 1L75 5L83 14H98L97 149L88 161L50 173L12 161L3 149Z';
  return (
    <View
      onLayout={(e) => setCardWidth(e.nativeEvent.layout.width)}
      style={{
        width: '100%',
        height,
        paddingHorizontal: compact ? 5 : 8,
        paddingTop: compact ? 8 : 22,
        alignItems: 'center',
      }}
    >
      <Svg
        width={cardWidth}
        height={height}
        viewBox="0 0 100 174"
        preserveAspectRatio="none"
        style={{ position: 'absolute', left: 0, top: 0 }}
        pointerEvents="none"
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
      >
        <Defs>
          <LinearGradient id={`${uid}face`} x1="0" y1="0" x2="1" y2="1">
            <Stop offset="0" stopColor={tone.light} />
            <Stop offset="0.5" stopColor={tone.base} />
            <Stop offset="1" stopColor={tone.shade} />
          </LinearGradient>
        </Defs>
        <Path d={shield} fill={`url(#${uid}face)`} stroke={tone.line} strokeWidth="1.5" />
        <Path
          d="M7 21H20L28 12L50 8L72 12L80 21H93M8 147L16 157L50 166L84 157L92 147"
          fill="none"
          stroke={tone.light}
          strokeOpacity={0.7}
          strokeWidth={1}
        />
        <Path
          d="M43 26L91 44M41 33L90 51M40 40L89 58"
          fill="none"
          stroke={tone.line}
          strokeOpacity={0.18}
          strokeWidth={1}
        />
      </Svg>
      <View
        style={{
          flexDirection: 'row',
          width: '100%',
          height: compact ? 34 : 72,
          alignItems: 'flex-start',
          justifyContent: 'space-between',
        }}
      >
        <View style={{ alignItems: 'center', width: compact ? 25 : 36 }}>
          <Text
            numberOfLines={1}
            adjustsFontSizeToFit={!compact}
            minimumFontScale={0.8}
            maxFontSizeMultiplier={1.1}
            style={{
              fontFamily: DISPLAY[800],
              fontSize: compact ? ((cell.peak ?? cell.rating) >= 100 ? 17 : 22) : 32,
              lineHeight: compact ? 24 : 39,
              width: '100%',
              textAlign: 'center',
              color: tone.ink,
              includeFontPadding: false,
            }}
          >
            {cell.peak ?? cell.rating}
          </Text>
          <Text
            numberOfLines={1}
            maxFontSizeMultiplier={1.1}
            style={{
              fontFamily: DISPLAY[700],
              fontSize: compact ? 9 : 12,
              lineHeight: compact ? 10 : 15,
              color: tone.ink,
              includeFontPadding: false,
            }}
          >
            {code}
          </Text>
          {!compact && country ? (
            <Text
              accessibilityLabel={L.nationAria({ name: tn(country.ko) })}
              maxFontSizeMultiplier={1.1}
              style={{ fontSize: 18, lineHeight: 18, marginTop: 2, includeFontPadding: false }}
            >
              {flagOf(country.code)}
            </Text>
          ) : null}
        </View>
        <View
          style={{
            marginTop: compact ? 4 : 9,
            alignItems: 'center',
            flex: compact ? undefined : 1,
            minWidth: 0,
          }}
        >
          <CardShirt number={cell.number} youth={cell.youth} width={shirtWidth} tone={tone} />
          {!compact && cell.legendScore != null ? (
            <Text
              numberOfLines={1}
              adjustsFontSizeToFit
              minimumFontScale={0.7}
              maxFontSizeMultiplier={1.15}
              style={{
                width: '100%',
                textAlign: 'center',
                color: tone.ink,
                fontSize: 9,
                lineHeight: 13,
                marginTop: 3,
                includeFontPadding: false,
              }}
            >
              LS{' '}
              <Text style={{ fontFamily: DISPLAY[700], fontSize: 11 }}>
                {cell.legendScore.toLocaleString(intlLocale())}
              </Text>
            </Text>
          ) : null}
        </View>
      </View>
      {compact && country ? (
        <Text
          accessibilityLabel={L.nationAria({ name: tn(country.ko) })}
          maxFontSizeMultiplier={1.1}
          style={{
            position: 'absolute',
            top: 11,
            right: 5,
            fontSize: 11,
            lineHeight: 13,
            includeFontPadding: false,
          }}
        >
          {flagOf(country.code)}
        </Text>
      ) : null}
      {!cell.youth && cell.season !== undefined ? (
        <SeasonBadge season={cell.season} compact={compact} />
      ) : null}
      <View
        style={{
          width: '100%',
          marginTop: compact ? 1 : 3,
          paddingHorizontal: 1,
          borderTopWidth: 0.5,
          borderBottomWidth: 0.5,
          borderColor: tone.line,
        }}
      >
        <CardName name={cell.name} color={tone.ink} animate={animate} compact={compact} />
      </View>
      {deployed ? (
        <View style={{ alignItems: 'center', marginTop: 2 }}>
          <Text
            maxFontSizeMultiplier={1.1}
            style={{
              color: tone.ink,
              fontSize: compact ? 7.5 : 10,
              lineHeight: compact ? 9 : 12,
              includeFontPadding: false,
            }}
          >
            {L.posOvrLabel}
          </Text>
          <Text
            maxFontSizeMultiplier={1.1}
            style={{
              color: tone.ink,
              fontFamily: DISPLAY[700],
              fontSize: compact ? 12 : 14,
              lineHeight: compact ? 12 : 17,
              includeFontPadding: false,
            }}
          >
            {cell.rating}
          </Text>
        </View>
      ) : null}
      {!compact ? <CardAttributes cell={cell} color={tone.ink} /> : null}
    </View>
  );
}
