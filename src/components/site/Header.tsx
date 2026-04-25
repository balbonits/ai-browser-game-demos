import { Link } from 'react-router';
import { useTheme } from '@/hooks/useTheme';
import { Icon } from '@/components/icons';

export default function Header() {
  const [theme, toggle] = useTheme();

  return (
    <header
      className="sticky top-0 z-10 border-b border-border-faint backdrop-blur-md"
      style={{
        background: 'var(--nav-bg)',
        backdropFilter: 'blur(10px) saturate(180%)',
        WebkitBackdropFilter: 'blur(10px) saturate(180%)',
      }}
    >
      <nav className="mx-auto flex max-w-[1280px] items-center justify-between px-10 py-4 max-[720px]:px-4 max-[720px]:py-3">
        <Link
          to="/"
          aria-label="games · jdilig.me"
          className="flex items-center gap-2.5 font-mono text-[17px] font-semibold tracking-[-0.03em] text-fg-strong no-underline group"
        >
          <img
            src="/logo.png"
            alt=""
            aria-hidden="true"
            width={28}
            height={28}
            className="h-7 w-7 rounded-full object-cover ring-1 ring-border-DEFAULT transition-transform duration-150 group-hover:scale-105"
          />
          <span>
            jdilig<span className="text-accent">.</span>me
            <span className="text-fg-faint mx-0.5 font-normal">/</span>
            <span className="text-fg-muted font-medium">games</span>
          </span>
        </Link>

        <div className="flex items-center gap-1">
          <a
            href="https://jdilig.me"
            rel="noopener"
            className="inline-flex items-center gap-1 rounded-md px-3 py-[7px] text-sm font-medium text-fg-muted no-underline transition-colors hover:bg-bg-muted hover:text-fg-strong"
          >
            <span className="max-[720px]:hidden">jdilig.me</span>
            <Icon.ArrowUpRight className="h-3.5 w-3.5" />
          </a>
          <button
            type="button"
            onClick={toggle}
            aria-label="Toggle theme"
            title="Toggle theme"
            className="ml-1 flex h-[34px] w-[34px] cursor-pointer items-center justify-center rounded-md border border-border-DEFAULT bg-surface text-fg-muted transition-colors hover:border-border-strong hover:text-fg-strong"
          >
            {theme === 'light' ? (
              <Icon.Moon className="h-4 w-4" />
            ) : (
              <Icon.Sun className="h-4 w-4" />
            )}
          </button>
        </div>
      </nav>
    </header>
  );
}
