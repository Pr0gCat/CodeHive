'use client';

import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence, useInView, useAnimation } from 'framer-motion';

// 淡入動畫組件
export function FadeIn({ 
  children, 
  delay = 0, 
  duration = 0.5, 
  direction = 'up',
  className = ''
}: {
  children: React.ReactNode;
  delay?: number;
  duration?: number;
  direction?: 'up' | 'down' | 'left' | 'right';
  className?: string;
}) {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true });
  
  const directionOffset = {
    up: { y: 20 },
    down: { y: -20 },
    left: { x: 20 },
    right: { x: -20 }
  };

  return (
    <motion.div
      ref={ref}
      className={className}
      initial={{ 
        opacity: 0, 
        ...directionOffset[direction]
      }}
      animate={isInView ? { 
        opacity: 1, 
        x: 0, 
        y: 0 
      } : {}}
      transition={{ 
        duration, 
        delay,
        ease: "easeOut"
      }}
    >
      {children}
    </motion.div>
  );
}

// 滑入動畫組件
export function SlideIn({ 
  children, 
  delay = 0, 
  direction = 'left',
  className = ''
}: {
  children: React.ReactNode;
  delay?: number;
  direction?: 'left' | 'right' | 'up' | 'down';
  className?: string;
}) {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true });

  const directionVariants = {
    left: { x: -100 },
    right: { x: 100 },
    up: { y: -100 },
    down: { y: 100 }
  };

  return (
    <motion.div
      ref={ref}
      className={className}
      initial={{ 
        opacity: 0, 
        ...directionVariants[direction]
      }}
      animate={isInView ? { 
        opacity: 1, 
        x: 0, 
        y: 0 
      } : {}}
      transition={{ 
        type: "spring",
        stiffness: 100,
        damping: 20,
        delay 
      }}
    >
      {children}
    </motion.div>
  );
}

// 彈跳動畫組件
export function Bounce({ 
  children, 
  delay = 0,
  className = '' 
}: {
  children: React.ReactNode;
  delay?: number;
  className?: string;
}) {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true });

  return (
    <motion.div
      ref={ref}
      className={className}
      initial={{ scale: 0, opacity: 0 }}
      animate={isInView ? { scale: 1, opacity: 1 } : {}}
      transition={{
        type: "spring",
        stiffness: 300,
        damping: 20,
        delay
      }}
    >
      {children}
    </motion.div>
  );
}

// 計數動畫組件
export function CountUp({ 
  from = 0, 
  to, 
  duration = 2, 
  delay = 0,
  className = '',
  suffix = ''
}: {
  from?: number;
  to: number;
  duration?: number;
  delay?: number;
  className?: string;
  suffix?: string;
}) {
  const [count, setCount] = useState(from);
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true });

  useEffect(() => {
    if (!isInView) return;

    const timeout = setTimeout(() => {
      const startTime = Date.now();
      const startValue = from;
      const endValue = to;
      const change = endValue - startValue;

      const animate = () => {
        const now = Date.now();
        const elapsed = now - startTime;
        const progress = Math.min(elapsed / (duration * 1000), 1);
        
        const easeOutQuart = 1 - Math.pow(1 - progress, 4);
        const currentValue = startValue + (change * easeOutQuart);
        
        setCount(Math.floor(currentValue));

        if (progress < 1) {
          requestAnimationFrame(animate);
        } else {
          setCount(endValue);
        }
      };

      requestAnimationFrame(animate);
    }, delay * 1000);

    return () => clearTimeout(timeout);
  }, [isInView, from, to, duration, delay]);

  return (
    <span ref={ref} className={className}>
      {count.toLocaleString()}{suffix}
    </span>
  );
}

// 進度條動畫組件
export function AnimatedProgress({ 
  value, 
  delay = 0,
  duration = 1,
  className = ''
}: {
  value: number;
  delay?: number;
  duration?: number;
  className?: string;
}) {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true });

  return (
    <div ref={ref} className={`relative h-2 bg-gray-200 rounded-full overflow-hidden ${className}`}>
      <motion.div
        className="absolute top-0 left-0 h-full bg-blue-500 rounded-full"
        initial={{ width: 0 }}
        animate={isInView ? { width: `${value}%` } : { width: 0 }}
        transition={{ 
          duration, 
          delay,
          ease: "easeOut"
        }}
      />
    </div>
  );
}

