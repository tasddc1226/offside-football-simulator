// 팀 · 선수 라운지 공유의 결과 안내. 채팅 문구를 싣기 때문에 첫 화면에도 실리는 chat.ts와 나눠 둔다.
import type { ChatShareInput } from '@offside/contracts';
import { chatText as L } from '../i18n/ko/chat.js';
import { shareToChat } from './chat.js';

/** 내 팀 · 선수를 라운지에 올리고 결과를 알린다(알림은 웹 · 앱이 넘긴다). 올렸으면 true. */
export async function shareToLoungeWith(
  input: ChatShareInput,
  toast: (text: string) => void,
): Promise<boolean> {
  const r = await shareToChat(input);
  if (r.ok) {
    toast(L.shareSent);
    return true;
  }
  const { reason } = r.error;
  toast(
    r.error.code === 'RATE_LIMITED'
      ? L.shareRate
      : reason === 'login'
        ? L.shareLogin
        : reason === 'nickname'
          ? L.shareNickname
          : reason === 'muted'
            ? L.shareMuted
            : L.shareFail,
  );
  return false;
}
