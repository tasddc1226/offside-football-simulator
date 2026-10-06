// 은퇴 리포트의 영구결번 장면(웹 RetiredNumberCredit.svelte, T-10-076) — 결번 세리머니 · 명예의 벽 헌정 · 이름 공개 안내.
// 판정 기준(점수·시즌 수)은 서버만 안다 — 앱은 서버가 준 결과만 그린다. 유니폼은 기록실 묶음의 RnJersey.
import { useEffect, useRef } from 'react';
import { View } from 'react-native';
import type { RetiredNumberResult } from '@offside/contracts';
import { checkRetiredNumber } from '@offside/app-core/api/client';
import { rnClubStats, rnSlotOf } from '@offside/app-core/legendReport';
import type { LegendView } from '@offside/app-core/state';
import { isHofEligible } from '@offside/contracts/hof-rules';
import { RnJersey } from '../../components/RnJersey';
import { recordRn, setLegendPublic } from '../../game/host';
import { Btn } from '../../ui/Btn';
import { ClubMark } from '../../ui/ClubBadge';
import { Reveal } from './credit';
import { FText, Kicker } from './film';
import { ownOf } from './own';
import { legendRnText as L } from '@offside/app-core/i18n/ko/legendRn';
import { tn } from '@offside/game/i18n/names';

export function RetiredNumberCredit({
  v,
  rn: rn0,
}: {
  v: LegendView;
  /** 심사 결과(null = 자격 없음, undefined = 아직 모름). */
  rn: RetiredNumberResult | null | undefined;
}) {
  // 결과를 모르는 내 선수 기록(배포 전 은퇴의 소급 결번·이미 찬 자리, 심사 중이던 기록)은 열 때 서버에 한 번 묻는다
  // (결과는 이 기기 기록에 남아 다시 묻지 않는다). 방금 은퇴한 화면은 은퇴 업로드 응답이 곧 온다.
  /** 한 선수에 한 번만 묻는다(결과를 남기면 rn0가 바뀌어 효과가 다시 돈다). */
  const asked = useRef('');
  const id = v.own?.id ?? v.shareId;
  const hasPot = !!v.pot;
  useEffect(() => {
    // 공개 명예의 전당에 오르는 은퇴(만 30세 이상)만 심사 대상이다.
    if (!id || id === asked.current || hasPot || !isHofEligible(v.age)) return;
    if (rn0 !== undefined && rn0?.kind !== 'pending') return;
    asked.current = id;
    void checkRetiredNumber(id).then((r) => {
      if (r.ok) recordRn(id, r.data.retiredNumber);
    });
  }, [id, hasPot, v.age, rn0]);
  const rn = rn0 ?? null;
  const rnSlot = rnSlotOf(rn, v.own);
  const rnClub = rnSlot?.kind === 'granted' ? rnClubStats(rnSlot, v.d) : null;

  if (!(rn?.kind === 'pending' || rnSlot)) return null;
  return (
    <Reveal testID="credit-retired-number">
      <View testID={`legend-rn-${rn?.kind}`} style={{ alignItems: 'center', gap: 20 }}>
        {rn?.kind === 'pending' ? (
          <FText tone="muted" size={0.875} lh={1.5} center testID="rn-pending">
            {L.pending}
          </FText>
        ) : rnSlot?.kind === 'granted' ? (
          <View style={{ alignItems: 'center', gap: 10 }}>
            <Kicker>Retired Number</Kicker>
            <RnJersey name={v.name} number={rnSlot.number} clubId={rnSlot.clubId} />
            <FText size={1.1875} center>
              <FText tone="gold" bold size={1.1875}>
                {L.lineNum({ number: rnSlot.number })}
              </FText>
              {L.lineNumAfter}
              {'\n'}
              <FText tone="gold" bold size={1.1875}>
                {v.name}
              </FText>
              {L.lineNameAfter}
            </FText>
            {rnClub ? (
              <FText tone="muted" size={0.875} lh={1.5} center>
                {L.stats(rnClub)}
              </FText>
            ) : null}
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <ClubMark name={rnSlot.club} id={rnSlot.clubId} size={18} />
              <FText size={0.875}>{L.foot({ club: tn(rnSlot.club), seq: rnSlot.seq })}</FText>
            </View>
          </View>
        ) : rnSlot?.kind === 'taken' ? (
          <View style={{ alignItems: 'center', gap: 10 }}>
            <Kicker>Wall of Honour</Kicker>
            <FText size={1.1875} center>
              {L.takenA({ number: rnSlot.number })}{' '}
              <FText tone="gold" bold size={1.1875}>
                {rnSlot.holder ?? L.anonLegend}
              </FText>
              {L.takenB}
              {'\n'}
              {L.takenC}{' '}
              <FText tone="gold" bold size={1.1875}>
                {v.name}
              </FText>
              {L.takenD}
            </FText>
          </View>
        ) : rnSlot?.kind === 'anonymous' ? (
          <View style={{ alignItems: 'center', gap: 10 }}>
            <Kicker>Retired Number</Kicker>
            <FText size={1.1875} center>
              {L.anonA}
              {'\n'}
              <FText tone="gold" bold size={1.1875}>
                {L.anonSlot({ club: tn(rnSlot.club), number: rnSlot.number })}
              </FText>{' '}
              {L.anonTail}
            </FText>
            <FText tone="muted" size={0.875} lh={1.5} center>
              {L.anonNote}
            </FText>
            {v.own ? (
              <Btn
                kind="primary"
                testID="rn-public"
                onPress={() => {
                  const own = ownOf(v);
                  if (own) setLegendPublic(own, true);
                }}
              >
                {L.publish}
              </Btn>
            ) : null}
          </View>
        ) : null}
      </View>
    </Reveal>
  );
}
