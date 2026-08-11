export type CandleBias = "bullish" | "bearish" | "neutral";
export type CandleRole = "reversal" | "continuation" | "indecision";

export interface CandlePatternMeta {
  id: string;
  name: string;
  bias: CandleBias;
  role: CandleRole;
  bars: number;
  /** Whether detection logic exists in the engine */
  implemented: boolean;
  notes?: string;
}

/**
 * Canonical catalog aligned with Bulkowski / standard TA references (~45 core patterns).
 * `implemented: true` means the scanner/backtest engine can detect it today.
 */
export const CANDLE_PATTERN_CATALOG: CandlePatternMeta[] = [
  // ── Single-bar bullish ──────────────────────────────────────────────
  { id: "hammer", name: "Hammer", bias: "bullish", role: "reversal", bars: 1, implemented: true },
  { id: "inverted_hammer", name: "Inverted Hammer", bias: "bullish", role: "reversal", bars: 1, implemented: true },
  { id: "bullish_marubozu", name: "Bullish Marubozu", bias: "bullish", role: "continuation", bars: 1, implemented: true },
  { id: "bullish_belt_hold", name: "Bullish Belt Hold", bias: "bullish", role: "reversal", bars: 1, implemented: true },
  { id: "dragonfly_doji", name: "Dragonfly Doji", bias: "bullish", role: "reversal", bars: 1, implemented: true },
  { id: "spinning_top", name: "Spinning Top", bias: "neutral", role: "indecision", bars: 1, implemented: true },

  // ── Single-bar bearish ──────────────────────────────────────────────
  { id: "shooting_star", name: "Shooting Star", bias: "bearish", role: "reversal", bars: 1, implemented: true },
  { id: "hanging_man", name: "Hanging Man", bias: "bearish", role: "reversal", bars: 1, implemented: true },
  { id: "bearish_marubozu", name: "Bearish Marubozu", bias: "bearish", role: "continuation", bars: 1, implemented: true },
  { id: "bearish_belt_hold", name: "Bearish Belt Hold", bias: "bearish", role: "reversal", bars: 1, implemented: true },
  { id: "gravestone_doji", name: "Gravestone Doji", bias: "bearish", role: "reversal", bars: 1, implemented: true },

  // ── Single-bar neutral ──────────────────────────────────────────────
  { id: "doji", name: "Doji", bias: "neutral", role: "indecision", bars: 1, implemented: true },
  { id: "long_legged_doji", name: "Long-Legged Doji", bias: "neutral", role: "indecision", bars: 1, implemented: true },

  // ── Two-bar bullish reversal ────────────────────────────────────────
  { id: "bullish_engulfing", name: "Bullish Engulfing", bias: "bullish", role: "reversal", bars: 2, implemented: true },
  { id: "piercing_line", name: "Piercing Line", bias: "bullish", role: "reversal", bars: 2, implemented: true },
  { id: "tweezer_bottom", name: "Tweezer Bottom", bias: "bullish", role: "reversal", bars: 2, implemented: true },
  { id: "bullish_harami", name: "Bullish Harami", bias: "bullish", role: "reversal", bars: 2, implemented: true },
  { id: "bullish_harami_cross", name: "Bullish Harami Cross", bias: "bullish", role: "reversal", bars: 2, implemented: true },
  { id: "bullish_kicker", name: "Bullish Kicker", bias: "bullish", role: "reversal", bars: 2, implemented: true },
  { id: "bullish_separating_lines", name: "Bullish Separating Lines", bias: "bullish", role: "reversal", bars: 2, implemented: true },
  { id: "matching_low", name: "Matching Low / Meeting Lines", bias: "bullish", role: "reversal", bars: 2, implemented: true },
  { id: "bullish_homing_pigeon", name: "Bullish Homing Pigeon", bias: "bullish", role: "reversal", bars: 2, implemented: false, notes: "Planned" },

  // ── Two-bar bearish reversal ────────────────────────────────────────
  { id: "bearish_engulfing", name: "Bearish Engulfing", bias: "bearish", role: "reversal", bars: 2, implemented: true },
  { id: "dark_cloud_cover", name: "Dark Cloud Cover", bias: "bearish", role: "reversal", bars: 2, implemented: true },
  { id: "tweezer_top", name: "Tweezer Top", bias: "bearish", role: "reversal", bars: 2, implemented: true },
  { id: "bearish_harami", name: "Bearish Harami", bias: "bearish", role: "reversal", bars: 2, implemented: true },
  { id: "bearish_harami_cross", name: "Bearish Harami Cross", bias: "bearish", role: "reversal", bars: 2, implemented: true },
  { id: "bearish_kicker", name: "Bearish Kicker", bias: "bearish", role: "reversal", bars: 2, implemented: true },
  { id: "bearish_separating_lines", name: "Bearish Separating Lines", bias: "bearish", role: "reversal", bars: 2, implemented: true },
  { id: "matching_high", name: "Matching High", bias: "bearish", role: "reversal", bars: 2, implemented: true },

  // ── Two-bar gaps ────────────────────────────────────────────────────
  { id: "gap_up", name: "Gap Up (Rising Window)", bias: "bullish", role: "continuation", bars: 2, implemented: true },
  { id: "gap_down", name: "Gap Down (Falling Window)", bias: "bearish", role: "continuation", bars: 2, implemented: true },

  // ── Three-bar bullish ───────────────────────────────────────────────
  { id: "morning_star", name: "Morning Star", bias: "bullish", role: "reversal", bars: 3, implemented: true },
  { id: "three_white_soldiers", name: "Three White Soldiers", bias: "bullish", role: "continuation", bars: 3, implemented: true },
  { id: "three_inside_up", name: "Three Inside Up", bias: "bullish", role: "reversal", bars: 3, implemented: true },
  { id: "three_outside_up", name: "Three Outside Up", bias: "bullish", role: "reversal", bars: 3, implemented: true },
  { id: "abandoned_baby_bull", name: "Abandoned Baby (Bullish)", bias: "bullish", role: "reversal", bars: 3, implemented: true },
  { id: "bullish_stick_sandwich", name: "Bullish Stick Sandwich", bias: "bullish", role: "reversal", bars: 3, implemented: false, notes: "Planned" },

  // ── Three-bar bearish ───────────────────────────────────────────────
  { id: "evening_star", name: "Evening Star", bias: "bearish", role: "reversal", bars: 3, implemented: true },
  { id: "three_black_crows", name: "Three Black Crows", bias: "bearish", role: "reversal", bars: 3, implemented: true },
  { id: "three_inside_down", name: "Three Inside Down", bias: "bearish", role: "reversal", bars: 3, implemented: true },
  { id: "three_outside_down", name: "Three Outside Down", bias: "bearish", role: "reversal", bars: 3, implemented: true },
  { id: "abandoned_baby_bear", name: "Abandoned Baby (Bearish)", bias: "bearish", role: "reversal", bars: 3, implemented: true },
  { id: "upside_gap_two_crows", name: "Upside Gap Two Crows", bias: "bearish", role: "reversal", bars: 3, implemented: true },
  { id: "advance_block", name: "Advance Block", bias: "bearish", role: "reversal", bars: 3, implemented: true },

  // ── Multi-bar continuation (4–5 bars) ─────────────────────────────
  { id: "rising_three_methods", name: "Rising Three Methods", bias: "bullish", role: "continuation", bars: 5, implemented: true },
  { id: "falling_three_methods", name: "Falling Three Methods", bias: "bearish", role: "continuation", bars: 5, implemented: true },
  { id: "three_line_strike_bull", name: "Three-Line Strike (Bullish)", bias: "bullish", role: "reversal", bars: 4, implemented: true },
  { id: "three_line_strike_bear", name: "Three-Line Strike (Bearish)", bias: "bearish", role: "reversal", bars: 4, implemented: true },
  { id: "bullish_mat_hold", name: "Bullish Mat Hold", bias: "bullish", role: "continuation", bars: 5, implemented: false, notes: "Planned" },
  { id: "bearish_mat_hold", name: "Bearish Mat Hold", bias: "bearish", role: "continuation", bars: 5, implemented: false, notes: "Planned" },

  // ── Not yet implemented (documented gaps) ───────────────────────────
  { id: "tower_bottom", name: "Tower Bottom", bias: "bullish", role: "reversal", bars: 10, implemented: false, notes: "Multi-bar structural" },
  { id: "tower_top", name: "Tower Top", bias: "bearish", role: "reversal", bars: 10, implemented: false, notes: "Multi-bar structural" },
  { id: "bullish_breakaway", name: "Bullish Breakaway", bias: "bullish", role: "reversal", bars: 5, implemented: false, notes: "Planned" },
  { id: "bearish_breakaway", name: "Bearish Breakaway", bias: "bearish", role: "reversal", bars: 5, implemented: false, notes: "Planned" },
  { id: "concealing_baby_swallow", name: "Concealing Baby Swallow", bias: "bullish", role: "reversal", bars: 4, implemented: false, notes: "Rare" },
  { id: "ladder_bottom", name: "Ladder Bottom", bias: "bullish", role: "reversal", bars: 5, implemented: false, notes: "Planned" },
  { id: "ladder_top", name: "Ladder Top", bias: "bearish", role: "reversal", bars: 5, implemented: false, notes: "Planned" },
];

