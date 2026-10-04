export function BrandMark({ className = "size-7" }: { className?: string }) {
  return (
    <svg viewBox="0 0 64 64" className={className} aria-hidden>
      <rect width="64" height="64" rx="15" fill="#1E4D3B" />
      <path d="M32 12 L48 18 V31 C48 41 41 48.5 32 52 C23 48.5 16 41 16 31 V18 Z" fill="none" stroke="#F6F2EA" strokeWidth="4" strokeLinejoin="round" />
      <path d="M25 31.5 L30 36.5 L39.5 26" fill="none" stroke="#E9A27F" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
