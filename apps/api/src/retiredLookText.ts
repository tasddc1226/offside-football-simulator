import { retiredLookErrors as ko } from './i18n/ko/retiredLook.js';
import { retiredLookErrors as en } from './i18n/en/retiredLook.js';
import { retiredLookErrors as ja } from './i18n/ja/retiredLook.js';
import { retiredLookErrors as zh } from './i18n/zh/retiredLook.js';
import type { Lang } from './lang.js';
export const retiredLookErrors = (lang: Lang) => ({ ko, en, ja, zh })[lang];
