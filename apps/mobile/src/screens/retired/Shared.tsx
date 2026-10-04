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
  const cta = snap.G ? '내 커리어로 가기 →' : '나도 커리어 시작하기 →';

  return (
    <CreditScreen>
      <Topbar />
      {v === null ? (
        <Card>
          <Txt tone="muted" accessibilityLiveRegion="polite">
            기록을 불러오는 중…
          </Txt>
        </Card>
      ) : typeof v === 'string' ? (
        <Card>
          <View testID="shared-unavailable">
            <Txt v="eyebrow">Shared Career</Txt>
            <Txt v="h2" accessibilityRole="header">
              {v === 'missing' ? '기록을 찾을 수 없어요' : '기록을 불러오지 못했어요'}
            </Txt>
          </View>
          <Txt v="sm" tone="muted">
            {v === 'missing'
              ? '링크가 잘못되었거나 더 이상 공개되지 않는 기록이에요.'
              : '서버에 연결하지 못했어요. 잠시 후 다시 시도해 주세요.'}
          </Txt>
          {v === 'error' ? (
            <Btn block onPress={() => void load()}>
              다시 시도
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
            공유받은 은퇴 커리어 · 보기 전용
          </Txt>
          <LegendReport
            v={v}
            end={
              <Card>
                <View>
                  <Txt v="eyebrow">Your Turn</Txt>
                  <Txt v="h2" accessibilityRole="header">
                    이번엔 내 선수를 키울 차례예요
                  </Txt>
                </View>
                <Txt v="sm" tone="muted">
                  고3 킥오프부터 은퇴 휘슬까지, 내 선수의 커리어를 직접 정해요.
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
