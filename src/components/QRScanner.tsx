import { Html5Qrcode } from 'html5-qrcode';
import { useEffect, useRef, useState } from 'react';
import { Alert } from './ui';

const REGION_ID = 'rgmce-qr-region';

interface Props {
  active: boolean;
  onScan: (text: string) => void;
  onClose: () => void;
}

export function QRScanner({ active, onScan, onClose }: Props) {
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [starting, setStarting] = useState(false);

  useEffect(() => {
    if (!active) return undefined;
    let cancelled = false;
    setError(null);
    setStarting(true);

    const scanner = new Html5Qrcode(REGION_ID, {
      verbose: false,
      formatsToSupport: undefined
    });
    scannerRef.current = scanner;

    scanner
      .start(
        { facingMode: 'environment' },
        { fps: 10, qrbox: { width: 230, height: 230 } },
        (decodedText) => {
          if (cancelled) return;
          onScan(decodedText);
        },
        () => {
          /* per-frame decode misses are expected */
        }
      )
      .then(() => {
        if (!cancelled) setStarting(false);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setStarting(false);
        const message =
          err instanceof Error ? err.message : 'Could not start the camera.';
        setError(
          /permission|notallowed|denied/i.test(message)
            ? 'Camera permission was denied. Allow camera access in your browser settings and try again.'
            : `Camera unavailable: ${message}`
        );
      });

    return () => {
      cancelled = true;
      const instance = scannerRef.current;
      scannerRef.current = null;
      if (instance) {
        instance
          .stop()
          .catch(() => undefined)
          .finally(() => {
            try {
              instance.clear();
            } catch {
              /* element already removed */
            }
          });
      }
    };
  }, [active, onScan]);

  if (!active) return null;

  return (
    <div className="card no-print">
      <div className="mb-3 flex items-center justify-between gap-3">
        <div>
          <h2 className="font-semibold text-brand-900">Scan the college QR code</h2>
          <p className="muted">Point the camera at the QR code displayed on the college office board.</p>
        </div>
        <button type="button" className="btn-secondary" onClick={onClose}>
          Close
        </button>
      </div>
      <div className="overflow-hidden rounded-lg border border-slate-200 bg-black">
        <div id={REGION_ID} className="min-h-[260px] w-full" />
      </div>
      {starting && <p className="muted mt-2">Starting camera…</p>}
      {error && (
        <div className="mt-3">
          <Alert tone="error">{error}</Alert>
        </div>
      )}
    </div>
  );
}
