import { BasePlugin } from '../../sdk/core/BasePlugin';
import { PluginConfig, PluginHealthCheck } from '../../sdk/core/types';
import { Event } from '../../sdk/events/types';
import { z } from 'zod';
import { prisma } from './prisma/client';
import { MarketplaceController } from './controllers/MarketplaceController';
import { Context } from 'hono';
import { RouteDefinition } from '../../sdk/core/routes';
import { ListingStatus, OfferStatus } from './types';

/**
 * Plugin configuration schema
 */
const configSchema = z.object({
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

type MarketplacePluginConfig = z.infer<typeof configSchema>;

/**
 * Marketplace plugin implementation
 */
export class MarketplacePlugin extends BasePlugin {
  private marketplaceController: MarketplaceController;
  private metricsInterval?: NodeJS.Timeout;
  private metrics = {
    totalListings: 0,
    activeListings: 0,
    totalOffers: 0,
    acceptedOffers: 0
  };

  constructor() {
    const config: PluginConfig = {
      metadata: {
        name: 'marketplace-plugin',
        version: '1.0.0',
        description: 'Marketplace management plugin',
        author: 'FamilyManager',
        license: 'MIT'
      },
      config: configSchema,
      events: {
        subscriptions: ['payment.completed'],
        publications: [
          'marketplace.listing.created',
          'marketplace.listing.updated',
          'marketplace.listing.deleted',
          'marketplace.listing.approved',
          'marketplace.offer.created',
          'marketplace.offer.accepted',
          'marketplace.offer.rejected',
          'marketplace.message.created'
        ]
      }
    };

    super(config);

    // Initialize controller
    this.marketplaceController = new MarketplaceController(prisma);

    // Add routes
    this.config.routes = this.getRoutes();
  }

  /**
   * Initialize plugin
   */
  async onInit(): Promise<void> {
    this.logger.info('Initializing marketplace plugin');
    await this.updateMetrics();
  }

  /**
   * Start plugin
   */
  async onStart(): Promise<void> {
    this.logger.info('Starting marketplace plugin');
    this.metricsInterval = setInterval(() => this.updateMetrics(), 60000);
  }

  /**
   * Stop plugin
   */
  async onStop(): Promise<void> {
    this.logger.info('Stopping marketplace plugin');
    if (this.metricsInterval) {
      clearInterval(this.metricsInterval);
    }
  }

  /**
   * Handle events
   */
  protected async handleEvent(event: Event): Promise<void> {
    switch (event.type) {
      case 'payment.completed':
        await this.marketplaceController.handlePaymentCompleted(event.data);
        break;
    }
  }

  /**
   * Define plugin routes
   */
  private getRoutes(): RouteDefinition[] {
    const config = this.context.config as MarketplacePluginConfig;
    const routes: RouteDefinition[] = [
      // Listing routes
      {
        path: '/api/marketplace/listings',
        method: 'GET' as const,
        handler: this.marketplaceController.getListings.bind(this.marketplaceController),
        description: 'Get all marketplace listings'
      },
      {
        path: '/api/marketplace/listings',
        method: 'POST' as const,
        handler: async (c: Context) => {
          const user = c.get('user');
          if (!config.roles.canCreateListings.includes(user.role)) {
            return c.json({
              success: false,
              error: {
                code: 'FORBIDDEN',
                message: 'User not authorized to create listings'
              }
            }, 403);
          }
          return this.marketplaceController.createListing(c);
        },
        description: 'Create a new marketplace listing'
      },
      {
        path: '/api/marketplace/listings/:id',
        method: 'GET' as const,
        handler: this.marketplaceController.getListingById.bind(this.marketplaceController),
        description: 'Get a marketplace listing by ID'
      },
      {
        path: '/api/marketplace/listings/:id',
        method: 'PUT' as const,
        handler: this.marketplaceController.updateListing.bind(this.marketplaceController),
        description: 'Update a marketplace listing'
      },
      {
        path: '/api/marketplace/listings/:id',
        method: 'DELETE' as const,
        handler: async (c: Context) => {
          const user = c.get('user');
          if (!config.roles.canDeleteListings.includes(user.role)) {
            return c.json({
              success: false,
              error: {
                code: 'FORBIDDEN',
                message: 'User not authorized to delete listings'
              }
            }, 403);
          }
          return this.marketplaceController.deleteListing(c);
        },
        description: 'Delete a marketplace listing'
      },

      // Offer routes
      {
        path: '/api/marketplace/listings/:listingId/offers',
        method: 'POST' as const,
        handler: async (c: Context) => {
          const user = c.get('user');
          if (!config.roles.canMakeOffers.includes(user.role)) {
            return c.json({
              success: false,
              error: {
                code: 'FORBIDDEN',
                message: 'User not authorized to make offers'
              }
            }, 403);
          }
          return this.marketplaceController.createOffer(c);
        },
        description: 'Create an offer on a listing'
      },
      {
        path: '/api/marketplace/offers/:id',
        method: 'PUT' as const,
        handler: this.marketplaceController.updateOffer.bind(this.marketplaceController),
        description: 'Update an offer'
      },

      // Message routes
      {
        path: '/api/marketplace/listings/:listingId/messages',
        method: 'POST' as const,
        handler: this.marketplaceController.createMessage.bind(this.marketplaceController),
        description: 'Create a message on a listing'
      }
    ];

    // Add approval route if auto-approval is disabled
    if (!config.features.autoApproval) {
      routes.push({
        path: '/api/marketplace/listings/:id/approve',
        method: 'POST' as const,
        handler: async (c: Context) => {
          const user = c.get('user');
          if (!config.roles.canApproveListings.includes(user.role)) {
            return c.json({
              success: false,
              error: {
                code: 'FORBIDDEN',
                message: 'User not authorized to approve listings'
              }
            }, 403);
          }
          await this.marketplaceController.handleListingApproved({ listingId: c.req.param('id') });
          return c.json({ success: true });
        },
        description: 'Approve a marketplace listing'
      });
    }

    return routes;
  }

  /**
   * Update metrics
   */
  private async updateMetrics(): Promise<void> {
    try {
      const [totalListings, activeListings, totalOffers, acceptedOffers] = await Promise.all([
        prisma.countListings(),
        prisma.countListings({ status: ListingStatus.AVAILABLE }),
        prisma.countOffers(),
        prisma.countOffers({ status: OfferStatus.ACCEPTED })
      ]);

      this.metrics = {
        totalListings,
        activeListings,
        totalOffers,
        acceptedOffers
      };
    } catch (error) {
      this.logger.error('Error updating metrics', error as Error);
    }
  }

  /**
   * Get plugin health status
   */
  async getHealth(): Promise<PluginHealthCheck> {
    try {
      // Test database connection
      await prisma.$queryRaw`SELECT 1`;

      return {
        status: 'healthy',
        timestamp: Date.now(),
        message: 'Plugin is healthy',
        metrics: this.metrics
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        timestamp: Date.now(),
        error,
        message: 'Database connection failed'
      };
    }
  }
}
