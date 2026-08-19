type Props = {
  className?: string;
  strokeWidth?: number;
};

export function StickmanMark({ className, strokeWidth = 4 }: Props) {
  return (
    <svg
      viewBox="0 0 200 200"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      className={className}
      aria-hidden="true"
    >
      <circle cx="100" cy="40" r="25" />
      <line x1="100" y1="65" x2="100" y2="130" />
      <line x1="100" y1="90" x2="60" y2="110" />
      <line x1="100" y1="90" x2="140" y2="110" />
      <line x1="100" y1="130" x2="70" y2="180" />
      <line x1="100" y1="130" x2="130" y2="180" />
    </svg>
  );
}
