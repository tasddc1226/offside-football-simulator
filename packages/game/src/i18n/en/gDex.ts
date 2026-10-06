import type { Translation } from '@offside/contracts/i18n';
import type { GDexMsgs } from '../ko/gDex';

export const gDex: Translation<GDexMsgs> = {
  factorClub: 'Club strength',
  factorLeague: 'League level',
  factorTrust: "Manager's trust",
  factorMorale: 'Morale',
  factorFame: 'Fame',
  factorCond: 'Fitness',
  factorAge: 'Age',
  factorInjury: 'Injury severity',
  factorContract: 'Contract years remaining',
  factorOvr: 'Overall rating (OVR)',
  factorTrait: (p) => `Trait: ${p.name}`,
  labelVaries: '(Choice varies by situation)',
};
