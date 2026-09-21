import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { NationalitySelector } from './nationality-selector.js';

describe('NationalitySelector (#161/#162)', () => {
  it('keeps Korea first and filters by code/name without changing the selected value', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(
      <NationalitySelector
        options={[
          { code: 'US', name: '미국' },
          { code: 'KR', name: '대한민국' },
          { code: 'JP', name: '일본' },
        ]}
        value="KR"
        onChange={onChange}
      />,
    );

    const select = screen.getByRole('combobox', { name: '국적' });
    expect(select).toHaveValue('KR');
    expect(select.querySelector('option')?.textContent).toBe('대한민국');

    await user.type(screen.getByRole('searchbox', { name: '국적 검색' }), 'JP');
    expect(screen.getByRole('option', { name: '일본' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: '대한민국 (현재 선택)' })).toBeInTheDocument();
    expect(select).toHaveValue('KR');
    await user.selectOptions(select, 'JP');
    expect(onChange).toHaveBeenCalledWith('JP');
  });

  it('keeps the selected value visible and reports empty searches without changing it', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(
      <NationalitySelector
        options={[{ code: 'KR', name: '대한민국' }, { code: 'BR', name: '브라질' }]}
        value="KR"
        onChange={onChange}
      />,
    );

    const search = screen.getByRole('searchbox', { name: '국적 검색' });
    const select = screen.getByRole('combobox', { name: '국적' });
    await user.type(search, '없는나라');
    expect(screen.getByRole('status')).toHaveTextContent('검색 결과가 없습니다');
    expect(screen.getByRole('option', { name: '대한민국 (현재 선택)' })).toBeInTheDocument();
    expect(select).toHaveValue('KR');
    expect(onChange).not.toHaveBeenCalled();
  });
});
