import { Context } from 'hono';
import { CustomPrismaClient } from '../prisma/client';
import { MarketplaceError } from '../errors/MarketplaceError';
import { CreateListingInput, UpdateListingInput, CreateOfferInput, UpdateOfferInput, CreateMessageInput, ListingStatus, OfferStatus, ListingCondition } from '../types';
import { errorResponse, successResponse } from '../utils/response';
import { z } from 'zod';

interface UserContext {
  id: string;
  role: string;
  familyId: string;
}

interface RequestContext extends Context {
  get(key: 'user'): UserContext;
}

const listingSchema = z.object({
  title: z.string().min(1),
  description: z.string().min(1),
  price: z.number().min(0),
  condition: z.nativeEnum(ListingCondition),
  images: z.array(z.string()).min(1),
  tags: z.array(z.string()).optional()
});

const offerSchema = z.object({
  amount: z.number().min(0),
  message: z.string().optional()
});

const messageSchema = z.object({
  content: z.string().min(1)
});

export class MarketplaceController {
  constructor(private readonly prisma: CustomPrismaClient) {}

  async getListings(c: RequestContext): Promise<Response> {
    try {
      const user = c.get('user');
      const { condition, minPrice, maxPrice, status } = c.req.query();

      const listings = await this.prisma.findListings({
        condition: condition as any,
        minPrice: minPrice ? Number(minPrice) : undefined,
        maxPrice: maxPrice ? Number(maxPrice) : undefined,
        status: status as any
      });

      return successResponse(c, listings);
    } catch (error) {
      console.error('Get listings error:', error);
      return errorResponse(c, error);
    }
  }

  async getListingById(c: RequestContext): Promise<Response> {
    try {
      const { id } = c.req.param();

      const listing = await this.prisma.findListingById(id);
      if (!listing) {
        throw new MarketplaceError({
          code: 'LISTING_NOT_FOUND',
          message: 'Listing not found'
        });
      }

      return successResponse(c, listing);
    } catch (error) {
      console.error('Get listing error:', error);
      return errorResponse(c, error);
    }
  }

  async createListing(c: RequestContext): Promise<Response> {
    try {
      const user = c.get('user');
      const data = await c.req.json() as CreateListingInput;

      // Validate listing data
      const validatedData = listingSchema.parse(data) as CreateListingInput;

      // Create listing
      const listing = await this.prisma.createListing({
        ...validatedData,
        sellerId: user.id
      });

      return successResponse(c, listing, 201);
    } catch (error) {
      console.error('Create listing error:', error);
      return errorResponse(c, error);
    }
  }

  async updateListing(c: RequestContext): Promise<Response> {
    try {
      const user = c.get('user');
      const { id } = c.req.param();
      const data = await c.req.json() as UpdateListingInput;

      // Verify listing exists and user has access
      const existingListing = await this.prisma.findListingById(id);
      if (!existingListing) {
        throw new MarketplaceError({
          code: 'LISTING_NOT_FOUND',
          message: 'Listing not found'
        });
      }

      if (existingListing.sellerId !== user.id) {
        throw new MarketplaceError({
          code: 'FORBIDDEN',
          message: 'You do not have permission to update this listing'
        });
      }

      // Validate listing data
      const validatedData = listingSchema.partial().parse(data) as UpdateListingInput;

      // Update listing
      const updatedListing = await this.prisma.updateListing(id, validatedData);
      return successResponse(c, updatedListing);
    } catch (error) {
      console.error('Update listing error:', error);
      return errorResponse(c, error);
    }
  }

  async deleteListing(c: RequestContext): Promise<Response> {
    try {
      const user = c.get('user');
      const { id } = c.req.param();

      // Verify listing exists and user has access
      const listing = await this.prisma.findListingById(id);
      if (!listing) {
        throw new MarketplaceError({
          code: 'LISTING_NOT_FOUND',
          message: 'Listing not found'
        });
      }

      if (listing.sellerId !== user.id) {
        throw new MarketplaceError({
          code: 'FORBIDDEN',
          message: 'You do not have permission to delete this listing'
        });
      }

      await this.prisma.deleteListing(id);
      return successResponse(c, { message: 'Listing deleted successfully' });
    } catch (error) {
      console.error('Delete listing error:', error);
      return errorResponse(c, error);
    }
  }

