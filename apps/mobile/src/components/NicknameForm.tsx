// T-10-028 댓글 닉네임 정하기(웹 NicknameForm.svelte) — 소식 화면(첫 댓글 전)과 설정의 계정 카드가 함께 쓴다.
// 구글 로그인한 프로필만 정할 수 있고, 다른 사람과 겹치면(대소문자 무시) 서버가 거절한다.
import { useState } from 'react';
import { View } from 'react-native';
import { COMMENT_NICKNAME_MAX } from '@offside/contracts/board-limits';
import { putNickname } from '@offside/app-core/api/client';
import { toast } from '../game/host';
import { TextBox } from '../screens/board/parts';
import { accountCache } from '../store';
import { Btn } from '../ui/Btn';

export function NicknameForm({
  current = null,
  onsaved,
}: {
  current?: string | null;
  onsaved?: (nickname: string) => void;
}) {
  // 처음 값만 받아 오고 이후엔 사용자가 고친다.
  const [value, setValue] = useState(current ?? '');
  const [busy, setBusy] = useState(false);

  async function save() {
    if (busy) return;
    setBusy(true);
    const r = await putNickname(value);
    setBusy(false);
    if (!r.ok) return toast(r.error.message);
    accountCache.value = r.data;
    accountCache.fetchedAt = Date.now();
    const next = r.data.nickname ?? value;
    setValue(next);
    toast('닉네임을 정했어요');
    onsaved?.(next);
  }

  return (
    <View style={{ flexDirection: 'row', gap: 8 }}>
      <TextBox
        testID="nickname-input"
        accessibilityLabel="댓글 닉네임"
        placeholder={`댓글 닉네임 (2~${COMMENT_NICKNAME_MAX}자)`}
        maxLength={COMMENT_NICKNAME_MAX}
        returnKeyType="done"
        autoCapitalize="none"
        autoCorrect={false}
        spellCheck={false}
        value={value}
        onChangeText={setValue}
        onSubmitEditing={() => void save()}
        style={{ flex: 1, minWidth: 0 }}
      />
      <Btn
        testID="save-nickname"
        disabled={busy || value.trim() === (current ?? '')}
        onPress={() => void save()}
      >
        {current ? '바꾸기' : '정하기'}
      </Btn>
    </View>
  );
}
