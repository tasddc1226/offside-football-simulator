import { shareToLoungeWith } from '@offside/app-core/api/loungeShare';
import type { ChatShareInput } from '@offside/contracts';
import { toast } from '../game/host';

/** 내 팀 · 선수를 라운지에 올리고 결과를 알린다. 올렸으면 true. */
export const shareToLounge = (input: ChatShareInput) => shareToLoungeWith(input, toast);
