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
import { TeamLogo } from '../../components/TeamLogo';
import { toast } from '../../game/host';
import { Btn, Press, Txt } from '../../ui';
import { Field, TextField } from '../settings/parts';
import { SortChips } from '../board/parts';
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
      if ((asset.fileSize ?? 0) > 10 * 1024 * 1024)
        throw new Error('10MB 이하 이미지를 골라 주세요.');
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
      throw new Error('이미지가 너무 복잡해요. 다른 이미지를 골라 주세요.');
    } catch (e) {
      setError(
        e instanceof Error && !e.message.includes('Native')
          ? e.message
          : '이미지를 불러오지 못했어요. 다시 골라 주세요.',
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <TeamDialog title="팀 로고 설정" close={close}>
      <View style={{ alignItems: 'center' }}>
        <TeamLogo name={name} logo={value} size={88} />
      </View>
      <Btn testID="team-logo-upload" onPress={() => void pickImage()} disabled={busy}>
        {busy ? '이미지 준비 중…' : '사진에서 이미지 선택'}
      </Btn>
      <Txt tone="muted" v="xs">
        가운데를 정사각형으로 잘라 작은 로고로 저장해요. 10MB 이하 이미지를 골라 주세요.
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
          기본 도안으로 만들기
        </Btn>
      ) : (
        <>
          <SortChips
            label="로고 모양"
            value={value.shape}
            onPick={(shape) => patch({ shape: shape as Logo['shape'] })}
            testIDPrefix="logo-shape"
            items={TEAM_LOGO_SHAPES.map((key, i) => ({
              key,
              label: ['방패', '오각형', '원형', '배지'][i]!,
            }))}
          />
          <SortChips
            label="로고 무늬"
            value={value.pattern}
            onPick={(pattern) => patch({ pattern: pattern as Logo['pattern'] })}
            testIDPrefix="logo-pattern"
            items={TEAM_LOGO_PATTERNS.map((key, i) => ({
              key,
              label: ['단색', 'V 무늬', '사선', '반반'][i]!,
            }))}
          />
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
            {TEAM_LOGO_COLORS.map((color) => (
              <Press
                key={color.bg}
                onPress={() => patch(color)}
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
          <Field label="로고 글자 (최대 3자)">
            <TextField
              accessibilityLabel="로고 글자"
              maxLength={3}
              value={value.text}
              onChangeText={(text) => patch({ text })}
            />
          </Field>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <Field label="배경색" style={{ flex: 1 }}>
              <TextField
                value={value.bg}
                onChangeText={(bg) => patch({ bg })}
                maxLength={7}
                autoCapitalize="none"
                accessibilityLabel="로고 배경색 HEX"
              />
            </Field>
            <Field label="글자색" style={{ flex: 1 }}>
              <TextField
                value={value.fg}
                onChangeText={(fg) => patch({ fg })}
                maxLength={7}
                autoCapitalize="none"
                accessibilityLabel="로고 글자색 HEX"
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
          if (!parsed.success)
            return setError('글자는 3자 이내, 색상은 # 뒤에 6자리로 입력해 주세요.');
          apply(parsed.data);
          close();
          toast('로고를 적용했어요. 편성 저장을 누르면 다른 사람에게도 보여요.');
        }}
      >
        로고 적용
      </Btn>
      <Btn
        kind="ghost"
        sm
        onPress={() => {
          apply(null);
          close();
        }}
      >
        기본 로고로 되돌리기
      </Btn>
    </TeamDialog>
  );
}
