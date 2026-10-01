import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import type { GameSummary } from '../api/types';
import { DEMO_USER, renderWithProviders } from '../test/render';
import { GameCard } from './GameCard';

const game: GameSummary = {
  id: '0199a0b2-7f3c-7a1e-9c4d-1234567890ab',
  name: 'Hollow Knight',
  coverUrl: 'https://example.com/capa.jpg',
  bannerUrl: null,
  stores: ['STEAM'],
  releaseDate: '2017-02-24',
  genres: [
    { slug: 'acao', name: 'Ação' },
    { slug: 'aventura', name: 'Aventura' },
  ],
  platforms: [{ slug: 'linux', name: 'Linux' }],
  rating: { average: 4.5, count: 2 },
};

describe('GameCard', () => {
  it('mostra capa, loja, gêneros e média, com link para os detalhes', () => {
    renderWithProviders(<GameCard game={game} status={undefined} />);

    expect(screen.getByRole('img', { name: 'Capa de Hollow Knight' })).toHaveAttribute(
      'src',
      'https://example.com/capa.jpg',
    );
    expect(screen.getByText('Steam')).toBeInTheDocument();
    expect(screen.getByText('Ação / Aventura')).toBeInTheDocument();
    expect(screen.getByText('4,5')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Hollow Knight/ })).toHaveAttribute(
      'href',
      `/jogos/${game.id}`,
    );
  });

  it('fora da biblioteca, oferece "Adicionar"; dentro, mostra o status e o menu', () => {
    const { unmount } = renderWithProviders(<GameCard game={game} status={undefined} />, {
      auth: { user: DEMO_USER },
    });
    expect(screen.getByRole('button', { name: /Adicionar/ })).toBeInTheDocument();
    unmount();

    renderWithProviders(<GameCard game={game} status="PLAYING" />, { auth: { user: DEMO_USER } });
    expect(screen.getByText('Jogando')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Adicionar/ })).not.toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Opções de Hollow Knight na biblioteca' }),
    ).toBeInTheDocument();
  });

  it('sem avaliações, mostra "—" em vez de uma nota', () => {
    renderWithProviders(
      <GameCard game={{ ...game, rating: { average: null, count: 0 } }} status={undefined} />,
    );

    expect(screen.getByText('—')).toBeInTheDocument();
    expect(screen.getByTitle('Ainda sem avaliações')).toBeInTheDocument();
  });

  it('sem login, "Adicionar" leva para o login e depois volta para a página', async () => {
    renderWithProviders(<GameCard game={game} status={undefined} />, { route: '/?genero=rpg' });

    await userEvent.click(screen.getByRole('button', { name: /Adicionar/ }));

    expect(screen.getByTestId('location')).toHaveTextContent(
      `/entrar?next=${encodeURIComponent('/?genero=rpg')}`,
    );
  });
});
