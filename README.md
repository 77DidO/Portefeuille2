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

### 1.1 Architecture du pipeline

```
CSV Upload
    ↓
[parseImportFile] ← Détection du format (CA, Binance, Coinbase)
    ↓
[Parser spécifique] ← Normalisation des données
    ↓
[ParsedRow[]] ← Transactions normalisées
    ↓
[processImport] ← Persistance en base
    ↓
[refreshAssetPrice] ← Mise à jour des cours actuels
    ↓
[Succès] → Redirection vers dashboard
```

### 1.2 Formats pris en charge

**Sources supportées** :
- Crédit Agricole (PEA)
- Binance (CSV `change`, `operation`, `coin`, …)
- Coinbase (CSV `timestamp`, `asset`, …)

### 1.3 Normalisations communes

**Fonctions utilitaires** :
- `normaliseNumber` : supprime les espaces, remplace `,` par `.` et ignore les symboles monétaires
- `normaliseText` : convertit en minuscules, enlève accents/apostrophes typographiques et ne garde que [a-z0-9] + espaces
- `normaliseDate` : gère ISO, `JJ/MM/AAAA`, `AAAA-MM-JJ`, `JJ-MM-AAAA`, etc.

### 1.4 Import Crédit Agricole (PEA)

**Logique de traitement** :

| Type de ligne                           | Traitement                                                                                              |
|----------------------------------------|-----------------------------------------------------------------------------------------------------------|
| `ACHAT COMPTANT`                       | - Création d'une transaction BUY titre (prix = `|montant net ± frais| / quantité`)<br>- Création d'un SELL `_PEA_CASH` du même montant<br>- Création d'un `PricePoint` à la date d'achat |
| `VENTE`                                | - Création d'une transaction SELL titre<br>- Création d'un BUY `_PEA_CASH` du montant vendu             |
| `VERSEMENT`, `REMBOURSEMENT`, `COUPON`, `DIVIDENDE` | Création uniquement d'un BUY `_PEA_CASH` (aucun titre)                                                  |
| Parts sociales (`000007859050`, …)     | Traitement comme achat normal (quantité × 1€) ; _aucun appel Yahoo_ lors du refresh                     |

**Points clés** :
- À chaque achat, un `PricePoint` est créé à la date de l'opération avec le prix reconstitué
- Les transactions cash utilisent un prix fixe 1€
- Double écriture : titre + cash pour refléter le mouvement de trésorerie
- Calcul du prix : `prix_unitaire = montant_total_avec_frais / quantité`

### 1.5 Import Binance / Coinbase

**Traitement spécifique crypto** :
- Regroupement des événements par fenêtre ±2 minutes pour associer les frais
- Conversion des montants dans la devise EUR via les paires appropriées (EURUSDT, EURBUSD, BTCEUR…)
- Création des transactions/pricePoints de la même façon que pour le PEA
- Gestion des multiples paires de devises (stablecoins, BTC, altcoins)

### 1.6 Persistance en base

**Process d'écriture** :

1. Pour chaque `ParsedRow` :
   - `Transaction` : créée ou mise à jour si même date/type/quantité/source (évite les doublons)
   - `PricePoint` : `upsert` avec clé unique `{assetId, date}` (un seul prix par jour)
   
2. Mise à jour des métadonnées :
   - `asset.lastPriceUpdateAt` actualisé
   - Timestamps de création/modification

3. Post-import automatique :
   - Appel à `refreshAssetPrice` pour récupérer les cours actuels
   - Calcul des totaux de portefeuille
   - Invalidation du cache si Redis activé

**Gestion des doublons** :
- Détection par comparaison de hash (date + type + quantité + prix)
- Mise à jour plutôt que création si transaction existante
- Log des doublons ignorés

## 2. Rafraîchissement des prix

### 2.1 Endpoints disponibles

| Endpoint                          | Description                                                                 | Cache Redis |
|----------------------------------|-----------------------------------------------------------------------------|-------------|
| `POST /api/assets/:id/refresh`   | Rafraîchit un actif (bouton « Actualiser »)                                 | ✅ Oui      |
| `POST /api/assets/refresh`       | Rafraîchit tous les actifs ou ceux d'un portefeuille (`?portfolioId=`)      | ✅ Oui      |
| `POST /api/assets/backfill-history` | Récupère l'historique quotidien depuis la date du premier achat          | ✅ Oui      |

### 2.2 Sources de prix par type d'actif

| Type d'actif | Source API | Prix | Particularités |
|-------------|-----------|------|----------------|
| **Crypto** | Binance | Cours spot en temps réel | Paires multiples (EUR, USDT, USD, BUSD, BTC) |
| **ETF/Actions** | Yahoo Finance | Quote + chart historique | Recherche par ISIN puis symbole |
| **Cash** | Interne | 1€ fixe | `_PEA_CASH`, `EUR`, `USDT`, etc. |
| **Titres non cotés** | Manuel | Dernier prix transaction | Parts sociales (ex: `000007859050`) |

