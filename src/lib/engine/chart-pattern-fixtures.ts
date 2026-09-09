import type { OhlcvBar } from "@/lib/types";

export function bar(
  i: number,
  open: number,
  high: number,
  low: number,
  close: number,
): OhlcvBar {
  return {
    date: `2024-01-${String(i + 1).padStart(2, "0")}`,
    open,
    high,
    low,
    close,
    volume: 1_000_000,
  };
}

/** Steady downtrend — should not trigger bullish patterns or stale bearish reversals */
export function buildDowntrendBars(count = 60, start = 120, step = 1.2): OhlcvBar[] {
  const bars: OhlcvBar[] = [];
  let price = start;
  for (let i = 0; i < count; i++) {
    const open = price;
    const close = price - step - (i % 3 === 0 ? 0.4 : 0);
    const high = open + 0.3;
    const low = close - 0.4;
    bars.push(bar(i, open, high, low, close));
    price = close;
  }
  return bars;
}

/** Steady uptrend — should not trigger bearish patterns */
export function buildUptrendBars(count = 60, start = 50, step = 1.1): OhlcvBar[] {
  const bars: OhlcvBar[] = [];
  let price = start;
  for (let i = 0; i < count; i++) {
    const open = price;
    const close = price + step + (i % 3 === 0 ? 0.3 : 0);
    const high = close + 0.4;
    const low = open - 0.2;
    bars.push(bar(i, open, high, low, close));
    price = close;
  }
  return bars;
}

export function buildDoubleTopBars(): OhlcvBar[] {
  const bars: OhlcvBar[] = [];
  let price = 78;
  for (let i = 0; i < 60; i++) {
    let open = price;
    let close = price;
    let high = price;
    let low = price;

    if (i < 14) {
      close = price + 1.35;
      high = close + 0.6;
      low = open - 0.3;
    } else if (i === 18) {
      high = 102;
      close = 101.2;
      low = 100.2;
    } else if (i > 18 && i < 30) {
      close = 100 - (i - 18) * 0.75;
      high = close + 0.5;
      low = close - 0.7;
    } else if (i >= 30 && i < 42) {
      close = 91 + (i - 30) * 0.55;
      high = close + 0.45;
      low = close - 0.45;
    } else if (i === 45) {
      high = 101.4;
      close = 100.9;
      low = 100.1;
    } else if (i > 45 && i < 58) {
      close = 100.5 - (i - 45) * 0.55;
      high = close + 0.35;
      low = close - 0.45;
    } else if (i === 58) {
      close = 91.8;
      high = 92.2;
      low = 91.4;
    } else if (i === 59) {
      close = 89.6;
      high = 90.1;
      low = 89.2;
    } else {
      close = price + (i % 2 === 0 ? -0.15 : 0.1);
      high = close + 0.3;
      low = close - 0.3;
    }

    bars.push(bar(i, open, high, low, close));
    price = close;
  }
  return bars;
}

export function buildDoubleBottomBars(): OhlcvBar[] {
  const bars: OhlcvBar[] = [];
  let price = 122;
  for (let i = 0; i < 60; i++) {
    let open = price;
    let close = price;
    let high = price;
    let low = price;

    if (i < 14) {
      close = price - 1.35;
      high = open + 0.3;
      low = close - 0.6;
    } else if (i === 18) {
      low = 28;
      close = 28.8;
      high = 29.8;
    } else if (i > 18 && i < 30) {
      close = 30 + (i - 18) * 0.75;
      high = close + 0.7;
      low = close - 0.5;
    } else if (i >= 30 && i < 42) {
      close = 39 - (i - 30) * 0.55;
      high = close + 0.45;
      low = close - 0.45;
    } else if (i === 45) {
      low = 28.6;
      close = 29.1;
      high = 29.9;
    } else if (i > 45 && i < 58) {
      close = 29.5 + (i - 45) * 0.75;
      high = close + 0.45;
      low = close - 0.35;
      if (i >= 54) high = Math.max(high, 38.8);
    } else if (i === 58) {
      close = 39.1;
      low = 38.7;
      high = 39.5;
    } else if (i === 59) {
      close = 40.4;
      high = 40.9;
      low = 40;
    } else {
      close = price + (i % 2 === 0 ? 0.15 : -0.1);
      high = close + 0.3;
      low = close - 0.3;
    }

    bars.push(bar(i, open, high, low, close));
    price = close;
  }
  return bars;
}

