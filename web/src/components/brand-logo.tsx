import Image from "next/image";

type BrandLogoProps = {
  className?: string;
};

export function BrandLogo({ className = "h-9 w-auto sm:h-10" }: BrandLogoProps) {
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
