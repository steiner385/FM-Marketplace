import { z } from 'zod';
import { PrismaClient } from '@prisma/client';
import { BasePlugin, PluginConfig, PluginContext } from './types/sdk';
import { MarketplaceController } from './controllers/MarketplaceController';
import { MarketplaceConfigSchema, MarketplaceConfig, ListingStatus, OfferStatus } from './types';
import { Context } from 'hono';
import { RouteDefinition } from './types/routes';

export class MarketplacePlugin extends BasePlugin {
  private marketplaceController: MarketplaceController;
  private prisma: PrismaClient;
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
      config: MarketplaceConfigSchema,
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
    this.prisma = new PrismaClient();
    this.marketplaceController = new MarketplaceController(this.prisma);
  }

  async init(context: PluginContext): Promise<void> {
    try {
      // Validate configuration
      const validatedConfig = MarketplaceConfigSchema.parse(
        context.config || {}
      ) as MarketplaceConfig;

      // Register routes
      this.registerRoutes(context, validatedConfig);

      // Start metrics tracking
      this.startMetricsTracking();

      this.logger.info('Marketplace plugin initialized', {
        config: validatedConfig
      });
    } catch (error) {
      this.logger.error('Failed to initialize Marketplace plugin', error);
      throw error;
    }
  }

  private registerRoutes(context: PluginContext, config: MarketplaceConfig): void {
    const routes: RouteDefinition[] = [
      // Listing routes
      {
        path: '/api/marketplace/listings',
        method: 'GET',
        handler: this.marketplaceController.getListings.bind(this.marketplaceController),
        description: 'Get all marketplace listings'
      },
      {
        path: '/api/marketplace/listings',
        method: 'POST',
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
      // Additional routes for listing, offers, and messages
    ];

    // Add routes to the application
    routes.forEach(route => {
      switch (route.method) {
        case 'GET':
          context.app.get(route.path, route.handler);
          break;
        case 'POST':
          context.app.post(route.path, route.handler);
          break;
        // Add other HTTP methods as needed
      }
    });
  }

  private startMetricsTracking(): void {
    // Start periodic metrics update
    this.metricsInterval = setInterval(
      () => this.updateMetrics(), 
      60000 // Update every minute
    );
  }

  private async updateMetrics(): Promise<void> {
    try {
      const [totalListings, activeListings, totalOffers, acceptedOffers] = await Promise.all([
        this.prisma.listing.count(),
        this.prisma.listing.count({ 
          where: { status: ListingStatus.AVAILABLE } 
        }),
        this.prisma.offer.count(),
        this.prisma.offer.count({ 
          where: { status: OfferStatus.ACCEPTED } 
        })
      ]);

      this.metrics = {
        totalListings,
        activeListings,
        totalOffers,
        acceptedOffers
      };

      this.logger.info('Marketplace metrics updated', this.metrics);
    } catch (error) {
      this.logger.error('Failed to update marketplace metrics', error);
    }
  }

  protected async handleEvent(event: any): Promise<void> {
    switch (event.type) {
      case 'payment.completed':
        await this.marketplaceController.handlePaymentCompleted(event.data);
        break;
      default:
        this.logger.warn(`Unhandled event type: ${event.type}`);
    }
  }

  async getHealth(): Promise<any> {
    try {
      // Test database connection
      await this.prisma.$queryRaw`SELECT 1`;

      return {
        status: 'healthy',
        timestamp: Date.now(),
        message: 'Marketplace plugin is healthy',
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

  async onStart(): Promise<void> {
    this.logger.info('Starting Marketplace plugin');
    this.startMetricsTracking();
  }

  async onStop(): Promise<void> {
    this.logger.info('Stopping Marketplace plugin');
    if (this.metricsInterval) {
      clearInterval(this.metricsInterval);
    }
    await this.prisma.$disconnect();
  }
}