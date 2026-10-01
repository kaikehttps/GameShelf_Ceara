import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { ApiError } from '../api/client';
import { DEMO_USER, renderWithProviders } from '../test/render';
import { LoginPage } from './LoginPage';

describe('LoginPage', () => {
  it('"Usar conta demo" preenche o formulário e o login usa esses dados', async () => {
    const login = vi.fn(() => Promise.resolve());
    renderWithProviders(<LoginPage mode="login" />, { route: '/entrar', auth: { login } });

    await userEvent.click(screen.getByRole('button', { name: 'Usar conta demo' }));
    await userEvent.click(screen.getByRole('button', { name: 'Entrar' }));

    expect(login).toHaveBeenCalledWith('demo@gameshelf.dev', 'demo-password-123');
  });

  it('mostra a mensagem da API quando as credenciais estão erradas', async () => {
    const login = vi.fn(() => Promise.reject(new ApiError(401, 'E-mail ou senha inválidos')));
    renderWithProviders(<LoginPage mode="login" />, { route: '/entrar', auth: { login } });

    await userEvent.type(screen.getByLabelText('E-mail'), 'ana@example.com');
    await userEvent.type(screen.getByLabelText('Senha'), 'senha-errada');
    await userEvent.click(screen.getByRole('button', { name: 'Entrar' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('E-mail ou senha inválidos');
  });

  it('com sessão ativa, segue para o endereço de ?next=', () => {
    renderWithProviders(<LoginPage mode="login" />, {
      route: '/entrar?next=%2Fbiblioteca',
      path: '/entrar',
      auth: { user: DEMO_USER },
    });

    expect(screen.getByTestId('location')).toHaveTextContent('/biblioteca');
  });

  it('ignora ?next= que aponta para outro site', () => {
    renderWithProviders(<LoginPage mode="login" />, {
      route: '/entrar?next=%2F%2Fevil.example',
      path: '/entrar',
      auth: { user: DEMO_USER },
    });

    expect(screen.getByTestId('location')).toHaveTextContent(/^\/$/);
  });

  it('no cadastro, pede nome de exibição e exige senha longa', () => {
    renderWithProviders(<LoginPage mode="register" />, { route: '/cadastro' });

    expect(screen.getByLabelText('Nome de exibição')).toBeRequired();
    expect(screen.getByLabelText('Senha')).toHaveAttribute('minLength', '15');
  });
});
