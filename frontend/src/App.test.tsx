import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import App from './App';

describe('App', () => {
  it('shows login when no token is stored', () => {
    localStorage.clear();
    render(<App />);
    expect(screen.getByText('轉盤後控')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /登\s*入/ })).toBeInTheDocument();
  });
});
