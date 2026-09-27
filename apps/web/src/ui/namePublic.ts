// T-10-065 선수 이름 공개(환경설정, 기본 켜짐). 켜져 있으면 시즌 업로드에 이름을 실어 홈 라이브에 보이고,
// 은퇴 때 명예의 전당 이름 공개도 켜진 채로 시작한다. 끄면 '익명의 공격수'처럼 올라간다. 이 기기에만 저장된다.
import { toPublicName } from '@offside/contracts/content-filter';
import { loadKey, saveKey } from '../game/season.js';

const KEY = 'ft_name_public';
let enabled = loadKey<boolean>(KEY) ?? true;

export const namePublicEnabled = () => enabled;
export function setNamePublic(on: boolean) {
  enabled = on;
  saveKey(KEY, on);
}

/** 서버에 보낼 공개 이름. 꺼져 있거나 서버가 받지 않을 이름(링크·욕설·형식)이면 null. */
export const publicNameOf = (name: string): string | null => (enabled ? toPublicName(name) : null);
