/**
 * A level balance beam resting on a fulcrum — equilibrium, judged.
 * Authored as fills on a 64-unit grid so it stays legible from the 16px
 * favicon up to the nav lockup; app/icon.svg draws the identical shapes.
 */
export function BrandMark({ className = "" }: { className?: string }) {
  return (
    <span
      className={`inline-flex items-center justify-center rounded-[11px] bg-darkmilk text-milk ${className}`}
    >
      <svg
        viewBox="0 0 64 64"
        fill="currentColor"
        className="h-[62%] w-[62%]"
        aria-hidden="true"
      >
        <rect x="8" y="19" width="48" height="6" rx="3" />
        <path d="M32 27 L42.5 45 H21.5 Z" />
        <rect x="19" y="45" width="26" height="6" rx="3" />
      </svg>
    </span>
  );
}

export function BrandLockup() {
  return (
    <span className="flex items-center gap-2.5">
      <BrandMark className="h-8 w-8" />
      <span className="hidden text-[17px] font-semibold tracking-[-0.02em] text-ink sm:inline">
        GenAntiTrust
      </span>
    </span>
  );
}
