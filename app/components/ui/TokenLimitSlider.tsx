'use client';

import Slider from './Slider';

interface TokenLimitSliderProps {
  value: number;
  onChange: (value: number) => void;
  disabled?: boolean;
  className?: string;
  min?: number;
  max?: number;
}

export default function TokenLimitSlider({
  value,
  onChange,
  disabled = false,
  className = '',
  min = 1000000,  // 1M tokens
  max = 50000000, // 50M tokens
}: TokenLimitSliderProps) {
  const formatTokens = (tokens: number): string => {
    if (tokens >= 1000000) {
      return `${(tokens / 1000000).toFixed(1)}M`;
    } else if (tokens >= 1000) {
      return `${(tokens / 1000).toFixed(0)}K`;
    }
    return tokens.toString();
  };

  const markers = [
    { value: 5000000, label: '5M' },
    { value: 10000000, label: '10M' },
    { value: 20000000, label: '20M' },
    { value: 30000000, label: '30M' },
  ];

  return (
    <div className={className}>
      <div className="mb-3">
        <div className="flex items-center justify-between mb-2">
          <label className="text-sm font-medium text-primary-300">
            每日 Token 限制
          </label>
          <div className="text-xs text-primary-400">
            {formatTokens(min)} - {formatTokens(max)}
          </div>
        </div>
        <p className="text-xs text-primary-500 mb-4">
          設定每日可用 Token 上限。建議 10M-20M Tokens。
        </p>
      </div>

      <Slider
        min={min}
        max={max}
        value={value}
        onChange={onChange}
        step={1000000} // 1M step
        disabled={disabled}
        color="accent"
        size="lg"
        formatLabel={formatTokens}
        showValue={true}
        markers={markers}
        aria-label="每日代幣限制設定"
        aria-describedby="token-limit-help"
      />

      <div id="token-limit-help" className="mt-3 p-3 bg-primary-800 rounded-md border border-primary-700">
        <h4 className="text-sm font-medium text-primary-300 mb-2">建議值參考：</h4>
        <ul className="text-xs text-primary-400 space-y-1">
          <li>• <strong>5M Tokens</strong>：小型專案，輕度使用</li>
          <li>• <strong>10M Tokens</strong>：中型專案，適合大多數情況</li>
          <li>• <strong>20M Tokens</strong>：大型專案，頻繁開發</li>
          <li>• <strong>30M+ Tokens</strong>：企業級專案，密集開發</li>
        </ul>
      </div>
    </div>
  );
}