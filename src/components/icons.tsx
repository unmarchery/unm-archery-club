// Stroke icons used across the site. Decorative, so hidden from screen readers.
type P = { className?: string };
const base = {
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.8,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
  "aria-hidden": true,
};

export const HomeIcon = (p: P) => (
  <svg {...base} {...p}><path d="M3 10.5L12 3l9 7.5" /><path d="M5.5 9v12h13V9" /></svg>
);
export const CalendarIcon = (p: P) => (
  <svg {...base} {...p}><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M3 10h18M8 3v4M16 3v4" /></svg>
);
export const WalletIcon = (p: P) => (
  <svg {...base} {...p}><rect x="3" y="6" width="18" height="14" rx="2" /><path d="M3 10h18M16 15h2" /></svg>
);
export const CheckCircleIcon = (p: P) => (
  <svg {...base} {...p}><circle cx="12" cy="12" r="9" /><path d="M8 12.5l2.5 2.5L16 9.5" /></svg>
);
export const ClipboardIcon = (p: P) => (
  <svg {...base} {...p}><rect x="5" y="4" width="14" height="17" rx="2" /><path d="M9 4h6v3H9z" /><path d="M9 12h6M9 16h4" /></svg>
);
export const ArrowIcon = (p: P) => (
  <svg {...base} strokeWidth={2} {...p}><path d="M3 12h15" /><path d="M14 7l5 5-5 5" /><path d="M3 9l3 3-3 3" /></svg>
);
export const LockIcon = (p: P) => (
  <svg {...base} {...p}><rect x="5" y="11" width="14" height="10" rx="2" /><path d="M8 11V8a4 4 0 0 1 8 0v3" /></svg>
);
export const CloseIcon = (p: P) => (
  <svg {...base} strokeWidth={2} {...p}><path d="M6 6l12 12M18 6L6 18" /></svg>
);
export const ThemeIcon = (p: P) => (
  <svg {...base} {...p}><circle cx="12" cy="12" r="4" /><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" /></svg>
);
export const LogoutIcon = (p: P) => (
  <svg {...base} {...p}><path d="M15 4h4a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1h-4" /><path d="M10 16l-4-4 4-4" /><path d="M6 12h10" /></svg>
);
export const UsersIcon = (p: P) => (
  <svg {...base} {...p}><circle cx="9" cy="8" r="3.5" /><path d="M2.5 20a6.5 6.5 0 0 1 13 0" /><path d="M16 4.5a3.5 3.5 0 0 1 0 7M18 14.5a6.5 6.5 0 0 1 3.5 5.5" /></svg>
);
export const KeyIcon = (p: P) => (
  <svg {...base} {...p}><circle cx="8" cy="15" r="4" /><path d="M10.8 12.2L20 3M16 7l3 3M14 9l2 2" /></svg>
);
export const PlusIcon = (p: P) => (
  <svg {...base} strokeWidth={2} {...p}><path d="M12 5v14M5 12h14" /></svg>
);
export const MinusIcon = (p: P) => (
  <svg {...base} strokeWidth={2} {...p}><path d="M5 12h14" /></svg>
);
export const ChartIcon = (p: P) => (
  <svg {...base} {...p}><path d="M4 20V4M4 20h16" /><path d="M8 16v-4M12 16V8M16 16v-6" /></svg>
);
export const StarIcon = (p: P) => (
  <svg {...base} {...p}><path d="M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1-4.4-4.3 6.1-.9z" /></svg>
);
export const ShieldIcon = (p: P) => (
  <svg {...base} {...p}><path d="M12 3l8 3v6c0 4.5-3.4 8.2-8 9-4.6-.8-8-4.5-8-9V6z" /><path d="M9 12l2 2 4-4" /></svg>
);
export const ChatIcon = (p: P) => (
  <svg {...base} {...p}><path d="M4 20l1.5-4A8 8 0 1 1 9 19.5z" /><path d="M9 10h6M9 13h4" /></svg>
);
export const InfoIcon = (p: P) => (
  <svg {...base} {...p}><circle cx="12" cy="12" r="9" /><path d="M12 11v5M12 8h.01" /></svg>
);

// The club target, used on the passes card and in the arrow animation.
export function TargetRings({ className }: P) {
  return (
    <svg className={className} viewBox="0 0 180 180" aria-hidden="true">
      <circle cx="90" cy="90" r="88" fill="#F4F1E8" stroke="#8A867C" strokeWidth="1" />
      <circle cx="90" cy="90" r="70" fill="#151515" stroke="#3A3A3A" strokeWidth="1" />
      <circle cx="90" cy="90" r="53" fill="#1E75BA" />
      <circle cx="90" cy="90" r="35" fill="#EF1928" />
      <circle cx="90" cy="90" r="18" fill="#F8ED33" />
    </svg>
  );
}
