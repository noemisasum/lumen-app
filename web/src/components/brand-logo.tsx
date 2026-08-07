import Image from "next/image";

type BrandLogoProps = {
  className?: string;
};

export function BrandLogo({ className = "h-7 w-auto" }: BrandLogoProps) {
  return (
    <Image
      src="/brand/lumen-logo-lockup-light.svg"
      alt="Lumen AI"
      width={560}
      height={148}
      priority
      className={className}
    />
  );
}
