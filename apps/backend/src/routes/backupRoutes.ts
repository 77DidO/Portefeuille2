import express, { Request, Response } from 'express';
import { asyncHandler } from '../middleware/errorHandler.js';
import { exec } from 'child_process';
import { promisify } from 'util';
import { readdir, stat } from 'fs/promises';
import { join } from 'path';
import { prisma } from '../prismaClient.js';

const execAsync = promisify(exec);
const router = express.Router();

// In monorepo, backend runs with cwd = apps/backend. We need repo root for scripts/backups.
const REPO_ROOT = join(process.cwd(), '..', '..');
const BACKUP_DIR = join(REPO_ROOT, 'backups');
const BACKUP_SCRIPT = join(REPO_ROOT, 'scripts', 'backup.mjs');

/**
 * GET /api/backup
 * Liste tous les backups disponibles
 */
router.get(
  '/',
  asyncHandler(async (req, res) => {
    console.log('Listing available backups');

    try {
      const files = await readdir(BACKUP_DIR);
      const backups = [];

      for (const file of files) {
        if (file.startsWith('backup_') && (file.endsWith('.db') || file.endsWith('.db.gz'))) {
          const filePath = join(BACKUP_DIR, file);
          const stats = await stat(filePath);
          
          backups.push({
            filename: file,
            size: stats.size,
            createdAt: stats.mtime,
            compressed: file.endsWith('.gz'),
          });
        }
      }

      // Trier par date décroissante
      backups.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

      res.json({
        success: true,
        count: backups.length,
        backups,
      });
    } catch (err: any) {
      if (err?.code === 'ENOENT') {
        res.json({
          success: true,
          count: 0,
          backups: [],
          message: 'Aucun backup disponible',
        });
      } else {
        throw err;
      }
    }
  })
);

/**
 * POST /api/backup
 * Crée un nouveau backup
 */
router.post(
  '/',
  asyncHandler(async (req, res) => {
    const { compress = false } = req.body;

    console.log('Creating new backup', { compress });

    try {
      // Récupérer les statistiques avant le backup
      const [portfolioCount, assetCount, transactionCount] = await Promise.all([
        prisma.portfolio.count(),
        prisma.asset.count(),
        prisma.transaction.count(),
      ]);

      const args = compress ? '--compress' : '';
      const command = `node "${BACKUP_SCRIPT}" ${args}`;

      const { stdout, stderr } = await execAsync(command, {
        timeout: 30000, // 30 secondes max
      });

      console.log('Backup created successfully');

      res.json({
        success: true,
        message: 'Backup créé avec succès',
        output: stdout,
        compressed: compress,
        stats: {
          portfolios: portfolioCount,
          assets: assetCount,
          transactions: transactionCount,
        },
      });
    } catch (err: any) {
      console.error('Backup creation failed', err);
      
      res.status(500).json({
        success: false,
        message: 'Erreur lors de la création du backup',
        error: err?.message || 'Unknown error',
      });
    }
  })
);

/**
 * DELETE /api/backup/:filename
 * Supprime un backup spécifique
 */
router.delete(
  '/:filename',
  asyncHandler(async (req: Request, res: Response) => {
    const { filename } = req.params;

    // Validation du nom de fichier (sécurité)
    if (!filename.startsWith('backup_') || 
        !(filename.endsWith('.db') || filename.endsWith('.db.gz'))) {
      res.status(400).json({
        success: false,
        message: 'Nom de fichier invalide',
      });
      return;
    }

    console.log('Deleting backup', { filename });

    const filePath = join(BACKUP_DIR, filename);

    try {
      const { unlink } = await import('fs/promises');
      await unlink(filePath);

      console.log('Backup deleted successfully', { filename });

      res.json({
        success: true,
        message: 'Backup supprimé avec succès',
      });
    } catch (err: any) {
      if (err?.code === 'ENOENT') {
        res.status(404).json({
          success: false,
          message: 'Backup introuvable',
        });
        return;
      }
      throw err;
    }
  })
);

/**
 * GET /api/backup/download/:filename
 * Télécharge un backup spécifique
 */
router.get(
  '/download/:filename',
  asyncHandler(async (req: Request, res: Response) => {
    const { filename } = req.params;

    // Validation du nom de fichier (sécurité)
    if (!filename.startsWith('backup_') || 
        !(filename.endsWith('.db') || filename.endsWith('.db.gz'))) {
      res.status(400).json({
        success: false,
        message: 'Nom de fichier invalide',
      });
      return;
    }

    console.log('Downloading backup', { filename });

    const filePath = join(BACKUP_DIR, filename);

    try {
      await stat(filePath);
      
      // Définir les headers pour le téléchargement
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      res.setHeader('Content-Type', filename.endsWith('.gz') ? 'application/gzip' : 'application/octet-stream');
      
      // Streamer le fichier
      const { createReadStream } = await import('fs');
      const fileStream = createReadStream(filePath);
      fileStream.pipe(res);
      
      console.log('Backup download started', { filename });
    } catch (err: any) {
      if (err?.code === 'ENOENT') {
        res.status(404).json({
          success: false,
          message: 'Backup introuvable',
        });
        return;
      }
      throw err;
    }
  })
);

export default router;
