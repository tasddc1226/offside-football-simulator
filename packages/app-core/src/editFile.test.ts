import { describe, expect, it } from 'vitest';
import { editFileErrorText, readEditFile } from './editFile.js';

const clubs = JSON.stringify({ v: 1, clubs: { 'kr-1': { name: '예쁜말 FC' } } }, null, 1);
const names = JSON.stringify({ v: 1, names: { K리그1: '한국 리그' }, icons: {} }, null, 1);

describe('T-11-729 에디트 파일 읽기', () => {
  it('내보낸 그대로의 파일을 읽는다', () => {
    expect(readEditFile(clubs, 'clubs')).toEqual({ ok: true, data: JSON.parse(clubs) });
    expect(readEditFile(names, 'names')).toEqual({ ok: true, data: JSON.parse(names) });
  });

  it('붙여넣을 때 섞인 BOM · 앞뒤 글 · 둥근 따옴표를 걸러 읽는다', () => {
    expect(readEditFile(`﻿${clubs}`, 'clubs').ok).toBe(true);
    expect(readEditFile(`offside-clubs.json\n${clubs}\n공유합니다`, 'clubs').ok).toBe(true);
    const smart = clubs.replace(/"/g, (_, i: number) => (i % 2 ? '”' : '“'));
    expect(readEditFile(smart, 'clubs')).toMatchObject({
      ok: true,
      data: { clubs: { 'kr-1': { name: '예쁜말 FC' } } },
    });
  });

  it('옛 형식(감싸지 않은 구단 표)도 구단 파일로 읽는다', () => {
    expect(readEditFile('{"kr-1":{"name":"A"}}', 'clubs')).toEqual({
      ok: true,
      data: { clubs: { 'kr-1': { name: 'A' } } },
    });
  });

  it('무엇이 틀렸는지 나눠 알린다', () => {
    expect(readEditFile('  ', 'clubs')).toEqual({ ok: false, reason: 'empty' });
    expect(readEditFile('https://drive.google.com/file/d/abc/view', 'clubs')).toEqual({
      ok: false,
      reason: 'link',
    });
    expect(readEditFile('offside-clubs.json', 'clubs')).toEqual({ ok: false, reason: 'notFile' });
    expect(readEditFile(clubs.slice(0, 30), 'clubs')).toEqual({ ok: false, reason: 'cut' });
    expect(readEditFile('{"a": 1,, }', 'clubs')).toEqual({ ok: false, reason: 'notFile' });
    expect(readEditFile('[1,2]', 'clubs')).toEqual({ ok: false, reason: 'notFile' });
    expect(readEditFile('{}', 'names')).toEqual({ ok: false, reason: 'notFile' });
  });

  it('다른 종류의 파일은 막고 어느 설정에서 가져오는지 알린다', () => {
    expect(readEditFile(names, 'clubs')).toEqual({ ok: false, reason: 'wrongKind' });
    expect(readEditFile(clubs, 'names')).toEqual({ ok: false, reason: 'wrongKind' });
    expect(editFileErrorText('wrongKind', 'clubs')).toContain('대회 · 수상 · 리그 이름 파일');
    expect(editFileErrorText('wrongKind', 'names')).toContain('구단 이름 · 엠블럼 파일');
    expect(editFileErrorText('cut', 'clubs')).toContain('잘렸어요');
  });
});
