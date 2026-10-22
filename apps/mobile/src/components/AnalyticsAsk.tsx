// T-11-417 앱 이용 분석 동의를 처음 한 번 아래에서 올라오는 창으로 묻는다(웹 AnalyticsConsent.svelte). 전에는 설정의
// 스위치만 있어서 대부분 '선택 전'으로 남았다. 고르기 전에는 닫히지 않고, 고른 뒤에는 설정 스위치로만 바꾼다.
// 동의 전에는 아무것도 보내지 않는 것은 그대로다(analytics-native). 출석 · 컵 우승 창은 이 창이 떠 있는 동안 저절로 뜨지 않는다.
import { useSyncExternalStore } from 'react';
import { settingsText as L } from '@offside/app-core/i18n/ko/settings';
import { nativeAnalytics } from '../analytics';
import { openWeb } from '../platform/openWeb';
import { Btn, Row, Txt } from '../ui';
import { PopSheet } from '../ui/PopSheet';

/** 동의를 묻는 창이 떠 있어야 하는지(다른 창이 저절로 뜨기 전에 본다). */
export const analyticsAskPending = () =>
  nativeAnalytics.enabled() && nativeAnalytics.getConsent() === 'unknown';

export function AnalyticsAsk() {
  const consent = useSyncExternalStore(nativeAnalytics.onConsent, nativeAnalytics.getConsent);
  if (!nativeAnalytics.enabled() || consent !== 'unknown') return null;
  return (
    <PopSheet label={L.analyticsTitle} testID="analytics-ask">
      <Txt v="eyebrow">Privacy</Txt>
      <Txt v="h3" bold accessibilityRole="header">
        {L.analyticsTitle}
      </Txt>
      <Txt v="sm" tone="muted">
        {L.analyticsBody}
      </Txt>
      <Txt
        v="sm"
        tone="accent"
        accessibilityRole="link"
        onPress={() => openWeb('/legal/privacy/#analytics')}
      >
        {L.consentMore}
      </Txt>
      <Row style={{ gap: 8 }}>
        <Btn
          style={{ flex: 1 }}
          testID="analytics-ask-deny"
          onPress={() => nativeAnalytics.setConsent('denied')}
        >
          {L.consentDenied}
        </Btn>
        <Btn
          kind="accent"
          style={{ flex: 1 }}
          testID="analytics-ask-accept"
          onPress={() => nativeAnalytics.setConsent('granted')}
        >
          {L.consentAgree}
        </Btn>
      </Row>
    </PopSheet>
  );
}
