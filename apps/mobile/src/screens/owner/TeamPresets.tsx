// T-11-217 팀 프리셋 시트(웹 team/TeamPresets.svelte) — 지금 편성 저장 · 불러오기 · 덮어쓰기 · 이름 바꾸기 · 삭제.
// 불러오기는 편성 초안만 채운다. T-11-570 프리셋 하나를 컵 명단으로 고르면 컵 경기는 그 편성으로 뛴다.
// T-11-657 명단 관리: 리그 선발 명단(저장된 팀 명단) · 컵 선발 명단(컵 명단 프리셋) · 추가 프리셋을 구역으로 나눈다.
import { RADIUS } from '@offside/app-core/design-tokens';
import { useState } from 'react';
import { Alert, View } from 'react-native';
import { teamHomeText as L } from '@offside/app-core/i18n/ko/teamHome';
import { cupText as CT } from '@offside/app-core/i18n/ko/cup';
import {
  TEAM_PRESET_MAX,
  TEAM_PRESET_NAME_MAX,
  cupPresetName,
  nextPresetName,
  presetSummary,
  presetsFull,
  removePreset,
  renamePreset,
  replacePreset,
  setCupPreset,
  withSeasonCupPreset,
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
  league = null,
  seasonOnly = false,
  cupPast = 0,
  onSeason,
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
  /** T-11-570 컵 선발 명단 구역을 보인다(이번 시즌 팀). */
  cup?: boolean;
  /** T-11-657 저장된 팀 명단(리그 선발 명단) 요약. */
  league?: { shape: string; starters: number } | null;
  /** T-11-657 지금 컵이 이번 시즌 선수만 나가는가와 컵 명단에 든 지난 시즌 선수 수. */
  seasonOnly?: boolean;
  cupPast?: number;
  /** T-11-657 이번 시즌 선수로 컵 명단 만들기. */
  onSeason?: (() => void) | undefined;
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
  async function newCup() {
    const next = withSeasonCupPreset(
      presets,
      draft(cupPresetName(presets, L.tpCupDefaultName, L.tpDefaultName)),
    );
    if (!next) return toast(CT.seasonCupFull);
    if (await run(next)) toast(L.tpCupSetDone);
  }
  async function pickCup(i: number | null) {
    setMenu(null);
    if ((i ?? -1) === cupIndex) return;
    if (await run(setCupPreset(presets, i))) toast(i === null ? L.tpCupUnsetDone : L.tpCupSetDone);
  }
  async function finishRename(i: number) {
    const name = nameDraft.trim();
    if (name && name !== presets[i]!.name && !(await run(renamePreset(presets, i, name)))) return;
    setRenaming(null);
  }

  function renderCard(p: TeamPreset, i: number) {
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
            {cup ? (
              p.cup ? (
                <Btn
                  sm
                  kind="ghost"
                  disabled={busy || cupLocked}
                  onPress={() => void pickCup(null)}
                  testID={`preset-cup-unset-${i}`}
                >
                  {L.tpCupUnset}
                </Btn>
              ) : (
                <Btn
                  sm
                  kind="ghost"
                  disabled={busy || cupLocked}
                  onPress={() => void pickCup(i)}
                  testID={`preset-cup-${i}`}
                >
                  {L.tpCupSet}
                </Btn>
              )
            ) : null}
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
  }

  const extras = presets.map((p, i) => ({ p, i })).filter(({ p }) => !p.cup);
  const secHead = (title: string, color: string, outline = false, right?: string) => (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
      <View
        style={{
          width: 10,
          height: 10,
          borderRadius: 3,
          backgroundColor: outline ? 'transparent' : color,
          borderWidth: outline ? 2 : 0,
          borderColor: color,
        }}
      />
      <Txt bold style={{ flex: 1 }}>
        {title}
      </Txt>
      {right ? (
        <Txt v="sm" tone="muted" num>
          {right}
        </Txt>
      ) : null}
    </View>
  );
  const sec = { gap: 8, paddingTop: 14, marginTop: 4, borderTopWidth: 1, borderTopColor: c.line };

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
          <View style={sec} testID="preset-league">
            {secHead(L.tpLeagueTitle, c.ink)}
            <Txt v="sm" tone="muted">
              {L.tpLeagueDesc}
            </Txt>
            {league ? (
              <View
                style={{
                  borderWidth: 1,
                  borderColor: c.line,
                  borderRadius: RADIUS.md,
                  padding: 12,
                }}
              >
                <Txt bold num testID="preset-league-sum">
                  {L.tpSummary({ shape: league.shape, n: league.starters })}
                </Txt>
              </View>
            ) : null}
            {cup && cupIndex < 0 ? (
              <Txt v="sm" tone="muted" testID="preset-league-cup">
                {L.tpLeagueAlsoCup}
              </Txt>
            ) : null}
          </View>
          {cup ? (
            <View style={sec} testID="preset-cup-sec">
              {secHead(L.tpCupTitle, c.good)}
              <Txt v="sm" tone="muted">
                {L.tpCupDesc}
              </Txt>
              {seasonOnly ? (
                <Txt v="sm" testID="preset-season-rule">
                  {CT.ruleSeasonCards}
                </Txt>
              ) : null}
              {cupLocked ? (
                <Txt v="sm" tone="warn" testID="preset-cup-locked">
                  {L.tpCupLocked}
                </Txt>
              ) : null}
              {cupIndex >= 0 ? (
                renderCard(presets[cupIndex]!, cupIndex)
              ) : (
                <Txt v="sm" tone="muted" testID="preset-cup-empty">
                  {L.tpCupEmpty}
                </Txt>
              )}
              {seasonOnly && cupIndex >= 0 && cupPast > 0 ? (
                <Txt v="sm" tone="bad" testID="preset-cup-past">
                  {CT.barPastEntry({ n: cupPast })}
                </Txt>
              ) : null}
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
                {cupIndex < 0 ? (
                  <Btn
                    sm
                    disabled={busy || cupLocked}
                    onPress={() => void newCup()}
                    testID="preset-cup-new"
                  >
                    {L.tpCupNew}
                  </Btn>
                ) : null}
                {seasonOnly && onSeason && (cupIndex < 0 || cupPast > 0) ? (
                  <Btn
                    sm
                    disabled={busy || cupLocked}
                    onPress={onSeason}
                    testID="preset-cup-season"
                  >
                    {CT.barMakeSeasonCup}
                  </Btn>
                ) : null}
              </View>
            </View>
          ) : null}
          <View style={sec} testID="preset-extra">
            {secHead(
              L.tpExtraTitle,
              c.muted,
              true,
              (cupIndex >= 0 ? L.tpCountWithCup : L.tpCount)({
                n: presets.length,
                max: TEAM_PRESET_MAX,
              }),
            )}
            <Txt v="sm" tone="muted">
              {L.tpExtraDesc}
            </Txt>
            {extras.length === 0 ? (
              <Txt v="sm" tone="muted">
                {L.tpEmpty}
              </Txt>
            ) : (
              extras.map(({ p, i }) => renderCard(p, i))
            )}
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
          </View>
        </>
      )}
    </TeamDialog>
  );
}
