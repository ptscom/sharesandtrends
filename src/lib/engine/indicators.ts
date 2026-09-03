import {
  ADL,
  ADX,
  ATR,
  AwesomeOscillator,
  BollingerBands,
  CCI,
  EMA,
  ForceIndex,
  KeltnerChannels,
  KST,
  MACD,
  MFI,
  OBV,
  PSAR,
  ROC,
  RSI,
  SD,
  SMA,
  Stochastic,
  StochasticRSI,
  TRIX,
  VWAP,
  WEMA,
  WMA,
  WilliamsR,
  Highest,
  Lowest,
} from "technicalindicators";
import type { IndicatorDef, IndicatorSeries, OhlcvBar } from "@/lib/types";
import { alignHigherTimeframe, barsToSource, resampleBars } from "./resample";
import { getIndicatorDefinition } from "./registry";
import { detectCandlePatternSeries } from "./candle-patterns";

function padStart(values: number[], total: number): (number | null)[] {
  const pad = total - values.length;
  if (pad <= 0) return values;
  return [...Array(pad).fill(null), ...values];
}

function priorRolling(
  bars: OhlcvBar[],
  period: number,
  field: "high" | "low",
): (number | null)[] {
  return bars.map((_, i) => {
    if (i < period) return null;
    const slice = bars.slice(i - period, i);
    return field === "high"
      ? Math.max(...slice.map((b) => b.high))
      : Math.min(...slice.map((b) => b.low));
  });
}

