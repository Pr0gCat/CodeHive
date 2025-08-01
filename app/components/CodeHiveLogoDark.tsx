import Image from 'next/image';

interface CodeHiveLogoDarkProps {
  className?: string;
  size?: number;
  showText?: boolean;
}

// 這個版本專門用於深色背景，使用濾鏡和效果來增強可見性
export default function CodeHiveLogoDark({
  className = '',
  size = 32,
  showText = false,
}: CodeHiveLogoDarkProps) {
  return (
    <div className={`flex items-center ${className}`}>
      <div className="relative">
        {/* 發光效果背景 */}
        <div
          className="absolute inset-0 bg-amber-400/20 blur-xl rounded-full"
          style={{
            width: size * 1.2,
            height: size * 1.2,
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
          }}
        />

        {/* 標誌本體 - 使用濾鏡增強對比度 */}
        <div className="relative">
          <Image
            src="/icon.png"
            alt="CodeHive Logo"
            width={size}
            height={size}
            className="object-contain drop-shadow-[0_0_8px_rgba(251,191,36,0.5)]"
            style={{
              filter: 'brightness(1.1) contrast(1.2)',
            }}
            priority
          />
        </div>
      </div>

      {showText && (
        <span className="ml-3 text-xl font-bold text-accent-50">CodeHive</span>
      )}
    </div>
  );
}
