import { CUPS, type CupDef } from '@offside/contracts/cup';
import type { Bindings } from '../env.js';

// T-11-145 대회 일정. 운영은 늘 contracts의 CUPS 상수다. 로컬·스테이징에서만 CUP_SCHEDULE(CupDef[] JSON)로 바꿔
// 진행 중 화면을 확인하거나 몇 분 간격으로 압축한 리허설을 돌린다. 배포 하나 안에서는 값이 같아 모듈에 담아 둔다.
let raw: string | undefined;
let active: readonly CupDef[] = CUPS;

export function loadCupSchedule(env: Pick<Bindings, 'ENVIRONMENT' | 'CUP_SCHEDULE'>) {
  const next = env.ENVIRONMENT === 'production' ? undefined : env.CUP_SCHEDULE || undefined;
  if (next === raw) return;
  raw = next;
  active = next ? (JSON.parse(next) as CupDef[]) : CUPS;
}

export const cupSchedule = () => active;
