/** Inline SVGs so the preview needs no icon font or network request. */

const base = {
  width: 16,
  height: 16,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.8,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
};

export const TagIcon = ({ size = 16 }: { size?: number }) => (
  <svg {...base} width={size} height={size}>
    <path d="M20.6 13.4 12 22l-9-9V3h10l7.6 7.6a2 2 0 0 1 0 2.8Z" />
    <circle cx="7.5" cy="7.5" r="1.3" fill="currentColor" stroke="none" />
  </svg>
);

export const SearchIcon = ({ size = 16 }: { size?: number }) => (
  <svg {...base} width={size} height={size}>
    <circle cx="11" cy="11" r="7" />
    <path d="m20 20-3.5-3.5" />
  </svg>
);

export const CategoriesIcon = ({ size = 16 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
    <circle cx="7" cy="7" r="2.6" />
    <circle cx="17" cy="7" r="2.6" />
    <circle cx="7" cy="17" r="2.6" />
    <circle cx="17" cy="17" r="2.6" />
  </svg>
);

export const CatalogIcon = ({ size = 18 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
    <path d="M4 4h7v16H4z" />
    <path d="M13 4h7v16h-7z" />
    <path d="M15.5 8.5h2M15.5 12h2" />
  </svg>
);

export const MinusIcon = ({ size = 18 }: { size?: number }) => (
  <svg {...base} width={size} height={size}>
    <circle cx="12" cy="12" r="9" />
    <path d="M8.5 12h7" />
  </svg>
);

export const PlusIcon = ({ size = 18 }: { size?: number }) => (
  <svg {...base} width={size} height={size}>
    <circle cx="12" cy="12" r="9" />
    <path d="M12 8.5v7M8.5 12h7" />
  </svg>
);

export const GearIcon = ({ size = 17 }: { size?: number }) => (
  <svg {...base} width={size} height={size}>
    <circle cx="12" cy="12" r="3.2" />
    <path d="M19.4 15a1.6 1.6 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.6 1.6 0 0 0-1.8-.3 1.6 1.6 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1A1.6 1.6 0 0 0 9 19.4a1.6 1.6 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.6 1.6 0 0 0 .3-1.8 1.6 1.6 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1A1.6 1.6 0 0 0 4.6 9a1.6 1.6 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.6 1.6 0 0 0 1.8.3H9a1.6 1.6 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.6 1.6 0 0 0 1 1.5 1.6 1.6 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.6 1.6 0 0 0-.3 1.8V9a1.6 1.6 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.6 1.6 0 0 0-1.5 1Z" />
  </svg>
);

export const FilterIcon = ({ size = 17 }: { size?: number }) => (
  <svg {...base} width={size} height={size}>
    <path d="M3 5h18l-7 8v6l-4 2v-8Z" />
  </svg>
);

export const SortIcon = ({ size = 17 }: { size?: number }) => (
  <svg {...base} width={size} height={size}>
    <path d="M7 4v16M7 20l-3-3M7 20l3-3" />
    <path d="M17 20V4M17 4l-3 3M17 4l3 3" />
  </svg>
);

export const CheckIcon = ({ size = 16 }: { size?: number }) => (
  <svg {...base} width={size} height={size}>
    <path d="m4.5 12.5 5 5 10-11" />
  </svg>
);

export const StarIcon = ({ size = 17, filled = false }: { size?: number; filled?: boolean }) => (
  <svg {...base} width={size} height={size} fill={filled ? 'currentColor' : 'none'}>
    <path d="m12 3.5 2.6 5.3 5.9.9-4.2 4.1 1 5.8-5.3-2.8-5.3 2.8 1-5.8-4.2-4.1 5.9-.9Z" />
  </svg>
);

export const CaretIcon = ({ size = 15 }: { size?: number }) => (
  <svg {...base} width={size} height={size}>
    <path d="m6 9 6 6 6-6" />
  </svg>
);

export const ChevronIcon = ({ size = 15 }: { size?: number }) => (
  <svg {...base} width={size} height={size}>
    <path d="m9 6 6 6-6 6" />
  </svg>
);

export const RefreshIcon = ({ size = 15 }: { size?: number }) => (
  <svg {...base} width={size} height={size}>
    <path d="M20 11a8 8 0 1 0-.6 4" />
    <path d="M20 4v7h-7" />
  </svg>
);

export const ErrorIcon = ({ size = 17 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="#ba0517" strokeWidth="2">
    <circle cx="12" cy="12" r="9" />
    <path d="m6 18 12-12" />
  </svg>
);

export const WarnIcon = ({ size = 17 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="#e8a33d" stroke="none">
    <path d="M12 3 22 20H2Z" />
    <path d="M12 9v5M12 16.5v1.2" stroke="#3a2a08" strokeWidth="1.9" strokeLinecap="round" />
  </svg>
);

export const InfoIcon = ({ size = 17 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="#747474" stroke="none">
    <circle cx="12" cy="12" r="9" />
    <path d="M12 10.5v6M12 7.4v1.3" stroke="#fff" strokeWidth="1.9" strokeLinecap="round" />
  </svg>
);

export const ImagePlaceholder = ({ size = 34 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="4" width="18" height="16" rx="2" />
    <circle cx="8.5" cy="9.5" r="1.6" />
    <path d="m3.5 17.5 5-5 4.5 4.5 3-2.5 4.5 4" />
  </svg>
);
