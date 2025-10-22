import fetch from 'node-fetch';
const headers = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/127.0.0.0 Safari/537.36',
  Accept: 'application/json, text/javascript, */*; q=0.01',
  'Accept-Language': 'en-US,en;q=0.9;fr;q=0.8',
  'Cache-Control': 'no-cache',
  Pragma: 'no-cache',
  Referer: 'https://finance.yahoo.com',
};
const url = new URL('https://query2.finance.yahoo.com/v1/finance/search');
url.searchParams.set('q', 'FR0013412012');
fetch(url, { headers }).then(async (res) => {
  console.log('status', res.status);
  const text = await res.text();
  console.log(text.slice(0, 200));
}).catch((err) => console.error('error', err));
