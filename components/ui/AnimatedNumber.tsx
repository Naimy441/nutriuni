import React, { useEffect, useRef, useState } from 'react';
import { AppText, AppTextProps } from './AppText';

interface AnimatedNumberProps extends Omit<AppTextProps, 'children'> {
  value: number;
  duration?: number;
  format?: (value: number) => string;
  from?: number; // count up from here on first render
}

const defaultFormat = (n: number) => Math.round(n).toLocaleString();

// Counts smoothly from the previous value to the new one.
export function AnimatedNumber({ value, duration = 700, format = defaultFormat, from: initial, ...rest }: AnimatedNumberProps) {
  const [display, setDisplay] = useState(initial ?? value);
  const from = useRef(initial ?? value);
  const frame = useRef<number | null>(null);
  useEffect(() => {
    const start = from.current;
    const delta = value - start;
    if (!delta) return;
    const began = Date.now();
    const tick = () => {
      const t = Math.min(1, (Date.now() - began) / duration);
      const eased = 1 - Math.pow(1 - t, 3);
      const current = start + delta * eased;
      setDisplay(current);
      from.current = current;
      if (t < 1) frame.current = requestAnimationFrame(tick);
    };
    frame.current = requestAnimationFrame(tick);
    return () => {
      if (frame.current) cancelAnimationFrame(frame.current);
    };
  }, [value, duration]);
  return (
    <AppText numeric {...rest}>
      {format(display)}
    </AppText>
  );
}
