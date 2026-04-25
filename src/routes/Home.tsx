import { GAMES } from '@/data/games';
import GameCard from '@/components/site/GameCard';

export default function Home() {
  const count = GAMES.length;

  return (
    <div className="mx-auto max-w-[1120px] px-10 py-20 max-[720px]:px-4 max-[720px]:py-12">
      <section className="flex flex-col gap-6 mb-16">
        <span className="font-mono text-xs font-medium uppercase tracking-[0.14em] text-accent">
          § AI Browser Games · 2026
        </span>
        <h1 className="text-5xl font-bold leading-tight tracking-tight text-fg-strong sm:text-6xl max-[720px]:text-[clamp(32px,9vw,48px)]">
          I build games<span className="text-accent">.</span>
          <br />
          Now I let{' '}
          <span className="font-serif italic font-normal">AI</span> build them too
          <span className="text-accent">.</span>
        </h1>
        <p className="text-lg text-fg-muted leading-relaxed max-w-2xl max-[720px]:text-base">
          A growing library of browser games and demos generated end-to-end by
          AI agents. Code by{' '}
          <a
            className="text-accent hover:text-accent-hover hover:underline"
            href="https://claude.com/claude-code"
            rel="noopener"
          >
            Claude Code
          </a>
          , art by{' '}
          <a
            className="text-accent hover:text-accent-hover hover:underline"
            href="https://pixellab.ai"
            rel="noopener"
          >
            PixelLab
          </a>
          , audio synthesized in code. Static HTML/CSS/JS for each game — React +
          Vite for this landing shell.
        </p>
      </section>

      <section>
        <header className="flex items-baseline justify-between mb-6">
          <h2 className="text-2xl font-semibold tracking-tight text-fg-strong">
            All games
          </h2>
          <span className="font-mono text-xs text-fg-subtle uppercase tracking-[0.14em]">
            {count} game{count === 1 ? '' : 's'} · 2026
          </span>
        </header>

        {count === 0 ? (
          <p className="rounded-xl border border-dashed border-border-DEFAULT p-8 text-center text-fg-subtle">
            No games yet — add the first one in <code>public/games/</code>.
          </p>
        ) : (
          <ul className="grid grid-cols-1 gap-5 sm:grid-cols-2 list-none p-0 m-0">
            {GAMES.map((g) => (
              <GameCard key={g.slug} game={g} />
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
