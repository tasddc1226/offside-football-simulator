// T-11-802 '의견 보내기' 시트(웹 VoiceSheet.svelte). 설정 → 도움말 맨 위와 홈 맨 아래에서 연다. 열 때는 요청하지 않고, 보낼 때
// POST /v1/voices 한 번만 나간다. 키보드를 피해야 해서 PopSheet 대신 TeamDialog(avoidKeyboard)를 쓴다. 고른 종류와 쓴 글은
// app-core voiceDraft에 남아 닫았다 열어도 그대로 보이고, 보내기에 성공하면 비운다. 닫기 전 확인 창은 두지 않는다.
// 앱 루트 Toast는 Modal 밑에 깔리므로 결과는 시트 안에서 알린다.
import { useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, View } from 'react-native';
import {
  VOICE_BODY_MAX,
  VOICE_KINDS,
  pickVoiceKind,
  submitVoice,
  voiceDraft,
  voiceKindLabel,
  voicePlaceholder,
  type VoiceKind,
  type VoiceScreen,
} from '@offside/app-core/voice';
import { voiceText as VT } from '@offside/app-core/i18n/ko/voice';
import { DISMISS_MS, TeamDialog } from '../../components/TeamDialog';
import { openWeb } from '../../platform/openWeb';
import { appVoiceContext } from '../../platform/voiceContext';
import { Btn, Txt } from '../../ui';
import { Seg, TabOpt } from '../board/parts';
import { LinkBtn, TextField } from '../settings/parts';

export function VoiceSheet({ screen, close }: { screen: VoiceScreen; close: () => void }) {
  const [kind, setKind] = useState<VoiceKind | null>(voiceDraft.kind);
  const [text, setText] = useState(voiceDraft.text);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);
  const alive = useRef(true);
  useEffect(
    () => () => {
      alive.current = false;
    },
    [],
  );

  const edit = (t: string) => {
    voiceDraft.text = t;
    setText(t);
    if (error) setError('');
  };

  const submit = async () => {
    if (busy) return;
    setBusy(true);
    setError('');
    const r = await submitVoice(appVoiceContext(screen));
    if (!alive.current) return;
    setBusy(false);
    if (r.ok) {
      setKind(null);
      setText('');
      setDone(true);
      // accessibilityLiveRegion은 Android에서만 읽어 iOS VoiceOver에도 감사 안내를 직접 알린다.
      AccessibilityInfo.announceForAccessibility(`${VT.doneTitle} ${VT.doneBody}`);
    } else setError(r.message);
  };

  /** 방침은 시트를 먼저 닫고(초안은 남는다) 닫히는 움직임이 끝난 뒤 연다 — Modal 위에 브라우저를 띄우지 않는다. */
  const openPrivacy = () => {
    close();
    setTimeout(() => openWeb('/legal/privacy/'), DISMISS_MS);
  };

  return (
    <TeamDialog
      title={VT.title}
      close={close}
      avoidKeyboard
      footer={
        done ? (
          <Btn block testID="voice-done-close" onPress={close}>
            {VT.close}
          </Btn>
        ) : (
          <Btn
            kind="accent"
            block
            disabled={busy}
            testID="voice-submit"
            onPress={() => void submit()}
          >
            {busy ? VT.busy : VT.submit}
          </Btn>
        )
      }
    >
      {done ? (
        <View testID="voice-done" accessibilityLiveRegion="polite" style={{ gap: 6 }}>
          <Txt v="h2">{VT.doneTitle}</Txt>
          <Txt tone="muted">{VT.doneBody}</Txt>
        </View>
      ) : (
        <View testID="voice-sheet" style={{ gap: 14 }}>
          <Txt>{VT.lead}</Txt>
          <View style={{ gap: 6 }}>
            <Txt v="sm" tone="muted" style={{ fontWeight: '600' }}>
              {VT.kindLabel}
            </Txt>
            <Seg cols={3} label={VT.kindLabel}>
              {VOICE_KINDS.map((k) => (
                <TabOpt
                  key={k}
                  tight
                  title={voiceKindLabel(k)}
                  selected={kind === k}
                  testID={`voice-kind-${k}`}
                  onPress={() => setKind(pickVoiceKind(k))}
                />
              ))}
            </Seg>
          </View>
          <View style={{ gap: 4 }}>
            <TextField
              testID="voice-body"
              accessibilityLabel={VT.bodyLabel}
              multiline
              maxLength={VOICE_BODY_MAX}
              value={text}
              onChangeText={edit}
              placeholder={voicePlaceholder(kind)}
              autoCorrect
              autoCapitalize="sentences"
              returnKeyType="default"
              style={{ minHeight: 120 }}
            />
            <Txt v="xs" tone="muted" num style={{ alignSelf: 'flex-end' }}>
              {VT.count({ n: text.length, max: VOICE_BODY_MAX })}
            </Txt>
          </View>
          <View style={{ gap: 4 }}>
            <Txt v="xs" tone="muted">
              {VT.noteReply}
            </Txt>
            <Txt v="xs" tone="muted">
              {VT.noteContext}
            </Txt>
            <View style={{ alignSelf: 'flex-start' }}>
              <LinkBtn testID="voice-privacy" onPress={openPrivacy}>
                {VT.privacy}
              </LinkBtn>
            </View>
          </View>
          {error ? (
            <Txt v="sm" tone="bad" accessibilityRole="alert" testID="voice-error">
              {error}
            </Txt>
          ) : null}
        </View>
      )}
    </TeamDialog>
  );
}
