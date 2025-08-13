'use client';

import { useState, useEffect, useMemo } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/app/components/ui/card';
import { Badge } from '@/app/components/ui/badge';
import { Button } from '@/app/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/app/components/ui/select';
import { 
  LineChart, 
  Line, 
  AreaChart, 
  Area, 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  Legend, 
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell
} from 'recharts';
import { 
  TrendingUp, 
  TrendingDown, 
  BarChart3, 
  PieChart as PieChartIcon, 
  Activity,
  Calendar,
  Download
} from 'lucide-react';

interface ChartDataPoint {
  timestamp: string;
  value: number;
  category?: string;
  label?: string;
  [key: string]: any;
}

interface MetricsChartProps {
  data: ChartDataPoint[];
  title: string;
  type?: 'line' | 'area' | 'bar' | 'pie';
  height?: number;
  colors?: string[];
  showTrend?: boolean;
  showExport?: boolean;
  timeRange?: '1h' | '6h' | '24h' | '7d' | '30d';
  onTimeRangeChange?: (range: string) => void;
  metrics?: string[];
  onMetricChange?: (metrics: string[]) => void;
  loading?: boolean;
}

const defaultColors = [
  '#3B82F6', // blue-500
  '#10B981', // emerald-500
  '#F59E0B', // amber-500
  '#EF4444', // red-500
  '#8B5CF6', // violet-500
  '#06B6D4', // cyan-500
  '#84CC16', // lime-500
  '#F97316'  // orange-500
];

const timeRangeLabels = {
  '1h': '過去 1 小時',
  '6h': '過去 6 小時',
  '24h': '過去 24 小時',
  '7d': '過去 7 天',
  '30d': '過去 30 天'
};

