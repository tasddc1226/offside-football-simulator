const sources = import.meta.glob('../../../../packages/game/assets/avatar-layers/*.png', {
  eager: true,
  query: '?url',
  import: 'default',
}) as Record<string, string>;
const warned = new Set<string>();
/** 그림 주소. 없는 그림이면 undefined — 화면 전체를 멈추지 않고 그 선수 자리만 비운다. */
export function avatarImageUrl(source: string): string | undefined {
  const url = sources[`../../../../packages/game/assets/avatar-layers/${source}.png`];
  if (!url && !warned.has(source)) {
    warned.add(source);
    console.warn(`avatar image missing: ${source}`);
  }
  return url;
}
