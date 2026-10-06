// 설정 화면의 '진행 중 커리어 백업' 카드(웹 BackupSettings.svelte, T-10-116) — 세이브를 백업 코드/JSON으로 내보내고
// 다시 불러온다. 기기를 바꿀 때 쓴다. 형식·검증·쓰는 키는 웹과 같은 @offside/app-core/backup.
// 앱은 파일을 직접 쓰거나 고르지 못한다(expo-file-system 없음) — 내보내기는 시스템 공유 시트(JSON 글)·클립보드 복사,
// 가져오기는 붙여넣기(칸 · '클립보드에서 붙여넣기')로 바꿨다.
import { nativeAnalytics } from '../../analytics';
import { useState } from 'react';
import { Alert, Platform, Share, View } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { useSnapshot } from 'valtio';
import { restoreGame } from '@offside/app-core/career';
import {
  applyBackup,
  decodeBackup,
  encodeBackup,
  type Backup,
  type DecodeFail,
} from '@offside/app-core/backup';
import { loadHOF } from '@offside/game/hof-store';
import { loadKey } from '@offside/game/storage';
import {
  loadClubCustom,
  save,
  toast,
  uploadLegacyRetirement,
  uploadRetirement,
} from '../../game/host';
import { goHome } from '../../game/nav';
import { appState } from '../../store';
import { Btn, Txt } from '../../ui';
import { Field, SettingsCard, SettingsLabel, TextField } from './parts';
import { useColors } from '../../theme/useColors';
import { backupText as L } from '@offside/app-core/i18n/ko/backup';

const MONO = Platform.select({ ios: 'Menlo', default: 'monospace' });

const failText = (): Record<DecodeFail, string> => ({
  empty: L.failEmptyApp,
  format: L.failFormat,
  version: L.failVersion,
  saveVersion: L.failSaveVersion,
  save: L.failSave,
  tooLarge: L.failTooLarge,
});

/** 지금 진행 중인 세이브로 백업 JSON·코드를 만든다(못 만들면 null). */
function build() {
  if (!appState.G) return null;
  save(); // 화면 상태를 저장소에 맞춰 둔다(RNG 상태 포함)
  // 저장소가 막혀 있어도 메모리의 세이브로 백업은 만들 수 있다.
  const g = loadKey('ft_save') ?? JSON.parse(JSON.stringify(appState.G));
  return encodeBackup(g, loadHOF());
}

/** 부팅과 같은 길로 저장을 읽는다(형식 변환·RNG 복원·밸런스). */
function reloadGame() {
  // 유저 클럽 이름을 먼저 CLUBS에 반영해야 세이브를 읽을 때 현재 소속 이름이 커스텀 이름을 읽는다.
  loadClubCustom();
  appState.G = restoreGame({ uploadRetirement, uploadLegacyRetirement });
  nativeAnalytics.restored(appState.G?.cid ?? null);
}

export function BackupSettings() {
  const c = useColors();
  const { G } = useSnapshot(appState);
  // 클립보드를 못 쓸 때 사용자가 직접 복사하도록 코드를 보여 주는 칸.
  const [manualCode, setManualCode] = useState('');
  const [pasted, setPasted] = useState('');

  async function copyCode() {
    const b = build();
    if (!b) return;
    try {
      await Clipboard.setStringAsync(b.code);
      setManualCode('');
      toast(L.copied);
    } catch {
      setManualCode(b.code); // 자동 복사 실패 — 칸을 열어 직접 복사하게 한다.
      toast(L.copyManual);
    }
  }

  async function shareFile() {
    const b = build();
    if (!b) return;
    try {
      await Share.share({ title: L.shareTitle, message: b.json });
    } catch {
      toast(L.shareFail);
    }
  }

  function apply(backup: Backup) {
    if (!applyBackup(backup, loadHOF())) return toast(L.noSpace);
    reloadGame();
    appState.report = null;
    setPasted('');
    setManualCode('');
    goHome();
    toast(L.restored);
  }

  function importText(text: string) {
    const r = decodeBackup(text);
    if (!r.ok) return toast(failText()[r.reason]);
    const cur = appState.G;
    if (cur && !cur.retired) {
      Alert.alert(L.importLabel, L.replaceConfirm({ name: cur.name }), [
        { text: L.cancel, style: 'cancel' },
        { text: L.replaceOk, style: 'destructive', onPress: () => apply(r.backup) },
      ]);
      return;
    }
    apply(r.backup);
  }

  async function pasteFromClipboard() {
    try {
      const t = await Clipboard.getStringAsync();
      if (!t.trim()) return toast(L.clipEmpty);
      setPasted(t);
    } catch {
      toast(L.clipFail);
    }
  }

  return (
    <SettingsCard>
      <SettingsLabel eyebrow="Backup" title={L.title} muted={L.bodyApp} />
      {G ? (
        <View
          testID="backup-export-box"
          style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 12 }}
        >
          <Btn sm testID="backup-copy" onPress={() => void copyCode()}>
            {L.copyCode}
          </Btn>
          <Btn sm testID="backup-file" onPress={() => void shareFile()}>
            {L.shareFile}
          </Btn>
        </View>
      ) : null}
      {G && manualCode ? (
        <Field label={L.manualLabel} style={{ marginTop: 12 }}>
          <View
            style={{
              borderWidth: 1,
              borderColor: c.line,
              backgroundColor: c.surface2,
              borderRadius: 10,
              padding: 12,
              maxHeight: 96,
              overflow: 'hidden',
            }}
          >
            <Txt selectable testID="backup-code" style={{ fontFamily: MONO, fontSize: 14 }}>
              {manualCode}
            </Txt>
          </View>
        </Field>
      ) : null}
      <View
        testID="backup-import-box"
        style={{ marginTop: 14, paddingTop: 14, borderTopWidth: 1, borderTopColor: c.line }}
      >
        <Field label={L.importLabel}>
          <TextField
            value={pasted}
            onChangeText={setPasted}
            multiline
            numberOfLines={3}
            placeholder={L.pastePlaceholder}
            testID="backup-paste"
            accessibilityLabel={L.importLabel}
            spellCheck={false}
            returnKeyType="default"
            style={{ fontFamily: MONO, fontSize: 14, minHeight: 80, maxHeight: 120 }}
          />
        </Field>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 10 }}>
          <Btn
            sm
            testID="backup-import"
            disabled={!pasted.trim()}
            onPress={() => importText(pasted)}
          >
            {L.importBtn}
          </Btn>
          <Btn sm testID="backup-pick" onPress={() => void pasteFromClipboard()}>
            {L.pasteClipboard}
          </Btn>
        </View>
        <Txt tone="muted" v="xs" style={{ marginTop: 8 }}>
          {L.pasteHint}
        </Txt>
      </View>
    </SettingsCard>
  );
}