export default function MetricsChart({
  data,
  title,
  type = 'line',
  height = 300,
  colors = defaultColors,
  showTrend = true,
  showExport = false,
  timeRange = '24h',
  onTimeRangeChange,
  metrics = [],
  onMetricChange,
  loading = false
}: MetricsChartProps) {
  const [selectedMetrics, setSelectedMetrics] = useState<string[]>(metrics);
  const [chartType, setChartType] = useState<'line' | 'area' | 'bar' | 'pie'>(type);

  // 計算趨勢
  const trend = useMemo(() => {
    if (!showTrend || data.length < 2) return null;

    const firstValue = data[0]?.value || 0;
    const lastValue = data[data.length - 1]?.value || 0;
    const change = lastValue - firstValue;
    const changePercent = firstValue !== 0 ? (change / firstValue) * 100 : 0;

    return {
      direction: change > 0 ? 'up' : change < 0 ? 'down' : 'stable',
      value: Math.abs(change),
      percent: Math.abs(changePercent)
    };
  }, [data, showTrend]);

  // 處理數據格式化
  const formattedData = useMemo(() => {
    if (chartType === 'pie') {
      // 為餅圖聚合數據
      const aggregated = data.reduce((acc, item) => {
        const key = item.category || item.label || '其他';
        acc[key] = (acc[key] || 0) + item.value;
        return acc;
      }, {} as Record<string, number>);

      return Object.entries(aggregated).map(([name, value]) => ({
        name,
        value,
        percent: ((value / Object.values(aggregated).reduce((sum, v) => sum + v, 0)) * 100).toFixed(1)
      }));
    }

    return data.map(item => ({
      ...item,
      time: new Date(item.timestamp).toLocaleTimeString('zh-TW', {
        hour: '2-digit',
        minute: '2-digit'
      }),
      date: new Date(item.timestamp).toLocaleDateString('zh-TW')
    }));
  }, [data, chartType]);

  // 導出數據
  const exportData = () => {
    const csvContent = [
      ['時間', '數值', '類別'].join(','),
      ...data.map(item => [
        item.timestamp,
        item.value,
        item.category || ''
      ].join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${title}-metrics-${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // 自定義 Tooltip
  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-white p-3 border rounded-lg shadow-lg">
          <p className="font-medium">{`時間: ${label}`}</p>
          {payload.map((entry: any, index: number) => (
            <p key={index} style={{ color: entry.color }}>
              {`${entry.name || '數值'}: ${entry.value.toLocaleString()}`}
            </p>
          ))}
        </div>
      );
    }
    return null;
  };

  // 渲染圖表
  const renderChart = () => {
    if (loading) {
      return (
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
        </div>
      );
    }

    if (!formattedData.length) {
      return (
        <div className="flex items-center justify-center h-64 text-gray-500">
          <div className="text-center">
            <BarChart3 className="h-12 w-12 mx-auto mb-2 opacity-50" />
            <p>暫無數據</p>
          </div>
        </div>
      );
    }

    const chartProps = {
      data: formattedData,
      margin: { top: 5, right: 30, left: 20, bottom: 5 }
    };

    switch (chartType) {
      case 'line':
        return (
          <ResponsiveContainer width="100%" height={height}>
            <LineChart {...chartProps}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis 
                dataKey="time" 
                stroke="#666"
                fontSize={12}
                tickLine={false}
                axisLine={false}
              />
              <YAxis 
                stroke="#666"
                fontSize={12}
                tickLine={false}
                axisLine={false}
                tickFormatter={(value) => value.toLocaleString()}
              />
              <Tooltip content={<CustomTooltip />} />
              <Legend />
              <Line
                type="monotone"
                dataKey="value"
                stroke={colors[0]}
                strokeWidth={2}
                dot={{ fill: colors[0], strokeWidth: 2, r: 4 }}
                activeDot={{ r: 6, fill: colors[0] }}
              />
            </LineChart>
          </ResponsiveContainer>
        );

      case 'area':
        return (
          <ResponsiveContainer width="100%" height={height}>
            <AreaChart {...chartProps}>
              <defs>
                <linearGradient id="colorValue" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={colors[0]} stopOpacity={0.8}/>
                  <stop offset="95%" stopColor={colors[0]} stopOpacity={0.1}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis 
                dataKey="time" 
                stroke="#666"
                fontSize={12}
                tickLine={false}
                axisLine={false}
              />
              <YAxis 
                stroke="#666"
                fontSize={12}
                tickLine={false}
                axisLine={false}
                tickFormatter={(value) => value.toLocaleString()}
              />
              <Tooltip content={<CustomTooltip />} />
              <Area
                type="monotone"
                dataKey="value"
                stroke={colors[0]}
                fillOpacity={1}
                fill="url(#colorValue)"
              />
            </AreaChart>
          </ResponsiveContainer>
        );

      case 'bar':
        return (
          <ResponsiveContainer width="100%" height={height}>
            <BarChart {...chartProps}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis 
                dataKey="time" 
                stroke="#666"
                fontSize={12}
                tickLine={false}
                axisLine={false}
              />
              <YAxis 
                stroke="#666"
                fontSize={12}
                tickLine={false}
                axisLine={false}
                tickFormatter={(value) => value.toLocaleString()}
              />
              <Tooltip content={<CustomTooltip />} />
              <Bar 
                dataKey="value" 
                fill={colors[0]}
                radius={[4, 4, 0, 0]}
              />
            </BarChart>
          </ResponsiveContainer>
        );

      case 'pie':
        return (
          <ResponsiveContainer width="100%" height={height}>
            <PieChart>
              <Pie
                data={formattedData}
                cx="50%"
                cy="50%"
                labelLine={false}
                label={({ name, percent }) => `${name} ${percent}%`}
                outerRadius={80}
                fill="#8884d8"
                dataKey="value"
              >
                {formattedData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={colors[index % colors.length]} />
                ))}
              </Pie>
              <Tooltip 
                formatter={(value: number) => [value.toLocaleString(), '數值']}
              />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        );

      default:
        return null;
    }
  };

  return (
    <Card className="w-full">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CardTitle>{title}</CardTitle>
            {trend && (
              <Badge variant="outline" className={`
                ${trend.direction === 'up' ? 'text-green-600 border-green-200' : 
                  trend.direction === 'down' ? 'text-red-600 border-red-200' : 
                  'text-gray-600 border-gray-200'}
              `}>
                {trend.direction === 'up' ? <TrendingUp className="h-3 w-3 mr-1" /> :
                 trend.direction === 'down' ? <TrendingDown className="h-3 w-3 mr-1" /> :
                 <Activity className="h-3 w-3 mr-1" />}
                {trend.percent.toFixed(1)}%
              </Badge>
            )}
          </div>
          
          <div className="flex items-center gap-2">
            {/* 圖表類型選擇 */}
            <div className="flex border rounded-md">
              {[
                { type: 'line', icon: Activity },
                { type: 'area', icon: Activity },
                { type: 'bar', icon: BarChart3 },
                { type: 'pie', icon: PieChartIcon }
              ].map(({ type, icon: Icon }) => (
                <Button
                  key={type}
                  variant={chartType === type ? "default" : "ghost"}
                  size="sm"
                  onClick={() => setChartType(type as any)}
                  className="rounded-none first:rounded-l-md last:rounded-r-md"
                >
                  <Icon className="h-4 w-4" />
                </Button>
              ))}
            </div>

            {/* 時間範圍選擇 */}
            {onTimeRangeChange && (
              <Select value={timeRange} onValueChange={onTimeRangeChange}>
                <SelectTrigger className="w-32">
                  <Calendar className="h-4 w-4 mr-1" />
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(timeRangeLabels).map(([value, label]) => (
                    <SelectItem key={value} value={value}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}

            {/* 導出按鈕 */}
            {showExport && (
              <Button
                variant="outline"
                size="sm"
                onClick={exportData}
                disabled={!data.length}
              >
                <Download className="h-4 w-4 mr-1" />
                導出
              </Button>
            )}
          </div>
        </div>

        {/* 統計摘要 */}
        {!loading && data.length > 0 && (
          <div className="flex gap-4 mt-2">
            <div className="text-sm text-gray-600">
              總計: <span className="font-medium">{data.reduce((sum, item) => sum + item.value, 0).toLocaleString()}</span>
            </div>
            <div className="text-sm text-gray-600">
              平均: <span className="font-medium">{(data.reduce((sum, item) => sum + item.value, 0) / data.length).toFixed(2)}</span>
            </div>
            <div className="text-sm text-gray-600">
              最大: <span className="font-medium">{Math.max(...data.map(item => item.value)).toLocaleString()}</span>
            </div>
            <div className="text-sm text-gray-600">
              最小: <span className="font-medium">{Math.min(...data.map(item => item.value)).toLocaleString()}</span>
            </div>
          </div>
        )}
      </CardHeader>
      <CardContent>
        {renderChart()}
      </CardContent>
    </Card>
  );
}