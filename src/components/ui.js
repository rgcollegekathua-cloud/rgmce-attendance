import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
export function Alert({ tone = 'info', title, children }) {
    const tones = {
        info: 'border-sky-200 bg-sky-50 text-sky-900',
        success: 'border-green-200 bg-green-50 text-green-900',
        error: 'border-red-200 bg-red-50 text-red-900',
        warning: 'border-amber-200 bg-amber-50 text-amber-900'
    };
    return (_jsxs("div", { role: tone === 'error' ? 'alert' : 'status', className: `rounded-lg border px-4 py-3 text-sm ${tones[tone]}`, children: [title && _jsx("p", { className: "mb-1 font-semibold", children: title }), _jsx("div", { className: "leading-relaxed", children: children })] }));
}
export function StatCard({ label, value, hint, tone = 'default' }) {
    const accents = {
        default: 'text-brand-900',
        good: 'text-green-700',
        warn: 'text-amber-700',
        bad: 'text-red-700'
    };
    return (_jsxs("div", { className: "card", children: [_jsx("p", { className: "text-xs font-semibold uppercase tracking-wide text-slate-500", children: label }), _jsx("p", { className: `mt-1 text-3xl font-bold ${accents[tone]}`, children: value }), hint && _jsx("p", { className: "mt-1 text-xs text-slate-500", children: hint })] }));
}
export function Spinner({ label = 'Loading' }) {
    return (_jsxs("div", { className: "flex items-center justify-center gap-3 py-10 text-slate-600", children: [_jsx("span", { className: "h-5 w-5 animate-spin rounded-full border-2 border-brand-700 border-t-transparent" }), _jsxs("span", { className: "text-sm", children: [label, "\u2026"] })] }));
}
export function PageHeader({ title, subtitle, actions }) {
    return (_jsxs("div", { className: "mb-4 flex flex-col gap-3 sm:mb-6 sm:flex-row sm:items-center sm:justify-between", children: [_jsxs("div", { children: [_jsx("h1", { className: "page-title", children: title }), subtitle && _jsx("p", { className: "muted mt-1", children: subtitle })] }), actions && _jsx("div", { className: "no-print flex flex-wrap gap-2", children: actions })] }));
}
