import { prisma } from '../prismaClient.js';
import type { BackfillPriceHistoryResponse } from '@portefeuille/types';
import { getCachedPrice, cachePrice } from '../utils/cache.js';
import { getLogger } from '../utils/logger.js';

type Quote = {
  regularMarketPrice?: number;
  regularMarketTime?: number;
  postMarketPrice?: number;
  postMarketTime?: number;
  preMarketPrice?: number;
  preMarketTime?: number;
  currency?: string;
};

type QuoteResponse = {
  quoteResponse?: {
    result?: Quote[];
    error?: unknown;
  };
};

type SearchQuote = {
  symbol?: string;
  longname?: string;
  shortname?: string;
  exchDisp?: string;
  quoteType?: string;
  score?: number;
};

type SearchResponse = {
  quotes?: SearchQuote[];
};

type ChartResponse = {
  chart?: {
    result?: Array<{
      meta?: {
        regularMarketPrice?: number;
        chartPreviousClose?: number;
        regularMarketTime?: number;
        currency?: string;
        symbol?: string;
      };
      timestamp?: number[];
      indicators?: {
        quote?: Array<{
          close?: Array<number | null>;
        }>;
      };
    }>;
    error?: unknown;
  };
};

const YAHOO_QUOTE_URL = 'https://query2.finance.yahoo.com/v7/finance/quote';
const YAHOO_CHART_URL = 'https://query1.finance.yahoo.com/v8/finance/chart/';
const YAHOO_SEARCH_URL = 'https://query2.finance.yahoo.com/v1/finance/search';
const YAHOO_CRUMB_URL = 'https://query1.finance.yahoo.com/v1/test/getcrumb';
const YAHOO_HOME_URL = 'https://finance.yahoo.com';
const BINANCE_TICKER_URL = 'https://api.binance.com/api/v3/ticker/price?symbol=';
const BINANCE_KLINES_URL = 'https://api.binance.com/api/v3/klines';
const YAHOO_HEADERS = {
  'User-Agent':
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/127.0.0.0 Safari/537.36',
  Accept: 'application/json, text/javascript, */*; q=0.01',
  'Accept-Language': 'en-US,en;q=0.9;fr;q=0.8',
  'Cache-Control': 'no-cache',
  Pragma: 'no-cache',
};

const MARKET_SUFFIXES = ['PA', 'AS', 'MI', 'DE', 'F', 'MC', 'L', 'IR', 'VI'];
const BINANCE_COUNTERS = ['EUR', 'USDT', 'USD', 'BUSD', 'BTC'];
const BINANCE_COUNTERS_SORTED = [...BINANCE_COUNTERS].sort((a, b) => b.length - a.length);

const spotPriceCache = new Map<string, { price: number; fetchedAt: number }>();
const SPOT_CACHE_TTL = 30_000;

const isIsin = (symbol: string) => /^[A-Z]{2}[A-Z0-9]{9}[0-9]$/.test(symbol);

const dedupe = (values: string[]) => Array.from(new Set(values.filter((value) => value.trim().length > 0)));
const normalizeCryptoSymbol = (symbol: string) => symbol.replace(/[^A-Za-z0-9]/g, '').toUpperCase();
const isCashSymbol = (symbol: string) => {
  const upper = symbol.trim().toUpperCase();
  return upper === 'PEA_CASH' || upper === '_PEA_CASH' || upper === 'CASH';
};
const isManualPriceSymbol = (symbol: string | null | undefined) => {
  if (!symbol) {
    return false;
  }
  const trimmed = symbol.trim();
  if (trimmed.length === 0) {
    return false;
  }
  // Symbol purely numérique (ex : parts sociales locales) ou ISIN invalide -> prix manuel
  return /^[0-9]+$/.test(trimmed);
};

const BINANCE_CONVERSION_CONFIG: Record<
  string,
  { pair: string; convert: (price: number, rate: number) => number }
> = {
  EUR: {
    pair: '',
    convert: (price) => price,
  },
  USDT: {
    pair: 'EURUSDT',
    convert: (price, rate) => price / rate,
  },
  USD: {
    pair: 'EURUSDT',
    convert: (price, rate) => price / rate,
  },
  BUSD: {
    pair: 'EURBUSD',
    convert: (price, rate) => price / rate,
  },
  BTC: {
    pair: 'BTCEUR',
    convert: (price, rate) => price * rate,
  },
};

