import Image from "next/image";

type BrandLogoProps = {
  className?: string;
};

export function BrandLogo({ className = "h-10 sm:h-11" }: BrandLogoProps) {
  return (
    <span className={`inline-flex min-w-0 items-center gap-2.5 ${className}`} aria-label="Lumen">
      <Image
        src="/brand/lumen-mark.svg"
        alt=""
        width={144}
        height={128}
        priority
        className="h-full w-auto shrink-0"
      />
      <span className="min-w-0 text-[1.35rem] font-semibold leading-none tracking-normal text-zinc-950 sm:text-[1.6rem]">
        Lumen
      </span>
    </span>
  );
}
