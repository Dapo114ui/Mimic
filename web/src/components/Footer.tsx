export function Footer() {
  return (
    <footer className="border-t border-white/5 px-6 py-12">
      <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 text-sm text-mist-dim sm:flex-row">
        <p>© {new Date().getFullYear()} Mimic. Not affiliated with Nado.</p>
        <div className="flex items-center gap-6">
          <a
            href="https://github.com/Dapo114ui/Mimic"
            target="_blank"
            rel="noreferrer"
            className="transition hover:text-foreground"
          >
            GitHub
          </a>
          <a
            href="https://www.nado.xyz/"
            target="_blank"
            rel="noreferrer"
            className="transition hover:text-foreground"
          >
            Nado
          </a>
        </div>
      </div>
    </footer>
  );
}
