export type CurrentPriceRow = {
  symbol: string;
  open: number | null;
  high: number | null;
  low: number | null;
  close: number | null;
  volume: number | null;
};

export type HistoricalPriceRow = {
  symbol: string;
  date: string;
  open: number | null;
  high: number | null;
  low: number | null;
  close: number | null;
  volume: number | null;
};

export type IntradayPriceRow = {
  symbol: string;
  /** Minute bar size (Upstox `minutes` unit interval). */
  intervalMinutes: number;
  /** Candle start time from Upstox (ISO string, usually IST offset). */
  timestamp: string;
  open: number | null;
  high: number | null;
  low: number | null;
  close: number | null;
  volume: number | null;
};

export type UpstoxErrorStage =
  | "validation"
  | "instrument"
  | "quote"
  | "historical"
  | "intraday";

export type UpstoxDataError = {
  symbol: string;
  stage: UpstoxErrorStage;
  message: string;
  retryable: boolean;
};

export type UpstoxDataResponse<T> = {
  rows: T[];
  errors: UpstoxDataError[];
  fetchedAt: string;
  requestCount: number;
  activeLanes?: number;
};

export type UpstoxDataRequest =
  | {
      mode: "current";
      symbols: string[];
      accessToken?: string;
      accessTokens?: string[];
    }
  | {
      mode: "historical";
      symbols: string[];
      fromDate: string;
      toDate: string;
      accessToken?: string;
      accessTokens?: string[];
    }
  | {
      mode: "intraday";
      symbols: string[];
      fromDate: string;
      toDate: string;
      intervalMinutes: number;
      accessToken?: string;
      accessTokens?: string[];
    };

export type ResolvedInstrument = {
  symbol: string;
  instrumentKey: string;
  isin?: string;
  name?: string;
};

export type HistoricalJob = {
  id: string;
  mode: "historical";
  symbols: string[];
  completedSymbols: string[];
  failedSymbols: Array<{
    symbol: string;
    message: string;
    retryable: boolean;
    stage?: UpstoxErrorStage;
  }>;
  fromDate: string;
  toDate: string;
  createdAt: string;
  updatedAt: string;
  complete: boolean;
  stopped?: boolean;
};

export type IntradayJob = {
  id: string;
  mode: "intraday";
  intervalMinutes: number;
  symbols: string[];
  completedSymbols: string[];
  failedSymbols: Array<{
    symbol: string;
    message: string;
    retryable: boolean;
    stage?: UpstoxErrorStage;
  }>;
  fromDate: string;
  toDate: string;
  createdAt: string;
  updatedAt: string;
  complete: boolean;
  stopped?: boolean;
};
