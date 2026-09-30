// T-11-015 채팅 신고 처리(웹 admin/AdminChatReports.svelte): 처리하지 않은 신고를 메시지마다 모아 본다. 본문은 신고할 때
// 남긴 사본이라 메시지가 방에서 지워진 뒤(7일)에도 보이고, 작성자를 정지할 수 있다. 여럿이 신고한 메시지는 이미 가려져 있다.
import { useEffect, useState } from 'react';
import { View } from 'react-native';
import { CHAT_MUTE_DAYS } from '@offside/contracts/chat';
import * as api from '@offside/app-core/api/chat';
import type { AdminChatReport } from '@offside/app-core/api/chat';
import { REPORT_REASON_LABEL, kstDateTime as kst } from '@offside/app-core/boardText';
import { LoadState, type LoadStatus } from '../../../components/LoadState';
import { toast } from '../../../game/host';
import { rem } from '../../../theme/type';
import { useColors } from '../../../theme/useColors';
import { Btn } from '../../../ui/Btn';
import { Pill } from '../../../ui/bits';
import { Txt } from '../../../ui/Txt';
import { confirmAsync } from '../../board/parts';

export default function AdminChatReports() {
  const c = useColors();
  const [items, setItems] = useState<AdminChatReport[]>([]);
  const [status, setStatus] = useState<LoadStatus>('loading');
  const [busy, setBusy] = useState(false);

  async function load() {
    setStatus('loading');
    const r = await api.fetchChatReports();
    if (!r.ok) return setStatus('error');
    setItems(r.data.items);
    setStatus('ready');
  }
  useEffect(() => void load(), []);

  async function resolve(it: AdminChatReport, action: api.ChatReportAction) {
    if (
      typeof action === 'number' &&
      !(await confirmAsync(
        `${it.nickname}님의 채팅을 ${action}일 정지할까요?`,
        '이 메시지도 가려져요.',
        '정지',
      ))
    )
      return;
    setBusy(true);
    const r = await api.resolveChatReportAs(it, action);
    setBusy(false);
    toast(r.text);
    if (!r.ok) return;
    setItems((list) => list.filter((x) => x.messageId !== it.messageId));
  }

  return (
    <View testID="admin-chat-reports" style={{ gap: 12 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <Txt v="h2" accessibilityRole="header">
          채팅 신고
        </Txt>
        <Btn sm onPress={() => void load()}>
          새로고침
        </Btn>
      </View>
      <LoadState
        status={status}
        failText="채팅 신고를 불러오지 못했어요."
        retry={() => void load()}
      >
        <View>
          {items.length ? (
            items.map((it) => (
              <View
                key={it.messageId}
                testID={`chat-report-${it.messageId}`}
                style={{
                  gap: 4,
                  paddingVertical: 10,
                  borderBottomWidth: 1,
                  borderBottomColor: c.line,
                }}
              >
                <View
                  style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 6 }}
                >
                  <Txt bold>{it.nickname}</Txt>
                  <Pill tone="warn">{`신고 ${it.reports}`}</Pill>
                  {it.reasons.map((r) => (
                    <Pill key={r}>{REPORT_REASON_LABEL[r]}</Pill>
                  ))}
                </View>
                <Txt>{it.body}</Txt>
                <Txt tone="muted" style={{ fontSize: rem(0.75) }}>
                  {`마지막 신고 ${kst(it.lastReportedAt)}`}
                </Txt>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
                  <Btn
                    sm
                    testID="chat-report-hide"
                    disabled={busy}
                    onPress={() => void resolve(it, 'hide')}
                  >
                    가리기
                  </Btn>
                  <Btn
                    sm
                    testID="chat-report-dismiss"
                    disabled={busy}
                    onPress={() => void resolve(it, 'dismiss')}
                  >
                    기각
                  </Btn>
                  {CHAT_MUTE_DAYS.map((d) => (
                    <Btn
                      key={d}
                      sm
                      testID={`chat-report-mute-${d}`}
                      disabled={busy}
                      onPress={() => void resolve(it, d)}
                    >
                      {`${d}일 정지`}
                    </Btn>
                  ))}
                </View>
              </View>
            ))
          ) : (
            <Txt tone="muted">처리할 채팅 신고가 없어요.</Txt>
          )}
        </View>
      </LoadState>
    </View>
  );
}
