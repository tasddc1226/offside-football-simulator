import type { ChatMessage } from '@offside/contracts/chat';

type ReadMark = { at: number; ids: string[] };
type Storage = Pick<globalThis.Storage, 'getItem' | 'setItem'>;
const KEY = 'ft_chat_read';

/** 채팅 읽음 기록은 게임 세이브와 별개로 이 기기에만 둔다. */
export function createChatUnread(storage?: Storage) {
  let mark: ReadMark | null = null;
  try {
    const saved: unknown = JSON.parse(storage?.getItem(KEY) ?? 'null');
    if (
      saved &&
      typeof saved === 'object' &&
      'at' in saved &&
      'ids' in saved &&
      typeof saved.at === 'number' &&
      Number.isFinite(saved.at) &&
      Array.isArray(saved.ids) &&
      saved.ids.every((id) => typeof id === 'string')
    ) {
      mark = { at: saved.at, ids: saved.ids.slice(-200) };
    }
  } catch {
    /* 저장소가 막혀 있어도 현재 화면에서는 동작한다. */
  }

  function read(messages: readonly ChatMessage[]) {
    const at = Math.max(mark?.at ?? 0, ...messages.map((m) => m.at));
    const ids = new Set(mark?.at === at ? mark.ids : []);
    for (const m of messages) if (m.at === at) ids.add(m.id);
    mark = { at, ids: [...ids].slice(-200) };
    try {
      storage?.setItem(KEY, JSON.stringify(mark));
    } catch {
      /* 메모리 기록은 유지한다. */
    }
  }

  return {
    read,
    count(messages: readonly ChatMessage[], author?: string) {
      // 처음 접속한 기기는 기존 대화부터 알리지 않고 이후 새 메시지를 센다.
      if (!mark) read(messages);
      const seen = new Set(mark!.ids);
      return messages.filter(
        (m) => m.author !== author && (m.at > mark!.at || (m.at === mark!.at && !seen.has(m.id))),
      ).length;
    },
  };
}
