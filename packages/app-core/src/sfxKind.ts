// T-11-738 결과 효과음 이름과 결과 → 소리 짝. 합성 코드(sfx.ts)를 끌어오지 않아 첫 화면 번들에 실어도 가볍다.

export type SfxId =
  /** 출석 · 선물 · 시즌 패스 · 카드 교환 · 광고 보상을 받았다. */
  | 'reward'
  /** 강화 성공 · 훈련 부스트 성공. */
  | 'good'
  /** 훈련 부스트 대성공. */
  | 'great'
  /** 강화 유지. */
  | 'keep'
  /** 강화 실패(단계 하락) · 부스트 실패. */
  | 'bad'
  /** 랭크전 상대를 찾았다 · 감독 커리어 이적 계약 성사. */
  | 'found'
  /** 감독 커리어 경기 중계가 끝났다. */
  | 'whistle'
  /** 감독 커리어 시즌에 우승 · 수상 배지가 있다. */
  | 'trophy'
  /** 은퇴 리포트가 열렸다(부제 "휘슬이 울릴 때까지"). */
  | 'fulltime';

/** 강화 결과 → 소리. */
export const enhanceSfx = (kind: 'success' | 'keep' | 'down'): SfxId =>
  kind === 'success' ? 'good' : kind === 'keep' ? 'keep' : 'bad';

/** 훈련 부스트 결과 → 소리. */
export const boostSfx = (out: { ok: boolean; great?: boolean }): SfxId =>
  out.great ? 'great' : out.ok ? 'good' : 'bad';
