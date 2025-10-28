# Portefeuille Multi-Sources

Application full-stack (Express + Next.js + SQLite) pour centraliser la visualisation de portefeuilles (PEA, crypto, etc.).

**Version actuelle** : 2.2.0 | **Dernière mise à jour** : Octobre 2025

## 📚 Documentation

- 📖 **[DOC_INDEX.md](./DOC_INDEX.md)** - Index complet de toute la documentation
- 🚀 **[QUICKSTART_REDIS.md](./QUICKSTART_REDIS.md)** - Démarrage rapide avec Redis
- ⚡ **[REDIS_CACHE.md](./REDIS_CACHE.md)** - Guide complet du cache
- 💾 **[BACKUP_GUIDE.md](./BACKUP_GUIDE.md)** - Guide de sauvegarde et restauration
- 🔒 **[SECURITY.md](./SECURITY.md)** - Guide de sécurité
- 🗺️ **[ROADMAP.md](./ROADMAP.md)** - Plan de développement
- 📋 **[VERSION_HISTORY.md](./VERSION_HISTORY.md)** - Historique des versions

## Prérequis

- Node.js 18+
- npm 9+

## Installation

```bash
npm install
```

La commande installe les dépendances, génère le client Prisma et prépare les workspaces `backend`, `frontend` et `@portefeuille/types`.

### Configuration des variables d'environnement

**Backend** : Copiez `.env.example` vers `.env` dans `apps/backend/` et ajustez les valeurs :

```bash
cp apps/backend/.env.example apps/backend/.env
```

Variables disponibles :
- `NODE_ENV` : `development` | `production` | `test`
- `PORT` : Port du serveur (défaut: 4000)
- `DATABASE_URL` : Chemin vers la base SQLite
- `CORS_ORIGIN` : Origine autorisée pour CORS
- `RATE_LIMIT_WINDOW_MS` : Fenêtre de rate limiting en ms
- `RATE_LIMIT_MAX_REQUESTS` : Nombre max de requêtes par fenêtre
- `LOG_LEVEL` : `debug` | `info` | `warn` | `error`
- `LOG_PRETTY` : Formatage lisible des logs (`true` en dev)
- `REDIS_ENABLED` : Activer le cache Redis (`true` | `false`)
- `REDIS_HOST` : Hôte Redis (défaut: `localhost`)
- `REDIS_PORT` : Port Redis (défaut: `6379`)
- `PRICE_CACHE_TTL` : Durée de vie du cache en secondes (défaut: `3600`)

**Frontend** : Copiez `.env.example` vers `.env.local` dans `apps/frontend/` :

```bash
cp apps/frontend/.env.example apps/frontend/.env.local
```

Variable :
- `NEXT_PUBLIC_API_URL` : URL de l'API backend (défaut: http://localhost:4000/api)

## Démarrage

### Développement local

**Option 1 : Sans Redis (cache désactivé)**
```bash
npm run dev
```

**Option 2 : Avec Redis (cache activé)**
1. Démarrer Redis avec Docker Compose :
```bash
docker-compose up -d
```

2. Démarrer l'application :
```bash
npm run dev
```

L'application sera accessible à :
- API Express : `http://localhost:4000/api`
- Front-end Next.js : `http://localhost:3000`
- Redis : `localhost:6379` (si Docker actif)

Pour arrêter Redis :
```bash
docker-compose down
```

## Build de production

```bash
npm run build
```

> Le build ignore ESLint côté Next.js (`eslint.ignoreDuringBuilds`). Utilisez `npm run lint --workspace frontend` pour lancer un lint manuel.

## Sauvegarde et restauration

### Créer un backup

```bash
# Backup simple
npm run backup

# Backup avec compression (recommandé, -78% taille)
npm run backup:compress
```

### Restaurer un backup

```bash
# Lister les backups disponibles
npm run restore

# Restaurer un backup spécifique
npm run restore backup_2025-10-28T20-45-32.db.gz
```

