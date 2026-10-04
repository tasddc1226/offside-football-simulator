// 커리어 재생(웹 creditRoll.ts rollCredits, T-10-129): ScrollView를 일정한 속도로 내린다. 속도·끝 위치 계산은 웹과 한 벌인
// @offside/app-core/creditRoll — 여기는 requestAnimationFrame 루프와 '손이 닿으면 멈춤'만 앱 방식으로 한다.
// 장면이 화면에 들어올 때 올라오므로(credit.tsx Reveal) 끊어서 끌어오지 않고 계속 흘려야 글·그림이 스크롤과 함께 뜬다.
import { AppState } from 'react-native';
import { rollEnd, rollSpeed } from '@offside/app-core/creditRoll';
import { scrollTo, scrollY } from '../../ui/scroll';
import type { CreditCtl } from './credit';

/** 재생을 시작하고 멈추는 함수를 돌려준다. 끝까지 가거나 사용자가 손대거나 stop을 부르면 onStop이 한 번 불린다. */
export function rollCredits(ctl: CreditCtl, onStop: () => void): () => void {
  let done = false;
  let raf = 0;
  let y = scrollY();
  let end = 0;

  const measure = async () => {
    const f = await ctl.rectOf('finale');
    end = rollEnd(f, ctl.viewH(), Math.max(0, ctl.contentH() - ctl.viewH()));
  };

  const stop = () => {
    if (done) return;
    done = true;
    cancelAnimationFrame(raf);
    offTouch();
    app.remove();
    onStop();
  };
  // 화면에 손이 닿으면(터치·끌기) 그 자리에서 멈춘다. 재생 버튼은 ScrollView 밖이라 따로 처리한다.
  const offTouch = ctl.onTouch(stop);
  const app = AppState.addEventListener('change', (s) => s !== 'active' && stop());

  void (async () => {
    await measure();
    if (done) return;
    // 이미 끝 가까이면 처음부터.
    if (end - y < 40) {
      y = 0;
      scrollTo(0);
    }
    const t0 = performance.now();
    let last = t0;
    let measuredAt = t0;
    // 끝 위치는 장면이 늦게 붙어(LateCredits) 바뀔 수 있어 가끔만 다시 잰다 — 매 프레임 재면 렌더를 막는다.
    const frame = (now: number) => {
      const dt = Math.min(64, now - last) / 1000;
      last = now;
      if (now - measuredAt > 250) {
        measuredAt = now;
        void measure();
      }
      y = Math.min(end, y + rollSpeed(now - t0, end - y) * dt);
      scrollTo(y);
      if (y >= end - 0.5) return stop();
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
  })();
  return stop;
}
