interface CodeHiveLogoProps {
  className?: string;
  size?: number;
}

export default function CodeHiveLogo({
  className = '',
  size = 128,
}: CodeHiveLogoProps) {
  return (
    <svg
      width={size * 0.35}
      height={size}
      viewBox="0 0 12 12"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      {/* Geometric H shape made of hexagonal segments */}
      <g fill="#fbbf24">
        {/* Left vertical line as connected hexagons */}
        <polygon points="2,2 3,1.5 4,2 4,4 3,4.5 2,4" />
        <polygon points="2,4 3,3.5 4,4 4,6 3,6.5 2,6" />
        
        {/* Right vertical line as connected hexagons */}
        <polygon points="8,2 9,1.5 10,2 10,4 9,4.5 8,4" />
        <polygon points="8,4 9,3.5 10,4 10,6 9,6.5 8,6" />
        
        {/* Horizontal connecting line */}
        <polygon points="4,4 5,3.5 7,3.5 8,4 7,4.5 5,4.5" />
      </g>
      
      {/* Small animated dots representing AI agents */}
      <circle cx="6" cy="2" r="0.5" fill="currentColor" opacity="0.7" />
      <circle cx="6" cy="10" r="0.5" fill="currentColor" opacity="0.7" />
    </svg>
  );
}
