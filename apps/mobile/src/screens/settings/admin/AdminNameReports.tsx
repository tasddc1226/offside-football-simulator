// 이름 신고 처리(웹 admin/AdminNameReports.svelte): 신고받은 명예의 전당 선수 이름·구단 이름을 대상마다 모아 본다.
// 가리면 선수는 익명이 되고(다시 올려도 돌아오지 않는다), 구단은 가린 이름으로 바뀐다. 처리하면 감사 로그가 남는다.
import { useEffect, useState } from 'react';
import { View } from 'react-native';
import * as api from '@offside/app-core/api/admin';
import type { AdminNameReport } from '@offside/app-core/api/admin';
import { kstDateTime as kst } from '@offside/app-core/boardText';
import { LoadState, type LoadStatus } from '../../../components/LoadState';
import { toast } from '../../../game/host';
import { rem } from '../../../theme/type';
import { useColors } from '../../../theme/useColors';
import { Btn } from '../../../ui/Btn';
import { Pill } from '../../../ui/bits';
import { Txt } from '../../../ui/Txt';
import { confirmAsync } from '../../board/parts';

const KIND = { career: '선수', team: '구단' } as const;

export default function AdminNameReports() {
  const c = useColors();
  const [items, setItems] = useState<AdminNameReport[]>([]);
  const [status, setStatus] = useState<LoadStatus>('loading');
  const [busy, setBusy] = useState(false);

  async function load() {
    setStatus('loading');
    const r = await api.fetchNameReports();
    if (!r.ok) return setStatus('error');
    setItems(r.data.items);
    setStatus('ready');
  }
  useEffect(() => void load(), []);

  async function resolve(it: AdminNameReport, action: 'hide' | 'dismiss') {
    const label = it.name ?? '(지워진 대상)';
    if (
      action === 'hide' &&
      !(await confirmAsync(`'${label}' 이름을 가릴까요?`, undefined, '가리기'))
    )
      return;
    setBusy(true);
    const r = await api.resolveNameReport({ kind: it.kind, id: it.targetId, action });
    setBusy(false);
    if (!r.ok) return toast(r.error.message);
    toast(action === 'hide' ? '이름을 가렸어요' : '신고를 기각했어요');
    setItems((list) => list.filter((x) => !(x.kind === it.kind && x.targetId === it.targetId)));
  }

  return (
    <View testID="admin-name-reports" style={{ gap: 12 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <Txt v="h2" accessibilityRole="header">
          이름 신고
        </Txt>
        <Btn sm onPress={() => void load()}>
          새로고침
        </Btn>
      </View>
      <LoadState
        status={status}
        failText="이름 신고를 불러오지 못했어요."
        retry={() => void load()}
      >
        <View>
          {items.length ? (
            items.map((it) => (
              <View
                key={`${it.kind}:${it.targetId}`}
                testID={`name-report-${it.targetId}`}
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
                  <Pill>{KIND[it.kind]}</Pill>
                  <Txt bold>{it.name ?? '(지워진 대상)'}</Txt>
                  <Pill tone="warn">{`신고 ${it.reports}`}</Pill>
                </View>
                <Txt tone="muted" style={{ fontSize: rem(0.75) }}>
                  {`마지막 신고 ${kst(it.lastReportedAt)}`}
                </Txt>
                <View style={{ flexDirection: 'row', gap: 6 }}>
                  <Btn
                    sm
                    testID="name-hide"
                    disabled={busy}
                    onPress={() => void resolve(it, 'hide')}
                  >
                    가리기
                  </Btn>
                  <Btn
                    sm
                    testID="name-dismiss"
                    disabled={busy}
                    onPress={() => void resolve(it, 'dismiss')}
                  >
                    기각
                  </Btn>
                </View>
              </View>
            ))
          ) : (
            <Txt tone="muted">처리할 이름 신고가 없어요.</Txt>
          )}
        </View>
      </LoadState>
    </View>
  );
}