const binanceConversionCache = new Map<string, { price: number; fetchedAt: number }>();
const CONVERSION_CACHE_TTL = 1000 * 60;

class YahooSessionRequiredError extends Error {
  constructor(message = 'Yahoo session required') {
    super(message);
    this.name = 'YahooSessionRequiredError';
  }
}

interface YahooSession {
  cookie: string;
  crumb?: string;
  expiresAt: number;
}

let yahooSession: YahooSession | null = null;
const YAHOO_SESSION_TTL = 1000 * 60 * 30;

const getSetCookies = (headers: Headers) => {
  const rawAccessor = (headers as unknown as { getSetCookie?: () => string[] }).getSetCookie;
  if (typeof rawAccessor === 'function') {
    return rawAccessor.call(headers) as string[];
  }
  const single = headers.get('set-cookie');
  return single ? [single] : [];
};

const extractCookie = (cookies: string[], name: string) => {
  const prefix = `${name}=`;
  const target = cookies.find((cookie) => cookie.startsWith(prefix));
  if (!target) return null;
  return target.split(';')[0];
};

const startYahooSession = async () => {
  const landing = await fetch(YAHOO_HOME_URL, {
    headers: YAHOO_HEADERS,
  });
  const cookies = getSetCookies(landing.headers);
  const cookie = extractCookie(cookies, 'B');
  if (!cookie) {
    throw new Error("Impossible d'initialiser une session Yahoo (cookie manquant).");
  }

  let crumb: string | undefined;
  try {
    const crumbResponse = await fetch(YAHOO_CRUMB_URL, {
      headers: {
        ...YAHOO_HEADERS,
        Cookie: cookie,
      },
    });
    if (crumbResponse.ok) {
      crumb = (await crumbResponse.text()).trim() || undefined;
    }
  } catch {
    crumb = undefined;
  }

  yahooSession = {
    cookie,
    crumb,
    expiresAt: Date.now() + YAHOO_SESSION_TTL,
  };
  return yahooSession;
};

const ensureYahooSession = async (force = false) => {
  if (
    force ||
    !yahooSession ||
    !yahooSession.cookie ||
    yahooSession.expiresAt <= Date.now()
  ) {
    return startYahooSession();
  }
  return yahooSession;
};

const extractPrice = (quote: Quote | undefined) => {
  if (!quote) {
    return { price: null, timestamp: null };
  }
  const price =
    quote.regularMarketPrice ??
    quote.postMarketPrice ??
    quote.preMarketPrice ??
    null;
  const timestamp =
    quote.regularMarketTime ??
    quote.postMarketTime ??
    quote.preMarketTime ??
    null;
  return { price, timestamp };
};

const fetchYahooJson = async (
  path: string,
  params: Record<string, string | undefined>,
  retry = false,
): Promise<unknown> => {
  const session = await ensureYahooSession(retry);
  const url = new URL(path);
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined) {
      url.searchParams.set(key, value);
    }
  });
  if (session?.crumb) {
    url.searchParams.set('crumb', session.crumb);
  }

  const request = async (forceRenew: boolean) => {
    if (forceRenew) {
      await ensureYahooSession(true);
    }
    const activeSession = yahooSession;
    try {
      const response = await fetch(url, {
        headers: {
          ...YAHOO_HEADERS,
          Cookie: activeSession?.cookie ?? '',
          Referer: `${YAHOO_HOME_URL}/quote/${params.symbols ?? ''}`,
        },
        cache: 'no-store',
      });
      if (response.status === 401 && !forceRenew) {
        return request(true);
      }
      if (!response.ok) {
        throw new Error(`Yahoo Finance a renvoyé le statut ${response.status}`);
      }
      return response.json();
    } catch (error) {
      if (!forceRenew) {
        return request(true);
      }
      throw error instanceof Error ? error : new Error(String(error));
    }
  };

  return request(false);
};

