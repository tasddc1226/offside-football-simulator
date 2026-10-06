import { useState } from 'react';
import { openReviewStore } from '../../platform/review';
import { Btn, Txt } from '../../ui';
import { SettingsCard, SettingsLabel } from './parts';
import { settingsText as L } from '@offside/app-core/i18n/ko/settings';

export function ReviewSettings() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  return (
    <SettingsCard gap={12}>
      <SettingsLabel eyebrow="Feedback" title={L.reviewTitle} muted={L.reviewBody} />
      <Btn
        block
        disabled={busy}
        testID="store-review"
        onPress={() => {
          setBusy(true);
          setError('');
          void openReviewStore()
            .catch(() => setError(L.reviewFail))
            .finally(() => setBusy(false));
        }}
      >
        {busy ? L.reviewOpening : L.reviewBtn}
      </Btn>
      {error ? (
        <Txt tone="muted" accessibilityLiveRegion="polite">
          {error}
        </Txt>
      ) : null}
    </SettingsCard>
  );
}
