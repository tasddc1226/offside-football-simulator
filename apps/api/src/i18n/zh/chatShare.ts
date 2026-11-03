export const chatShareText = {
  unnamed: '無名球員',
  team: (p: { name: string; ovr: number }) => `分享了球隊 ${p.name}。OVR ${p.ovr}`,
  listing: (p: { name: string; ovr: number }) => `${p.name} 已登上轉會市場。OVR ${p.ovr}`,
  player: (p: { name: string; ovr: number }) => `分享了球員 ${p.name}。OVR ${p.ovr}`,
};
