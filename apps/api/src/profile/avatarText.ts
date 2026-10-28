import { profileAvatarText as ko } from '../i18n/ko/profileAvatar.js';
import { profileAvatarText as en } from '../i18n/en/profileAvatar.js';
import { profileAvatarText as ja } from '../i18n/ja/profileAvatar.js';
import { profileAvatarText as zh } from '../i18n/zh/profileAvatar.js';
import type { Lang } from '../lang.js';
export const avatarText = (lang: Lang) => ({ ko, en, ja, zh })[lang];
