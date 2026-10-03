import { useEffect, useRef, useState } from 'react';
import { View } from 'react-native';
import { Image } from 'expo-image';
import * as Sharing from 'expo-sharing';
import { captureRef, releaseCapture } from 'react-native-view-shot';
import type { FormationId, TeamLayout } from '@offside/contracts/owner-team';
import type { TeamLogo as Logo } from '@offside/contracts/team-logo';
import { TeamDialog } from '../../components/TeamDialog';
import { TeamLogo } from '../../components/TeamLogo';
import { TeamPitch, type PitchCell } from '../../components/TeamPitch';
import { toast } from '../../game/host';
import { Btn, Txt } from '../../ui';
export type TeamShareData = {
  name: string;
  manager: string;
  logo: Logo | null;
  formation: FormationId;
  layout: TeamLayout;
  cells: PitchCell[];
  ovr: number;
  draft: boolean;
  season: string;
};
export function TeamShare({ data, close }: { data: TeamShareData; close: () => void }) {
  const ref = useRef<View>(null);
  const mounted = useRef(true);
  const uriRef = useRef<string | null>(null);
  const [shot, setShot] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState('');
  useEffect(
    () => () => {
      mounted.current = false;
      if (uriRef.current) releaseCapture(uriRef.current);
    },
    [],
  );
  async function make() {
    if (!ready || busy) return;
    setBusy(true);
    setError('');
    try {
      await new Promise<void>((resolve) =>
        requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
      );
      const uri = await captureRef(ref, {
        format: 'png',
        result: 'tmpfile',
        width: 1080,
        height: 1350,
      });
      if (!mounted.current) {
        releaseCapture(uri);
        return;
      }
      if (uriRef.current) releaseCapture(uriRef.current);
      uriRef.current = uri;
      setShot(uri);
    } catch {
      if (mounted.current) setError('이미지를 만들지 못했어요. 다시 눌러 주세요.');
    } finally {
      if (mounted.current) setBusy(false);
    }
  }
  async function share(title: string) {
    if (!shot) return;
    try {
      if (!(await Sharing.isAvailableAsync()))
        return toast('이 기기에서는 이미지를 공유할 수 없어요.');
      await Sharing.shareAsync(shot, {
        mimeType: 'image/png',
        UTI: 'public.png',
        dialogTitle: title,
      });
    } catch {
      toast('공유 창을 열지 못했어요. 다시 눌러 주세요.');
    }
  }
  return (
    <TeamDialog title="SNS 공유 이미지" close={close}>
      <Txt v="sm" tone="muted">
        지금 보고 있는 편성을 한 장에 담아요.
        {data.draft ? ' 저장 전 편성도 이미지에 포함돼요.' : ''}
      </Txt>
      {shot ? (
        <>
          <Image
            source={{ uri: shot }}
            testID="team-share-preview"
            accessibilityLabel={`${data.name} 편성 공유 이미지`}
            style={{ width: '100%', aspectRatio: 4 / 5, borderRadius: 12 }}
          />
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <Btn style={{ flex: 1 }} onPress={() => void share('이미지 저장')}>
              이미지 저장
            </Btn>
            <Btn
              style={{ flex: 1 }}
              kind="primary"
              testID="team-share-send"
              onPress={() => void share('팀 편성 공유')}
            >
              바로 공유
            </Btn>
          </View>
        </>
      ) : null}
      {error ? (
        <Txt tone="bad" accessibilityRole="alert">
          {error}
        </Txt>
      ) : null}
      <Btn testID="team-share-make" disabled={busy || !ready} onPress={() => void make()}>
        {busy ? '만드는 중…' : shot ? '다시 만들기' : '공유 이미지 만들기'}
      </Btn>
      <View
        pointerEvents="none"
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
        style={{ position: 'absolute', left: -10000, top: 0 }}
      >
        <View
          ref={ref}
          collapsable={false}
          onLayout={() => setReady(true)}
          style={{ width: 540, height: 675, padding: 20, backgroundColor: '#e9eee8', gap: 12 }}
        >
          <View style={{ flexDirection: 'row', gap: 12, alignItems: 'center', height: 90 }}>
            <TeamLogo name={data.name} logo={data.logo} size={58} />
            <View style={{ flex: 1 }}>
              <Txt style={{ color: '#5c6b62', fontSize: 12 }}>{`OFFSIDE · ${data.season}`}</Txt>
              <Txt style={{ color: '#14201a', fontSize: 28, fontWeight: '700' }}>{data.name}</Txt>
              <Txt
                style={{ color: '#5c6b62', fontSize: 13 }}
              >{`${data.manager} 감독${data.draft ? ' · 저장 전' : ''}`}</Txt>
            </View>
            <Txt
              style={{ color: '#1c4a35', fontSize: 28, fontWeight: '700' }}
            >{`OVR ${data.ovr}`}</Txt>
          </View>
          <TeamPitch
            formation={data.formation}
            layout={data.layout}
            cells={data.cells}
            animate={false}
          />
          <Txt style={{ color: '#5c6b62', fontSize: 12 }}>
            카드 OVR은 최고 실력 · 배치는 해당 자리 실력
          </Txt>
          <Txt style={{ color: '#1c4a35', fontSize: 14, fontWeight: '700' }}>
            나만의 축구 커리어 · offside-lab.com
          </Txt>
        </View>
      </View>
    </TeamDialog>
  );
}
