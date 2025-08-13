'use client';

import { useMemo } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/app/components/ui/card';
import { Badge } from '@/app/components/ui/badge';
import { Button } from '@/app/components/ui/button';
import { Tooltip } from 'recharts';
import { Calendar, TrendingUp, Activity } from 'lucide-react';

interface HeatmapDataPoint {
  date: string;
  hour?: number;
  day?: number;
  value: number;
  category?: string;
  label?: string;
}

interface HeatmapChartProps {
  data: HeatmapDataPoint[];
  title: string;
  type?: 'daily' | 'weekly' | 'monthly';
  colorScale?: [string, string];
  showValues?: boolean;
  height?: number;
  onCellClick?: (dataPoint: HeatmapDataPoint) => void;
}

const defaultColorScale: [string, string] = ['#f0f9ff', '#1e40af'];

const dayLabels = ['日', '一', '二', '三', '四', '五', '六'];
const monthLabels = [
  '1月', '2月', '3月', '4月', '5月', '6月',
  '7月', '8月', '9月', '10月', '11月', '12月'
];

const hourLabels = Array.from({ length: 24 }, (_, i) => `${i.toString().padStart(2, '0')}:00`);

export default function HeatmapChart({
  data,
  title,
  type = 'daily',
  colorScale = defaultColorScale,
  showValues = false,
  height = 200,
  onCellClick
}: HeatmapChartProps) {
  // 處理和格式化數據
  const { processedData, maxValue, minValue, stats } = useMemo(() => {
    if (!data.length) return { processedData: [], maxValue: 0, minValue: 0, stats: null };

    const values = data.map(d => d.value);
    const maxVal = Math.max(...values);
    const minVal = Math.min(...values);
    const avg = values.reduce((sum, val) => sum + val, 0) / values.length;

    let processed: any[] = [];

    switch (type) {
      case 'daily':
        // 按日期和小時組織數據
        const dailyMap = new Map();
        data.forEach(item => {
          const date = new Date(item.date);
          const dateStr = date.toISOString().split('T')[0];
          const hour = item.hour ?? date.getHours();
          const key = `${dateStr}-${hour}`;
          
          if (!dailyMap.has(key)) {
            dailyMap.set(key, {
              date: dateStr,
              hour,
              value: 0,
              count: 0,
              original: []
            });
          }
          
          const existing = dailyMap.get(key);
          existing.value += item.value;
          existing.count += 1;
          existing.original.push(item);
        });

        processed = Array.from(dailyMap.values()).map(item => ({
          ...item,
          value: item.value / item.count // 平均值
        }));
        break;

      case 'weekly':
        // 按週和日組織數據
        const weeklyMap = new Map();
        data.forEach(item => {
          const date = new Date(item.date);
          const weekStart = new Date(date);
          weekStart.setDate(date.getDate() - date.getDay());
          const weekStr = weekStart.toISOString().split('T')[0];
          const day = date.getDay();
          const key = `${weekStr}-${day}`;
          
          if (!weeklyMap.has(key)) {
            weeklyMap.set(key, {
              week: weekStr,
              day,
              value: 0,
              count: 0,
              original: []
            });
          }
          
          const existing = weeklyMap.get(key);
          existing.value += item.value;
          existing.count += 1;
          existing.original.push(item);
        });

        processed = Array.from(weeklyMap.values()).map(item => ({
          ...item,
          value: item.value / item.count
        }));
        break;

      case 'monthly':
        // 按年月組織數據
        const monthlyMap = new Map();
        data.forEach(item => {
          const date = new Date(item.date);
          const year = date.getFullYear();
          const month = date.getMonth();
          const key = `${year}-${month}`;
          
          if (!monthlyMap.has(key)) {
            monthlyMap.set(key, {
              year,
              month,
              value: 0,
              count: 0,
              original: []
            });
          }
          
          const existing = monthlyMap.get(key);
          existing.value += item.value;
          existing.count += 1;
          existing.original.push(item);
        });

        processed = Array.from(monthlyMap.values()).map(item => ({
          ...item,
          value: item.value / item.count
        }));
        break;
    }

    const statsData = {
      total: values.reduce((sum, val) => sum + val, 0),
      average: avg,
      max: maxVal,
      min: minVal,
      count: data.length
    };

    return { processedData: processed, maxValue: maxVal, minValue: minVal, stats: statsData };
  }, [data, type]);

  // 獲取顏色強度
  const getColorIntensity = (value: number) => {
    if (maxValue === minValue) return 0.5;
    return (value - minValue) / (maxValue - minValue);
  };

  // 獲取單元格顏色
  const getCellColor = (value: number) => {
    const intensity = getColorIntensity(value);
    
    // 從淺色到深色的漸變
    const [lightColor, darkColor] = colorScale;
    
    // 簡單的線性插值
    const r1 = parseInt(lightColor.slice(1, 3), 16);
    const g1 = parseInt(lightColor.slice(3, 5), 16);
    const b1 = parseInt(lightColor.slice(5, 7), 16);
    
    const r2 = parseInt(darkColor.slice(1, 3), 16);
    const g2 = parseInt(darkColor.slice(3, 5), 16);
    const b2 = parseInt(darkColor.slice(5, 7), 16);
    
    const r = Math.round(r1 + (r2 - r1) * intensity);
    const g = Math.round(g1 + (g2 - g1) * intensity);
    const b = Math.round(b1 + (b2 - b1) * intensity);
    
    return `rgb(${r}, ${g}, ${b})`;
  };

  // 渲染日視圖（小時 x 日期）
  const renderDailyView = () => {
    const dates = [...new Set(processedData.map(d => d.date))].sort();
    const cellWidth = Math.max(20, Math.min(40, (800 - 100) / dates.length));
    const cellHeight = 16;

    return (
      <div className="overflow-x-auto">
        <div style={{ width: dates.length * cellWidth + 100, height: 24 * cellHeight + 60 }}>
          {/* 時間軸標籤 */}
          <div className="flex">
            <div className="w-12"></div>
            {dates.map(date => (
              <div
                key={date}
                className="text-xs text-gray-600 text-center"
                style={{ width: cellWidth }}
              >
                {new Date(date).getDate()}
              </div>
            ))}
          </div>

          {/* 熱力圖網格 */}
          <div className="relative">
            {hourLabels.map((hourLabel, hourIndex) => (
              <div key={hourIndex} className="flex items-center">
                <div className="w-12 text-xs text-gray-600 text-right pr-2">
                  {hourIndex % 4 === 0 ? hourLabel : ''}
                </div>
                {dates.map(date => {
                  const dataPoint = processedData.find(d => d.date === date && d.hour === hourIndex);
                  const value = dataPoint?.value || 0;
                  
                  return (
                    <div
                      key={`${date}-${hourIndex}`}
                      className="border border-gray-100 cursor-pointer hover:border-gray-400 transition-colors group relative"
                      style={{
                        width: cellWidth,
                        height: cellHeight,
                        backgroundColor: value > 0 ? getCellColor(value) : '#f9fafb'
                      }}
                      onClick={() => dataPoint && onCellClick?.(dataPoint)}
                    >
                      {showValues && value > 0 && (
                        <span className="text-xs text-center block leading-4">
                          {value.toFixed(0)}
                        </span>
                      )}
                      
                      {/* Tooltip */}
                      <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-2 py-1 bg-black text-white text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-10">
                        {date} {hourLabel}: {value.toFixed(2)}
                      </div>
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  };

  // 渲染週視圖（日 x 週）
  const renderWeeklyView = () => {
    const weeks = [...new Set(processedData.map(d => d.week))].sort();
    const cellSize = 20;

    return (
      <div className="overflow-x-auto">
        <div style={{ width: weeks.length * cellSize + 60, height: 7 * cellSize + 40 }}>
          {/* 週標籤 */}
          <div className="flex">
            <div className="w-8"></div>
            {weeks.map((week, index) => (
              <div
                key={week}
                className="text-xs text-gray-600 text-center"
                style={{ width: cellSize }}
              >
                {index % 4 === 0 ? new Date(week).getMonth() + 1 : ''}
              </div>
            ))}
          </div>

          {/* 日標籤和網格 */}
          {dayLabels.map((dayLabel, dayIndex) => (
            <div key={dayIndex} className="flex items-center">
              <div className="w-8 text-xs text-gray-600 text-right pr-1">
                {dayLabel}
              </div>
              {weeks.map(week => {
                const dataPoint = processedData.find(d => d.week === week && d.day === dayIndex);
                const value = dataPoint?.value || 0;
                
                return (
                  <div
                    key={`${week}-${dayIndex}`}
                    className="border border-gray-100 cursor-pointer hover:border-gray-400 transition-colors group relative"
                    style={{
                      width: cellSize,
                      height: cellSize,
                      backgroundColor: value > 0 ? getCellColor(value) : '#f9fafb'
                    }}
                    onClick={() => dataPoint && onCellClick?.(dataPoint)}
                  >
                    {/* Tooltip */}
                    <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-2 py-1 bg-black text-white text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-10">
                      {week} {dayLabel}: {value.toFixed(2)}
                    </div>
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </div>
    );
  };

  // 渲染月視圖
  const renderMonthlyView = () => {
    const years = [...new Set(processedData.map(d => d.year))].sort();
    const cellSize = 30;

    return (
      <div className="overflow-x-auto">
        {years.map(year => (
          <div key={year} className="mb-6">
            <h4 className="text-sm font-medium text-gray-700 mb-2">{year} 年</h4>
            <div className="grid grid-cols-12 gap-1">
              {monthLabels.map((monthLabel, monthIndex) => {
                const dataPoint = processedData.find(d => d.year === year && d.month === monthIndex);
                const value = dataPoint?.value || 0;
                
                return (
                  <div
                    key={`${year}-${monthIndex}`}
                    className="border border-gray-200 rounded p-2 cursor-pointer hover:border-gray-400 transition-colors group relative"
                    style={{
                      backgroundColor: value > 0 ? getCellColor(value) : '#f9fafb',
                      minHeight: '60px'
                    }}
                    onClick={() => dataPoint && onCellClick?.(dataPoint)}
                  >
                    <div className="text-xs text-gray-600">{monthLabel}</div>
                    <div className="text-sm font-medium">
                      {value > 0 ? value.toFixed(0) : ''}
                    </div>
                    
                    {/* Tooltip */}
                    <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-2 py-1 bg-black text-white text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-10">
                      {year} 年 {monthLabel}: {value.toFixed(2)}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    );
  };

  // 渲染圖例
  const renderLegend = () => {
    const steps = 5;
    const stepSize = (maxValue - minValue) / (steps - 1);
    
    return (
      <div className="flex items-center justify-center gap-2 mt-4">
        <span className="text-xs text-gray-600">少</span>
        {Array.from({ length: steps }, (_, i) => {
          const value = minValue + stepSize * i;
          return (
            <div
              key={i}
              className="w-3 h-3 border border-gray-200"
              style={{ backgroundColor: getCellColor(value) }}
              title={value.toFixed(2)}
            />
          );
        })}
        <span className="text-xs text-gray-600">多</span>
      </div>
    );
  };

  return (
    <Card className="w-full">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            {title}
          </CardTitle>
          
          {stats && (
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="flex items-center gap-1">
                <Activity className="h-3 w-3" />
                總計: {stats.total.toLocaleString()}
              </Badge>
              <Badge variant="outline">
                平均: {stats.average.toFixed(2)}
              </Badge>
            </div>
          )}
        </div>

        {/* 統計摘要 */}
        {stats && (
          <div className="grid grid-cols-4 gap-4 mt-2">
            <div className="text-center">
              <div className="text-lg font-bold text-blue-600">{stats.total.toLocaleString()}</div>
              <div className="text-xs text-gray-600">總計</div>
            </div>
            <div className="text-center">
              <div className="text-lg font-bold text-green-600">{stats.average.toFixed(2)}</div>
              <div className="text-xs text-gray-600">平均</div>
            </div>
            <div className="text-center">
              <div className="text-lg font-bold text-purple-600">{stats.max.toLocaleString()}</div>
              <div className="text-xs text-gray-600">最高</div>
            </div>
            <div className="text-center">
              <div className="text-lg font-bold text-orange-600">{stats.count.toLocaleString()}</div>
              <div className="text-xs text-gray-600">項目數</div>
            </div>
          </div>
        )}
      </CardHeader>
      <CardContent>
        {!processedData.length ? (
          <div className="flex items-center justify-center h-32 text-gray-500">
            <div className="text-center">
              <Calendar className="h-12 w-12 mx-auto mb-2 opacity-50" />
              <p>暫無數據</p>
            </div>
          </div>
        ) : (
          <>
            {type === 'daily' && renderDailyView()}
            {type === 'weekly' && renderWeeklyView()}
            {type === 'monthly' && renderMonthlyView()}
            {renderLegend()}
          </>
        )}
      </CardContent>
    </Card>
  );
}