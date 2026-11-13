import { RADIUS } from '@offside/app-core/design-tokens';
import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { Animated, Easing, Text, View } from 'react-native';
import Svg, {
  Circle,
  ClipPath,
  Defs,
  G,
  LinearGradient,
  Path,
  RadialGradient,
  Rect,
  Stop,
  Text as SvgText,
} from 'react-native-svg';
import { useSnapshot } from 'valtio';
import { cardAvatarSpec } from '@offside/game/avatar';
import { PixelAvatar } from '../ui/PixelAvatar';
import { prefs } from '../store';
import { DISPLAY } from '../theme/type';
import { RN_SHIRT, RN_TRIM } from '@offside/app-core/rnStyle';
import { FACE_ABBR, GK_ABBR } from '@offside/game/attributes';
import { typeName } from '@offside/game/data';
import type { TeamPlayer } from '@offside/app-core/api/team';
import { DEFAULT_NATION, NATION_BY_CODE, flagOf } from '@offside/contracts/nations';
import { teamHomeText as L } from '@offside/app-core/i18n/ko/teamHome';
import {
  cardBody,
  cardFootNote,
  cardSeasonBadge,
  cardSeasonColor,
  cardTier,
} from '@offside/app-core/format';
import { intlLocale } from '@offside/app-core/i18n/core';
import { tn } from '@offside/game/i18n/names';
import { teamSeasonLabel } from '@offside/app-core/seasonName';
import { enhanceFx, type EnhanceFx } from '@offside/app-core/cardEnhanceFx';
import { showsPosOvr } from '@offside/app-core/cardEnhance';
import { specialRibbon, type SpecialRibbon } from '@offside/app-core/cardSpecial';
import type { CardSpecialMark } from '@offside/contracts/card-special';

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
  careerId?: string | undefined;
  look?: string | null | undefined;
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
  /** 플레이스타일(커리어 유형 id — 시너지 듀오의 기준). 큰 카드에만 보인다. */
  type?: string | null | undefined;
  /** T-11-114 카드 시즌(0 = 프리시즌) — 뱃지. 모르면 없다. */
  season?: number | undefined;
  /** T-11-180 키(cm)·몸무게(kg) — 큰 카드의 LS 아래. 옛 커리어는 없다. */
  height?: number | undefined;
  weight?: number | undefined;
  /** T-11-211 주발(한국어 저장값) — 체격 줄 끝. 옛 응답에는 없다. */
  foot?: string | null | undefined;
  /** T-11-188 잠긴 선수 — 오른쪽 위 자물쇠. */
  locked?: boolean | undefined;
  /** T-11-373 카드 강화 단계 — 자물쇠 아래 배지. */
  enhance?: number | undefined;
  /** T-11-372 시즌 특별 카드 표식 — 테두리 색 · 띠. 없으면 빈 칸. */
  specials?: readonly CardSpecialMark[] | undefined;
  /** T-11-723 오늘의 랭킹 순위(1 · 2 · 3). */
  daily?: number | undefined;
  youth: boolean;
};

/**
 * T-11-373 강화 단계 그림(웹 PlayerCard .card-fx와 같은 장면). 목록의 작은 카드가 많아도 부담이 없도록 그림은 멈춰 있고, 큰 카드의 +3 이상만
 * 빛을 천천히 깜빡인다(EnhanceFxPulse). 목록의 작은 장식을 무한 반복하면 안드로이드 ANR이 늘어서(T-11-602) 작은 카드는 움직이지 않는다.
 */
