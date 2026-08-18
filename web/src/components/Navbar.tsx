import { ConnectButton } from "./ConnectButton";

const NAV_LINKS = [
  { href: "#how-it-works", label: "How it works" },
  { href: "#why-mimic", label: "Why Mimic" },
  { href: "https://github.com/Dapo114ui/Mimic", label: "Contracts", external: true },
];

export function Navbar() {
  return (
    <header className="sticky top-0 z-50 border-b border-white/5 bg-ink-950/80 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
        <a href="#" className="flex items-center gap-2 text-lg font-semibold tracking-tight text-foreground">
          <span className="relative flex h-2.5 w-2.5">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-accent opacity-60" />
            <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-accent" />
          </span>
          Mimic
        </a>
        <nav className="hidden items-center gap-8 text-sm text-mist md:flex">
          {NAV_LINKS.map((link) => (
            <a
              key={link.href}
              href={link.href}
              target={link.external ? "_blank" : undefined}
              rel={link.external ? "noreferrer" : undefined}
              className="transition hover:text-foreground"
            >
              {link.label}
            </a>
          ))}
        </nav>
        <ConnectButton />
      </div>
    </header>
  );
}