export function getImplementedPatternIds(): string[] {
  return CANDLE_PATTERN_CATALOG.filter((p) => p.implemented).map((p) => p.id);
}

export function getCatalogByBias(bias: CandleBias): CandlePatternMeta[] {
  return CANDLE_PATTERN_CATALOG.filter((p) => p.bias === bias);
}

export function getCoverageSummary(): {
  total: number;
  implemented: number;
  bullish: { total: number; implemented: number };
  bearish: { total: number; implemented: number };
  neutral: { total: number; implemented: number };
  reversal: { total: number; implemented: number };
  continuation: { total: number; implemented: number };
} {
  const implemented = CANDLE_PATTERN_CATALOG.filter((p) => p.implemented);
  const count = (pred: (p: CandlePatternMeta) => boolean) => ({
    total: CANDLE_PATTERN_CATALOG.filter(pred).length,
    implemented: implemented.filter(pred).length,
  });
  return {
    total: CANDLE_PATTERN_CATALOG.length,
    implemented: implemented.length,
    bullish: count((p) => p.bias === "bullish"),
    bearish: count((p) => p.bias === "bearish"),
    neutral: count((p) => p.bias === "neutral"),
    reversal: count((p) => p.role === "reversal"),
    continuation: count((p) => p.role === "continuation"),
  };
}
