// T-11-735 은퇴 리포트 · 명예의 전당의 '대표 소장품' 장면(웹 auction/AuctionCredit.svelte) — 높은 등급 순 3개.
import { View } from 'react-native';
import { auctionCredit } from '@offside/app-core/auction-view';
import { gameAuctionText as L } from '@offside/app-core/i18n/ko/gameAuction';
import type { AuctionKind } from '@offside/game/types';
import { AuctionIcon } from '../../components/AuctionIcon';
import { Reveal } from './credit';
import { FilmPill, FText, H2, Kicker, useFilm } from './film';

export function AuctionCredit({ items }: { items: { k: AuctionKind; g: number }[] }) {
  const f = useFilm();
  const list = auctionCredit(items);
  return (
    <Reveal testID="credit-auction">
      <View style={{ alignItems: 'center', gap: 10 }}>
        <View style={{ alignItems: 'center' }}>
          <Kicker>Collection</Kicker>
          <H2>{L.creditTitle}</H2>
        </View>
        <View style={{ flexDirection: 'row', gap: 10, alignSelf: 'stretch' }}>
          {list.map((x) => {
            const gold = x.g >= 3;
            const color = gold ? f.gold : f.ink;
            return (
              <View
                key={`${x.k}-${x.g}`}
                testID={`auction-item-${x.k}-${x.g}`}
                style={{ flex: 1, alignItems: 'center', gap: 6 }}
              >
                <View
                  style={{
                    width: 56,
                    height: 56,
                    borderRadius: 28,
                    borderWidth: 1.5,
                    borderColor: color,
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <AuctionIcon d={x.icon} size={30} color={color} />
                </View>
                <FText bold size={0.875} center>
                  {x.name}
                </FText>
                <FilmPill gold={x.g >= 4}>{x.grade}</FilmPill>
              </View>
            );
          })}
        </View>
      </View>
    </Reveal>
  );
}
