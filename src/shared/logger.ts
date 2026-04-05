// ─── Structured Logger ─────────────────────────────────────────────────────

type LogLevel = 'debug' | 'info' | 'warn' | 'error';
type LogSource = 'background' | 'content' | 'sidepanel' | 'popup' | 'options';

interface LogEntry {
  timestamp: number;
  level: LogLevel;
  source: LogSource;
  action: string;
  data?: unknown;
}

const LOG_COLORS: Record<LogLevel, string> = {
  debug: '#8B8B8B',
  info: '#4FC3F7',
  warn: '#FFB74D',
  error: '#EF5350',
};

const SOURCE_BADGES: Record<LogSource, string> = {
  background: '⚙️ BG',
  content: '📄 CS',
  sidepanel: '🎨 SP',
  popup: '💬 PU',
  options: '⚙️ OP',
};

class Logger {
  private source: LogSource;
  private isDev: boolean;

  constructor(source: LogSource) {
    this.source = source;
    this.isDev = typeof process !== 'undefined'
      ? process.env.NODE_ENV !== 'production'
      : true;
  }

  debug(action: string, data?: unknown) {
    this.log('debug', action, data);
  }

  info(action: string, data?: unknown) {
    this.log('info', action, data);
  }

  warn(action: string, data?: unknown) {
    this.log('warn', action, data);
  }

  error(action: string, data?: unknown) {
    this.log('error', action, data);
  }

  private log(level: LogLevel, action: string, data?: unknown) {
    const entry: LogEntry = {
      timestamp: Date.now(),
      level,
      source: this.source,
      action,
      data,
    };

    if (this.isDev) {
      const badge = SOURCE_BADGES[this.source];
      const color = LOG_COLORS[level];
      const time = new Date(entry.timestamp).toLocaleTimeString();

      if (data !== undefined) {
        console.log(
          `%c[${time}] ${badge} %c${action}`,
          `color: ${color}; font-weight: bold`,
          'color: inherit',
          data
        );
      } else {
        console.log(
          `%c[${time}] ${badge} %c${action}`,
          `color: ${color}; font-weight: bold`,
          'color: inherit'
        );
      }
    }
  }
}

export function createLogger(source: LogSource): Logger {
  return new Logger(source);
}
