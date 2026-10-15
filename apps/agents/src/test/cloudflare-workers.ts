// 테스트용 `cloudflare:workers` 대역. Durable Object 자체는 단위 테스트에서 만들지 않는다.
export class DurableObject<E = unknown> {
  constructor(
    readonly ctx: unknown,
    readonly env: E,
  ) {}
}
