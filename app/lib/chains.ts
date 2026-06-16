// Multi-chain scaffold. Solana is active; Ethereum and Base are wired as
// "ready" (validation + registry) but not yet surfaced in the UI or pool logic.
// All token objects should carry a `chain` field defaulting to DEFAULT_CHAIN.

export type Chain = 'solana' | 'ethereum' | 'base';

export const DEFAULT_CHAIN: Chain = 'solana';

export interface ChainConfig {
  id: Chain;
  label: string;
  /** DexScreener's chainId for this chain — used to filter pair results. */
  dexscreenerId: string;
  /** Returns true if `addr` is a structurally valid address on this chain. */
  validate: (addr: string) => boolean;
  /** UI hint describing the expected address format. */
  addressHint: string;
  /** Whether this chain is live in the product (vs. scaffolded only). */
  active: boolean;
}

// Solana mint: base58, 32–44 chars (excludes 0, O, I, l).
const SOLANA_ADDRESS = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;
// EVM address: 0x + 40 hex chars.
const EVM_ADDRESS = /^0x[a-fA-F0-9]{40}$/;

export const CHAINS: Record<Chain, ChainConfig> = {
  solana: {
    id: 'solana',
    label: 'Solana',
    dexscreenerId: 'solana',
    validate: (a) => SOLANA_ADDRESS.test(a),
    addressHint: 'Solana mint address (base58, 32–44 chars)',
    active: true,
  },
  ethereum: {
    id: 'ethereum',
    label: 'Ethereum',
    dexscreenerId: 'ethereum',
    validate: (a) => EVM_ADDRESS.test(a),
    addressHint: '0x… contract address (40 hex chars)',
    active: false,
  },
  base: {
    id: 'base',
    label: 'Base',
    dexscreenerId: 'base',
    validate: (a) => EVM_ADDRESS.test(a),
    addressHint: '0x… contract address (40 hex chars)',
    active: false,
  },
};

/** Structural address validation, per chain. Trims input. Defaults to Solana. */
export function validateAddress(addr: string, chain: Chain = DEFAULT_CHAIN): boolean {
  const cfg = CHAINS[chain];
  if (!cfg) return false;
  return cfg.validate((addr || '').trim());
}

/** Map a DexScreener `chainId` to our Chain, or null if unsupported. */
export function chainFromDexId(dexId: string | undefined | null): Chain | null {
  if (!dexId) return null;
  const match = (Object.values(CHAINS) as ChainConfig[]).find((c) => c.dexscreenerId === dexId);
  return match ? match.id : null;
}

export const ACTIVE_CHAINS: Chain[] = (Object.values(CHAINS) as ChainConfig[])
  .filter((c) => c.active)
  .map((c) => c.id);
