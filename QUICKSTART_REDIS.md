# 🚀 Démarrage Rapide - Cache Redis

Ce guide vous permet de mettre en route le cache Redis en quelques minutes.

## Étape 1 : Démarrer Redis

### Option A : Docker Compose (Recommandé)

```bash
# Démarrer Redis en arrière-plan
docker-compose up -d

# Vérifier que Redis fonctionne
docker-compose ps
```

### Option B : Installation locale

**Windows (PowerShell en admin) :**
```powershell
# Avec Chocolatey
choco install redis-64
redis-server
```

**macOS :**
```bash
brew install redis
brew services start redis
```

**Linux (Ubuntu/Debian) :**
```bash
sudo apt-get update
sudo apt-get install redis-server
sudo systemctl start redis
```

## Étape 2 : Tester Redis

```bash
# Test de connexion
redis-cli ping
# ➜ PONG

# Lancer le script de test complet
npm run test:cache
```

## Étape 3 : Configurer l'application

Les variables sont déjà configurées dans `apps/backend/.env` avec des valeurs par défaut :

```env
REDIS_ENABLED=true
REDIS_HOST=127.0.0.1
REDIS_PORT=6379
PRICE_CACHE_TTL=3600
```

## Étape 4 : Démarrer l'application

```bash
npm run dev
```

Vous devriez voir dans les logs :
```
[INFO] Redis connected { host: 'localhost', port: 6379 }
[INFO] API portefeuille démarrée { port: 4000, env: 'development' }
```

## Étape 5 : Vérifier le cache

### Méthode 1 : Via l'API

```bash
# Obtenir les statistiques du cache
curl http://localhost:4000/api/system/cache/stats

# Résultat attendu :
# { "connected": true, "keys": 0, "memory": "1.2M" }
```

### Méthode 2 : Via Redis CLI

```bash
# Voir toutes les clés de prix
redis-cli keys "price:*"

# Voir une clé spécifique
redis-cli get "yahoo:AAPL"

# Statistiques Redis
redis-cli info stats
```

## Étape 6 : Tester le cache en action

1. **Rafraîchir le prix d'un actif** (via l'interface ou l'API)
2. **Observer les logs** :
   ```
   [DEBUG] Price cached { symbol: 'AAPL', price: 150.25, ttl: 3600 }
   ```
3. **Rafraîchir à nouveau** (< 1 heure après)
4. **Observer le cache hit** :
   ```
   [DEBUG] Price retrieved from cache { symbol: 'AAPL', price: 150.25 }
   ```

## Commandes utiles

### Gestion Docker

```bash
# Voir les logs Redis
docker-compose logs redis

# Redémarrer Redis
docker-compose restart redis

# Arrêter Redis
docker-compose down

# Supprimer les données Redis (volume)
docker-compose down -v
```

### Gestion du cache

```bash
# Vider tout le cache
curl -X DELETE http://localhost:4000/api/system/cache

# Vider le cache d'un symbole
curl -X DELETE http://localhost:4000/api/system/cache/yahoo:AAPL

# Voir les statistiques
curl http://localhost:4000/api/system/cache/stats
```

### Monitoring Redis

```bash
# Mode monitor (temps réel)
redis-cli monitor

# Statistiques détaillées
redis-cli info all

# Nombre de clés
redis-cli dbsize

# Mémoire utilisée
redis-cli info memory | grep used_memory_human
```

## Désactiver le cache

Si vous voulez désactiver temporairement le cache sans arrêter Redis :

```env
# apps/backend/.env
REDIS_ENABLED=false
```

Redémarrez l'application : `npm run dev`

## Troubleshooting

### Redis refuse de démarrer (Docker)

```bash
# Vérifier les ports utilisés
netstat -ano | findstr :6379  # Windows
lsof -i :6379                 # macOS/Linux

# Si le port est occupé, arrêter l'autre instance
docker-compose down
```

### L'application ne se connecte pas à Redis

1. Vérifier que Redis fonctionne :
   ```bash
   redis-cli ping
   ```

2. Vérifier les logs backend :
   ```bash
   npm run dev --workspace backend
   # Chercher : "Redis connected" ou "Redis connection error"
   ```

3. Vérifier les variables d'environnement :
   ```bash
   cat apps/backend/.env | grep REDIS
   ```

### Performances dégradées

1. Vérifier le nombre de clés :
   ```bash
   redis-cli dbsize
   ```

2. Si > 10 000 clés, réduire le TTL :
   ```env
   PRICE_CACHE_TTL=1800  # 30 minutes
   ```

3. Vider le cache si nécessaire :
   ```bash
   redis-cli FLUSHDB
   ```

## Next steps

- 📖 Lire la documentation complète : [REDIS_CACHE.md](./REDIS_CACHE.md)
- 🏗️ Consulter la roadmap : [ROADMAP.md](./ROADMAP.md)
- 🔒 Vérifier la sécurité : [SECURITY.md](./SECURITY.md)

## Support

En cas de problème :
1. Vérifier les logs : `npm run dev`
2. Tester Redis : `npm run test:cache`
3. Consulter la documentation Redis : https://redis.io/docs/

Bon développement ! 🎉
