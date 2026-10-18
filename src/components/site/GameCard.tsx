import type { MouseEvent, KeyboardEvent } from 'react';
import type { Game } from '@/data/games';
import { Icon } from '@/components/icons';

type Props = { game: Game };

export default function GameCard({ game }: Props) {
  const href = `/games/${game.slug}/index.html`;

  const handleClick = (e: MouseEvent<HTMLLIElement>) => {
    if ((e.target as HTMLElement).closest('a')) return;
    window.location.assign(href);
  };

  const handleKey = (e: KeyboardEvent<HTMLLIElement>) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      window.location.assign(href);
    }
  };

  const featured = game.featured === true;

  return (
    <li
      role="link"
      tabIndex={0}
      onClick={handleClick}
      onKeyDown={handleKey}
      data-slug={game.slug}
      data-featured={featured || undefined}
      className={[
        'group relative flex cursor-pointer flex-col overflow-hidden rounded-xl border border-border-DEFAULT bg-surface shadow-xs',
        // Tailwind 4 animates via the `translate`/`scale` properties, not `transform`.
        'transition-[translate,box-shadow,border-color] duration-200 ease-out',
        'hover:-translate-y-0.5 hover:border-border-strong hover:shadow-lg',
        'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent focus-visible:shadow-lg',
        // Reduced motion: no lift, only colour/border change.
        'motion-reduce:hover:translate-y-0 motion-reduce:transition-[box-shadow,border-color]',
        featured ? 'sm:col-span-2' : '',
      ].join(' ')}
    >
      {/* Thumbnail frame: fixed aspect ratio (no layout shift), accent-tinted placeholder. */}
      <div
        className={[
          'relative aspect-video overflow-hidden bg-[color-mix(in_srgb,var(--accent)_15%,transparent)]',
          featured && game.thumbWide ? 'sm:aspect-[1280/549]' : '',
        ].join(' ')}
      >
        <picture>
          {game.thumbWide && (
            <source media="(min-width: 640px)" srcSet={game.thumbWide} />
          )}
          <img
            src={game.thumb}
            alt={game.thumbAlt}
            width={960}
            height={540}
            loading={featured ? 'eager' : 'lazy'}
            fetchPriority={featured ? 'high' : undefined}
            decoding="async"
            className="block h-full w-full object-cover transition-[scale] duration-200 ease-out group-hover:scale-[1.04] group-focus-visible:scale-[1.04] group-has-[:focus-visible]:scale-[1.04] motion-reduce:group-hover:scale-100 motion-reduce:group-focus-visible:scale-100 motion-reduce:group-has-[:focus-visible]:scale-100 motion-reduce:transition-none"
          />
        </picture>
        {/* Decorative: the whole card is the link. Always visible on touch. */}
        <span
          aria-hidden="true"
          className="pointer-events-none absolute bottom-3 left-3 inline-flex items-center gap-1.5 rounded-full bg-surface/90 px-3 py-1 font-mono text-xs font-medium uppercase tracking-[0.08em] text-fg-strong opacity-0 shadow-sm backdrop-blur-sm transition-opacity duration-200 group-hover:opacity-100 group-focus-visible:opacity-100 group-has-[:focus-visible]:opacity-100 [@media(hover:none)]:opacity-100"
        >
          <svg viewBox="0 0 12 12" className="h-2.5 w-2.5 text-accent" fill="currentColor">
            <path d="M3 1.5v9l7.5-4.5z" />
          </svg>
          Play
        </span>
      </div>

      <div className="flex flex-1 flex-col gap-3 p-6">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2 font-mono text-xs uppercase tracking-[0.14em] text-fg-subtle">
            <span className="inline-block h-1.5 w-1.5 rounded-full bg-accent" aria-hidden="true" />
            {featured && (
              <>
                <span className="font-medium text-accent">Featured</span>
                <span aria-hidden="true">·</span>
              </>
            )}
            {game.year} · {game.kind}
          </div>
          <span
            className="text-fg-faint transition-[translate,color] duration-200 group-hover:translate-x-1 group-hover:text-accent motion-reduce:group-hover:translate-x-0"
            aria-hidden="true"
          >
            <Icon.ArrowUpRight className="h-4 w-4" />
          </span>
        </div>

        <h3
          className={[
            'font-semibold leading-tight tracking-tight text-fg-strong',
            featured ? 'text-2xl sm:text-3xl' : 'text-2xl',
          ].join(' ')}
        >
          <a href={href} className="text-fg-strong no-underline hover:text-fg-strong">
            {game.title}
          </a>
        </h3>

        <p className="text-fg-muted leading-relaxed">{game.description}</p>

        <div className="mt-auto flex flex-wrap gap-1.5 pt-1">
          {game.tags.map((t) => (
            <span
              key={t}
              className="rounded-md border border-border-faint bg-bg-subtle px-2 py-0.5 font-mono text-[11px] text-fg-subtle"
            >
              {t}
            </span>
          ))}
        </div>
      </div>
    </li>
  );
}
