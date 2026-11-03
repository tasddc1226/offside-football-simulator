export const chatShareText = {
  unnamed: '이름 없는 선수',
  team: (p: { name: string; ovr: number }) => `${p.name} 팀을 공유했어요. OVR ${p.ovr}`,
  listing: (p: { name: string; ovr: number }) =>
    `${p.name} 선수가 이적시장에 나왔어요. OVR ${p.ovr}`,
  player: (p: { name: string; ovr: number }) => `${p.name} 선수를 공유했어요. OVR ${p.ovr}`,
};
