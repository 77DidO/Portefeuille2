import { getRedis } from './apps/backend/src/utils/cache.js';

async function main() {
  const redis = getRedis();
  if (!redis) {
    console.error('Redis non disponible');
    process.exit(1);
  }
  const keys = await redis.keys('price:*');
  console.log('Clés price:* dans Redis:', keys);
  process.exit(0);
}

main();
