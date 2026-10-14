const sources = import.meta.glob('../../../../packages/game/assets/avatar-images/*.png', {
  eager: true,
  query: '?url',
  import: 'default',
}) as Record<string, string>;
export function avatarImageUrl(source: string): string {
  const url = sources[`../../../../packages/game/assets/avatar-images/${source}.png`];
  if (!url) throw new Error(`Missing avatar image: ${source}`);
  return url;
}
