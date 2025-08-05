interface CodeHiveLogoSVGProps {
  className?: string;
  size?: number;
  showText?: boolean;
}

export default function CodeHiveLogoSVG({
  className = '',
  size = 32,
  showText = false,
}: CodeHiveLogoSVGProps) {
  return (
    <div className={`flex items-center ${className}`}>
      <svg
        width={size}
        height={size}
        viewBox="0 0 200 200"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        {/* 光暈背景 */}
        <defs>
          <radialGradient id="glow">
            <stop offset="0%" stopColor="#fbbf24" stopOpacity="0.3" />
            <stop offset="100%" stopColor="#fbbf24" stopOpacity="0" />
          </radialGradient>
          <filter id="soften">
            <feGaussianBlur in="SourceGraphic" stdDeviation="2" />
          </filter>
        </defs>

        {/* 光暈效果 */}
        <circle
          cx="100"
          cy="100"
          r="90"
          fill="url(#glow)"
          filter="url(#soften)"
        />

        {/* 蜜蜂觸角 - 添加白色輪廓 */}
        <g stroke="#ffffff" strokeWidth="2" strokeOpacity="0.5" fill="#2d2d2d">
          <path d="M80 50 Q70 30 60 20" strokeLinecap="round" />
          <path d="M120 50 Q130 30 140 20" strokeLinecap="round" />
          <circle cx="60" cy="20" r="8" />
          <circle cx="140" cy="20" r="8" />
        </g>

        {/* 蜜蜂頭部 - 添加白色輪廓 */}
        <circle
          cx="100"
          cy="60"
          r="30"
          fill="#2d2d2d"
          stroke="#ffffff"
          strokeWidth="2"
          strokeOpacity="0.3"
        />

        {/* 蜜蜂身體中心 - 黃色 */}
        <ellipse cx="100" cy="90" rx="35" ry="25" fill="#f59e0b" />

        {/* 蜜蜂翅膀 */}
        <g opacity="0.9">
          {/* 左翅 */}
          <ellipse
            cx="50"
            cy="85"
            rx="40"
            ry="20"
            fill="#fbbf24"
            stroke="#2d2d2d"
            strokeWidth="3"
            transform="rotate(-20 50 85)"
          />
          {/* 右翅 */}
          <ellipse
            cx="150"
            cy="85"
            rx="40"
            ry="20"
            fill="#fbbf24"
            stroke="#2d2d2d"
            strokeWidth="3"
            transform="rotate(20 150 85)"
          />
        </g>

        {/* 蜜蜂身體下部 - 六邊形蜂巢形狀 */}
        <path
          d="M 100 110 L 130 125 L 130 155 L 100 170 L 70 155 L 70 125 Z"
          fill="#f59e0b"
          stroke="#2d2d2d"
          strokeWidth="3"
        />

        {/* 條紋 */}
        <g fill="#2d2d2d" opacity="0.8">
          <rect x="65" y="120" width="70" height="8" rx="4" />
          <rect x="65" y="140" width="70" height="8" rx="4" />
        </g>

        {/* 代碼符號 < /> */}
        <g fill="#2d2d2d" stroke="#ffffff" strokeWidth="1" strokeOpacity="0.3">
          <path
            d="M 85 175 L 75 185 L 85 195"
            strokeLinecap="round"
            strokeLinejoin="round"
            fill="none"
            strokeWidth="4"
          />
          <path
            d="M 115 175 L 125 185 L 115 195"
            strokeLinecap="round"
            strokeLinejoin="round"
            fill="none"
            strokeWidth="4"
          />
          <path
            d="M 105 170 L 95 200"
            strokeLinecap="round"
            fill="none"
            strokeWidth="3"
          />
        </g>
      </svg>

      {showText && (
        <span className="ml-3 text-xl font-bold text-accent-50 drop-shadow-[0_2px_4px_rgba(0,0,0,0.5)]">
          CodeHive
        </span>
      )}
    </div>
  );
}
