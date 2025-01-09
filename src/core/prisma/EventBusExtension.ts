import { PrismaClient } from '@prisma/client';

// Custom EventBus extension for Prisma
export function createPrismaEventBusExtension() {
  const listeners: Map<string, Function[]> = new Map();

  return {
    name: 'prisma-event-bus',
    model: {
      $on: (event: string, handler: Function) => {
        if (!listeners.has(event)) {
          listeners.set(event, []);
        }
        listeners.get(event)?.push(handler);
      },
      $emit: (event: string, data: any) => {
        const eventListeners = listeners.get(event) || [];
        eventListeners.forEach(listener => listener(data));
      }
    }
  };
}

// Extend PrismaClient with EventBus functionality
export function extendPrismaClientWithEventBus(prisma: PrismaClient) {
  const eventBusExtension = createPrismaEventBusExtension();
  
  return prisma.$extends({
    model: {
      ...eventBusExtension.model
    }
  });
}

// Type-safe event bus interface
export interface PrismaEventBus {
  $on(event: string, handler: Function): void;
  $emit(event: string, data: any): void;
}