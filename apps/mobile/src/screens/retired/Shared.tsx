// T-10-029 공유 링크(/career/<id>)로 들어온 보기 전용 은퇴 리포트(웹 SharedCareer.svelte). 크레딧 연출로 보여 주고, 끝나면
// 내 커리어를 시작하도록 권한다. 이름 공개·공유 같은 선수 주인 기능은 없다.
// T-11-439 시작 버튼을 맨 위에도 작게 두고(B8), 공개된 이름은 맨 아래에서 신고할 수 있다(스토어 UGC 정책). 신고는 누를 때만
// 프로필을 만들어 보낸다 — 화면을 여는 것만으로는 세션·프로필을 조회하지 않는다.
import { FONT } from '@offside/app-core/design-tokens';
import { useEffect, useState } from 'react';
import { View } from 'react-native';
import { useSnapshot } from 'valtio';
import type { LegendView } from '@offside/app-core/state';
import { NameReport, NameReports } from '../../components/NameReport';
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
import { Skeleton } from '../../ui/Skeleton';

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
          <Skeleton rows={4} />
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
              fontSize: rem(FONT.caption),
              fontWeight: '700',
              letterSpacing: rem(0.75) * 0.02,
            }}
          >
            {L.viewNote}
          </Txt>
          <View style={{ alignItems: 'center', marginBottom: 12 }}>
            <Btn sm kind="primary" testID="shared-start-top" onPress={leave}>
              {cta}
            </Btn>
          </View>
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
          {v.reportId ? (
            <NameReports>
              <NameReport kind="career" id={v.reportId} name={v.name} />
            </NameReports>
          ) : null}
        </>
      )}
    </CreditScreen>
  );
}
