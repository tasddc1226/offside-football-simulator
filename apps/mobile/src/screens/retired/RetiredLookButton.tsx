// T-11-439 남은 횟수를 버튼에 쓰고, 이번 접속에서 이미 확인한 잠김(사용함 · 이적시장 거래)이면 누를 수 없게 한다(웹
// RetiredLookButton.svelte). 잠김은 편집기가 열 때 받은 정책을 기억해 둔 값이라 버튼만을 위해 서버를 부르지 않는다.
import { lazy, Suspense, useState } from 'react';
import type { LegendView } from '@offside/app-core/state';
import { lookButtonLabel, retiredLookLockOf } from '@offside/app-core/retiredLookLock';
import { Btn } from '../../ui';

const Editor = lazy(() => import('./RetiredLook'));
export function RetiredLookButton({ v }: { v: LegendView }) {
  const [open, setOpen] = useState(false);
  // 편집기를 닫을 때 다시 읽는다(닫힘이 곧 다시 그리기다).
  const lock = open ? undefined : retiredLookLockOf(v);
  return (
    <>
      <Btn sm testID="retired-look" disabled={!!lock} onPress={() => setOpen(true)}>
        {lookButtonLabel(lock)}
      </Btn>
      {open ? (
        <Suspense fallback={null}>
          <Editor v={v} close={() => setOpen(false)} />
        </Suspense>
      ) : null}
    </>
  );
}
