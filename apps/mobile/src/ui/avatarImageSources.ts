/* eslint-disable @typescript-eslint/no-require-imports -- Metro requires static PNG asset references. */
// Static requires let Metro bundle every original PNG without runtime network access.
const sources: Record<string, number> = {
  'army-A': require('../../../../packages/game/assets/avatar-images/army-A.png') as number,
  'army-B': require('../../../../packages/game/assets/avatar-images/army-B.png') as number,

  'heads-short':
    require('../../../../packages/game/assets/avatar-images/heads-short.png') as number,
  'heads-fringe':
    require('../../../../packages/game/assets/avatar-images/heads-fringe.png') as number,
  'heads-long': require('../../../../packages/game/assets/avatar-images/heads-long.png') as number,
  'heads-mohawk':
    require('../../../../packages/game/assets/avatar-images/heads-mohawk.png') as number,
  'heads-slick':
    require('../../../../packages/game/assets/avatar-images/heads-slick.png') as number,
  'heads-buzz': require('../../../../packages/game/assets/avatar-images/heads-buzz.png') as number,
  'heads-afro': require('../../../../packages/game/assets/avatar-images/heads-afro.png') as number,
  'heads-bun': require('../../../../packages/game/assets/avatar-images/heads-bun.png') as number,
  'heads-spiky':
    require('../../../../packages/game/assets/avatar-images/heads-spiky.png') as number,
  army: require('../../../../packages/game/assets/avatar-images/army.png') as number,
  injured: require('../../../../packages/game/assets/avatar-images/injured.png') as number,
  retired: require('../../../../packages/game/assets/avatar-images/retired.png') as number,
  accessories: require('../../../../packages/game/assets/avatar-images/accessories.png') as number,
  'short-A': require('../../../../packages/game/assets/avatar-images/short-A.png') as number,
  'short-B': require('../../../../packages/game/assets/avatar-images/short-B.png') as number,
  'fringe-A': require('../../../../packages/game/assets/avatar-images/fringe-A.png') as number,
  'fringe-B': require('../../../../packages/game/assets/avatar-images/fringe-B.png') as number,
  'long-A': require('../../../../packages/game/assets/avatar-images/long-A.png') as number,
  'long-B': require('../../../../packages/game/assets/avatar-images/long-B.png') as number,
  'mohawk-A': require('../../../../packages/game/assets/avatar-images/mohawk-A.png') as number,
  'mohawk-B': require('../../../../packages/game/assets/avatar-images/mohawk-B.png') as number,
  'slick-A': require('../../../../packages/game/assets/avatar-images/slick-A.png') as number,
  'slick-B': require('../../../../packages/game/assets/avatar-images/slick-B.png') as number,
  'buzz-A': require('../../../../packages/game/assets/avatar-images/buzz-A.png') as number,
  'buzz-B': require('../../../../packages/game/assets/avatar-images/buzz-B.png') as number,
  'afro-A': require('../../../../packages/game/assets/avatar-images/afro-A.png') as number,
  'afro-B': require('../../../../packages/game/assets/avatar-images/afro-B.png') as number,
  'bun-A': require('../../../../packages/game/assets/avatar-images/bun-A.png') as number,
  'bun-B': require('../../../../packages/game/assets/avatar-images/bun-B.png') as number,
  'spiky-A': require('../../../../packages/game/assets/avatar-images/spiky-A.png') as number,
  'spiky-B': require('../../../../packages/game/assets/avatar-images/spiky-B.png') as number,
};
export const avatarImageSource = (name: string): number => sources[name]!;
