import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Button } from './Button.js';

describe('Button', () => {
  it('has a 44px minimum touch target (DSN-SPC-001 --os-touch-min)', () => {
    render(<Button>확인</Button>);
    const button = screen.getByRole('button', { name: '확인' });

    expect(button).toHaveStyle({ minHeight: 'var(--os-touch-min)', minWidth: 'var(--os-touch-min)' });
  });
});
