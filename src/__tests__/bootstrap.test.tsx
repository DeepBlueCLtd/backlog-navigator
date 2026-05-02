import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { App } from '../App';

describe('bootstrap App', () => {
  it('renders the navigator banner', () => {
    render(<App />);
    expect(screen.getByTestId('app-shell')).toBeTruthy();
    expect(screen.getByText(/Backlog Navigator/i)).toBeTruthy();
  });
});
