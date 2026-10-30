import { describe, expect, it } from 'vitest';
import { businessCheckUrl, parseBusinessInfo } from './businessInfo';

const full = {
  name: 'Offside Lab',
  owner: 'Hong',
  regNo: '000-00-00000',
  mailOrderNo: 'no-1',
  address: 'addr',
  phone: '010',
};

describe('parseBusinessInfo (T-11-589)', () => {
  it('칸이 모두 있으면 다듬어 돌려준다', () => {
    expect(parseBusinessInfo(JSON.stringify({ ...full, name: ' Offside Lab ' }))).toEqual(full);
  });
  it('비었거나 깨졌거나 칸이 빠지면 null', () => {
    expect(parseBusinessInfo(undefined)).toBeNull();
    expect(parseBusinessInfo('')).toBeNull();
    expect(parseBusinessInfo('{')).toBeNull();
    expect(parseBusinessInfo(JSON.stringify({ ...full, mailOrderNo: '' }))).toBeNull();
  });
  it('공정위 조회 주소는 숫자만 쓴다', () => {
    expect(businessCheckUrl('000-00-00000')).toBe(
      'https://www.ftc.go.kr/bizCommPop.do?wrkr_no=0000000000',
    );
  });
});
