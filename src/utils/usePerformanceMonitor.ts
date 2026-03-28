import { useCallback, useRef } from 'react';

export interface PerformanceMetrics {
  name: string;
  duration: number;
  startTime: number;
}

export const usePerformanceMonitor = (componentName: string) => {
  const marks = useRef<Record<string, number>>({});

  const startMeasure = useCallback((measureName: string) => {
    const markName = `${componentName}:${measureName}:start`;
    performance.mark(markName);
    marks.current[measureName] = performance.now();
  }, [componentName]);

  const endMeasure = useCallback((measureName: string) => {
    const startMark = `${componentName}:${measureName}:start`;
    const endMark = `${componentName}:${measureName}:end`;
    const measureLabel = `${componentName} [${measureName}]`;

    performance.mark(endMark);
    try {
      performance.measure(measureLabel, startMark, endMark);
      const entries = performance.getEntriesByName(measureLabel);
      const lastEntry = entries[entries.length - 1];
      
      return {
        name: measureName,
        duration: lastEntry.duration,
        startTime: lastEntry.startTime
      };
    } catch (e) {
      // Mark might be missing
      return null;
    }
  }, [componentName]);

  return { startMeasure, endMeasure };
};
