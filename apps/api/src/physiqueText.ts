import { errors as ko } from './i18n/ko/physique.js';
import { errors as en } from './i18n/en/physique.js';
import { errors as ja } from './i18n/ja/physique.js';
import { errors as zh } from './i18n/zh/physique.js';
import type { Lang } from './lang.js';
export const physiqueErrors = (lang: Lang) => ({ ko, en, ja, zh })[lang];
