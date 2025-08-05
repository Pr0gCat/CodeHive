'use client';

import { useEffect, useState } from 'react';
import { AlertTriangle, Building2 } from 'lucide-react';
import Slider from './Slider';

interface ProjectBudget {
  projectId: string;
  projectName: string;
  allocatedPercentage: number;
  dailyTokenBudget: number;
  usedTokens: number;
  usagePercentage: number;
}

interface BudgetAllocationSliderProps {
  projects: ProjectBudget[];
  globalDailyLimit: number;
  onChange: (
    allocations: Array<{ projectId: string; allocatedPercentage: number }>
  ) => void;
  disabled?: boolean;
  className?: string;
}

export default function BudgetAllocationSlider({
  projects,
  globalDailyLimit,
  onChange,
  disabled = false,
  className = '',
}: BudgetAllocationSliderProps) {
  const [allocations, setAllocations] = useState<{ [key: string]: number }>({});
  const [totalAllocated, setTotalAllocated] = useState(0);

  // Initialize allocations from props
  useEffect(() => {
    const initialAllocations: { [key: string]: number } = {};
    let total = 0;

    projects.forEach(project => {
      initialAllocations[project.projectId] = project.allocatedPercentage;
      total += project.allocatedPercentage;
    });

    setAllocations(initialAllocations);
    setTotalAllocated(total);
  }, [projects]);

  // Handle visual changes during dragging (no API call)
  const handleAllocationChange = (projectId: string, newPercentage: number) => {
    if (disabled) return;

    const oldPercentage = allocations[projectId] || 0;
    const difference = newPercentage - oldPercentage;
    const newTotalAllocated = totalAllocated + difference;

    // If new total would exceed 100%, adjust proportionally
    const newAllocations = { ...allocations };

    if (newTotalAllocated > 1.0) {
      // Calculate how much we need to reduce from other projects
      const excess = newTotalAllocated - 1.0;
      const otherProjects = projects.filter(p => p.projectId !== projectId);
      const totalOtherAllocation = otherProjects.reduce(
        (sum, p) => sum + (allocations[p.projectId] || 0),
        0
      );

      if (totalOtherAllocation > 0) {
        // Reduce other projects proportionally
        otherProjects.forEach(project => {
          const currentAllocation = allocations[project.projectId] || 0;
          const proportion = currentAllocation / totalOtherAllocation;
          const reduction = excess * proportion;
          newAllocations[project.projectId] = Math.max(
            0,
            currentAllocation - reduction
          );
        });
      }
    }

    newAllocations[projectId] = newPercentage;

    const finalTotal = Object.values(newAllocations).reduce(
      (sum, val) => sum + val,
      0
    );

    setAllocations(newAllocations);
    setTotalAllocated(finalTotal);

    // Don't call onChange here - only update visual state
  };

  // Handle drag end (make API call)
  const handleAllocationChangeEnd = (
    projectId: string,
    newPercentage: number
  ) => {
    if (disabled) return;

    // Call onChange only when dragging ends
    const allocationArray = projects.map(project => ({
      projectId: project.projectId,
      allocatedPercentage: allocations[project.projectId] || 0,
    }));

    onChange(allocationArray);
  };

  const formatPercentage = (decimal: number): string => {
    return `${Math.round(decimal * 100)}%`;
  };

  const formatTokens = (tokens: number): string => {
    if (tokens >= 1000000) {
      return `${(tokens / 1000000).toFixed(1)}M`;
    } else if (tokens >= 1000) {
      return `${(tokens / 1000).toFixed(0)}K`;
    }
    return tokens.toString();
  };

  const handleQuickAllocation = (type: 'equal' | 'reset' | 'usage-based') => {
    if (disabled) return;

    const newAllocations: { [key: string]: number } = {};

    switch (type) {
      case 'equal':
        // Distribute equally among all projects
        const equalShare = projects.length > 0 ? 1.0 / projects.length : 0;
        projects.forEach(project => {
          newAllocations[project.projectId] = equalShare;
        });
        break;

      case 'reset':
        // Reset all to 0
        projects.forEach(project => {
          newAllocations[project.projectId] = 0;
        });
        break;

      case 'usage-based':
        // Allocate based on current usage
        const totalUsage = projects.reduce((sum, p) => sum + p.usedTokens, 0);
        if (totalUsage > 0) {
          projects.forEach(project => {
            newAllocations[project.projectId] = project.usedTokens / totalUsage;
          });
        } else {
          // Fall back to equal if no usage data
          const fallbackShare = projects.length > 0 ? 1.0 / projects.length : 0;
          projects.forEach(project => {
            newAllocations[project.projectId] = fallbackShare;
          });
        }
        break;
    }

    setAllocations(newAllocations);
    setTotalAllocated(
      Object.values(newAllocations).reduce((sum, val) => sum + val, 0)
    );

    const allocationArray = projects.map(project => ({
      projectId: project.projectId,
      allocatedPercentage: newAllocations[project.projectId] || 0,
    }));

    onChange(allocationArray);
  };

  const isOverAllocated = totalAllocated > 1.0;
  const unallocatedPercentage = Math.max(0, 1.0 - totalAllocated);

  return (
    <div className={className}>
      <div className="mb-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-accent-50">專案預算分配</h3>
          <div className="flex space-x-2">
            {/* Quick allocation buttons */}
            <button
              onClick={() => handleQuickAllocation('equal')}
              disabled={disabled}
              className="px-3 py-1 text-xs bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
            >
              均等分配
            </button>
            <button
              onClick={() => handleQuickAllocation('usage-based')}
              disabled={disabled}
              className="px-3 py-1 text-xs bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50"
            >
              按使用量
            </button>
            <button
              onClick={() => handleQuickAllocation('reset')}
              disabled={disabled}
              className="px-3 py-1 text-xs bg-gray-600 text-white rounded hover:bg-gray-700 disabled:opacity-50"
            >
              重設
            </button>
          </div>
        </div>

        {/* Total allocation summary */}
        <div
          className={`p-4 rounded-lg border ${
            isOverAllocated
              ? 'bg-red-900/20 border-red-700'
              : 'bg-primary-800 border-primary-700'
          }`}
        >
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm text-primary-300">總分配</div>
              <div
                className={`text-xl font-bold ${
                  isOverAllocated ? 'text-red-400' : 'text-accent-50'
                }`}
              >
                {formatPercentage(totalAllocated)}
              </div>
              {unallocatedPercentage > 0 && (
                <div className="text-xs text-primary-400">
                  剩餘：{formatPercentage(unallocatedPercentage)}
                </div>
              )}
            </div>
            <div className="text-right">
              <div className="text-sm text-primary-300">每日限制</div>
              <div className="text-xl font-bold text-accent-50">
                {formatTokens(globalDailyLimit)}
              </div>
              <div className="text-xs text-primary-400">Tokens</div>
            </div>
          </div>

          {isOverAllocated && (
            <div className="mt-2 text-xs text-red-400">
              <AlertTriangle className="inline w-4 h-4 mr-1" />
              總分配超過 100%，請調整分配比例
            </div>
          )}
        </div>
      </div>

      {/* Project allocation sliders */}
      <div className="space-y-6">
        {projects.map(project => {
          const allocation = allocations[project.projectId] || 0;
          const calculatedBudget = Math.floor(globalDailyLimit * allocation);
          const usageColor =
            project.usagePercentage > 90
              ? 'red'
              : project.usagePercentage > 75
                ? 'yellow'
                : 'green';

          return (
            <div
              key={project.projectId}
              className="bg-primary-800 rounded-lg p-4 border border-primary-700"
            >
              <div className="flex items-center justify-between mb-3">
                <div>
                  <h4 className="font-medium text-accent-50">
                    {project.projectName}
                  </h4>
                  <div className="flex items-center space-x-4 text-xs text-primary-400">
                    <span>今日使用：{formatTokens(project.usedTokens)}</span>
                    <span
                      className={`px-2 py-1 rounded ${
                        usageColor === 'red'
                          ? 'bg-red-900 text-red-300'
                          : usageColor === 'yellow'
                            ? 'bg-yellow-900 text-yellow-300'
                            : 'bg-green-900 text-green-300'
                      }`}
                    >
                      {project.usagePercentage.toFixed(1)}% 使用
                    </span>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-sm font-medium text-accent-50">
                    {formatTokens(calculatedBudget)}
                  </div>
                  <div className="text-xs text-primary-400">Tokens/日</div>
                </div>
              </div>

              <Slider
                min={0}
                max={1}
                value={allocation}
                onChange={value =>
                  handleAllocationChange(project.projectId, value)
                }
                onChangeEnd={value =>
                  handleAllocationChangeEnd(project.projectId, value)
                }
                step={0.01}
                disabled={disabled}
                color="accent"
                size="md"
                formatLabel={formatPercentage}
                showValue={true}
                showMinMax={false}
                aria-label={`${project.projectName} 預算分配`}
              />
            </div>
          );
        })}
      </div>

      {projects.length === 0 && (
        <div className="text-center py-8 text-primary-400">
          <div className="text-lg mb-2">
            <Building2 className="w-8 h-8 mx-auto text-primary-400" />
          </div>
          <div>尚無專案需要分配預算</div>
          <div className="text-sm mt-1">建立專案後即可設定預算分配</div>
        </div>
      )}
    </div>
  );
}
