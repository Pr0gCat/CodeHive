'use client';

import { useEffect, useState } from 'react';

interface NetworkNode {
  id: string;
  x: number;
  y: number;
  size: number;
  active: boolean;
  completed: boolean;
  label: string;
  connections: string[];
}

interface NeuralNetworkProgressProps {
  currentPhase: number;
  totalPhases: number;
  phaseLabels: string[];
  className?: string;
}

export default function NeuralNetworkProgress({
  currentPhase,
  totalPhases,
  phaseLabels,
  className = '',
}: NeuralNetworkProgressProps) {
  const [nodes, setNodes] = useState<NetworkNode[]>([]);
  const [connections, setConnections] = useState<
    Array<{ from: string; to: string; active: boolean }>
  >([]);
  const [pulseNodes, setPulseNodes] = useState<Set<string>>(new Set());

  // Initialize network structure
  useEffect(() => {
    const networkNodes: NetworkNode[] = [];
    const networkConnections: Array<{
      from: string;
      to: string;
      active: boolean;
    }> = [];

    // Create nodes for each phase
    phaseLabels.forEach((label, index) => {
      const angle = (index / totalPhases) * 2 * Math.PI - Math.PI / 2;
      const radius = 120;
      const x = Math.cos(angle) * radius;
      const y = Math.sin(angle) * radius;

      networkNodes.push({
        id: `phase-${index}`,
        x,
        y,
        size: 12,
        active: index === currentPhase,
        completed: index < currentPhase,
        label,
        connections: index < totalPhases - 1 ? [`phase-${index + 1}`] : [],
      });

      // Create connections
      if (index < totalPhases - 1) {
        networkConnections.push({
          from: `phase-${index}`,
          to: `phase-${index + 1}`,
          active: index < currentPhase,
        });
      }
    });

    // Add central processing node
    networkNodes.push({
      id: 'central',
      x: 0,
      y: 0,
      size: 20,
      active: true,
      completed: false,
      label: '🤖 Project Manager',
      connections: phaseLabels.map((_, index) => `phase-${index}`),
    });

    // Connect central node to all phase nodes
    phaseLabels.forEach((_, index) => {
      networkConnections.push({
        from: 'central',
        to: `phase-${index}`,
        active: index <= currentPhase,
      });
    });

    setNodes(networkNodes);
    setConnections(networkConnections);
  }, [currentPhase, totalPhases, phaseLabels]);

  // Handle pulse animation for active nodes
  useEffect(() => {
    const interval = setInterval(() => {
      setPulseNodes(prev => {
        const newPulseNodes = new Set<string>();

        // Add current phase node to pulse
        if (currentPhase < totalPhases) {
          newPulseNodes.add(`phase-${currentPhase}`);
        }

        // Add central node if any phase is active
        if (currentPhase >= 0) {
          newPulseNodes.add('central');
        }

        // Random pulse on connected nodes
        nodes.forEach(node => {
          if (node.completed && Math.random() < 0.1) {
            newPulseNodes.add(node.id);
          }
        });

        return newPulseNodes;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [currentPhase, totalPhases, nodes]);

  const getNodeColor = (node: NetworkNode) => {
    if (node.completed) return '#10b981'; // Green for completed
    if (node.active) return '#3b82f6'; // Blue for active
    return '#6b7280'; // Gray for pending
  };

  const getNodeGlow = (node: NetworkNode) => {
    if (pulseNodes.has(node.id)) {
      return node.completed
        ? '0 0 20px #10b981, 0 0 40px #10b981'
        : node.active
          ? '0 0 20px #3b82f6, 0 0 40px #3b82f6'
          : '0 0 10px #6b7280';
    }
    return 'none';
  };

  return (
    <div className={`relative ${className}`}>
      <div className="relative w-80 h-80 mx-auto">
        {/* SVG for connections */}
        <svg
          className="absolute inset-0 w-full h-full"
          viewBox="-160 -160 320 320"
          style={{ filter: 'drop-shadow(0 0 5px rgba(59, 130, 246, 0.3))' }}
        >
          {connections.map((connection, index) => {
            const fromNode = nodes.find(n => n.id === connection.from);
            const toNode = nodes.find(n => n.id === connection.to);

            if (!fromNode || !toNode) return null;

            return (
              <g key={`connection-${index}`}>
                {/* Connection line */}
                <line
                  x1={fromNode.x}
                  y1={fromNode.y}
                  x2={toNode.x}
                  y2={toNode.y}
                  stroke={connection.active ? '#3b82f6' : '#374151'}
                  strokeWidth={connection.active ? '2' : '1'}
                  opacity={connection.active ? 0.8 : 0.3}
                />

                {/* Data flow animation */}
                {connection.active && (
                  <circle r="3" fill="#60a5fa" opacity="0.8">
                    <animateMotion
                      dur="2s"
                      repeatCount="indefinite"
                      path={`M ${fromNode.x} ${fromNode.y} L ${toNode.x} ${toNode.y}`}
                    />
                  </circle>
                )}
              </g>
            );
          })}
        </svg>

        {/* Nodes */}
        {nodes.map(node => (
          <div
            key={node.id}
            className="absolute transform -translate-x-1/2 -translate-y-1/2 transition-all duration-500"
            style={{
              left: '50%',
              top: '50%',
              transform: `translate(-50%, -50%) translate(${node.x}px, ${node.y}px)`,
            }}
          >
            {/* Node circle */}
            <div
              className={`
                rounded-full border-2 flex items-center justify-center
                transition-all duration-300 cursor-pointer
                ${node.active ? 'neural-node' : ''}
              `}
              style={{
                width: `${node.size * 2}px`,
                height: `${node.size * 2}px`,
                backgroundColor: getNodeColor(node),
                borderColor: getNodeColor(node),
                boxShadow: getNodeGlow(node),
              }}
            >
              {/* Node icon */}
              {node.id === 'central' ? (
                <span className="text-white text-sm">🤖</span>
              ) : node.completed ? (
                <span className="text-white text-xs">✓</span>
              ) : node.active ? (
                <div className="w-2 h-2 bg-white rounded-full animate-pulse" />
              ) : (
                <div className="w-1 h-1 bg-gray-400 rounded-full" />
              )}
            </div>

            {/* Node label */}
            <div
              className={`
                absolute top-full mt-2 left-1/2 transform -translate-x-1/2
                text-xs font-medium text-center whitespace-nowrap
                transition-all duration-300
                ${
                  node.completed
                    ? 'text-green-400'
                    : node.active
                      ? 'text-blue-400 holographic-text'
                      : 'text-gray-500'
                }
              `}
            >
              {node.label}
            </div>

            {/* Pulse ring for active nodes */}
            {pulseNodes.has(node.id) && (
              <div
                className="absolute inset-0 rounded-full border-2 animate-ping"
                style={{
                  borderColor: getNodeColor(node),
                  opacity: 0.5,
                }}
              />
            )}
          </div>
        ))}

        {/* Central brain waves effect */}
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="relative">
            {[1, 2, 3].map(wave => (
              <div
                key={wave}
                className="absolute border border-blue-400 rounded-full animate-ping"
                style={{
                  width: `${wave * 60}px`,
                  height: `${wave * 60}px`,
                  left: '50%',
                  top: '50%',
                  transform: 'translate(-50%, -50%)',
                  animationDelay: `${wave * 0.5}s`,
                  animationDuration: '3s',
                  opacity: 0.1,
                }}
              />
            ))}
          </div>
        </div>
      </div>

      {/* Progress indicator */}
      <div className="mt-8 text-center">
        <div className="text-sm text-gray-400 mb-2">
          Phase {currentPhase + 1} of {totalPhases}
        </div>
        <div className="w-64 h-2 bg-gray-800 rounded-full mx-auto overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-blue-500 to-green-500 transition-all duration-1000 ease-out"
            style={{
              width: `${((currentPhase + 1) / totalPhases) * 100}%`,
            }}
          />
        </div>
        <div className="text-xs text-gray-500 mt-2">
          {Math.round(((currentPhase + 1) / totalPhases) * 100)}% Complete
        </div>
      </div>
    </div>
  );
}
