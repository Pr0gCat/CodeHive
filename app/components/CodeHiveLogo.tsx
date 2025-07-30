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
      width={size * 0.5}
      height={size}
      viewBox="0 0 26 16"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      {/* Main Hexagon (Hive Cell) - Optimized for tight bounds */}
      <polygon
        points="13,2 19,5 19,11 13,14 7,11 7,5"
        fill="currentColor"
        fillOpacity="0.15"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeOpacity="0.8"
      />
      
      {/* Inner Hexagon Cells */}
      <polygon
        points="13,5 16,6.5 16,9.5 13,11 10,9.5 10,6.5"
        fill="currentColor"
        fillOpacity="0.25"
        stroke="currentColor"
        strokeWidth="1"
        strokeOpacity="0.6"
      />
      
      {/* Smaller inner cell */}
      <polygon
        points="13,7 14.5,7.75 14.5,8.25 13,9 11.5,8.25 11.5,7.75"
        fill="currentColor"
        fillOpacity="0.4"
        stroke="currentColor"
        strokeWidth="0.8"
        strokeOpacity="0.7"
      />

      {/* Bee representation (small circle with motion trail) */}
      <g opacity="0.8">
        {/* Bee body */}
        <circle
          cx="15.5"
          cy="6"
          r="1.2"
          fill="#fbbf24"
          stroke="#f59e0b"
          strokeWidth="0.3"
        />
        
        {/* Bee stripes */}
        <line
          x1="14.7"
          y1="6"
          x2="16.3"  
          y2="6"
          stroke="#d97706"
          strokeWidth="0.4"
          opacity="0.7"
        />
        
        {/* Bee wings (tiny) */}
        <ellipse
          cx="15.5"
          cy="5.2"
          rx="0.6"
          ry="0.3"
          fill="#ffffff"
          opacity="0.6"
        />
      </g>

      {/* Motion trail dots */}
      <g opacity="0.4">
        <circle cx="18" cy="4.5" r="0.4" fill="#fbbf24" />
        <circle cx="20" cy="3.5" r="0.3" fill="#fbbf24" />
        <circle cx="22" cy="2.5" r="0.2" fill="#fbbf24" />
      </g>
    </svg>
  );
}
