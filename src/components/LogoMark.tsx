export function LogoMark({ size = 36 }: { size?: number }) {
  return (
    <img
      src="/icons/logo-mark.svg"
      width={size}
      height={size}
      alt=""
      draggable={false}
      className="shrink-0"
    />
  );
}
