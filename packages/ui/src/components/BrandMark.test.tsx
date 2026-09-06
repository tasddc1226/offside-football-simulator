import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { BrandMark } from './BrandMark.js';

describe('BrandMark', () => {
  it('uses the optimized approved flag asset without adding redundant alt text', () => {
    const { container } = render(<BrandMark />);
    const mark = container.querySelector('img');
    expect(mark).not.toBeNull();
    expect(mark).toHaveAttribute('src', '/brand/offside-flag-v5-64.png');
    expect(mark).toHaveAttribute('aria-hidden', 'true');
    expect(mark).toHaveAttribute('width', '32');
    expect(mark).toHaveAttribute('height', '32');
  });
});
