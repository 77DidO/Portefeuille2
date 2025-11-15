// Script pour tester exactement quelles paires ton backend utilise
console.log('🔧 Test du buildBinancePairs - Comme dans ton backend\n');

const BINANCE_COUNTERS = ['EUR', 'USDT', 'USD', 'BUSD', 'BTC'];

const normalizeCryptoSymbol = (symbol) => {
  const trimmed = symbol?.trim()?.toUpperCase();
  if (!trimmed) return null;
  if (trimmed === 'BNB') return 'BNB';
  return trimmed;
};

const dedupe = (array) => [...new Set(array)];

const buildBinancePairs = (symbol) => {
  const base = normalizeCryptoSymbol(symbol);
  if (!base) return [];
  
  const pairs = [];
  // Special case: BTC alone is not a valid Binance pair, skip it
  const alreadyHasCounter = BINANCE_COUNTERS.some((counter) => base.endsWith(counter));
  
  if (alreadyHasCounter && base !== 'BTC') {
    pairs.push(base);
  }
  
  BINANCE_COUNTERS.forEach((counter) => {
    if (!base.endsWith(counter)) {
      pairs.push(`${base}${counter}`);
    }
  });
  
  return dedupe(pairs);
};

// Test pour chaque crypto
const cryptos = ['BTC', 'ETH', 'BNB', 'SOL', 'LINK'];

cryptos.forEach(crypto => {
  const pairs = buildBinancePairs(crypto);
  console.log(`${crypto} → Paires testées: [${pairs.join(', ')}]`);
});

console.log('\n🎯 Premier essai prioritaire pour chaque crypto:');
cryptos.forEach(crypto => {
  const pairs = buildBinancePairs(crypto);
  console.log(`${crypto} → ${pairs[0]} (priorité)`);
});