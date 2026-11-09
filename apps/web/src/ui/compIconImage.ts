// T-11-681 리그·대회 로고 이미지 인코딩. 대회 로고는 세로로 긴 트로피 모양이 많아 가운데를 자르지 않고(구단 엠블럼
// clubEmblemImage.ts와 다르다) 비율을 지킨 채 96px 안에 맞춰 줄인다. 투명 배경은 WebP나 PNG로 지킨다.
import { COMP_ICON_IMG_MAX } from '@offside/app-core/compIcons';

const SIZES = [96, 72, 56];

function draw(bmp: ImageBitmap, box: number) {
  const k = box / Math.max(bmp.width, bmp.height);
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(bmp.width * k));
  canvas.height = Math.max(1, Math.round(bmp.height * k));
  canvas.getContext('2d')!.drawImage(bmp, 0, 0, canvas.width, canvas.height);
  return canvas;
}

/** 저장할 data URL. 어떤 크기로도 한도에 못 맞추면 null. */
export function encodeCompIcon(bmp: ImageBitmap): string | null {
  for (const box of SIZES) {
    const canvas = draw(bmp, box);
    const webp = canvas.toDataURL('image/webp', 0.85);
    if (webp.startsWith('data:image/webp') && webp.length <= COMP_ICON_IMG_MAX) return webp;
    // 사파리는 WebP를 못 만든다 — PNG로 투명을 지킨다.
    const png = canvas.toDataURL('image/png');
    if (png.length <= COMP_ICON_IMG_MAX) return png;
  }
  return null;
}
