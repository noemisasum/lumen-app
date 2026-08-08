import Image from "next/image";

type BrandLogoProps = {
  className?: string;
};

export function BrandLogo({ className = "h-10 sm:h-11" }: BrandLogoProps) {
  return (
    <span className={`inline-flex max-w-full min-w-0 items-center ${className}`} aria-label="Lumen">
      <Image
        src="/brand/lumen-logo-light-lumen.svg"
        alt=""
        width={430}
        height={148}
        priority
        className="h-full w-auto max-w-full shrink-0"
      />
    </span>
  );
}
