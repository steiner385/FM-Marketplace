type MarketplaceErrorCode = 
  | 'VALIDATION_ERROR'
  | 'UNAUTHORIZED'
  | 'FORBIDDEN'
  | 'NOT_FOUND'
  | 'LISTING_NOT_FOUND'
  | 'OFFER_NOT_FOUND'
  | 'MESSAGE_NOT_FOUND'
  | 'USER_NOT_FOUND'
  | 'INVALID_STATUS'
  | 'INVALID_CONDITION'
  | 'INVALID_PRICE'
  | 'INVALID_OFFER'
  | 'LISTING_UNAVAILABLE'
  | 'OFFER_CONFLICT'
  | 'SELF_OFFER'
  | 'INTERNAL_ERROR';

interface MarketplaceErrorParams {
  code: MarketplaceErrorCode;
  message: string;
  entity?: string;
  details?: unknown;
}

export class MarketplaceError extends Error {
  readonly code: MarketplaceErrorCode;
  readonly entity: string;
  readonly details?: unknown;
  readonly statusCode: number;

  constructor({ code, message, entity = 'MARKETPLACE', details }: MarketplaceErrorParams) {
    super(message);
    this.name = 'MarketplaceError';
    this.code = code;
    this.entity = entity;
    this.details = details;

    // Map error codes to HTTP status codes
    this.statusCode = {
      'VALIDATION_ERROR': 400,
      'UNAUTHORIZED': 401,
      'FORBIDDEN': 403,
      'NOT_FOUND': 404,
      'LISTING_NOT_FOUND': 404,
      'OFFER_NOT_FOUND': 404,
      'MESSAGE_NOT_FOUND': 404,
      'USER_NOT_FOUND': 404,
      'INVALID_STATUS': 400,
      'INVALID_CONDITION': 400,
      'INVALID_PRICE': 400,
      'INVALID_OFFER': 400,
      'LISTING_UNAVAILABLE': 400,
      'OFFER_CONFLICT': 409,
      'SELF_OFFER': 400,
      'INTERNAL_ERROR': 500
    }[code];

    // Capture stack trace
    Error.captureStackTrace(this, MarketplaceError);
  }

  toJSON() {
    return {
      name: this.name,
      code: this.code,
      message: this.message,
      entity: this.entity,
      details: this.details,
      statusCode: this.statusCode
    };
  }
}
