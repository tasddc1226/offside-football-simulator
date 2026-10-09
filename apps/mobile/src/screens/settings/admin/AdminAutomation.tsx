import AutomationModeration from './AutomationModeration';
import { automationModerationText as L } from '@offside/app-core/i18n/ko/automationModeration';
// 자동 플레이 탐지(웹 admin/AdminAutomation.svelte, 관찰 전용). 최근 N시간 동안 시즌을 올린 프로필 중 사람답지 않은 흐름이
// 보이는 곳을 점수순으로 보여 준다 — 게임에는 아무 영향이 없다. 근거 기준은 api `db/repos/automation.ts`.
import { useEffect, useRef, useState } from 'react';
import { View } from 'react-native';
import type { AutomationReason } from '@offside/contracts';
import * as api from '@offside/app-core/api/admin';
import type { AutomationReport } from '@offside/app-core/api/admin';
import { kstDateTime as kst } from '@offside/app-core/boardText';
import { LoadState, type LoadStatus } from '../../../components/LoadState';
import { openPublicLegendById } from '../../../game/host';
import { rem } from '../../../theme/type';
import { useColors } from '../../../theme/useColors';
import { Btn } from '../../../ui/Btn';
import { Chip, Pill } from '../../../ui/bits';
import { Txt } from '../../../ui/Txt';
import { Seg, TabOpt } from '../../board/parts';

const REASON: Record<AutomationReason, string> = {
  webdriver: '자동화 브라우저',
  headless: '헤드리스 브라우저',
  synthetic: '스크립트 클릭',
  noInput: '입력 없이 진행',
  noMoves: '커서 이동 없는 클릭',
  metronome: '기계처럼 일정한 간격',
  steady: '꽤 일정한 간격',
  serial: '번호만 바꾼 연속 커리어',
  nonstop: '쉬지 않는 업로드',
  aiName: 'AI·봇 이름',
};
const HOURS = [1, 6, 24] as const;

export default function AdminAutomation() {
  const c = useColors();
  const [hours, setHours] = useState<(typeof HOURS)[number]>(6);
  const [report, setReport] = useState<AutomationReport | null>(null);
  const [status, setStatus] = useState<LoadStatus>('loading');
  const req = useRef(0);

  async function load(h: number = hours) {
    setStatus('loading');
    const mine = ++req.current;
    const r = await api.fetchAutomation(h);
    if (mine !== req.current) return; // 구간을 바꿨으면 늦게 온 이전 응답은 버린다.
    if (!r.ok) {
      setStatus('error');
      return;
    }
    setReport(r.data);
    setStatus('ready');
  }
  useEffect(() => void load(), []);
  function pick(h: (typeof HOURS)[number]) {
    setHours(h);
    void load(h);
  }

  const small = { fontSize: rem(0.75) } as const;
  const r = report;
  return (
    <View testID="admin-automation" style={{ gap: 14 }}>
      <AutomationModeration />
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <Txt v="h2" accessibilityRole="header">
          자동 플레이 의심
        </Txt>
        <Btn sm testID="refresh-automation" onPress={() => void load()}>
          새로고침
        </Btn>
      </View>
      <Seg cols={3} label="조회 구간">
        {HOURS.map((h) => (
          <TabOpt
            key={h}
            tight
            title={`최근 ${h}시간`}
            selected={hours === h}
            testID={`automation-hours-${h}`}
            onPress={() => pick(h)}
          />
        ))}
      </Seg>
      <Txt tone="muted" style={small}>
        {L.observations}
      </Txt>
      <LoadState
        status={status}
        failText="자동 플레이 현황을 불러오지 못했어요."
        retry={() => void load()}
      >
        {r ? (
          <>
            <Txt testID="automation-summary" style={{ fontSize: rem(0.8125) }}>
              {`${kst(r.generatedAt)} 기준 · 최근 ${r.hours}시간 동안 시즌을 올린 `}
              <Txt bold style={{ fontSize: rem(0.8125) }}>
                {r.profiles.toLocaleString()}
              </Txt>
              {'개 프로필 중 '}
              <Txt bold style={{ fontSize: rem(0.8125) }}>
                {r.suspects.length}
              </Txt>
              {'곳'}
            </Txt>
            <View style={{ gap: 10 }}>
              {r.suspects.length ? (
                r.suspects.map((s) => (
                  <View
                    key={s.profile}
                    testID={`suspect-${s.profile}`}
                    style={{
                      gap: 6,
                      paddingVertical: 10,
                      paddingHorizontal: 12,
                      borderWidth: 1,
                      borderColor: c.line,
                      borderRadius: 12,
                    }}
                  >
                    <View
                      style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: 8,
                      }}
                    >
                      <View
                        style={{
                          flexDirection: 'row',
                          alignItems: 'center',
                          gap: 6,
                          flexShrink: 1,
                        }}
                      >
                        <Pill tone={s.level === 'high' ? 'bad' : 'warn'}>
                          {s.level === 'high' ? '높음' : '보통'}
                        </Pill>
                        <Txt
                          bold
                          numberOfLines={1}
                          style={{ flexShrink: 1 }}
                        >{`프로필 ${s.profile}`}</Txt>
                      </View>
                      <Txt tone="muted" style={small}>{`점수 ${s.score}`}</Txt>
                    </View>
                    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
                      {s.reasons.map((why) => (
                        <Chip key={why} text={REASON[why]} />
                      ))}
                    </View>
                    <Txt tone="muted" style={small}>
                      {`시즌 ${s.seasons} · 활동 ${s.activeHours}시간대 · ${kst(s.firstAt)} – ${kst(s.lastAt)}`}
                    </Txt>
                    <View>
                      {s.careers.map((cr) => (
                        <View
                          key={cr.careerId}
                          style={{
                            flexDirection: 'row',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            gap: 8,
                            paddingVertical: 4,
                            borderTopWidth: 1,
                            borderTopColor: c.line,
                          }}
                        >
                          <View style={{ flex: 1 }}>
                            <Txt style={{ fontSize: rem(0.8125) }}>{cr.name ?? '익명'}</Txt>
                            <Txt tone="muted" style={{ fontSize: rem(0.8125) }}>
                              {`${cr.status === 'retired' ? '은퇴' : '진행'} · ${cr.seasons}시즌${cr.medianGapSec !== null ? ` · 간격 ${cr.medianGapSec}초` : ''}${cr.cv !== null ? ` · 변동 ${cr.cv}` : ''}`}
                            </Txt>
                          </View>
                          {cr.status === 'retired' ? (
                            <Btn sm onPress={() => void openPublicLegendById(cr.careerId)}>
                              기록
                            </Btn>
                          ) : null}
                        </View>
                      ))}
                    </View>
                  </View>
                ))
              ) : (
                <Txt tone="muted">의심되는 흐름이 없어요.</Txt>
              )}
            </View>
          </>
        ) : null}
      </LoadState>
    </View>
  );
}
