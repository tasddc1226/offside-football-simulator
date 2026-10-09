import { MIN_RETIRE_AGE, marketValue } from '@offside/game/season';
// 선수 탭(웹 tabs/PlayerTab.svelte): 능력치 카드 · 선수 정보 · 국가대표 · 은퇴 선언(32세부터).
import { useState, type ReactNode } from 'react';
import { View } from 'react-native';
import { useSnapshot } from 'valtio';
import { potentialNotice } from '@offside/app-core/potential-view';
import { gamePlayerText as L } from '@offside/app-core/i18n/ko/gamePlayer';
import { gameBoostText as B } from '@offside/app-core/i18n/ko/gameBoost';
import { boostHidden, boostView, doBoost, type BoostOutcome } from '@offside/app-core/boost-view';
import { peekView } from '@offside/app-core/potential-peek';
import { TRAITS } from '@offside/game/data';
import { boostFreeOpen, type BoostPay } from '@offside/game/boost';
import { ovr } from '@offside/game/attributes';
import { leagueOf, fmtMoney } from '@offside/game/engine';
import {
  milStatusText,
  sportsServiceNotice,
  sportsServiceLegacyNotice,
} from '@offside/game/military';
import { nextWC, HOSTS } from '@offside/game/national';
import type { GameState } from '@offside/game/types';
import { flagOf, isKorean, nationOf } from '@offside/game/nation';
import { BODY_DEFAULT } from '@offside/contracts/body';
import { NATION_EN } from '@offside/contracts/nations-en';
import { fmtValue } from '@offside/app-core/format';
import { retireAsk, save } from '../../game/host';
import { BoostFx } from '../../components/BoostFx';
import { appState } from '../../store';
import { adFree } from '../../platform/adFree';
import { claimReward, rewardOffer } from '../../platform/rewarded';
import { openPeek, openPeekWithClub, peekAvailable, potPeek } from '../../platform/rewardedPeek';
import { useClubReward } from '../../platform/clubShop';
import { iapItems, useIapItems } from '../../platform/iapItems';
import { payWithTicket } from '@offside/app-core/club-reward';
import { iapText as IL } from '@offside/app-core/i18n/ko/iap';
import { IapPacks } from '../owner/IapPacks';
import { fundsText } from '@offside/app-core/funds';
import { useColors } from '../../theme/useColors';
import { DISPLAY, rem } from '../../theme/type';
import { Btn } from '../../ui/Btn';
import { Card } from '../../ui/Card';
import { Txt } from '../../ui/Txt';
import { AttrCard } from './AttrCard';
import { TrophyRow } from './TrophyTab';
import { tn } from '@offside/game/i18n/names';
import { appFormatText } from '@offside/app-core/i18n/ko/appFormat';

type Row = { k: string; v: ReactNode; testID?: string };

/** 이름(왼쪽, muted) · 값(오른쪽, 굵게) 목록(웹 dl.kv). */
function Kv({ rows, mt = 0 }: { rows: Row[]; mt?: number }) {
  return (
    <View style={{ gap: 8, marginTop: mt }}>
      {rows.map((r) => (
        <View key={r.k} style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 12 }}>
          <Txt tone="muted" style={{ fontSize: rem(0.875), flexShrink: 1 }}>
            {r.k}
          </Txt>
          <Txt
            testID={r.testID}
            style={{
              fontSize: rem(0.875),
              fontWeight: '600',
              textAlign: 'right',
              flexShrink: 1,
              maxWidth: '65%',
            }}
          >
            {r.v}
          </Txt>
        </View>
      ))}
    </View>
  );
}

/**
 * T-11-083 잠재력 강화(웹 PlayerTab.svelte data-boost). 자금을 쓰는 시도라 버튼을 한 번 더 눌러야 한다.
 * T-11-116 자금이 모자라면 보상형 광고를 끝까지 보고(광고 제거 구매자는 바로) 자금 없이 시도한다(앱 전용).
 */
