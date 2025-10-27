'use client';

import { useEffect, useState } from 'react';
// Nous importons canvas-confetti dynamiquement à l'exécution depuis useEffect

interface CelebrationProps {
  trigger: boolean;
  message?: string;
  type?: 'success' | 'achievement' | 'milestone';
}

export function Celebration({ trigger, message, type = 'success' }: CelebrationProps) {
  const [shown, setShown] = useState(false);

  useEffect(() => {
    const launchConfetti = async () => {
      if (!trigger || shown) return;
      
      setShown(true);
      
      try {
        // Import dynamique côté client
        let confettiFn: ((opts?: any) => void) | null = null;
        try {
          const mod = await import('canvas-confetti');
          confettiFn = (mod && (mod.default ?? mod)) as any;
        } catch (impErr) {
          console.error('Failed to import canvas-confetti', impErr);
        }

        switch (type) {
          case 'success':
            confettiFn?.({ particleCount: 100, spread: 70, origin: { y: 0.6 } });
            break;

          case 'achievement': {
            const end = Date.now() + 1000;
            const colors = ['#38bdf8', '#34d399', '#f97316'];

            const frame = () => {
              try {
                confettiFn?.({ particleCount: 3, angle: 60, spread: 55, origin: { x: 0 }, colors });
                confettiFn?.({ particleCount: 3, angle: 120, spread: 55, origin: { x: 1 }, colors });
                if (Date.now() < end) requestAnimationFrame(frame);
              } catch (error) {
                console.error('Error during achievement animation:', error);
              }
            };

            frame();
            break;
          }

          case 'milestone': {
            const duration = 3000;
            const animationEnd = Date.now() + duration;

            const milestoneFrame = () => {
              try {
                const timeLeft = animationEnd - Date.now();
                const ticks = Math.max(200, 500 * (timeLeft / duration));
                confettiFn?.({
                  particleCount: 1,
                  startVelocity: 30,
                  ticks,
                  origin: { x: Math.random(), y: Math.random() * 0.5 + 0.3 },
                  colors: ['#38bdf8'],
                  shapes: ['circle'],
                  gravity: 0.8,
                  scalar: 0.9,
                  drift: 0
                });
                if (timeLeft > 0) requestAnimationFrame(milestoneFrame);
              } catch (error) {
                console.error('Error during milestone animation:', error);
              }
            };

            milestoneFrame();
            break;
          }
        }
      } catch (error) {
        console.error('Error launching confetti:', error);
      }
    };

    launchConfetti();
  }, [trigger, type, shown]);

  if (!trigger || !message) return null;

  return (
    <div className="celebration">
      <div className="celebration__message success-sparkle">
        {message}
      </div>
    </div>
  );
}