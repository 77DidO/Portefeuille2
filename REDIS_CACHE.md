# 🚀 Cache Redis - Guide d'utilisation

## Vue d'ensemble

Le cache Redis permet de stocker temporairement les prix récupérés depuis les APIs externes (Yahoo Finance, Binance) pour améliorer les performances et réduire les appels API.

## Architecture

```
┌─────────────┐        ┌───────────┐        ┌──────────────────┐
│  Frontend   │───────▶│  Backend  │───────▶│ Redis Cache      │
└─────────────┘        └───────────┘        └──────────────────┘
                             │                        │
                             │ Cache miss             │
                             ▼                        │
                       ┌──────────┐                   │
                       │ Yahoo /  │◀──────────────────┘
                       │ Binance  │   Cache hit: <10ms
                       └──────────┘   Cache miss: 100-500ms
```

## Configuration

### Variables d'environnement

Ajoutez ces variables dans `apps/backend/.env` :

```env
# Redis Cache
REDIS_ENABLED=true           # Activer/désactiver le cache
REDIS_HOST=localhost         # Hôte Redis
REDIS_PORT=6379              # Port Redis
PRICE_CACHE_TTL=3600         # Durée de vie en secondes (1 heure)
```

### Démarrage Redis (Développement)

**Option 1 : Docker Compose (recommandé)**
```bash
docker-compose up -d
```

**Option 2 : Installation locale**
```bash
# Windows (avec Chocolatey)
choco install redis-64

# macOS (avec Homebrew)
brew install redis
brew services start redis

# Linux (Ubuntu/Debian)
sudo apt-get install redis-server
sudo systemctl start redis
```

### Vérifier la connexion

```bash
# Tester Redis
redis-cli ping
# Devrait retourner: PONG

# Vérifier les clés en cache
redis-cli keys "price:*"

# Voir les statistiques
redis-cli info stats
```

## Fonctionnement

### Flux de récupération de prix

1. **Requête de prix** pour un symbole (ex: `AAPL`, `BTCEUR`)
2. **Vérification cache** :
   - Si clé `yahoo:AAPL` ou `binance:BTCEUR` existe → retour immédiat
   - Si clé inexistante ou expirée → appel API externe
3. **Stockage en cache** :
   - Clé : `yahoo:SYMBOL` ou `binance:PAIR`
   - Valeur : prix (nombre)
   - TTL : `PRICE_CACHE_TTL` secondes
4. **Retour au client**

### Clés utilisées

| Source         | Format de clé          | Exemple             |
|----------------|------------------------|---------------------|
| Yahoo Finance  | `yahoo:SYMBOL`         | `yahoo:AAPL`        |
| Binance        | `binance:PAIR`         | `binance:BTCEUR`    |

## API du cache

### Fonctions disponibles

#### `initializeRedis()`
Initialise la connexion Redis au démarrage du serveur.

```typescript
import { initializeRedis } from './utils/cache.js';
initializeRedis();
```

#### `cachePrice(symbol, price, ttl?)`
Stocke un prix en cache.

```typescript
await cachePrice('yahoo:AAPL', 150.25);
await cachePrice('binance:BTCEUR', 42000, 1800); // TTL personnalisé: 30 min
```

#### `getCachedPrice(symbol)`
Récupère un prix depuis le cache.

```typescript
const price = await getCachedPrice('yahoo:AAPL');
if (price !== null) {
  console.log('Prix en cache:', price);
}
```

#### `invalidatePriceCache(symbol)`
Invalide le cache pour un symbole spécifique.

```typescript
await invalidatePriceCache('yahoo:AAPL');
```

#### `invalidateAllPrices()`
Supprime tous les prix en cache.

```typescript
await invalidateAllPrices();
```

#### `getCacheStats()`
Récupère les statistiques du cache.

```typescript
const stats = await getCacheStats();
console.log(stats);
// { connected: true, keys: 42, memory: '1.5M' }
```

#### `closeRedis()`
Ferme proprement la connexion Redis (graceful shutdown).

```typescript
await closeRedis();
```

## Intégration dans priceUpdateService

### Avant (sans cache)
```typescript
const fetchBinanceTicker = async (pair: string) => {
  const response = await fetch(`${BINANCE_TICKER_URL}${pair}`);
  const data = await response.json();
  return { price: parseFloat(data.price), priceDate: new Date() };
};
```

