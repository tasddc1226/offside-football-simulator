// T-10-072 Node 테스트용 `cloudflare:workers` 대역(vitest.config.ts alias). 워커 런타임 모듈이라 Node에선 못 읽는다.
export class DurableObject<Env = unknown> {
  constructor(
    protected ctx: DurableObjectState,
    protected env: Env,
  ) {}
}
