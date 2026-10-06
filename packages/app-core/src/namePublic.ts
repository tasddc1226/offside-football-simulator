// T-10-065 선수 이름 공개(환경설정, 기본 켜짐). 켜져 있으면 시즌 업로드에 이름을 실어 홈 라이브에 보이고,
// 은퇴 때 명예의 전당 이름 공개도 켜진 채로 시작한다. 끄면 '익명의 공격수'처럼 올라간다. 이 기기에만 저장된다.
import { toPublicName } from '@offside/contracts/content-filter';
import { loadKey, saveKey } from '@offside/game/hof-store';

const KEY = 'ft_name_public';
// 저장소는 클라이언트가 시작할 때 넣는다(앱) — 모듈을 불러올 때가 아니라 처음 쓸 때 읽는다.
let enabled: boolean | null = null;

export const namePublicEnabled = (): boolean => (enabled ??= loadKey<boolean>(KEY) ?? true);
export function setNamePublic(on: boolean) {
  enabled = on;
  saveKey(KEY, on);
}

/** 서버에 보낼 공개 이름. 꺼져 있거나 서버가 받지 않을 이름(링크·욕설·형식)이면 null. */
export const publicNameOf = (name: string): string | null =>
  namePublicEnabled() ? toPublicName(name) : null;
