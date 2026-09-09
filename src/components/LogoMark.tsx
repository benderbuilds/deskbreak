export function LogoMark({ size = 36 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      aria-hidden="true"
      className="shrink-0"
    >
      <rect width="32" height="32" rx="10" fill="#FF5A36" />
      <path
        d="M10 21c2.2-6.2 5-9.5 12-11"
        fill="none"
        stroke="#F7F4EF"
        strokeWidth="2.4"
        strokeLinecap="round"
      />
      <path
        d="M9.5 16.5c3.5-1.2 7.2-1 11.5.6"
        fill="none"
        stroke="#F7F4EF"
        strokeWidth="2.4"
        strokeLinecap="round"
      />
      <circle cx="21.5" cy="10.2" r="1.6" fill="#F7F4EF" />
    </svg>
  );
}