const fetchYahooChart = async (symbol: string) => {
  const url = new URL(`${YAHOO_CHART_URL}${encodeURIComponent(symbol)}`);
  url.searchParams.set('range', '1d');
  url.searchParams.set('interval', '1d');
  url.searchParams.set('lang', 'fr-FR');
  url.searchParams.set('region', 'FR');
  url.searchParams.set('includePrePost', 'false');
  url.searchParams.set('useYfid', 'true');
  url.searchParams.set('corsDomain', 'finance.yahoo.com');
  url.searchParams.set('.tsrc', 'finance');

  const response = await fetch(url, {
    headers: YAHOO_HEADERS,
    cache: 'no-store',
  });
  if (!response.ok) {
    throw new Error(`Yahoo Chart a renvoyé le statut ${response.status}`);
  }
  const payload = (await response.json()) as ChartResponse;
  const meta = payload.chart?.result?.[0]?.meta;
  if (!meta) {
    throw new Error('Réponse Yahoo Chart invalide');
  }
  const price =
    meta.regularMarketPrice ??
    meta.chartPreviousClose ??
    null;
  if (price === null || price === undefined || price <= 0) {
    throw new Error('Prix introuvable dans Yahoo Chart');
  }
  const timestamp = meta.regularMarketTime ?? null;
  const priceDate = timestamp ? new Date(timestamp * 1000) : new Date();
  return { price, priceDate };
};

const parseYahooHistoricalSeries = (payload: ChartResponse) => {
  const result = payload.chart?.result?.[0];
  const timestamps = result?.timestamp ?? [];
  const closes = result?.indicators?.quote?.[0]?.close ?? [];
  if (!timestamps.length || !closes.length) {
    throw new Error('Aucune donnǸe historique renvoyǸe par Yahoo');
  }
  const series: Array<{ date: Date; price: number }> = [];
  timestamps.forEach((ts, index) => {
    const rawPrice = closes[index];
    if (rawPrice === null || rawPrice === undefined) {
      return;
    }
    const price = Number(rawPrice);
    if (!Number.isFinite(price) || price <= 0) {
      return;
    }
    series.push({ date: new Date(ts * 1000), price });
  });
  if (series.length === 0) {
    throw new Error('DonnǸes historiques Yahoo vides');
  }
  return series;
};

const createYahooChartUrl = (symbol: string, fromDate: Date) => {
  const startSeconds = Math.floor(fromDate.getTime() / 1000);
  const endSeconds = Math.floor(Date.now() / 1000);
  const url = new URL(`${YAHOO_CHART_URL}${encodeURIComponent(symbol)}`);
  url.searchParams.set('interval', '1d');
  url.searchParams.set('period1', startSeconds.toString());
  url.searchParams.set('period2', endSeconds.toString());
  url.searchParams.set('events', 'history');
  url.searchParams.set('includeAdjustedClose', 'true');
  return url;
};

const fetchYahooHistoricalSeries = async (
  symbol: string,
  fromDate: Date,
  { useSession }: { useSession: boolean },
) => {
  const url = createYahooChartUrl(symbol, fromDate);
  const headers: Record<string, string> = {
    ...YAHOO_HEADERS,
  };

  if (useSession) {
    const session = await ensureYahooSession();
    if (!session?.cookie) {
      throw new Error("Impossible d'initialiser une session Yahoo (cookie manquant).");
    }
    headers.Cookie = session.cookie;
    headers.Referer = `${YAHOO_HOME_URL}/quote/${encodeURIComponent(symbol)}/history`;
    if (session.crumb) {
      url.searchParams.set('crumb', session.crumb);
    }
  }

  const response = await fetch(url, {
    headers,
    cache: 'no-store',
  });

  if (response.status === 401 || response.status === 403) {
    if (useSession) {
      throw new Error(`Yahoo Chart a renvoyǸ le statut ${response.status}`);
    }
    throw new YahooSessionRequiredError(`Yahoo Chart a renvoyǸ le statut ${response.status}`);
  }

  if (!response.ok) {
    throw new Error(`Yahoo Chart a renvoyǸ le statut ${response.status}`);
  }

  const payload = (await response.json()) as ChartResponse;
  return parseYahooHistoricalSeries(payload);
};

const fetchYahooHistoricalPrices = async (symbol: string, fromDate: Date) => {
  try {
    return await fetchYahooHistoricalSeries(symbol, fromDate, { useSession: false });
  } catch (error) {
    const shouldRetryWithSession =
      error instanceof YahooSessionRequiredError ||
      (error instanceof Error && /session/i.test(error.message));
    if (!shouldRetryWithSession) {
      throw error;
    }
    return fetchYahooHistoricalSeries(symbol, fromDate, { useSession: true });
  }
};

