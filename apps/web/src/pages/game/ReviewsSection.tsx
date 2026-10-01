import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState, type FormEvent } from 'react';
import { Link, useLocation } from 'react-router';
import { ApiError } from '../../api/client';
import {
  createReview,
  deleteMyReview,
  getMyReview,
  listReviews,
  updateMyReview,
} from '../../api/endpoints';
import type { Review } from '../../api/types';
import { useAuth } from '../../auth/useAuth';
import { Icon } from '../../components/Icon';
import { Pagination } from '../../components/Pagination';
import { StarInput, Stars } from '../../components/Stars';
import { ErrorState, Spinner } from '../../components/States';
import { formatDay, initials } from '../../lib/format';
import { useToast } from '../../toast/context';

const COMMENT_MAX_LENGTH = 1000;
const REVIEWS_PAGE_SIZE = 5;

export function ReviewsSection({ gameId }: { gameId: string }) {
  const { user } = useAuth();
  const location = useLocation();
  const [page, setPage] = useState(1);

  const reviews = useQuery({
    queryKey: ['reviews', gameId, page],
    queryFn: () => listReviews(gameId, page, REVIEWS_PAGE_SIZE),
    placeholderData: keepPreviousData,
  });

  // A própria avaliação: 404 significa "ainda não avaliou", não um erro.
  const mine = useQuery({
    queryKey: ['myReview', user?.id, gameId],
    queryFn: async () => {
      try {
        return await getMyReview(gameId);
      } catch (error) {
        if (error instanceof ApiError && error.status === 404) {
          return null;
        }
        throw error;
      }
    },
    enabled: user !== null,
  });

  return (
    <section className="space-y-4" aria-labelledby="reviews-title">
      <h2 id="reviews-title" className="text-lg font-bold">
        Avaliações
      </h2>

      {!user ? (
        <div className="flex items-center justify-between gap-4 rounded-lg border border-app-border bg-app-card p-4 text-sm">
          <span className="text-app-muted">Entre na sua conta para avaliar este jogo.</span>
          <Link
            to={`/entrar?next=${encodeURIComponent(location.pathname)}`}
            className="btn-secondary"
          >
            Entrar
          </Link>
        </div>
      ) : mine.isPending ? (
        <Spinner label="Carregando sua avaliação…" />
      ) : mine.isError ? (
        <ErrorState error={mine.error} onRetry={() => void mine.refetch()} />
      ) : (
        // A key recria o formulário quando a avaliação salva muda (criada ou excluída).
        <ReviewForm key={mine.data?.id ?? 'nova'} gameId={gameId} existing={mine.data} />
      )}

      {reviews.isPending ? (
        <Spinner label="Carregando avaliações…" />
      ) : reviews.isError ? (
        <ErrorState error={reviews.error} onRetry={() => void reviews.refetch()} />
      ) : reviews.data.items.length === 0 ? (
        <p className="rounded-lg border border-dashed border-app-border p-6 text-center text-sm text-app-muted">
          Ninguém avaliou este jogo ainda.
        </p>
      ) : (
        <>
          <ul className="space-y-3">
            {reviews.data.items.map((review) => (
              <ReviewItem key={review.id} review={review} isMine={review.author.id === user?.id} />
            ))}
          </ul>
          <Pagination
            page={reviews.data.page}
            totalPages={reviews.data.totalPages}
            onChange={setPage}
          />
        </>
      )}
    </section>
  );
}

function ReviewItem({ review, isMine }: { review: Review; isMine: boolean }) {
  // Margem de alguns segundos: criar já grava updatedAt um pouco depois de createdAt.
  const edited = Date.parse(review.updatedAt) - Date.parse(review.createdAt) > 5_000;
  return (
    <li className="rounded-lg border border-app-border bg-app-card p-4">
      <div className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-app-border bg-app-surface text-[11px] font-semibold text-app-accent">
            {initials(review.author.displayName)}
          </div>
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold">
              {review.author.displayName}
              {isMine && <span className="ml-2 text-[11px] font-medium text-app-accent">você</span>}
            </p>
            <p className="text-[11px] text-app-muted">
              {formatDay(review.createdAt)}
              {edited && ' · editada'}
            </p>
          </div>
        </div>
        <Stars value={review.rating} />
      </div>
      {review.comment && (
        <p className="mt-3 text-sm leading-relaxed whitespace-pre-line text-app-text/90">
          {review.comment}
        </p>
      )}
    </li>
  );
}

function ReviewForm({ gameId, existing }: { gameId: string; existing: Review | null | undefined }) {
  const queryClient = useQueryClient();
  const { showToast } = useToast();
  const [rating, setRating] = useState(existing?.rating ?? 0);
  const [comment, setComment] = useState(existing?.comment ?? '');

  // Média e quantidade mudam no jogo e nas listagens do catálogo.
  const refresh = () =>
    Promise.all(
      [['reviews', gameId], ['myReview'], ['game', gameId], ['games']].map((queryKey) =>
        queryClient.invalidateQueries({ queryKey }),
      ),
    );

  const save = useMutation({
    mutationFn: () =>
      existing ? updateMyReview(gameId, rating, comment) : createReview(gameId, rating, comment),
    onSuccess: () => showToast(existing ? 'Avaliação atualizada.' : 'Avaliação publicada.'),
    onError: (error) => showToast(error.message, 'error'),
    onSettled: refresh,
  });
  const remove = useMutation({
    mutationFn: () => deleteMyReview(gameId),
    onSuccess: () => showToast('Avaliação excluída.'),
    onError: (error) => showToast(error.message, 'error'),
    onSettled: refresh,
  });
  const busy = save.isPending || remove.isPending;

  const submit = (event: FormEvent) => {
    event.preventDefault();
    save.mutate();
  };

  return (
    <form
      onSubmit={submit}
      className="space-y-3 rounded-lg border border-app-border bg-app-card p-4"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-semibold">{existing ? 'Sua avaliação' : 'Avalie este jogo'}</p>
        <StarInput value={rating} onChange={setRating} disabled={busy} />
      </div>
      <div>
        <label htmlFor="review-comment" className="sr-only">
          Comentário (opcional)
        </label>
        <textarea
          id="review-comment"
          value={comment}
          maxLength={COMMENT_MAX_LENGTH}
          onChange={(event) => setComment(event.target.value)}
          placeholder="Comentário opcional: o que achou do jogo?"
          rows={3}
          disabled={busy}
          className="input h-auto resize-y py-2"
        />
        <p className="mt-1 text-right text-[11px] text-app-muted">
          {comment.length}/{COMMENT_MAX_LENGTH}
        </p>
      </div>
      <div className="flex items-center justify-end gap-2">
        {existing && (
          <button
            type="button"
            className="btn-danger"
            disabled={busy}
            onClick={() => remove.mutate()}
          >
            <Icon name="delete" className="text-[16px]" />
            Excluir
          </button>
        )}
        <button type="submit" className="btn-primary" disabled={busy || rating === 0}>
          {existing ? 'Salvar alterações' : 'Publicar avaliação'}
        </button>
      </div>
    </form>
  );
}
