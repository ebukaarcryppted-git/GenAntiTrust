export function BrandMark({ className = "" }: { className?: string }) {
  return (
    <span
      className={`inline-flex items-center justify-center rounded-[11px] bg-brand text-paper ${className}`}
    >
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.9"
        strokeLinecap="round"
        className="h-[60%] w-[60%]"
        aria-hidden="true"
      >
        <path d="M12 4.5v15" />
        <path d="M6.5 19.5h11" />
        <path d="M4 9.5h16" />
        <circle cx="4.6" cy="9.5" r="2.6" />
        <circle cx="19.4" cy="9.5" r="2.6" />
      </svg>
    </span>
  );
}

export function BrandLockup() {
  return (
    <span className="flex items-center gap-2.5">
      <BrandMark className="h-8 w-8" />
      <span className="text-[17px] font-semibold tracking-[-0.02em] text-ink">
        GenAntiTrust
      </span>
    </span>
  );
}
