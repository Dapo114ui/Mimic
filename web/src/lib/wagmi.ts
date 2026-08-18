import { http, createConfig } from "wagmi";
import { ink } from "viem/chains";
import { injected } from "wagmi/connectors";

export const wagmiConfig = createConfig({
  chains: [ink],
  connectors: [injected()],
  transports: {
    [ink.id]: http(),
  },
  ssr: true,
});
