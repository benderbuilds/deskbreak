import { brandAsset } from "@/lib/brand";

export function LogoMark({ size = 36 }: { size?: number }) {
  return (
    <img
      src={brandAsset("/icons/logo-mark.png")}
      width={size}
      height={size}
      alt=""
      draggable={false}
      className="shrink-0"
    />
  );
}
