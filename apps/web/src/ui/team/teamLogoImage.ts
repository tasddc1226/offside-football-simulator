import { TEAM_LOGO_IMG_MAX } from '@offside/contracts/team-logo';
import { teamHomeText as L } from '@offside/app-core/i18n/ko/teamHome';

/** 사용자에게 그대로 보여 줄 수 있는 이미지 오류(그 밖의 오류는 화면이 일반 문구로 바꾼다). */
class LogoImageError extends Error {
  override name = 'LogoImageError';
}

/** 원본은 저장하지 않는다. 중앙을 정사각형으로 잘라 최대 128px/16KB의 로고로 바꾼다. */
export async function teamLogoImage(file: File): Promise<string> {
  if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type))
    throw new LogoImageError(L.imgType);
  if (file.size > 10 * 1024 * 1024) throw new LogoImageError(L.imgSize);
  const url = URL.createObjectURL(file);
  const image = new Image();
  const canvas = document.createElement('canvas');
  try {
    image.src = url;
    await image.decode();
    const side = Math.min(image.naturalWidth, image.naturalHeight);
    if (!side) throw new LogoImageError(L.imgRead);
    for (const size of [128, 96, 64]) {
      canvas.width = canvas.height = size;
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new LogoImageError(L.imgRead);
      ctx.drawImage(
        image,
        (image.naturalWidth - side) / 2,
        (image.naturalHeight - side) / 2,
        side,
        side,
        0,
        0,
        size,
        size,
      );
      // WebP 인코딩을 지원하지 않는 브라우저는 PNG를 돌려준다. 투명 배경은 그대로 둔다.
      const data = canvas.toDataURL('image/webp', 0.85);
      if (data.length <= TEAM_LOGO_IMG_MAX) return data;
    }
    throw new LogoImageError(L.imgComplex);
  } finally {
    URL.revokeObjectURL(url);
    image.src = '';
    canvas.width = canvas.height = 0;
  }
}
