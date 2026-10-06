// T-11-108: 은퇴 결산·다음 행동 버튼 아래가 화면에 들어온 뒤에만 광고를 요청한다.
import { useEffect, useRef, useState } from 'react';
import { View } from 'react-native';
import { AdSlot } from '../../components/AdSlot';
import { useCredit } from './credit';

export function RetiredAdSlot() {
  const ctl = useCredit();
  const ref = useRef<View>(null);
  const [seen, setSeen] = useState(false);
  useEffect(() => {
    if (seen || !ctl) return;
    const stop = ctl.watch({ ref, fire: () => setSeen(true) });
    ctl.check();
    return stop;
  }, [seen, ctl]);
  return (
    <View
      ref={ref}
      collapsable={false}
      // 광고가 꺼져 있어도 화면 도달 여부를 잴 수 있는 1px 기준점만 남긴다.
      style={{ minHeight: 1 }}
      onLayout={() => ctl?.check()}
    >
      {seen ? <AdSlot place="retired-bottom" /> : null}
    </View>
  );
}
