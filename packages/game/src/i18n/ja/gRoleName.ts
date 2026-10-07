import type { Translation } from '@offside/contracts/i18n';
import type { GRoleNameMsgs } from '../ko/gRoleName';

export const gRoleName: Translation<GRoleNameMsgs> = {
  ST: 'ストライカー',
  CF: 'シャドーストライカー',
  RW: 'ウイング',
  CAM: '攻撃的MF',
  CM: 'セントラルMF',
  CDM: '守備的MF',
  RB: 'サイドバック',
  CB: 'センターバック',
  GK: 'ゴールキーパー',
};