const fetchQuoteForSymbol = async (symbol: string) => {
  // Check cache first
  const cached = await getCachedPrice(`yahoo:${symbol}`);
  if (cached !== null) {
    const logger = getLogger();
    logger.debug({ symbol, cachedPrice: cached }, 'Yahoo price from cache');
    return { price: cached, priceDate: new Date() };
  }

  try {
    const chartPayload = await fetchYahooChart(symbol);
    if (chartPayload) {
      // Cache the price
      await cachePrice(`yahoo:${symbol}`, chartPayload.price);
      return chartPayload;
    }
  } catch {
    // ignore and fallback to quote endpoint
  }

  const payload = (await fetchYahooJson(YAHOO_QUOTE_URL, { symbols: symbol })) as QuoteResponse;
  const quote = payload.quoteResponse?.result?.[0];
  const { price, timestamp } = extractPrice(quote);
  if (price === null || price === undefined || price <= 0) {
    throw new Error(`Aucun prix disponible pour ${symbol}`);
  }
  const priceDate = timestamp ? new Date(timestamp * 1000) : new Date();

  // Cache the price
  await cachePrice(`yahoo:${symbol}`, price);

  return { price, priceDate };
};

const searchYahooSymbols = async (symbol: string) => {
  try {
    const url = new URL(YAHOO_SEARCH_URL);
    url.searchParams.set('q', symbol);
    url.searchParams.set('quotesCount', '6');
    url.searchParams.set('newsCount', '0');
    const response = await fetch(url, {
      headers: {
        ...YAHOO_HEADERS,
        Referer: YAHOO_HOME_URL,
      },
      cache: 'no-store',
    });
    if (!response.ok) {
      return [];
    }
    const payload = (await response.json()) as SearchResponse;
    return (
      payload.quotes?.filter((quote) => quote.symbol && quote.quoteType !== 'OPTION')?.map(
        (quote) => quote.symbol as string,
      ) ?? []
    );
  } catch {
    return [];
  }
};

const buildBinancePairs = (symbol: string) => {
  const base = normalizeCryptoSymbol(symbol);
  if (!base) {
    return [];
  }
  const pairs: string[] = [];
  const alreadyHasCounter = BINANCE_COUNTERS.some((counter) => base.endsWith(counter));
  if (alreadyHasCounter) {
    pairs.push(base);
  }
  BINANCE_COUNTERS.forEach((counter) => {
    if (!base.endsWith(counter)) {
      pairs.push(`${base}${counter}`);
    }
  });
  return dedupe(pairs);
};

const detectBinanceCounter = (pair: string) => {
  return BINANCE_COUNTERS_SORTED.find((counter) => pair.endsWith(counter)) ?? null;
};

const fetchBinanceTicker = async (pair: string) => {
  // Check cache first
  const cached = await getCachedPrice(`binance:${pair}`);
  if (cached !== null) {
    const logger = getLogger();
    logger.debug({ pair, cachedPrice: cached }, 'Binance price from cache');
    return { price: cached, priceDate: new Date() };
  }

  const url = `${BINANCE_TICKER_URL}${pair}`;
  const response = await fetch(url, { headers: YAHOO_HEADERS });
  if (!response.ok) {
    throw new Error(`Binance a renvoyé le statut ${response.status}`);
  }
  const payload = (await response.json()) as { price?: string; code?: number; msg?: string };
  if (typeof payload.code === 'number' && payload.code !== 0) {
    throw new Error(payload.msg ?? `Code d'erreur ${payload.code}`);
  }
  const price = payload.price ? Number.parseFloat(payload.price) : NaN;
  if (!Number.isFinite(price)) {
    throw new Error(`Réponse Binance invalide pour ${pair}`);
  }

  // Cache the price
  await cachePrice(`binance:${pair}`, price);

  return { price, priceDate: new Date() };
};

const fetchBinanceQuote = async (pair: string) => {
  const counter = detectBinanceCounter(pair);
  if (!counter) {
    throw new Error(`Impossible de déterminer la devise de contrepartie pour ${pair}`);
  }
  const ticker = await fetchBinanceTicker(pair);
  return { ...ticker, counter };
};

const convertBinancePriceToEur = async (price: number, counter: string) => {
  const config = BINANCE_CONVERSION_CONFIG[counter];
  if (!config) {
    throw new Error(`Conversion EUR indisponible pour ${counter}`);
  }
  if (!config.pair) {
    return price;
  }
  const cached = binanceConversionCache.get(config.pair);
  const now = Date.now();
  let rate = cached?.price;
  if (!rate || !cached || now - cached.fetchedAt > CONVERSION_CACHE_TTL) {
    const ticker = await fetchBinanceTicker(config.pair);
    rate = ticker.price;
    binanceConversionCache.set(config.pair, { price: rate, fetchedAt: now });
  }
  return config.convert(price, rate);
};

