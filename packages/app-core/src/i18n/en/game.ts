import type { Translation } from '../core';
import type { GameMsgs } from '../ko/game';

export const game: Translation<GameMsgs> = {
  menuLabel: 'Game menu',
  tabSeason: 'Season',
  tabPlayer: 'Player',
  tabCareer: 'Career',
  tabTrophy: 'Trophies',
  tabHome: 'Home',
  age: (p) => `Age ${p.n}`,
  salary: (p) => `Salary ${p.v}`,
  amateur: 'Amateur',
  value: (p) => `Value ${p.v}`,
  focus: (p) => `Focus ${p.names}`,
  injury: (p) => `Injured ${p.n} match${p.n === 1 ? '' : 'es'}`,
  titleOpen: (p) => `Main title ${p.name}, open title collection`,
  prepOpen: (p) => `View next phase prep: ${p.prep}`,
  storageFull: "Storage is full, so your progress couldn't be saved. Back it up in Settings.",
  actEvent: '⚡ Check the event',
  actSeasonEnd: 'View season review',
  actPreseason: 'Start preseason training',
  actPlay: (p) => `Train, then play ${p.n} match${p.n === 1 ? '' : 'es'}`,
  prep: (p) => `Training ${p.train} · Investment ${p.invest} · Condition ${p.cond}`,
  investNone: 'None',
};
