// T-11-146 댓글·채팅 "번역 보기" 상태(웹). 번역을 펼친 글만 기억하고, 서버 호출·세션 메모는 app-core userTranslate가 한다.
import { canTranslate, translateUserText } from '@offside/app-core/userTranslate';
import { translateText as T } from '@offside/app-core/i18n/ko/translate';
import { toast } from './helpers.js';

export function createTranslations() {
  const shown = $state<Record<string, string>>({});
  let busy = $state<string | null>(null);
  return {
    can: (body: string) => canTranslate(body),
    /** 번역을 펼쳤으면 번역문, 아니면 원문. */
    text: (id: string, body: string) => shown[id] ?? body,
    translated: (id: string) => id in shown,
    label: (id: string) => (id in shown ? T.original : busy === id ? T.working : T.show),
    busy: (id: string) => busy === id,
    async toggle(id: string, body: string) {
      if (id in shown) return void delete shown[id];
      if (busy) return;
      busy = id;
      const r = await translateUserText(body);
      busy = null;
      if (!r.ok) return toast(r.error.message);
      shown[id] = r.data;
    },
  };
}