function computeOnBars(
  bars: OhlcvBar[],
  def: IndicatorDef,
): IndicatorSeries {
  const type = def.type;
  const params = def.params;
  const source = (params.source as string) ?? def.source ?? "close";
  const input = barsToSource(bars, source as "close");
  const closes = bars.map((b) => b.close);
  const highs = bars.map((b) => b.high);
  const lows = bars.map((b) => b.low);
  const volumes = bars.map((b) => b.volume);

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
      const upper = [...nulls, ...bb.map((b) => b.upper)];
      const middle = [...nulls, ...bb.map((b) => b.middle)];
      const lower = [...nulls, ...bb.map((b) => b.lower)];
      result[`${def.alias}_upper`] = upper;
      result[`${def.alias}_middle`] = middle;
      result[`${def.alias}_lower`] = lower;
      result[`${def.alias}_percent_b`] = closes.map((c, i) => {
        const u = upper[i];
        const l = lower[i];
        if (u == null || l == null || u === l) return null;
        return (c - l) / (u - l);
      });
      result[def.alias] = middle;
      break;
    }
    case "atr": {
      const length = Number(params.length ?? 14);
      const atr = ATR.calculate({
        high: highs,
        low: lows,
        close: closes,
        period: length,
      });
      result[def.alias] = padStart(atr, bars.length);
      break;
    }
    case "adx": {
      const period = Number(params.length ?? 14);
      const adx = ADX.calculate({
        high: highs,
        low: lows,
        close: closes,
        period,
      });
      const pad = bars.length - adx.length;
      const nulls = Array(pad).fill(null);
      result[`${def.alias}_adx`] = [...nulls, ...adx.map((a) => a.adx ?? null)];
      result[`${def.alias}_pdi`] = [...nulls, ...adx.map((a) => a.pdi ?? null)];
      result[`${def.alias}_mdi`] = [...nulls, ...adx.map((a) => a.mdi ?? null)];
      result[def.alias] = result[`${def.alias}_adx`];
      break;
    }
    case "stochastic": {
      const period = Number(params.period ?? 14);
      const signal = Number(params.signal ?? 3);
      const stoch = Stochastic.calculate({
        high: highs,
        low: lows,
        close: closes,
        period,
        signalPeriod: signal,
      });
      const pad = bars.length - stoch.length;
      const nulls = Array(pad).fill(null);
      result[`${def.alias}_k`] = [...nulls, ...stoch.map((s) => s.k)];
      result[`${def.alias}_d`] = [...nulls, ...stoch.map((s) => s.d)];
      result[def.alias] = result[`${def.alias}_k`];
      break;
    }
    case "williamsr": {
      const length = Number(params.length ?? 14);
      const wr = WilliamsR.calculate({
        high: highs,
        low: lows,
        close: closes,
        period: length,
      });
      result[def.alias] = padStart(wr, bars.length);
      break;
    }
    case "cci": {
      const length = Number(params.length ?? 20);
      const cci = CCI.calculate({
        high: highs,
        low: lows,
        close: closes,
        period: length,
      });
      result[def.alias] = padStart(cci, bars.length);
      break;
    }
    case "roc": {
      const length = Number(params.length ?? 20);
      const roc = ROC.calculate({ period: length, values: input });
      result[def.alias] = padStart(roc, bars.length);
      break;
    }
    case "mfi": {
      const length = Number(params.length ?? 14);
      const mfi = MFI.calculate({
        high: highs,
        low: lows,
        close: closes,
        volume: volumes,
        period: length,
      });
      result[def.alias] = padStart(mfi, bars.length);
      break;
    }
    case "obv": {
      const obv = OBV.calculate({ close: closes, volume: volumes });
      result[def.alias] = padStart(obv, bars.length);
      break;
    }
    case "psar": {
      const step = Number(params.step ?? 0.02);
      const max = Number(params.max ?? 0.2);
      const psar = PSAR.calculate({
        high: highs,
        low: lows,
        step,
        max,
      });
      result[def.alias] = padStart(psar, bars.length);
      break;
    }
    case "trix": {
      const length = Number(params.length ?? 15);
      const signalPeriod = Number(params.signal ?? 9);
      const trix = TRIX.calculate({ period: length, values: input });
      const padded = padStart(trix, bars.length) as number[];
      const signal = padStart(
        SMA.calculate({
          period: signalPeriod,
          values: padded.filter((v): v is number => v != null),
        }),
        bars.length,
      );
      result[def.alias] = padded;
      result[`${def.alias}_signal`] = signal;
      break;
    }
    case "keltner": {
      const maPeriod = Number(params.maPeriod ?? 20);
      const atrPeriod = Number(params.atrPeriod ?? 20);
      const multiplier = Number(params.multiplier ?? 2);
      const kc = KeltnerChannels.calculate({
        maPeriod,
        atrPeriod,
        useSMA: false,
        multiplier,
        high: highs,
        low: lows,
        close: closes,
      });
      const pad = bars.length - kc.length;
      const nulls = Array(pad).fill(null);
      result[`${def.alias}_upper`] = [...nulls, ...kc.map((k) => k.upper)];
      result[`${def.alias}_middle`] = [...nulls, ...kc.map((k) => k.middle)];
      result[`${def.alias}_lower`] = [...nulls, ...kc.map((k) => k.lower)];
      result[def.alias] = result[`${def.alias}_middle`];
      break;
    }
    case "rolling_high": {
      const length = Number(params.length ?? 20);
      result[def.alias] = priorRolling(bars, length, "high");
      break;
    }
    case "rolling_low": {
      const length = Number(params.length ?? 20);
      result[def.alias] = priorRolling(bars, length, "low");
      break;
    }
    case "momentum": {
      const length = Number(params.length ?? 126);
      result[def.alias] = input.map((c, i) => {
        if (i < length) return null;
        const prev = input[i - length];
        return prev ? (c / prev - 1) * 100 : null;
      });
      break;
    }
    case "zscore": {
      const length = Number(params.length ?? 20);
      const sma = SMA.calculate({ period: length, values: input });
      const pad = bars.length - sma.length;
      const nulls = Array(pad).fill(null);
      const means = [...nulls, ...sma];
      result[def.alias] = input.map((c, i) => {
        const mean = means[i];
        if (mean == null || i < length - 1) return null;
        const slice = input.slice(i - length + 1, i + 1);
        const variance =
          slice.reduce((sum, v) => sum + (v - mean) ** 2, 0) / length;
        const std = Math.sqrt(variance);
        return std > 0 ? (c - mean) / std : 0;
      });
      break;
    }
    case "envelope": {
      const length = Number(params.length ?? 20);
      const pct = Number(params.pct ?? 3);
      const sma = padStart(
        SMA.calculate({ period: length, values: input }),
        bars.length,
      );
      result[`${def.alias}_middle`] = sma;
      result[`${def.alias}_upper`] = sma.map((v) =>
        v == null ? null : v * (1 + pct / 100),
      );
      result[`${def.alias}_lower`] = sma.map((v) =>
        v == null ? null : v * (1 - pct / 100),
      );
      result[def.alias] = sma;
      break;
    }
    case "volume_sma": {
      const length = Number(params.length ?? 20);
      result[def.alias] = padStart(
        SMA.calculate({ period: length, values: volumes }),
        bars.length,
      );
      break;
    }
    case "candle_pattern": {
      const pattern = String(params.pattern ?? "doji");
      const bodyRatio = Number(params.bodyRatio ?? 0.1);
      const shadowRatio = Number(params.shadowRatio ?? 2);
      result[def.alias] = detectCandlePatternSeries(bars, pattern, {
        bodyRatioMax: bodyRatio,
        shadowRatioMin: shadowRatio,
      });
      break;
    }
    case "wma": {
      const length = Number(params.length ?? 20);
      result[def.alias] = padStart(
        WMA.calculate({ period: length, values: input }),
        bars.length,
      );
      break;
    }
    case "wema": {
      const length = Number(params.length ?? 14);
      result[def.alias] = padStart(
        WEMA.calculate({ period: length, values: input }),
        bars.length,
      );
      break;
    }
    case "stoch_rsi": {
      const rsiPeriod = Number(params.rsiPeriod ?? 14);
      const stochasticPeriod = Number(params.stochasticPeriod ?? 14);
      const kPeriod = Number(params.kPeriod ?? 3);
      const dPeriod = Number(params.dPeriod ?? 3);
      const stochRsi = StochasticRSI.calculate({
        values: input,
        rsiPeriod,
        stochasticPeriod,
        kPeriod,
        dPeriod,
      });
      const pad = bars.length - stochRsi.length;
      const nulls = Array(pad).fill(null);
      result[`${def.alias}_stochRSI`] = [
        ...nulls,
        ...stochRsi.map((s) => s.stochRSI ?? null),
      ];
      result[`${def.alias}_k`] = [
        ...nulls,
        ...stochRsi.map((s) => s.k ?? null),
      ];
      result[`${def.alias}_d`] = [
        ...nulls,
        ...stochRsi.map((s) => s.d ?? null),
      ];
      result[def.alias] = result[`${def.alias}_stochRSI`];
      break;
    }
    case "awesome_oscillator": {
      const fastPeriod = Number(params.fastPeriod ?? 5);
      const slowPeriod = Number(params.slowPeriod ?? 34);
      const ao = AwesomeOscillator.calculate({
        high: highs,
        low: lows,
        fastPeriod,
        slowPeriod,
      });
      result[def.alias] = padStart(ao, bars.length);
      break;
    }
    case "force_index": {
      const length = Number(params.length ?? 13);
      const fi = ForceIndex.calculate({
        close: closes,
        volume: volumes,
        period: length,
      });
      result[def.alias] = padStart(fi, bars.length);
      break;
    }
    case "vwap": {
      const vwap = VWAP.calculate({
        high: highs,
        low: lows,
        close: closes,
        volume: volumes,
      });
      result[def.alias] = padStart(vwap, bars.length);
      break;
    }
    case "kst": {
      const signalPeriod = Number(params.signalPeriod ?? 9);
      const kst = KST.calculate({
        values: input,
        ROCPer1: 10,
        ROCPer2: 15,
        ROCPer3: 20,
        ROCPer4: 30,
        SMAROCPer1: 10,
        SMAROCPer2: 10,
        SMAROCPer3: 10,
        SMAROCPer4: 15,
        signalPeriod,
      });
      const pad = bars.length - kst.length;
      const nulls = Array(pad).fill(null);
      result[`${def.alias}_kst`] = [...nulls, ...kst.map((k) => k.kst ?? null)];
      result[`${def.alias}_signal`] = [
        ...nulls,
        ...kst.map((k) => k.signal ?? null),
      ];
      result[def.alias] = result[`${def.alias}_kst`];
      break;
    }
    case "adl": {
      const adl = ADL.calculate({
        high: highs,
        low: lows,
        close: closes,
        volume: volumes,
      });
      result[def.alias] = padStart(adl, bars.length);
      break;
    }
    case "stddev": {
      const length = Number(params.length ?? 20);
      const sd = SD.calculate({ period: length, values: input });
      result[def.alias] = padStart(sd, bars.length);
      break;
    }
    case "highest": {
      const length = Number(params.length ?? 20);
      const highest = Highest.calculate({ period: length, values: input });
      result[def.alias] = padStart(highest, bars.length);
      break;
    }
    case "lowest": {
      const length = Number(params.length ?? 20);
      const lowest = Lowest.calculate({ period: length, values: input });
      result[def.alias] = padStart(lowest, bars.length);
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
