# Guide de démarrage Docker

Ce guide explique comment démarrer l'application Portefeuille2 avec Docker.

## Prérequis

- Docker Desktop installé et démarré
- Docker Compose installé (inclus avec Docker Desktop)

## Démarrage de l'application

### Option 1 : Build et démarrage en une commande

```powershell
docker-compose up --build
```

Cette commande va :
1. Builder les images Docker pour le backend et le frontend
2. Démarrer Redis, le backend et le frontend
3. Créer et migrer automatiquement la base de données SQLite

### Option 2 : Build séparé

```powershell
# Builder les images
docker-compose build

# Démarrer les services
docker-compose up
```

### Démarrage en arrière-plan

Pour démarrer en mode détaché (daemon) :

```powershell
docker-compose up -d
```

## Accès à l'application

Une fois démarré :
- **Frontend** : http://localhost:3000
- **Backend API** : http://localhost:4000/api
- **Redis** : localhost:6379

## Commandes utiles

### Voir les logs

```powershell
# Tous les services
docker-compose logs -f

# Un service spécifique
docker-compose logs -f backend
docker-compose logs -f frontend
docker-compose logs -f redis
```

### Arrêter l'application

```powershell
docker-compose down
```

### Arrêter et supprimer les volumes (⚠️ supprime les données)

```powershell
docker-compose down -v
```

### Redémarrer un service

```powershell
docker-compose restart backend
docker-compose restart frontend
```

### Reconstruire après des modifications

```powershell
# Reconstruire un service spécifique
docker-compose build backend
docker-compose build frontend

# Reconstruire et redémarrer
docker-compose up --build -d
```

### Vérifier l'état des services

```powershell
docker-compose ps
```

### Accéder au shell d'un conteneur

```powershell
docker-compose exec backend sh
docker-compose exec frontend sh
```

## Structure des volumes

Les données persistantes sont stockées dans :
- `backend-data` : Base de données SQLite
- `redis-data` : Données Redis

## Troubleshooting

### Les ports sont déjà utilisés

Si les ports 3000, 4000 ou 6379 sont déjà utilisés :

```powershell
# Libérer les ports
Get-NetTCPConnection -LocalPort 3000,4000,6379 -ErrorAction SilentlyContinue | ForEach-Object { Stop-Process -Id $_.OwningProcess -Force }
```

### Réinitialiser complètement l'application

```powershell
# Arrêter et supprimer tous les conteneurs et volumes
docker-compose down -v

# Supprimer les images construites
docker-compose build --no-cache

# Redémarrer
docker-compose up -d
```

### Voir les erreurs de build

```powershell
docker-compose build --progress=plain
```

## Architecture Docker

- **Redis** : Service de cache avec persistance activée
- **Backend** : API Express avec Prisma et SQLite
- **Frontend** : Application Next.js en mode production
- **Network** : Tous les services communiquent via `portefeuille-network`

## Variables d'environnement

Les variables d'environnement sont configurées dans `docker-compose.yml`. Pour les modifier :
1. Éditez `docker-compose.yml`
2. Reconstruisez : `docker-compose up --build -d`

## Notes importantes

- La base de données SQLite est persistée dans un volume Docker
- Les migrations Prisma sont exécutées automatiquement au démarrage du backend
- Le cache Redis est également persisté
- Les healthchecks garantissent que les services dépendants démarrent dans le bon ordre