export function buildBullFlagBars(): OhlcvBar[] {
  const bars: OhlcvBar[] = [];
  let price = 70;
  for (let i = 0; i < 60; i++) {
    let open = price;
    let close = price;
    let high = price;
    let low = price;

    if (i <= 8) {
      close = price + 3.1;
      high = close + 0.4;
      low = open - 0.2;
    } else if (i < 57) {
      const base = 95.8 - (i - 9) * 0.05;
      close = base + (i % 3 === 0 ? 0.25 : -0.15);
      high = close + 0.35;
      low = close - 0.4;
      if (high > 96.2) high = 96.2;
    } else if (i === 59) {
      close = 97.1;
      high = 97.5;
      low = 96.7;
    } else {
      close = 96.4;
      high = 96.7;
      low = 96.1;
    }

    bars.push(bar(i, open, high, low, close));
    price = close;
  }
  return bars;
}

export function buildBearFlagBars(): OhlcvBar[] {
  const bull = buildBullFlagBars();
  const peak = 140;
  return bull.map((b, i) => {
    const invClose = peak - b.close;
    const invOpen = peak - b.open;
    const invHigh = Math.max(invOpen, invClose) + 0.35;
    const invLow = Math.min(invOpen, invClose) - 0.35;
    return bar(i, invOpen, invHigh, invLow, invClose);
  });
}

export function buildAscendingTriangleBars(): OhlcvBar[] {
  const bars: OhlcvBar[] = [];
  let price = 84;
  for (let i = 0; i < 60; i++) {
    let open = price;
    let close = price;
    let high = price;
    let low = price;

    if (i < 12) {
      close = price + 0.6;
      high = close + 0.4;
      low = open - 0.3;
    } else if (i < 55) {
      const support = 86 + (i - 12) * 0.11;
      close = support + 0.35;
      low = support - 0.35;
      high = i % 6 === 0 || i % 9 === 0 || i % 11 === 0 ? 96 : close + 0.45;
      if (high > 96) high = 96;
    } else if (i === 58) {
      close = 95.7;
      high = 95.95;
      low = 95.4;
    } else if (i === 59) {
      close = 96.8;
      high = 97.1;
      low = 95.9;
    } else {
      close = 95.2 + (i - 55) * 0.35;
      high = 96;
      low = 94.8;
    }

    bars.push(bar(i, open, high, low, close));
    price = close;
  }
  return bars;
}

export function buildDescendingTriangleBars(): OhlcvBar[] {
  const bars: OhlcvBar[] = [];
  let price = 116;
  for (let i = 0; i < 60; i++) {
    let open = price;
    let close = price;
    let high = price;
    let low = price;

    if (i < 12) {
      close = price - 0.6;
      high = open + 0.3;
      low = close - 0.4;
    } else if (i < 55) {
      const resistance = 114 - (i - 12) * 0.11;
      close = resistance - 0.35;
      high = resistance + 0.35;
      low = i % 6 === 0 || i % 9 === 0 || i % 11 === 0 ? 104 : close - 0.45;
      if (low < 104) low = 104;
    } else if (i === 58) {
      close = 105.3;
      high = 105.55;
      low = 104.9;
    } else if (i === 59) {
      close = 103.2;
      high = 103.55;
      low = 102.9;
    } else {
      close = 104.8 - (i - 55) * 0.35;
      high = 106;
      low = 104.2;
    }

    bars.push(bar(i, open, high, low, close));
    price = close;
  }
  return bars;
}

