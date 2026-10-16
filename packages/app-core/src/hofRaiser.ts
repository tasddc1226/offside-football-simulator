// T-11-297 명예의 전당 선수를 키운 구단주 표시(웹 HofRow·LegendReport, 앱 HofRow·LegendReport 공용).
import type { HofRaiser } from '@offside/contracts';

/** 줄에 적을 이름 — 공개 닉네임, 없으면 가장 최근 팀 이름. 둘 다 없으면 null(칸을 그리지 않는다). */
export function raiserLabel(r: HofRaiser | null | undefined): string | null {
  if (!r) return null;
  return r.nickname ?? r.teamName ?? null;
}
