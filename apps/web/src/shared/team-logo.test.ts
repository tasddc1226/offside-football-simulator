import { describe, expect, it, vi } from 'vitest';
import {
  TEAM_LOGO_MAX_DATA_URL_LENGTH,
  TEAM_LOGO_SIZE,
  TeamLogoError,
  coverCrop,
  isTeamLogoDataUrl,
  processTeamLogo,
  type TeamLogoDeps,
} from './team-logo.js';

function fakeFile(type: string, size: number): Blob {
  return { type, size } as Blob;
}

function fakeDeps(options: {
  width?: number;
  height?: number;
  webp?: string | null;
  png?: string;
  decodeFails?: boolean;
}) {
  const drawImage = vi.fn();
  const clearRect = vi.fn();
  const close = vi.fn();
  const toDataURL = vi.fn((type?: string) => {
    if (type === 'image/webp' && options.webp !== null)
      return options.webp ?? 'data:image/webp;base64,QUJD';
    return options.png ?? 'data:image/png;base64,QUJDRA==';
  });
  const deps: TeamLogoDeps = {
    decode: options.decodeFails
      ? () => Promise.reject(new Error('boom'))
      : () =>
          Promise.resolve({
            width: options.width ?? 300,
            height: options.height ?? 200,
            source: {} as CanvasImageSource,
            close,
          }),
    createCanvas: () => ({
      getContext: () => ({ drawImage, clearRect }) as unknown as CanvasRenderingContext2D,
      toDataURL,
    }),
  };
  return { deps, drawImage, clearRect, close, toDataURL };
}

describe('coverCrop', () => {
  it('가로가 긴 이미지는 가운데 정사각형을 잘라낸다', () => {
    expect(coverCrop(300, 200)).toEqual({ sx: 50, sy: 0, side: 200 });
    expect(coverCrop(120, 400)).toEqual({ sx: 0, sy: 140, side: 120 });
  });
});

describe('processTeamLogo', () => {
  it('png/jpeg/webp가 아니거나 2MB를 넘으면 코드별 오류를 던진다', async () => {
    const { deps } = fakeDeps({});
    await expect(processTeamLogo(fakeFile('image/gif', 10), deps)).rejects.toMatchObject({
      code: 'UNSUPPORTED_TYPE',
    });
    await expect(
      processTeamLogo(fakeFile('image/png', 2 * 1024 * 1024 + 1), deps),
    ).rejects.toMatchObject({
      code: 'INPUT_TOO_LARGE',
    });
  });

  it('128×128 cover로 그려 webp data URL을 돌려주고 비트맵을 해제한다', async () => {
    const { deps, drawImage, close } = fakeDeps({ width: 300, height: 200 });

    const result = await processTeamLogo(fakeFile('image/png', 1000), deps);

    expect(result).toBe('data:image/webp;base64,QUJD');
    expect(drawImage).toHaveBeenCalledWith(
      {},
      50,
      0,
      200,
      200,
      0,
      0,
      TEAM_LOGO_SIZE,
      TEAM_LOGO_SIZE,
    );
    expect(close).toHaveBeenCalled();
  });

  it('브라우저가 webp 인코딩을 지원하지 않으면(png로 대체 반환) png data URL을 쓴다', async () => {
    const { deps, toDataURL } = fakeDeps({ webp: null });

    const result = await processTeamLogo(fakeFile('image/jpeg', 1000), deps);

    expect(result).toBe('data:image/png;base64,QUJDRA==');
    expect(toDataURL).toHaveBeenCalledWith('image/png');
  });

  it('결과가 40KB를 넘으면 RESULT_TOO_LARGE, 디코드 실패는 DECODE_FAILED', async () => {
    const huge = `data:image/webp;base64,${'Q'.repeat(TEAM_LOGO_MAX_DATA_URL_LENGTH)}`;
    await expect(
      processTeamLogo(fakeFile('image/webp', 1000), fakeDeps({ webp: huge }).deps),
    ).rejects.toMatchObject({ code: 'RESULT_TOO_LARGE' });

    const error = await processTeamLogo(
      fakeFile('image/png', 1000),
      fakeDeps({ decodeFails: true }).deps,
    ).catch((caught: unknown) => caught);
    expect(error).toBeInstanceOf(TeamLogoError);
    expect((error as TeamLogoError).code).toBe('DECODE_FAILED');
  });
});

describe('isTeamLogoDataUrl', () => {
  it('우리 형식의 data URL만 통과시킨다', () => {
    expect(isTeamLogoDataUrl('data:image/webp;base64,QUJD')).toBe(true);
    expect(isTeamLogoDataUrl('data:image/png;base64,QUJDRA==')).toBe(true);
    expect(isTeamLogoDataUrl('data:image/svg+xml;base64,QUJD')).toBe(false);
    expect(isTeamLogoDataUrl('https://example.com/logo.png')).toBe(false);
    expect(
      isTeamLogoDataUrl(`data:image/png;base64,${'Q'.repeat(TEAM_LOGO_MAX_DATA_URL_LENGTH)}`),
    ).toBe(false);
    expect(isTeamLogoDataUrl(42)).toBe(false);
  });
});
