// 관리자 글 편집기(웹 Board.svelte의 editing 폼). id가 없으면 새 글. 제목·(릴리즈 노트는 버전)·본문·번역·맨 위 고정.
import { useState } from 'react';
import { Switch, View } from 'react-native';
import {
  POST_BODY_MAX,
  POST_TITLE_MAX,
  POST_VERSION_MAX,
  type BoardKey,
} from '@offside/contracts/board-limits';
import { BOARD_LABEL } from '@offside/app-core/boardText';
import { rem } from '../../theme/type';
import { useColors, useIsDark } from '../../theme/useColors';
import { Btn } from '../../ui/Btn';
import { Txt } from '../../ui/Txt';
import { Field, TextBox } from './parts';
import { boardText as L } from '@offside/app-core/i18n/ko/board';
import * as api from '@offside/app-core/api/boards';
import { POST_LANGS, postLangLabel, type PostDraft } from '@offside/app-core/boardEditor';
import { toast } from '../../game/host';

export function PostEditor({
  board,
  draft,
  onChange,
  onSave,
  onCancel,
  busy,
}: {
  board: BoardKey;
  draft: PostDraft;
  onChange: (next: PostDraft) => void;
  onSave: () => void;
  onCancel: () => void;
  busy: boolean;
}) {
  const c = useColors();
  const dark = useIsDark();
  const [showI18n, setShowI18n] = useState(!!(draft.en.title || draft.ja.title));
  const [translating, setTranslating] = useState(false);
  async function draftTranslations() {
    if (translating) return;
    if (!draft.title.trim() || !draft.body.trim()) return toast(L.translateNeedsKorean);
    setTranslating(true);
    const r = await api.translatePost({ title: draft.title.trim(), body: draft.body.trim() });
    setTranslating(false);
    if (!r.ok) return toast(r.error.message);
    onChange({ ...draft, en: r.data.en, ja: r.data.ja });
    toast(L.translateDone);
  }
  return (
    <View style={{ gap: 10 }}>
      <Txt v="h2" accessibilityRole="header">
        {draft.id ? L.editTitle : L.newTitle({ board: BOARD_LABEL[board] })}
      </Txt>
      <Field label={L.titleLabel}>
        <TextBox
          testID="post-title"
          maxLength={POST_TITLE_MAX}
          returnKeyType="done"
          value={draft.title}
          onChangeText={(title) => onChange({ ...draft, title })}
        />
      </Field>
      {board === 'release' ? (
        <Field label={L.versionLabel}>
          <TextBox
            testID="post-version"
            maxLength={POST_VERSION_MAX}
            placeholder="v1.4.0"
            returnKeyType="done"
            autoCapitalize="none"
            autoCorrect={false}
            spellCheck={false}
            value={draft.version}
            onChangeText={(version) => onChange({ ...draft, version })}
          />
        </Field>
      ) : null}
      <Field label={L.bodyLabel}>
        <TextBox
          testID="post-body"
          multiline
          maxLength={POST_BODY_MAX}
          value={draft.body}
          onChangeText={(body) => onChange({ ...draft, body })}
          style={{ minHeight: 12 * 26 }}
        />
        <Txt tone="muted" style={{ fontSize: rem(0.75) }}>
          {L.bodyHint}
        </Txt>
      </Field>
      <Btn sm testID="toggle-translations" onPress={() => setShowI18n((v) => !v)}>
        {L.translationsTitle}
      </Btn>
      {showI18n ? (
        <View style={{ gap: 10 }}>
          <Txt tone="muted" style={{ fontSize: rem(0.75) }}>
            {L.translationsHint}
          </Txt>
          <Btn
            sm
            testID="draft-translations"
            disabled={translating}
            onPress={() => void draftTranslations()}
          >
            {translating ? L.translating : L.translateDraft}
          </Btn>
          {POST_LANGS.map((lang) => (
            <View key={lang} style={{ gap: 10 }}>
              <Field label={`${postLangLabel(lang)} · ${L.titleLabel}`}>
                <TextBox
                  testID={`post-title-${lang}`}
                  maxLength={POST_TITLE_MAX}
                  returnKeyType="done"
                  value={draft[lang].title}
                  onChangeText={(title) =>
                    onChange({ ...draft, [lang]: { ...draft[lang], title } })
                  }
                />
              </Field>
              <Field label={`${postLangLabel(lang)} · ${L.bodyLabel}`}>
                <TextBox
                  testID={`post-body-${lang}`}
                  multiline
                  maxLength={POST_BODY_MAX}
                  value={draft[lang].body}
                  onChangeText={(body) => onChange({ ...draft, [lang]: { ...draft[lang], body } })}
                  style={{ minHeight: 8 * 26 }}
                />
              </Field>
            </View>
          ))}
        </View>
      ) : null}
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        <Switch
          testID="post-pinned"
          accessibilityLabel={L.pin}
          value={draft.pinned}
          onValueChange={(pinned) => onChange({ ...draft, pinned })}
          trackColor={{ true: dark ? c.accent : c.pitch, false: c.line }}
        />
        <Txt onPress={() => onChange({ ...draft, pinned: !draft.pinned })}>{L.pin}</Txt>
      </View>
      <View style={{ flexDirection: 'row', gap: 8 }}>
        <Btn kind="accent" testID="save-post" disabled={busy} onPress={onSave}>
          {draft.id ? L.save : L.publish}
        </Btn>
        <Btn sm onPress={onCancel}>
          {L.cancel}
        </Btn>
      </View>
    </View>
  );
}
