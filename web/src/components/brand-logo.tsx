import Image from "next/image";

type BrandLogoProps = {
  className?: string;
};

export function BrandLogo({ className = "h-7 w-auto" }: BrandLogoProps) {
  return (
    <Image
      src="/lumen-app-logo.jpg"
      alt="Lumen App"
      width={912}
      height={135}
      priority
      className={className}
    />
  );
}
