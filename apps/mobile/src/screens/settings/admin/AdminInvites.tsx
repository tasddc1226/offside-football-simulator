// T-11-177 친구 초대 현황(웹 admin/AdminInvites.svelte). 초대 수 · 첫 커리어를 마친 수 · 지급된 리롤권,
// 초대를 많이 한 구단주와 최근 초대.
import { useEffect, useState } from 'react';
import { View } from 'react-native';
import * as api from '@offside/app-core/api/admin';
import type { AdminInviteReport } from '@offside/app-core/api/admin';
import {
  INVITE_NOTE,
  invitePair,
  inviteState,
  inviteSummary,
  inviterLine,
  nick,
} from '@offside/app-core/admin/invites';
import { kstDateTime as kst } from '@offside/app-core/boardText';
import { LoadState, type LoadStatus } from '../../../components/LoadState';
import { rem } from '../../../theme/type';
import { useColors } from '../../../theme/useColors';
import { Btn } from '../../../ui/Btn';
import { Txt } from '../../../ui/Txt';

export default function AdminInvites() {
  const c = useColors();
  const [report, setReport] = useState<AdminInviteReport | null>(null);
  const [status, setStatus] = useState<LoadStatus>('loading');

  async function load() {
    setStatus('loading');
    const r = await api.fetchInviteReport();
    if (!r.ok) {
      setStatus('error');
      return;
    }
    setReport(r.data);
    setStatus('ready');
  }
  useEffect(() => void load(), []);

  const small = { fontSize: rem(0.8125) } as const;
  const tiny = { fontSize: rem(0.75) } as const;
  const row = {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 6,
    borderTopWidth: 1,
    borderTopColor: c.line,
  } as const;
  const r = report;
  const none = (
    <Txt tone="muted" style={small}>
      아직 초대가 없어요.
    </Txt>
  );
  return (
    <View testID="admin-invites" style={{ gap: 14 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <Txt v="h2" accessibilityRole="header">
          친구 초대 현황
        </Txt>
        <Btn sm testID="refresh-invites" onPress={() => void load()}>
          새로고침
        </Btn>
      </View>
      <Txt tone="muted" style={tiny}>
        {INVITE_NOTE}
      </Txt>
      <LoadState
        status={status}
        failText="친구 초대 현황을 불러오지 못했어요."
        retry={() => void load()}
      >
        {r ? (
          <>
            <Txt style={small}>{`${kst(r.generatedAt)} 기준`}</Txt>
            <View testID="invites-summary">
              {inviteSummary(r).map(([label, v]) => (
                <View key={label} style={row}>
                  <Txt style={small}>{label}</Txt>
                  <Txt num style={small}>
                    {v}
                  </Txt>
                </View>
              ))}
            </View>
            <Txt bold style={small}>
              초대를 많이 한 구단주
            </Txt>
            <View>
              {r.top.length
                ? r.top.map((t) => (
                    <View key={t.profileId} testID={`inviter-${t.profileId}`} style={row}>
                      <View style={{ flex: 1, minWidth: 0 }}>
                        <Txt style={small}>{nick(t.nickname)}</Txt>
                        <Txt tone="muted" numberOfLines={1} style={tiny}>
                          {t.profileId}
                        </Txt>
                      </View>
                      <Txt num bold style={small}>
                        {inviterLine(t)}
                      </Txt>
                    </View>
                  ))
                : none}
            </View>
            <Txt bold style={small}>
              최근 초대
            </Txt>
            <View>
              {r.recent.length
                ? r.recent.map((v) => (
                    <View key={v.inviteeId} style={row}>
                      <View style={{ flex: 1, minWidth: 0 }}>
                        <Txt style={small}>{invitePair(v)}</Txt>
                        <Txt tone="muted" style={tiny}>
                          {kst(v.claimedAt)}
                        </Txt>
                      </View>
                      <Txt bold tone={v.doneAt ? 'good' : 'muted'} style={small}>
                        {inviteState(v)}
                      </Txt>
                    </View>
                  ))
                : none}
            </View>
          </>
        ) : null}
      </LoadState>
    </View>
  );
}
