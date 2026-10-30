// T-11-437 커리어를 시작하면 게임 화면에 한 번, 기록이 이 기기에만 있다는 것과 백업 코드 자리를 알린다(웹 SaveHint.svelte).
// 첫 시즌에만 뜨고, 닫으면 이 기기에서 다시 뜨지 않는다(app-core firstGuide 'save').
import { useState } from 'react';
import { View } from 'react-native';
import { closeGuide, saveHintOpen } from '@offside/app-core/firstGuide';
import { firstGuideText as L } from '@offside/app-core/i18n/ko/firstGuide';
import { goBackup } from '../../game/nav';
import { alpha } from '../../theme/colors';
import { useColors } from '../../theme/useColors';
import { Btn, Card, Txt } from '../../ui';

export function SaveHint({ pastSeasons }: { pastSeasons: number }) {
  const c = useColors();
  const [open, setOpen] = useState(() => saveHintOpen(pastSeasons));
  if (!open) return null;
  const close = () => {
    closeGuide('save');
    setOpen(false);
  };
  return (
    <Card
      testID="save-hint"
      gap={12}
      style={{ flexDirection: 'row', borderWidth: 1, borderColor: alpha(c.accent, 0.45) }}
    >
      <View style={{ flex: 1, minWidth: 0, gap: 6, alignItems: 'flex-start' }}>
        <Txt bold>{L.saveTitleApp}</Txt>
        <Txt v="sm" tone="muted">
          {L.saveBodyApp}
        </Txt>
        <Btn
          sm
          testID="save-hint-backup"
          onPress={() => {
            closeGuide('save');
            goBackup();
          }}
        >
          {L.saveGo}
        </Btn>
      </View>
      <View>
        <Btn
          sm
          kind="ghost"
          testID="save-hint-close"
          accessibilityLabel={L.saveCloseAria}
          onPress={close}
        >
          {L.close}
        </Btn>
      </View>
    </Card>
  );
}
