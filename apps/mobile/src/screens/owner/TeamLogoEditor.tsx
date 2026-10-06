import { useState } from 'react';
import { View } from 'react-native';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import * as ImagePicker from 'expo-image-picker';
import { TeamLogoSchema } from '@offside/contracts';
import {
  TEAM_LOGO_COLORS,
  TEAM_LOGO_IMG_MAX,
  TEAM_LOGO_PATTERNS,
  TEAM_LOGO_SHAPES,
  defaultTeamLogo,
  type TeamLogo as Logo,
} from '@offside/contracts/team-logo';
import { TeamDialog } from '../../components/TeamDialog';
import { teamHomeText as L } from '@offside/app-core/i18n/ko/teamHome';
import { TeamLogo } from '../../components/TeamLogo';
import { toast } from '../../game/host';
import { Btn, Press, Txt } from '../../ui';
import { Field, TextField } from '../settings/parts';
import { RecordsChips as SortChips } from '../hof/RecordsControls';
export function TeamLogoEditor({
  name,
  logo,
  apply,
  close,
}: {
  name: string;
  logo: Logo | null;
  apply: (logo: Logo | null) => void;
  close: () => void;
}) {
  const [value, setValue] = useState<Logo>(logo ?? defaultTeamLogo(name));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const patch = (next: Partial<Logo>) => setValue((v) => ({ ...v, ...next }));
  async function pickImage() {
    if (busy) return;
    setBusy(true);
    setError('');
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        quality: 1,
      });
      if (result.canceled) return;
      const asset = result.assets[0]!;
      if ((asset.fileSize ?? 0) > 10 * 1024 * 1024) throw new Error(L.imgSizeApp);
      const side = Math.min(asset.width, asset.height);
      for (const width of [128, 96, 64]) {
        const context = ImageManipulator.manipulate(asset.uri)
          .crop({
            originX: Math.floor((asset.width - side) / 2),
            originY: Math.floor((asset.height - side) / 2),
            width: side,
            height: side,
          })
          .resize({ width, height: width });
        const rendered = await context.renderAsync();
        const image = await rendered.saveAsync({
          format: SaveFormat.WEBP,
          compress: 0.75,
          base64: true,
        });
        const uri = `data:image/webp;base64,${image.base64 ?? ''}`;
        rendered.release();
        context.release();
        if (image.base64 && uri.length <= TEAM_LOGO_IMG_MAX) {
          patch({ img: uri });
          return;
        }
      }
      throw new Error(L.imgComplexApp);
    } catch (e) {
      setError(e instanceof Error && !e.message.includes('Native') ? e.message : L.imgLoadFailApp);
    } finally {
      setBusy(false);
    }
  }
  return (
    <TeamDialog title={L.logoTitleApp} close={close}>
      <View style={{ alignItems: 'center' }}>
        <TeamLogo name={name} logo={value} size={88} />
      </View>
      <Txt tone="muted" v="xs">
        {L.previewNoteApp}
      </Txt>
      <Btn testID="team-logo-upload" onPress={() => void pickImage()} disabled={busy}>
        {busy ? L.busyApp : L.pickPhotoApp}
      </Btn>
      <Txt tone="muted" v="xs">
        {L.cropNoteApp}
      </Txt>
      {value.img ? (
        <Btn
          sm
          onPress={() => {
            const preset = { ...value };
            delete preset.img;
            setValue(preset);
          }}
        >
          {L.toPresetApp}
        </Btn>
      ) : (
        <>
          <SortChips
            label={L.shapeLabelApp}
            value={value.shape}
            onPick={(shape) => patch({ shape: shape as Logo['shape'] })}
            testIDPrefix="logo-shape"
            items={TEAM_LOGO_SHAPES.map((key, i) => ({
              key,
              label: [L.shapeAppS, L.shapeAppP, L.shapeAppR, L.shapeAppB][i]!,
            }))}
          />
          <SortChips
            label={L.patternLabelApp}
            value={value.pattern}
            onPick={(pattern) => patch({ pattern: pattern as Logo['pattern'] })}
            testIDPrefix="logo-pattern"
            items={TEAM_LOGO_PATTERNS.map((key, i) => ({
              key,
              label: [L.patAppPlain, L.patAppV, L.patAppSash, L.patAppHalf][i]!,
            }))}
          />
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
            {TEAM_LOGO_COLORS.map((color) => (
              <Press
                key={color.bg}
                onPress={() => patch({ bg: color.bg, fg: color.fg })}
                accessibilityLabel={color.name}
                accessibilityState={{ selected: value.bg === color.bg && value.fg === color.fg }}
                style={{
                  width: 48,
                  height: 48,
                  justifyContent: 'center',
                  alignItems: 'center',
                  borderWidth: value.bg === color.bg ? 2 : 0,
                  borderColor: color.fg,
                  backgroundColor: color.bg,
                  borderRadius: 24,
                }}
              >
                <Txt style={{ color: color.fg }}>FC</Txt>
              </Press>
            ))}
          </View>
          <Field label={L.textFieldApp}>
            <TextField
              accessibilityLabel={L.textAriaApp}
              maxLength={3}
              value={value.text}
              onChangeText={(text) => patch({ text })}
            />
          </Field>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <Field label={L.bgFieldApp} style={{ flex: 1 }}>
              <TextField
                value={value.bg}
                onChangeText={(bg) => patch({ bg })}
                maxLength={7}
                autoCapitalize="none"
                accessibilityLabel={L.bgAriaApp}
              />
            </Field>
            <Field label={L.fgFieldApp} style={{ flex: 1 }}>
              <TextField
                value={value.fg}
                onChangeText={(fg) => patch({ fg })}
                maxLength={7}
                autoCapitalize="none"
                accessibilityLabel={L.fgAriaApp}
              />
            </Field>
          </View>
        </>
      )}
      {error ? (
        <Txt tone="bad" accessibilityRole="alert">
          {error}
        </Txt>
      ) : null}
      <Btn
        kind="primary"
        testID="team-logo-apply"
        disabled={busy}
        onPress={() => {
          const parsed = TeamLogoSchema.safeParse(value);
          if (!parsed.success) return setError(L.logoInvalidApp);
          apply(parsed.data);
          close();
          toast(L.logoAppliedApp);
        }}
      >
        {L.logoApplyApp}
      </Btn>
      <Btn
        kind="ghost"
        sm
        onPress={() => {
          apply(null);
          close();
        }}
      >
        {L.logoResetApp}
      </Btn>
    </TeamDialog>
  );
}
