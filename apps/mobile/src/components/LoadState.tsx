// 목록 화면의 불러오는 중(뼈대, T-11-389) / 실패 + 다시 시도 / 내용(웹 LoadState.svelte). rows: 뼈대 줄 수. skeleton: 화면 모양 뼈대(T-11-392, 팀 · 컵).
import type { ReactNode } from 'react';
import { Btn } from '../ui/Btn';
import { Stack } from '../ui/bits';
import { Skeleton } from '../ui/Skeleton';
import { Txt } from '../ui/Txt';
import { shellMoreText } from '@offside/app-core/i18n/ko/shellMore';

export type LoadStatus = 'loading' | 'ready' | 'error';

export function LoadState({
  status,
  failText,
  retry,
  rows = 3,
  skeleton,
  children,
}: {
  status: LoadStatus;
  failText: string;
  retry: () => void;
  rows?: number;
  skeleton?: ReactNode;
  children: ReactNode;
}) {
  if (status === 'loading') return skeleton ?? <Skeleton rows={rows} />;
  if (status === 'error')
    return (
      <Stack gap={8}>
        <Txt tone="muted">{failText}</Txt>
        <Btn sm onPress={retry} style={{ alignSelf: 'flex-start' }}>
          {shellMoreText.retry}
        </Btn>
      </Stack>
    );
  return <>{children}</>;
}