### 2.3 Stratégie de cache (Redis)

**Mise en cache** :
- TTL configurable (défaut: 3600s = 1h)
- Clé format: `price:{symbol}:{source}`
- Invalidation automatique après TTL
- Graceful degradation si Redis indisponible

**Flux de récupération** :
```
1. Vérifier cache Redis
   ├─ Hit → retourner prix caché
   └─ Miss → appel API externe
       ├─ Succès → mettre en cache + retourner
       └─ Échec → log erreur + retourner null
```

## 3. Calculs coté backend

### 3.1 Totaux actuels (`computePortfolioTotals`)

Pour chaque portefeuille :

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

> Ainsi, la plus/moins-value globale reflète bien la performance titres (les dépôts/retraits cash n'impactent pas `gainLossValue`).

### 3.2 Historiques de valeur (`getPortfolioDetail`)

Le calcul des séries historiques suit un processus en plusieurs étapes pour assurer la cohérence des données :

#### a) Identification des dépôts de capital

La fonction `identifyCashDeposits` détecte les véritables versements :
- **Crypto (Binance)** : transactions `_CASH` ≥ 1€
- **PEA** : transactions `_PEA_CASH` ≥ 50€
- Exclusion des mouvements internes (achats/ventes d'actifs)

Cette distinction permet de séparer :
- `investedHistory` : capital réellement déposé (ligne de référence sur le graphique)
- `investedInAssetsHistory` : montant investi en actifs (base de calcul de la performance)

#### b) Calcul des valeurs journalières

Pour chaque jour où il y a eu une activité (transaction ou prix) :

1. **Valeur des actifs** (`priceHistory`) :
   - Pour chaque actif NON-CASH :
     - Récupérer toutes les transactions jusqu'à ce jour
     - Calculer la quantité détenue : `Σ(BUY) - Σ(SELL)`
     - Trouver le dernier prix connu avant ou le jour J
     - Valeur = `quantité × dernier_prix`
   - Agréger tous les actifs pour obtenir la valeur totale du portefeuille

2. **Coût d'achat cumulé** (`investedInAssetsHistory`) :
   - Pour chaque actif NON-CASH :
     - Calculer le coût net : `Σ(prix×quantité+frais pour BUY) - Σ(prix×quantité+frais pour SELL)`
   - Agréger pour obtenir le capital investi en actifs

3. **Trésorerie** (`cashHistory`) :
   - Pour chaque transaction cash :
     - Quantité cumulée : `Σ(BUY) - Σ(SELL)`
     - Prix fixe = 1€

4. **Dividendes cumulés** (`dividendsHistory`) :
   - Cumul des transactions marquées comme dividendes

#### c) Points clés de l'algorithme

- **Approche cumulative** : à chaque jour, on recalcule la valeur de TOUS les actifs avec leur dernier prix connu (pas seulement ceux ayant un nouveau prix ce jour-là)
- **Gestion des actifs sans prix** : si un actif n'a pas encore de `PricePoint` à une date donnée, il n'est pas inclus dans le calcul (normal en début d'historique)
- **Précision temporelle** : timestamps UTC normalisés pour éviter les décalages de fuseau horaire
- **Performance** : tri des prix et transactions par date pour éviter les recherches répétées

#### d) Exemple de calcul (PEA au 1er septembre 2025)

```
Actifs avec prix au 1er septembre :
- FR001400ZGR7 : 78 × 5.908€ = 460.82€
- FR0011871128 : 12 × 51.835€ = 622.02€
- FR0013412020 : 9 × 29.168€ = 262.51€
- FR001400U5Q4 : 204 × 5.443€ = 1110.37€
- FR0013412038 : 15 × 34.765€ = 521.48€
- 000007859050 : 20 × 1€ = 20.00€

Total actifs : 2997.20€
Cash (_PEA_CASH) : 1173.03€
→ priceHistory = 4170.23€

Capital investi : 4500€
→ investedHistory = 4500€

Coût d'achat actifs : 3200€
→ investedInAssetsHistory = 3200€

Plus-value = 2997.20€ - 3200€ = -202.80€
```

#### e) Cas particuliers

- **Actifs non cotés** (parts sociales, etc.) : utilisent le prix de la dernière transaction (pas d'appel API)
- **Premiers jours** : certains actifs peuvent ne pas avoir de prix → valeur partielle normale
- **Transactions hors cotation** : le `PricePoint` est créé au moment de la transaction avec le prix d'achat

## 4. Affichage UI (`PortfolioSection.tsx`)

### Graphe d'évolution

- **Périodes** : `1M`, `3M`, `6M`, `Tout`
- **Axe Y dynamique** : 
  - Calcul automatique du min/max avec marge de 10%
  - Arrondi intelligent selon l'échelle (évite les axes fixes à 0€)
  - Format décimal adaptatif (≥1000: 0 déc, ≥100: 1 déc, ≥1: 2 déc, <1: 3 déc)

- **Données affichées** :
  Pour chaque point :  
  ```typescript
  pointValue = priceHistory.value              // Valeur totale du portefeuille
  investedValue = last invested history <= date // Capital déposé (dépôts cash)
  investedInAssetsValue = last investedInAssets <= date // Coût d'achat des actifs
  cashValue = last cash history <= date        // Trésorerie disponible
  assetsValue = pointValue - cashValue         // Valeur des actifs
  ```

- **Protection anti-anomalie** :
  Si `assetsValue <= 0` alors qu'un capital investi existe (cas d'un achat avant le refresh des prix), on borne :
  ```typescript
  assetsValue = investedInAssetsValue
  pointValue = investedInAssetsValue + cashValue
  ```
  → Plus de plongée fictive à 0€ sur le graphique

- **Tooltip interactif** :
  - 📊 Valeur totale (aire bleue)
  - 💰 Solde de trésorerie
  - 📈 Valeur hors trésorerie
  - 💵 Capital investi (ligne pointillée)
  - 📉 Plus/moins-value = `Valeur hors trésorerie – Capital investi en actifs`
  - 📊 Gain/Perte en %

- **Légende** :
  - 🔵 Aire bleue : Valeur totale du portefeuille
  - ⚪ Ligne blanche pointillée : Capital investi (référence)

### Détail portefeuilles

- Les cartes listent : valeur totale, capital investi, trésorerie, P/L, P/L %, actifs suivis.
- La trésorerie disponible affichée sous le graphe correspond à la valorisation `_PEA_CASH` (ou symboles cash).

---

# Workflow global (pas-à-pas)

## Scénario complet : Import initial PEA

1. **Préparation**
   - Créer le portefeuille "Crédit Agricole PEA" (catégorie: PEA)
   - Télécharger l'historique CSV depuis l'espace client CA

2. **Import CSV**  
   - Naviguer vers `/import`
   - Sélectionner le portefeuille et la source "Crédit Agricole"
   - Uploader le fichier CSV complet
   - Traitement automatique :
     - `ACHAT COMPTANT` → transaction titre + mouvement cash (SELL)
     - `VERSEMENT / REMBOURSEMENT / COUPON` → uniquement mouvement cash (BUY)
     - `PricePoint` créé automatiquement le jour de l'achat

3. **Rafraîchissement des prix**
   - Automatique après import pour les cours actuels
   - Optionnel : `POST /api/assets/backfill-history` pour l'historique complet
   - Sources :
     - ETF/Actions → Yahoo Finance
     - Titres non cotés → prix manuel (pas de Yahoo)

4. **Vérification**
   - Consulter le dashboard
   - Valeur totale et P/L = chiffres Crédit Agricole
   - Graphe historique lisse (plus de trou à 0€)
   - Trésorerie disponible affichée séparément

5. **Mises à jour futures**
   - Exporter nouveau CSV des dernières opérations
   - Ré-importer (doublons automatiquement gérés)
   - Actualiser les prix si nécessaire

## Workflow quotidien

```
Matin : Consultation
    ↓
Dashboard → Vérifier valeurs actuelles
    ↓
Graphique → Observer l'évolution
    ↓
[Optionnel] Actualiser prix → Bouton refresh

Mensuel : Mise à jour
    ↓
Exporter CSV depuis établissements
    ↓
Import → /import
    ↓
Vérification → Dashboard
```

## Optimisations et bonnes pratiques

### Performance

- **Cache Redis** : Activé en production pour réduire les appels API externes
- **Index base de données** : Sur `asset.symbol`, `transaction.date`, `pricePoint.date`
- **Pagination** : Historique des transactions limité à 50/page
- **Lazy loading** : Graphiques chargés uniquement quand visibles

### Fiabilité

- **Validation Zod** : Toutes les entrées utilisateur validées
- **Transactions atomiques** : Import en transaction Prisma (rollback si erreur)
- **Gestion d'erreurs** : Messages clairs + logging structuré
- **Backups automatiques** : Rotation des 30 derniers backups

### UX

- **Feedback temps réel** : Toasts pour succès/erreurs
- **Loading states** : Skeletons pendant chargements
- **Responsive design** : Mobile-first, grilles adaptatives
- **Accessibilité** : Labels ARIA, navigation clavier

---

## Tests rapides

```bash
npm test --workspace backend
npm test --workspace frontend
```

## Support / contributions

Les contributions sont bienvenues (nouveaux connecteurs, améliorations UI/UX, etc.). Ouvrez une issue ou une pull request sur le dépôt Git.
