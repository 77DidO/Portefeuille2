# 💾 Guide de Sauvegarde - Portefeuille2

**Version** : 2.2.0  
**Dernière mise à jour** : 28 octobre 2025

---

## 📋 Table des matières

1. [Vue d'ensemble](#vue-densemble)
2. [Installation](#installation)
3. [Utilisation](#utilisation)
4. [API Endpoints](#api-endpoints)
5. [Automatisation](#automatisation)
6. [Récupération](#récupération)
7. [Bonnes pratiques](#bonnes-pratiques)
8. [Dépannage](#dépannage)

---

## 🎯 Vue d'ensemble

Le système de sauvegarde de Portefeuille2 offre plusieurs méthodes pour protéger vos données :

### ✅ Fonctionnalités

- ✅ **Sauvegarde à la demande** via commande npm
- ✅ **Compression optionnelle** (Gzip) pour économiser l'espace
- ✅ **Validation SHA256** pour vérifier l'intégrité
- ✅ **Rotation automatique** (garde les 30 derniers backups)
- ✅ **Restauration interactive** avec confirmation
- ✅ **API REST** pour intégration frontend
- ✅ **Backup de sécurité** automatique avant restauration
- ✅ **Multi-plateforme** (Windows, Linux, macOS)

### 📊 Données sauvegardées

| Type | Description | Priorité |
|------|-------------|----------|
| `dev.db` | Base SQLite complète | 🔴 CRITIQUE |
| Portfolios | Tous vos portefeuilles | 🔴 CRITIQUE |
| Assets | Actions, ETF, cryptos | 🔴 CRITIQUE |
| Transactions | Historique complet | 🔴 CRITIQUE |
| PricePoints | Historique des prix | 🟠 IMPORTANT |

**Note** : Le cache Redis n'est PAS sauvegardé (données récupérables via API).

---

## 🚀 Installation

### Prérequis

- Node.js 18+
- npm 9+
- Projet Portefeuille2 installé

### Fichiers créés

```
portefeuille2/
├── scripts/
│   ├── backup.mjs          ✅ Script principal (cross-platform)
│   ├── backup.ps1          ✅ Script PowerShell (Windows)
│   └── restore.mjs         ✅ Script de restauration
├── backups/                ✅ Dossier de stockage
│   └── README.md
└── apps/backend/src/routes/
    └── backupRoutes.ts     ✅ API endpoints
```

### Vérification

```bash
# Vérifier que les scripts existent
ls scripts/backup.mjs
ls scripts/restore.mjs

# Vérifier les commandes npm
npm run backup -- --help
```

---

## 💻 Utilisation

### 1️⃣ Créer un backup

#### Méthode 1 : Commande npm (recommandé)

```bash
# Backup simple
npm run backup

# Backup avec compression (recommandé)
npm run backup:compress

# Avec options (script direct)
node scripts/backup.mjs --compress --cloud
```

#### Méthode 2 : PowerShell (Windows uniquement)

```powershell
# Backup simple
.\scripts\backup.ps1

# Backup compressé
.\scripts\backup.ps1 -Compress

# Backup avec upload cloud (à configurer)
.\scripts\backup.ps1 -Compress -Cloud
```

#### Méthode 3 : API REST

```bash
# Créer un backup via API
curl -X POST http://localhost:4000/api/backup \
  -H "Content-Type: application/json" \
  -d '{"compress": true}'

# Lister les backups
curl http://localhost:4000/api/backup
```

### 2️⃣ Lister les backups

```bash
# Via npm
npm run restore

# Via API
curl http://localhost:4000/api/backup
```

**Exemple de sortie** :

```
📋 Backups disponibles:

  1. 🗜️  backup_20251028_143000.db.gz
     Taille: 42.5 KB | Date: 28/10/2025, 14:30

  2. 📦 backup_20251027_090000.db
     Taille: 160 KB | Date: 27/10/2025, 09:00
```

### 3️⃣ Restaurer un backup

```bash
# Méthode interactive (recommandé)
npm run restore

# Restaurer un backup spécifique
npm run restore backup_20251028_143000.db.gz
```

**⚠️ Processus de restauration :**

1. Affiche les informations du backup
2. Crée un backup de sécurité de la DB actuelle
3. Demande confirmation
4. Décompresse si nécessaire
5. Remplace la base de données
6. Affiche un message de succès

**Exemple de session** :

```
╔════════════════════════════════════════╗
║   RESTAURATION PORTEFEUILLE2          ║
╚════════════════════════════════════════╝

📋 Informations du backup:
  Fichier: backup_20251028_143000.db.gz
  Taille: 42.5 KB
  Date: 28/10/2025, 14:30:00
  Compressé: Oui

⚠️  ATTENTION:
  Cette opération va REMPLACER la base de données actuelle.
  Toutes les données non sauvegardées seront PERDUES.

Voulez-vous continuer ? (o/N): o

✓ Backup de sécurité créé (160 KB)
🗜️  Décompression...
✓ Backup décompressé

╔════════════════════════════════════════╗
║   ✅ RESTAURATION RÉUSSIE             ║
╚════════════════════════════════════════╝

💡 Redémarrez le serveur pour appliquer les changements
```

### 4️⃣ Supprimer un backup

```bash
# Via API uniquement (sécurité)
curl -X DELETE http://localhost:4000/api/backup/backup_20251027_090000.db
```

---

## 🔌 API Endpoints

### GET /api/backup

Liste tous les backups disponibles.

**Requête** :
```bash
GET http://localhost:4000/api/backup
```

**Réponse** :
```json
{
  "success": true,
  "count": 5,
  "backups": [
    {
      "filename": "backup_20251028_143000.db.gz",
      "size": 43520,
      "createdAt": "2025-10-28T14:30:00.000Z",
      "compressed": true
    },
    {
      "filename": "backup_20251027_090000.db",
      "size": 163840,
      "createdAt": "2025-10-27T09:00:00.000Z",
      "compressed": false
    }
  ]
}
```

### POST /api/backup

Crée un nouveau backup.

**Requête** :
```bash
POST http://localhost:4000/api/backup
Content-Type: application/json

{
  "compress": true
}
```

**Réponse** :
```json
{
  "success": true,
  "message": "Backup créé avec succès",
  "compressed": true,
  "output": "✅ BACKUP TERMINÉ AVEC SUCCÈS\n..."
}
```

### DELETE /api/backup/:filename

Supprime un backup spécifique.

**Requête** :
```bash
DELETE http://localhost:4000/api/backup/backup_20251027_090000.db
```

**Réponse** :
```json
{
  "success": true,
  "message": "Backup supprimé avec succès"
}
```

**Erreurs possibles** :
- `400` : Nom de fichier invalide
- `404` : Backup introuvable
- `500` : Erreur serveur

---

## ⏰ Automatisation

### Windows Task Scheduler

Pour créer un backup automatique quotidien :

1. **Ouvrir le Planificateur de tâches**
   - Rechercher "Task Scheduler" dans le menu Démarrer

2. **Créer une tâche de base**
   - Nom : "Backup Portefeuille2"
   - Description : "Sauvegarde quotidienne de la base de données"

3. **Déclencheur**
   - Quotidien à 2h du matin

4. **Action**
   - Programme : `node.exe`
   - Arguments : `C:\Projets\Portefeuille2\scripts\backup.mjs --compress`
   - Dossier de départ : `C:\Projets\Portefeuille2`

5. **Conditions**
   - ✅ Réveiller l'ordinateur pour exécuter la tâche
   - ✅ Exécuter même sur batterie

### Linux/macOS (Cron)

```bash
# Ouvrir crontab
crontab -e

# Ajouter cette ligne (backup tous les jours à 2h)
0 2 * * * cd /path/to/portefeuille2 && node scripts/backup.mjs --compress >> /var/log/backup-portfolio.log 2>&1
```

### systemd (Linux)

Créer `/etc/systemd/system/backup-portfolio.service` :

```ini
[Unit]
Description=Backup Portefeuille2
After=network.target

[Service]
Type=oneshot
User=youruser
WorkingDirectory=/path/to/portefeuille2
ExecStart=/usr/bin/node scripts/backup.mjs --compress

[Install]
WantedBy=multi-user.target
```

Créer `/etc/systemd/system/backup-portfolio.timer` :

```ini
[Unit]
Description=Backup Portefeuille2 Timer

[Timer]
OnCalendar=daily
OnCalendar=02:00
Persistent=true

[Install]
WantedBy=timers.target
```

Activer :
```bash
sudo systemctl enable backup-portfolio.timer
sudo systemctl start backup-portfolio.timer
```

---

## 🔄 Récupération

### Scénarios de récupération

#### Scénario 1 : Corruption de la base de données

```bash
# 1. Vérifier l'erreur
npm run dev
# Erreur : "database disk image is malformed"

# 2. Restaurer le dernier backup
npm run restore
# Sélectionner le backup le plus récent

# 3. Redémarrer le serveur
npm run dev
```

#### Scénario 2 : Suppression accidentelle

```bash
# 1. Arrêter le serveur immédiatement
Ctrl+C

# 2. Restaurer le backup
npm run restore backup_20251028_143000.db.gz

# 3. Redémarrer
npm run dev
```

#### Scénario 3 : Migration vers un nouveau serveur

```bash
# Sur l'ancien serveur
npm run backup:compress
# Copier le fichier backups/backup_*.db.gz

# Sur le nouveau serveur
# 1. Installer le projet
git clone https://github.com/77DidO/Portefeuille2.git
cd Portefeuille2
npm install

# 2. Copier le backup
mkdir backups
cp backup_20251028_143000.db.gz backups/

# 3. Restaurer
npm run restore backup_20251028_143000.db.gz

# 4. Lancer
npm run dev
```

---

## ✅ Bonnes pratiques

### Fréquence recommandée

| Type d'utilisation | Fréquence de backup |
|-------------------|---------------------|
| Usage intensif (quotidien) | Avant chaque import CSV |
| Usage régulier | 1x par semaine |
| Usage occasionnel | Avant chaque modification |

### Règle 3-2-1

Pour une protection optimale :

- **3** copies de vos données (original + 2 backups)
- **2** supports différents (disque local + cloud)
- **1** copie hors site (OneDrive, Dropbox, etc.)

### Stratégie recommandée

```bash
# 1. Backup local compressé
npm run backup:compress

# 2. Copier vers OneDrive/Dropbox
cp backups/backup_*.db.gz ~/OneDrive/Backups/Portefeuille2/

# 3. Vérifier le backup
npm run restore  # Lister et vérifier la présence
```

### Rotation intelligente

Le système garde automatiquement :
- ✅ Les 30 derniers backups
- ✅ Suppression auto des backups > 30 jours
- ✅ Pas de limite de taille totale

Pour conserver plus longtemps :
```bash
# Copier manuellement les backups importants
cp backups/backup_20251028_143000.db.gz backups/archive/
```

---

## 🔒 Sécurité

### Protection des backups

**Important** : Les backups contiennent vos données financières sensibles.

#### .gitignore

Vérifier que `/backups/` est bien ignoré :

```bash
# Vérifier
cat .gitignore | grep backups

# Doit afficher :
backups/
```

#### Chiffrement (optionnel)

Pour chiffrer un backup sensible :

```bash
# Chiffrer avec GPG
gpg -c backups/backup_20251028_143000.db.gz
# Créé backup_20251028_143000.db.gz.gpg

# Déchiffrer
gpg backups/backup_20251028_143000.db.gz.gpg
```

#### Cloud sécurisé

Options recommandées :
- **OneDrive Personal Vault** (chiffré)
- **Dropbox avec 2FA**
- **Google Drive avec chiffrement côté client**
- **Cryptomator** (chiffre avant upload)

---

## 🛠️ Dépannage

### Problème : "Backup introuvable"

```bash
# Vérifier le dossier backups
ls -la backups/

# Créer le dossier si nécessaire
mkdir -p backups

# Relancer le backup
npm run backup
```

### Problème : "Permission denied"

```bash
# Windows (PowerShell en admin)
icacls backups /grant Everyone:F

# Linux/macOS
chmod -R 755 backups/
```

### Problème : "Timeout" lors du backup via API

Augmenter le timeout dans `backupRoutes.ts` :

```typescript
const { stdout, stderr } = await execAsync(command, {
  timeout: 60000, // 60 secondes au lieu de 30
});
```

### Problème : Backup corrompu

```bash
# Vérifier l'intégrité avec SQLite
sqlite3 backups/backup_20251028_143000.db "PRAGMA integrity_check;"
# Doit afficher : ok

# Si corrompu, utiliser un backup plus ancien
npm run restore backup_20251027_090000.db
```

### Problème : Espace disque insuffisant

```bash
# Vérifier l'espace
df -h .  # Linux/macOS
Get-PSDrive C  # Windows

# Supprimer les vieux backups
rm backups/backup_202510*.db

# Compresser les backups existants
gzip backups/*.db
```

---

## 📊 Statistiques

### Tailles typiques

| Type | Taille non compressé | Compressé (Gzip) | Ratio |
|------|---------------------|------------------|-------|
| DB vide | 28 KB | 8 KB | 29% |
| 10 portfolios | 160 KB | 45 KB | 28% |
| 100 portfolios | 1.2 MB | 320 KB | 27% |
| 1000 transactions | 850 KB | 210 KB | 25% |

**Recommandation** : Toujours utiliser `--compress` pour économiser 70-75% d'espace.

### Temps d'exécution

| Opération | Temps moyen |
|-----------|-------------|
| Backup simple | < 1 seconde |
| Backup compressé | 1-2 secondes |
| Restauration | 1-2 secondes |
| Restauration compressée | 2-3 secondes |

---

## 🎯 Checklist avant production

- [ ] Tester un backup complet
- [ ] Tester une restauration
- [ ] Configurer un backup automatique
- [ ] Configurer une sauvegarde cloud
- [ ] Vérifier le `.gitignore`
- [ ] Documenter la procédure pour l'équipe
- [ ] Tester un scénario de récupération d'urgence

---

## 📚 Ressources

- [Documentation SQLite](https://www.sqlite.org/backup.html)
- [Prisma Migrations](https://www.prisma.io/docs/concepts/components/prisma-migrate)
- [Node.js fs/promises](https://nodejs.org/api/fs.html#promises-api)

---

## 🆘 Support

En cas de problème :

1. Vérifier la section [Dépannage](#dépannage)
2. Consulter les logs du serveur
3. Ouvrir une issue sur GitHub
4. Contacter l'équipe de développement

---

**Auteur** : 77DidO  
**Licence** : MIT  
**Version** : 2.2.0
