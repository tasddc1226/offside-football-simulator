// T-11-217 팀 프리셋 시트(웹 team/TeamPresets.svelte) — 지금 편성 저장 · 불러오기 · 덮어쓰기 · 이름 바꾸기 · 삭제.
// 불러오기는 편성 초안만 채운다. T-11-570 프리셋 하나를 컵 명단으로 고르면 컵 경기는 그 편성으로 뛴다. 컵 명단은 위쪽
// 한 줄에서 고르고, 카드에는 불러오기와 관리(⋯ — 덮어쓰기 · 이름 바꾸기 · 삭제)만 둔다.
import { RADIUS } from '@offside/app-core/design-tokens';
import { useState } from 'react';
import { Alert, View } from 'react-native';
import { teamHomeText as L } from '@offside/app-core/i18n/ko/teamHome';
import {
  TEAM_PRESET_NAME_MAX,
  nextPresetName,
  presetSummary,
  presetsFull,
  removePreset,
  renamePreset,
  replacePreset,
  setCupPreset,
  type TeamPreset,
} from '@offside/app-core/teamPresets';
import { toast } from '../../game/host';
import { TeamDialog } from '../../components/TeamDialog';
import { useColors } from '../../theme/useColors';
import { Btn, Txt } from '../../ui';
import { TextField } from '../settings/parts';

export function TeamPresets({
  close,
  presets,
  hasTeam,
  locked,
  cupLocked = false,
  cup = false,
  draft,
  persist,
  onLoad,
}: {
  close: () => void;
  presets: readonly TeamPreset[];
  hasTeam: boolean;
  /** 컵 명단이 잠겨 불러올 수 없다. */
  locked: boolean;
  /** T-11-570 컵 경기 명단이 잠겨 컵 명단을 고르거나 고칠 수 없다. */
  cupLocked?: boolean;
  /** T-11-570 컵 명단 고르기를 보인다. */
  cup?: boolean;
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
  const [menu, setMenu] = useState<number | null>(null);
  const cupIndex = presets.findIndex((p) => p.cup);

  async function run(next: TeamPreset[], saved = false) {
    if (busy) return false;
    setBusy(true);
    try {
      return await persist(next, saved);
    } finally {
      setBusy(false);
    }
  }
  /** T-11-431 덮어쓰기 · 삭제는 한 번 더 묻는다(팀 화면의 다른 확인과 같은 다이얼로그). */
  function ask(i: number, kind: 'overwrite' | 'delete') {
    const p = presets[i]!;
    setMenu(null);
    Alert.alert(p.name, kind === 'overwrite' ? L.tpOverwriteAsk : L.tpDeleteAsk, [
      { text: L.cancel, style: 'cancel' },
      {
        text: kind === 'overwrite' ? L.tpOverwrite : L.tpDelete,
        style: kind === 'delete' ? 'destructive' : 'default',
        onPress: () =>
          void run(
            kind === 'overwrite'
              ? replacePreset(presets, i, draft(p.name))
              : removePreset(presets, i),
            kind === 'overwrite',
          ),
      },
    ]);
  }
  async function pickCup(i: number | null) {
    if ((i ?? -1) === cupIndex) return;
    if (await run(setCupPreset(presets, i))) toast(i === null ? L.tpCupUnsetDone : L.tpCupSetDone);
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
          ) : cup ? (
            <View
              testID="preset-cup-pick"
              style={{
                borderWidth: 1,
                borderColor: c.line,
                borderRadius: RADIUS.md,
                padding: 12,
                gap: 8,
                opacity: cupLocked ? 0.6 : 1,
              }}
            >
              <Txt v="sm" bold>
                {L.tpCupTitle}
              </Txt>
              <View
                accessibilityRole="radiogroup"
                style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}
              >
                {[null, ...presets.map((_, i) => i)].map((i) => {
                  const on = (i ?? -1) === cupIndex;
                  return (
                    <Btn
                      key={i ?? 'team'}
                      sm
                      kind={on ? 'tonal' : 'default'}
                      disabled={busy || cupLocked}
                      onPress={() => void pickCup(i)}
                      testID={i === null ? 'preset-cup-team' : `preset-cup-${i}`}
                    >
                      {i === null ? L.tpCupTeam : presets[i]!.name}
                    </Btn>
                  );
                })}
              </View>
              <Txt v="sm" tone={cupLocked ? 'warn' : 'muted'} testID="preset-cup-hint">
                {cupLocked ? L.tpCupLocked : L.tpCupHint}
              </Txt>
            </View>
          ) : null}
          {presets.map((p, i) => {
            const s = presetSummary(p);
            return (
              <View
                key={i}
                testID={`preset-${i}`}
                style={{
                  borderWidth: 1,
                  borderColor: p.cup ? c.good : c.line,
                  borderRadius: RADIUS.md,
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
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
                      <View
                        style={{
                          flexDirection: 'row',
                          flexWrap: 'wrap',
                          alignItems: 'center',
                          columnGap: 8,
                        }}
                      >
                        <Txt style={{ fontWeight: '700' }}>{p.name}</Txt>
                        {p.cup ? (
                          <Txt
                            v="xs"
                            bold
                            testID={`preset-cup-badge-${i}`}
                            style={{
                              color: '#fff',
                              backgroundColor: c.good,
                              borderRadius: 999,
                              paddingHorizontal: 8,
                              overflow: 'hidden',
                            }}
                          >
                            {L.tpCupBadge}
                          </Txt>
                        ) : null}
                      </View>
                      <Txt v="sm" tone="muted">
                        {L.tpSummary({ shape: s.shape, n: s.starters })}
                      </Txt>
                    </View>
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
                      accessibilityLabel={L.tpMore({ name: p.name })}
                      onPress={() => setMenu(menu === i ? null : i)}
                      testID={`preset-more-${i}`}
                    >
                      ⋯
                    </Btn>
                  </View>
                )}
                {menu === i && renaming !== i ? (
                  <View
                    style={{
                      flexDirection: 'row',
                      flexWrap: 'wrap',
                      gap: 6,
                      paddingTop: 8,
                      borderTopWidth: 1,
                      borderTopColor: c.line,
                    }}
                  >
                    <Btn
                      sm
                      kind="ghost"
                      disabled={busy || (!!p.cup && cupLocked)}
                      onPress={() => ask(i, 'overwrite')}
                      testID={`preset-overwrite-${i}`}
                    >
                      {L.tpOverwrite}
                    </Btn>
                    <Btn
                      sm
                      kind="ghost"
                      disabled={busy}
                      onPress={() => {
                        setMenu(null);
                        setRenaming(i);
                        setNameDraft(p.name);
                      }}
                      testID={`preset-rename-${i}`}
                    >
                      {L.tpRename}
                    </Btn>
                    <Btn
                      sm
                      kind="danger"
                      disabled={busy || (!!p.cup && cupLocked)}
                      onPress={() => ask(i, 'delete')}
                      testID={`preset-delete-${i}`}
                    >
                      {L.tpDelete}
                    </Btn>
                  </View>
                ) : null}
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
