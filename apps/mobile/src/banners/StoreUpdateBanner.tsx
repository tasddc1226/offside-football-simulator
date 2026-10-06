// T-11-042 스토어 업데이트 안내. 서버가 알려 준 최소 버전보다 이 앱이 낮으면(새 시즌 빌드가 나왔다) 화면 위에 띄운다.
// 닫으면 이번 실행 동안만 숨긴다 — 다음에 켜면 다시 보인다.
import { openStore } from '../platform/storeUpdate';
import { storeUpdate } from '../store';
import { Btn } from '../ui';
import { BannerClose, BannerText, TopBanner } from './TopBanner';
import { useFly } from './useFly';
import { useTopBanner } from './useTopBanner';
import { shellMoreText } from '@offside/app-core/i18n/ko/shellMore';

export function StoreUpdateBanner() {
  const { mounted, style } = useFly(useTopBanner() === 'store', 200);
  if (!mounted) return null;
  return (
    <TopBanner testID="store-update-banner" label={shellMoreText.storeUpdateAlert} style={style}>
      <BannerText title={shellMoreText.storeUpdateTitle} body={shellMoreText.storeUpdateBody} />
      <Btn kind="accent" sm testID="store-update-open" onPress={openStore}>
        {shellMoreText.storeUpdateBtn}
      </Btn>
      <BannerClose testID="store-update-close" onPress={() => (storeUpdate.closed = true)} />
    </TopBanner>
  );
}
