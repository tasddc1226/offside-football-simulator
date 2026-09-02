/**
 * 채널 어댑터가 구현해야 하는 공통 인터페이스. web·toss 구현이 모두 같은 타입을 만족한다.
 */
export interface Platform {
  readonly channel: 'web' | 'toss';
}
