import { useWindowDimensions, View } from 'react-native';
import type { PublicHofEntry } from '@offside/contracts';
import { flagOf, DEFAULT_NATION, NATION_BY_CODE } from '@offside/contracts/nations';
import { posLabel } from '@offside/game/data';
import { anonName } from '@offside/app-core/format';
import { openPublicLegend } from '../game/host';
import { alpha } from '../theme/colors';
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
        const color = rank === 1 ? '#d99a12' : rank === 2 ? '#8fa096' : '#b67c47';
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
            <View style={{ alignItems: 'center', gap: 4, paddingBottom: 10 }}>
              <RankBadge rank={rank} width={40} />
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
                <ClubMark name={entry.lastClub} id={entry.lastClubId} size={20} />
                <Txt
                  testID={`hof-nation-${nation.code}`}
                  accessibilityLabel={tn(nation.ko)}
                  style={{ fontSize: 16 }}
                >
                  {flagOf(nation.code)}
                </Txt>
              </View>
              <Txt
                bold
                center
                numberOfLines={2}
                style={{
                  fontSize: rank === 1 ? 16 : 14,
                  minHeight: rank === 1 ? 45 : 40,
                  width: '100%',
                }}
              >
                {name}
              </Txt>
              {showPosition || mine ? (
                <Txt tone="muted" center style={{ fontSize: 12 }}>
                  {[showPosition ? posLabel(entry) : '', mine ? L.mine : '']
                    .filter(Boolean)
                    .join(' · ')}
                </Txt>
              ) : null}
              {/* T-11-124 시상대 위에 선 전성기 모습(마지막 구단 유니폼). 2·3위 2배, 1위 3배(좁은 화면은 2배). */}
              <View style={{ marginTop: 2, marginBottom: -10 }}>
                <PrimeAvatar
                  id={entry.id}
                  lastClub={entry.lastClub}
                  lastClubId={entry.lastClubId}
                  width={rank === 1 ? avatarWidth(width) : 48}
                />
              </View>
            </View>
            <View
              style={{
                minHeight: rank === 1 ? 96 : rank === 2 ? 76 : 56,
                borderWidth: 1,
                borderBottomWidth: 0,
                borderColor: alpha(color, 0.4),
                borderTopLeftRadius: 8,
                borderTopRightRadius: 8,
                backgroundColor: alpha(color, rank === 1 ? 0.18 : 0.1),
                alignItems: 'center',
                justifyContent: 'center',
                gap: 4,
                padding: 4,
              }}
            >
              <Txt num center style={{ fontSize: rank === 1 ? 24 : 21, lineHeight: 30 }}>
                {metric(entry)}
                <Txt style={{ fontSize: 12 }}>{unit}</Txt>
              </Txt>
              <Txt tone="muted" center style={{ fontSize: 12 }}>
                {L.rankN({ rank })}
              </Txt>
            </View>
          </Press>
        );
      })}
    </View>
  );
}
