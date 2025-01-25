import { z } from 'zod';
import { Prisma, $Enums } from '@prisma/client';

// Listing Status Enum
export enum ListingStatus {
  DRAFT = 'DRAFT',
  AVAILABLE = 'AVAILABLE',
  PENDING_APPROVAL = 'PENDING_APPROVAL',
  SOLD = 'SOLD',
  EXPIRED = 'EXPIRED'
}

// Offer Status Enum
export enum OfferStatus {
  PENDING = 'PENDING',
  ACCEPTED = 'ACCEPTED',
  REJECTED = 'REJECTED',
  COUNTERED = 'COUNTERED'
}

// Configuration Schema
export const MarketplaceConfigSchema = z.object({
  features: z.object({
    autoApproval: z.boolean().default(false),
    messaging: z.boolean().default(true),
    offers: z.boolean().default(true)
  }),
  roles: z.object({
    canCreateListings: z.array(z.string()).default(['PARENT', 'CHILD']),
    canDeleteListings: z.array(z.string()).default(['PARENT']),
    canApproveListings: z.array(z.string()).default(['PARENT']),
    canMakeOffers: z.array(z.string()).default(['PARENT', 'CHILD'])
  }),
  limits: z.object({
    maxListingsPerUser: z.number().min(1).default(50),
    maxImagesPerListing: z.number().min(1).default(10),
    maxOffersPerListing: z.number().min(1).default(20),
    maxMessagesPerListing: z.number().min(1).default(100)
  })
});

// Derived Types
export type MarketplaceConfig = z.infer<typeof MarketplaceConfigSchema>;

// Type Guards and Utility Functions
export function isValidListingStatus(status: unknown): status is ListingStatus {
  return typeof status === 'string' && 
         Object.values(ListingStatus).includes(status as ListingStatus);
}

export function isValidOfferStatus(status: unknown): status is OfferStatus {
  return typeof status === 'string' && 
         Object.values(OfferStatus).includes(status as OfferStatus);
}

export function convertListingStatusForPrisma(
  status: unknown
): Prisma.EnumListingStatusFilter<"Listing"> | undefined {
  if (status === undefined || status === null) return undefined;
  
  // Validate and convert the status
  if (!isValidListingStatus(status)) {
    throw new Error(`Invalid ListingStatus: ${String(status)}`);
  }
  
  // Use Prisma's native enum type conversion
  return {
    equals: status as $Enums.ListingStatus
  };
}

// Interfaces for Domain Models
export interface Listing {
  id: string;
  title: string;
  description: string;
  price: number;
  status: ListingStatus;
  userId: string;
  familyId: string;
  createdAt: Date;
  updatedAt: Date;
  images?: string[];
}

export interface Offer {
  id: string;
  listingId: string;
  userId: string;
  price: number;
  status: OfferStatus;
  message?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface ListingMessage {
  id: string;
  listingId: string;
  userId: string;
  message: string;
  createdAt: Date;
}

// Event Types
export type MarketplaceEventType = 
  | 'marketplace.listing.created'
  | 'marketplace.listing.updated'
  | 'marketplace.listing.deleted'
  | 'marketplace.listing.approved'
  | 'marketplace.offer.created'
  | 'marketplace.offer.accepted'
  | 'marketplace.offer.rejected'
  | 'marketplace.message.created';

// Utility Types
export type Optional<T> = T | null | undefined;
export type Nullable<T> = T | null;