import React from 'react';
import '@testing-library/jest-dom';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import Landing from './Landing';
import { useAuth } from '../../context/AuthContext';
jest.mock('../../context/AuthContext', () => ({ useAuth: jest.fn() }));
jest.mock('../../context/ThemeContext', () => ({ useTheme: () => ({ theme: 'dark', toggleTheme: jest.fn() }) }));
jest.mock('framer-motion', () => {
  const React = require('react');
  return {
  motion: {
    div: ({ children, style, initial, animate, transition, ...props }) => <div {...props}>{children}</div>,
    h1: ({ children, initial, animate, transition, ...props }) => <h1 {...props}>{children}</h1>,
    p: ({ children, initial, animate, transition, ...props }) => <p {...props}>{children}</p>,
    button: ({ children, initial, animate, transition, whileHover, whileTap, ...props }) => <button {...props}>{children}</button>,
    path: ({ style, ...props }) => <path {...props}/>,
    g: ({ children, style, ...props }) => <g {...props}>{children}</g>,
  },
  useScroll: () => ({ scrollYProgress: { on: () => () => {} } }),
  useTransform: () => 0,
  useReducedMotion: () => true,
  useInView: () => true,
  };
});
const show = (user = null) => {
  useAuth.mockReturnValue({ user });
  return render(<MemoryRouter><Landing /></MemoryRouter>);
};
test('public entry points keep the existing authentication destinations', () => {
  show();
  expect(screen.getByRole('link', { name: /get started/i })).toHaveAttribute('href', '/signup');
  expect(screen.getAllByRole('link', { name: /sign in/i }).every(link => link.getAttribute('href') === '/login')).toBe(true);
});
test('authenticated users can open the existing dashboard', () => {
  show({ id: 1 });
  expect(screen.getAllByRole('link', { name: /open dashboard/i }).every(link => link.getAttribute('href') === '/dashboard')).toBe(true);
});
test('every local navigation anchor resolves to a scene', () => {
  const { container } = show();
  container.querySelectorAll('a[href^="#"]').forEach(link => {
    expect(container.querySelector(link.getAttribute('href'))).not.toBeNull();
  });
});
test('illustrations do not claim live metrics or an autonomous swarm', () => {
  show();
  expect(screen.getByText(/does not represent an autonomous AI swarm/i)).toBeInTheDocument();
  expect(screen.getByText(/Actual dashboard component, shown in its empty state/i)).toBeInTheDocument();
});