function EnhanceFxArt({ level, uid, shield }: { level: number; uid: string; shield: string }) {
  const line = `url(#${uid}fx)`;
  return (
    <>
      <Defs>
        <ClipPath id={`${uid}clip`}>
          <Path d={shield} />
        </ClipPath>
        <RadialGradient id={`${uid}flare`} cx="50%" cy="100%" r="70%">
          <Stop offset="0" stopColor="#ff6a2b" stopOpacity={0.75} />
          <Stop offset="1" stopColor="#ff6a2b" stopOpacity={0} />
        </RadialGradient>
      </Defs>
      <G clipPath={`url(#${uid}clip)`}>
        {level === 1 ? (
          <Path
            d="M0 120H12V174H0ZM24 120H36V174H24ZM48 120H60V174H48ZM72 120H84V174H72ZM96 120H100V174H96Z"
            fill="#35d68a"
            fillOpacity={0.16}
          />
        ) : null}
        {level === 2 ? (
          <Path d="M0 0L34 0L0 90ZM100 0L66 0L100 90Z" fill="#ffffff" fillOpacity={0.3} />
        ) : null}
        {level === 3 ? (
          <Rect x={0} y={80} width={100} height={94} fill={`url(#${uid}flare)`} />
        ) : null}
        {level === 4 ? (
          <>
            <Path
              d="M17 0V174M33 0V174M50 0V174M67 0V174M83 0V174"
              stroke="#7a5cff"
              strokeOpacity={0.3}
              strokeWidth={0.6}
            />
            <Path d="M70 0V174" stroke="#7cf8ff" strokeWidth={1.4} />
          </>
        ) : null}
        {level === 5 || level === 10 ? (
          <Path
            d="M-10 70L55 0H78L-10 96ZM20 174L110 80V106L46 174Z"
            fill={line}
            fillOpacity={0.28}
          />
        ) : null}
        {level === 6 ? (
          <Circle
            cx={50}
            cy={72}
            r={44}
            fill="none"
            stroke="#fff3b0"
            strokeOpacity={0.5}
            strokeWidth={2}
            strokeDasharray="1 10.5"
          />
        ) : null}
        {level === 7 ? (
          <>
            <Path
              d="M0 20L60 80M0 50L60 110M20 0L100 80M50 0L100 50M100 20L40 80M100 50L40 110M80 0L0 80M50 0L0 50"
              stroke="#ffffff"
              strokeOpacity={0.22}
              strokeWidth={0.6}
            />
            <Rect x={0} y={40} width={100} height={90} fill="#ff3b4e" fillOpacity={0.12} />
          </>
        ) : null}
        {level === 8 ? (
          <Rect x={0} y={0} width={100} height={174} fill="#1d4fff" fillOpacity={0.16} />
        ) : null}
        {level === 9 ? (
          <Rect x={0} y={0} width={100} height={70} fill={line} fillOpacity={0.3} />
        ) : null}
        {level === 10 ? (
          <Path
            d="M50 72L20 0H34ZM50 72L60 0H74ZM50 72L100 30V48ZM50 72L100 110V128ZM50 72L60 174H42ZM50 72L0 128V110ZM50 72L0 48V30Z"
            fill="#fff1a8"
            fillOpacity={0.35}
          />
        ) : null}
        {(level === 5 ? STARS : level >= 8 ? [...STARS, ...STARS_MORE] : []).map(([x, y, r]) => (
          <Path
            key={`${x}`}
            d={`M${x} ${y - r}L${x + r / 5} ${y - r / 5}L${x + r} ${y}L${x + r / 5} ${y + r / 5}L${x} ${y + r}L${x - r / 5} ${y + r / 5}L${x - r} ${y}L${x - r / 5} ${y - r / 5}Z`}
            fill={level === 8 || level === 9 ? '#ffe27a' : '#ffffff'}
          />
        ))}
        {level === 3 ? (
          <>
            <Circle cx={24} cy={128} r={0.9} fill="#fff3b0" />
            <Circle cx={66} cy={140} r={0.9} fill="#ffd34d" />
            <Circle cx={80} cy={118} r={0.7} fill="#ffb14d" />
          </>
        ) : null}
      </G>
      <Path
        d={shield}
        fill="none"
        stroke={line}
        strokeOpacity={0.3}
        strokeWidth={Math.min(3 + level, 9)}
      />
      <Path
        d={shield}
        fill="none"
        stroke={line}
        strokeWidth={level >= 10 ? 4.2 : level >= 5 ? 3.4 : level >= 3 ? 2.8 : 2.2}
      />
    </>
  );
}

