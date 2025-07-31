'use client'

import React from 'react'

interface HoneycombProps {
  size?: number
  cellSize?: number
  rows?: number
  cols?: number
  className?: string
  fillColor?: string
  strokeColor?: string
  strokeWidth?: number
}

export default function Honeycomb({
  size = 300,
  cellSize = 30,
  rows = 7,
  cols = 7,
  className = '',
  fillColor = '#fbbf24',
  strokeColor = '#d97706',
  strokeWidth = 2
}: HoneycombProps) {
  const hexHeight = cellSize * Math.sqrt(3)
  const hexWidth = cellSize * 2
  const vertSpacing = hexHeight * 0.75

  const createHexagonPath = (centerX: number, centerY: number) => {
    const points = []
    for (let i = 0; i < 6; i++) {
      const angle = (i * Math.PI) / 3
      const x = centerX + cellSize * Math.cos(angle)
      const y = centerY + cellSize * Math.sin(angle)
      points.push(`${x},${y}`)
    }
    return `M ${points.join(' L ')} Z`
  }

  const hexagons = []
  
  for (let row = 0; row < rows; row++) {
    const isOddRow = row % 2 === 1
    const hexsInRow = isOddRow ? cols - 1 : cols
    
    for (let col = 0; col < hexsInRow; col++) {
      const x = col * hexWidth * 0.75 + (isOddRow ? hexWidth * 0.375 : 0) + cellSize
      const y = row * vertSpacing + cellSize
      
      hexagons.push({
        key: `${row}-${col}`,
        path: createHexagonPath(x, y)
      })
    }
  }

  const svgWidth = cols * hexWidth * 0.75 + hexWidth * 0.25
  const svgHeight = (rows - 1) * vertSpacing + hexHeight

  return (
    <div className={`flex items-center justify-center ${className}`}>
      <svg
        width={svgWidth}
        height={svgHeight}
        viewBox={`0 0 ${svgWidth} ${svgHeight}`}
        className="drop-shadow-lg"
      >
        {hexagons.map(({ key, path }) => (
          <path
            key={key}
            d={path}
            fill={fillColor}
            stroke={strokeColor}
            strokeWidth={strokeWidth}
            className="transition-all duration-300 hover:fill-amber-300 hover:scale-105 cursor-pointer"
          />
        ))}
      </svg>
    </div>
  )
}