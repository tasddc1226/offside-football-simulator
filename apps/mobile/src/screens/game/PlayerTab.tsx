// 선수 탭(웹 tabs/PlayerTab.svelte): 능력치 카드 · 선수 정보 · 국가대표 · 은퇴 선언(32세부터).
import type { ReactNode } from 'react';
import { View } from 'react-native';
import { POTENTIAL_NOTICE } from '@offside/app-core/potential-view';
import { TRAITS } from '@offside/game/data';
import { ovr } from '@offside/game/attributes';
import { leagueOf, fmtMoney } from '@offside/game/engine';
import { marketValue } from '@offside/game/season';
import { milStatusText } from '@offside/game/military';
import { nextWC, HOSTS } from '@offside/game/national';
import type { GameState } from '@offside/game/types';
import { flagOf, isKorean, nationOf } from '@offside/game/nation';
import { BODY_DEFAULT } from '@offside/contracts/body';
import { NATION_EN } from '@offside/contracts/nations-en';
import { fmtValue } from '@offside/app-core/format';
import { retireAsk } from '../../game/host';
import { useColors } from '../../theme/useColors';
import { DISPLAY, rem } from '../../theme/type';
import { Btn } from '../../ui/Btn';
import { Card } from '../../ui/Card';
import { Txt } from '../../ui/Txt';
import { AttrCard } from './AttrCard';
import { TrophyRow } from './TrophyTab';

/** 이름(왼쪽, muted) · 값(오른쪽, 굵게) 목록(웹 dl.kv). */
function Kv({
  rows,
  mt = 0,
}: {
  rows: { k: string; v: ReactNode; testID?: string }[];
  mt?: number;
}) {
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

export function PlayerTab({ s }: { s: GameState }) {
  const c = useColors();
  const L = leagueOf(s.leagueId);
  const value = marketValue(s);
  const traitName = TRAITS.find((t) => t.id === s.trait)?.name ?? '';
  const milTxt = milStatusText(s);
  const tours = s.nat.tours.filter((x) => x.inSquad);
  const nextWcYear = nextWC(s.year - 1);
  const nextWcHost = (HOSTS.wc as Record<number, string>)[nextWcYear] || '개최지 미정';
  const nation = nationOf(s);
  // 체격 입력 이전 선수는 포지션 표준 체격으로 보여 준다(표시만 — 능력치 보정은 없다).
  const body = s.body ?? BODY_DEFAULT[s.pos];

  const info: { k: string; v: ReactNode; testID?: string }[] = [
    { k: '국적', testID: 'nation', v: `${flagOf(nation.code)} ${nation.ko}` },
    { k: '체격', testID: 'body', v: `${body.h}cm · ${body.w}kg` },
    { k: '주발', v: s.foot },
    { k: '성장 특성', v: traitName },
    { k: '잠재력 평가', testID: 'pot', v: POTENTIAL_NOTICE },
    { k: '최고 OVR', v: String(Math.max(s.peak, ovr(s))) },
    { k: '감독 신뢰', v: s.trust >= 2 ? '두터움' : s.trust >= 0 ? '보통' : '냉랭함' },
    {
      k: '계약',
      v: s.contract
        ? `${s.contract.years}년 남음 · ${fmtMoney(s.contract.salary)}/년`
        : L.amateur
          ? '아마추어'
          : '-',
    },
    { k: '보유 자금', v: `${fmtMoney(s.money)}원` },
    ...(!L.amateur ? [{ k: '추정 몸값', testID: 'value', v: fmtValue(value) }] : []),
  ];

  return (
    <>
      <AttrCard s={s} />

      <Card gap={0}>
        <Txt v="eyebrow">Profile</Txt>
        <Txt v="h2" accessibilityRole="header" style={{ marginBottom: 10 }}>
          선수 정보
        </Txt>
        <Kv rows={info} />
      </Card>

      <Card gap={0}>
        {/* 영어 나라 이름은 웹에서 첫 화면 번들 밖에서 불러왔지만 앱은 한 번들이라 바로 쓴다. */}
        <Txt v="eyebrow">{isKorean(s) ? 'Korea Republic' : NATION_EN[nation.code]}</Txt>
        <Txt v="h2" accessibilityRole="header" style={{ marginBottom: 10 }}>
          국가대표
        </Txt>
        <View style={{ flexDirection: 'row', gap: 6 }}>
          {[
            { k: 'caps', v: String(s.nat.caps), l: 'A매치' },
            { k: 'goals', v: String(s.nat.goals), l: '골' },
            { k: 'assists', v: String(s.nat.assists), l: '도움' },
            { k: 'captain', v: s.nat.captain ? 'C' : '-', l: '주장' },
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
            { k: 'A매치 데뷔', v: String(s.nat.debutYear || '미발탁') },
            ...(isKorean(s) ? [{ k: '병역', v: milTxt }] : []),
            { k: '다음 월드컵', v: `${nextWcYear} · ${nextWcHost}` },
          ]}
        />
        {tours.length ? (
          <View style={{ marginTop: 8 }}>
            {tours
              .slice()
              .reverse()
              .map((x, i) => (
                <TrophyRow key={x.year + x.name} year={x.year} first={i === 0}>
                  <Txt>
                    <Txt style={{ fontWeight: '700' }}>{x.name.replace(/^\d{4} /, '')}</Txt>
                    <Txt tone="muted" style={{ fontSize: rem(0.75) }}>
                      {`  ${x.stage} · ${x.apps}경기 ${x.goals}골`}
                    </Txt>
                  </Txt>
                </TrophyRow>
              ))}
          </View>
        ) : null}
      </Card>

      {s.age >= 32 && !L.amateur ? (
        <Btn block testID="retire-ask" onPress={() => retireAsk()}>
          은퇴 선언하기
        </Btn>
      ) : null}
    </>
  );
}
