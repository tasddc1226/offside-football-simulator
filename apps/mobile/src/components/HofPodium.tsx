import { useWindowDimensions, View } from 'react-native';
import type { PublicHofEntry } from '@offside/contracts';
import { flagOf, DEFAULT_NATION, NATION_BY_CODE } from '@offside/contracts/nations';
import { posAbbr, posLabel } from '@offside/game/data';
import {
  PODIUM_FACE_BOTTOM,
  PODIUM_FACE_TOP,
  PODIUM_H,
  PODIUM_TONES,
  PODIUM_W,
  podiumRects,
} from '@offside/game/podium';
import { useState, type ReactNode } from 'react';
import Svg, { Rect } from 'react-native-svg';
import { anonName } from '@offside/app-core/format';
import { openPublicLegend } from '../game/host';
import { ClubMark } from '../ui/ClubBadge';
import { Press } from '../ui/Press';
import { Txt } from '../ui/Txt';
import { RankBadge } from './Laurel';
import { PrimeAvatar } from './PrimeAvatar';
import { avatarWidth } from '@offside/game/avatar';
import { hofText as L } from '@offside/app-core/i18n/ko/hof';
import { tn } from '@offside/game/i18n/names';

export function HofPodium({
  players,
  showPosition,
  myIds,
  metric,
  unit,
}: {
  players: readonly PublicHofEntry[];
  showPosition: boolean;
  myIds: ReadonlySet<string>;
  metric: (entry: PublicHofEntry) => number | string;
  unit: string;
}) {
  const { width } = useWindowDimensions();
  const ranked = players.map((entry, index) => ({ entry, rank: entry.rank ?? index + 1 }));
  const slots = [2, 1, 3]
    .map((rank) => ranked.find((player) => player.rank === rank))
    .filter((player) => !!player);
  return (
    <View
      testID="hof-podium"
      style={{
        flexDirection: 'row',
        alignItems: 'flex-end',
        gap: 6,
        marginTop: 8,
        marginBottom: 12,
      }}
    >
      {slots.map(({ entry, rank }) => {
        const nation =
          NATION_BY_CODE.get(entry.nation ?? DEFAULT_NATION) ?? NATION_BY_CODE.get(DEFAULT_NATION)!;
        const mine = myIds.has(entry.id);
        const name = entry.name ?? anonName(entry.pos, entry.number);
        return (
          <Press
            key={entry.id}
            scale={1}
            testID={`hof-podium-rank-${rank}`}
            onPress={() => void openPublicLegend(entry)}
            accessibilityLabel={L.podiumPlayerApp({
              rank,
              name,
              country: tn(nation.ko),
              pos: showPosition ? posLabel(entry) : '',
              value: String(metric(entry)),
              unit,
              mine,
            })}
            style={{ flex: 1, minWidth: 0 }}
          >
            <View style={{ alignItems: 'center', gap: 4, paddingBottom: 10, zIndex: 1 }}>
              <RankBadge rank={rank} width={40} />
              {/* 국기는 이름 앞, 엠블럼은 은퇴 시점 구단 이름 앞. */}
              <Txt
                bold
                center
                numberOfLines={2}
                style={{
                  fontSize: rank === 1 ? 16 : 14,
                  width: '100%',
                }}
              >
                <Txt
                  testID={`hof-nation-${nation.code}`}
                  accessibilityLabel={tn(nation.ko)}
                  style={{ fontSize: 16 }}
                >
                  {flagOf(nation.code)}
                </Txt>{' '}
                {name}
                {showPosition ? (
                  <Txt tone="muted" style={{ fontSize: 12, fontWeight: '600' }}>
                    {' '}
                    {posAbbr(entry)}
                  </Txt>
                ) : null}
              </Txt>
              {entry.lastClub ? (
                <View
                  testID="hof-podium-club"
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 4,
                    maxWidth: '100%',
                  }}
                >
                  <ClubMark name={entry.lastClub} id={entry.lastClubId} size={16} />
                  <Txt tone="muted" numberOfLines={1} style={{ fontSize: 12, flexShrink: 1 }}>
                    {tn(entry.lastClub)}
                  </Txt>
                </View>
              ) : null}
              {mine ? (
                <Txt tone="muted" center style={{ fontSize: 12 }}>
                  {L.mine}
                </Txt>
              ) : null}
              {/* T-11-124 시상대 위에 선 전성기 모습(마지막 구단 유니폼). 2·3위 2배, 1위 3배(좁은 화면은 2배). */}
              <View
                style={{
                  marginTop: 2,
                  // 단상 윗면(밟는 곳)에 서도록: 프로필 여백 10 + 그림 아래 빈 두 줄 + 윗면 깊이 8.
                  marginBottom: -(18 + (2 * (rank === 1 ? avatarWidth(width) : 48)) / 24),
                }}
              >
                <PrimeAvatar
                  id={entry.id}
                  lastClub={entry.lastClub}
                  lastClubId={entry.lastClubId}
                  width={rank === 1 ? avatarWidth(width) : 48}
                />
              </View>
            </View>
            {/* 도트 단상(podium.ts). 값·순위는 앞면 위에 겹쳐 쓴다. */}
            <PodiumStep rank={rank as 1 | 2 | 3}>
              <Txt
                num
                center
                style={{
                  fontSize: rank === 1 ? 22 : 19,
                  lineHeight: 26,
                  color: PODIUM_TONES[rank as 1 | 2 | 3].ink,
                }}
              >
                {metric(entry)}
                <Txt style={{ fontSize: 12, color: PODIUM_TONES[rank as 1 | 2 | 3].ink }}>
                  {unit}
                </Txt>
              </Txt>
              <Txt center bold style={{ fontSize: 12, color: PODIUM_TONES[rank as 1 | 2 | 3].ink }}>
                {L.rankN({ rank })}
              </Txt>
            </PodiumStep>
          </Press>
        );
      })}
    </View>
  );
}

// 단상 그림은 순위마다 하나라 모듈에서 한 번만 만든다.
const PODIUM_RECTS = { 1: podiumRects(1), 2: podiumRects(2), 3: podiumRects(3) };

/** 도트 단상 하나. 칸 폭에 맞춰 늘리고(비율 유지), 앞면 자리에 children을 겹친다. */
function PodiumStep({ rank, children }: { rank: 1 | 2 | 3; children: ReactNode }) {
  const [w, setW] = useState(0);
  const unitPx = w / PODIUM_W;
  return (
    <View onLayout={(e) => setW(e.nativeEvent.layout.width)} style={{ width: '100%' }}>
      {w > 0 ? (
        <Svg
          width={w}
          height={unitPx * PODIUM_H[rank]}
          viewBox={`0 0 ${PODIUM_W} ${PODIUM_H[rank]}`}
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
        >
          {PODIUM_RECTS[rank].map((r, i) => (
            <Rect key={i} x={r.x} y={r.y} width={r.w} height={1} fill={r.fill} />
          ))}
        </Svg>
      ) : null}
      <View
        style={{
          position: 'absolute',
          left: '6%',
          right: '6%',
          top: unitPx * PODIUM_FACE_TOP,
          bottom: unitPx * PODIUM_FACE_BOTTOM,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {children}
      </View>
    </View>
  );
}
