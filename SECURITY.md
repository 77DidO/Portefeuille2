# 🔒 Guide de Sécurité - Portefeuille2

## Vue d'ensemble

Ce document détaille les mesures de sécurité implémentées et les bonnes pratiques à suivre.

## 🛡️ Protections Implémentées

### 1. Rate Limiting

**Localisation** : `apps/backend/src/middleware/rateLimiter.ts`

Trois niveaux de protection :

```typescript
// Niveau 1 : API générale
apiLimiter: 100 requêtes / 15 minutes

// Niveau 2 : Opérations d'écriture
strictLimiter: 20 requêtes / 15 minutes
Routes : POST /import, POST/PUT/DELETE /portfolios

// Niveau 3 : Opérations critiques
criticalLimiter: 5 requêtes / 1 heure
Routes : DELETE /system/data
```

**Configuration** :
- `RATE_LIMIT_WINDOW_MS` : Fenêtre de temps en millisecondes
- `RATE_LIMIT_MAX_REQUESTS` : Nombre maximum de requêtes

**Headers de réponse** :
```http
RateLimit-Limit: 100
RateLimit-Remaining: 99
RateLimit-Reset: 1698499200
```

### 2. CORS (Cross-Origin Resource Sharing)

**Localisation** : `apps/backend/src/server.ts`

```typescript
cors({
  origin: env.CORS_ORIGIN,  // Origine autorisée
  credentials: true,         // Cookies autorisés
})
```

**Configuration** :
- `CORS_ORIGIN` : URL frontend autorisée (ex: `http://localhost:3000`)
- En production : Définir l'URL exacte du frontend

⚠️ **Important** : Ne JAMAIS utiliser `origin: '*'` en production !

### 3. Validation des Entrées

**Localisation** : Routes avec Zod schemas

Tous les endpoints valident les données entrantes :

```typescript
const portfolioSchema = z.object({
  name: z.string().min(1),
  category: z.enum(['GLOBAL', 'CRYPTO', 'PEA', 'OTHER']),
});
```

**Protection contre** :
- Injection de données malveillantes
- Types incorrects
- Valeurs hors limites
- Champs manquants

### 4. Gestion Sécurisée des Erreurs

**Localisation** : `apps/backend/src/middleware/errorHandler.ts`

```typescript
// Production : Messages génériques
if (env.NODE_ENV === 'production' && statusCode === 500) {
  return { message: 'Internal server error' };
}

// Développement : Détails complets + stack trace
```

**Protection contre** :
- Fuite d'informations sensibles
- Exposition de la structure interne
- Stack traces en production

### 5. Logging Sécurisé

**Localisation** : `apps/backend/src/utils/logger.ts`

```typescript
// ✅ Bon : Informations structurées sans données sensibles
logger.info({ userId: 123, action: 'login' });

// ❌ Mauvais : Ne jamais logger
logger.info({ password: 'secret123' });  // INTERDIT
logger.info({ token: 'jwt...' });        // INTERDIT
logger.info({ creditCard: '1234' });     // INTERDIT
```

**Règles** :
- Jamais de mots de passe
- Jamais de tokens/clés API
- Jamais de données bancaires
- Jamais de PII (Personally Identifiable Information) complètes

### 6. Variables d'Environnement

**Localisation** : `apps/backend/src/config/env.ts`

✅ **Validation au démarrage** :
```typescript
loadEnv(); // Crash si variables invalides
```

✅ **Fichiers non versionnés** :
- `.env` → `.gitignore`
- `.env.local` → `.gitignore`
- `.env.example` → Versionné (sans secrets)

⚠️ **Ne JAMAIS commiter** :
- Mots de passe
- Clés API
- Tokens
- URLs de production

### 7. Cache Redis Sécurisé

**Localisation** : `apps/backend/src/utils/cache.ts`

✅ **Graceful degradation** :
- Application fonctionne si Redis down
- Pas d'erreur fatale
- Logs d'avertissement seulement

✅ **Données cachées non sensibles** :
- Uniquement prix publics (Yahoo Finance, Binance)
- Pas de données utilisateur
- Pas de tokens ou secrets

⚠️ **Configuration production** :
```env
# Sécuriser Redis en production
REDIS_PASSWORD=strong-password-here  # À ajouter
REDIS_TLS=true                       # Chiffrement
REDIS_MAX_RETRIES=3
```

**Bonnes pratiques Redis** :
- Utiliser un mot de passe fort
- Activer TLS/SSL
- Isoler dans un réseau privé
- Configurer maxmemory-policy
- Surveiller les connexions

## 🚫 Vulnérabilités Résiduelles

### Critiques (À implémenter en priorité)

#### 1. Pas d'Authentification
**Impact** : 🔴 CRITIQUE  
**Risque** : Toutes les routes sont publiques

