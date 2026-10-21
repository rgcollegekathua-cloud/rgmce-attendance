import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { Html5Qrcode } from 'html5-qrcode';
import { useEffect, useRef, useState } from 'react';
import { Alert } from './ui';
const REGION_ID = 'rgmce-qr-region';
export function QRScanner({ active, onScan, onClose }) {
    const scannerRef = useRef(null);
    const [error, setError] = useState(null);
    const [starting, setStarting] = useState(false);
    useEffect(() => {
        if (!active)
            return undefined;
        let cancelled = false;
        setError(null);
        setStarting(true);
        const scanner = new Html5Qrcode(REGION_ID, {
            verbose: false,
            formatsToSupport: undefined
        });
        scannerRef.current = scanner;
        scanner
            .start({ facingMode: 'environment' }, { fps: 10, qrbox: { width: 230, height: 230 } }, (decodedText) => {
            if (cancelled)
                return;
            onScan(decodedText);
        }, () => {
            /* per-frame decode misses are expected */
        })
            .then(() => {
            if (!cancelled)
                setStarting(false);
        })
            .catch((err) => {
            if (cancelled)
                return;
            setStarting(false);
            const message = err instanceof Error ? err.message : 'Could not start the camera.';
            setError(/permission|notallowed|denied/i.test(message)
                ? 'Camera permission was denied. Allow camera access in your browser settings and try again.'
                : `Camera unavailable: ${message}`);
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
                    }
                    catch {
                        /* element already removed */
                    }
                });
            }
        };
    }, [active, onScan]);
    if (!active)
        return null;
    return (_jsxs("div", { className: "card no-print", children: [_jsxs("div", { className: "mb-3 flex items-center justify-between gap-3", children: [_jsxs("div", { children: [_jsx("h2", { className: "font-semibold text-brand-900", children: "Scan the college QR code" }), _jsx("p", { className: "muted", children: "Point the camera at the QR code displayed on the college office board." })] }), _jsx("button", { type: "button", className: "btn-secondary", onClick: onClose, children: "Close" })] }), _jsx("div", { className: "overflow-hidden rounded-lg border border-slate-200 bg-black", children: _jsx("div", { id: REGION_ID, className: "min-h-[260px] w-full" }) }), starting && _jsx("p", { className: "muted mt-2", children: "Starting camera\u2026" }), error && (_jsx("div", { className: "mt-3", children: _jsx(Alert, { tone: "error", children: error }) }))] }));
}
