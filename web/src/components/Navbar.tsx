"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ConnectButton } from "./ConnectButton";

const NAV_LINKS = [
  { href: "/", label: "Markets" },
  { href: "/portfolio", label: "Portfolio" },
  { href: "/vault", label: "Vault" },
  { href: "https://github.com/Dapo114ui/Nadoterminal", label: "Source", external: true },
];

export function Navbar() {
  const pathname = usePathname();

  return (
    <header className="sticky top-0 z-50 px-6 py-5">
      <div className="mx-auto flex max-w-6xl items-center justify-between">
        <Link href="/" className="flex items-center gap-2 text-lg font-semibold tracking-tight text-foreground">
          <span className="relative flex h-2.5 w-2.5">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-accent opacity-60" />
            <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-accent" />
          </span>
          Nadoterminal
        </Link>

        <nav className="hidden items-center gap-1 rounded-full border border-white/10 bg-ink-900/70 p-1 text-sm backdrop-blur-xl md:flex">
          {NAV_LINKS.map((link) => {
            const active = !link.external && (link.href === "/" ? pathname === "/" : pathname?.startsWith(link.href));
            const className = `rounded-full px-4 py-1.5 font-medium transition ${
              active ? "bg-white/10 text-foreground" : "text-mist hover:text-foreground"
            }`;
            return link.external ? (
              <a key={link.href} href={link.href} target="_blank" rel="noreferrer" className={className}>
                {link.label}
              </a>
            ) : (
              <Link key={link.href} href={link.href} className={className}>
                {link.label}
              </Link>
            );
          })}
        </nav>

        <ConnectButton />
      </div>
    </header>
  );
}
