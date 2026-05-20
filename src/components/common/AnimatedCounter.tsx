import React, { useEffect, useState } from 'react';

interface AnimatedCounterProps {
  isVisible: boolean;
  endValue: number;
  label: string;
  suffix?: string;
  numberClassName?: string;
  labelClassName?: string;
  containerClassName?: string;
  numberStyle?: React.CSSProperties;
}

const AnimatedCounter = ({
  isVisible,
  endValue,
  label,
  suffix = '',
  numberClassName,
  labelClassName,
  containerClassName,
  numberStyle,
}: AnimatedCounterProps) => {
  const [displayValue, setDisplayValue] = useState(1);
  const [hasAnimated, setHasAnimated] = useState(false);

  useEffect(() => {
    if (isVisible && !hasAnimated) {
      setHasAnimated(true);
      const duration = 2200;
      const startTime = Date.now();
      const startValue = 1;

      const animate = () => {
        const currentTime = Date.now();
        const elapsed = currentTime - startTime;
        const progress = Math.min(elapsed / duration, 1);
        const easeOutCubic = 1 - Math.pow(1 - progress, 3);
        const currentValue = Math.ceil(startValue + (endValue - startValue) * easeOutCubic);
        setDisplayValue(Math.min(currentValue, endValue));
        if (progress < 1) requestAnimationFrame(animate);
      };

      requestAnimationFrame(animate);
    }
  }, [isVisible, hasAnimated, endValue]);

  return (
    <div className={containerClassName ?? 'text-center px-1'}>
      <div
        className={numberClassName ?? 'text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-bold text-white mb-2 md:mb-4 leading-none'}
        style={numberStyle}
      >
        {displayValue}{suffix}
      </div>
      {label ? (
        <div className={labelClassName ?? 'text-white text-xs sm:text-sm md:text-base whitespace-pre-line leading-snug'}>
          {label}
        </div>
      ) : null}
    </div>
  );
};

export default AnimatedCounter;
