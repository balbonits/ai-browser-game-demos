export default function Footer() {
  return (
    <footer className="border-t border-border-faint py-8 text-sm text-fg-subtle">
      <div className="mx-auto max-w-[1120px] px-10 max-[720px]:px-4 font-mono space-y-1">
        <p>
          © 2026 John Dilig. Code{' '}
          <a className="text-accent hover:text-accent-hover hover:underline" href="/LICENSE">MIT</a>.
          Original assets{' '}
          <a className="text-accent hover:text-accent-hover hover:underline" href="/LICENSE-ASSETS">CC BY 4.0</a>.
          AI-generated pixel art governed by{' '}
          <a className="text-accent hover:text-accent-hover hover:underline" href="https://pixellab.ai/termsofservice" rel="noopener">PixelLab's ToS</a>.
        </p>
        <p>
          Full <a className="text-accent hover:text-accent-hover hover:underline" href="/credits.html">credits &amp; licensing</a>{' '}
          ·{' '}
          <a className="text-accent hover:text-accent-hover hover:underline" href="https://github.com/balbonits/ai-browser-game-demos" rel="noopener">source on GitHub</a>{' '}
          ·{' '}
          <a className="text-accent hover:text-accent-hover hover:underline" href="https://jdilig.me" rel="noopener">jdilig.me</a>
        </p>
      </div>
    </footer>
  );
}