// 旋轉加載動畫
export function LoadingSpinner({ 
  size = 6, 
  color = 'blue-500',
  className = ''
}: {
  size?: number;
  color?: string;
  className?: string;
}) {
  return (
    <motion.div
      className={`w-${size} h-${size} border-2 border-gray-200 border-t-${color} rounded-full ${className}`}
      animate={{ rotate: 360 }}
      transition={{
        duration: 1,
        repeat: Infinity,
        ease: "linear"
      }}
    />
  );
}

// 脈衝動畫組件
export function Pulse({ 
  children,
  className = ''
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <motion.div
      className={className}
      animate={{ 
        scale: [1, 1.05, 1],
        opacity: [1, 0.8, 1]
      }}
      transition={{
        duration: 2,
        repeat: Infinity,
        ease: "easeInOut"
      }}
    >
      {children}
    </motion.div>
  );
}

// 懸停放大動畫
export function HoverScale({ 
  children, 
  scale = 1.05,
  className = ''
}: {
  children: React.ReactNode;
  scale?: number;
  className?: string;
}) {
  return (
    <motion.div
      className={className}
      whileHover={{ scale }}
      whileTap={{ scale: 0.95 }}
      transition={{ type: "spring", stiffness: 300, damping: 20 }}
    >
      {children}
    </motion.div>
  );
}

// 展開動畫組件
export function Expand({ 
  isOpen, 
  children,
  className = ''
}: {
  isOpen: boolean;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          className={className}
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: "auto", opacity: 1 }}
          exit={{ height: 0, opacity: 0 }}
          transition={{ duration: 0.3, ease: "easeInOut" }}
          style={{ overflow: "hidden" }}
        >
          {children}
        </motion.div>
      )}
    </AnimatePresence>
  );
}

