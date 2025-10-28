# ===============================================
# Script de Sauvegarde SQLite - Portefeuille2
# ===============================================
# Usage: .\scripts\backup.ps1 [-Compress] [-Cloud]
# 
# Options:
#   -Compress : Compresse le backup en .gz
#   -Cloud    : Upload vers OneDrive/Dropbox (à configurer)
# ===============================================

param(
    [switch]$Compress = $false,
    [switch]$Cloud = $false
)

# Configuration
$DB_PATH = ".\apps\backend\prisma\dev.db"
$BACKUP_DIR = ".\backups"
$MAX_BACKUPS = 30
$DATE = Get-Date -Format "yyyyMMdd_HHmmss"
$BACKUP_NAME = "backup_$DATE.db"

# Couleurs
function Write-Success { Write-Host $args -ForegroundColor Green }
function Write-Info { Write-Host $args -ForegroundColor Cyan }
function Write-Warning { Write-Host $args -ForegroundColor Yellow }
function Write-Failure { Write-Host $args -ForegroundColor Red }

# Banner
Write-Host ""
Write-Host "╔════════════════════════════════════════╗" -ForegroundColor Cyan
Write-Host "║   SAUVEGARDE PORTEFEUILLE2            ║" -ForegroundColor Cyan
Write-Host "╚════════════════════════════════════════╝" -ForegroundColor Cyan
Write-Host ""

# Vérifications préalables
Write-Info "🔍 Vérifications..."

if (-not (Test-Path $DB_PATH)) {
    Write-Failure "❌ Erreur: Base de données introuvable à $DB_PATH"
    exit 1
}

$dbSize = (Get-Item $DB_PATH).Length
Write-Success "✓ Base de données trouvée ($([math]::Round($dbSize/1KB, 2)) KB)"

# Création du dossier de backup
if (-not (Test-Path $BACKUP_DIR)) {
    New-Item -ItemType Directory -Path $BACKUP_DIR -Force | Out-Null
    Write-Success "✓ Dossier backups créé"
}

# Copie de la base de données
Write-Info "`n📦 Création du backup..."
$backupPath = Join-Path $BACKUP_DIR $BACKUP_NAME

try {
    Copy-Item $DB_PATH $backupPath -Force
    $backupSize = (Get-Item $backupPath).Length
    Write-Success "✓ Backup créé: $BACKUP_NAME ($([math]::Round($backupSize/1KB, 2)) KB)"
} catch {
    Write-Failure "❌ Erreur lors de la copie: $_"
    exit 1
}

# Compression (optionnel)
if ($Compress) {
    Write-Info "`n🗜️  Compression..."
    $gzPath = "$backupPath.gz"
    
    try {
        $input = [System.IO.File]::OpenRead($backupPath)
        $output = [System.IO.File]::Create($gzPath)
        $gzip = New-Object System.IO.Compression.GZipStream($output, [System.IO.Compression.CompressionMode]::Compress)
        
        $input.CopyTo($gzip)
        
        $gzip.Close()
        $output.Close()
        $input.Close()
        
        Remove-Item $backupPath -Force
        
        $compressedSize = (Get-Item $gzPath).Length
        $ratio = [math]::Round(($compressedSize / $backupSize) * 100, 1)
        Write-Success "✓ Backup compressé: $BACKUP_NAME.gz ($([math]::Round($compressedSize/1KB, 2)) KB, $ratio%)"
        
        $backupPath = $gzPath
    } catch {
        Write-Warning "⚠️  Erreur compression: $_"
    }
}

# Validation de l'intégrité
Write-Info "`n🔐 Validation..."
if (Test-Path $backupPath) {
    $hash = Get-FileHash $backupPath -Algorithm SHA256
    Write-Success "✓ SHA256: $($hash.Hash.Substring(0, 16))..."
} else {
    Write-Failure "❌ Fichier de backup introuvable!"
    exit 1
}

# Rotation des backups (garder les 30 derniers)
Write-Info "`n🗑️  Nettoyage des anciens backups..."
$oldBackups = Get-ChildItem $BACKUP_DIR -Filter "backup_*.db*" | 
              Sort-Object LastWriteTime -Descending | 
              Select-Object -Skip $MAX_BACKUPS

if ($oldBackups) {
    $oldBackups | ForEach-Object {
        Remove-Item $_.FullName -Force
        Write-Info "  Supprimé: $($_.Name)"
    }
    Write-Success "✓ $($oldBackups.Count) ancien(s) backup(s) supprimé(s)"
} else {
    Write-Success "✓ Aucun backup à supprimer"
}

# Liste des backups disponibles
Write-Info "`n📋 Backups disponibles:"
$backups = Get-ChildItem $BACKUP_DIR -Filter "backup_*.db*" | 
           Sort-Object LastWriteTime -Descending |
           Select-Object -First 10

$backups | ForEach-Object {
    $age = (Get-Date) - $_.LastWriteTime
    $ageStr = if ($age.Days -gt 0) { "$($age.Days)j" } 
              elseif ($age.Hours -gt 0) { "$($age.Hours)h" }
              else { "$($age.Minutes)m" }
    
    Write-Host "  • $($_.Name) " -NoNewline
    Write-Host "($([math]::Round($_.Length/1KB, 2)) KB, il y a $ageStr)" -ForegroundColor Gray
}

# Upload Cloud (optionnel)
if ($Cloud) {
    Write-Info "`n☁️  Upload cloud..."
    Write-Warning "⚠️  Fonctionnalité Cloud non configurée"
    Write-Info "   Pour activer:"
    Write-Info "   1. OneDrive: Copiez vers C:\Users\$env:USERNAME\OneDrive\Backups"
    Write-Info "   2. Dropbox: Utilisez l'API Dropbox"
    Write-Info "   3. AWS S3: Installez AWS CLI et configurez"
}

# Résumé final
Write-Host ""
Write-Host "╔════════════════════════════════════════╗" -ForegroundColor Green
Write-Host "║   ✅ BACKUP TERMINÉ AVEC SUCCÈS       ║" -ForegroundColor Green
Write-Host "╚════════════════════════════════════════╝" -ForegroundColor Green
Write-Host ""
Write-Success "📁 Emplacement: $backupPath"
Write-Success "📊 Taille: $([math]::Round((Get-Item $backupPath).Length/1KB, 2)) KB"
Write-Success "🕐 Date: $(Get-Date -Format 'dd/MM/yyyy HH:mm:ss')"
Write-Host ""
Write-Info "💡 Pour restaurer: npm run restore"
Write-Host ""