function BoostCard({ s }: { s: GameState }) {
  const c = useColors();
  const [arming, setArming] = useState(false);
  const [fx, setFx] = useState<BoostOutcome | null>(null);
  const [adBusy, setAdBusy] = useState(false);
  const [adMessage, setAdMessage] = useState('');
  const owned = useSnapshot(adFree).owned;
  // T-11-153 광고 대신 구단 자금으로 시도(로그인한 구단주). 광고 제거 구매자는 이미 광고 없이 시도한다.
  // T-11-157 자금이 모자란 시즌의 한 번과 추가 시도에 쓴다. 광고는 하루 횟수가 없고, 구단 자금은 서버가 하루 상한을 둔다.
  const club = useClubReward('boost', boostFreeOpen(s) && !owned);
  // T-11-174 잠재력 강화권(스토어에서 산다)도 같은 자리에서 쓴다.
  const tickets = useIapItems(boostFreeOpen(s)).items?.boost ?? 0;
  const v = boostView(s, rewardOffer('boost', owned), {
    club: !!club.offer,
    ticket: tickets > 0,
  });
  // s는 읽기 전용 스냅샷이라 스토어의 세이브를 고친다. 결과를 먼저 저장하고 연출을 연다 — 연출 중에 앱을 꺼도 결과는 그대로다.
  const run = (pay: BoostPay) => {
    const out = doBoost(appState.G!, pay);
    if (!out) return;
    save();
    setFx(out);
  };
  const onBoost = () => {
    if (!arming) return setArming(true);
    setArming(false);
    run('money');
  };
  const onAdBoost = async () => {
    if (adBusy) return;
    setAdBusy(true);
    setAdMessage('');
    try {
      setAdMessage(await claimReward('boost', () => run('ad'), B.adWatch));
    } finally {
      setAdBusy(false);
    }
  };
  const onClubBoost = async () => {
    if (adBusy) return;
    setAdBusy(true);
    setAdMessage('');
    try {
      const message = await club.pay(() => run('club'));
      if (message !== null) setAdMessage(message);
    } finally {
      setAdBusy(false);
    }
  };
  // 서버가 한 장을 뺀 뒤에만 강화한다.
  const onTicketBoost = async () => {
    if (adBusy) return;
    setAdBusy(true);
    setAdMessage('');
    try {
      const r = await payWithTicket(() => run('ticket'));
      if (r.boost !== null && iapItems.items)
        iapItems.items = { ...iapItems.items, boost: r.boost };
      setAdMessage(r.message);
    } finally {
      setAdBusy(false);
    }
  };
  return (
    <Card gap={0} testID="boost">
      {fx ? <BoostFx out={fx} onDone={() => setFx(null)} /> : null}
      <Txt v="eyebrow">Potential</Txt>
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: 6,
        }}
      >
        <Txt v="h2" accessibilityRole="header">
          {B.title}
        </Txt>
        <View
          accessible
          accessibilityLabel={B.stepsLabel({ max: v.max, lv: v.lv })}
          style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}
        >
          {Array.from({ length: v.max }, (_, i) => (
            <View
              key={i}
              style={{
                width: 10,
                height: 10,
                borderRadius: 5,
                borderWidth: 1.5,
                borderColor: i < v.lv ? c.accent : c.line,
                backgroundColor: i < v.lv ? c.accent : 'transparent',
              }}
            />
          ))}
          <Txt style={{ marginLeft: 4, fontWeight: '700' }}>+{v.lv}</Txt>
        </View>
      </View>
      <Txt v="sm" testID="boost-line">
        {v.line}
      </Txt>
      {v.button ? (
        <View style={{ marginVertical: 8, gap: 8 }}>
          {arming ? (
            <Txt v="sm" style={{ color: c.bad }} testID="boost-confirm">
              {v.confirm}
            </Txt>
          ) : null}
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <Btn kind="primary" style={{ flex: 1 }} testID="boost-btn" onPress={onBoost}>
              {arming ? B.confirmBtn : v.button}
            </Btn>
            {arming ? (
              <Btn testID="boost-cancel" onPress={() => setArming(false)}>
                {B.cancel}
              </Btn>
            ) : null}
          </View>
        </View>
      ) : null}
      {/* T-11-181 광고를 볼 수 없어도(광고 단위 없음) 구단 자금 · 강화권 · 상점 묶음은 보인다 — 웹과 같다. */}
      {v.free ? (
        <View style={{ marginVertical: 8, gap: 6 }} testID="boost-ad">
          {adMessage || v.adNote ? (
            <Txt v="sm" tone="muted" testID="boost-ad-note">
              {adMessage || v.adNote}
            </Txt>
          ) : null}
          {v.adButton ? (
            <Btn
              kind="primary"
              disabled={adBusy}
              testID="boost-ad-btn"
              onPress={() => void onAdBoost()}
            >
              {adBusy ? B.adLoading : v.adButton}
            </Btn>
          ) : null}
          {club.offer ? (
            <Btn disabled={adBusy} testID="boost-club-btn" onPress={() => void onClubBoost()}>
              {B.clubBoost({ price: fundsText(club.offer.price), chance: v.chance })}
            </Btn>
          ) : null}
          {tickets > 0 ? (
            <Btn disabled={adBusy} testID="boost-ticket-btn" onPress={() => void onTicketBoost()}>
              {B.ticketBoost({ n: tickets, chance: v.chance })}
            </Btn>
          ) : null}
          {!owned ? <IapPacks item="boost" note={IL.boostNote({ chance: v.chance })} /> : null}
        </View>
      ) : null}
      <Txt tone="muted" style={{ fontSize: rem(0.75), marginTop: 4 }}>
        {v.note}
      </Txt>
      {v.history.map((h, i) => (
        <Txt key={i} tone="muted" style={{ fontSize: rem(0.75), marginTop: 2 }}>
          {`· ${h}`}
        </Txt>
      ))}
    </Card>
  );
}

