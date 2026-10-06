// T-10-029 공유 링크(/career/<id>)로 들어온 보기 전용 은퇴 리포트(웹 SharedCareer.svelte). 크레딧 연출로 보여 주고, 끝나면
// 내 커리어를 시작하도록 권한다. 이름 공개·공유 같은 선수 주인 기능은 없다.
import { useEffect, useState } from 'react';
import { View } from 'react-native';
import { useSnapshot } from 'valtio';
import type { LegendView } from '@offside/app-core/state';
import { loadSharedLegend } from '../../game/host';
import { goHome } from '../../game/nav';
import { appState } from '../../store';
import { rem } from '../../theme/type';
import { Btn } from '../../ui/Btn';
import { Card } from '../../ui/Card';
import { scrollTo } from '../../ui/scroll';
import { Topbar } from '../../ui/Topbar';
import { Txt } from '../../ui/Txt';
import { CreditScreen } from './credit';
import { LegendReport } from './LegendReport';
import { shareText as L } from '@offside/app-core/i18n/ko/share';

export default function Shared() {
  const snap = useSnapshot(appState);
  const [v, setV] = useState<LegendView | 'missing' | 'error' | null>(null);

  async function load() {
    setV(null);
    setV(await loadSharedLegend(appState.sharedCareer!));
  }
  useEffect(() => {
    void load();
  }, []);

  function leave() {
    // 웹은 주소창을 '/'로 되돌린다 — 앱은 주소가 없으니 공유 링크 상태만 비운다.
    appState.sharedCareer = null;
    goHome();
    scrollTo(0);
  }
  const cta = snap.G ? L.ctaGame : L.ctaNew;

  return (
    <CreditScreen>
      <Topbar />
      {v === null ? (
        <Card>
          <Txt tone="muted" accessibilityLiveRegion="polite">
            {L.loading}
          </Txt>
        </Card>
      ) : typeof v === 'string' ? (
        <Card>
          <View testID="shared-unavailable">
            <Txt v="eyebrow">Shared Career</Txt>
            <Txt v="h2" accessibilityRole="header">
              {v === 'missing' ? L.missingTitle : L.errorTitle}
            </Txt>
          </View>
          <Txt v="sm" tone="muted">
            {v === 'missing' ? L.missingBody : L.errorBody}
          </Txt>
          {v === 'error' ? (
            <Btn block onPress={() => void load()}>
              {L.retry}
            </Btn>
          ) : null}
          <Btn kind="primary" block testID="shared-start" onPress={leave}>
            {cta}
          </Btn>
        </Card>
      ) : (
        <>
          <Txt
            tone="muted"
            center
            testID="shared-view"
            style={{
              marginBottom: 10,
              fontSize: rem(0.75),
              fontWeight: '700',
              letterSpacing: rem(0.75) * 0.02,
            }}
          >
            {L.viewNote}
          </Txt>
          <LegendReport
            v={v}
            end={
              <Card>
                <View>
                  <Txt v="eyebrow">Your Turn</Txt>
                  <Txt v="h2" accessibilityRole="header">
                    {L.turnTitle}
                  </Txt>
                </View>
                <Txt v="sm" tone="muted">
                  {L.turnBodyApp}
                </Txt>
                <Btn kind="primary" block testID="shared-start" onPress={leave}>
                  {cta}
                </Btn>
              </Card>
            }
          />
        </>
      )}
    </CreditScreen>
  );
}
