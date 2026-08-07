import {
  ATR,
  BollingerBands,
  EMA,
  MACD,
  RSI,
  SMA,
} from "technicalindicators";
import type { IndicatorDef, IndicatorSeries, OhlcvBar } from "@/lib/types";
import { alignHigherTimeframe, barsToSource, resampleBars } from "./resample";
import { getIndicatorDefinition } from "./registry";

function padStart(values: number[], total: number): (number | null)[] {
  const pad = total - values.length;
  if (pad <= 0) return values;
  return [...Array(pad).fill(null), ...values];
}

function computeOnBars(
  bars: OhlcvBar[],
  def: IndicatorDef,
): IndicatorSeries {
  const type = def.type;
  const params = def.params;
  const source = (params.source as string) ?? def.source ?? "close";
  const input = barsToSource(bars, source as "close");

  const result: IndicatorSeries = {};

  switch (type) {
    case "sma": {
      const length = Number(params.length ?? 20);
      result[def.alias] = padStart(
        SMA.calculate({ period: length, values: input }),
        bars.length,
      );
      break;
    }
    case "ema": {
      const length = Number(params.length ?? 20);
      result[def.alias] = padStart(
        EMA.calculate({ period: length, values: input }),
        bars.length,
      );
      break;
    }
    case "rsi": {
      const length = Number(params.length ?? 14);
      result[def.alias] = padStart(
        RSI.calculate({ period: length, values: input }),
        bars.length,
      );
      break;
    }
    case "macd": {
      const fast = Number(params.fast ?? 12);
      const slow = Number(params.slow ?? 26);
      const signal = Number(params.signal ?? 9);
      const macd = MACD.calculate({
        values: input,
        fastPeriod: fast,
        slowPeriod: slow,
        signalPeriod: signal,
        SimpleMAOscillator: false,
        SimpleMASignal: false,
      });
      const pad = bars.length - macd.length;
      const nulls = Array(pad).fill(null);
      result[`${def.alias}_macd`] = [
        ...nulls,
        ...macd.map((m) => m.MACD ?? null),
      ];
      result[`${def.alias}_signal`] = [
        ...nulls,
        ...macd.map((m) => m.signal ?? null),
      ];
      result[`${def.alias}_histogram`] = [
        ...nulls,
        ...macd.map((m) => m.histogram ?? null),
      ];
      result[def.alias] = result[`${def.alias}_macd`];
      break;
    }
    case "bb": {
      const length = Number(params.length ?? 20);
      const stdDev = Number(params.stdDev ?? 2);
      const bb = BollingerBands.calculate({
        period: length,
        stdDev,
        values: input,
      });
      const pad = bars.length - bb.length;
      const nulls = Array(pad).fill(null);
      result[`${def.alias}_upper`] = [...nulls, ...bb.map((b) => b.upper)];
      result[`${def.alias}_middle`] = [...nulls, ...bb.map((b) => b.middle)];
      result[`${def.alias}_lower`] = [...nulls, ...bb.map((b) => b.lower)];
      result[def.alias] = result[`${def.alias}_middle`];
      break;
    }
    case "atr": {
      const length = Number(params.length ?? 14);
      const atr = ATR.calculate({
        high: bars.map((b) => b.high),
        low: bars.map((b) => b.low),
        close: bars.map((b) => b.close),
        period: length,
      });
      result[def.alias] = padStart(atr, bars.length);
      break;
    }
    default:
      throw new Error(`Unknown indicator type: ${type}`);
  }

  return result;
}

export function computeIndicators(
  dailyBars: OhlcvBar[],
  indicators: IndicatorDef[],
): { dates: string[]; bars: OhlcvBar[]; series: IndicatorSeries } {
  const dates = dailyBars.map((b) => b.date);
  const series: IndicatorSeries = {
    open: dailyBars.map((b) => b.open),
    high: dailyBars.map((b) => b.high),
    low: dailyBars.map((b) => b.low),
    close: dailyBars.map((b) => b.close),
    volume: dailyBars.map((b) => b.volume),
  };

  for (const def of indicators) {
    if (!getIndicatorDefinition(def.type)) {
      throw new Error(`Indicator not in registry: ${def.type}`);
    }

    const tf = def.timeframe ?? "1D";

    if (tf === "1D") {
      Object.assign(series, computeOnBars(dailyBars, def));
      continue;
    }

    const resampled = resampleBars(dailyBars, tf);
    const htfSeries = computeOnBars(resampled, def);
    const htfDates = resampled.map((b) => b.date);

    for (const [key, values] of Object.entries(htfSeries)) {
      const alias = key === def.alias ? def.alias : key;
      series[alias] = alignHigherTimeframe(
        dates,
        htfDates,
        values as (number | null)[],
      );
    }
  }

  return { dates, bars: dailyBars, series };
}
