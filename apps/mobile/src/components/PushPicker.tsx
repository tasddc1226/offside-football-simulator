// 받고 싶은 알림 고르기. 알림 권유에서 "받기"를 누르면 OS 권한 창보다 먼저 뜬다(platform/pushAsk).
// 묶음 다섯 개만 고르고, 주제별 선택은 설정 화면에서 한다. 닫으면 고르지 않은 것으로 본다.
import { useEffect, useState } from 'react';
import { View } from 'react-native';
import { useSnapshot } from 'valtio';
import {
  DEFAULT_PUSH_PICKS,
  pickerGroups,
  type PushGroup,
  type PushPicks,
} from '@offside/app-core/pushTopics';
import { pushText as L } from '@offside/app-core/i18n/ko/push';
import { closePushPicker, pushPicker } from '../platform/pushAsk';
import { Btn, Txt } from '../ui';
import { PopSheet } from '../ui/PopSheet';
import { Switch } from '../screens/settings/parts';

const copy = (): Record<PushGroup, [string, string]> => ({
  game: [L.grpGame, L.grpGameBody],
  market: [L.catMarket, L.grpMarketBody],
  social: [L.grpSocial, L.grpSocialBody],
  news: [L.grpNews, L.grpNewsBody],
  nudge: [L.grpNudge, L.grpNudgeBody],
});

export function PushPicker() {
  const s = useSnapshot(pushPicker);
  const [picks, setPicks] = useState<PushPicks>({ ...DEFAULT_PUSH_PICKS });
  useEffect(() => {
    if (s.open) setPicks({ ...DEFAULT_PUSH_PICKS });
  }, [s.open]);
  if (!s.open) return null;
  const any = Object.values(picks).some(Boolean);
  const text = copy();
  return (
    <PopSheet label={s.title} testID="push-picker" onClose={() => closePushPicker(null)}>
      <View style={{ gap: 6 }}>
        <Txt v="h2" accessibilityRole="header">
          {s.title}
        </Txt>
        {s.body ? <Txt tone="muted">{s.body}</Txt> : null}
        {s.body ? (
          <Txt bold style={{ paddingTop: 8 }}>
            {L.pickTitle}
          </Txt>
        ) : null}
      </View>
      <View>
        {pickerGroups(s.place).map((group) => (
          <View
            key={group}
            style={{ flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 56 }}
          >
            <View style={{ flex: 1, gap: 2 }}>
              <Txt bold>{text[group][0]}</Txt>
              <Txt tone="muted" v="sm">
                {text[group][1]}
              </Txt>
            </View>
            <Switch
              value={picks[group]}
              label={L.catAria({ title: text[group][0] })}
              testID={`push-picker-${group}`}
              onChange={(on) => setPicks((p) => ({ ...p, [group]: on }))}
            />
          </View>
        ))}
      </View>
      <Txt tone="muted" v="sm" accessibilityLiveRegion="polite">
        {any ? L.pickNote : L.pickNone}
      </Txt>
      <View style={{ gap: 8 }}>
        <Btn
          kind="primary"
          block
          disabled={!any}
          testID="push-picker-on"
          onPress={() => closePushPicker(picks)}
        >
          {L.askOn}
        </Btn>
        <Btn kind="ghost" block testID="push-picker-later" onPress={() => closePushPicker(null)}>
          {L.askLater}
        </Btn>
      </View>
    </PopSheet>
  );
}
