import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { Disclosure } from './Disclosure.js';

describe('Disclosure', () => {
  it('renders collapsed by default with the summary visible and content hidden', () => {
    render(
      <Disclosure summary="프로필 복구">
        <p>복구 폼</p>
      </Disclosure>,
    );

    expect(screen.getByText('프로필 복구')).toBeInTheDocument();
    expect(screen.getByText('복구 폼')).not.toBeVisible();
  });

  it('opens on click and reveals the content', async () => {
    const user = userEvent.setup();
    render(
      <Disclosure summary="프로필 복구">
        <p>복구 폼</p>
      </Disclosure>,
    );

    await user.click(screen.getByText('프로필 복구'));

    expect(screen.getByText('복구 폼')).toBeVisible();
  });
});
