import type { LocalStore } from '@offside/engine-client';

/**
 * 채널 어댑터가 구현해야 하는 공통 인터페이스. web·toss 구현이 모두 같은 타입을 만족한다.
 * 화면·엔진은 `Platform`만 알고 `channel`을 읽어 분기하지 않는다(채널 차이는 어댑터가 값으로 준다).
 */
export type Channel = 'web' | 'toss';

/**
 * 문자열 키-값 저장소. toss 채널의 `LocalStore` 구현이 이 인터페이스 위에 얹힌다. 지금은
 * `MemoryStringKV`를 주입하고, M-001에서 앱인토스 네이티브 `Storage`를 같은 인터페이스로 감싼다.
 */
export interface StringKV {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
  removeItem(key: string): Promise<void>;
  keys(): Promise<string[]>;
}

export interface Platform {
  readonly channel: Channel;
  readonly theme: { forced: 'light' | 'dark' | null };
  createLocalStore(): Promise<LocalStore>;
  session: {
    getBearerToken(): Promise<string | null>;
    setBearerToken(token: string | null): Promise<void>;
  };
  identity: {
    getAnonymousKey(): Promise<string | null>;
  };
  lifecycle: {
    onBackPressed(handler: () => boolean): () => void;
    confirmExit(): Promise<boolean>;
  };
  insets(): { top: number; bottom: number };
  analytics: {
    track(event: string, props?: Record<string, string | number | boolean>): void;
  };
  openExternal(url: string): void;
}
