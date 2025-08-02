'use client';

import { useEffect, useState } from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import { format } from 'date-fns';

interface BurndownData {
  date: string;
  remainingStoryPoints: number;
  idealRemainingPoints: number;
}

interface SprintBurndownProps {
  sprintId: string;
}

export function SprintBurndown({ sprintId }: SprintBurndownProps) {
  const [data, setData] = useState<BurndownData[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchBurndownData();
  }, [sprintId]);

  const fetchBurndownData = async () => {
    try {
      const response = await fetch(`/api/sprints/${sprintId}/burndown`);
      if (response.ok) {
        const burndownData = await response.json();
        setData(burndownData);
      }
    } catch (error) {
      console.error('Error fetching burndown data:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="h-64 flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  if (data.length === 0) {
    return (
      <div className="h-64 flex items-center justify-center text-gray-500">
        尚無燃盡圖數據
      </div>
    );
  }

  const chartData = data.map((point) => ({
    date: format(new Date(point.date), 'MM/dd'),
    實際剩餘: point.remainingStoryPoints,
    理想剩餘: point.idealRemainingPoints,
  }));

  return (
    <ResponsiveContainer width="100%" height={300}>
      <LineChart
        data={chartData}
        margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
      >
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis dataKey="date" />
        <YAxis />
        <Tooltip />
        <Legend />
        <Line
          type="monotone"
          dataKey="實際剩餘"
          stroke="#6366f1"
          strokeWidth={2}
          dot={{ fill: '#6366f1' }}
        />
        <Line
          type="monotone"
          dataKey="理想剩餘"
          stroke="#10b981"
          strokeWidth={2}
          strokeDasharray="5 5"
          dot={false}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}