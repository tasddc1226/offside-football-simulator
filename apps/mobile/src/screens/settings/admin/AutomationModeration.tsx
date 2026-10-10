import { useEffect, useState, useRef } from 'react';
import { Alert, View } from 'react-native';
import type { AutomationEnforcement } from '@offside/contracts';
import * as api from '@offside/app-core/api/admin';
import { automationModerationText as L } from '@offside/app-core/i18n/ko/automationModeration';
import { kstDateTime as kst } from '@offside/app-core/boardText';
import { LoadState, type LoadStatus } from '../../../components/LoadState';
import { Txt } from '../../../ui/Txt';
import { Btn } from '../../../ui/Btn';
import { useColors } from '../../../theme/useColors';
export default function AutomationModeration() {
  const colors = useColors();
  const [report, setReport] = useState<AutomationEnforcement | null>(null);
  const [status, setStatus] = useState<LoadStatus>('loading');
  const [busy, setBusy] = useState(false);
  const lock = useRef(false);
  const [error, setError] = useState('');
  async function load(before?: string, fresh = false) {
    if (lock.current) return;
    lock.current = true;
    setBusy(true);
    const r = await api.fetchAutomationEnforcement(before, fresh);
    lock.current = false;
    setBusy(false);
    if (!r.ok) {
      if (!before) setStatus('error');
      else setError(L.fail);
      return;
    }
    setReport((old) =>
      before && old ? { ...r.data, actions: [...old.actions, ...r.data.actions] } : r.data,
    );
    setStatus('ready');
    setError('');
  }
  async function restore(id: string) {
    if (lock.current) return;
    lock.current = true;
    setBusy(true);
    const r = await api.setAutomationHidden(id, false);
    lock.current = false;
    setBusy(false);
    if (!r.ok) {
      setError(L.restoreFail);
      return;
    }
    await load(undefined, true);
  }
  useEffect(() => void load(), []);
  return (
    <View testID="automation-enforcement" style={{ gap: 10 }}>
      <Txt v="h2">{L.title}</Txt>
      <Txt tone="muted">{L.policy}</Txt>
      <Txt tone="muted">{L.preserve}</Txt>
      <Btn disabled={busy} onPress={() => void load(undefined, true)}>
        {L.refresh}
      </Btn>
      <LoadState status={status} failText={L.fail} retry={() => void load(undefined, true)}>
        {report ? (
          <>
            <Txt
              bold
            >{`${report.enabled ? L.enabled : L.paused} · ${L.version} ${report.ruleVersion}`}</Txt>
            <Txt>
              {report.sweep
                ? `${report.sweep.status === 'complete' ? L.complete : report.sweep.status === 'error' ? L.error : L.running}\n${kst(report.sweep.updatedAt)} · ${L.checked} ${report.sweep.checked} · ${L.hiddenCount} ${report.sweep.hidden}`
                : L.notRun}
            </Txt>
            {report.sweep?.error ? (
              <Txt accessibilityRole="alert">{`${L.failureReason}: ${report.sweep.error}`}</Txt>
            ) : null}
            <Txt bold>{L.history}</Txt>
            {report.actions.map((a) => (
              <View
                key={a.key}
                style={{
                  gap: 8,
                  padding: 12,
                  borderWidth: 1,
                  borderColor: colors.line,
                  borderRadius: 12,
                }}
              >
                <Txt
                  bold
                >{`${a.action === 'hide' ? L.hideAction : L.restoreAction} · ${a.hidden ? L.hidden : L.restored}`}</Txt>
                <Txt selectable>{a.careerId}</Txt>
                <Txt tone="muted">{`${kst(a.at)} · ${L[a.source]} · ${L.version} ${a.ruleVersion}`}</Txt>
                <Txt>{`${a.reasons.map((r) => (r in L ? L[r as 'webdriver' | 'headless' | 'synthetic' | 'noInput'] : r)).join(' · ')}${a.seasons ? ` · ${L.seasons} ${a.seasons}` : ''}`}</Txt>
                {a.hidden ? (
                  <Btn
                    disabled={busy}
                    onPress={() =>
                      Alert.alert(L.restore, L.confirm, [
                        { text: L.restore, onPress: () => void restore(a.careerId) },
                        { text: L.cancel, style: 'cancel' },
                      ])
                    }
                  >
                    {L.restore}
                  </Btn>
                ) : null}
              </View>
            ))}
            {!report.actions.length ? <Txt tone="muted">{L.empty}</Txt> : null}
            {report.next ? (
              <Btn disabled={busy} onPress={() => void load(report.next ?? undefined)}>
                {L.more}
              </Btn>
            ) : null}
          </>
        ) : null}
      </LoadState>
      {error ? <Txt accessibilityRole="alert">{error}</Txt> : null}
    </View>
  );
}
