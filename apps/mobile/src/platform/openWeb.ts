// 웹 페이지(정책 문서·가이드)를 앱 안 브라우저로 연다.
import * as WebBrowser from 'expo-web-browser';
import { WEB_ORIGIN } from './config';

export const openWeb = (path: string) => void WebBrowser.openBrowserAsync(`${WEB_ORIGIN}${path}`);
