// T-11-120 구단 홈·원정 유니폼(도트 아바타용). 한 줄 = '상의 무늬 무늬색 소매 깃 하의 양말 양말끝 [세번째색]' (# 뺀 hex).
// 모티브가 된 구단의 유니폼 색·무늬만 따른다 — 스폰서·제조사 표시·실제 엠블럼은 넣지 않는다.
// 정의 없는 구단(고교·대학)은 kits.ts autoKit가 엠블럼 색으로 만든다. 무늬 키는 kits.ts KIT_PATTERNS.
export const KIT_SPECS: Record<string, readonly [home: string, away: string]> = {
  'k1-0': [
    '0046a8 - 0046a8 0046a8 ffd200 0046a8 0046a8 ffd200',
    'ffffff - ffffff ffffff 0046a8 ffffff ffffff 0046a8',
  ],
  'k1-1': [
    '0b7a3b - 0b7a3b 111111 111111 0b7a3b 0b7a3b 111111',
    'ffffff - ffffff ffffff 0b7a3b ffffff ffffff 0b7a3b',
  ],
  'k1-2': [
    '111111 v d51f26 111111 d51f26 111111 111111 d51f26',
    'ffffff v d51f26 ffffff 111111 ffffff ffffff d51f26',
  ],
  'k1-3': [
    '111111 v d71920 111111 d71920 111111 111111 d71920',
    'ffffff - ffffff ffffff d71920 ffffff ffffff 111111',
  ],
  'k1-4': [
    '5a2a82 - 5a2a82 00857c 00857c 5a2a82 5a2a82 00857c',
    'ffffff - ffffff ffffff 5a2a82 ffffff ffffff 5a2a82',
  ],
  'k1-5': [
    '111111 v 0059a8 111111 0059a8 111111 111111 0059a8',
    'ffffff v 0059a8 ffffff 111111 ffffff ffffff 0059a8',
  ],
  'k1-6': [
    'f47920 - f47920 f47920 ffffff f47920 f47920 ffffff',
    '14264e - 14264e 14264e f47920 14264e 14264e f47920',
  ],
  'k1-7': [
    'ffcd00 - ffcd00 ffcd00 e60012 ffcd00 ffcd00 e60012',
    'ffffff - ffffff ffffff ffcd00 ffffff ffffff ffcd00',
  ],
  'k1-8': [
    'f58220 - f58220 f58220 ffffff f58220 f58220 ffffff',
    'ffffff - ffffff ffffff f58220 ffffff ffffff f58220',
  ],
  'k1-9': [
    '5f259f - 5f259f 5f259f ffffff 5f259f 5f259f ffffff',
    'ffffff - ffffff ffffff 5f259f ffffff ffffff 5f259f',
  ],
  'k1-10': [
    'c8102e - c8102e c8102e 111111 111111 c8102e 111111',
    'ffffff - ffffff ffffff c8102e ffffff ffffff c8102e',
  ],
  'k2-0': [
    '0046a8 - 0046a8 0046a8 e30613 0046a8 0046a8 e30613',
    'ffffff - ffffff ffffff 0046a8 ffffff ffffff 0046a8',
  ],
  'k2-1': [
    'd7141a - d7141a d7141a ffffff d7141a d7141a ffffff',
    'ffffff - ffffff ffffff d7141a ffffff ffffff d7141a',
  ],
  'k2-2': [
    '1f2a55 - 1f2a55 1f2a55 d4a017 1f2a55 1f2a55 d4a017',
    'ffffff - ffffff ffffff 1f2a55 ffffff ffffff 1f2a55',
  ],
  'k2-3': [
    'ffd400 - ffd400 ffd400 111111 111111 ffd400 111111',
    '111111 - 111111 111111 ffd400 111111 111111 ffd400',
  ],
  'k2-4': [
    '111111 - 111111 111111 ffffff 111111 111111 ffffff',
    'ffffff - ffffff ffffff 111111 ffffff ffffff 111111',
  ],
  'k2-5': [
    '58b7e8 - 58b7e8 58b7e8 0a2458 0a2458 58b7e8 0a2458',
    '0a2458 - 0a2458 0a2458 58b7e8 0a2458 0a2458 58b7e8',
  ],
  'k2-6': [
    '0b3d91 half d6001c 0b3d91 ffffff 0b3d91 0b3d91 ffffff',
    'ffffff - ffffff ffffff 0b3d91 ffffff ffffff d6001c',
  ],
  'k2-7': [
    'e60012 - e60012 e60012 111111 e60012 e60012 111111',
    'ffffff - ffffff ffffff e60012 ffffff ffffff e60012',
  ],
  'k2-8': [
    'd4af37 - d4af37 d4af37 1c2c5b 1c2c5b d4af37 1c2c5b',
    '1c2c5b - 1c2c5b 1c2c5b d4af37 1c2c5b 1c2c5b d4af37',
  ],
  'k2-9': [
    '0055b8 - 0055b8 0055b8 ffd200 0055b8 0055b8 ffd200',
    'ffffff - ffffff ffffff 0055b8 ffffff ffffff 0055b8',
  ],
  'k2-10': [
    '5bc2e7 - 5bc2e7 5bc2e7 0b2a4a 0b2a4a 5bc2e7 0b2a4a',
    '0b2a4a - 0b2a4a 0b2a4a 5bc2e7 0b2a4a 0b2a4a 5bc2e7',
  ],
  'k2-11': [
    '00338d - 00338d 00338d e4002b 00338d 00338d e4002b',
    'ffffff - ffffff ffffff 00338d ffffff ffffff e4002b',
  ],
  'k2-12': [
    '00843d - 00843d 00843d ffffff 00843d 00843d ffffff',
    'ffffff - ffffff ffffff 00843d ffffff ffffff 00843d',
  ],
  'k2-13': [
    '6b2c91 - 6b2c91 6b2c91 d4af37 6b2c91 6b2c91 d4af37',
    'ffffff - ffffff ffffff 6b2c91 ffffff ffffff 6b2c91',
  ],
  'k2-14': [
    'f37021 - f37021 f37021 ffffff f37021 f37021 ffffff',
    'ffffff - ffffff ffffff f37021 ffffff ffffff f37021',
  ],
  'k2-15': [
    '0a3d7a - 0a3d7a 0a3d7a ffffff 0a3d7a 0a3d7a ffffff',
    'ffffff - ffffff ffffff 0a3d7a ffffff ffffff 0a3d7a',
  ],
  'k2-16': [
    '2b4c2f - 2b4c2f 2b4c2f d9c07a 2b4c2f 2b4c2f d9c07a',
    'd9c07a - d9c07a d9c07a 2b4c2f d9c07a d9c07a 2b4c2f',
  ],
  'k3-0': [
    '1b5fa8 - 1b5fa8 1b5fa8 f39800 1b5fa8 1b5fa8 f39800',
    'ffffff - ffffff ffffff 1b5fa8 ffffff ffffff f39800',
  ],
  'k3-1': [
    '0b3d91 - 0b3d91 0b3d91 ffffff 0b3d91 0b3d91 ffffff',
    'ffffff - ffffff ffffff 0b3d91 ffffff ffffff 0b3d91',
  ],
  'k3-2': [
    '004a98 - 004a98 004a98 e60012 004a98 004a98 e60012',
    'ffffff - ffffff ffffff 004a98 ffffff ffffff e60012',
  ],
  'k3-3': [
    '2e8b57 - 2e8b57 2e8b57 ffffff 2e8b57 2e8b57 ffffff',
    'ffffff - ffffff ffffff 2e8b57 ffffff ffffff 2e8b57',
  ],
  'k3-4': [
    '0055a5 - 0055a5 0055a5 ffffff 0055a5 0055a5 ffffff',
    'ffffff - ffffff ffffff 0055a5 ffffff ffffff 0055a5',
  ],
  'k3-5': [
    '1f5f3a - 1f5f3a 1f5f3a ffffff 1f5f3a 1f5f3a ffffff',
    'ffffff - ffffff ffffff 1f5f3a ffffff ffffff 1f5f3a',
  ],
  'k3-6': [
    '0089cf - 0089cf 0089cf ffffff 0089cf 0089cf ffffff',
    'ffffff - ffffff ffffff 0089cf ffffff ffffff 0089cf',
  ],
  'k3-7': [
    'ffffff - ffffff ffffff 0068b7 ffffff ffffff 0068b7',
    '0068b7 - 0068b7 0068b7 ffffff 0068b7 0068b7 ffffff',
  ],
  'k3-8': [
    '003876 - 003876 003876 ffd200 003876 003876 ffd200',
    'ffffff - ffffff ffffff 003876 ffffff ffffff 003876',
  ],
  'k3-9': [
    '0b6e3b - 0b6e3b 111111 f7d117 0b6e3b 0b6e3b f7d117',
    'ffffff - ffffff ffffff 0b6e3b ffffff ffffff 0b6e3b',
  ],
  'k3-10': [
    '0a5a8a half 00a0b0 0a5a8a ffffff 0a5a8a 0a5a8a ffffff',
    'ffffff - ffffff ffffff 0a5a8a ffffff ffffff 00a0b0',
  ],
  'k3-11': [
    '004ea2 - 004ea2 004ea2 ffffff 004ea2 004ea2 ffffff',
    'ffffff - ffffff ffffff 004ea2 ffffff ffffff 004ea2',
  ],
  'k3-12': [
    '2a9d8f - 2a9d8f 2a9d8f ffffff 2a9d8f 2a9d8f ffffff',
    'ffffff - ffffff ffffff 2a9d8f ffffff ffffff 2a9d8f',
  ],
  'k3-13': [
    'f28c28 - f28c28 f28c28 ffffff f28c28 f28c28 ffffff',
    'ffffff - ffffff ffffff f28c28 ffffff ffffff f28c28',
  ],
  'j1-0': [
    'e6002d - e6002d e6002d 111111 111111 e6002d 111111',
    'ffffff - ffffff ffffff e6002d ffffff ffffff e6002d',
  ],
  'j1-1': [
    'a50034 - a50034 a50034 111111 ffffff a50034 ffffff',
    'ffffff - ffffff ffffff a50034 ffffff ffffff a50034',
  ],
  'j1-2': [
    'b71c2e - b71c2e b71c2e 1b2a4e 1b2a4e b71c2e 1b2a4e',
    'ffffff - ffffff ffffff 1b2a4e ffffff ffffff b71c2e',
  ],
  'j1-3': [
    '0a3a8c hoop ffffff 0a3a8c e60012 0a3a8c 0a3a8c e60012',
    'ffffff hoop 0a3a8c ffffff e60012 ffffff ffffff 0a3a8c',
  ],
  'j1-4': [
    '3aa6e0 h 111111 3aa6e0 111111 111111 3aa6e0 111111',
    'ffffff - ffffff ffffff 3aa6e0 3aa6e0 ffffff 111111',
  ],
  'j1-5': [
    '5b2d8e - 5b2d8e 5b2d8e ffffff 5b2d8e 5b2d8e ffffff',
    'ffffff - ffffff ffffff 5b2d8e ffffff ffffff 5b2d8e',
  ],
  'j1-6': [
    'ffe100 - ffe100 ffe100 111111 111111 ffe100 111111',
    '111111 - 111111 111111 ffe100 111111 111111 ffe100',
  ],
  'j1-7': [
    '0b3b8c - 0b3b8c 0b3b8c c9a227 0b3b8c 0b3b8c c9a227',
    'ffffff - ffffff ffffff 0b3b8c ffffff ffffff c9a227',
  ],
  'j1-8': [
    '004ea2 v 111111 004ea2 111111 111111 004ea2 111111',
    'ffffff - ffffff ffffff 004ea2 ffffff ffffff 004ea2',
  ],
  'j1-9': [
    '1d4fa0 v d7102b 1d4fa0 d7102b 1d4fa0 1d4fa0 d7102b',
    'ffffff - ffffff ffffff 1d4fa0 ffffff ffffff d7102b',
  ],
  'j1-10': [
    'd7000f - d7000f d7000f f8b500 d7000f d7000f f8b500',
    'ffffff - ffffff ffffff d7000f ffffff ffffff d7000f',
  ],
  'j1-11': [
    '5a2d82 - 5a2d82 5a2d82 ffffff 5a2d82 5a2d82 ffffff',
    'ffffff - ffffff ffffff 5a2d82 ffffff ffffff 5a2d82',
  ],
  'j1-12': [
    'e5006e - e5006e e5006e 1b1f5c 1b1f5c e5006e 1b1f5c',
    '1b1f5c - 1b1f5c 1b1f5c e5006e 1b1f5c 1b1f5c e5006e',
  ],
  'j1-13': [
    '008c4a - 008c4a 008c4a ffffff 008c4a 008c4a ffffff',
    'ffffff - ffffff ffffff 008c4a ffffff ffffff 008c4a',
  ],
  'j1-14': [
    '0b1c3d - 0b1c3d 0b1c3d a0a8b3 0b1c3d 0b1c3d a0a8b3',
    'ffffff - ffffff ffffff 0b1c3d ffffff ffffff 0b1c3d',
  ],
  'j1-15': [
    'f39800 - f39800 f39800 0b3b8c f39800 f39800 0b3b8c',
    'ffffff - ffffff ffffff f39800 ffffff ffffff f39800',
  ],
  'j1-16': [
    '9e1b32 - 9e1b32 9e1b32 ffffff 9e1b32 9e1b32 ffffff',
    'ffffff - ffffff ffffff 9e1b32 ffffff ffffff 9e1b32',
  ],
  'j1-17': [
    'f39800 - f39800 f39800 0055a5 0055a5 f39800 0055a5',
    '0055a5 - 0055a5 0055a5 f39800 0055a5 0055a5 f39800',
  ],
  'j1-18': [
    'ffd400 - ffd400 ffd400 00843d ffd400 ffd400 00843d',
    '00843d - 00843d 00843d ffd400 00843d 00843d ffd400',
  ],
  'j1-19': [
    '0055a5 - 0055a5 0055a5 ffffff 0055a5 0055a5 ffffff',
    'ffffff - ffffff ffffff 0055a5 ffffff ffffff 0055a5',
  ],
  'mls-0': [
    'f7b5cd - f7b5cd f7b5cd 111111 111111 111111 f7b5cd',
    '111111 - 111111 111111 f7b5cd 111111 111111 f7b5cd',
  ],
  'mls-1': [
    '071b2c ch b19b69 071b2c b19b69 071b2c 071b2c b19b69',
    'ffffff - ffffff ffffff 071b2c ffffff ffffff 071b2c',
  ],
  'mls-2': [
    'ffffff - ffffff ffffff 12284c 12284c ffffff 12284c',
    '12284c - 12284c 12284c 8cc4e8 12284c 12284c 8cc4e8',
  ],
  'mls-3': [
    '111111 - 111111 111111 c39e6d 111111 111111 c39e6d',
    'ffffff - ffffff ffffff c39e6d ffffff ffffff c39e6d',
  ],
  'mls-4': [
    '0b1f41 - 0b1f41 0b1f41 00b2a9 0b1f41 0b1f41 00b2a9',
    'ffffff - ffffff ffffff 00b2a9 ffffff ffffff 0b1f41',
  ],
  'mls-5': [
    'f05323 - f05323 263b80 263b80 263b80 f05323 263b80',
    '263b80 - 263b80 263b80 f05323 263b80 263b80 f05323',
  ],
  'mls-6': [
    'fedd00 - fedd00 fedd00 111111 111111 fedd00 111111',
    '111111 - 111111 111111 fedd00 111111 111111 fedd00',
  ],
  'mls-7': [
    '5d9741 - 5d9741 5d9741 236192 236192 5d9741 236192',
    '236192 - 236192 236192 5d9741 236192 236192 5d9741',
  ],
  'mls-8': [
    '585958 - 585958 585958 8cd2f4 585958 585958 8cd2f4',
    '8cd2f4 - 8cd2f4 8cd2f4 585958 8cd2f4 8cd2f4 585958',
  ],
  'mls-9': [
    '1a85c8 - 1a85c8 1a85c8 111111 111111 1a85c8 111111',
    'ffffff - ffffff ffffff 1a85c8 ffffff ffffff 111111',
  ],
  'mls-10': [
    '6cace4 - 6cace4 6cace4 041e42 041e42 6cace4 041e42',
    '041e42 - 041e42 041e42 6cace4 041e42 041e42 6cace4',
  ],
  'mls-11': [
    'ece83a - ece83a ece83a 1f1646 1f1646 ece83a 1f1646',
    '1f1646 - 1f1646 1f1646 ece83a 1f1646 1f1646 ece83a',
  ],
  'mls-12': [
    '004812 - 004812 004812 d69a00 004812 004812 d69a00',
    'ffffff - ffffff ffffff 004812 ffffff ffffff 004812',
  ],
  'mls-13': [
    '00b140 - 00b140 00b140 111111 111111 00b140 111111',
    '111111 - 111111 111111 00b140 111111 111111 00b140',
  ],
  'mls-14': [
    '633492 - 633492 633492 fdd116 633492 633492 fdd116',
    'ffffff - ffffff ffffff 633492 ffffff ffffff 633492',
  ],
  'mls-15': [
    'c8102e - c8102e c8102e 0a174a c8102e c8102e 0a174a',
    '0a174a - 0a174a 0a174a c8102e 0a174a 0a174a c8102e',
  ],
  'mls-16': [
    'ffffff sash ed1e36 ffffff ed1e36 ffffff ffffff ed1e36',
    'ed1e36 - ed1e36 ed1e36 0a174a ed1e36 ed1e36 0a174a',
  ],
  'mls-17': [
    'b30838 - b30838 013a81 013a81 013a81 b30838 013a81',
    'ffffff - ffffff ffffff b30838 ffffff ffffff 013a81',
  ],
  'mls-18': [
    '0067b1 - 0067b1 0067b1 111111 111111 0067b1 111111',
    'ffffff - ffffff ffffff 0067b1 ffffff ffffff 0067b1',
  ],
  'mls-19': [
    '862633 - 862633 862633 8bb8e8 862633 862633 8bb8e8',
    '8bb8e8 - 8bb8e8 8bb8e8 862633 8bb8e8 8bb8e8 862633',
  ],
  'mls-20': [
    'ff6b00 - ff6b00 ff6b00 101820 101820 ff6b00 101820',
    'ffffff - ffffff ffffff ff6b00 ffffff ffffff ff6b00',
  ],
  'mls-21': [
    'ffffff - ffffff ffffff ffd200 00245d ffffff ffd200',
    '00245d - 00245d 00245d ffd200 00245d 00245d ffd200',
  ],
  'mls-22': [
    '80000a v 111111 80000a a19060 111111 111111 80000a',
    'ffffff - ffffff ffffff 80000a ffffff ffffff 111111',
  ],
  'mls-23': [
    'dd004a - dd004a dd004a 0a1e2c 0a1e2c dd004a 0a1e2c',
    '0a1e2c - 0a1e2c 0a1e2c dd004a 0a1e2c 0a1e2c dd004a',
  ],
  'mls-24': [
    '91b0d5 dz 002f65 91b0d5 002f65 002f65 91b0d5 002f65',
    '002f65 - 002f65 002f65 91b0d5 002f65 002f65 91b0d5',
  ],
  'mls-25': [
    '111111 - 111111 111111 ef3e42 111111 111111 ef3e42',
    'ffffff - ffffff ffffff ef3e42 ffffff ffffff 111111',
  ],
  'mls-26': [
    '0033a1 - 0033a1 0033a1 111111 0033a1 0033a1 111111',
    'ffffff - ffffff ffffff 0033a1 ffffff ffffff 0033a1',
  ],
  'mls-27': [
    'b81137 - b81137 b81137 455560 b81137 b81137 455560',
    'ffffff - ffffff ffffff b81137 ffffff ffffff 455560',
  ],
  'mls-28': [
    '0a2240 - 0a2240 0a2240 ce0e2d 0a2240 0a2240 ce0e2d',
    'ffffff - ffffff ffffff 0a2240 ffffff ffffff ce0e2d',
  ],
  'mls-29': [
    'e81f3e h 2a4076 e81f3e 2a4076 2a4076 e81f3e 2a4076',
    'ffffff - ffffff ffffff 2a4076 ffffff ffffff e81f3e',
  ],
  'ere-0': [
    'ffffff band d2122e ffffff d2122e ffffff ffffff d2122e',
    '1b2a4e - 1b2a4e 1b2a4e d2122e 1b2a4e 1b2a4e d2122e',
  ],
  'ere-1': [
    'e30613 v ffffff e30613 ffffff ffffff e30613 ffffff',
    '1a1a2e - 1a1a2e 1a1a2e ed1c24 1a1a2e 1a1a2e ed1c24',
  ],
  'ere-2': [
    'e30613 half ffffff e30613 111111 111111 111111 e30613',
    '111111 - 111111 111111 e30613 111111 111111 e30613',
  ],
  'ere-3': [
    'e30613 - e30613 e30613 ffffff ffffff e30613 ffffff',
    'ffffff - ffffff ffffff e30613 ffffff ffffff e30613',
  ],
  'ere-4': [
    'e30613 - e30613 e30613 ffffff e30613 e30613 ffffff',
    'ffffff - ffffff ffffff e30613 ffffff ffffff e30613',
  ],
  'ere-5': [
    'e30613 - e30613 e30613 ffffff ffffff e30613 ffffff',
    'ffffff - ffffff ffffff e30613 ffffff ffffff e30613',
  ],
  'ere-6': [
    'e30613 half ffd200 e30613 ffd200 e30613 e30613 ffd200',
    '1b1b1b - 1b1b1b 1b1b1b ffd200 111111 111111 ffd200',
  ],
  'ere-7': [
    'e30613 tri 00843d e30613 111111 111111 111111 00843d 111111',
    'ffffff - ffffff ffffff 00843d ffffff ffffff 00843d',
  ],
  'ere-8': [
    '0057b8 v ffffff 0057b8 ffffff ffffff 0057b8 ffffff',
    'ffffff - ffffff ffffff 0057b8 0057b8 0057b8 ffffff',
  ],
  'ere-9': [
    'e30613 v ffffff e30613 ffffff 111111 e30613 ffffff',
    '111111 - 111111 111111 e30613 111111 111111 e30613',
  ],
  'ere-10': [
    '0065b3 - 0065b3 0065b3 ffffff ffffff 0065b3 ffffff',
    'ffffff - ffffff ffffff 0065b3 0065b3 0065b3 ffffff',
  ],
  'ere-11': [
    '00843d - 00843d 00843d ffffff ffffff 00843d ffffff',
    'ffffff - ffffff ffffff 00843d ffffff ffffff 00843d',
  ],
  'ere-12': [
    'ffd200 - ffd200 ffd200 00843d 00843d ffd200 00843d',
    '00843d - 00843d 00843d ffd200 00843d 00843d ffd200',
  ],
  'ere-13': [
    'ffd200 - ffd200 ffd200 111111 111111 ffd200 111111',
    '111111 - 111111 111111 ffd200 111111 111111 ffd200',
  ],
  'ere-14': [
    'ffffff v 111111 ffffff 111111 111111 111111 ffffff',
    '111111 - 111111 111111 ffffff 111111 111111 ffffff',
  ],
  'ere-15': [
    'e30613 half 111111 e30613 111111 111111 111111 e30613',
    'ffffff - ffffff ffffff e30613 ffffff ffffff e30613',
  ],
  'ere-16': [
    'ffffff - ffffff ffffff 0a3a6e 0a3a6e ffffff 0a3a6e',
    '0a3a6e - 0a3a6e 0a3a6e ffffff 0a3a6e 0a3a6e ffffff',
  ],
  'ere-17': [
    'f7941d - f7941d f7941d ffffff ffffff f7941d ffffff',
    '111111 - 111111 111111 f7941d 111111 111111 f7941d',
  ],
  'l1-0': [
    '004170 band da291c 004170 ffffff 004170 004170 ffffff',
    'ffffff - ffffff ffffff 004170 ffffff ffffff 004170',
  ],
  'l1-1': [
    'ffffff - ffffff ffffff 2faee0 ffffff ffffff 2faee0',
    '0d1b3a - 0d1b3a 0d1b3a 2faee0 0d1b3a 0d1b3a 2faee0',
  ],
  'l1-2': [
    'e30613 half ffffff e30613 ffffff ffffff e30613 ffffff',
    '1b1b1b - 1b1b1b 1b1b1b e30613 111111 111111 e30613',
  ],
  'l1-3': [
    'e01e13 - e01e13 e01e13 16284c 16284c e01e13 16284c',
    '16284c - 16284c 16284c e01e13 16284c 16284c e01e13',
  ],
  'l1-4': [
    'ffffff - ffffff ffffff 1c3f94 ffffff ffffff da291c',
    '1c3f94 - 1c3f94 1c3f94 da291c 1c3f94 1c3f94 da291c',
  ],
  'l1-5': [
    'e30613 v 111111 e30613 111111 111111 111111 e30613',
    'ffffff - ffffff ffffff 111111 111111 111111 e30613',
  ],
  'l1-6': [
    'ffd100 - ffd100 ffd100 e30613 e30613 ffd100 e30613',
    '111111 - 111111 111111 ffd100 111111 111111 ffd100',
  ],
  'l1-7': [
    'e30613 - e30613 111111 111111 111111 e30613 111111',
    'ffffff - ffffff ffffff e30613 ffffff ffffff e30613',
  ],
  'l1-8': [
    '009fe3 - 009fe3 009fe3 ffffff ffffff 009fe3 ffffff',
    'ffffff - ffffff ffffff 009fe3 ffffff ffffff 009fe3',
  ],
  'l1-9': [
    '5b2c86 - 5b2c86 5b2c86 ffffff ffffff 5b2c86 ffffff',
    'ffffff - ffffff ffffff 5b2c86 ffffff ffffff 5b2c86',
  ],
  'l1-10': [
    'e30613 - e30613 e30613 ffffff ffffff e30613 ffffff',
    'ffffff - ffffff ffffff e30613 ffffff ffffff e30613',
  ],
  'l1-11': [
    'ffe600 - ffe600 ffe600 00843d 00843d ffe600 00843d',
    '00843d - 00843d 00843d ffe600 00843d 00843d ffe600',
  ],
  'l1-12': [
    '1b2a4e - 1b2a4e 1b2a4e 7fb2e5 1b2a4e 1b2a4e 7fb2e5',
    '7fb2e5 - 7fb2e5 7fb2e5 1b2a4e 7fb2e5 7fb2e5 1b2a4e',
  ],
  'l1-13': [
    'ffffff - ffffff ffffff 0055a5 ffffff ffffff 0055a5',
    '0055a5 - 0055a5 0055a5 ffffff 0055a5 0055a5 ffffff',
  ],
  'l1-14': [
    'ffffff v 111111 ffffff 111111 111111 111111 ffffff',
    '111111 - 111111 111111 ffffff 111111 111111 ffffff',
  ],
  'l1-15': [
    '7fb2e5 - 7fb2e5 7fb2e5 0a2a5b 0a2a5b 7fb2e5 0a2a5b',
    '0a2a5b - 0a2a5b 0a2a5b 7fb2e5 0a2a5b 0a2a5b 7fb2e5',
  ],
  'l1-16': [
    'f58220 - f58220 f58220 111111 111111 f58220 111111',
    '111111 - 111111 111111 f58220 111111 111111 f58220',
  ],
  'l1-17': [
    '7b1e2e - 7b1e2e 7b1e2e ffffff ffffff 7b1e2e ffffff',
    'ffffff - ffffff ffffff 7b1e2e ffffff ffffff 7b1e2e',
  ],
  'bl-0': [
    'dc052d - dc052d dc052d ffffff ffffff dc052d ffffff',
    '1b1b1b - 1b1b1b 1b1b1b dc052d 1b1b1b 1b1b1b dc052d',
  ],
  'bl-1': [
    'fde100 - fde100 fde100 111111 111111 fde100 111111',
    '111111 - 111111 111111 fde100 111111 111111 fde100',
  ],
  'bl-2': [
    'e32221 - e32221 111111 111111 111111 e32221 111111',
    'ffffff - ffffff ffffff e32221 ffffff ffffff e32221',
  ],
  'bl-3': [
    'ffffff - ffffff ffffff dd0741 ffffff ffffff dd0741',
    '0c2043 - 0c2043 0c2043 dd0741 0c2043 0c2043 dd0741',
  ],
  'bl-4': [
    '111111 - 111111 111111 e1000f 111111 111111 e1000f',
    'ffffff - ffffff ffffff 111111 ffffff ffffff e1000f',
  ],
  'bl-5': [
    'ffffff hoop e32219 ffffff e32219 ffffff ffffff e32219',
    'e32219 - e32219 e32219 ffffff e32219 e32219 ffffff',
  ],
  'bl-6': [
    '111111 - 111111 111111 e2001a 111111 111111 e2001a',
    'ffffff - ffffff ffffff e2001a ffffff ffffff e2001a',
  ],
  'bl-7': [
    '65b32e - 65b32e 65b32e ffffff ffffff 65b32e ffffff',
    'ffffff - ffffff ffffff 65b32e ffffff ffffff 65b32e',
  ],
  'bl-8': [
    'ffffff - ffffff ffffff 00843d 111111 ffffff 00843d',
    '111111 - 111111 111111 00843d 111111 111111 00843d',
  ],
  'bl-9': [
    'c3141e - c3141e c3141e ffffff ffffff c3141e ffffff',
    'ffffff - ffffff ffffff c3141e ffffff ffffff c3141e',
  ],
  'bl-10': [
    'd4011d - d4011d d4011d ffd200 ffffff d4011d ffd200',
    'ffffff - ffffff ffffff d4011d ffffff ffffff d4011d',
  ],
  'bl-11': [
    '1d9053 - 1d9053 1d9053 ffffff ffffff 1d9053 ffffff',
    'ffffff - ffffff ffffff 1d9053 ffffff ffffff 1d9053',
  ],
  'bl-12': [
    '1961b5 - 1961b5 1961b5 ffffff 1961b5 1961b5 ffffff',
    'ffffff - ffffff ffffff 1961b5 ffffff ffffff 1961b5',
  ],
  'bl-13': [
    'ba3733 tri 46714d ba3733 ffffff ffffff ba3733 ffffff ffffff',
    'ffffff - ffffff ffffff ba3733 ffffff ffffff 46714d',
  ],
  'bl-14': [
    'ffffff - ffffff ffffff 0a3f86 d0021b 0a3f86 d0021b',
    '0a3f86 - 0a3f86 0a3f86 ffffff 0a3f86 0a3f86 ffffff',
  ],
  'bl-15': [
    'ffffff - ffffff ffffff ed1c24 ed1c24 ffffff ed1c24',
    'ed1c24 - ed1c24 ed1c24 ffffff ed1c24 ed1c24 ffffff',
  ],
  'bl-16': [
    '5c3a21 - 5c3a21 5c3a21 ffffff 5c3a21 5c3a21 ffffff',
    'ffffff - ffffff ffffff 5c3a21 ffffff ffffff 5c3a21',
  ],
  'bl-17': [
    'e2001a v 003b79 e2001a 003b79 003b79 e2001a 003b79',
    'ffffff - ffffff ffffff 003b79 ffffff ffffff e2001a',
  ],
  'sa-0': [
    '0a4c9a v 111111 0a4c9a d4af37 111111 111111 0a4c9a',
    'ffffff - ffffff ffffff 0a4c9a ffffff ffffff 0a4c9a',
  ],
  'sa-1': [
    'ffffff v 111111 ffffff 111111 111111 ffffff 111111',
    '111111 - 111111 111111 d4af37 111111 111111 d4af37',
  ],
  'sa-2': [
    '12a0d7 - 12a0d7 12a0d7 ffffff ffffff 12a0d7 ffffff',
    'ffffff - ffffff ffffff 12a0d7 ffffff ffffff 12a0d7',
  ],
  'sa-3': [
    'e2001a v 111111 e2001a 111111 ffffff 111111 e2001a',
    'ffffff - ffffff ffffff e2001a ffffff ffffff e2001a',
  ],
  'sa-4': [
    '111111 v 1e71b8 111111 1e71b8 111111 111111 1e71b8',
    'ffffff - ffffff ffffff 1e71b8 ffffff ffffff 1e71b8',
  ],
  'sa-5': [
    '8e1f2f - 8e1f2f 8e1f2f f0bc42 ffffff 8e1f2f f0bc42',
    'ffffff - ffffff ffffff 8e1f2f ffffff ffffff f0bc42',
  ],
  'sa-6': [
    '87d8f7 - 87d8f7 87d8f7 ffffff ffffff ffffff 87d8f7',
    'ffffff - ffffff ffffff 87d8f7 ffffff ffffff 87d8f7',
  ],
  'sa-7': [
    '002f6c - 002f6c 002f6c ffffff 002f6c 002f6c ffffff',
    'ffffff - ffffff ffffff 002f6c ffffff ffffff 002f6c',
  ],
  'sa-8': [
    'c8102e v 1a2f48 c8102e ffffff ffffff 1a2f48 c8102e',
    'ffffff - ffffff ffffff c8102e ffffff ffffff 1a2f48',
  ],
  'sa-9': [
    '4b2884 - 4b2884 4b2884 ffffff 4b2884 4b2884 ffffff',
    'ffffff - ffffff ffffff 4b2884 ffffff ffffff 4b2884',
  ],
  'sa-10': [
    '881f19 - 881f19 881f19 ffffff 881f19 881f19 ffffff',
    'ffffff - ffffff ffffff 881f19 ffffff ffffff 881f19',
  ],
  'sa-11': [
    'ffffff v 111111 ffffff 111111 111111 111111 ffffff',
    'f4d03f - f4d03f f4d03f 111111 111111 f4d03f 111111',
  ],
  'sa-12': [
    'b1102b half 1a2f5a b1102b ffffff 1a2f5a 1a2f5a b1102b',
    'ffffff - ffffff ffffff 1a2f5a ffffff ffffff b1102b',
  ],
  'sa-13': [
    'ffffff cr 111111 ffffff 111111 ffffff ffffff 111111',
    'ffd200 - ffd200 ffd200 111111 ffd200 ffd200 111111',
  ],
  'sa-14': [
    'b1102b v 0a2a5b b1102b ffffff 0a2a5b 0a2a5b b1102b',
    'ffffff - ffffff ffffff 0a2a5b ffffff ffffff b1102b',
  ],
  'sa-15': [
    '00a651 v 111111 00a651 111111 111111 00a651 111111',
    'ffffff - ffffff ffffff 00a651 ffffff ffffff 111111',
  ],
  'sa-16': [
    'ffd200 v e2001a ffd200 e2001a e2001a ffd200 e2001a',
    '111111 - 111111 111111 ffd200 111111 111111 ffd200',
  ],
  'sa-17': [
    '00338d - 00338d 00338d ffd200 00338d 00338d ffd200',
    'ffd200 - ffd200 ffd200 00338d 00338d ffd200 00338d',
  ],
  'sa-18': [
    'a5a5a5 v e2001a a5a5a5 e2001a e2001a e2001a a5a5a5',
    '111111 - 111111 111111 e2001a 111111 111111 e2001a',
  ],
  'sa-19': [
    '111111 v 0e3b83 111111 0e3b83 111111 111111 0e3b83',
    'ffffff - ffffff ffffff 0e3b83 ffffff ffffff 0e3b83',
  ],
  'll-0': [
    'ffffff - ffffff ffffff 2a2a5a ffffff ffffff ffffff',
    '1c1c1c - 1c1c1c 1c1c1c d4af37 1c1c1c 1c1c1c d4af37',
  ],
  'll-1': [
    'a50044 v 004d98 004d98 edbb00 004d98 004d98 a50044',
    '111111 - 111111 111111 edbb00 111111 111111 edbb00',
  ],
  'll-2': [
    'cb3524 v ffffff 272e61 272e61 272e61 272e61 cb3524',
    '1b2452 - 1b2452 1b2452 cb3524 1b2452 1b2452 cb3524',
  ],
  'll-3': [
    'ee2523 v ffffff ffffff 111111 111111 ee2523 ffffff',
    '111111 - 111111 111111 ee2523 111111 111111 ee2523',
  ],
  'll-4': [
    'ffe51b - ffe51b ffe51b 005187 005187 ffe51b 005187',
    '0b2a4a - 0b2a4a 0b2a4a ffe51b 0b2a4a 0b2a4a ffe51b',
  ],
  'll-5': [
    'ffffff - ffffff ffffff d71a28 ffffff ffffff d71a28',
    'd71a28 - d71a28 d71a28 ffffff d71a28 d71a28 ffffff',
  ],
  'll-6': [
    'ffffff v 0067b1 ffffff 0067b1 0067b1 0067b1 ffffff',
    '1a1a1a - 1a1a1a 1a1a1a 0067b1 1a1a1a 1a1a1a 0067b1',
  ],
  'll-7': [
    'ffffff v 0bb363 ffffff 0bb363 ffffff ffffff 0bb363',
    '111111 - 111111 111111 0bb363 111111 111111 0bb363',
  ],
  'll-8': [
    '8ac3ee - 8ac3ee 8ac3ee e2001a 8ac3ee 8ac3ee e2001a',
    '0d1b3e - 0d1b3e 0d1b3e 8ac3ee 0d1b3e 0d1b3e 8ac3ee',
  ],
  'll-9': [
    'ffffff - ffffff ffffff 111111 111111 111111 ee3524',
    '111111 - 111111 111111 f08a00 111111 111111 f08a00',
  ],
  'll-10': [
    'd91a21 - d91a21 d91a21 0a346f 0a346f 0a346f d91a21',
    '0a2d63 - 0a2d63 0a2d63 d91a21 0a2d63 0a2d63 d91a21',
  ],
  'll-11': [
    'ffffff sash e53027 ffffff e53027 ffffff ffffff e53027',
    '111111 sash e53027 111111 e53027 111111 111111 e53027',
  ],
  'll-12': [
    '005999 - 005999 005999 ffffff 005999 005999 ffffff',
    'f08a1c - f08a1c f08a1c 005999 f08a1c f08a1c 005999',
  ],
  'll-13': [
    'ffffff v cd2534 ffffff cd2534 1b2a5a cd2534 ffffff',
    '1b2a5a - 1b2a5a 1b2a5a cd2534 1b2a5a 1b2a5a cd2534',
  ],
  'll-14': [
    '007fc8 v ffffff 007fc8 ffffff ffffff 007fc8 ffffff',
    'd9202a - d9202a d9202a ffffff d9202a d9202a ffffff',
  ],
  'll-15': [
    'e20613 - e20613 e20613 111111 111111 e20613 111111',
    '111111 - 111111 111111 e20613 111111 111111 e20613',
  ],
  'll-16': [
    '0761af v ffffff 0761af ffffff 0761af 0761af ffffff',
    'f5a800 - f5a800 f5a800 0761af f5a800 f5a800 0761af',
  ],
  'll-17': [
    'ffffff sash 05642c ffffff 05642c ffffff ffffff 05642c',
    '05642c - 05642c 05642c ffffff 05642c 05642c ffffff',
  ],
  'll-18': [
    'b4053f v 004d98 004d98 004d98 004d98 b4053f 004d98',
    '111111 - 111111 111111 b4053f 111111 111111 b4053f',
  ],
  'll-19': [
    '0055a5 - 0055a5 0055a5 ffffff ffffff 0055a5 ffffff',
    'ffffff - ffffff ffffff 0055a5 ffffff ffffff 0055a5',
  ],
  'pl-0': [
    '6cabdd - 6cabdd 6cabdd ffffff ffffff 6cabdd ffffff',
    '151515 - 151515 151515 6cabdd 151515 151515 6cabdd',
  ],
  'pl-1': [
    'c8102e - c8102e c8102e ffffff c8102e c8102e ffffff',
    '0e6655 - 0e6655 0e6655 d4e157 0e6655 0e6655 d4e157',
  ],
  'pl-2': [
    'ef0107 - ef0107 ffffff ffffff ffffff ef0107 ffffff',
    'f2d231 - f2d231 0f2a52 0f2a52 0f2a52 f2d231 0f2a52',
  ],
  'pl-3': [
    '034694 - 034694 034694 ffffff 034694 034694 ffffff',
    'ffffff - ffffff ffffff 034694 ffffff ffffff 034694',
  ],
  'pl-4': [
    'da291c - da291c da291c 111111 ffffff 111111 da291c',
    'ffffff - ffffff ffffff 111111 111111 ffffff 111111',
  ],
  'pl-5': [
    'ffffff - ffffff ffffff 132257 132257 132257 ffffff',
    '132257 - 132257 132257 d6ff00 132257 132257 d6ff00',
  ],
  'pl-6': [
    'ffffff v 111111 ffffff 111111 111111 111111 ffffff',
    'f7e000 - f7e000 f7e000 111111 111111 f7e000 111111',
  ],
  'pl-7': [
    '670e36 - 670e36 95bfe5 95bfe5 ffffff 95bfe5 670e36',
    'ffffff - ffffff ffffff 95bfe5 670e36 670e36 95bfe5',
  ],
  'pl-8': [
    '0057b8 v ffffff 0057b8 ffffff ffffff ffffff 0057b8',
    '111111 - 111111 111111 0057b8 111111 111111 0057b8',
  ],
  'pl-9': [
    'dd0000 - dd0000 dd0000 ffffff ffffff dd0000 ffffff',
    '1a2a5a - 1a2a5a 1a2a5a dd0000 1a2a5a 1a2a5a dd0000',
  ],
  'pl-10': [
    'e30613 v ffffff ffffff 111111 111111 ffffff e30613',
    '14213d - 14213d 14213d e30613 14213d 14213d e30613',
  ],
  'pl-11': [
    '1b458f v c4122e 1b458f c4122e 1b458f 1b458f c4122e',
    'ffffff - ffffff ffffff 1b458f ffffff ffffff c4122e',
  ],
  'pl-12': [
    'da291c v 111111 111111 111111 111111 da291c 111111',
    'ffffff - ffffff ffffff da291c ffffff ffffff da291c',
  ],
  'pl-13': [
    'ffffff - ffffff ffffff 111111 111111 ffffff 111111',
    '111111 - 111111 111111 ffffff 111111 111111 ffffff',
  ],
  'pl-14': [
    '003399 - 003399 003399 ffffff ffffff 003399 ffffff',
    'ffe000 - ffe000 ffe000 003399 ffe000 ffe000 003399',
  ],
  'pl-15': [
    '7a263a - 7a263a 1bb1e7 1bb1e7 ffffff 7a263a 1bb1e7',
    '1bb1e7 - 1bb1e7 1bb1e7 7a263a 1bb1e7 1bb1e7 7a263a',
  ],
  'pl-16': [
    'fdb913 - fdb913 fdb913 111111 111111 fdb913 111111',
    '111111 - 111111 111111 fdb913 111111 111111 fdb913',
  ],
  'pl-17': [
    'ffffff - ffffff ffffff 1d428a ffffff ffffff ffcc00',
    '1d428a - 1d428a 1d428a ffcc00 1d428a 1d428a ffcc00',
  ],
  'pl-18': [
    'ffffff v eb172b 111111 111111 111111 eb172b ffffff',
    '111111 - 111111 111111 eb172b 111111 111111 eb172b',
  ],
  'pl-19': [
    '6c1d45 - 6c1d45 99d6ea 99d6ea ffffff 6c1d45 99d6ea',
    '99d6ea - 99d6ea 99d6ea 6c1d45 99d6ea 99d6ea 6c1d45',
  ],
  sangmu: [
    'c8102e - c8102e c8102e 1f4d2b 1f4d2b c8102e 1f4d2b',
    '1f4d2b - 1f4d2b 1f4d2b ffd400 1f4d2b 1f4d2b ffd400',
  ],
};
