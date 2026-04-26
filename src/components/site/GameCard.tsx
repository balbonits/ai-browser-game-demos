import type { MouseEvent, KeyboardEvent } from 'react';
import type { Game } from '@/data/games';
import { Icon } from '@/components/icons';

type Props = { game: Game };

export default function GameCard({ game }: Props) {
  const href = `/games/${game.slug}`;

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

  return (
    <li
      role="link"
      tabIndex={0}
      onClick={handleClick}
      onKeyDown={handleKey}
      className="group relative flex flex-col gap-3 rounded-xl border border-border-DEFAULT bg-surface p-6 shadow-xs transition-[transform,box-shadow,border-color] duration-200 ease-out hover:-translate-y-0.5 hover:border-border-strong hover:shadow-lg cursor-pointer"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2 font-mono text-xs uppercase tracking-[0.14em] text-fg-subtle">
          <span className="inline-block h-1.5 w-1.5 rounded-full bg-accent" aria-hidden="true" />
          {game.year} · {game.kind}
        </div>
        <span
          className="text-fg-faint transition-transform duration-200 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 group-hover:text-accent"
          aria-hidden="true"
        >
          <Icon.ArrowUpRight className="h-4 w-4" />
        </span>
      </div>

      <h3 className="text-2xl font-semibold leading-tight tracking-tight text-fg-strong">
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
    </li>
  );
}
