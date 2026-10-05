// T-11-087 iOS 앱은 게시판 글의 다른 플랫폼 언급을 가린다(App Store 2.3.10). 서버 원문·웹·안드로이드는 그대로.
import { Platform } from 'react-native';
import { hideLines } from '@offside/app-core/boardText';

const OTHER_PLATFORM =
  /android|안드로이드|google\s*play|구글\s*플레이|플레이\s*스토어|play\s*store|갤럭시|galaxy/i;
const IOS = Platform.OS === 'ios';

/** 제목이 다른 플랫폼을 말하면 iOS 목록·배너에서 글째로 뺀다. */
export const hiddenPost = (p: { title: string }) => IOS && OTHER_PLATFORM.test(p.title);
export const shownBody = (body: string) => (IOS ? hideLines(body, OTHER_PLATFORM) : body);
export const shownComments = <T extends { body: string }>(cs: T[]) =>
  IOS ? cs.filter((c) => !OTHER_PLATFORM.test(c.body)) : cs;
