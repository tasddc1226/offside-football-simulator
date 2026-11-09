// T-11-679 리그·대회 로고(웹 CompIcon.svelte · CompIconSheet.svelte). 유저가 고른 이미지가 있으면 그 이미지, 없으면 기본 엠블럼
// (app-core compEmblem.ts, 웹과 공용)을 react-native-svg로 그린다. 누르면 그 자리에서 로고 시트가 떠 이미지를 고른다.
// still이면 누를 수 없는 그림만 그린다.
import { useState } from 'react';
import { View } from 'react-native';
import { Image } from 'expo-image';
import Svg, { Path, Text as SvgText } from 'react-native-svg';
import { useSnapshot } from 'valtio';
import { COMP_EMBLEM_VIEWBOX, compEmblem } from '@offside/app-core/compEmblem';
import { compIconsText as T } from '@offside/app-core/i18n/ko/compIcons';
import { tn } from '@offside/game/i18n/names';
import { compIcons, customNames } from '../store';
import { dismissCompIconHint, setCompIcon, toast } from '../game/host';
import { pickCompIcon } from '../screens/settings/compIconImage';
import { Btn } from './Btn';
import { PopSheet } from './PopSheet';
import { Press } from './Press';
import { Txt } from './Txt';

function Face({ ko, size }: { ko: string; size: number }) {
  const { map } = useSnapshot(compIcons);
  // 바꾼 이름에서 약칭을 따므로 이름표가 바뀌면 다시 그린다.
  useSnapshot(customNames);
  const img = map[ko];
  if (img)
    return (
      <Image
        source={{ uri: img }}
        style={{ width: size, height: size }}
        contentFit="contain"
        accessibilityIgnoresInvertColors
      />
    );
  const art = compEmblem(ko);
  return (
    <Svg
      width={size}
      height={size}
      viewBox={COMP_EMBLEM_VIEWBOX}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      {art.layers.map((l, i) => (
        <Path key={i} d={l.d} fill={l.fill} />
      ))}
      <SvgText
        x={32}
        y={art.mark.y}
        textAnchor="middle"
        fontSize={art.mark.size}
        fontWeight="800"
        fill={art.mark.fill}
        letterSpacing={-0.5}
      >
        {art.mark.text}
      </SvgText>
    </Svg>
  );
}

const FAIL = { big: () => T.big, full: () => T.full, space: () => T.noSpace } as const;

export function CompIconSheet({ ko, onClose }: { ko: string; onClose: () => void }) {
  const { map } = useSnapshot(compIcons);
  const name = tn(ko);
  const pick = async () => {
    let r: Awaited<ReturnType<typeof pickCompIcon>>;
    try {
      r = await pickCompIcon();
    } catch {
      return toast(T.readFail);
    }
    if (r.kind !== 'ok') {
      if (r.kind !== 'canceled') toast(r.kind === 'tooLarge' ? T.tooLarge : T.big);
      return;
    }
    const saved = setCompIcon(ko, r.img);
    toast(saved === true ? T.saved : FAIL[saved]());
  };
  const restore = () => {
    const r = setCompIcon(ko, null);
    toast(r === true ? T.restored : FAIL[r]());
  };
  return (
    <PopSheet label={T.sheetTitle({ name })} testID="comp-icon-sheet" onClose={onClose}>
      <View style={{ gap: 12 }}>
        <View style={{ alignItems: 'center', gap: 10 }}>
          <Face ko={ko} size={88} />
          <Txt v="h3" bold accessibilityRole="header" style={{ textAlign: 'center' }}>
            {T.sheetTitle({ name })}
          </Txt>
        </View>
        <Txt v="sm" tone="muted">
          {T.intro}
        </Txt>
        <Btn kind="primary" block testID="comp-icon-pick" onPress={() => void pick()}>
          {T.pick}
        </Btn>
        {map[ko] ? (
          <Btn block testID="comp-icon-reset" onPress={restore}>
            {T.reset}
          </Btn>
        ) : null}
        <Btn block onPress={onClose}>
          {T.close}
        </Btn>
        <Txt v="xs" tone="muted">
          {T.where}
        </Txt>
      </View>
    </PopSheet>
  );
}

export function CompIcon({ ko, size = 24, still }: { ko: string; size?: number; still?: boolean }) {
  const [open, setOpen] = useState(false);
  if (still) return <Face ko={ko} size={size} />;
  return (
    <>
      <Press
        testID={`comp-icon-${ko}`}
        accessibilityRole="button"
        accessibilityLabel={T.logoLabel({ name: tn(ko) })}
        hitSlop={8}
        onPress={() => {
          dismissCompIconHint();
          setOpen(true);
        }}
      >
        <Face ko={ko} size={size} />
      </Press>
      {open ? <CompIconSheet ko={ko} onClose={() => setOpen(false)} /> : null}
    </>
  );
}
