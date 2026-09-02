// SCR-002·003·004 공통 진입 가드 훅. 렌더 초기에 guardCareerStep을 평가해 필요하면 즉시
// navigate(replace)하고, 그동안(또는 리다이렉트 확정 전까지) 호출자가 본문 렌더를 보류할 수 있도록
// blocked를 돌려준다.
import { useEffect } from 'react';
import type { CareerState } from '@offside/domain';
import { useNavigate } from '@tanstack/react-router';
import { SCREEN_ROUTES } from '../routes.js';
import { guardCareerStep, type PlayerCreationScreenId } from './career-route.js';

export function useCareerStepGuard(
  state: CareerState | undefined,
  expected: PlayerCreationScreenId,
  options?: { recoveryStepActive?: boolean },
): boolean {
  const navigate = useNavigate();
  const recoveryStepActive = options?.recoveryStepActive ?? false;

  useEffect(() => {
    if (state === undefined) return;
    const result = guardCareerStep(state, expected, { recoveryStepActive });
    if (!result.allowed) {
      void navigate({ to: SCREEN_ROUTES[result.target.screenId], params: result.target.params, replace: true });
    }
  }, [state, expected, recoveryStepActive, navigate]);

  if (state === undefined) return true;
  return !guardCareerStep(state, expected, { recoveryStepActive }).allowed;
}
