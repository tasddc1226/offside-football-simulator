import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { TeamBadge } from './TeamBadge.js';

describe('TeamBadge', () => {
  it('renders the initials as decorative markup, sized by the size prop', () => {
    const { container, rerender } = render(
      <TeamBadge initials="한강" colorVar="var(--os-team-hangang-u18)" size="s" />,
    );
    const badge = container.querySelector('span');
    expect(badge).not.toBeNull();
    expect(badge).toHaveAttribute('aria-hidden', 'true');
    expect(badge).toHaveAttribute('data-size', 's');
    expect(badge).toHaveTextContent('한강');
    expect(badge).toHaveStyle({ background: 'var(--os-team-hangang-u18)' });

    rerender(<TeamBadge initials="온새" colorVar="var(--os-neutral)" />);
    expect(container.querySelector('span')).toHaveAttribute('data-size', 'm');
  });
});
