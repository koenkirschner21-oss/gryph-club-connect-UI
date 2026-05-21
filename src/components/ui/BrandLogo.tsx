type BrandLogoProps = {
  /** nav: header lockup; hero: modest size above nav for page heroes */
  variant?: "nav" | "hero";
  className?: string;
};

export default function BrandLogo({
  variant = "nav",
  className = "",
}: BrandLogoProps) {
  const isNav = variant === "nav";
  const iconHeight = isNav
    ? "h-9 w-auto sm:h-10"
    : "h-8 w-auto sm:h-9 md:h-10";

  return (
    <span
      className={`inline-flex items-center ${isNav ? "gap-2.5 sm:gap-3" : "gap-2 sm:gap-2.5"} ${className}`}
    >
      <img
        src="/assets/gryph-icon.png"
        alt=""
        className={`shrink-0 object-contain ${iconHeight}`}
        aria-hidden
      />
      <span
        className={
          isNav
            ? "text-lg font-bold italic leading-none tracking-tight sm:text-xl md:text-[1.4rem]"
            : "text-sm font-bold italic leading-none tracking-tight sm:text-base md:text-lg"
        }
      >
        <span style={{ color: "#E51937" }}>Club</span>
        <span style={{ color: "#FFC429" }}>Connect</span>
      </span>
    </span>
  );
}
