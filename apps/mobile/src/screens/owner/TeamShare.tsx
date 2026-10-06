import { useEffect, useRef, useState } from 'react';
import { View } from 'react-native';
import { Image } from 'expo-image';
import * as Sharing from 'expo-sharing';
import { captureRef, releaseCapture } from 'react-native-view-shot';
import type { FormationId, TeamLayout } from '@offside/contracts/owner-team';
import type { TeamLogo as Logo } from '@offside/contracts/team-logo';
import type { TeamLines } from '@offside/app-core/api/team';
import { TeamDialog } from '../../components/TeamDialog';
import { teamMatchText as L } from '@offside/app-core/i18n/ko/teamMatch';
import { teamHomeText as LH } from '@offside/app-core/i18n/ko/teamHome';
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
  lines: TeamLines;
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
      if (mounted.current) setError(L.shareMakeFail);
    } finally {
      if (mounted.current) setBusy(false);
    }
  }
  async function share(title: string) {
    if (!shot) return;
    try {
      if (!(await Sharing.isAvailableAsync())) return toast(L.shareUnavailableApp);
      await Sharing.shareAsync(shot, {
        mimeType: 'image/png',
        UTI: 'public.png',
        dialogTitle: title,
      });
    } catch {
      toast(L.shareOpenFailApp);
    }
  }
  return (
    <TeamDialog title={L.shareTitle} close={close}>
      <Txt v="sm" tone="muted">
        {L.shareLeadApp}
        {data.draft ? ` ${L.shareDraftNote}` : ''}
      </Txt>
      {shot ? (
        <>
          <Image
            source={{ uri: shot }}
            testID="team-share-preview"
            accessibilityLabel={L.shareAltApp({ name: data.name })}
            style={{ width: '100%', aspectRatio: 4 / 5, borderRadius: 12 }}
          />
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <Btn style={{ flex: 1 }} onPress={() => void share(L.saveImage)}>
              {L.saveImage}
            </Btn>
            <Btn
              style={{ flex: 1 }}
              kind="primary"
              testID="team-share-send"
              onPress={() => void share(L.shareDialogApp)}
            >
              {L.shareNow}
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
        {busy ? L.makingBtn : shot ? L.remake : L.makeImageApp}
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
          style={{ width: 540, height: 675, padding: 16, backgroundColor: '#e9eee8', gap: 8 }}
        >
          <View style={{ flexDirection: 'row', gap: 12, alignItems: 'center', height: 70 }}>
            <TeamLogo name={data.name} logo={data.logo} size={58} />
            <View style={{ flex: 1 }}>
              <Txt style={{ color: '#5c6b62', fontSize: 12 }}>{`OFFSIDE · ${data.season}`}</Txt>
              <Txt style={{ color: '#14201a', fontSize: 28, fontWeight: '700' }}>{data.name}</Txt>
              <Txt
                style={{ color: '#5c6b62', fontSize: 13 }}
              >{`${L.cardManagerApp({ name: data.manager })}${data.draft ? L.cardUnsavedApp : ''}`}</Txt>
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
            height={370}
          />
          <View style={{ flexDirection: 'row', gap: 8, height: 34 }}>
            {(['atk', 'mid', 'def', 'gk'] as const).map((key, i) => (
              <Txt
                key={key}
                style={{ flex: 1, textAlign: 'center', color: '#14201a', fontSize: 13 }}
              >
                {`${[LH.lineAtk, LH.lineMid, LH.lineDef, LH.lineGk][i]} ${Math.round(data.lines[key])}`}
              </Txt>
            ))}
          </View>
          <Txt style={{ color: '#5c6b62', fontSize: 12 }}>{L.cardFootApp}</Txt>
          <Txt style={{ color: '#1c4a35', fontSize: 14, fontWeight: '700' }}>
            {L.cardTaglineApp}
          </Txt>
        </View>
      </View>
    </TeamDialog>
  );
}
