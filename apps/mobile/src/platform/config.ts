// T-11-005 서버 주소. 빌드 때 EXPO_PUBLIC_API_URL로 바꿀 수 있고, 없으면 개발 빌드는 이 컴퓨터의 로컬 API(8787),
// 배포 빌드는 운영 API를 쓴다. Android 에뮬레이터에서 이 컴퓨터는 10.0.2.2다.
import { Platform } from 'react-native';

const devHost = Platform.OS === 'android' ? '10.0.2.2' : 'localhost';

export const API_BASE_URL =
  process.env.EXPO_PUBLIC_API_URL ??
  (__DEV__ ? `http://${devHost}:8787` : 'https://api.offside-lab.com');

/** 웹 주소 — 공유 링크(/career/<id>)·정책 문서·가이드는 웹 페이지를 연다. */
export const WEB_ORIGIN = process.env.EXPO_PUBLIC_WEB_ORIGIN ?? 'https://offside-lab.com';

/** 서버 업로드에 붙는 앱 버전(웹은 커밋 SHA). */
export const APP_VERSION = `app-${Platform.OS}`;
