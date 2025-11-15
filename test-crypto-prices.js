// Script de test pour vérifier les prix crypto
console.log('🔍 Test des prix crypto - Comparaison avec le marché réel\n');

// Test direct des APIs Binance
const testBinancePrices = async () => {
  const cryptos = ['BTC', 'ETH', 'BNB', 'SOL', 'LINK'];
  const pairs = ['EUR', 'USDT'];
  
  console.log('📊 Prix Binance directs:\n');
  
  for (const crypto of cryptos) {
    console.log(`--- ${crypto} ---`);
    
    for (const pair of pairs) {
      const symbol = `${crypto}${pair}`;
      try {
        const response = await fetch(`https://api.binance.com/api/v3/ticker/price?symbol=${symbol}`);
        const data = await response.json();
        
        if (data.price) {
          console.log(`${symbol}: ${parseFloat(data.price).toFixed(2)} ${pair}`);
        } else {
          console.log(`${symbol}: N/A`);
        }
      } catch (error) {
        console.log(`${symbol}: ERREUR`);
      }
    }
    console.log('');
  }
};

// Test conversion EUR/USDT
const testConversion = async () => {
  console.log('💱 Taux de conversion EUR/USDT:');
  try {
    const response = await fetch('https://api.binance.com/api/v3/ticker/price?symbol=EURUSDT');
    const data = await response.json();
    console.log(`EURUSDT: ${data.price}\n`);
  } catch (error) {
    console.log('ERREUR récupération taux EUR/USDT\n');
  }
};

// Exécution
testConversion().then(() => testBinancePrices()).catch(console.error);