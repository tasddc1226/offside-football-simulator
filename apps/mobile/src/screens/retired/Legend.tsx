// T-10-005 은퇴 선수 상세(웹 Legend.svelte) — 명예의 전당 · 구단주의 내 선수에서 언제든 다시 들어온다.
import { useEffect, useRef, useState } from 'react';
import { View } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { useSnapshot } from 'valtio';
import type { LegendView } from '@offside/app-core/state';
import { appState, prefs } from '../../store';
import { alpha } from '../../theme/colors';
import { useColors, useIsDark } from '../../theme/useColors';
import { rem } from '../../theme/type';
import { AdSlot } from '../../components/AdSlot';
import { NameReport } from '../../components/NameReport';
import { BackBar } from '../../ui/ActionBar';
import { Press } from '../../ui/Press';
import { Topbar } from '../../ui/Topbar';
import { Txt } from '../../ui/Txt';
import { CreditScreen, useCredit } from './credit';
import { LegendReport } from './LegendReport';
import { OwnHofCards } from './OwnHofCards';
import { rollCredits } from './roll';
import { ShareBar } from './ShareBar';
import { retiredText as L } from '@offside/app-core/i18n/ko/retired';

export default function Legend() {
  const snap = useSnapshot(appState);
  const { motionOK } = useSnapshot(prefs);
  // 화면은 스냅숏으로 그린다 — 쓰기(이름 공개·대표 칭호)는 own.ts가 원본을 찾아 고친다.
  const v = snap.legend as unknown as LegendView | null;
  /** 이전 화면 기록이 없으면 연 곳(명예의 전당·구단주·홈)으로. */
  const backTo = () => (appState.screen = appState.legendBack);
  return (
    // T-10-128 위쪽 '이전으로' 대신 아래 바: 공유할 수 있는 내 선수는 이전으로 + 공유하기, 그 밖은 '← 이전으로' 하나.
    <CreditScreen
      footer={
        v?.shareId ? (
          <ShareBar id={v.shareId} back={backTo} />
        ) : (
          <BackBar testID="hof-back" fallback={backTo} />
        )
      }
      overlay={motionOK && v ? <CareerPlay /> : null}
    >
      <Topbar />
      {v ? (
        <>
          <LegendReport v={v} />
          {v.own?.id ? <OwnHofCards v={v} /> : null}
          {v.reportId ? <NameReport kind="career" id={v.reportId} name={v.name} /> : null}
          <AdSlot place="legend-bottom" />
        </>
      ) : null}
    </CreditScreen>
  );
}

/**
 * T-10-129 커리어 재생: 누르면 크레딧처럼 흘러가고, 다시 누르거나 화면을 만지면 멈춘다. 동작 줄이기면 버튼이 없다.
 * CreditScreen 안에 떠 있어 스크롤 계측기(useCredit)를 받는다.
 */
function CareerPlay() {
  const c = useColors();
  const dark = useIsDark();
  const ctl = useCredit();
  const [rolling, setRolling] = useState(false);
  const stopRoll = useRef<(() => void) | null>(null);
  useEffect(() => () => stopRoll.current?.(), []);
  function toggle() {
    if (stopRoll.current) return stopRoll.current();
    if (!ctl) return;
    setRolling(true);
    stopRoll.current = rollCredits(ctl, () => {
      setRolling(false);
      stopRoll.current = null;
    });
  }
  const fg = rolling ? c.ink : c.accentInk;
  return (
    <Press
      testID="career-play"
      accessibilityLabel={rolling ? L.stop : L.play}
      accessibilityState={{ selected: rolling }}
      onPress={toggle}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        minHeight: 40,
        paddingVertical: 8,
        paddingLeft: 12,
        paddingRight: 16,
        borderRadius: 999,
        borderWidth: 1,
        borderColor: rolling ? c.line : c.accent,
        backgroundColor: rolling ? alpha(c.bg, 0.88) : c.accent,
        shadowColor: '#000',
        shadowOpacity: dark ? 0.5 : 0.35,
        shadowRadius: 9,
        shadowOffset: { width: 0, height: 6 },
        elevation: 6,
      }}
    >
      <View>
        <Svg width={18} height={18} viewBox="0 0 24 24" fill={fg}>
          <Path d={rolling ? 'M8 6h3v12H8zM13 6h3v12h-3z' : 'M8 5.5v13l10.5-6.5z'} />
        </Svg>
      </View>
      <Txt style={{ fontSize: rem(0.875), fontWeight: '700', color: fg }}>
        {rolling ? L.stop : L.play}
      </Txt>
    </Press>
  );
}
