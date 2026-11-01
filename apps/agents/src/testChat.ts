// 테스트용 디스코드 브리지. chatClient 호출을 전역 fetch(`chat/<메서드>`, 본문 JSON)로 넘겨 테스트가 stubGlobal로 보게 한다.
export const fakeChat = {
  idFromName: () => 'id',
  get: () => ({
    call: async (_role: string, method: string, body: Record<string, unknown>) => {
      const r = await fetch(`chat/${method}`, { method: 'POST', body: JSON.stringify(body) });
      return (await r.json()) as { ok: boolean; error?: string; ts?: string };
    },
  }),
};
