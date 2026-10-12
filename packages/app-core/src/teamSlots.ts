/** Session-local team selection; old clients and new sessions always target the primary team. */
let selected = 0;
export const currentTeamSlot = () => selected;
export function selectTeamSlot(slot: number) {
  if (!Number.isInteger(slot) || slot < 0 || slot > 2) throw new RangeError('team slot');
  selected = slot;
}
export const teamSlotQuery = (path: string) =>
  selected === 0 ? path : `${path}${path.includes('?') ? '&' : '?'}slot=${selected}`;
