import { initializeRedis } from './apps/backend/src/utils/cache.ts';

async function main() {
  const redis = initializeRedis();
  if (!redis) {
    console.error('Redis non disponible');
    process.exit(1);
  }
  await new Promise((resolve) => setTimeout(resolve, 1000)); // attendre la connexion
  const keys = await redis.keys('price:*');
  console.log('Clés price:* dans Redis:', keys);
  process.exit(0);
}

main();