  async createOffer(c: RequestContext): Promise<Response> {
    try {
      const user = c.get('user');
      const { listingId } = c.req.param();
      const data = await c.req.json() as CreateOfferInput;

      // Verify listing exists and is available
      const listing = await this.prisma.findListingById(listingId);
      if (!listing) {
        throw new MarketplaceError({
          code: 'LISTING_NOT_FOUND',
          message: 'Listing not found'
        });
      }

      if (listing.status !== ListingStatus.AVAILABLE) {
        throw new MarketplaceError({
          code: 'LISTING_UNAVAILABLE',
          message: 'Listing is not available for offers'
        });
      }

      if (listing.sellerId === user.id) {
        throw new MarketplaceError({
          code: 'SELF_OFFER',
          message: 'You cannot make an offer on your own listing'
        });
      }

      // Validate offer data
      const validatedData = offerSchema.parse(data);

      // Create offer
      const offer = await this.prisma.createOffer({
        ...validatedData,
        listingId,
        buyerId: user.id
      });

      return successResponse(c, offer, 201);
    } catch (error) {
      console.error('Create offer error:', error);
      return errorResponse(c, error);
    }
  }

  async updateOffer(c: RequestContext): Promise<Response> {
    try {
      const user = c.get('user');
      const { id } = c.req.param();
      const data = await c.req.json() as UpdateOfferInput;

      // Verify offer exists
      const listing = await this.prisma.findListingById(id);
      if (!listing) {
        throw new MarketplaceError({
          code: 'LISTING_NOT_FOUND',
          message: 'Listing not found'
        });
      }

      // Only seller can accept/reject offers
      if (data.status && listing.sellerId !== user.id) {
        throw new MarketplaceError({
          code: 'FORBIDDEN',
          message: 'Only the seller can accept or reject offers'
        });
      }

      // Only buyer can update amount/message
      if ((data.amount || data.message) && listing.sellerId === user.id) {
        throw new MarketplaceError({
          code: 'FORBIDDEN',
          message: 'Only the buyer can update offer details'
        });
      }

      // Validate offer data
      const validatedData = offerSchema.partial().parse(data);

      // Update offer
      const updatedOffer = await this.prisma.updateOffer(id, validatedData);

      // If offer was accepted, update listing status
      if (data.status === OfferStatus.ACCEPTED) {
        await this.prisma.updateListing(listing.id, {
          status: ListingStatus.PENDING_PAYMENT
        });
      }

      return successResponse(c, updatedOffer);
    } catch (error) {
      console.error('Update offer error:', error);
      return errorResponse(c, error);
    }
  }

  async createMessage(c: RequestContext): Promise<Response> {
    try {
      const user = c.get('user');
      const { listingId } = c.req.param();
      const data = await c.req.json() as CreateMessageInput;

      // Verify listing exists
      const listing = await this.prisma.findListingById(listingId);
      if (!listing) {
        throw new MarketplaceError({
          code: 'LISTING_NOT_FOUND',
          message: 'Listing not found'
        });
      }

      // Validate message data
      const validatedData = messageSchema.parse(data);

      // Create message
      const message = await this.prisma.createMessage({
        ...validatedData,
        listingId,
        senderId: user.id
      });

      return successResponse(c, message, 201);
    } catch (error) {
      console.error('Create message error:', error);
      return errorResponse(c, error);
    }
  }

  async handleListingApproved(data: { listingId: string }): Promise<void> {
    try {
      await this.prisma.updateListing(data.listingId, {
        status: ListingStatus.AVAILABLE
      });
    } catch (error) {
      console.error('Handle listing approved error:', error);
      throw error;
    }
  }

  async handlePaymentCompleted(data: { listingId: string }): Promise<void> {
    try {
      await this.prisma.updateListing(data.listingId, {
        status: ListingStatus.SOLD
      });
    } catch (error) {
      console.error('Handle payment completed error:', error);
      throw error;
    }
  }
}
