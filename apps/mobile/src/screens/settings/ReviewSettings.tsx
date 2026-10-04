import { useState } from 'react';
import { openReviewStore } from '../../platform/review';
import { Btn, Txt } from '../../ui';
import { SettingsCard, SettingsLabel } from './parts';

export function ReviewSettings() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  return (
    <SettingsCard gap={12}>
      <SettingsLabel
        eyebrow="Feedback"
        title="스토어 리뷰"
        muted="플레이하면서 느낀 점을 스토어에 남겨 주세요."
      />
      <Btn
        block
        disabled={busy}
        testID="store-review"
        onPress={() => {
          setBusy(true);
          setError('');
          void openReviewStore()
            .catch(() => setError('스토어를 열지 못했어요. 잠시 뒤 다시 시도해 주세요.'))
            .finally(() => setBusy(false));
        }}
      >
        {busy ? '스토어 여는 중…' : '스토어에 리뷰 남기기'}
      </Btn>
      {error ? (
        <Txt tone="muted" accessibilityLiveRegion="polite">
          {error}
        </Txt>
      ) : null}
    </SettingsCard>
  );
}
