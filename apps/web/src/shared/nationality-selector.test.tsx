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
    expect(screen.queryByRole('option', { name: '대한민국' })).not.toBeInTheDocument();
    await user.selectOptions(select, 'JP');
    expect(onChange).toHaveBeenCalledWith('JP');
  });
});
