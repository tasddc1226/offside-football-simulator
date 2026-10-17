// T-11-354 설정의 '지난 커리어 정리'(웹 CareerCleanup.svelte). 찾기를 눌렀을 때만 서버에 묻고, 확인을 받으면 정리한다.
// 이 기기의 진행 중 커리어와 올리지 못한 업로드는 빼 달라고 보낸다(app-core careerCleanup).
import {
  cleanupKeep,
  clearStaleCareers,
  findStaleCareers,
  type CleanupFind,
} from '@offside/app-core/careerCleanup';
import { careerCleanupText as L } from '@offside/app-core/i18n/ko/careerCleanup';
import { num } from '@offside/app-core/teamText';
import { useState } from 'react';
import { Alert, View } from 'react-native';
import { toast } from '../../game/host';
import { appState } from '../../store';
import { Btn, Txt } from '../../ui';
import { SettingsCard, SettingsLabel } from './parts';

export function CareerCleanup() {
  const [state, setState] = useState<CleanupFind | 'finding' | 'clearing' | null>(null);
  const [note, setNote] = useState('');

  async function find() {
    setState('finding');
    setNote('');
    setState(await findStaleCareers(cleanupKeep(appState.G)));
  }

  async function run() {
    setState('clearing');
    const r = await clearStaleCareers(cleanupKeep(appState.G));
    const text = r.ok ? L.done({ n: num(r.cleared) }) : L.clearError({ n: num(r.cleared) });
    setNote(text);
    toast(text);
    setState(r.ok ? { kind: 'none' } : { kind: 'error' });
  }

  function confirmClear(count: number) {
    Alert.alert(L.confirmTitle, L.confirm({ n: num(count) }), [
      { text: L.cancel, style: 'cancel' },
      { text: L.ok, style: 'destructive', onPress: () => void run() },
    ]);
  }

  const busy = state === 'finding' || state === 'clearing';
  const found = typeof state === 'object' && state?.kind === 'found' ? state : null;
  const message = busy
    ? state === 'finding'
      ? L.finding
      : L.clearing
    : found
      ? L.found({ n: num(found.count) })
      : note ||
        (typeof state === 'object' && state?.kind === 'none'
          ? L.none
          : typeof state === 'object' && state?.kind === 'error'
            ? L.error
            : '');

  return (
    <SettingsCard>
      <SettingsLabel eyebrow="Careers" title={L.title} muted={L.body} />
      <View testID="career-cleanup" style={{ gap: 8, marginTop: 12, alignItems: 'flex-start' }}>
        {message ? (
          <Txt
            v="sm"
            {...(found ? {} : { tone: 'muted' as const })}
            accessibilityLiveRegion="polite"
          >
            {message}
          </Txt>
        ) : null}
        {busy ? null : found ? (
          <Btn sm testID="career-cleanup-clear" onPress={() => confirmClear(found.count)}>
            {L.clear({ n: num(found.count) })}
          </Btn>
        ) : (
          <Btn sm testID="career-cleanup-find" onPress={() => void find()}>
            {L.find}
          </Btn>
        )}
      </View>
    </SettingsCard>
  );
}
