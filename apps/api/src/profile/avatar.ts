import type { Lang } from '../lang.js';
import { avatarText } from './avatarText.js';
import { AppError } from '../errors.js';

/** Only small PNG/WebP rasters emitted by the clients; reject spoofed types and oversized dimensions. */
export function validateAvatarImage(image: string, lang: Lang = 'ko'): void {
  let width = 0,
    height = 0;
  try {
    const [prefix, value] = image.split(',');
    const b = Uint8Array.from(atob(value!), (c) => c.charCodeAt(0));
    const v = new DataView(b.buffer);
    const str = (a: number, n: number) => String.fromCharCode(...b.slice(a, a + n));
    if (
      prefix === 'data:image/png;base64' &&
      b.length >= 33 &&
      v.getUint32(0) === 0x89504e47 &&
      v.getUint32(4) === 0x0d0a1a0a &&
      str(12, 4) === 'IHDR'
    ) {
      width = v.getUint32(16);
      height = v.getUint32(20);
    } else if (
      prefix === 'data:image/webp;base64' &&
      str(0, 4) === 'RIFF' &&
      str(8, 4) === 'WEBP' &&
      v.getUint32(4, true) + 8 === b.length
    ) {
      const chunk = str(12, 4);
      if (chunk === 'VP8X' && b.length >= 30 && !(b[20]! & 2)) {
        width = 1 + b[24]! + (b[25]! << 8) + (b[26]! << 16);
        height = 1 + b[27]! + (b[28]! << 8) + (b[29]! << 16);
      } else if (chunk === 'VP8L' && b[20] === 0x2f && b.length >= 25) {
        width = 1 + b[21]! + ((b[22]! & 0x3f) << 8);
        height = 1 + (b[22]! >> 6) + (b[23]! << 2) + ((b[24]! & 0xf) << 10);
      } else if (chunk === 'VP8 ' && str(23, 3) === '\x9d\x01\x2a' && b.length >= 30) {
        width = v.getUint16(26, true) & 0x3fff;
        height = v.getUint16(28, true) & 0x3fff;
      }
    }
  } catch {
    /* Invalid/truncated binary. */
  }
  if (width < 1 || height < 1 || width > 128 || height > 128 || width !== height)
    throw new AppError({
      code: 'VALIDATION_FAILED',
      message: avatarText(lang).invalid,
    });
}