const fetchBinanceHistoricalPrices = async (pair: string, fromDate: Date) => {
  const interval = '1d';
  const maxLimit = 1000;
  const series: Array<{ date: Date; price: number }> = [];
  let startTime = fromDate.getTime();
  const endTime = Date.now();

  while (startTime < endTime) {
    const url = new URL(BINANCE_KLINES_URL);
    url.searchParams.set('symbol', pair);
    url.searchParams.set('interval', interval);
    url.searchParams.set('startTime', startTime.toString());
    url.searchParams.set('endTime', endTime.toString());
    url.searchParams.set('limit', String(maxLimit));

    const response = await fetch(url, { headers: YAHOO_HEADERS });
    if (!response.ok) {
      throw new Error(`Binance a renvoyé le statut ${response.status}`);
    }
    const payload = (await response.json()) as Array<[number, string, string, string, string, string, number, string, string, string, string, string]>;
    if (!Array.isArray(payload) || payload.length === 0) {
      break;
    }
    payload.forEach((candle) => {
      const closeTime = candle[6];
      const closePriceRaw = candle[4];
      const price = Number.parseFloat(closePriceRaw);
      if (Number.isFinite(price) && price > 0) {
        series.push({ date: new Date(closeTime), price });
      }
    });
    if (payload.length < maxLimit) {
      break;
    }
    const lastCloseTime = payload[payload.length - 1][6];
    startTime = Number(lastCloseTime) + 1;
  }
  if (series.length === 0) {
    throw new Error('Données historiques Binance vides');
  }
  return series;
};

const fetchCryptoPrice = async (symbol: string) => {
  const candidates = buildBinancePairs(symbol);
  const errors: string[] = [];
  for (const pair of candidates) {
    try {
      const { price, priceDate, counter } = await fetchBinanceQuote(pair);
      const priceInEur = await convertBinancePriceToEur(price, counter);
      return { price: priceInEur, priceDate };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      errors.push(`${pair}: ${message}`);
    }
  }
  throw new Error(`Binance: ${errors.join(' | ')}`);
};

const normaliseTicker = (symbol: string) => symbol.trim().toUpperCase();

// Cash-like assets use a fixed EUR price to avoid external lookups failing.
const STATIC_PRICE_QUOTES: Record<string, { price: number; source: string }> = {
  PEA_CASH: { price: 1, source: 'static' },
  _PEA_CASH: { price: 1, source: 'static' },
};

const getStaticPriceQuote = (symbol: string) => {
  const normalised = symbol.trim().toUpperCase();
  const match = STATIC_PRICE_QUOTES[normalised];
  if (!match) {
    return null;
  }
  return {
    price: match.price,
    priceDate: new Date(),
    source: match.source,
  };
};

export const getSpotPriceInEur = async (symbol: string) => {
  const normalised = normaliseTicker(symbol);
  if (normalised === 'EUR') {
    return { price: 1, priceDate: new Date() };
  }
  const cached = spotPriceCache.get(normalised);
  const now = Date.now();
  if (cached && now - cached.fetchedAt < SPOT_CACHE_TTL) {
    return { price: cached.price, priceDate: new Date() };
  }
  const result = await fetchCryptoPrice(normalised);
  spotPriceCache.set(normalised, { price: result.price, fetchedAt: now });
  return { price: result.price, priceDate: result.priceDate };
};

export const convertAmountToEur = async (symbol: string, amount: number) => {
  const { price } = await getSpotPriceInEur(symbol);
  return price * amount;
};

