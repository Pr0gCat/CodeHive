import Image from 'next/image';
import CodeHiveLogoSVG from './CodeHiveLogoSVG';

interface CodeHiveLogoProps {
  className?: string;
  size?: number;
  showText?: boolean;
  withBackground?: boolean;
  useSVG?: boolean;
}

export default function CodeHiveLogo({
  className = '',
  size = 32,
  showText = false,
  withBackground = false,
  useSVG = false,
}: CodeHiveLogoProps) {
  // 如果使用 SVG 版本
  if (useSVG) {
    return (
      <CodeHiveLogoSVG className={className} size={size} showText={showText} />
    );
  }

  // 使用 PNG 版本 - 簡化的輪廓效果
  return (
    <div className={`flex items-center ${className}`}>
      <div className="relative">
        <Image
          src="/icon.png"
          alt="CodeHive Logo"
          width={size}
          height={size}
          className="relative object-contain"
          style={{
            filter: `
              drop-shadow(0 0 1px rgba(255, 255, 255, 0.8))
              drop-shadow(0 0 2px rgba(255, 255, 255, 0.6))
              drop-shadow(0 0 3px rgba(255, 255, 255, 0.4))
              brightness(1.1)
            `,
          }}
          priority
        />
      </div>
      {showText && (
        <span className="ml-3 text-xl font-bold text-accent-50 drop-shadow-[0_2px_4px_rgba(0,0,0,0.5)]">
          CodeHive
        </span>
      )}
    </div>
  );
}
