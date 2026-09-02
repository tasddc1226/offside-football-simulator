import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { App } from './App.js';

describe('App', () => {
  it('renders the OFFSIDE title', () => {
    render(<App />);
    expect(screen.getByRole('heading', { name: 'OFFSIDE' })).toBeInTheDocument();
  });
});
