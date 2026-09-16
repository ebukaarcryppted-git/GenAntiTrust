/**
 * The brand mark — a level balance beam resting on a fulcrum, equilibrium
 * judged. Ships as a raster asset (public/brand-mark.png); app/icon.png,
 * app/favicon.ico and app/apple-icon.png are generated from the same source.
 */
export function BrandMark({ className = "" }: { className?: string }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src="/brand-mark.png"
      alt=""
      aria-hidden="true"
      className={`inline-block object-contain ${className}`}
    />
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
