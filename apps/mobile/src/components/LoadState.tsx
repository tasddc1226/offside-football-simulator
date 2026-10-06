// 목록 화면의 불러오는 중 / 실패 + 다시 시도 / 내용(웹 LoadState.svelte).
import type { ReactNode } from 'react';
import { Btn } from '../ui/Btn';
import { Stack } from '../ui/bits';
import { Txt } from '../ui/Txt';
import { shellText as L } from '@offside/app-core/i18n/ko/shell';
import { shellMoreText } from '@offside/app-core/i18n/ko/shellMore';

export type LoadStatus = 'loading' | 'ready' | 'error';

export function LoadState({
  status,
  failText,
  retry,
  children,
}: {
  status: LoadStatus;
  failText: string;
  retry: () => void;
  children: ReactNode;
}) {
  if (status === 'loading')
    return (
      <Txt tone="muted" accessibilityLiveRegion="polite">
        {L.loading}
      </Txt>
    );
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
