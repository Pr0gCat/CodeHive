'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { format, addDays } from 'date-fns';
import { Calendar, Target, Clock } from 'lucide-react';

interface SprintFormProps {
  projectId: string;
}

export function SprintForm({ projectId }: SprintFormProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Default to 2-week sprint starting next Monday
  const getNextMonday = () => {
    const today = new Date();
    const monday = new Date(today);
    monday.setDate(today.getDate() + ((1 + 7 - today.getDay()) % 7 || 7));
    return monday;
  };

  const defaultStartDate = getNextMonday();
  const defaultEndDate = addDays(defaultStartDate, 13); // 2-week sprint

  const [formData, setFormData] = useState({
    name: '',
    goal: '',
    startDate: format(defaultStartDate, 'yyyy-MM-dd'),
    endDate: format(defaultEndDate, 'yyyy-MM-dd'),
    duration: 14,
  });

  const calculateDuration = (start: string, end: string) => {
    const startDate = new Date(start);
    const endDate = new Date(end);
    const diffTime = Math.abs(endDate.getTime() - startDate.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
    return diffDays;
  };

  const handleDateChange = (field: 'startDate' | 'endDate', value: string) => {
    const newData = { ...formData, [field]: value };

    if (newData.startDate && newData.endDate) {
      newData.duration = calculateDuration(newData.startDate, newData.endDate);
    }

    setFormData(newData);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const response = await fetch('/api/sprints', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ...formData,
          projectId,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to create sprint');
      }

      const sprint = await response.json();
      router.push(`/projects/${projectId}/sprints/${sprint.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  const suggestSprintName = () => {
    const startDate = new Date(formData.startDate);
    const sprintNumber =
      Math.floor(
        (startDate.getTime() - new Date('2024-01-01').getTime()) /
          (1000 * 60 * 60 * 24 * 14)
      ) + 1;
    setFormData({ ...formData, name: `Sprint ${sprintNumber}` });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-md">
          {error}
        </div>
      )}

      <div>
        <label
          htmlFor="name"
          className="block text-sm font-medium text-gray-700"
        >
          Sprint 名稱
        </label>
        <div className="mt-1 flex rounded-md shadow-sm">
          <input
            type="text"
            id="name"
            value={formData.name}
            onChange={e => setFormData({ ...formData, name: e.target.value })}
            className="flex-1 min-w-0 block w-full px-3 py-2 rounded-none rounded-l-md border border-gray-300 focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
            placeholder="例如：Sprint 1"
            required
          />
          <button
            type="button"
            onClick={suggestSprintName}
            className="inline-flex items-center px-3 py-2 border border-l-0 border-gray-300 rounded-r-md bg-gray-50 text-gray-500 text-sm hover:bg-gray-100"
          >
            自動命名
          </button>
        </div>
      </div>

      <div>
        <label
          htmlFor="goal"
          className="block text-sm font-medium text-gray-700"
        >
          <Target className="inline h-4 w-4 mr-1" />
          Sprint 目標（選填）
        </label>
        <textarea
          id="goal"
          rows={3}
          value={formData.goal}
          onChange={e => setFormData({ ...formData, goal: e.target.value })}
          className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
          placeholder="描述這個 Sprint 的主要目標..."
        />
      </div>

      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
        <div>
          <label
            htmlFor="startDate"
            className="block text-sm font-medium text-gray-700"
          >
            <Calendar className="inline h-4 w-4 mr-1" />
            開始日期
          </label>
          <input
            type="date"
            id="startDate"
            value={formData.startDate}
            onChange={e => handleDateChange('startDate', e.target.value)}
            className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
            required
          />
        </div>

        <div>
          <label
            htmlFor="endDate"
            className="block text-sm font-medium text-gray-700"
          >
            <Calendar className="inline h-4 w-4 mr-1" />
            結束日期
          </label>
          <input
            type="date"
            id="endDate"
            value={formData.endDate}
            onChange={e => handleDateChange('endDate', e.target.value)}
            min={formData.startDate}
            className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
            required
          />
        </div>
      </div>

      <div className="bg-gray-50 rounded-lg p-4">
        <div className="flex items-center text-sm text-gray-600">
          <Clock className="h-4 w-4 mr-2" />
          <span>Sprint 長度：{formData.duration} 天</span>
        </div>
      </div>

      <div className="flex justify-end space-x-3">
        <button
          type="button"
          onClick={() => router.back()}
          className="px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
        >
          取消
        </button>
        <button
          type="submit"
          disabled={loading}
          className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? '建立中...' : '建立 Sprint'}
        </button>
      </div>
    </form>
  );
}
