import { detectChartPatternAt } from "../src/lib/engine/chart-patterns";
import {
  buildAscendingTriangleBars,
  buildBearFlagBars,
  buildBullFlagBars,
  buildCupAndHandleBars,
  buildDescendingTriangleBars,
  buildDoubleBottomBars,
  buildDoubleTopBars,
  buildDowntrendBars,
  buildHeadAndShouldersBars,
  buildLongBaseBreakdownBars,
  buildLongBaseBreakoutBars,
  buildStaleHighDowntrendBars,
  buildUptrendBars,
} from "../src/lib/engine/chart-pattern-fixtures";

const LOOKBACK = 60;

const PATTERNS = [
  "bull_flag",
  "bear_flag",
  "ascending_triangle",
  "descending_triangle",
  "cup_and_handle",
  "double_bottom",
  "double_top",
  "head_and_shoulders",
  "long_base_breakout",
  "long_base_breakdown",
] as const;

const BULLISH = new Set([
  "bull_flag",
  "ascending_triangle",
  "cup_and_handle",
  "double_bottom",
  "long_base_breakout",
]);

const BEARISH = new Set([
  "bear_flag",
  "descending_triangle",
  "double_top",
  "head_and_shoulders",
  "long_base_breakdown",
]);

function signalAtEnd(bars: Parameters<typeof detectChartPatternAt>[0], pattern: string) {
  const idx = bars.length - 1;
  return detectChartPatternAt(bars, idx, pattern, { lookback: LOOKBACK });
}

function countSignals(bars: Parameters<typeof detectChartPatternAt>[0], pattern: string) {
  let count = 0;
  for (let i = 0; i < bars.length; i++) {
    if (detectChartPatternAt(bars, i, pattern, { lookback: LOOKBACK })) count++;
  }
  return count;
}

type Case = {
  name: string;
  bars: Parameters<typeof detectChartPatternAt>[0];
  expect: Partial<Record<(typeof PATTERNS)[number], boolean>>;
  forbidOthers?: boolean;
};

const cases: Case[] = [
  {
    name: "double top fixture",
    bars: buildDoubleTopBars(),
    expect: { double_top: true },
    forbidOthers: true,
  },
  {
    name: "double bottom fixture",
    bars: buildDoubleBottomBars(),
    expect: { double_bottom: true },
    forbidOthers: true,
  },
  {
    name: "bull flag fixture",
    bars: buildBullFlagBars(),
    expect: { bull_flag: true },
  },
  {
    name: "bear flag fixture",
    bars: buildBearFlagBars(),
    expect: { bear_flag: true },
  },
  {
    name: "ascending triangle fixture",
    bars: buildAscendingTriangleBars(),
    expect: { ascending_triangle: true },
  },
  {
    name: "descending triangle fixture",
    bars: buildDescendingTriangleBars(),
    expect: { descending_triangle: true },
  },
  {
    name: "long base breakout fixture",
    bars: buildLongBaseBreakoutBars(),
    expect: { long_base_breakout: true },
  },
  {
    name: "long base breakdown fixture",
    bars: buildLongBaseBreakdownBars(),
    expect: { long_base_breakdown: true },
  },
  {
    name: "head and shoulders fixture",
    bars: buildHeadAndShouldersBars(),
    expect: { head_and_shoulders: true },
    forbidOthers: true,
  },
  {
    name: "cup and handle fixture",
    bars: buildCupAndHandleBars(),
    expect: { cup_and_handle: true },
  },
  {
    name: "stale highs downtrend (no double top)",
    bars: buildStaleHighDowntrendBars(),
    expect: { double_top: false, double_bottom: false },
  },
  {
    name: "downtrend negative control",
    bars: buildDowntrendBars(),
    expect: {
      double_top: false,
      bull_flag: false,
      ascending_triangle: false,
      double_bottom: false,
      long_base_breakout: false,
      cup_and_handle: false,
    },
  },
  {
    name: "uptrend negative control",
    bars: buildUptrendBars(),
    expect: {
      double_bottom: false,
      bear_flag: false,
      descending_triangle: false,
      double_top: false,
      long_base_breakdown: false,
      head_and_shoulders: false,
    },
  },
];

let failures = 0;

for (const testCase of cases) {
  console.log(`\n${testCase.name}`);
  for (const pattern of PATTERNS) {
    const expected = testCase.expect[pattern];
    if (expected === undefined) continue;

    const hit = signalAtEnd(testCase.bars, pattern);
    const total = countSignals(testCase.bars, pattern);
    const ok = hit === expected;
    const label = ok ? "OK" : "FAIL";
    console.log(
      `  [${label}] ${pattern}: end=${hit} totalSignals=${total} expected=${expected}`,
    );
    if (!ok) failures++;
  }

  if (testCase.forbidOthers) {
    for (const pattern of PATTERNS) {
      if (testCase.expect[pattern] !== undefined) continue;
      const hit = signalAtEnd(testCase.bars, pattern);
      if (hit) {
        console.log(`  [FAIL] unexpected ${pattern} on end bar`);
        failures++;
      }
    }
  }
}

// Cross-check bullish patterns do not fire on downtrend and bearish on uptrend
for (const pattern of PATTERNS) {
  if (BULLISH.has(pattern)) {
    if (signalAtEnd(buildDowntrendBars(), pattern)) {
      console.log(`\n[FAIL] ${pattern} fired on downtrend`);
      failures++;
    }
  }
  if (BEARISH.has(pattern)) {
    if (signalAtEnd(buildUptrendBars(), pattern)) {
      console.log(`\n[FAIL] ${pattern} fired on uptrend`);
      failures++;
    }
  }
}

if (failures > 0) {
  console.error(`\n${failures} validation failure(s)`);
  process.exit(1);
}

console.log("\nAll chart pattern validations passed.");
