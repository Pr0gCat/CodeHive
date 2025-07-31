'use client';

import Slider from './Slider';

interface TokenLimitSliderProps {
  value: number;
  onChange: (value: number) => void;
  onChangeEnd?: (value: number) => void;
  disabled?: boolean;
  className?: string;
  min?: number;
  max?: number;
}

export default function TokenLimitSlider({
  value,
  onChange,
  onChangeEnd,
  disabled = false,
  className = '',
  min = 1000000, // 1M tokens
  max = 500000000, // 500M tokens
}: TokenLimitSliderProps) {
  const formatTokens = (tokens: number): string => {
    if (tokens >= 1000000000) {
      return `${(tokens / 1000000000).toFixed(1)}B`;
    } else if (tokens >= 1000000) {
      return `${(tokens / 1000000).toFixed(1)}M`;
    } else if (tokens >= 1000) {
      return `${(tokens / 1000).toFixed(0)}K`;
    }
    return tokens.toString();
  };

  const markers = [
    { value: 10000000, label: '10M' },
    { value: 50000000, label: '50M' },
    { value: 100000000, label: '100M' },
    { value: 250000000, label: '250M' },
    { value: 500000000, label: '500M' },
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
          設定每日可用 Token 上限。建議 10M-100M Tokens，最高可達 500M。
        </p>
      </div>

      <Slider
        min={min}
        max={max}
        value={value}
        onChange={onChange}
        onChangeEnd={onChangeEnd}
        step={5000000} // 5M step for better UX with larger range
        disabled={disabled}
        color="accent"
        size="lg"
        formatLabel={formatTokens}
        showValue={true}
        markers={markers}
        aria-label="每日代幣限制設定"
        aria-describedby="token-limit-help"
      />

      <div
        id="token-limit-help"
        className="mt-3 p-3 bg-primary-800 rounded-md border border-primary-700"
      >
        <h4 className="text-sm font-medium text-primary-300 mb-2">
          建議值參考：
        </h4>
        <ul className="text-xs text-primary-400 space-y-1">
          <li>
            • <strong>10M Tokens</strong>：小型專案，個人開發
          </li>
          <li>
            • <strong>50M Tokens</strong>：中型專案，團隊協作
          </li>
          <li>
            • <strong>100M Tokens</strong>：大型專案，密集開發
          </li>
          <li>
            • <strong>250M+ Tokens</strong>：企業級專案，AI 工廠
          </li>
        </ul>
      </div>
    </div>
  );
}
