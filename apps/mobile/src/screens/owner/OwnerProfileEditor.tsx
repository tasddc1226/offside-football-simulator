import Svg, { Path } from 'react-native-svg';
import { useColors } from '../../theme/useColors';
import { useState } from 'react';
import { Image, Pressable, View } from 'react-native';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import * as ImagePicker from 'expo-image-picker';
import { TEAM_LOGO_IMG_MAX } from '@offside/contracts/team-logo';
import { putAvatar, type Profile } from '@offside/app-core/api/client';
import { ownerText as L } from '@offside/app-core/i18n/ko/owner';
import { accountText as A } from '@offside/app-core/i18n/ko/account';
import { accountCache } from '../../store';
import { toast } from '../../game/host';
import { TeamDialog } from '../../components/TeamDialog';
import { OwnerAvatar } from '../../components/OwnerAvatar';
import { NicknameForm } from '../../components/NicknameForm';
import { Btn, Txt } from '../../ui';

export function OwnerProfileEditor({ profile, admin }: { profile: Profile; admin: boolean }) {
  const c = useColors();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [draft, setDraft] = useState<string>();
  const [error, setError] = useState('');
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
      if ((asset.fileSize ?? 0) > 10 * 1024 * 1024) throw new Error('size');
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
        try {
          const image = await rendered.saveAsync({
            format: SaveFormat.WEBP,
            compress: 0.75,
            base64: true,
          });
          const uri = `data:image/webp;base64,${image.base64 ?? ''}`;
          if (image.base64 && uri.length <= TEAM_LOGO_IMG_MAX) {
            setDraft(uri);
            return;
          }
        } finally {
          rendered.release();
          context.release();
        }
      }
      throw new Error('size');
    } catch {
      setError(L.profileImageError);
    } finally {
      setBusy(false);
    }
  }
  async function save(image: string | null) {
    if (busy) return;
    setBusy(true);
    setError('');
    try {
      const r = await putAvatar(image);
      if (!r.ok) {
        setError(r.error.message);
        return;
      }
      accountCache.value = r.data;
      accountCache.fetchedAt = Date.now();
      setDraft(undefined);
      toast(L.profileSaved);
    } finally {
      setBusy(false);
    }
  }
  return (
    <View style={{ alignSelf: 'flex-start', flexShrink: 0 }}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={L.profileEdit}
        testID="owner-profile-edit"
        onPress={() => setOpen(true)}
        style={({ pressed }) => ({
          width: 44,
          height: 44,
          alignItems: 'center',
          justifyContent: 'center',
          borderRadius: 10,
          backgroundColor: pressed ? c.surface2 : 'transparent',
        })}
      >
        <Svg width={20} height={20} viewBox="0 0 20 20" accessible={false}>
          <Path
            d="m12.5 3.5 4 4M3 17l4.5-1L17 6.5a2.8 2.8 0 0 0-4-4L3.5 12Z"
            fill="none"
            stroke={c.muted}
            strokeWidth={1.6}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </Svg>
      </Pressable>
      {open ? (
        <TeamDialog
          title={L.profileEdit}
          close={() => {
            if (busy) return;
            setOpen(false);
            setDraft(undefined);
            setError('');
          }}
        >
          <View style={{ gap: 12 }}>
            <Txt tone="muted" v="xs">
              {L.profileHint}
            </Txt>
            <View style={{ flexDirection: 'row', gap: 12, alignItems: 'center' }}>
              {draft ? (
                <Image
                  source={{ uri: draft }}
                  accessibilityLabel={L.profilePreview}
                  style={{ width: 64, height: 64, borderRadius: 32 }}
                />
              ) : (
                <OwnerAvatar
                  name={profile.nickname ?? L.avatarInitial}
                  avatarId={profile.avatarId}
                  size={64}
                />
              )}
              <View style={{ flex: 1, gap: 8 }}>
                <Btn sm disabled={busy} onPress={() => void pickImage()}>
                  {busy ? L.profileBusy : L.profileImagePick}
                </Btn>
                {profile.avatarId ? (
                  <Btn sm disabled={busy} onPress={() => void save(null)}>
                    {L.profileImageReset}
                  </Btn>
                ) : null}
              </View>
            </View>
            {draft ? (
              <View style={{ flexDirection: 'row', gap: 8 }}>
                <Btn disabled={busy} onPress={() => setDraft(undefined)}>
                  {L.profileCancel}
                </Btn>
                <Btn kind="primary" disabled={busy} onPress={() => void save(draft)}>
                  {L.profileImageSave}
                </Btn>
              </View>
            ) : null}
            <Txt tone="muted" v="xs">
              {L.profileImageHint}
            </Txt>
            {error ? <Txt accessibilityRole="alert">{error}</Txt> : null}
            <Txt bold>{L.profileName}</Txt>
            {admin ? (
              <Txt>{A.nicknameFixed({ nickname: profile.nickname })}</Txt>
            ) : (
              <NicknameForm key={profile.nickname ?? ''} current={profile.nickname} />
            )}
          </View>
        </TeamDialog>
      ) : null}
    </View>
  );
}
