// T-11-217 팀 프리셋 시트(웹 team/TeamPresets.svelte) — 지금 편성 저장 · 불러오기 · 덮어쓰기 · 이름 바꾸기 · 삭제.
// 불러오기는 편성 초안만 채운다.
import { useState } from 'react';
import { View } from 'react-native';
import { teamHomeText as L } from '@offside/app-core/i18n/ko/teamHome';
import {
  TEAM_PRESET_NAME_MAX,
  nextPresetName,
  presetSummary,
  presetsFull,
  removePreset,
  renamePreset,
  replacePreset,
  type TeamPreset,
} from '@offside/app-core/teamPresets';
import { TeamDialog } from '../../components/TeamDialog';
import { useColors } from '../../theme/useColors';
import { Btn, Txt } from '../../ui';
import { TextField } from '../settings/parts';

export function TeamPresets({
  close,
  presets,
  hasTeam,
  locked,
  draft,
  persist,
  onLoad,
}: {
  close: () => void;
  presets: readonly TeamPreset[];
  hasTeam: boolean;
  /** 컵 명단이 잠겨 불러올 수 없다. */
  locked: boolean;
  /** 지금 편성 초안을 이 이름의 프리셋으로. */
  draft: (name: string) => TeamPreset;
  /** saved: 지금 편성을 저장 · 덮어쓴 경우(알림). */
  persist: (next: TeamPreset[], saved?: boolean) => Promise<boolean>;
  onLoad: (preset: TeamPreset) => void;
}) {
  const c = useColors();
  const [busy, setBusy] = useState(false);
  const [renaming, setRenaming] = useState<number | null>(null);
  const [nameDraft, setNameDraft] = useState('');

  async function run(next: TeamPreset[], saved = false) {
    if (busy) return false;
    setBusy(true);
    try {
      return await persist(next, saved);
    } finally {
      setBusy(false);
    }
  }
  async function finishRename(i: number) {
    const name = nameDraft.trim();
    if (name && name !== presets[i]!.name && !(await run(renamePreset(presets, i, name)))) return;
    setRenaming(null);
  }

  return (
    <TeamDialog title={L.tpTitle} close={close} avoidKeyboard>
      <Txt v="sm" tone="muted">
        {L.tpIntro}
      </Txt>
      {!hasTeam ? (
        <Txt v="sm" testID="preset-need-team">
          {L.tpNeedTeam}
        </Txt>
      ) : (
        <>
          {locked ? (
            <Txt v="sm" tone="warn" testID="preset-locked">
              {L.tpLocked}
            </Txt>
          ) : null}
          {presets.length === 0 ? (
            <Txt v="sm" tone="muted">
              {L.tpEmpty}
            </Txt>
          ) : null}
          {presets.map((p, i) => {
            const s = presetSummary(p);
            return (
              <View
                key={i}
                testID={`preset-${i}`}
                style={{
                  borderWidth: 1,
                  borderColor: c.line,
                  borderRadius: 12,
                  padding: 12,
                  gap: 10,
                }}
              >
                {renaming === i ? (
                  <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
                    <View style={{ flex: 1 }}>
                      <TextField
                        value={nameDraft}
                        onChangeText={setNameDraft}
                        maxLength={TEAM_PRESET_NAME_MAX}
                        accessibilityLabel={L.tpNameLabel}
                        testID="preset-name-input"
                        autoFocus
                        onSubmitEditing={() => void finishRename(i)}
                      />
                    </View>
                    <Btn
                      sm
                      disabled={busy || !nameDraft.trim()}
                      onPress={() => void finishRename(i)}
                      testID="preset-rename-done"
                    >
                      {L.tpNameDone}
                    </Btn>
                  </View>
                ) : (
                  <View
                    style={{
                      flexDirection: 'row',
                      flexWrap: 'wrap',
                      alignItems: 'baseline',
                      columnGap: 10,
                    }}
                  >
                    <Txt style={{ fontWeight: '700' }}>{p.name}</Txt>
                    <Txt v="sm" tone="muted">
                      {L.tpSummary({ shape: s.shape, n: s.starters })}
                    </Txt>
                  </View>
                )}
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
                  <Btn
                    sm
                    kind="primary"
                    disabled={busy || locked}
                    onPress={() => onLoad(p)}
                    testID={`preset-load-${i}`}
                  >
                    {L.tpLoad}
                  </Btn>
                  <Btn
                    sm
                    disabled={busy}
                    onPress={() => void run(replacePreset(presets, i, draft(p.name)), true)}
                    testID={`preset-overwrite-${i}`}
                  >
                    {L.tpOverwrite}
                  </Btn>
                  <Btn
                    sm
                    disabled={busy}
                    onPress={() => {
                      setRenaming(i);
                      setNameDraft(p.name);
                    }}
                    testID={`preset-rename-${i}`}
                  >
                    {L.tpRename}
                  </Btn>
                  <Btn
                    sm
                    disabled={busy}
                    onPress={() => void run(removePreset(presets, i))}
                    testID={`preset-delete-${i}`}
                  >
                    {L.tpDelete}
                  </Btn>
                </View>
              </View>
            );
          })}
          {presetsFull(presets) ? (
            <Txt v="sm" tone="muted">
              {L.tpFull}
            </Txt>
          ) : (
            <Btn
              block
              disabled={busy}
              onPress={() =>
                void run([...presets, draft(nextPresetName(presets, L.tpDefaultName))], true)
              }
              testID="preset-save"
            >
              {L.tpSaveCurrent}
            </Btn>
          )}
        </>
      )}
    </TeamDialog>
  );
}
