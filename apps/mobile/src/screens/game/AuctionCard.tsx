// T-11-735 선수 탭 '명품 경매' 카드(웹 auction/AuctionCard.svelte). 경매품을 고르고 한 번 더 눌러 사면 상자 열기 연출로 등급을 보여 준다.
// 앱은 시즌에 한 번 광고(광고 제거 구매자는 바로)로 경매품을 새로 받을 수 있다.
import { FONT, RADIUS } from '@offside/app-core/design-tokens';
import { useEffect, useState } from 'react';
import { View } from 'react-native';
import { useSnapshot } from 'valtio';
import {
  auctionView,
  doAuction,
  doAuctionRefresh,
  type AuctionOutcome,
} from '@offside/app-core/auction-view';
import { gameAuctionText as L } from '@offside/app-core/i18n/ko/gameAuction';
import { gameBoostText as B } from '@offside/app-core/i18n/ko/gameBoost';
import type { GameState } from '@offside/game/types';
import { AuctionFx } from '../../components/AuctionFx';
import { AuctionIcon, gradeColor } from '../../components/AuctionIcon';
import { save } from '../../game/host';
import { adFree, adsOff } from '../../platform/adFree';
import { claimReward, prepareReward, rewardOffer } from '../../platform/rewarded';
import { appState } from '../../store';
import { alpha } from '../../theme/colors';
import { rem } from '../../theme/type';
import { useColors } from '../../theme/useColors';
import { Btn } from '../../ui/Btn';
import { Card } from '../../ui/Card';
import { Press } from '../../ui/Press';
import { Txt } from '../../ui/Txt';

