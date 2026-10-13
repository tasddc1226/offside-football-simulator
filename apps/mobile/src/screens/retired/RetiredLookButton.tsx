import { lazy, Suspense, useState } from 'react';
import type { LegendView } from '@offside/app-core/state';
import { avatarLookText as L } from '@offside/app-core/i18n/ko/avatarLook';
import { Btn } from '../../ui';

const Editor = lazy(() => import('./RetiredLook'));
export function RetiredLookButton({ v }: { v: LegendView }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Btn sm testID="retired-look" onPress={() => setOpen(true)}>
        {L.chip}
      </Btn>
      {open ? (
        <Suspense fallback={null}>
          <Editor v={v} close={() => setOpen(false)} />
        </Suspense>
      ) : null}
    </>
  );
}