**Solution recommandée** :
```typescript
// Installer
npm install jsonwebtoken bcrypt express-session

// Middleware
import { verifyToken } from './middleware/auth';
app.use('/api/*', verifyToken);
```

#### 2. Pas de HTTPS
**Impact** : 🔴 CRITIQUE  
**Risque** : Données transmises en clair

**Solution** :
- Développement : Acceptable
- Production : **OBLIGATOIRE** (Let's Encrypt, Cloudflare, etc.)

#### 3. Pas de Validation des Fichiers CSV
**Impact** : 🟠 ÉLEVÉ  
**Risque** : CSV malveillants, injection

**Solution recommandée** :
```typescript
// Limiter la taille
app.use(express.json({ limit: '5mb' })); // ✅ Déjà fait

// Valider le contenu
const csvSchema = z.string()
  .max(10_000_000) // 10MB max
  .refine(val => !val.includes('<script')); // Anti-XSS basique
```

### Moyennes

#### 4. Pas de Helmet.js
**Impact** : 🟡 MOYEN  
**Risque** : Headers HTTP non sécurisés

**Solution** :
```bash
npm install helmet --workspace backend
```

```typescript
import helmet from 'helmet';
app.use(helmet());
```

#### 5. Dépendances non auditées
**Impact** : 🟡 MOYEN  
**Risque** : Vulnérabilités connues

**Solution** :
```bash
npm audit
npm audit fix
```

## 📋 Checklist de Sécurité

### Avant de déployer en production

- [ ] **HTTPS activé** (certificat SSL valide)
- [ ] **Authentification implémentée** (JWT/sessions)
- [ ] **CORS configuré** avec origine exacte
- [ ] **Rate limiting activé** et testé
- [ ] **Helmet.js installé** et configuré
- [ ] **Variables d'env en production** (secrets sécurisés)
- [ ] **Logs en mode production** (pas de stack traces)
- [ ] **npm audit** sans vulnérabilités critiques
- [ ] **Backup DB automatique** configuré
- [ ] **Monitoring** (Sentry, DataDog, etc.)
- [ ] **Firewall** configuré
- [ ] **Reverse proxy** (Nginx, Caddy)

### Développement

- [ ] **Ne jamais commiter .env**
- [ ] **Rotation des secrets** régulière
- [ ] **Revue de code** pour sécurité
- [ ] **Tests de sécurité** (OWASP top 10)

## 🔐 Bonnes Pratiques

### Variables d'Environnement

```typescript
// ✅ Bon
const apiKey = process.env.API_KEY;

// ❌ Mauvais
const apiKey = 'hardcoded-secret-123';
```

### Mots de Passe

```typescript
// ✅ Bon (si vous ajoutez l'auth)
import bcrypt from 'bcrypt';
const hashed = await bcrypt.hash(password, 10);

// ❌ Mauvais
const stored = password; // Jamais en clair !
```

### Tokens

```typescript
// ✅ Bon
const token = jwt.sign({ userId }, env.JWT_SECRET, { expiresIn: '1h' });

// ❌ Mauvais
const token = jwt.sign({ userId, password }, 'weak-secret');
```

### SQL Injection

```typescript
// ✅ Bon (Prisma protège automatiquement)
await prisma.user.findMany({ where: { name: userInput } });

// ❌ Mauvais (si vous utilisez du SQL brut)
await prisma.$executeRaw`SELECT * FROM users WHERE name = ${userInput}`;
// → Utiliser $executeRawUnsafe avec prudence uniquement
```

### XSS (Cross-Site Scripting)

```typescript
// ✅ Bon (React échappe automatiquement)
<div>{userInput}</div>

// ❌ Mauvais
<div dangerouslySetInnerHTML={{ __html: userInput }} />
```

## 🚨 Incidents de Sécurité

### Procédure en cas de fuite

1. **Isolation** : Couper l'accès immédiatement
2. **Rotation** : Changer tous les secrets exposés
3. **Audit** : Vérifier les logs d'accès
4. **Notification** : Informer les utilisateurs si nécessaire
5. **Post-mortem** : Documenter et corriger

### Contacts

- **Responsable sécurité** : [À définir]
- **Équipe DevOps** : [À définir]
- **Support** : [À définir]

## 📚 Ressources

- [OWASP Top 10](https://owasp.org/www-project-top-ten/)
- [Node.js Security Best Practices](https://nodejs.org/en/docs/guides/security/)
- [Express.js Security](https://expressjs.com/en/advanced/best-practice-security.html)
- [Prisma Security](https://www.prisma.io/docs/guides/security)

## 🔄 Mises à Jour

| Date | Version | Changements |
|------|---------|-------------|
| 2025-10-28 | 2.0.0 | Implémentation initiale rate limiting, logging, error handling |

---

**Dernière révision** : 28 octobre 2025  
**Statut** : 🟡 Production non recommandée sans authentification
