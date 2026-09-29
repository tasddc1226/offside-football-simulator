// 설정 화면의 '진행 중 커리어 백업' 카드(웹 BackupSettings.svelte, T-10-116) — 세이브를 백업 코드/JSON으로 내보내고
// 다시 불러온다. 기기를 바꿀 때 쓴다. 형식·검증·쓰는 키는 웹과 같은 @offside/app-core/backup.
// 앱은 파일을 직접 쓰거나 고르지 못한다(expo-file-system 없음) — 내보내기는 시스템 공유 시트(JSON 글)·클립보드 복사,
// 가져오기는 붙여넣기(칸 · '클립보드에서 붙여넣기')로 바꿨다.
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
import { loadHOF, loadKey } from '@offside/game/season';
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

const MONO = Platform.select({ ios: 'Menlo', default: 'monospace' });

const FAIL_TEXT: Record<DecodeFail, string> = {
  empty: '백업 코드를 붙여넣거나 백업 글을 붙여넣어 주세요',
  format: '백업 코드가 올바르지 않아요. 코드를 끝까지 복사했는지 확인해 주세요',
  version: '이 백업은 지금 게임과 형식이 맞지 않아 불러올 수 없어요',
  saveVersion: '이 백업은 지금 게임 버전과 맞지 않아 불러올 수 없어요',
  save: '백업 안의 커리어 데이터가 올바르지 않아 불러올 수 없어요',
  tooLarge: '백업 코드가 너무 커서 불러올 수 없어요',
};

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
      toast('백업 코드를 복사했어요');
    } catch {
      setManualCode(b.code); // 자동 복사 실패 — 칸을 열어 직접 복사하게 한다.
      toast('아래 코드를 길게 눌러 직접 복사해 주세요');
    }
  }

  async function shareFile() {
    const b = build();
    if (!b) return;
    try {
      await Share.share({ title: 'OFFSIDE 커리어 백업', message: b.json });
    } catch {
      toast('공유하지 못했어요. 코드 복사를 써 주세요');
    }
  }

  function apply(backup: Backup) {
    if (!applyBackup(backup, loadHOF()))
      return toast('저장 공간이 부족해 백업을 불러오지 못했어요. 현재 커리어는 그대로예요');
    reloadGame();
    appState.report = null;
    setPasted('');
    setManualCode('');
    goHome();
    toast('백업을 불러왔어요');
  }

  function importText(text: string) {
    const r = decodeBackup(text);
    if (!r.ok) return toast(FAIL_TEXT[r.reason]);
    const cur = appState.G;
    if (cur && !cur.retired) {
      Alert.alert(
        '백업 불러오기',
        `지금 진행 중인 ${cur.name} 선수의 커리어를 백업으로 바꿀까요? 되돌릴 수 없어요.`,
        [
          { text: '취소', style: 'cancel' },
          { text: '바꾸기', style: 'destructive', onPress: () => apply(r.backup) },
        ],
      );
      return;
    }
    apply(r.backup);
  }

  async function pasteFromClipboard() {
    try {
      const t = await Clipboard.getStringAsync();
      if (!t.trim()) return toast('클립보드가 비어 있어요');
      setPasted(t);
    } catch {
      toast('클립보드를 읽지 못했어요');
    }
  }

  return (
    <SettingsCard>
      <SettingsLabel
        eyebrow="Backup"
        title="진행 중 커리어 백업"
        muted="기기를 바꿀 때 쓰세요. 백업 코드는 다른 사람에게 보내지 마세요."
      />
      {G ? (
        <View
          testID="backup-export-box"
          style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 12 }}
        >
          <Btn sm testID="backup-copy" onPress={() => void copyCode()}>
            코드 복사
          </Btn>
          <Btn sm testID="backup-file" onPress={() => void shareFile()}>
            공유로 내보내기
          </Btn>
        </View>
      ) : null}
      {G && manualCode ? (
        <Field label="백업 코드 (직접 복사)" style={{ marginTop: 12 }}>
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
        <Field label="백업 불러오기">
          <TextField
            value={pasted}
            onChangeText={setPasted}
            multiline
            numberOfLines={3}
            placeholder="백업 코드를 여기에 붙여넣어요"
            testID="backup-paste"
            accessibilityLabel="백업 불러오기"
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
            불러오기
          </Btn>
          <Btn sm testID="backup-pick" onPress={() => void pasteFromClipboard()}>
            클립보드에서 붙여넣기
          </Btn>
        </View>
        <Txt tone="muted" v="xs" style={{ marginTop: 8 }}>
          백업 코드나 내보낸 백업 글을 붙여넣으면 돼요.
        </Txt>
      </View>
    </SettingsCard>
  );
}
