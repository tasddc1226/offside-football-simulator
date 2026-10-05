import type { Translation } from '@offside/contracts/i18n';
import type { GRoleNameMsgs } from '../ko/gRoleName';

export const gRoleName: Translation<GRoleNameMsgs> = {
  ST: 'Striker',
  CF: 'Second striker',
  RW: 'Winger',
  CAM: 'Attacking midfielder',
  CM: 'Central midfielder',
  CDM: 'Defensive midfielder',
  RB: 'Full-back',
  CB: 'Centre-back',
  GK: 'Goalkeeper',
};
