// T-11-001 세이브 저장소. 웹은 localStorage, 앱은 동기 키-값 저장소(MMKV 등)를 setStorage로 넣는다.
// 세이브는 한 번에 읽고 쓰는 동기 API라 비동기 저장소는 앞에 메모리 캐시를 두고 넣는다.

/** 세이브가 쓰는 만큼의 동기 키-값 저장소(Web Storage의 부분집합). */
export interface KeyValueStore {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

let store: KeyValueStore | null = null;

/** 앱 시작 때 한 번 저장소를 정한다. 정하지 않으면 전역 localStorage(웹·테스트)를 쓴다. */
export function setStorage(s: KeyValueStore): void {
  store = s;
}

/** 지금 저장소. 없으면(저장소가 막힌 환경) 던진다 — 부르는 쪽이 try로 감싼다. */
export function storage(): KeyValueStore {
  const s = store ?? (globalThis as { localStorage?: KeyValueStore }).localStorage;
  if (!s) throw new Error('storage unavailable');
  return s;
}
