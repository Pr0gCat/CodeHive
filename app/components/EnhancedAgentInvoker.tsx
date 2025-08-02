'use client';

import PrioritySlider from '@/components/ui/PrioritySlider';
import { useToast } from '@/components/ui/ToastManager';
import { useCallback, useEffect, useState } from 'react';

interface EnhancedAgentInvokerProps {
  cardId: string;
  projectId: string;
  onClose: () => void;
}

interface AgentType {
  type: string;
  description: string;
}

interface AgentCapabilities {
  capabilities: string[];
  supportedCommands: {
    name: string;
    description: string;
    examples: string[];
    parameters?: {
      name: string;
      type: string;
      required: boolean;
      description: string;
    }[];
  }[];
}

interface ValidationResult {
  valid: boolean;
  error?: string;
  suggestions?: string[];
}

export default function EnhancedAgentInvoker({
  cardId,
  projectId,
  onClose,
}: EnhancedAgentInvokerProps) {
  const { showToast } = useToast();
  const [availableAgents, setAvailableAgents] = useState<AgentType[]>([]);
  const [selectedAgent, setSelectedAgent] = useState<string>('');
  const [agentCapabilities, setAgentCapabilities] =
    useState<AgentCapabilities | null>(null);
  const [command, setCommand] = useState('');
  const [priority, setPriority] = useState(5);
  const [validating, setValidating] = useState(false);
  const [validation, setValidation] = useState<ValidationResult | null>(null);
  const [taskId, setTaskId] = useState<string | null>(null);
  const [isExecuting, setIsExecuting] = useState(false);

  useEffect(() => {
    fetchAvailableAgents();
  }, []);

  const fetchAvailableAgents = async () => {
    try {
      const response = await fetch('/api/agents/capabilities');
      const data = await response.json();

      if (data.success) {
        setAvailableAgents(data.data.availableAgents);
        if (data.data.availableAgents.length > 0) {
          setSelectedAgent(data.data.availableAgents[0].type);
        }
      }
    } catch (error) {
      console.error('Error fetching available agents:', error);
    }
  };

  const fetchAgentCapabilities = useCallback(async (agentType: string) => {
    try {
      const response = await fetch(
        `/api/agents/capabilities?agentType=${agentType}&projectId=${projectId}`
      );
      const data = await response.json();

      if (data.success) {
        setAgentCapabilities(data.data);
      }
    } catch (error) {
      console.error('Error fetching agent capabilities:', error);
    }
  }, [projectId]);

  const validateCommand = useCallback(async () => {
    if (!command.trim() || !selectedAgent) return;

    setValidating(true);
    try {
      const response = await fetch('/api/agents/capabilities', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          agentType: selectedAgent,
          projectId,
          command: command.trim(),
        }),
      });

      const data = await response.json();

      if (data.success) {
        setValidation(data.data);
      }
    } catch (error) {
      console.error('Error validating command:', error);
    } finally {
      setValidating(false);
    }
  }, [command, selectedAgent, projectId]);

  useEffect(() => {
    if (selectedAgent) {
      fetchAgentCapabilities(selectedAgent);
    }
  }, [selectedAgent, fetchAgentCapabilities]);

  useEffect(() => {
    if (command.trim() && selectedAgent) {
      const timeoutId = setTimeout(() => {
        validateCommand();
      }, 500); // Debounce validation

      return () => clearTimeout(timeoutId);
    } else {
      setValidation(null);
    }
  }, [command, selectedAgent, validateCommand]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!command.trim() || (validation && !validation.valid)) return;

    setIsExecuting(true);
    try {
      let response;

      // Special handling for Project Manager agent
      if (selectedAgent === 'project-manager') {
        const action = command.toLowerCase().includes('orchestrate')
          ? 'orchestrate'
          : 'recommend';
        response = await fetch('/api/agents/project-manager', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            projectId,
            cardId,
            action,
          }),
        });
      } else {
        response = await fetch('/api/agents/execute', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            projectId,
            cardId,
            agentType: selectedAgent,
            command: command.trim(),
            priority,
          }),
        });
      }

      const data = await response.json();

      if (data.success) {
        if (selectedAgent === 'project-manager' && data.data.taskIds) {
          setTaskId(`PM:${data.data.taskIds.join(',')}`);
        } else {
          setTaskId(data.data.taskId);
        }
        onClose();
        showToast('代理已成功執行', 'success');
      } else {
        showToast(`執行代理失敗：${data.error}`, 'error');
      }
    } catch (error) {
      console.error('Error executing agent:', error);
      showToast('執行代理失敗，請重試。', 'error');
    } finally {
      setIsExecuting(false);
    }
  };

  const handleCommandSelect = (selectedCommand: string) => {
    setCommand(selectedCommand);
  };

  if (taskId) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
          <div className="text-center">
            <div className="w-12 h-12 bg-accent-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg
                className="w-6 h-6 text-accent-600"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M5 13l4 4L19 7"
                />
              </svg>
            </div>
            <h3 className="text-lg font-semibold text-primary-100 mb-2">
              Agent Task Executed
            </h3>
            <p className="text-primary-600 mb-4">
              Your agent task has been{' '}
              {selectedAgent === 'project-manager' ? 'orchestrated' : 'queued'}{' '}
              successfully.
            </p>
            <div className="bg-primary-950 p-3 rounded mb-4">
              <p className="text-sm text-primary-600">Task ID:</p>
              <p className="font-mono text-sm text-primary-100">{taskId}</p>
            </div>
            <button
              onClick={onClose}
              className="px-4 py-2 bg-accent-600 text-accent-50 rounded hover:bg-accent-700 focus:outline-none focus:ring-2 focus:ring-accent-500"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 max-w-4xl w-full mx-4 max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center mb-6">
          <h3 className="text-xl font-semibold text-primary-100">
            Execute Agent
          </h3>
          <button
            onClick={onClose}
            className="text-primary-400 hover:text-primary-600 focus:outline-none"
          >
            <svg
              className="w-6 h-6"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-primary-300 mb-2">
              Agent Type
            </label>
            <select
              value={selectedAgent}
              onChange={e => setSelectedAgent(e.target.value)}
              className="w-full px-3 py-2 border border-primary-700 rounded-md focus:outline-none focus:ring-2 focus:ring-accent-500 focus:border-blue-500"
            >
              {availableAgents.map(agent => (
                <option key={agent.type} value={agent.type}>
                  {agent.type} - {agent.description}
                </option>
              ))}
            </select>
          </div>

          {agentCapabilities && (
            <div className="bg-primary-950 p-4 rounded-lg">
              <h4 className="font-medium text-primary-100 mb-2">
                Agent Capabilities
              </h4>
              <div className="grid grid-cols-2 gap-2 text-sm text-primary-600">
                {agentCapabilities.capabilities.map((capability, index) => (
                  <div key={index} className="flex items-center">
                    <svg
                      className="w-3 h-3 text-green-500 mr-2"
                      fill="currentColor"
                      viewBox="0 0 20 20"
                    >
                      <path
                        fillRule="evenodd"
                        d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                        clipRule="evenodd"
                      />
                    </svg>
                    {capability}
                  </div>
                ))}
              </div>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-primary-300 mb-2">
              Command
            </label>
            <textarea
              value={command}
              onChange={e => setCommand(e.target.value)}
              placeholder="Enter the command or instruction for the agent..."
              className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-accent-500 ${
                validation
                  ? validation.valid
                    ? 'border-green-300 focus:border-green-500'
                    : 'border-red-300 focus:border-red-500'
                  : 'border-primary-700 focus:border-blue-500'
              }`}
              rows={3}
              required
            />

            {validating && (
              <div className="mt-1 text-sm text-primary-500 flex items-center">
                <svg
                  className="animate-spin -ml-1 mr-2 h-3 w-3 text-primary-500"
                  fill="none"
                  viewBox="0 0 24 24"
                >
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                  ></circle>
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                  ></path>
                </svg>
                Validating command...
              </div>
            )}

            {validation && !validating && (
              <div
                className={`mt-1 text-sm ${validation.valid ? 'text-accent-600' : 'text-red-600'}`}
              >
                {validation.valid ? (
                  <div className="flex items-center">
                    <svg
                      className="w-3 h-3 mr-1"
                      fill="currentColor"
                      viewBox="0 0 20 20"
                    >
                      <path
                        fillRule="evenodd"
                        d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                        clipRule="evenodd"
                      />
                    </svg>
                    Command is valid
                  </div>
                ) : (
                  <div>
                    <div className="flex items-center mb-1">
                      <svg
                        className="w-3 h-3 mr-1"
                        fill="currentColor"
                        viewBox="0 0 20 20"
                      >
                        <path
                          fillRule="evenodd"
                          d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z"
                          clipRule="evenodd"
                        />
                      </svg>
                      {validation.error}
                    </div>
                    {validation.suggestions &&
                      validation.suggestions.length > 0 && (
                        <div className="mt-2">
                          <p className="text-xs font-medium">Suggestions:</p>
                          <ul className="text-xs mt-1 space-y-1">
                            {validation.suggestions.map((suggestion, index) => (
                              <li key={index} className="text-primary-600">
                                • {suggestion}
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                  </div>
                )}
              </div>
            )}
          </div>

          {agentCapabilities &&
            agentCapabilities.supportedCommands.length > 0 && (
              <div>
                <label className="block text-sm font-medium text-primary-300 mb-2">
                  Supported Commands
                </label>
                <div className="grid grid-cols-1 gap-2 max-h-40 overflow-y-auto">
                  {agentCapabilities.supportedCommands.map((cmd, index) => (
                    <div
                      key={index}
                      className="border border-primary-800 rounded p-3"
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <h5 className="font-medium text-primary-100 text-sm">
                            {cmd.name}
                          </h5>
                          <p className="text-xs text-primary-600 mt-1">
                            {cmd.description}
                          </p>
                        </div>
                      </div>
                      <div className="mt-2">
                        <p className="text-xs font-medium text-primary-300 mb-1">
                          Examples:
                        </p>
                        <div className="space-y-1">
                          {cmd.examples
                            .slice(0, 2)
                            .map((example, exampleIndex) => (
                              <button
                                key={exampleIndex}
                                type="button"
                                onClick={() => handleCommandSelect(example)}
                                className="block text-left w-full px-2 py-1 text-xs bg-blue-50 text-blue-700 rounded hover:bg-blue-100 focus:outline-none focus:ring-1 focus:ring-accent-500"
                              >
                                {example}
                              </button>
                            ))}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

          <div>
            <label className="block text-sm font-medium text-primary-300 mb-2">
              Priority
            </label>
            <PrioritySlider
              value={priority}
              onChange={setPriority}
              disabled={isExecuting}
            />
          </div>

          <div className="flex items-center justify-end space-x-4 pt-4 border-t border-primary-800">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-primary-300 bg-primary-900 rounded-md hover:bg-primary-800 focus:outline-none focus:ring-2 focus:ring-gray-500"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={
                isExecuting ||
                !command.trim() ||
                (validation ? !validation.valid : false)
              }
              className="px-4 py-2 bg-accent-600 text-accent-50 rounded-md hover:bg-accent-700 focus:outline-none focus:ring-2 focus:ring-accent-500 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isExecuting ? (
                <span className="flex items-center">
                  <svg
                    className="animate-spin -ml-1 mr-2 h-4 w-4 text-accent-50"
                    fill="none"
                    viewBox="0 0 24 24"
                  >
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                    ></circle>
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                    ></path>
                  </svg>
                  Executing...
                </span>
              ) : (
                'Execute Agent'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
