import { Context } from 'hono';

export interface RouteDefinition {
  path: string;
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
  handler: (c: Context) => Promise<Response>;
  description: string;
}

export type HttpMethod = RouteDefinition['method'];

export interface RouteHandler {
  (context: Context): Promise<Response>;
}

export interface RouteConfig {
  basePrefix?: string;
  middleware?: Array<(c: Context, next: () => Promise<void>) => Promise<void>>;
}

export function createRouteDefinition(
  path: string, 
  method: HttpMethod, 
  handler: RouteHandler, 
  description: string
): RouteDefinition {
  return { path, method, handler, description };
}