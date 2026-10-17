import { ClientErrorReportSchema } from '@offside/contracts';
import type { Hono } from 'hono';
import type { AppEnv } from '../env.js';
import { recordClientErrors } from '../status/clientErrors.js';
import { readBody } from './shared.js';

// T-11-331 앱·웹 오류 받기. 세션 · DB를 건드리지 않고 isolate 메모리에 세기만 한다(1분 주기에 D1로, logger.ts).
// 웹은 허용된 Origin, 앱은 Bearer로 originGuard를 지난다. 응답은 항상 204(보낸 쪽이 다시 보내지 않게).
export function registerClientErrorRoutes(app: Hono<AppEnv>): void {
  app.post('/v1/client-errors', async (c) => {
    const report = readBody(c, ClientErrorReportSchema);
    const dropped = await recordClientErrors(report, Date.now());
    if (dropped)
      console.log(JSON.stringify({ level: 'warn', msg: 'client-errors-dropped', dropped }));
    return c.body(null, 204);
  });
}