const buildCandidateSymbols = async (rawSymbol: string, extraQueries: string[] = []) => {
  const trimmed = rawSymbol.trim();
  const upper = trimmed.toUpperCase();
  const staticCandidates: string[] = [trimmed, upper];
  const additionalSearchTerms = extraQueries
    .map((term) => term?.trim?.() ?? '')
    .filter((term) => term.length > 0);

  if (isIsin(upper)) {
    const guesses: string[] = [];
    if (upper.startsWith('FR')) {
      guesses.push(`${upper}.PA`);
    }
    if (upper.startsWith('LU')) {
      guesses.push(`${upper}.AS`, `${upper}.PA`);
    }
    staticCandidates.push(...guesses);
  } else if (!upper.includes('.')) {
    staticCandidates.push(
      ...MARKET_SUFFIXES.map((suffix) => `${upper}.${suffix}`),
      `${upper}-USD`,
      `${upper}-EUR`,
    );
  }

  const queries = dedupe([trimmed, ...additionalSearchTerms]);
  const searchCandidatesResults = await Promise.all(
    queries.map(async (query) => {
      try {
        return await searchYahooSymbols(query);
      } catch {
        return [];
      }
    }),
  );
  const searchCandidates = searchCandidatesResults.flat();
  return dedupe([...staticCandidates, ...searchCandidates]);
};

