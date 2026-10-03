import { TEAM_LOGO_IMG_MAX } from '@offside/contracts/team-logo';

/** 원본은 저장하지 않는다. 중앙을 정사각형으로 잘라 최대 128px/16KB의 로고로 바꾼다. */
export async function teamLogoImage(file: File): Promise<string> {
  if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type))
    throw new Error('PNG·JPG·WebP 이미지를 골라 주세요.');
  if (file.size > 10 * 1024 * 1024) throw new Error('10MB 이하의 이미지를 골라 주세요.');
  const url = URL.createObjectURL(file);
  const image = new Image();
  const canvas = document.createElement('canvas');
  try {
    image.src = url;
    await image.decode();
    const side = Math.min(image.naturalWidth, image.naturalHeight);
    if (!side) throw new Error('이미지를 읽지 못했어요.');
    for (const size of [128, 96, 64]) {
      canvas.width = canvas.height = size;
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('이미지를 읽지 못했어요.');
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
    throw new Error('이미지가 너무 복잡해요. 더 단순한 이미지를 골라 주세요.');
  } finally {
    URL.revokeObjectURL(url);
    image.src = '';
    canvas.width = canvas.height = 0;
  }
}
