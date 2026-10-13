// 남의 공개 이름(명예의 전당 선수·구단) 신고(웹 NameReport.svelte) — 앱스토어 UGC 정책. 운영자가 관리 화면에서
// 가리거나 기각한다.
import { Children, Fragment, useState, type ReactNode } from 'react';
import { View } from 'react-native';
import { reportName } from '@offside/app-core/api/reports';
import type { NameReportKind } from '@offside/contracts/board-limits';
import { toast } from '../game/host';
import { confirmAsync } from '../screens/board/parts';
import { rem } from '../theme/type';
import { useColors } from '../theme/useColors';
import { Press } from '../ui/Press';
import { Txt } from '../ui/Txt';
import { hofOwnText as L } from '@offside/app-core/i18n/ko/hofOwn';

export function NameReport({ kind, id, name }: { kind: NameReportKind; id: string; name: string }) {
  const c = useColors();
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  /** T-11-167 owner는 구단주 닉네임 신고다(id는 그 구단). */
  const T =
    kind === 'owner'
      ? { title: L.reportNickTitle, label: L.reportNickLabel, btn: L.reportNickBtn }
      : {
          title: L.reportTitle,
          label: L.reportLabel,
          btn: kind === 'team' ? L.reportTeamBtn : L.reportPlayerBtn,
        };
  async function send() {
    if (busy) return;
    const ok = await confirmAsync(T.title({ name }), L.reportBody, L.reportConfirm);
    if (!ok) return;
    setBusy(true);
    const r = await reportName({ kind, id });
    setBusy(false);
    if (!r.ok) return toast(r.error.message);
    setSent(true);
    toast(L.reportSent);
  }
  return (
    <Press
      testID={kind === 'owner' ? 'nick-report' : 'name-report'}
      accessibilityLabel={T.label({ name })}
      disabled={sent || busy}
      onPress={() => void send()}
      style={{ minHeight: 36, justifyContent: 'center', paddingHorizontal: 8 }}
    >
      <Txt style={{ fontSize: rem(0.8125), color: c.muted }}>{sent ? L.reportDone : T.btn}</Txt>
    </Press>
  );
}

/** T-11-237 화면 맨 아래 신고 버튼 줄(웹 NameReports.svelte) — 구단 화면은 구단 이름·구단주 닉네임을 한 줄에 · 로 잇는다. */
export function NameReports({ children }: { children: ReactNode }) {
  const c = useColors();
  const items = Children.toArray(children).filter(Boolean);
  return (
    <View
      style={{
        flexDirection: 'row',
        flexWrap: 'wrap',
        justifyContent: 'center',
        alignItems: 'center',
        marginTop: 12,
      }}
    >
      {items.map((item, i) => (
        <Fragment key={i}>
          {i > 0 ? <Txt style={{ fontSize: rem(0.8125), color: c.muted }}>·</Txt> : null}
          {item}
        </Fragment>
      ))}
    </View>
  );
}
