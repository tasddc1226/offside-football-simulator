// T-11-377 선수 이름 변경권 창(웹 RenameSheet.svelte) — 진행 중 선수(Game.tsx 이름 옆)와 내 선수 목록(owner/PlayerRelease.tsx)에서
// 연다. 로그인한 구단주는 변경권 1장으로 이름을 바꾸고, 로그인하지 않은 기기는 로그인 버튼을 본다. 변경권이 없으면 출석 보상
// 안내와 스토어 묶음(IapPacks)을 보인다.
import { useEffect, useRef, useState } from 'react';
import { TextInput, View } from 'react-native';
import { fetchItems } from '@offside/app-core/api/cup';
import { hasSessionHint } from '@offside/app-core/api/client';
import { PLAYER_NAME_MAX, applyRename, renameDraft, renamePlayer } from '@offside/app-core/rename';
import { renameText as L } from '@offside/app-core/i18n/ko/rename';
import { save, toast } from '../../game/host';
import { iapItems, useIapItems } from '../../platform/iapItems';
import { appState } from '../../store';
import { revealFocusedInput } from '../../ui/scroll';
import { Btn, Txt } from '../../ui';
import { PopSheet } from '../../ui/PopSheet';
import { useInputStyle } from '../create/parts';
import { IapPacks } from '../owner/IapPacks';
import { LoginButtons } from '../owner/LoginButtons';

export function RenameSheet({
  careerId,
  name,
  close,
  onDone,
}: {
  careerId: string;
  name: string;
  close: () => void;
  onDone?: (name: string) => void;
}) {
  const input = useInputStyle();
  // undefined = 묻는 중, null = 로그인 필요.
  const [asked, setAsked] = useState<number | null | undefined>(
    hasSessionHint() ? undefined : null,
  );
  const [text, setText] = useState(name);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  // 응답을 못 받아 다시 누르면 같은 키로 보내 서버가 두 장을 쓰지 않는다. 성공하거나 거절되면 새 키.
  const key = useRef(crypto.randomUUID());
  // 스토어에서 사면 iapItems.items가 새 장수로 바뀐다.
  const iap = useIapItems(asked !== null);
  const have = asked == null ? asked : Math.max(asked, iap.items?.rename ?? 0);

  useEffect(() => {
    if (asked === null) return;
    void fetchItems().then((r) =>
      setAsked(r.ok ? (r.data.rename ?? 0) : r.error.reason === 'GOOGLE_LOGIN_REQUIRED' ? null : 0),
    );
    // 창을 열 때 한 번만 묻는다.
  }, []);

  const submit = async () => {
    if (busy || !have) return;
    const d = renameDraft(text, name);
    if (!d.ok) return setMessage(d.message);
    setBusy(true);
    setMessage('');
    const r = await renamePlayer(careerId, d.name, key.current);
    setBusy(false);
    if (!r.ok) {
      if (!r.error.retryable) key.current = crypto.randomUUID();
      if (r.error.reason === 'GOOGLE_LOGIN_REQUIRED') setAsked(null);
      else setMessage(r.error.message || L.fail);
      return;
    }
    if (iapItems.items) iapItems.items = { ...iapItems.items, rename: r.data.rename };
    if (applyRename(careerId, r.data.name, appState.G)) save();
    toast(L.done({ name: r.data.name }));
    onDone?.(r.data.name);
    close();
  };

  return (
    <PopSheet
      label={L.title}
      testID={`rename-sheet-${have === null ? 'guest' : 'owner'}`}
      onClose={close}
    >
      <Txt v="h3" bold accessibilityRole="header">
        {L.title}
      </Txt>
      {have === null ? (
        <>
          <Txt v="sm">{L.guest}</Txt>
          <LoginButtons onDone={() => setAsked(hasSessionHint() ? undefined : null)} />
        </>
      ) : (
        <>
          <Txt v="sm" tone="muted">
            {L.lead}
          </Txt>
          <View style={{ gap: 4 }}>
            <Txt v="sm">{L.label}</Txt>
            <TextInput
              testID="rename-input"
              accessibilityLabel={L.label}
              maxLength={PLAYER_NAME_MAX}
              autoCorrect={false}
              autoCapitalize="none"
              spellCheck={false}
              returnKeyType="done"
              editable={!busy && !!have}
              value={text}
              onChangeText={setText}
              onFocus={revealFocusedInput}
              onSubmitEditing={() => void submit()}
              style={input}
            />
          </View>
          {have !== undefined ? (
            <Txt v="sm" num testID="rename-have">
              {L.have({ n: have })}
            </Txt>
          ) : null}
          {have === 0 ? (
            <>
              <Txt v="sm" tone="muted">
                {L.noneApp}
              </Txt>
              <IapPacks item="rename" />
            </>
          ) : null}
          {message ? (
            <Txt v="sm" tone="bad" accessibilityRole="alert">
              {message}
            </Txt>
          ) : null}
          <Btn
            kind="accent"
            block
            disabled={busy || !have}
            testID="rename-submit"
            onPress={() => void submit()}
          >
            {busy ? L.busy : L.btn}
          </Btn>
        </>
      )}
      <Btn block testID="rename-close" onPress={close}>
        {L.close}
      </Btn>
    </PopSheet>
  );
}
