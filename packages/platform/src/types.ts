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
  /**
   * T-1-013 D-21, ADR-009: 화면은 채널 리터럴을 비교하지 않고 이 값으로만 기능을 켜고 끈다.
   * `googleLink`는 web만 true다(toss는 WebView OAuth를 막고 토스 계정이 이미 식별 수단이다).
   */
  readonly features: { googleLink: boolean };
  createLocalStore(): Promise<LocalStore>;
  /**
   * "이 기기 데이터 삭제"(SCR-030): 채널의 로컬 저장소를 통째로 지운다. 호출 전에 앱이 이미 만든
   * `LocalStore`의 `close()`를 불러 열린 연결이 없어야 한다(web: 열린 IndexedDB 연결이 있으면
   * `Dexie.delete`가 대기한다).
   */
  clearLocalData(): Promise<void>;
  session: {
    getBearerToken(): Promise<string | null>;
    setBearerToken(token: string | null): Promise<void>;
  };
  identity: {
    getAnonymousKey(): Promise<string | null>;
  };
  lifecycle: {
    onBackPressed(handler: () => boolean): () => void;
    /** Notify the web lifecycle that app navigation created a new back boundary. */
    onNavigation?(): void;
    confirmExit(): Promise<boolean>;
  };
  insets(): { top: number; bottom: number };
  analytics: {
    track(event: string, props?: Record<string, string | number | boolean>): void;
  };
  openExternal(url: string): void;
}
