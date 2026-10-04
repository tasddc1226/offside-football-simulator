// 남의 공개 이름(명예의 전당 선수·구단) 신고(웹 NameReport.svelte) — 앱스토어 UGC 정책. 운영자가 관리 화면에서
// 가리거나 기각한다.
import { useState } from 'react';
import { reportName } from '@offside/app-core/api/reports';
import type { NameReportKind } from '@offside/contracts/board-limits';
import { toast } from '../game/host';
import { confirmAsync } from '../screens/board/parts';
import { rem } from '../theme/type';
import { useColors } from '../theme/useColors';
import { Press } from '../ui/Press';
import { Txt } from '../ui/Txt';

export function NameReport({ kind, id, name }: { kind: NameReportKind; id: string; name: string }) {
  const c = useColors();
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  async function send() {
    if (busy) return;
    const ok = await confirmAsync(
      `'${name}' 이름을 신고할까요?`,
      '운영자가 확인 후 처리해요.',
      '신고',
    );
    if (!ok) return;
    setBusy(true);
    const r = await reportName({ kind, id });
    setBusy(false);
    if (!r.ok) return toast(r.error.message);
    setSent(true);
    toast('신고했어요. 운영자가 확인할게요.');
  }
  return (
    <Press
      testID="name-report"
      accessibilityLabel={`${name} 이름 신고`}
      disabled={sent || busy}
      onPress={() => void send()}
      style={{
        alignSelf: 'center',
        minHeight: 36,
        justifyContent: 'center',
        paddingHorizontal: 12,
        marginTop: 12,
      }}
    >
      <Txt style={{ fontSize: rem(0.8125), color: c.muted }}>
        {sent ? '신고했어요' : '이름 신고'}
      </Txt>
    </Press>
  );
}
