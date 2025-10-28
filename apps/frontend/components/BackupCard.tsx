'use client';

import { useState } from 'react';
import { formatDistanceToNow } from 'date-fns';
import { fr } from 'date-fns/locale';
import { useToast } from './ToastProvider';

interface BackupCardProps {
  filename: string;
  size: number;
  createdAt: string;
  compressed: boolean;
  onDelete: (filename: string) => Promise<void>;
  onDownload: (filename: string) => void;
}

export function BackupCard({
  filename,
  size,
  createdAt,
  compressed,
  onDelete,
  onDownload,
}: BackupCardProps) {
  const { pushToast } = useToast();
  const [isDeleting, setIsDeleting] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const formatBytes = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} Ko`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} Mo`;
  };

  const handleDelete = async () => {
    setIsDeleting(true);
    try {
      await onDelete(filename);
      pushToast({ 
        message: `✓ Backup supprimé : ${filename}`, 
        variant: 'success',
        duration: 4000,
      });
    } catch (error) {
      console.error('Erreur lors de la suppression:', error);
      const errorMsg = error instanceof Error ? error.message : 'Échec de la suppression';
      pushToast({ 
        message: errorMsg, 
        variant: 'error',
        duration: 5000,
      });
    } finally {
      setIsDeleting(false);
      setShowConfirm(false);
    }
  };

  const timeAgo = formatDistanceToNow(new Date(createdAt), {
    addSuffix: true,
    locale: fr,
  });

  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: '12px',
      padding: '8px 12px',
      borderRadius: '6px',
      border: '1px solid rgba(255,255,255,0.05)',
      background: 'rgba(255,255,255,0.02)',
      transition: 'all 0.2s'
    }}>
      <div style={{ minWidth: 0, flex: 1 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '2px' }}>
          <p style={{ fontSize: '12px', fontWeight: 500, color: '#d1d5db', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', margin: 0 }}>
            {filename}
          </p>
          {compressed && (
            <span style={{ flexShrink: 0, borderRadius: '4px', background: 'rgba(168,85,247,0.1)', padding: '2px 6px', fontSize: '10px', fontWeight: 500, color: '#c084fc' }}>
              Compressé
            </span>
          )}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '11px', color: '#6b7280' }}>
          <span>{formatBytes(size)}</span>
          <span>•</span>
          <span>{timeAgo}</span>
        </div>
      </div>

      <div style={{ display: 'flex', flexShrink: 0, alignItems: 'center', gap: '4px' }}>
        {!showConfirm ? (
          <>
            <button
              onClick={() => onDownload(filename)}
              title="Télécharger"
              style={{
                width: '24px',
                height: '24px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                borderRadius: '4px',
                background: 'rgba(255,255,255,0.05)',
                color: '#9ca3af',
                border: 'none',
                cursor: 'pointer',
                transition: 'all 0.2s'
              }}
            >
              <svg style={{ width: '12px', height: '12px' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
            </button>
            <button
              onClick={() => setShowConfirm(true)}
              title="Supprimer"
              style={{
                width: '24px',
                height: '24px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                borderRadius: '4px',
                background: 'rgba(255,255,255,0.05)',
                color: '#9ca3af',
                border: 'none',
                cursor: 'pointer',
                transition: 'all 0.2s'
              }}
            >
              <svg style={{ width: '12px', height: '12px' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
            </button>
          </>
        ) : (
          <>
            <button
              onClick={handleDelete}
              disabled={isDeleting}
              style={{
                borderRadius: '4px',
                background: '#dc2626',
                padding: '4px 8px',
                fontSize: '11px',
                fontWeight: 500,
                color: 'white',
                border: 'none',
                cursor: isDeleting ? 'not-allowed' : 'pointer',
                opacity: isDeleting ? 0.5 : 1,
                transition: 'all 0.2s'
              }}
            >
              {isDeleting ? 'Suppression...' : 'Confirmer'}
            </button>
            <button
              onClick={() => setShowConfirm(false)}
              disabled={isDeleting}
              style={{
                borderRadius: '4px',
                background: 'rgba(255,255,255,0.1)',
                padding: '4px 8px',
                fontSize: '11px',
                fontWeight: 500,
                color: '#d1d5db',
                border: 'none',
                cursor: isDeleting ? 'not-allowed' : 'pointer',
                opacity: isDeleting ? 0.5 : 1,
                transition: 'all 0.2s'
              }}
            >
              Annuler
            </button>
          </>
        )}
      </div>
    </div>
  );
}
