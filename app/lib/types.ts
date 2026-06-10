export type Tag = 'watching' | 'active-lp' | 'research' | 'other' | null;

export interface PortfolioRow {
  id: string;
  user_id: string;
  mint_address: string;
  tag: Tag;
  added_at: string;
}

export interface TokenLive {
  name: string;
  symbol: string;
  price: number;
  mc: number;
  tvl: number;
  vol24: number;
  liqRatio: number;
  priceChg: number;
  estFees: number;
  stage: number;
  stageLabel: string;
  pools: number;
  loading: boolean;
  error: boolean;
}

export type PortfolioEntry = PortfolioRow & { live: TokenLive };
