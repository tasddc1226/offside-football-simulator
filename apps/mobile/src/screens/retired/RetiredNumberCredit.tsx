// 은퇴 리포트의 영구결번 장면(웹 RetiredNumberCredit.svelte, T-10-076) — 결번 세리머니 · 명예의 벽 헌정 · 이름 공개 안내.
// 판정 기준(점수·시즌 수)은 서버만 안다 — 앱은 서버가 준 결과만 그린다. 유니폼은 기록실 묶음의 RnJersey.
import { useEffect, useRef } from 'react';
import { useSnapshot } from 'valtio';
import { rnResults } from '../../store';
import { View } from 'react-native';
import type { RetiredNumberResult } from '@offside/contracts';
import { pendingRetirementIds } from '@offside/app-core/outbox';
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

export function RetiredNumberCredit({
  v,
  rn: rn0,
}: {
  v: LegendView;
  /** 심사 결과(null = 자격 없음, undefined = 아직 모름). */
  rn: RetiredNumberResult | null | undefined;
}) {
  // 로컬·백업 기록은 칭호 증거가 아니므로 상세를 열 때 서버에서 확인한다.
  // 반복 진입은 API 메모를 사용하며 은퇴 업로드 대기 중에는 응답 이벤트를 기다린다.
  /** 한 선수에 한 번만 묻는다(결과를 남기면 rn0가 바뀌어 효과가 다시 돈다). */
  const asked = useRef('');
  const id = v.own?.id ?? v.shareId;
  useEffect(() => {
    // 공개 명예의 전당에 오르는 은퇴(만 30세 이상)만 심사 대상이다.
    if (!id || id === asked.current || !isHofEligible(v.age) || pendingRetirementIds().has(id))
      return;
    asked.current = id;
    void checkRetiredNumber(id).then((r) => {
      if (r.ok) recordRn(id, r.data.retiredNumber);
    });
  }, [id, v.age, rn0]);
  const results = useSnapshot(rnResults);
  const rn =
    rn0?.kind === 'taken' && v.own?.id && !(v.own.id in results)
      ? { ...rn0, wallOfHonor: false }
      : (rn0 ?? null);
  const rnSlot = rnSlotOf(rn, v.own);
  const rnClub = rnSlot?.kind === 'granted' ? rnClubStats(rnSlot, v.d) : null;

  if (!(rn?.kind === 'pending' || rnSlot || v.wallOfHonor)) return null;
  return (
    <Reveal testID="credit-retired-number">
      <View testID={`legend-rn-${rn?.kind}`} style={{ alignItems: 'center', gap: 20 }}>
        {!rnSlot && v.wallOfHonor ? (
          <View style={{ alignItems: 'center', gap: 10 }}>
            <Kicker>Wall of Honour</Kicker>
            <FText tone="muted" size={0.875} lh={1.5} center testID="wall-of-honor">
              ‘명예의 벽’ 칭호를 받았어요. 영구결번은 아니에요.
            </FText>
          </View>
        ) : rn?.kind === 'pending' ? (
          <FText tone="muted" size={0.875} lh={1.5} center testID="rn-pending">
            서버가 결번을 심사하고 있어요. 잠시 뒤 명예의 전당에서 확인할 수 있어요.
          </FText>
        ) : rnSlot?.kind === 'granted' ? (
          <View style={{ alignItems: 'center', gap: 10 }}>
            <Kicker>Retired Number</Kicker>
            <RnJersey name={v.name} number={rnSlot.number} clubId={rnSlot.clubId} />
            <FText size={1.1875} center>
              <FText tone="gold" bold size={1.1875}>
                {rnSlot.number}번
              </FText>
              은 이제,{'\n'}
              <FText tone="gold" bold size={1.1875}>
                {v.name}
              </FText>
              의 이름으로 남습니다.
            </FText>
            {rnClub ? (
              <FText tone="muted" size={0.875} lh={1.5} center>
                {rnClub.from}–{rnClub.to} · {rnClub.seasons}시즌 · {rnClub.apps}경기 {rnClub.goals}
                골 {rnClub.assists}도움
              </FText>
            ) : null}
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <ClubMark name={rnSlot.club} id={rnSlot.clubId} size={18} />
              <FText size={0.875}>
                {rnSlot.club} 영구결번 · 서버 {rnSlot.seq}번째 결번
              </FText>
            </View>
          </View>
        ) : rnSlot?.kind === 'taken' ? (
          <View style={{ alignItems: 'center', gap: 10 }}>
            <Kicker>Wall of Honour</Kicker>
            {rnSlot.wallOfHonor ? (
              <FText tone="muted" size={0.875} lh={1.5} center testID="wall-of-honor">
                ‘명예의 벽’ 칭호를 받았어요. 영구결번은 아니에요.
              </FText>
            ) : null}
            <FText size={1.1875} center>
              {rnSlot.number}번은 이미{' '}
              <FText tone="gold" bold size={1.1875}>
                {rnSlot.holder ?? '익명의 레전드'}
              </FText>
              의 이름으로 남아 있어,{'\n'}구단은{' '}
              <FText tone="gold" bold size={1.1875}>
                {v.name}
              </FText>
              의 이름을 명예의 벽에 새겼습니다.
            </FText>
          </View>
        ) : rnSlot?.kind === 'anonymous' ? (
          <View style={{ alignItems: 'center', gap: 10 }}>
            <Kicker>Retired Number</Kicker>
            <FText size={1.1875} center>
              이름을 공개하면{'\n'}
              <FText tone="gold" bold size={1.1875}>
                {rnSlot.club} {rnSlot.number}번
              </FText>{' '}
              영구결번이 확정됩니다.
            </FText>
            <FText tone="muted" size={0.875} lh={1.5} center>
              먼저 이름을 공개한 선수가 그 번호를 받아요.
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
                이름 공개하고 결번 받기
              </Btn>
            ) : null}
          </View>
        ) : null}
      </View>
    </Reveal>
  );
}
