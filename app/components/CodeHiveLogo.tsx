interface CodeHiveLogoProps {
  className?: string;
  size?: number;
}

export default function CodeHiveLogo({
  className = '',
  size = 32,
}: CodeHiveLogoProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      {/* Kite-shaped diamond points pointing to center */}
      <g fill="currentColor" fillOpacity="0.7">
        {/* Top diamond */}
        <path d="M16 2 L18 6 L16 10 L14 6 Z" />

        {/* Top-right diamond */}
        <path d="M26.928 8 L23.464 10 L20 8 L23.464 6 Z" />

        {/* Bottom diamond */}
        <path d="M16 30 L14 26 L16 22 L18 26 Z" />

        {/* Top-left diamond */}
        <path d="M5.072 8 L8.536 6 L12 8 L8.536 10 Z" />
      </g>

      {/* Central hexagon */}
      <path
        d="M16 12 L20 14 L20 18 L16 20 L12 18 L12 14 Z"
        fill="currentColor"
        fillOpacity="0.8"
        stroke="currentColor"
        strokeWidth="0.5"
        strokeOpacity="0.5"
      />
    </svg>
  );
}