export function buildHeadAndShouldersBars(): OhlcvBar[] {
  const bars: OhlcvBar[] = [];
  let price = 78;
  for (let i = 0; i < 60; i++) {
    let open = price;
    let close = price;
    let high = price;
    let low = price;

    if (i < 12) {
      close = price + 1.1;
      high = close + 0.5;
      low = open - 0.3;
    } else if (i === 16) {
      high = 98;
      close = 97.2;
      low = 96.4;
    } else if (i > 16 && i < 24) {
      close = 96 - (i - 16) * 0.35;
      high = close + 0.4;
      low = close - 0.5;
    } else if (i === 30) {
      high = 106;
      close = 105;
      low = 103.8;
    } else if (i > 30 && i < 38) {
      close = 104 - (i - 30) * 0.9;
      high = close + 0.35;
      low = close - 0.45;
    } else if (i >= 38 && i < 42) {
      close = 97.8 - (i - 38) * 0.1;
      high = close + 0.2;
      low = close - 0.35;
    } else if (i === 44) {
      high = 98.5;
      close = 97.8;
      low = 96.7;
    } else if (i > 44 && i < 58) {
      close = 98.2 - (i - 44) * 0.03;
      high = close + 0.35;
      low = close - 0.2;
      if (low < 97.4) low = 97.4;
    } else if (i === 58) {
      close = 98.1;
      high = 98.5;
      low = 97.7;
    } else if (i === 59) {
      close = 89.8;
      high = 90.2;
      low = 89.3;
    } else {
      close = price + (i % 2 ? 0.1 : -0.1);
      high = close + 0.3;
      low = close - 0.3;
    }

    bars.push(bar(i, open, high, low, close));
    price = close;
  }
  return bars;
}

export function buildCupAndHandleBars(): OhlcvBar[] {
  const bars: OhlcvBar[] = [];
  for (let i = 0; i < 60; i++) {
    let close = 100;
    let high = close + 0.3;
    let low = close - 0.3;

    if (i <= 4) {
      close = 100 - i * 0.15;
    } else if (i <= 18) {
      close = 99.4 - (i - 4) * 1.05;
    } else if (i <= 38) {
      close = 83.8 + (i - 18) * 1.05;
    } else if (i <= 50) {
      close = 102.8 + (i - 38) * 0.08;
    } else if (i <= 57) {
      close = 103.2 - (i - 50) * 0.3;
      high = Math.min(close + 0.15, 103.35);
      low = close - 0.2;
    } else if (i === 58) {
      close = 103.5;
      high = 103.7;
      low = 103.2;
    } else if (i === 59) {
      close = 103.95;
      high = 104.2;
      low = 103.6;
    } else {
      close = 100.5;
    }

    high = Math.max(high, close + 0.25);
    low = Math.min(low, close - 0.25);
    bars.push(bar(i, close, high, low, close));
  }
  return bars;
}

export function buildLongBaseBreakoutBars(): OhlcvBar[] {
  const bars: OhlcvBar[] = [];
  for (let i = 0; i < 60; i++) {
    let close = 100 + (i % 7) * 0.15 - 0.45;
    let high = close + 0.35;
    let low = close - 0.35;
    if (i === 59) {
      close = 102.2;
      high = 102.6;
      low = 101.5;
    }
    bars.push(bar(i, close, high, low, close));
  }
  return bars;
}

export function buildLongBaseBreakdownBars(): OhlcvBar[] {
  const up = buildLongBaseBreakoutBars();
  const peak = 130;
  return up.map((b, i) => {
    const invClose = peak - b.close;
    const invHigh = invClose + 0.35;
    const invLow = invClose - 0.35;
    return bar(i, invClose, invHigh, invLow, invClose);
  });
}