// 淡入淡出列表動畫
export function AnimatedList({ 
  items, 
  renderItem,
  className = '',
  itemClassName = ''
}: {
  items: any[];
  renderItem: (item: any, index: number) => React.ReactNode;
  className?: string;
  itemClassName?: string;
}) {
  return (
    <div className={className}>
      <AnimatePresence>
        {items.map((item, index) => (
          <motion.div
            key={item.id || index}
            className={itemClassName}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ 
              duration: 0.3,
              delay: index * 0.1,
              ease: "easeOut"
            }}
          >
            {renderItem(item, index)}
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}

// 打字機效果動畫
export function TypeWriter({ 
  text, 
  delay = 0, 
  speed = 50,
  className = ''
}: {
  text: string;
  delay?: number;
  speed?: number;
  className?: string;
}) {
  const [displayText, setDisplayText] = useState('');
  const [isComplete, setIsComplete] = useState(false);

  useEffect(() => {
    const timeout = setTimeout(() => {
      let i = 0;
      const timer = setInterval(() => {
        if (i < text.length) {
          setDisplayText(text.slice(0, i + 1));
          i++;
        } else {
          clearInterval(timer);
          setIsComplete(true);
        }
      }, speed);

      return () => clearInterval(timer);
    }, delay);

    return () => clearTimeout(timeout);
  }, [text, delay, speed]);

  return (
    <span className={className}>
      {displayText}
      {!isComplete && (
        <motion.span
          animate={{ opacity: [1, 0] }}
          transition={{ duration: 0.5, repeat: Infinity }}
          className="ml-1"
        >
          |
        </motion.span>
      )}
    </span>
  );
}

// 波紋效果動畫
export function Ripple({ 
  children,
  className = ''
}: {
  children: React.ReactNode;
  className?: string;
}) {
  const [ripples, setRipples] = useState<Array<{ id: number; x: number; y: number }>>([]);

  const addRipple = (event: React.MouseEvent) => {
    const rect = event.currentTarget.getBoundingClientRect();
    const size = Math.max(rect.width, rect.height);
    const x = event.clientX - rect.left - size / 2;
    const y = event.clientY - rect.top - size / 2;
    
    const newRipple = {
      id: Date.now(),
      x,
      y
    };

    setRipples(prev => [...prev, newRipple]);
    
    setTimeout(() => {
      setRipples(prev => prev.filter(ripple => ripple.id !== newRipple.id));
    }, 600);
  };

  return (
    <div 
      className={`relative overflow-hidden ${className}`}
      onMouseDown={addRipple}
    >
      {children}
      {ripples.map(ripple => (
        <motion.span
          key={ripple.id}
          className="absolute rounded-full bg-white/30 pointer-events-none"
          style={{
            left: ripple.x,
            top: ripple.y,
            width: 0,
            height: 0,
          }}
          initial={{ width: 0, height: 0 }}
          animate={{ width: 200, height: 200 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.6, ease: "easeOut" }}
        />
      ))}
    </div>
  );
}

// 頁面轉場動畫
export function PageTransition({ 
  children, 
  className = '' 
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <motion.div
      className={className}
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      transition={{ duration: 0.3, ease: "easeInOut" }}
    >
      {children}
    </motion.div>
  );
}

// 卡片懸停動畫
export function AnimatedCard({ 
  children, 
  className = '',
  hoverEffect = true
}: {
  children: React.ReactNode;
  className?: string;
  hoverEffect?: boolean;
}) {
  return (
    <motion.div
      className={`bg-white rounded-lg shadow-sm border ${className}`}
      whileHover={hoverEffect ? { 
        y: -5, 
        boxShadow: "0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)"
      } : {}}
      transition={{ type: "spring", stiffness: 300, damping: 20 }}
    >
      {children}
    </motion.div>
  );
}

// 通知彈出動畫
export function NotificationPopup({ 
  show, 
  children,
  position = 'top-right',
  className = ''
}: {
  show: boolean;
  children: React.ReactNode;
  position?: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';
  className?: string;
}) {
  const positions = {
    'top-left': 'top-4 left-4',
    'top-right': 'top-4 right-4',
    'bottom-left': 'bottom-4 left-4',
    'bottom-right': 'bottom-4 right-4'
  };

  return (
    <AnimatePresence>
      {show && (
        <motion.div
          className={`fixed z-50 ${positions[position]} ${className}`}
          initial={{ opacity: 0, scale: 0.8, y: -20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.8, y: -20 }}
          transition={{ type: "spring", stiffness: 300, damping: 20 }}
        >
          {children}
        </motion.div>
      )}
    </AnimatePresence>
  );
}

// 骨架屏動畫
export function SkeletonLoader({ 
  lines = 3, 
  className = '' 
}: {
  lines?: number;
  className?: string;
}) {
  return (
    <div className={`animate-pulse ${className}`}>
      {Array.from({ length: lines }, (_, i) => (
        <div
          key={i}
          className={`bg-gray-200 rounded h-4 mb-2 ${
            i === lines - 1 ? 'w-3/4' : 'w-full'
          }`}
        />
      ))}
    </div>
  );
}

// 粒子效果動畫（簡化版）
export function ParticleEffect({ 
  count = 20,
  className = ''
}: {
  count?: number;
  className?: string;
}) {
  const particles = Array.from({ length: count }, (_, i) => i);

  return (
    <div className={`relative overflow-hidden ${className}`}>
      {particles.map(i => (
        <motion.div
          key={i}
          className="absolute w-1 h-1 bg-blue-400 rounded-full opacity-60"
          initial={{
            x: Math.random() * 300,
            y: Math.random() * 200,
            scale: 0
          }}
          animate={{
            x: Math.random() * 300,
            y: Math.random() * 200,
            scale: [0, 1, 0]
          }}
          transition={{
            duration: Math.random() * 3 + 2,
            repeat: Infinity,
            ease: "easeInOut",
            delay: Math.random() * 2
          }}
        />
      ))}
    </div>
  );
}

export {
  motion,
  AnimatePresence
};