/** 별 자리 [x, y, 크기](viewBox 0 0 100 174). */
const STARS = [
  [66, 34, 6],
  [14, 78, 4],
  [80, 122, 5],
  [32, 146, 3.5],
] as const;

const STARS_MORE = [
  [40, 56, 4.5],
  [86, 66, 4],
  [10, 114, 4.5],
  [58, 152, 5],
] as const;

/** 큰 카드 +3 이상의 빛 깜빡임. 네이티브 드라이버 투명도 하나만 움직인다. */
function EnhanceFxPulse({
  width,
  height,
  shield,
  fx,
}: {
  width: number;
  height: number;
  shield: string;
  fx: EnhanceFx;
}) {
  const { motionOK } = useSnapshot(prefs);
  const opacity = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (!motionOK) return;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, {
          toValue: 1,
          duration: 1400,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: 0,
          duration: 1400,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [opacity, motionOK]);
  return (
    <Animated.View
      pointerEvents="none"
      style={{ position: 'absolute', left: 0, top: 0, width, height, opacity }}
    >
      <Svg width={width} height={height} viewBox="0 0 100 174" preserveAspectRatio="none">
        <Path d={shield} fill={fx.glow} fillOpacity={0.14} stroke="#ffffff" strokeWidth={1.2} />
      </Svg>
    </Animated.View>
  );
}

/** T-11-373 강화 단계 알약. */
function EnhancePill({ level, compact, fx }: { level: number; compact: boolean; fx: EnhanceFx }) {
  return (
    <View
      testID="card-enhance"
      style={{
        paddingHorizontal: compact ? 4 : 6,
        paddingVertical: 1,
        borderRadius: 999,
        backgroundColor: fx.stops[Math.floor((fx.stops.length - 1) / 2)],
        borderWidth: 1,
        borderColor: '#ffffff88',
      }}
    >
      <Text
        maxFontSizeMultiplier={1.1}
        style={{
          color: fx.badgeInk,
          fontWeight: '800',
          fontSize: compact ? 8 : 11,
          includeFontPadding: false,
        }}
      >
        {`+${level}`}
      </Text>
    </View>
  );
}

/**
 * T-11-373 카드 강화 배지 자리(웹 PlayerCard .card-enhance). 얼굴 · 등번호 · 이름을 가리지 않는 빈자리에 둔다. 큰 카드는 OVR 줄과
 * 초상화 사이, 그라운드 카드는 이름 아래, 이름이 없는 목록 카드는 오른쪽 아래. 자리 OVR이 있는 그라운드 카드는 그 값 옆에 붙인다.
 */
function EnhanceBadge({
  level,
  compact,
  mini,
  fx,
}: {
  level: number;
  compact: boolean;
  mini: boolean;
  fx: EnhanceFx;
}) {
  const place = !compact
    ? { top: 44, left: 44 }
    : mini
      ? { top: 50, right: 4 }
      : { top: 64, left: 0, right: 0, alignItems: 'center' as const };
  return (
    <View pointerEvents="none" style={{ position: 'absolute', ...place }}>
      <EnhancePill level={level} compact={compact} fx={fx} />
    </View>
  );
}

