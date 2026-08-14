import Image from "next/image";

type BrandLogoProps = {
  className?: string;
};

export function BrandLogo({ className = "h-10 sm:h-11" }: BrandLogoProps) {
  return (
    <span className={`inline-flex max-w-full min-w-0 items-center ${className}`} aria-label="Lumen AI">
      <Image
        src="/brand/lumen-logo-light.png"
        alt=""
        width={1200}
        height={374}
        priority
        className="h-full w-auto max-w-full shrink-0"
      />
    </span>
  );
}
