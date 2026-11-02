// T-11-607 구단 엠블럼 업로드 인코딩. 64×64로 가운데를 잘라 줄여 data URL로 만든다(localStorage 용량에 모든 구단이 들어가게).
// 사파리처럼 WebP를 못 만드는 브라우저는 예전에 JPEG로만 떨어져 투명 배경이 검게 변했다. 투명한 이미지는 PNG로 지킨다.
import { CLUB_CUSTOM_IMG_MAX } from '@offside/contracts/club-limits';

const SIZE = 64;
/** PNG는 WebP보다 커서 한도를 넘을 수 있다. JPEG(투명 손실)로 떨어지기 전에 조금 작게 한 번 더 시도한다. */
const PNG_RETRY_SIZE = 48;

function drawSquare(bmp: ImageBitmap, size: number) {
  const side = Math.min(bmp.width, bmp.height);
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  ctx.drawImage(bmp, (bmp.width - side) / 2, (bmp.height - side) / 2, side, side, 0, 0, size, size);
  return { canvas, ctx };
}

const fits = (img: string) => img.length <= CLUB_CUSTOM_IMG_MAX;

/** 저장할 data URL. 어떤 형식으로도 한도에 못 맞추면 null. */
export function encodeClubEmblem(bmp: ImageBitmap): string | null {
  const { canvas, ctx } = drawSquare(bmp, SIZE);
  const webp = canvas.toDataURL('image/webp', 0.85);
  if (webp.startsWith('data:image/webp') && fits(webp)) return webp;
  // 불투명한 이미지는 PNG가 크기만 하니 JPEG로 둔다(이미지 합계 한도를 아낀다).
  const { data } = ctx.getImageData(0, 0, SIZE, SIZE);
  let transparent = false;
  for (let i = 3; i < data.length && !transparent; i += 4) transparent = data[i]! < 255;
  if (transparent) {
    const png = canvas.toDataURL('image/png');
    if (fits(png)) return png;
    const smaller = drawSquare(bmp, PNG_RETRY_SIZE).canvas.toDataURL('image/png');
    if (fits(smaller)) return smaller;
  }
  const jpeg = canvas.toDataURL('image/jpeg', 0.8);
  return fits(jpeg) ? jpeg : null;
}
