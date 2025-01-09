import { Context } from 'hono';
import { MarketplaceError } from '../errors/MarketplaceError';

type StatusCode = 200 | 201 | 400 | 401 | 403 | 404 | 409 | 500;

type JSONValue =
  | string
  | number
  | boolean
  | null
  | { [x: string]: JSONValue }
  | Array<JSONValue>;

const serializeDate = (date: Date): string => date.toISOString();

const serializeData = (data: any): JSONValue => {
  if (data === null || data === undefined) {
    return null;
  }

  if (Array.isArray(data)) {
    return data.map(serializeData);
  }

  if (data instanceof Date) {
    return serializeDate(data);
  }

  if (typeof data === 'object') {
    const result: { [key: string]: JSONValue } = {};
    for (const [key, value] of Object.entries(data)) {
      result[key] = serializeData(value);
    }
    return result;
  }

  return data;
};

export const errorResponse = (c: Context, error: unknown) => {
  if (error instanceof MarketplaceError) {
    return c.json({ 
      success: false,
      error: { 
        code: error.code, 
        message: error.message,
        entity: error.entity,
        details: error.details
      }
    }, error.code === 'VALIDATION_ERROR' ? 400 : 
       error.code === 'UNAUTHORIZED' ? 401 :
       error.code === 'FORBIDDEN' ? 403 :
       error.code === 'NOT_FOUND' ? 404 :
       error.code === 'OFFER_CONFLICT' ? 409 : 500 as StatusCode);
  }

  if (error instanceof Error && 'name' in error && error.name === 'ZodError' && 'errors' in error) {
    const zodError = error as any;
    return c.json({ 
      success: false,
      error: { 
        code: 'VALIDATION_ERROR',
        message: zodError.errors[0]?.message || 'Validation error',
        details: zodError.errors,
        entity: 'MARKETPLACE'
      }
    }, 400 as StatusCode);
  }

  const message = error instanceof Error ? error.message : 'Internal server error';
  return c.json({ 
    success: false,
    error: { 
      code: 'INTERNAL_ERROR',
      message,
      entity: 'MARKETPLACE'
    }
  }, 500 as StatusCode);
};

export const successResponse = (c: Context, data: unknown, status: StatusCode = 200) => {
  return c.json({
    success: true,
    data: serializeData(data)
  }, status);
};
