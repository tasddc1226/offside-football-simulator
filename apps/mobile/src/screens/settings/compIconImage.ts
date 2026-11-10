// T-11-681 리그·대회 로고 이미지를 앱에서 고른다(웹 compIconImage.ts와 같은 96px · 비율 유지). 대회 로고는 세로로 긴 트로피
// 모양이 많아 구단 엠블럼(clubEmblemImage.ts)처럼 가운데를 자르지 않는다. 사진 권한 없이 시스템 선택기를 쓰고 WebP로 투명을 지킨다.
import { COMP_ICON_IMG_MAX } from '@offside/app-core/compIcons';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import * as ImagePicker from 'expo-image-picker';

const MAX_FILE = 10 * 1024 * 1024;
const SIZES = [96, 72, 56];

/** 취소 canceled · 파일이 너무 큼 tooLarge · 한도에 못 맞춤 complex · 저장할 data URL. 못 읽으면 던진다. */
export type PickedCompIcon =
  { kind: 'canceled' | 'tooLarge' | 'complex' } | { kind: 'ok'; img: string };

export async function pickCompIcon(): Promise<PickedCompIcon> {
  const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 1 });
  if (result.canceled) return { kind: 'canceled' };
  const asset = result.assets[0]!;
  if ((asset.fileSize ?? 0) > MAX_FILE) return { kind: 'tooLarge' };
  const wide = asset.width >= asset.height;
  for (const box of SIZES) {
    const context = ImageManipulator.manipulate(asset.uri).resize(
      wide ? { width: box } : { height: box },
    );
    const rendered = await context.renderAsync();
    const image = await rendered.saveAsync({
      format: SaveFormat.WEBP,
      compress: 0.85,
      base64: true,
    });
    rendered.release();
    context.release();
    const img = `data:image/webp;base64,${image.base64 ?? ''}`;
    if (image.base64 && img.length <= COMP_ICON_IMG_MAX) return { kind: 'ok', img };
  }
  return { kind: 'complex' };
}
