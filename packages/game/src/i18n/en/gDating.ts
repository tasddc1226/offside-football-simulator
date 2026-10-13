import type { Translation } from '@offside/contracts/i18n';
import type { gDatingText } from '../ko/gDating';
export const gDating: Translation<typeof gDatingText> = {
  title: 'Dating rumors off the pitch',
  text: 'A photo of you dining together has spread. A reporter asks about your private life and performances.',
  privateLabel: 'Keep your private life private',
  privateResult:
    'You gave a brief answer and ended the interview. The next question turned to the weekend match.',
  confirmLabel: 'Agree with your partner to confirm the relationship',
  confirmResult:
    'You released a joint statement. More reporters gathered outside the next training session.',
  pitchLabel: 'Say you will answer on the pitch',
  pitchResult:
    'You cut the interview short and returned to training. The coach led an individual training session.',
};
