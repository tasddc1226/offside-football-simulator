// SCR-014 결과 카드: appliedEffects를 "전술 적합도 +6(다음 시즌 1단계부터)"처럼 라벨·부호·적용
// 시점으로 요약한다. rev로 다시 연 결과 화면도 팩의 outcome.effects(정의)만으로 같은 문장을
// 재구성할 수 있도록, roll 결과가 아니라 Effect 정의 자체만 입력으로 받는 순수 함수다.
import type { Effect } from '@offside/domain';
import { EFFECT_TARGET_LABEL_KO } from './labels.js';

function formatTiming(effect: Effect): string | null {
  if (effect.appliesAt.kind === 'NEXT_SEASON_STEP') {
    return `다음 시즌 ${effect.appliesAt.step}단계부터`;
  }
  if (effect.expiresAt !== null && effect.expiresAt.kind === 'STEPS_AFTER') {
    return `${effect.expiresAt.steps}스텝 동안`;
  }
  return null;
}

export function formatEffectSummary(effect: Effect): string {
  const label = (EFFECT_TARGET_LABEL_KO as Record<string, string>)[effect.target] ?? effect.target;
  const sign = effect.delta > 0 ? '+' : '';
  const timing = formatTiming(effect);
  const magnitude = `${sign}${effect.delta}`;
  return timing === null ? `${label} ${magnitude}` : `${label} ${magnitude}(${timing})`;
}
