// T-11-627 구단 엠블럼 이미지를 앱에서 고른다(웹 clubEmblemImage.ts와 같은 64×64 · 가운데 자르기). 사진 권한 없이 시스템
// 선택기를 쓰고, WebP라 투명 배경이 그대로 남는다. 팀 로고(TeamLogoEditor)와 같은 방식이다.
import { CLUB_CUSTOM_IMG_MAX } from '@offside/contracts/club-limits';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import * as ImagePicker from 'expo-image-picker';

const MAX_FILE = 10 * 1024 * 1024;
const SIZES = [64, 48, 32];

/** 취소 canceled · 파일이 너무 큼 tooLarge · 한도에 못 맞춤 complex · 저장할 data URL. 못 읽으면 던진다. */
export type PickedEmblem =
  { kind: 'canceled' | 'tooLarge' | 'complex' } | { kind: 'ok'; img: string };

export async function pickClubEmblem(): Promise<PickedEmblem> {
  const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 1 });
  if (result.canceled) return { kind: 'canceled' };
  const asset = result.assets[0]!;
  if ((asset.fileSize ?? 0) > MAX_FILE) return { kind: 'tooLarge' };
  const side = Math.min(asset.width, asset.height);
  for (const width of SIZES) {
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
      compress: 0.85,
      base64: true,
    });
    rendered.release();
    context.release();
    const img = `data:image/webp;base64,${image.base64 ?? ''}`;
    if (image.base64 && img.length <= CLUB_CUSTOM_IMG_MAX) return { kind: 'ok', img };
  }
  return { kind: 'complex' };
}
