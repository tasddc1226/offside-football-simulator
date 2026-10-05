// 은퇴 직후 화면(웹 Retired.svelte, ui.ts renderRetired() 포트). 리포트 본문은 LegendReport.
import { useMemo } from 'react';
import { useSnapshot } from 'valtio';
import { viewFromGame } from '../../game/host';
import { goHome, goNew } from '../../game/nav';
import { appState } from '../../store';
import { Btn } from '../../ui/Btn';
import { Topbar } from '../../ui/Topbar';
import { CreditScreen } from './credit';
import { LegendReport } from './LegendReport';
import { OwnHofCards } from './OwnHofCards';
import { ShareBar } from './ShareBar';
import { retiredText as L } from '@offside/app-core/i18n/ko/retired';

export default function Retired() {
  const snap = useSnapshot(appState);
  const hasG = !!snap.G;
  // 스냅숏(snap.G)이 바뀔 때만 다시 만든다 — viewFromGame은 원본 세이브를 읽는다.
  const v = useMemo(() => (hasG ? viewFromGame(appState.G!) : null), [snap.G]);
  if (!v) return null;
  return (
    <CreditScreen footer={v.shareId ? <ShareBar id={v.shareId} /> : null}>
      <Topbar />
      {/* T-10-029: 명예의 전당 공개·다음 버튼은 크레딧 맨 아래에, 공유 버튼은 화면 아래에 고정된다(T-10-067). */}
      <LegendReport
        v={v}
        end={
          <>
            {v.own?.id ? <OwnHofCards v={v} /> : null}
            <Btn kind="primary" block testID="new" onPress={goNew}>
              {L.newCareer}
            </Btn>
            <Btn block testID="home" onPress={goHome}>
              {L.seeHof}
            </Btn>
          </>
        }
      />
    </CreditScreen>
  );
}
