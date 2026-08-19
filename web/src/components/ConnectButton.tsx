"use client";

import { useAccount, useConnect, useDisconnect } from "wagmi";
import { truncateAddress } from "@/lib/format";

export function ConnectButton({ className = "" }: { className?: string }) {
  const { address, isConnected } = useAccount();
  const { connectors, connect, isPending } = useConnect();
  const { disconnect } = useDisconnect();

  if (isConnected && address) {
    return (
      <button
        onClick={() => disconnect()}
        className={`inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-4 py-2 text-sm font-medium text-mist transition hover:border-white/30 hover:bg-white/10 ${className}`}
      >
        <span className="h-2 w-2 rounded-full bg-emerald-400" />
        {truncateAddress(address)}
      </button>
    );
  }

  const connector = connectors[0];

  return (
    <button
      onClick={() => connector && connect({ connector })}
      disabled={!connector || isPending}
      className={`inline-flex items-center gap-2 rounded-full bg-accent px-4 py-2 text-sm font-semibold text-ink-950 transition hover:bg-accent/90 disabled:cursor-not-allowed disabled:opacity-50 ${className}`}
    >
      {isPending ? "Connecting…" : connector ? "Connect Wallet" : "No Wallet Found"}
    </button>
  );
}