/** T-11-188 잠긴 선수 자물쇠(웹 PlayerCard .card-lock). */
function LockBadge({ compact }: { compact: boolean }) {
  const size = compact ? 14 : 22;
  return (
    <View
      accessibilityRole="image"
      accessibilityLabel={L.lockedAria}
      style={{
        position: 'absolute',
        // 작은 카드는 등번호를 가리지 않게 국기 위 모서리에 둔다.
        top: compact ? -3 : 30,
        right: compact ? 1 : 11,
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: '#000000aa',
        borderWidth: 1,
        borderColor: '#ffffff66',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Svg width={compact ? 9 : 13} height={compact ? 9 : 13} viewBox="0 0 16 16">
        <Rect x="3" y="7" width="10" height="7" rx="1.5" fill="#fff" />
        <Path
          d="M5.5 7V5a2.5 2.5 0 0 1 5 0v2"
          fill="none"
          stroke="#fff"
          strokeWidth={1.8}
          strokeLinecap="round"
        />
      </Svg>
    </View>
  );
}

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

/** T-11-372 시즌 특별 카드 띠(웹 PlayerCard .card-special) — 작은 카드는 아래쪽에 겹치고, 큰 카드는 맨 아래 줄. */
function SpecialBadge({ ribbon, compact }: { ribbon: SpecialRibbon; compact: boolean }) {
  const color = ribbon.color;
  return (
    <View
      testID="card-special"
      accessibilityLabel={ribbon.aria}
      pointerEvents="none"
      style={
        compact
          ? { position: 'absolute', bottom: 3, left: 0, right: 0, alignItems: 'center' }
          : { width: '100%', alignItems: 'center', marginTop: 4 }
      }
    >
      <Text
        numberOfLines={1}
        maxFontSizeMultiplier={1.1}
        style={{
          maxWidth: '92%',
          overflow: 'hidden',
          paddingHorizontal: compact ? 4 : 8,
          borderRadius: 3,
          backgroundColor: color.bg,
          color: color.ink,
          fontSize: compact ? 7 : 10,
          lineHeight: compact ? 10 : 15,
          fontWeight: '800',
          letterSpacing: 0.3,
          includeFontPadding: false,
        }}
      >
        {ribbon.text}
      </Text>
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

/** 큰 카드 높이(자리 OVR 줄 · 플레이스타일 줄 없이)와 플레이스타일 줄 높이 — 카드 팝업(PlayerPeek)도 같은 값을 쓴다. */
export const CARD_HEIGHT = 242;
export const CARD_STYLE_ROW = 19;
/** 키 · 몸무게 · 주발 줄 높이. 이 줄이 있으면 위 칸(그림 · LS)과 카드를 그만큼 늘린다(LS 아래로 겹치지 않게). */
export const CARD_BODY_ROW = 12;
/** T-11-372 큰 카드의 시즌 특별 카드 띠 줄 높이(표식이 있을 때만). */
export const CARD_SPECIAL_ROW = 20;

export function PlayerCard({
  cell,
  code,
  compact = false,
  mini = false,
  animate = true,
}: {
  cell: PlayerCardData;
  code: string;
  compact?: boolean;
  /** 이적시장 목록용 — compact에서 이름 줄을 뺀다(이름은 줄 옆에 따로 나온다). */
  mini?: boolean;
  animate?: boolean;
}) {
  const portrait = useMemo(
    () =>
      !cell.youth && cell.careerId
        ? cardAvatarSpec({ careerId: cell.careerId, look: cell.look })
        : null,
    [cell.youth, cell.careerId, cell.look],
  );
  const country = !cell.youth ? NATION_BY_CODE.get(cell.nation ?? DEFAULT_NATION) : undefined;
  const tone =
    CARD_TONES[cell.youth ? 'youth' : cardTier(cell.legendScore, cell.peak ?? cell.rating)];
  const uid = useId().replace(/[^a-zA-Z0-9]/g, '');
  const [cardWidth, setCardWidth] = useState(compact ? 62 : 100);
  const shirtWidth = compact ? 25 : Math.min(43, Math.max(24, cardWidth - 56));
  // 자리 OVR은 제 자리가 아닐 때만 — 같으면 같은 숫자가 두 번 보인다. 강화 OVR만큼 높은 것은 +N 배지로 안다(웹 PlayerCard).
  const level = cell.youth ? 0 : (cell.enhance ?? 0);
  const deployed = cell.peak !== undefined && showsPosOvr(cell.peak, cell.rating, level);
  // 플레이스타일(웹 PlayerCard .card-type). 자리가 좁은 compact 카드에는 넣지 않는다.
  const style = !compact && cell.pos ? typeName(cell.pos, cell.type) : null;
  const body = compact ? null : cardBody(cell);
  const ribbon = cell.youth ? null : specialRibbon(cell.specials, cell.daily);
  const special = ribbon?.color ?? null;
  // T-11-373 강화 단계 효과(등급 색 위에 입힌다).
  const fx = enhanceFx(level);
  const height = compact
    ? mini
      ? 68
      : 88
    : CARD_HEIGHT +
      (deployed ? 31 : 0) +
      (style ? CARD_STYLE_ROW : 0) +
      (body ? CARD_BODY_ROW : 0) +
      (ribbon ? CARD_SPECIAL_ROW : 0);
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
          {fx ? (
            <LinearGradient id={`${uid}fx`} x1="0" y1="0" x2="1" y2="1">
              {fx.stops.map((c, i) => (
                <Stop key={i} offset={i / (fx.stops.length - 1)} stopColor={c} />
              ))}
            </LinearGradient>
          ) : null}
        </Defs>
        <Path
          d={shield}
          fill={`url(#${uid}face)`}
          stroke={special ? special.bg : tone.line}
          strokeWidth={special ? 3 : 1.5}
        />
        {fx ? <EnhanceFxArt level={level} uid={uid} shield={shield} /> : null}
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
      {fx && level >= 3 && !compact && animate ? (
        <EnhanceFxPulse width={cardWidth} height={height} shield={shield} fx={fx} />
      ) : null}
      <View
        style={{
          flexDirection: 'row',
          width: '100%',
          height: compact ? 34 : 72 + (body ? CARD_BODY_ROW : 0),
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
          {portrait ? (
            <View
              style={{
                width: compact ? 27 : Math.min(76, Math.max(32, cardWidth - 56)),
                height: compact ? 24 : 48,
                alignItems: 'center',
                justifyContent: 'flex-end',
              }}
            >
              <PixelAvatar
                spec={portrait}
                width={compact ? 27 : Math.min(54, Math.max(32, cardWidth - 56))}
                portrait
              />
              {cell.number != null ? (
                <Text
                  accessible={false}
                  maxFontSizeMultiplier={1}
                  style={{
                    position: 'absolute',
                    right: 0,
                    bottom: 0,
                    paddingHorizontal: 2,
                    borderRadius: 2,
                    color: tone.light,
                    backgroundColor: tone.ink,
                    fontSize: compact ? 7 : 10,
                    lineHeight: compact ? 9 : 12,
                    fontFamily: DISPLAY[700],
                    includeFontPadding: false,
                  }}
                >
                  {cell.number}
                </Text>
              ) : null}
            </View>
          ) : (
            <CardShirt number={cell.number} youth={cell.youth} width={shirtWidth} tone={tone} />
          )}
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
          {body ? (
            <Text
              testID="card-body"
              numberOfLines={1}
              adjustsFontSizeToFit
              minimumFontScale={0.7}
              maxFontSizeMultiplier={1.15}
              style={{
                width: '100%',
                textAlign: 'center',
                color: tone.ink,
                fontSize: 8,
                lineHeight: 11,
                fontWeight: '700',
                includeFontPadding: false,
              }}
            >
              {body}
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
      {cell.locked && !cell.youth ? <LockBadge compact={compact} /> : null}
      {fx && !(compact && !mini && deployed) ? (
        <EnhanceBadge level={level} compact={compact} mini={mini} fx={fx} />
      ) : null}
      {mini ? null : (
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
      )}
      {style ? (
        <Text
          testID="card-type"
          numberOfLines={1}
          maxFontSizeMultiplier={1.1}
          style={{
            marginTop: 3,
            maxWidth: '100%',
            paddingHorizontal: 7,
            borderWidth: 0.5,
            borderColor: tone.line,
            borderRadius: RADIUS.pill,
            overflow: 'hidden',
            color: tone.ink,
            fontSize: 10,
            lineHeight: 15,
            fontWeight: '700',
            includeFontPadding: false,
          }}
        >
          {style}
        </Text>
      ) : null}
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
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 2 }}>
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
            {fx && compact && !mini ? <EnhancePill level={level} compact fx={fx} /> : null}
          </View>
        </View>
      ) : null}
      {!compact ? <CardAttributes cell={cell} color={tone.ink} /> : null}
      {ribbon ? <SpecialBadge ribbon={ribbon} compact={compact} /> : null}
    </View>
  );
}