const fetchYahooHistoricalForSymbol = async (rawSymbol: string, fromDate: Date, extraQueries: string[] = []) => {
  const candidates = await buildCandidateSymbols(rawSymbol, extraQueries);
  const errors: string[] = [];

  for (const candidate of candidates) {
    try {
      const series = await fetchYahooHistoricalPrices(candidate, fromDate);
      if (series.length > 0) {
        return { series, resolvedSymbol: candidate };
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      errors.push(`${candidate}: ${message}`);
    }
  }

  throw new Error(errors.length > 0 ? errors.join(' | ') : 'Aucune donnée historique disponible');
};

const fetchQuote = async (symbol: string, extraQueries: string[] = []) => {
  const candidates = await buildCandidateSymbols(symbol, extraQueries);
  const errors: string[] = [];

  for (const candidate of candidates) {
    try {
      return await fetchQuoteForSymbol(candidate);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      errors.push(`${candidate}: ${message}`);
    }
  }

  if (errors.length > 0) {
    throw new Error(`Impossible de récupérer le prix pour "${symbol}". Essais: ${errors.join(' | ')}`);
  }

  throw new Error(`Aucun prix disponible pour ${symbol}`);
};

const deriveManualPrice = async (assetId: number) => {
  const latestTransaction = await prisma.transaction.findFirst({
    where: { assetId },
    orderBy: { date: 'desc' },
  });
  if (latestTransaction && latestTransaction.price) {
    const numericPrice = Number(latestTransaction.price);
    if (!Number.isNaN(numericPrice) && numericPrice > 0) {
      return {
        price: numericPrice,
        priceDate: new Date(latestTransaction.date),
        source: 'manual-transaction' as const,
      };
    }
  }
  const latestPricePoint = await prisma.pricePoint.findFirst({
    where: { assetId },
    orderBy: { date: 'desc' },
  });
  if (latestPricePoint && latestPricePoint.price) {
    return {
      price: Number(latestPricePoint.price),
      priceDate: latestPricePoint.date,
      source: 'manual-persisted' as const,
    };
  }
  return null;
};

export const refreshAssetPrice = async (assetId: number) => {
  const asset = await prisma.asset.findUnique({ where: { id: assetId } });
  if (!asset) {
    throw new Error('Actif introuvable');
  }

  const errors: string[] = [];
  const assetType = asset.assetType?.toUpperCase();
  const isCrypto = assetType === 'CRYPTO';
  const extraQueries = [asset.name ?? ''].filter((value) => value.trim().length > 0);

  const tryFetch = async () => {
    const staticPrice = getStaticPriceQuote(asset.symbol);
    if (staticPrice) {
      return staticPrice;
    }

    if (isManualPriceSymbol(asset.symbol)) {
      const manual = await deriveManualPrice(asset.id);
      if (manual) {
        return manual;
      }
      throw new Error(`Aucun prix manuel disponible pour ${asset.symbol}`);
    }

    if (isCrypto) {
      try {
        const cryptoQuote = await fetchCryptoPrice(asset.symbol);
        return { ...cryptoQuote, source: 'binance' as const };
      } catch (error) {
        errors.push(error instanceof Error ? error.message : String(error));
      }
    }

    try {
      const yahooQuote = await fetchQuote(asset.symbol, extraQueries);
      return { ...yahooQuote, source: 'yahoo-finance' as const };
    } catch (error) {
      errors.push(error instanceof Error ? error.message : String(error));
    }

    throw new Error(errors.join(' | ') || 'Impossible de récupérer le prix');
  };

  const { price, priceDate, source } = await tryFetch();
  const priceString = price.toString();
  const now = new Date();

  await prisma.$transaction(async (tx) => {
    await tx.pricePoint.upsert({
      where: {
        assetId_date: {
          assetId,
          date: priceDate,
        },
      },
      update: {
        price: priceString,
        source,
      },
      create: {
        assetId,
        date: priceDate,
        price: priceString,
        source,
      },
    });
    await tx.asset.update({
      where: { id: assetId },
      data: { lastPriceUpdateAt: now },
    });
  });

  return {
    assetId,
    price,
    priceDate: priceDate.toISOString(),
    source,
    lastPriceUpdateAt: now.toISOString(),
  };
};

export const refreshAllAssetPrices = async (portfolioId?: number) => {
  const assets = await prisma.asset.findMany({
    where: portfolioId ? { portfolioId } : undefined,
    select: { id: true },
    orderBy: { id: 'asc' },
  });

  const results: Array<{ assetId: number; price: number; priceDate: string; source: string; lastPriceUpdateAt: string }> = [];
  const failures: Array<{ assetId: number; message: string }> = [];

  for (const asset of assets) {
    try {
      const refreshed = await refreshAssetPrice(asset.id);
      results.push(refreshed);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Erreur inconnue';
      failures.push({ assetId: asset.id, message });
    }
  }

  return {
    refreshed: results,
    failures,
  };
};

export const backfillPriceHistory = async (): Promise<BackfillPriceHistoryResponse> => {
  const assets = await prisma.asset.findMany({
    include: {
      transactions: {
        where: { type: 'BUY' },
        orderBy: { date: 'asc' },
      },
    },
    orderBy: { id: 'asc' },
  });

  const processed: BackfillPriceHistoryResponse['processed'] = [];
  const skipped: BackfillPriceHistoryResponse['skipped'] = [];
  const errors: BackfillPriceHistoryResponse['errors'] = [];

  for (const asset of assets) {
    const symbol = asset.symbol ?? '';
    if (isCashSymbol(symbol)) {
      skipped.push({ assetId: asset.id, symbol, reason: 'Actif de trésorerie' });
      continue;
    }

    const firstPurchase = asset.transactions[0];
    if (!firstPurchase) {
      skipped.push({ assetId: asset.id, symbol, reason: 'Aucun achat trouvé' });
      continue;
    }

    const fromDate = firstPurchase.date;
    try {
      let history: Array<{ date: Date; price: number }> = [];
      const assetType = asset.assetType?.toUpperCase();

      if (assetType === 'CRYPTO') {
        const pairs = buildBinancePairs(symbol).filter((pair) => pair.endsWith('EUR'));
        const pairErrors: string[] = [];
        for (const pair of pairs) {
          try {
            history = await fetchBinanceHistoricalPrices(pair, fromDate);
            if (history.length > 0) {
              break;
            }
          } catch (error) {
            pairErrors.push(`${pair}: ${error instanceof Error ? error.message : String(error)}`);
          }
        }
        if (history.length === 0) {
          skipped.push({
            assetId: asset.id,
            symbol,
            reason: pairErrors.length > 0 ? pairErrors.join(' | ') : 'Historique Binance indisponible',
          });
          continue;
        }
      } else {
        const searchTerms = [asset.name ?? ''].filter((value) => value.trim().length > 0);
        const { series } = await fetchYahooHistoricalForSymbol(symbol, fromDate, searchTerms);
        history = series;
      }

      const filtered = history.filter((point) => point.date.getTime() >= fromDate.getTime());
      if (filtered.length === 0) {
        skipped.push({ assetId: asset.id, symbol, reason: 'Aucune donnée historique pertinente' });
        continue;
      }

      for (const point of filtered) {
        await prisma.pricePoint.upsert({
          where: {
            assetId_date: {
              assetId: asset.id,
              date: point.date,
            },
          },
          update: {
            price: point.price.toString(),
            source: assetType === 'CRYPTO' ? 'binance-history' : 'yahoo-history',
          },
          create: {
            assetId: asset.id,
            date: point.date,
            price: point.price.toString(),
            source: assetType === 'CRYPTO' ? 'binance-history' : 'yahoo-history',
          },
        });
      }

      await prisma.asset.update({
        where: { id: asset.id },
        data: { lastPriceUpdateAt: new Date() },
      });

      processed.push({ assetId: asset.id, symbol, pointsInserted: filtered.length });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      errors.push({ assetId: asset.id, symbol, message });
    }
  }

  return {
    processed,
    skipped,
    errors,
  };
};

