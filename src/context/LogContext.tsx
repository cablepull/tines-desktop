/* eslint-disable @typescript-eslint/no-explicit-any */
import { createContext, useContext, useState, useCallback } from 'react';
import type { ReactNode } from 'react';

export type LogLevel = 'INFO' | 'ERROR' | 'NETWORK' | 'SUCCESS' | 'WARNING';

export interface LogEntry {
  id: string;
  timestamp: Date;
  level: LogLevel;
  message: string;
  details?: any;
}

interface LogContextType {
  logs: LogEntry[];
  addLog: (level: LogLevel, message: string, details?: any) => void;
  clearLogs: () => void;
  isConsoleOpen: boolean;
  setConsoleOpen: (open: boolean) => void;
}

const LogContext = createContext<LogContextType | undefined>(undefined);

export function LogProvider({ children }: { children: ReactNode }) {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [isConsoleOpen, setConsoleOpen] = useState(false);

  const addLog = useCallback((level: LogLevel, message: string, details?: any) => {
    const entry: LogEntry = {
      id: Math.random().toString(36).substring(2, 9),
      timestamp: new Date(),
      level,
      message,
      details,
    };
    setLogs((prev) => [...prev, entry]);
    console.log(`[${level}] ${message}`, details || '');
  }, []);

  const clearLogs = useCallback(() => setLogs([]), []);

  return (
    <LogContext.Provider value={{ logs, addLog, clearLogs, isConsoleOpen, setConsoleOpen }}>
      {children}
    </LogContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export function useLogger() {
  const context = useContext(LogContext);
  if (context === undefined) {
    throw new Error('useLogger must be used within a LogProvider');
  }
  return context;
}
