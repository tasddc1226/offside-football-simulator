// T-11-804 첫 시즌 선수 정보 고치기 창(웹 PlayerEditSheet.svelte). 첫 시즌 결산 전(career.length === 0, 은퇴 전)에 선수 탭의
// '고치기'와 이름 옆 연필(Game.tsx)에서 연다. 이름 · 주발 · 체격을 무료로, 몇 번이든 고친다. 서버를 부르지 않는다(첫 시즌
// 업로드가 고친 값으로 처음 들어간다).
import { useState } from 'react';
import { TextInput, View } from 'react-native';
import { useSnapshot } from 'valtio';
import { RADIUS } from '@offside/app-core/design-tokens';
import {
  FEET,
  PLAYER_NAME_MAX,
  applyPlayerEdit,
  bodyEditable,
  bodyMessage,
  bodyWaiting,
  bodyPreview,
  playerEditDraft,
  playerEditInput,
} from '@offside/app-core/player-edit-view';
import { playerEditText as L } from '@offside/app-core/i18n/ko/playerEdit';
import { createText as C } from '@offside/app-core/i18n/ko/create';
import type { GameState } from '@offside/game/types';
import { save, toast } from '../../game/host';
import { appState } from '../../store';
import { revealFocusedInput } from '../../ui/scroll';
import { Btn, Opt, Txt } from '../../ui';
import { PopSheet } from '../../ui/PopSheet';
import { BodyInput, Field, Seg, SegCell, useInputStyle } from '../create/parts';
import { useColors } from '../../theme/useColors';

export function PlayerEditSheet({ close }: { close: () => void }) {
  const input = useInputStyle();
  const c = useColors();
  const s = useSnapshot(appState).G as GameState | null;
  const [start] = useState(() => (appState.G ? playerEditInput(appState.G) : null));
  const [name, setName] = useState(start?.name ?? '');
  const [h, setH] = useState<number | null>(start?.h ?? null);
  const [w, setW] = useState<number | null>(start?.w ?? null);
  const [foot, setFoot] = useState(start?.foot ?? FEET[0]!);
  const [message, setMessage] = useState('');
  if (!s || !start) return null;

  const canBody = bodyEditable(s);
  const bodyMsg = canBody ? bodyMessage({ h, w }) : null;
  const preview =
    canBody && !bodyMsg && (h !== s.body?.h || w !== s.body?.w)
      ? bodyPreview(s, { h: h!, w: w! })
      : null;
  const bodyLine = bodyMsg
    ? bodyMsg
    : preview && preview.ovr.from !== preview.ovr.to
      ? L.ovrMove(preview.ovr)
      : s.season.played > 0
        ? `${L.bodyNote} ${L.bodyPlayed}`
        : L.bodyNote;

  const submit = () => {
    const g = appState.G;
    if (!g) return;
    const d = playerEditDraft(g, { name, h, w, foot });
    // 체격 오류는 체격 칸 아래 안내가 이미 보여 준다(알림으로 한 번 더 읽지 않는다).
    if (!d.ok) return setMessage(d.field === 'body' ? '' : d.message);
    if (!d.changed) return setMessage(L.same);
    if (applyPlayerEdit(g, d.edit)) save();
    toast(L.done);
    close();
  };

  return (
    <PopSheet label={L.title} testID="player-edit-sheet" onClose={close}>
      <Txt v="h3" bold accessibilityRole="header">
        {L.title}
      </Txt>
      <Txt v="sm" tone="muted">
        {L.lead}
      </Txt>
      <Field label={L.name}>
        <TextInput
          testID="pe-name"
          accessibilityLabel={L.name}
          maxLength={PLAYER_NAME_MAX}
          autoCorrect={false}
          autoCapitalize="none"
          spellCheck={false}
          returnKeyType="done"
          value={name}
          onChangeText={(v) => {
            setName(v);
            setMessage('');
          }}
          onFocus={revealFocusedInput}
          style={input}
        />
        <Txt v="sm" tone="muted">
          {L.nameRule({ max: PLAYER_NAME_MAX })}
        </Txt>
      </Field>
      <Field label={L.foot}>
        <Seg>
          {FEET.map((f) => (
            <SegCell key={f} cols={3} testID={`pe-foot-${f}`}>
              <Opt
                selected={foot === f}
                onPress={() => {
                  setFoot(f);
                  setMessage('');
                }}
                style={{ flex: 1 }}
              >
                <Txt bold>{C.foot({ v: f })}</Txt>
              </Opt>
            </SegCell>
          ))}
        </Seg>
        <Txt v="sm" tone="muted" testID="pe-foot-note">
          {L.footNote}
        </Txt>
      </Field>
      <Field label={L.body}>
        {canBody ? (
          <>
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <BodyInput
                testID="pe-height"
                label={L.height}
                unit="cm"
                value={h}
                fallback={start.h ?? 0}
                invalid={!!bodyMsg}
                onChange={(v) => {
                  setH(v);
                  setMessage('');
                }}
              />
              <BodyInput
                testID="pe-weight"
                label={L.weight}
                unit="kg"
                value={w}
                fallback={start.w ?? 0}
                invalid={!!bodyMsg}
                onChange={(v) => {
                  setW(v);
                  setMessage('');
                }}
              />
            </View>
            <Txt
              v="sm"
              tone={bodyMsg ? 'bad' : 'muted'}
              bold={!!bodyMsg}
              testID="pe-body-note"
              accessibilityLiveRegion="polite"
            >
              {bodyLine}
            </Txt>
            {preview ? (
              <View
                testID="pe-preview"
                accessible
                style={{
                  gap: 2,
                  padding: 12,
                  borderRadius: RADIUS.md,
                  backgroundColor: c.surface2,
                }}
              >
                <Txt v="sm">{L.preview}</Txt>
                <Txt v="sm" tone="muted" num>
                  {preview.rows.length
                    ? preview.rows.map((r) => r.text).join(' · ')
                    : L.previewNone}
                </Txt>
              </View>
            ) : null}
          </>
        ) : (
          <Txt v="sm" tone="muted" testID="pe-body-none">
            {bodyWaiting(s) ? L.bodyWaiting : L.bodyNone}
          </Txt>
        )}
      </Field>
      {message ? (
        <Txt v="sm" tone="bad" accessibilityRole="alert">
          {message}
        </Txt>
      ) : null}
      <Btn kind="accent" block testID="player-edit-save" onPress={submit}>
        {L.save}
      </Btn>
      <Btn block testID="player-edit-close" onPress={close}>
        {L.close}
      </Btn>
    </PopSheet>
  );
}
