// T-11-331 웹 오류 보내기. setup.ts가 첫 오류 때 불러온다. 처음 불릴 때 한 번 보고기를 설정하고, 화면을 떠날 때 모은 것을 보낸다.
import { configureErrorReport, flushErrors, reportError } from '@offside/app-core/errorReport';

declare const __APP_VERSION__: string | undefined;

configureErrorReport({
  platform: 'web',
  version: typeof __APP_VERSION__ === 'string' ? __APP_VERSION__ : 'dev',
});
addEventListener('pagehide', flushErrors);

export function report(kind: 'error' | 'rejection', error: unknown): void {
  reportError(kind, error, location.pathname.slice(0, 120));
}
