// Test comportement exact pour BTC
console.log('🔍 Test spécifique BTC - Debug du problème\n');

const testBTCPairs = async () => {
  const pairs = ['BTC', 'BTCEUR', 'BTCUSDT'];
  
  for (const pair of pairs) {
    console.log(`--- Test ${pair} ---`);
    try {
      const response = await fetch(`https://api.binance.com/api/v3/ticker/price?symbol=${pair}`);
      const data = await response.json();
      
      if (data.price) {
        console.log(`✅ ${pair}: ${data.price}`);
      } else if (data.code) {
        console.log(`❌ ${pair}: Code ${data.code} - ${data.msg}`);
      } else {
        console.log(`❓ ${pair}: Réponse: ${JSON.stringify(data)}`);
      }
    } catch (error) {
      console.log(`💥 ${pair}: ERREUR - ${error.message}`);
    }
  }
};

testBTCPairs().catch(console.error);