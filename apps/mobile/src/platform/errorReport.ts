// T-11-331 앱의 잡히지 않은 오류를 서버로 모은다(운영 빌드만). 기본 처리(빨간 화면 · 앱 종료)는 그대로 두고 앞에서
// 보고만 한다. 앱이 멈추는 오류(isFatal)는 저장소에 적어 두었다가 다음 실행에 보낸다(@offside/app-core/errorReport).
import { Platform } from 'react-native';
import { configureErrorReport, reportError } from '@offside/app-core/errorReport';
import { appBuildInfo } from './updates';

type Handler = (error: unknown, isFatal?: boolean) => void;
type RnGlobal = {
  ErrorUtils?: { getGlobalHandler(): Handler; setGlobalHandler(h: Handler): void };
  HermesInternal?: {
    enablePromiseRejectionTracker?(o: {
      allRejections: boolean;
      onUnhandled(id: number, rejection: unknown): void;
    }): void;
  };
};

export function installErrorReport(): void {
  if (__DEV__ || (Platform.OS !== 'ios' && Platform.OS !== 'android')) return;
  const b = appBuildInfo();
  configureErrorReport({
    platform: Platform.OS,
    version: `${b.version} (${b.build})${b.updateId ? ` · ${b.updateId}` : ''}`,
  });
  const g = globalThis as RnGlobal;
  const prev = g.ErrorUtils?.getGlobalHandler();
  g.ErrorUtils?.setGlobalHandler((error, isFatal) => {
    try {
      reportError(isFatal ? 'fatal' : 'error', error);
    } catch {
      // 보고 실패가 원래 처리를 막지 않게.
    }
    prev?.(error, isFatal);
  });
  // 운영 빌드에서 RN은 처리 안 된 Promise 거절을 추적하지 않는다(개발 모드 LogBox만). Hermes 추적기를 켠다.
  g.HermesInternal?.enablePromiseRejectionTracker?.({
    allRejections: true,
    onUnhandled: (_id, rejection) => reportError('rejection', rejection),
  });
}
