import { z } from 'zod';

// Logger Interface with Explicit Methods
export interface Logger {
  info(message: string, meta?: any): void;
  error(message: string, error?: any): void;
  warn(message: string, meta?: any): void;
}

// Plugin Configuration
export interface PluginConfig {
  metadata: {
    name: string;
    version: string;
    description: string;
    author: string;
    license: string;
  };
  config: z.ZodObject<any>;
  events: {
    subscriptions: string[];
    publications: string[];
  };
}

// Plugin Context
export interface PluginContext {
  app: any;
  eventBus: {
    emit(event: string, data: any): void;
  };
  config?: any;
  logger?: Logger;
}

// Base Plugin Abstract Class with Explicit Logger
export abstract class BasePlugin {
  protected logger: Logger;

  constructor(config: PluginConfig) {
    // Default no-op logger implementation
    this.logger = {
      info: (message: string, meta?: any) => {
        console.info(`[${config.metadata.name}] ${message}`, meta);
      },
      error: (message: string, error?: any) => {
        console.error(`[${config.metadata.name}] ${message}`, error);
      },
      warn: (message: string, meta?: any) => {
        console.warn(`[${config.metadata.name}] ${message}`, meta);
      }
    };
  }

  // Abstract methods to be implemented by subclasses
  abstract init(context: PluginContext): Promise<void>;
  abstract getHealth(): Promise<any>;
  abstract onStart(): Promise<void>;
  abstract onStop(): Promise<void>;

  // Method to update logger from context
  protected setLogger(logger: Logger): void {
    this.logger = logger;
  }
}

// Utility Types
export type Optional<T> = T | null | undefined;
export type Nullable<T> = T | null;