export type CareerTrophy = 'continental' | 'league' | 'cup';
export function careerTrophy(name: string): CareerTrophy {
  // i18n-ignore: canonical saved competition names.
  if (/챔피언스|유로파|컨퍼런스/.test(name)) return 'continental';
  // i18n-ignore: canonical saved honor names.
  if (/리그.*우승|라리가 우승|분데스리가 우승|세리에 A 우승|에레디비시 우승|MLS 우승/.test(name))
    return 'league';
  return 'cup';
}
export const CAREER_TROPHY_PATH: Record<CareerTrophy, string> = {
  continental:
    'M20 8h24v16c0 12-5 20-12 22-7-2-12-10-12-22V8ZM20 12H9v7c0 12 7 18 14 18M44 12h11v7c0 12-7 18-14 18M32 46v8M22 57h20M25 54h14',
  league:
    'M32 6 51 14v18c0 13-10 21-19 26-9-5-19-13-19-26V14L32 6ZM32 17l3 8 9 1-7 6 2 9-7-5-7 5 2-9-7-6 9-1 3-8Z',
  cup: 'M18 10h28v15c0 11-6 18-14 18s-14-7-14-18V10ZM18 15H8v6c0 9 5 14 13 14M46 15h10v6c0 9-5 14-13 14M32 43v11M21 58h22M25 54h14',
};