**Fonctionnalités** :
- ✅ Sauvegarde à la demande (pas d'automatisation nécessaire)
- ✅ Compression Gzip optionnelle (économise 70-80% d'espace)
- ✅ Validation SHA256 pour vérifier l'intégrité
- ✅ Rotation automatique (garde les 30 derniers backups)
- ✅ Backup de sécurité avant restauration
- ✅ API REST pour intégration frontend (`/api/backup`)

**Documentation complète** : Voir [BACKUP_GUIDE.md](./BACKUP_GUIDE.md)

## Structure des dossiers

- `apps/backend` : API Express + Prisma (SQLite)
- `apps/frontend` : Interface Next.js (Recharts, React Query)
- `packages/types` : Types TypeScript partagés

## Interface utilisateur

L'application propose 4 pages principales :

### 1. Tableau de bord (`/`)
- Vue d'ensemble de tous vos portefeuilles
- Cartes récapitulatives avec valeur totale, capital investi, plus/moins-value
- Graphique d'évolution avec périodes sélectionnables (1M, 3M, 6M, Tout)
- Liste détaillée des actifs par portefeuille

### 2. Historique (`/history`)
- Liste paginée de toutes les transactions
- Filtres par portefeuille, type d'opération et période
- Recherche par symbole ou nom d'actif
- Affichage des détails : date, type, quantité, prix unitaire, montant total

### 3. Imports CSV (`/import`)
- Formulaire condensé avec sélection de portefeuille et source
- Support de 3 formats :
  - **Crédit Agricole (PEA)** : Date, Libellé, Quantité, Prix unitaire, Sens
  - **Binance (Crypto)** : Date(UTC), Pair, Side, Price, Amount
  - **Coinbase (Crypto)** : Timestamp, Asset, Transaction Type, Quantity, Spot Price
- Bouton de sélection de fichier personnalisé
- Section de conseils collapsible pour optimiser l'import

### 4. Configuration (`/settings`)
- **Gestion des portefeuilles** (colonne gauche, large) :
  - Création de nouveaux portefeuilles avec nom et catégorie
  - Modification/suppression des portefeuilles existants
  - Tableau récapitulatif avec valeur actuelle
- **Maintenance des données** (colonne droite, compacte) :
  - Réinitialisation complète de la base de données
  - Reconstruction de l'historique des cours
  - Liste des actifs nécessitant une mise à jour de prix

### Améliorations UX récentes

- **Design unifié** : toutes les pages utilisent la même largeur centrée (`min(1320px, 92vw)`)
- **Formulaires harmonisés** : inputs avec style cohérent, labels `.form-label`, classe `.input` pour tous les champs
- **Navigation simplifiée** : suppression des breadcrumbs redondants
- **Layout responsive** : grilles qui s'adaptent sur mobile (colonnes empilées)
- **File input personnalisé** : bouton "Choisir un fichier" stylisé affichant le nom du fichier sélectionné
- **Classes utilitaires** : `.muted`, `.form-row`, `.card-actions`, `.page-inner` pour un code plus maintenable

## Base de données

La base SQLite est stockée dans `apps/backend/prisma/dev.db`.

```bash
cd apps/backend
npx prisma migrate dev --name init
npx prisma studio        # pour inspecter la base
```

### Index de performance

Les migrations incluent des index pour optimiser les requêtes :
- `Asset.symbol`, `Asset.portfolioId`
- `Transaction.date`, `Transaction.assetId`
- `PricePoint.date`, `PricePoint.assetId`

## Sécurité et Production

### Rate Limiting

L'API implémente trois niveaux de rate limiting :
- **API générale** : 100 requêtes / 15 minutes
- **Opérations d'écriture** (import, create, update, delete) : 20 requêtes / 15 minutes
- **Opérations critiques** (reset database) : 5 requêtes / heure

### Logging structuré

Les logs utilisent Pino pour un format JSON structuré en production :
- Logs colorés et lisibles en développement (`LOG_PRETTY=true`)
- Format JSON compact en production
- Niveaux configurables : debug, info, warn, error

### Gestion d'erreurs

- Types d'erreurs personnalisés (`ValidationError`, `NotFoundError`, etc.)
- Messages d'erreur sécurisés en production (pas de stack trace exposée)
- Erreurs de validation Zod automatiquement formatées
- Logging centralisé de toutes les erreurs


### Cache Redis (optionnel)

L'application peut utiliser Redis pour mettre en cache les prix récupérés des APIs externes (Yahoo Finance, Binance).

- **Activation/désactivation** :
  - Par défaut, Redis est désactivé (`REDIS_ENABLED=false` dans `.env`).
  - Vous pouvez activer/désactiver Redis à chaud via le panneau de configuration (onglet "Paramètres") ou en modifiant `.env` puis en redémarrant le backend.
  - Si Redis n'est pas disponible ou désactivé, l'application fonctionne normalement (graceful degradation).
- **Prérequis** :
  - Redis doit être installé et accessible (voir `docker-compose.yml` ou guide d'installation).
  - Les variables d'environnement `REDIS_ENABLED`, `REDIS_HOST`, `REDIS_PORT` et `PRICE_CACHE_TTL` sont documentées dans `.env.example`.
- **Fonctionnalités** :
  - Mise en cache des prix avec TTL configurable (défaut : 1h)
  - Réduction des appels API externes et accélération des temps de réponse
  - Endpoints d'administration du cache (`/api/system/cache/*`)
- **Documentation détaillée** :
  - Voir [REDIS_IMPLEMENTATION.md](./REDIS_IMPLEMENTATION.md) pour l'architecture, les flux, les scripts de test, et les bonnes pratiques.

**Résumé** : Redis est recommandé pour la performance, mais reste optionnel et désactivable à tout moment.

## Variables d'environnement

**Backend** (`.env` dans `apps/backend/`) :
- Variables validées avec Zod au démarrage
- Valeurs par défaut pour le développement
- Erreur claire si validation échoue

**Frontend** (`.env.local` dans `apps/frontend/`) :
- Configuration de l'URL API
- Variables préfixées `NEXT_PUBLIC_` pour exposition client

---

# Workflow d'import et de mise à jour

Cette section détaille la chaîne complète de traitement des données (CSV → base → interface) pour éviter tout écart avec les montants affichés par les établissements financiers (ex. Crédit Agricole).

## 1. Pipeline d'import CSV

### Formats pris en charge

- Crédit Agricole (PEA)
- Binance (CSV `change`, `operation`, `coin`, …)
- Coinbase (CSV `timestamp`, `asset`, …)

### Normalisations communes

- `normaliseNumber` supprime les espaces, remplace `,` par `.` et ignore les symboles monétaires.
- `normaliseText` convertit en minuscules, enlève accents/apostrophes typographiques et ne garde que [a-z0-9] + espaces.
- `normaliseDate` gère ISO, `JJ/MM/AAAA`, `AAAA-MM-JJ`, `JJ-MM-AAAA`, etc.

### Crédit Agricole

| Type de ligne                           | Traitement                                                                                              |
|----------------------------------------|-----------------------------------------------------------------------------------------------------------|
| `ACHAT COMPTANT`                       | - Création d’une transaction titre (prix = `|montant net ± frais| / quantité`)<br>- Création d’un SELL `_PEA_CASH` du même montant |
| `VENTE`                                | Inverse du tableau ci-dessus                                                                             |
| `VERSEMENT`, `REMBOURSEMENT`, `COUPON`, `DIVIDENDE`, lignes sans quantité | Création uniquement d’un BUY `_PEA_CASH` (aucun titre)                                                  |
| Parts sociales (`000007859050`, …)     | Traitement comme achat normal (quantité * 1 €) ; _aucun appel Yahoo_ lors du refresh                     |

> À chaque achat, un `pricePoint` est créé à la date de l’opération avec le prix reconstitué.  
> Les transactions cash utilisent un prix fixe 1 €.

### Binance / Coinbase

- Regroupement des événements par fenêtre ±2 minutes pour associer les frais.
- Conversion des montants dans la devise EUR via les paires appropriées (EURUSDT, EURBUSD, BTCEUR…).
- Création des transactions/pricePoints de la même façon que pour le PEA.

### Persistance

1. Pour chaque `ParsedRow` :
   - `Transaction` (créée ou mise à jour si même date/type/quantité/source).
   - `PricePoint` `upsert` (clé `{assetId, date}`).
2. `asset.lastPriceUpdateAt` est actualisé.
3. Après import, `refreshAssetPrice` est appelé pour récupérer les cours actuels.

## 2. Rafraîchissement des prix

| Endpoint                          | Description                                                                 |
|----------------------------------|-----------------------------------------------------------------------------|
| `POST /api/assets/:id/refresh`   | Rafraîchit un actif (bouton « Actualiser »)                                 |
| `POST /api/assets/refresh`       | Rafraîchit tous les actifs ou ceux d’un portefeuille (`?portfolioId=`)      |
| `POST /api/assets/backfill-history` | Récupère l’historique quotidien depuis la date du premier achat          |

- **Crypto** : cours spot Binance (cash EUR, USDT, USD, BUSD, BTC).
- **ETF/Actions** : Yahoo Finance (recherche + quote + chart).  
- **Cash** : `_PEA_CASH`, `_PEA_CASH`, `CASH` → prix statique 1 €.
- **Titres non cotés** (symboles numériques comme `000007859050`) → aucun appel Yahoo : on reprend le dernier prix manuel (transaction/pricePoint).

## 3. Calculs coté backend

Pour chaque portefeuille (`computePortfolioTotals`) :

- `assetSummaries` calculés via `computeAssetSummary` :
  - `quantity` = quantités nettes.
  - `marketValue` = dernier `PricePoint` connu × quantité.
  - `investedValue` = somme des montants engagés (hors cash).
  - Les actifs cash (`PEA_CASH`, `_PEA_CASH`, `EUR`, `USDC`, etc.) ont `investedValue = 0`.

- Totaux :
  - `totalValue` = somme des `marketValue` (titres + cash).
  - `cashValue` = somme des `marketValue` des actifs cash.
  - `investedValue` = somme des `investedValue` hors cash.
  - `gainLossValue` = `totalValue - investedValue`.

> Ainsi, la plus/moins-value globale reflète bien la performance titres (les dépôts/retraits cash n’impactent pas `gainLossValue`).

## 4. Affichage UI (`PortfolioSection.tsx`)

### Graphe

- Plages proposées : `1M`, `3M`, `6M`, `Tout`.
- Pour chaque point :  
  ```
  pointValue = priceHistory.value
  investedValue = last invested history <= date
  cashValue = last cash history <= date
  assetsValue = pointValue - cashValue
  ```
  Si `assetsValue <= 0` alors qu’un capital investi existe (cas d’un achat avant le refresh), on borne `assetsValue = investedValue` et `pointValue = investedValue + cashValue`.  
  → Plus de plongée fictive.

- Tooltip :
  - Valeur totale
  - Solde de trésorerie
  - Valeur hors trésorerie
  - Capital investi
  - Plus/moins-value = `Valeur hors trésorerie – Capital investi`

- Légende :
  - Aire bleue : `Valeur totale`
  - Ligne blanche pointillée : `Capital investi`

### Détail portefeuilles

- Les cartes listent : valeur totale, capital investi, trésorerie, P/L, P/L %, actifs suivis.
- La trésorerie disponible affichée sous le graphe correspond à la valorisation `_PEA_CASH` (ou symboles cash).

---

# Workflow global (pas-à-pas)

1. **Purger / Créer le portefeuille** (optionnel si premières données).
2. **Importer le CSV Crédit Agricole**  
   - `ACHAT COMPTANT` → transaction titre + mouvement cash (SELL).  
   - `VERSEMENT / REMBOURSEMENT / COUPON` → uniquement mouvement cash (BUY).  
   - `PricePoint` créé automatiquement le jour de l’achat.
3. **Importer les autres sources** (Binance/Coinbase) si besoin.
4. **Actualiser les prix** (`/api/assets/refresh`) :  
   - Crypto → Binance  
   - ETF/Actions → Yahoo  
   - Titres non cotés → prix manuel (pas de Yahoo)
5. **Consulter le front**  
   - Valeur totale et P/L = chiffres Crédit Agricole.  
   - Graphe lisse (plus de trou à 0 €).

> Après un nouveau dépôt/achat : répéter l’import et, si nécessaire, actualiser les prix pour que le graphe se mette immédiatement à jour.

---

## Tests rapides

```bash
npm test --workspace backend
npm test --workspace frontend
```

## Support / contributions

Les contributions sont bienvenues (nouveaux connecteurs, améliorations UI/UX, etc.). Ouvrez une issue ou une pull request sur le dépôt Git.
