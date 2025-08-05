'use client';

import { useEffect, useRef, useState } from 'react';

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  life: number;
  maxLife: number;
  color: string;
  glowIntensity: number;
}

interface ParticleSystemProps {
  count?: number;
  speed?: number;
  size?: { min: number; max: number };
  colors?: string[];
  phase?: 'analyzing' | 'processing' | 'creating' | 'finalizing' | 'complete';
  className?: string;
}

export default function ParticleSystem({
  count = 100,
  speed = 0.5,
  size = { min: 1, max: 3 },
  colors = ['#3b82f6', '#8b5cf6', '#10b981', '#f59e0b'],
  phase = 'analyzing',
  className = '',
}: ParticleSystemProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationRef = useRef<number>();
  const particlesRef = useRef<Particle[]>([]);
  const [isVisible, setIsVisible] = useState(true);

  // Phase-specific configurations
  const phaseConfigs = {
    analyzing: {
      colors: ['#3b82f6', '#1e40af', '#60a5fa'],
      speed: 0.3,
      pattern: 'scan',
      glow: 0.6,
    },
    processing: {
      colors: ['#8b5cf6', '#7c3aed', '#a855f7'],
      speed: 0.8,
      pattern: 'neural',
      glow: 0.8,
    },
    creating: {
      colors: ['#10b981', '#059669', '#34d399'],
      speed: 0.5,
      pattern: 'formation',
      glow: 0.7,
    },
    finalizing: {
      colors: ['#f59e0b', '#d97706', '#fbbf24'],
      speed: 0.4,
      pattern: 'convergence',
      glow: 0.9,
    },
    complete: {
      colors: ['#fbbf24', '#f59e0b', '#fde047'],
      speed: 0.2,
      pattern: 'celebration',
      glow: 1.0,
    },
  };

  const createParticle = (canvas: HTMLCanvasElement): Particle => {
    const config = phaseConfigs[phase];

    return {
      x: Math.random() * canvas.width,
      y: Math.random() * canvas.height,
      vx: (Math.random() - 0.5) * config.speed,
      vy: (Math.random() - 0.5) * config.speed,
      size: Math.random() * (size.max - size.min) + size.min,
      life: Math.random() * 100 + 50,
      maxLife: Math.random() * 100 + 50,
      color: config.colors[Math.floor(Math.random() * config.colors.length)],
      glowIntensity: config.glow,
    };
  };

  const updateParticle = (particle: Particle, canvas: HTMLCanvasElement) => {
    const config = phaseConfigs[phase];

    // Update position based on pattern
    switch (config.pattern) {
      case 'scan':
        // Scanning pattern - horizontal sweeps
        particle.vx += Math.sin(Date.now() * 0.001) * 0.1;
        break;
      case 'neural':
        // Neural network pattern - pulsing connections
        particle.vx += Math.sin(particle.x * 0.01 + Date.now() * 0.001) * 0.2;
        particle.vy += Math.cos(particle.y * 0.01 + Date.now() * 0.001) * 0.2;
        break;
      case 'formation':
        // Formation pattern - organizing into structures
        const centerX = canvas.width / 2;
        const centerY = canvas.height / 2;
        const dx = centerX - particle.x;
        const dy = centerY - particle.y;
        particle.vx += dx * 0.0005;
        particle.vy += dy * 0.0005;
        break;
      case 'convergence':
        // Convergence pattern - gathering together
        const targetX = canvas.width / 2 + Math.sin(Date.now() * 0.001) * 100;
        const targetY = canvas.height / 2 + Math.cos(Date.now() * 0.001) * 100;
        particle.vx += (targetX - particle.x) * 0.001;
        particle.vy += (targetY - particle.y) * 0.001;
        break;
      case 'celebration':
        // Celebration pattern - explosive burst
        particle.vy -= 0.02; // Float upward
        particle.vx *= 0.99; // Slow down horizontally
        break;
    }

    // Update position
    particle.x += particle.vx;
    particle.y += particle.vy;

    // Boundary checks
    if (particle.x < 0) particle.x = canvas.width;
    if (particle.x > canvas.width) particle.x = 0;
    if (particle.y < 0) particle.y = canvas.height;
    if (particle.y > canvas.height) particle.y = 0;

    // Update life
    particle.life -= 0.5;

    return particle.life > 0;
  };

  const hexToRgb = (hex: string) => {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result
      ? {
          r: parseInt(result[1], 16),
          g: parseInt(result[2], 16),
          b: parseInt(result[3], 16),
        }
      : { r: 255, g: 255, b: 255 };
  };

  const drawParticle = (ctx: CanvasRenderingContext2D, particle: Particle) => {
    const alpha = particle.life / particle.maxLife;
    const glowSize = particle.size * (1 + particle.glowIntensity);
    const rgb = hexToRgb(particle.color);

    // Create gradient for glow effect
    const gradient = ctx.createRadialGradient(
      particle.x,
      particle.y,
      0,
      particle.x,
      particle.y,
      glowSize
    );

    gradient.addColorStop(0, `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${alpha})`);
    gradient.addColorStop(
      0.5,
      `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${alpha * 0.5})`
    );
    gradient.addColorStop(1, `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0)`);

    // Draw glow
    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.arc(particle.x, particle.y, glowSize, 0, Math.PI * 2);
    ctx.fill();

    // Draw core particle
    ctx.fillStyle = `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${alpha})`;
    ctx.beginPath();
    ctx.arc(particle.x, particle.y, particle.size, 0, Math.PI * 2);
    ctx.fill();

    // Add sparkle effect for celebration phase
    if (phase === 'complete' && Math.random() < 0.1) {
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(particle.x - particle.size * 2, particle.y);
      ctx.lineTo(particle.x + particle.size * 2, particle.y);
      ctx.moveTo(particle.x, particle.y - particle.size * 2);
      ctx.lineTo(particle.x, particle.y + particle.size * 2);
      ctx.stroke();
    }
  };

  const drawConnections = (
    ctx: CanvasRenderingContext2D,
    particles: Particle[]
  ) => {
    if (phase !== 'processing' && phase !== 'creating') return;

    const maxDistance = 100;

    for (let i = 0; i < particles.length; i++) {
      for (let j = i + 1; j < particles.length; j++) {
        const dx = particles[i].x - particles[j].x;
        const dy = particles[i].y - particles[j].y;
        const distance = Math.sqrt(dx * dx + dy * dy);

        if (distance < maxDistance) {
          const alpha = (1 - distance / maxDistance) * 0.2;
          ctx.strokeStyle = `rgba(59, 130, 246, ${alpha})`;
          ctx.lineWidth = alpha * 10;
          ctx.beginPath();
          ctx.moveTo(particles[i].x, particles[i].y);
          ctx.lineTo(particles[j].x, particles[j].y);
          ctx.stroke();

          // Add data flow effect
          if (Math.random() < 0.05) {
            const midX = (particles[i].x + particles[j].x) / 2;
            const midY = (particles[i].y + particles[j].y) / 2;

            ctx.fillStyle = 'rgba(96, 165, 250, 0.5)';
            ctx.beginPath();
            ctx.arc(midX, midY, 2, 0, Math.PI * 2);
            ctx.fill();
          }
        }
      }
    }
  };

  const animate = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Clear canvas with fade effect
    ctx.fillStyle = 'rgba(12, 10, 29, 0.1)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Update and filter particles
    particlesRef.current = particlesRef.current.filter(particle =>
      updateParticle(particle, canvas)
    );

    // Add new particles if needed
    while (particlesRef.current.length < count) {
      particlesRef.current.push(createParticle(canvas));
    }

    // Draw connections first (behind particles)
    drawConnections(ctx, particlesRef.current);

    // Draw particles
    particlesRef.current.forEach(particle => {
      drawParticle(ctx, particle);
    });

    animationRef.current = requestAnimationFrame(animate);
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const resizeCanvas = () => {
      const rect = canvas.getBoundingClientRect();
      canvas.width = rect.width * window.devicePixelRatio;
      canvas.height = rect.height * window.devicePixelRatio;

      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.scale(window.devicePixelRatio, window.devicePixelRatio);
      }
    };

    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);

    // Initialize particles
    particlesRef.current = [];
    for (let i = 0; i < count; i++) {
      particlesRef.current.push(createParticle(canvas));
    }

    // Start animation
    animate();

    return () => {
      window.removeEventListener('resize', resizeCanvas);
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [count, phase]);

  if (!isVisible) return null;

  return (
    <canvas
      ref={canvasRef}
      className={`absolute inset-0 pointer-events-none ${className}`}
      style={{
        width: '100%',
        height: '100%',
        background: 'transparent',
      }}
    />
  );
}
