export const chatShareText = {
  unnamed: '名前のない選手',
  team: (p: { name: string; ovr: number }) => `チーム「${p.name}」を共有しました。OVR ${p.ovr}`,
  listing: (p: { name: string; ovr: number }) => `${p.name}が移籍市場に出ました。OVR ${p.ovr}`,
  player: (p: { name: string; ovr: number }) => `選手「${p.name}」を共有しました。OVR ${p.ovr}`,
};