### Après (avec cache)
```typescript
const fetchBinanceTicker = async (pair: string) => {
  // Vérifier le cache
  const cached = await getCachedPrice(`binance:${pair}`);
  if (cached !== null) {
    return { price: cached, priceDate: new Date() };
  }

  // Appel API
  const response = await fetch(`${BINANCE_TICKER_URL}${pair}`);
  const data = await response.json();
  const price = parseFloat(data.price);

  // Stocker en cache
  await cachePrice(`binance:${pair}`, price);

  return { price, priceDate: new Date() };
};
```

## Monitoring

### Logs

Le cache génère des logs pour le débogage :

```json
{
  "level": "info",
  "msg": "Redis connected",
  "host": "localhost",
  "port": 6379
}

{
  "level": "debug",
  "msg": "Price retrieved from cache",
  "symbol": "AAPL",
  "price": "150.25"
}

{
  "level": "debug",
  "msg": "Price cached",
  "symbol": "BTCEUR",
  "price": "42000",
  "ttl": 3600
}
```

### Métriques de performance

**Sans cache :**
- Temps de réponse moyen : 200-500ms
- Appels API par minute : 10-50
- Risque de rate limiting : Élevé

**Avec cache (après warm-up) :**
- Temps de réponse moyen : 5-10ms (95%+ cache hit)
- Appels API par minute : 1-5
- Risque de rate limiting : Faible

## Graceful Degradation

Si Redis n'est pas disponible, l'application fonctionne normalement :
- Les fonctions de cache retournent `null` (cache miss)
- Les appels API externes fonctionnent comme avant
- Logs d'avertissement : `Redis connection error - cache disabled`

**Exemple :**
```typescript
// Redis non disponible
const cached = await getCachedPrice('yahoo:AAPL'); // retourne null
// L'application fait l'appel API Yahoo Finance normalement
```

## Bonnes pratiques

### 1. TTL adapté aux données

```env
# Prix temps réel (crypto)
PRICE_CACHE_TTL=300      # 5 minutes

# Prix end-of-day (actions)
PRICE_CACHE_TTL=3600     # 1 heure

# Données historiques
PRICE_CACHE_TTL=86400    # 24 heures
```

### 2. Invalidation sélective

Invalider le cache après une mise à jour manuelle de prix :

```typescript
// Après modification manuelle d'un prix
await prisma.pricePoint.update({ ... });
await invalidatePriceCache(`yahoo:${asset.symbol}`);
```

### 3. Warm-up du cache

Au démarrage de l'application, pré-charger les prix fréquemment utilisés :

```typescript
// Script de warm-up
const popularSymbols = ['AAPL', 'BTCEUR', 'MSFT'];
for (const symbol of popularSymbols) {
  await refreshAssetPrice(symbol);
}
```

## Dépannage

### Redis ne démarre pas (Docker)

```bash
# Vérifier les logs
docker-compose logs redis

# Redémarrer le conteneur
docker-compose restart redis

# Recréer le conteneur
docker-compose down
docker-compose up -d
```

### Cache non utilisé

1. Vérifier la connexion :
```bash
redis-cli ping
```

2. Vérifier les logs backend :
```bash
npm run dev --workspace backend
# Chercher : "Redis connected" ou "Redis connection error"
```

3. Vérifier la configuration :
```bash
# apps/backend/.env
REDIS_ENABLED=true
```

### Performances dégradées

1. Vérifier la taille du cache :
```bash
redis-cli dbsize
redis-cli info memory
```

2. Réduire le TTL si trop de clés :
```env
PRICE_CACHE_TTL=1800  # 30 minutes au lieu d'1 heure
```

3. Nettoyer le cache :
```bash
redis-cli FLUSHDB
```

## Production

### Configuration recommandée

```env
NODE_ENV=production
REDIS_ENABLED=true
REDIS_HOST=redis.your-domain.com
REDIS_PORT=6379
REDIS_PASSWORD=your-secure-password  # À ajouter dans env.ts
PRICE_CACHE_TTL=3600
LOG_LEVEL=info
LOG_PRETTY=false
```

### Sécurité

1. **Authentification** : Ajouter un mot de passe Redis
2. **Réseau** : Isoler Redis dans un réseau privé
3. **Chiffrement** : Utiliser TLS pour les connexions Redis
4. **Monitoring** : Surveiller l'utilisation mémoire et CPU

### Scalabilité

Pour gérer plus de trafic :
- Augmenter la mémoire Redis
- Utiliser Redis Cluster pour distribution
- Configurer Redis en mode AOF pour persistance
- Mettre en place des réplicas Redis

## Ressources

- [Documentation Redis](https://redis.io/docs/)
- [Documentation ioredis](https://github.com/redis/ioredis)
- [Best practices Redis](https://redis.io/docs/manual/patterns/)