export function AuctionCard({ s }: { s: GameState }) {
  const c = useColors();
  const [arm, setArm] = useState<number | null>(null);
  const [fx, setFx] = useState<AuctionOutcome | null>(null);
  const [adBusy, setAdBusy] = useState(false);
  const [adMessage, setAdMessage] = useState('');
  const owned = adsOff(useSnapshot(adFree));
  const offer = rewardOffer('auction', owned);
  const v = auctionView(s, offer);
  const wantAd = !!v?.adButton && offer === 'ad';
  useEffect(() => {
    if (wantAd) prepareReward('auction');
  }, [wantAd]);
  if (!v) return null;
  const armed = arm != null ? v.lots[arm] : undefined;
  // s는 읽기 전용 스냅샷이라 스토어의 세이브를 고친다. 결과를 먼저 저장하고 연출을 연다.
  const onLot = (i: number) => {
    if (arm !== i) return setArm(i);
    setArm(null);
    const out = doAuction(appState.G!, i);
    if (!out) return;
    save();
    setFx(out);
  };
  const onRefresh = async () => {
    if (adBusy) return;
    setAdBusy(true);
    setAdMessage('');
    setArm(null);
    try {
      let done = '';
      const msg = await claimReward(
        'auction',
        () => {
          done = doAuctionRefresh(appState.G!) ?? '';
          if (done) save();
        },
        L.adWatch,
      );
      setAdMessage(msg || done);
    } finally {
      setAdBusy(false);
    }
  };
  return (
    <Card gap={0} testID="auction">
      {fx ? <AuctionFx out={fx} onDone={() => setFx(null)} /> : null}
      <Txt v="eyebrow">Auction</Txt>
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'baseline',
          justifyContent: 'space-between',
          marginBottom: 6,
        }}
      >
        <Txt v="h2" accessibilityRole="header">
          {L.title}
        </Txt>
        <Txt tone="muted" style={{ fontSize: rem(FONT.caption) }} testID="auction-count">
          {v.shelf.count}
        </Txt>
      </View>
      <Txt v="sm" testID="auction-line">
        {v.line}
      </Txt>
      <View style={{ flexDirection: 'row', gap: 8, marginVertical: 8 }}>
        {v.lots.map((lot) => {
          const on = arm === lot.i;
          const label =
            lot.status === 'got'
              ? L.got
              : lot.status === 'short'
                ? L.short
                : on
                  ? L.confirmBtn
                  : L.buy;
          return (
            <Press
              key={lot.i}
              testID={`auction-${lot.i}`}
              disabled={lot.status !== 'ready'}
              accessibilityRole="button"
              accessibilityState={{ selected: on, disabled: lot.status !== 'ready' }}
              accessibilityLabel={`${lot.name} · ${label}`}
              onPress={() => onLot(lot.i)}
              style={{
                flex: 1,
                alignItems: 'center',
                gap: 6,
                paddingVertical: 12,
                paddingHorizontal: 6,
                borderRadius: RADIUS.md,
                borderWidth: on ? 2 : 1,
                borderColor: on ? c.accent : c.line,
                backgroundColor: c.surface2,
                opacity: lot.status === 'got' ? 0.45 : lot.status === 'short' ? 0.55 : 1,
              }}
            >
              <AuctionIcon d={lot.icon} size={30} color={c.ink} />
              <Txt style={{ fontSize: rem(FONT.caption), textAlign: 'center' }}>{lot.name}</Txt>
              <View
                style={{
                  paddingHorizontal: 8,
                  paddingVertical: 2,
                  borderRadius: RADIUS.pill,
                  backgroundColor: on ? c.accent : alpha(c.ink, 0.08),
                }}
              >
                <Txt
                  style={{
                    fontSize: rem(FONT.caption),
                    fontWeight: '700',
                    color: on ? c.accentInk : c.ink,
                  }}
                >
                  {label}
                </Txt>
              </View>
            </Press>
          );
        })}
      </View>
      {armed ? (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6 }}>
          <Txt v="sm" style={{ flex: 1, color: c.bad }} testID="auction-confirm">
            {armed.confirm}
          </Txt>
          <Btn testID="auction-cancel" onPress={() => setArm(null)}>
            {L.cancel}
          </Btn>
        </View>
      ) : null}
      {v.adButton ? (
        <View style={{ marginVertical: 6, gap: 6 }} testID="auction-ad">
          <Txt v="sm" tone="muted">
            {adMessage || v.adNote}
          </Txt>
          <Btn
            kind="tonal"
            disabled={adBusy}
            testID="auction-ad-btn"
            badge={adBusy ? undefined : v.adBadge}
            onPress={() => void onRefresh()}
          >
            {adBusy ? B.adLoading : v.adButton}
          </Btn>
        </View>
      ) : adMessage ? (
        <Txt v="sm" tone="muted">
          {adMessage}
        </Txt>
      ) : null}
      <Txt tone="muted" style={{ fontSize: rem(FONT.caption) }} testID="auction-odds">
        {v.odds}
      </Txt>
      <View
        accessibilityLabel={v.shelf.title}
        style={{
          gap: 4,
          marginTop: 10,
          marginBottom: 8,
          paddingVertical: 10,
          paddingHorizontal: 12,
          borderRadius: RADIUS.md,
          backgroundColor: c.surface2,
        }}
      >
        <Txt tone="muted" style={{ fontSize: rem(FONT.caption) }}>
          {v.shelf.title}
        </Txt>
        {v.shelf.rows.map((row) => (
          <View key={row.k} style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <AuctionIcon d={row.icon} size={18} color={c.muted} />
            <Txt style={{ flex: 1, fontSize: rem(FONT.caption) }}>{row.name}</Txt>
            <View style={{ flexDirection: 'row', gap: 6 }}>
              {row.cells.map((cell) => {
                const gc = gradeColor(c, cell.g);
                return (
                  <View
                    key={cell.g}
                    accessible
                    accessibilityLabel={cell.label}
                    style={{
                      width: 14,
                      height: 14,
                      borderRadius: 4,
                      borderWidth: 1.5,
                      borderColor: cell.on ? gc : alpha(gc, 0.6),
                      backgroundColor: cell.on ? gc : 'transparent',
                    }}
                  />
                );
              })}
            </View>
          </View>
        ))}
      </View>
      <Txt tone="muted" style={{ fontSize: rem(FONT.caption) }}>
        {v.note}
      </Txt>
    </Card>
  );
}
