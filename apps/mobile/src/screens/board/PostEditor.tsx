// 관리자 글 편집기(웹 Board.svelte의 editing 폼). id가 없으면 새 글. 제목·(릴리즈 노트는 버전)·본문·맨 위 고정.
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

export interface Draft {
  id?: string;
  title: string;
  body: string;
  version: string;
  pinned: boolean;
}

export function PostEditor({
  board,
  draft,
  onChange,
  onSave,
  onCancel,
  busy,
}: {
  board: BoardKey;
  draft: Draft;
  onChange: (next: Draft) => void;
  onSave: () => void;
  onCancel: () => void;
  busy: boolean;
}) {
  const c = useColors();
  const dark = useIsDark();
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
