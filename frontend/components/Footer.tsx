import { BrandMark } from "@/components/Brand";
import type { NetworkAdapter } from "@/lib/network";

export function Footer({ network }: { network: NetworkAdapter }) {
  return (
    <footer className="px-4 pb-10 pt-24 sm:px-6 sm:pt-32">
      <div className="mx-auto max-w-6xl overflow-hidden rounded-[28px] bg-ink px-6 py-12 sm:px-10">
        <div className="flex flex-col gap-10 sm:flex-row sm:items-start sm:justify-between">
          <div className="max-w-sm">
            <div className="flex items-center gap-2.5">
              <BrandMark className="h-8 w-8" />
              <span className="text-[17px] font-semibold tracking-[-0.02em] text-paper">
                GenAntiTrust
              </span>
            </div>
            <p className="mt-4 text-[14px] leading-relaxed text-paper/60">
              An Equivalence Principle Intelligent Contract adjudicating
              algorithmic collusion between autonomous pricing agents.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-x-12 gap-y-3 text-[14px] sm:gap-x-16">
            <a
              href="https://github.com/ebukaarcryppted-git/GenAntiTrust"
              target="_blank"
              rel="noreferrer"
              className="text-paper/60 transition-colors hover:text-sky"
            >
              Repository
            </a>
            <a
              href={`${network.explorerUrl}address/${network.contractAddress}`}
              target="_blank"
              rel="noreferrer"
              className="text-paper/60 transition-colors hover:text-sky"
            >
              Explorer
            </a>
            <a
              href="https://docs.genlayer.com/developers/intelligent-contracts/equivalence-principle"
              target="_blank"
              rel="noreferrer"
              className="text-paper/60 transition-colors hover:text-sky"
            >
              Equivalence Principle
            </a>
            <a
              href={
                network.id === "studio"
                  ? "https://studio-next.genlayer.com/"
                  : "https://testnet-faucet.genlayer.foundation/"
              }
              target="_blank"
              rel="noreferrer"
              className="text-paper/60 transition-colors hover:text-sky"
            >
              {network.id === "studio" ? "Studio Next" : "Bradbury faucet"}
            </a>
          </div>
        </div>

        <div className="mt-12 flex flex-col gap-2 border-t border-paper/10 pt-6 font-mono text-[11.5px] text-paper/40 sm:flex-row sm:items-center sm:justify-between">
          <span>{network.contractAddress}</span>
          <span>{network.label} · chain {parseInt(network.chainIdHex, 16)}</span>
        </div>
      </div>
    </footer>
  );
}
