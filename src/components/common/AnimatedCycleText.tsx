import { useEffect, useRef } from 'react';

const AnimatedCycleText = () => {
  const words = ['Dream', 'Train', 'Play'];
  const textHeight = 69;
  const containerWidth = 195;
  const animationValue = useRef(0);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let animationFrameId: number;
    let timeoutId: number;

    const runAnimation = () => {
      interface AnimationStep {
        toValue: number;
        duration: number;
        delay: number;
      }
      
      const sequence: AnimationStep[] = [];
      
      for (let i = 1; i < words.length; i++) {
        sequence.push({
          toValue: -textHeight * i,
          duration: 800,
          delay: 1000,
        });
      }
      sequence.push({
        toValue: 0,
        duration: 300,
        delay: 1000,
      });

      let currentStep = 0;

      const animate = () => {
        if (currentStep >= sequence.length) {
          currentStep = 0;
          timeoutId = window.setTimeout(() => animate(), 0);
          return;
        }

        const step = sequence[currentStep];
        const startValue = animationValue.current;
        const startTime = Date.now();

        const update = () => {
          const elapsed = Date.now() - startTime;
          const progress = Math.min(elapsed / step.duration, 1);

          const eased = progress < 0.5
            ? 4 * progress * progress * progress
            : 1 - Math.pow(-2 * progress + 2, 3) / 2;

          animationValue.current = startValue + (step.toValue - startValue) * eased;

          if (containerRef.current) {
            containerRef.current.style.transform = `translateY(${animationValue.current}px)`;
          }

          if (progress < 1) {
            animationFrameId = requestAnimationFrame(update);
          } else {
            timeoutId = window.setTimeout(() => {
              currentStep++;
              animate();
            }, step.delay);
          }
        };

        update();
      };

      animate();
    };

    runAnimation();

    return () => {
      if (animationFrameId) cancelAnimationFrame(animationFrameId);
      if (timeoutId) clearTimeout(timeoutId);
    };
  }, [words.length]);

  return (
    <div className="flex items-center" style={{ height: `${textHeight}px`, overflow: 'hidden' }}>
      <div
        style={{
          width: `${containerWidth}px`,
          height: `${textHeight}px`,
          overflow: 'hidden',
          marginLeft: '-12px',
        }}
      >
        <div ref={containerRef} style={{ willChange: 'transform' }}>
          {words.map((word, i) => (
            <div
              key={i}
              style={{
                color: 'white',
                fontSize: '54px',
                fontWeight: 'bold',
                height: `${textHeight}px`,
                lineHeight: `${textHeight}px`,
                textAlign: 'right',
                width: `${containerWidth}px`,
              }}
            >
              {word}
            </div>
          ))}
        </div>
      </div>
      <div
        style={{
          color: 'white',
          fontSize: '54px',
          fontWeight: 'bold',
          marginLeft: '9px',
        }}
      >
        Like a Pro
      </div>
    </div>
  );
};

export default AnimatedCycleText;
