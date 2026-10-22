// T-11-453 AdMob 광고 검사기 — 미디에이션 어댑터(Meta · Pangle · Liftoff)가 초기화됐는지, 그룹 입찰이 돌아오는지 기기에서 본다.
// 검사기는 테스트 기기(platform/adConsent.ts TEST_DEVICES)에서만 열린다. 앱 전용(웹에는 없다).
import { View } from 'react-native';
import mobileAds from 'react-native-google-mobile-ads';
import { toast } from '../../../game/host';
import { Btn } from '../../../ui/Btn';
import { Txt } from '../../../ui/Txt';

export default function AdminAdInspector() {
  async function open() {
    try {
      await mobileAds().openAdInspector();
    } catch (e) {
      toast(
        `광고 검사기를 열지 못했어요. 테스트 기기인지 확인해 주세요. (${String(e).slice(0, 80)})`,
      );
    }
  }
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
      <Txt v="h2" accessibilityRole="header">
        광고 미디에이션
      </Txt>
      <Btn sm testID="admin-ad-inspector" onPress={() => void open()}>
        광고 검사기
      </Btn>
    </View>
  );
}
