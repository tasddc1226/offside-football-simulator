// UX-013 구단 로고 업로드 파이프라인. 파일(png/jpeg/webp, ≤2MB) → 캔버스 128×128 cover 리사이즈 →
// webp 0.85(브라우저가 webp 인코딩을 지원하지 않으면 png) data URL(≤40KB). 결과는 문자열이라
// ui-store의 teamLogos에 그대로 들어가고 toss 채널의 문자열 KV(ADR-002)에도 Blob 없이 저장된다.
// 브라우저 API(createImageBitmap·canvas)는 `deps`로 주입해 단위 테스트에서 모킹한다.

export const TEAM_LOGO_ACCEPTED_TYPES: readonly string[] = [
  'image/png',
  'image/jpeg',
  'image/webp',
];
/** `<input type="file" accept>` 값. */
export const TEAM_LOGO_ACCEPT = TEAM_LOGO_ACCEPTED_TYPES.join(',');
export const TEAM_LOGO_MAX_INPUT_BYTES = 2 * 1024 * 1024;
export const TEAM_LOGO_SIZE = 128;
export const TEAM_LOGO_WEBP_QUALITY = 0.85;
/** data URL 문자열 길이 상한(≈ 40KB). 12팀 전부 채워도 0.5MB 미만이 되도록 잡았다. */
export const TEAM_LOGO_MAX_DATA_URL_LENGTH = 40 * 1024;

export type TeamLogoErrorCode =
  'UNSUPPORTED_TYPE' | 'INPUT_TOO_LARGE' | 'DECODE_FAILED' | 'RESULT_TOO_LARGE';

/** 오류 토스트 문구(사용자에게 그대로 보여준다). */
export const TEAM_LOGO_ERROR_MESSAGE: Record<TeamLogoErrorCode, string> = {
  UNSUPPORTED_TYPE: 'PNG·JPEG·WebP 이미지만 올릴 수 있습니다.',
  INPUT_TOO_LARGE: '2MB 이하 이미지만 올릴 수 있습니다.',
  DECODE_FAILED: '이미지를 읽지 못했습니다. 다른 파일을 골라 주세요.',
  RESULT_TOO_LARGE: '로고를 줄여도 너무 큽니다. 더 단순한 이미지를 골라 주세요.',
};

export class TeamLogoError extends Error {
  readonly code: TeamLogoErrorCode;

  constructor(code: TeamLogoErrorCode) {
    super(TEAM_LOGO_ERROR_MESSAGE[code]);
    this.name = 'TeamLogoError';
    this.code = code;
  }
}

/** 저장값 안전 로드용: 우리가 만든 형식(png/webp/jpeg base64 data URL, 길이 상한 이내)만 통과시킨다. */
export function isTeamLogoDataUrl(value: unknown): value is string {
  return (
    typeof value === 'string' &&
    value.length <= TEAM_LOGO_MAX_DATA_URL_LENGTH &&
    /^data:image\/(?:png|webp|jpeg);base64,[A-Za-z0-9+/]+=*$/.test(value)
  );
}

export interface DecodedImage {
  width: number;
  height: number;
  source: CanvasImageSource;
  /** ImageBitmap처럼 명시 해제가 필요한 리소스면 넘긴다. */
  close?: () => void;
}

export interface TeamLogoCanvas {
  getContext(contextId: '2d'): CanvasRenderingContext2D | null;
  toDataURL(type?: string, quality?: number): string;
}

export interface TeamLogoDeps {
  decode: (file: Blob) => Promise<DecodedImage>;
  createCanvas: (width: number, height: number) => TeamLogoCanvas;
}

/** 정사각형 cover 크롭 원점·변 길이(가운데 정렬). 순수 함수라 단독으로 테스트한다. */
export function coverCrop(width: number, height: number): { sx: number; sy: number; side: number } {
  const side = Math.max(1, Math.min(width, height));
  return {
    sx: Math.floor((width - side) / 2),
    sy: Math.floor((height - side) / 2),
    side,
  };
}

async function decodeWithImageElement(file: Blob): Promise<DecodedImage> {
  const url = URL.createObjectURL(file);
  try {
    const image = await new Promise<HTMLImageElement>((resolve, reject) => {
      const element = new Image();
      element.onload = () => resolve(element);
      element.onerror = () => reject(new Error('image decode failed'));
      element.src = url;
    });
    return { width: image.naturalWidth, height: image.naturalHeight, source: image };
  } finally {
    URL.revokeObjectURL(url);
  }
}

async function decodeInBrowser(file: Blob): Promise<DecodedImage> {
  if (typeof createImageBitmap === 'function') {
    const bitmap = await createImageBitmap(file);
    return {
      width: bitmap.width,
      height: bitmap.height,
      source: bitmap,
      close: () => bitmap.close(),
    };
  }
  return decodeWithImageElement(file);
}

function createBrowserCanvas(width: number, height: number): TeamLogoCanvas {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  return canvas;
}

const BROWSER_DEPS: TeamLogoDeps = { decode: decodeInBrowser, createCanvas: createBrowserCanvas };

/**
 * 업로드 파일을 검증·리사이즈해 배지용 data URL을 돌려준다. 실패는 전부 TeamLogoError(코드별
 * 한국어 문구)로 던지며, 호출부는 message를 오류 토스트에 그대로 쓴다.
 */
export async function processTeamLogo(
  file: Blob,
  deps: TeamLogoDeps = BROWSER_DEPS,
): Promise<string> {
  if (!TEAM_LOGO_ACCEPTED_TYPES.includes(file.type)) throw new TeamLogoError('UNSUPPORTED_TYPE');
  if (file.size > TEAM_LOGO_MAX_INPUT_BYTES) throw new TeamLogoError('INPUT_TOO_LARGE');

  let decoded: DecodedImage;
  try {
    decoded = await deps.decode(file);
  } catch {
    throw new TeamLogoError('DECODE_FAILED');
  }

  try {
    if (!(decoded.width > 0) || !(decoded.height > 0)) throw new TeamLogoError('DECODE_FAILED');
    const canvas = deps.createCanvas(TEAM_LOGO_SIZE, TEAM_LOGO_SIZE);
    const context = canvas.getContext('2d');
    if (context === null) throw new TeamLogoError('DECODE_FAILED');

    const { sx, sy, side } = coverCrop(decoded.width, decoded.height);
    context.clearRect(0, 0, TEAM_LOGO_SIZE, TEAM_LOGO_SIZE);
    context.drawImage(decoded.source, sx, sy, side, side, 0, 0, TEAM_LOGO_SIZE, TEAM_LOGO_SIZE);

    // toDataURL은 요청한 타입을 지원하지 않으면 image/png로 조용히 대체한다(HTML 표준) — 접두어로 판별.
    let dataUrl = canvas.toDataURL('image/webp', TEAM_LOGO_WEBP_QUALITY);
    if (!dataUrl.startsWith('data:image/webp')) dataUrl = canvas.toDataURL('image/png');
    if (dataUrl.length > TEAM_LOGO_MAX_DATA_URL_LENGTH) throw new TeamLogoError('RESULT_TOO_LARGE');
    if (!isTeamLogoDataUrl(dataUrl)) throw new TeamLogoError('DECODE_FAILED');
    return dataUrl;
  } finally {
    decoded.close?.();
  }
}
