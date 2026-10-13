// T-11-128 결산 단체사진(웹 RecapTeamPhoto.svelte) — 그 시즌에 키운 선수들을 국가대표 단체사진처럼 세운다.
// 얼굴은 커리어 ID, 유니폼은 마지막 구단(명예의 전당 시상대와 같은 전성기 도트). 대표 선수(1등)는 가운데에 주장 완장.
// 도트는 24×32칸의 정수배(48×64)로 그려 칸이 고르다. 처음 그려질 때 플래시가 한 번 터진다(동작 줄이기면 없다).
import { useEffect, useId, useMemo, useRef } from 'react';
import { Animated, Easing, useWindowDimensions, View } from 'react-native';
import Svg, { Circle, Defs, Pattern, Rect } from 'react-native-svg';
import { useSnapshot } from 'valtio';
import type { RecapSquadMember } from '@offside/contracts';
import { primeAvatarSpec } from '@offside/game/avatar';
import { playerName } from '@offside/app-core/format';
import { PHOTO_MAX, photoRows } from '@offside/app-core/seasonRecap';
import { seasonRecapText as L } from '@offside/app-core/i18n/ko/seasonRecap';
import { PixelAvatar } from '../../../ui/PixelAvatar';
import { Txt } from '../../../ui';
import { prefs } from '../../../store';
import { DISPLAY, rem } from '../../../theme/type';

const nameOf = (m: RecapSquadMember) => playerName(m.card.publicName, m.card.pos, m.card.number);

/** 경기장 바탕 — 위 42%는 관중석(점), 아래는 줄무늬 잔디. 테마와 상관없이 같은 사진. */
function Stadium() {
  const uid = useId().replace(/[^a-zA-Z0-9]/g, '');
  return (
    <Svg
      width="100%"
      height="100%"
      style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
      pointerEvents="none"
    >
      <Defs>
        <Pattern id={`${uid}g`} patternUnits="userSpaceOnUse" width="56" height="10">
          <Rect x="0" y="0" width="28" height="10" fill="#2f7a4c" />
          <Rect x="28" y="0" width="28" height="10" fill="#2a6f45" />
        </Pattern>
        <Pattern id={`${uid}d`} patternUnits="userSpaceOnUse" width="9" height="9">
          <Circle cx="2" cy="2" r="1" fill="#ffffff" fillOpacity={0.08} />
        </Pattern>
      </Defs>
      <Rect width="100%" height="100%" fill={`url(#${uid}g)`} />
      <Rect width="100%" height="42%" fill="#22374a" />
      <Rect width="100%" height="42%" fill={`url(#${uid}d)`} />
    </Svg>
  );
}

export function RecapTeamPhoto({
  squad,
  season,
}: {
  squad: readonly RecapSquadMember[];
  season: string;
}) {
  const { width } = useWindowDimensions();
  const { motionOK } = useSnapshot(prefs);
  const captain = squad[0]?.card.careerId;
  // 앞줄이 0번이라 뒤집어 뒷줄부터 그린다. 모습은 선수 목록이 바뀔 때만 만든다.
  const rows = useMemo(
    () =>
      photoRows(squad)
        .reverse()
        .map((row) =>
          row.map((m) => {
            const spec = primeAvatarSpec({
              id: m.card.careerId,
              lastClub: m.lastClub ?? '',
              lastClubId: m.lastClubId,
              look: m.look,
            });
            return {
              id: m.card.careerId,
              spec:
                m.card.careerId === captain
                  ? { ...spec, acc: [...spec.acc, 'armband' as const] }
                  : spec,
            };
          }),
        ),
    [squad, captain],
  );
  const more = Math.max(0, squad.length - PHOTO_MAX);
  // 좁은 폰(360 이하)에서도 한 줄 8명이 들어가게 더 겹쳐 선다(도트는 정수배 48×64 그대로).
  const overlap = width <= 360 ? -9 : -6;

  // 처음 그려질 때 플래시가 한 번 터지고 선수들이 살짝 내려앉는다.
  const shot = useRef(new Animated.Value(motionOK ? 0 : 1)).current;
  useEffect(() => {
    if (!motionOK) return;
    const run = Animated.timing(shot, {
      toValue: 1,
      duration: 900,
      easing: Easing.out(Easing.quad),
      useNativeDriver: true,
    });
    run.start();
    return () => run.stop();
  }, [motionOK, shot]);

  const label = L.photoAria({
    season,
    names: squad.slice(0, PHOTO_MAX).map(nameOf).join(', '),
  });
  return (
    <View testID="recap-photo" style={{ gap: 8 }}>
      <View
        accessible
        accessibilityRole="image"
        accessibilityLabel={label}
        style={{
          overflow: 'hidden',
          justifyContent: 'flex-end',
          alignItems: 'center',
          minHeight: 168,
          paddingTop: 34,
          paddingBottom: 14,
          paddingHorizontal: 6,
          borderRadius: 14,
        }}
      >
        <Stadium />
        <View
          pointerEvents="none"
          style={{ position: 'absolute', top: 8, left: 0, right: 0, alignItems: 'center' }}
        >
          <View
            style={{
              paddingHorizontal: 12,
              paddingVertical: 2,
              borderRadius: 4,
              backgroundColor: '#f0b437',
            }}
          >
            <Txt
              numberOfLines={1}
              style={{
                color: '#231700',
                fontFamily: DISPLAY[800],
                fontSize: rem(0.8125),
                letterSpacing: 0.06 * 13,
                includeFontPadding: false,
              }}
            >
              {L.photoCaption({ season })}
            </Txt>
          </View>
        </View>
        <Animated.View
          style={{
            alignItems: 'center',
            transform: [
              {
                translateY: shot.interpolate({
                  inputRange: [0, 0.65],
                  outputRange: [4, 0],
                  extrapolate: 'clamp',
                }),
              },
            ],
          }}
        >
          {rows.map((row, r) => (
            <View
              key={r}
              style={{
                flexDirection: 'row',
                flexWrap: 'nowrap',
                justifyContent: 'center',
                // 뒷줄일수록 위로 겹쳐 서고, 한 줄은 살짝 겹쳐 붙는다. 짝수 번째 줄은 조금 옆으로 선다.
                marginTop: r === 0 ? 0 : -22,
                transform: [{ translateX: r % 2 === 1 ? 6 : 0 }],
              }}
            >
              {row.map((p) => (
                <View
                  key={p.id}
                  style={{ width: 48, height: 64, marginHorizontal: overlap }}
                  importantForAccessibility="no-hide-descendants"
                  accessibilityElementsHidden
                >
                  <PixelAvatar spec={p.spec} width={48} />
                </View>
              ))}
            </View>
          ))}
        </Animated.View>
        <Animated.View
          pointerEvents="none"
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: '#fff',
            opacity: shot.interpolate({ inputRange: [0, 1], outputRange: [0.9, 0] }),
          }}
        />
      </View>
      <View style={{ flexDirection: 'row', justifyContent: 'center', gap: 6 }}>
        <Txt bold style={{ fontSize: rem(0.8125) }}>
          {L.photoCaption({ season })}
        </Txt>
        {more > 0 ? (
          <Txt tone="muted" style={{ fontSize: rem(0.8125) }}>
            {L.photoMore({ n: more })}
          </Txt>
        ) : null}
      </View>
    </View>
  );
}