export function PlayerTab({ s }: { s: GameState }) {
  const c = useColors();
  const lg = leagueOf(s.leagueId);
  const value = marketValue(s);
  const traitName = TRAITS.find((t) => t.id === s.trait)?.name ?? '';
  const milTxt = milStatusText(s);
  const tours = s.nat.tours.filter((x) => x.inSquad);
  const nextWcYear = nextWC(s.year - 1);
  const nextWcHost = (HOSTS.wc as Record<number, string>)[nextWcYear] || L.hostTbd;
  const nation = nationOf(s);
  // 체격 입력 이전 선수는 포지션 표준 체격으로 보여 준다(표시만 — 능력치 보정은 없다).
  const body = s.body ?? BODY_DEFAULT[s.pos];
  // T-11-079 보상형 광고로 이번 시즌 스카우트 평가 보기. 광고 단위도 광고 제거도 없으면 예전 안내만 둔다.
  const owned = useSnapshot(adFree).owned;
  const peek = useSnapshot(potPeek);
  const pot = peekView(s, peek.peek, owned ? 'free' : 'ad');
  const canAd = peekAvailable();
  // T-11-153 광고 대신 구단 자금으로 평가 보기(로그인한 구단주). 광고 제거 구매자는 이미 광고 없이 본다.
  // T-11-181 광고 단위가 없어도 구단 자금 길은 보인다.
  const club = useClubReward('peek', pot.kind === 'available' && !owned);
  const showPeek = pot.kind !== 'shown' && (canAd || !!club.offer);

  const info: Row[] = [
    { k: L.nation, testID: 'nation', v: `${flagOf(nation.code)} ${tn(nation.ko)}` },
    { k: L.body, testID: 'body', v: `${body.h}cm · ${body.w}kg` },
    { k: L.foot, v: tn(s.foot) },
    { k: L.trait, v: traitName },
    { k: L.potential, testID: 'pot', v: pot.kind === 'shown' ? pot.text : potentialNotice() },
    { k: L.peakOvr, v: String(Math.max(s.peak, ovr(s))) },
    { k: L.trust, v: s.trust >= 2 ? L.trustHigh : s.trust >= 0 ? L.trustMid : L.trustLow },
    {
      k: L.contract,
      v: s.contract
        ? L.contractLeft({ years: s.contract.years, salary: fmtMoney(s.contract.salary) })
        : lg.amateur
          ? L.amateur
          : '-',
    },
    { k: L.money, v: appFormatText.won({ v: fmtMoney(s.money) }) },
    ...(!lg.amateur ? [{ k: L.value, testID: 'value', v: fmtValue(value) }] : []),
  ];

  return (
    <>
      <AttrCard s={s} />

      <Card gap={0}>
        <Txt v="eyebrow">Profile</Txt>
        <Txt v="h2" accessibilityRole="header" style={{ marginBottom: 10 }}>
          {L.profile}
        </Txt>
        <Kv rows={info} />
        {showPeek ? (
          <View style={{ marginTop: 10, gap: 6 }} testID="pot-peek">
            <Txt tone="muted" style={{ fontSize: rem(0.8125) }}>
              {peek.message || pot.text}
            </Txt>
            {canAd && pot.kind === 'available' ? (
              <Btn
                sm
                block
                disabled={peek.busy}
                testID="pot-peek-btn"
                onPress={() => void openPeek(s)}
              >
                {peek.busy ? B.adLoading : pot.button}
              </Btn>
            ) : null}
            {club.offer ? (
              <Btn
                sm
                block
                disabled={peek.busy}
                testID="pot-peek-club"
                onPress={() => void openPeekWithClub(s, club.pay)}
              >
                {B.clubPeek({ price: fundsText(club.offer.price) })}
              </Btn>
            ) : null}
          </View>
        ) : null}
      </Card>

      {boostHidden(s) ? null : <BoostCard s={s} />}

      <Card gap={0}>
        {/* 영어 나라 이름은 웹에서 첫 화면 번들 밖에서 불러왔지만 앱은 한 번들이라 바로 쓴다. */}
        <Txt v="eyebrow">{isKorean(s) ? 'Korea Republic' : NATION_EN[nation.code]}</Txt>
        <Txt v="h2" accessibilityRole="header" style={{ marginBottom: 10 }}>
          {L.nationalTitle}
        </Txt>
        <View style={{ flexDirection: 'row', gap: 6 }}>
          {[
            { k: 'caps', v: String(s.nat.caps), l: L.caps },
            { k: 'goals', v: String(s.nat.goals), l: L.goals },
            { k: 'assists', v: String(s.nat.assists), l: L.assists },
            { k: 'captain', v: s.nat.captain ? 'C' : '-', l: L.captain },
          ].map((x) => (
            <View
              key={x.k}
              accessible
              accessibilityLabel={`${x.l} ${x.v}`}
              style={{
                flex: 1,
                backgroundColor: c.surface2,
                borderRadius: 10,
                padding: 8,
                alignItems: 'center',
              }}
            >
              <Txt
                style={{
                  fontFamily: DISPLAY[700],
                  fontSize: rem(1.625),
                  lineHeight: rem(1.625) * 1.1,
                }}
              >
                {x.v}
              </Txt>
              <Txt tone="muted" style={{ fontSize: rem(0.6875) }}>
                {x.l}
              </Txt>
            </View>
          ))}
        </View>
        <Kv
          mt={10}
          rows={[
            { k: L.debut, v: String(s.nat.debutYear || L.notCalled) },
            ...(isKorean(s) ? [{ k: L.military, v: milTxt }] : []),
            { k: L.nextWc, v: `${nextWcYear} · ${tn(nextWcHost)}` },
          ]}
        />
        {isKorean(s) && (
          <Txt tone="muted" style={{ marginTop: 10, fontSize: rem(0.875) }} testID="military-guide">
            {sportsServiceNotice()}
          </Txt>
        )}
        {isKorean(s) && s.mil.exempt && s.mil.sportsService?.monthsLeft == null && (
          <Txt tone="muted" style={{ marginTop: 8, fontSize: rem(0.875) }} testID="military-legacy">
            {sportsServiceLegacyNotice()}
          </Txt>
        )}
        {tours.length ? (
          <View style={{ marginTop: 8 }}>
            {tours
              .slice()
              .reverse()
              .map((x, i) => (
                <TrophyRow key={x.year + x.name} year={x.year} first={i === 0}>
                  <Txt>
                    <Txt style={{ fontWeight: '700' }}>{tn(x.name).replace(/^\d{4} /, '')}</Txt>
                    <Txt tone="muted" style={{ fontSize: rem(0.75) }}>
                      {`  ${L.tourLine({ stage: tn(x.stage), apps: x.apps, goals: x.goals })}`}
                    </Txt>
                  </Txt>
                </TrophyRow>
              ))}
          </View>
        ) : null}
      </Card>

      {s.age >= MIN_RETIRE_AGE ? (
        <Btn block testID="retire-ask" onPress={() => retireAsk()}>
          {L.retire}
        </Btn>
      ) : null}
    </>
  );
}
