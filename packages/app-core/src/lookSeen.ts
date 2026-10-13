// T-11-191 꾸미기를 이 기기에서 한 번이라도 열었는지. 열기 전에는 커리어 화면의 도트 선수 둘레에 고리가 깜빡인다.
// 첫 화면 청크에 들어가므로 꾸미기 화면 모듈(avatarLook.ts)과 따로 둔다.
import { loadKey, saveKey } from '@offside/game/storage';

const KEY = 'ft_look_seen';
export const lookSeen = (): boolean => loadKey<boolean>(KEY) === true;
export const markLookSeen = (): void => void saveKey(KEY, true);
