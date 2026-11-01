// T-11-600 채팅 화면에서만 쓰므로 채팅 API(첫 화면 번들)와 따로 둔다.
import { storage } from '@offside/game/storage';

export type LoungeView = 'field' | 'chat';
const VIEW_KEY = 'ft_chat_view';
/** T-11-600 라운지를 필드로 볼지 채팅으로 볼지. 처음에는 필드이고, 마지막으로 고른 보기를 이 기기에 기억한다. */
export function currentLoungeView(): LoungeView {
  try {
    return storage().getItem(VIEW_KEY) === 'chat' ? 'chat' : 'field';
  } catch {
    return 'field';
  }
}
export function setLoungeView(view: LoungeView) {
  try {
    storage().setItem(VIEW_KEY, view);
  } catch {
    /* 기억하지 못해도 이번 화면에서는 고른 보기로 둔다. */
  }
}
