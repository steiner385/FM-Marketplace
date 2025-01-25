# FM-Marketplace Plugin

## Overview
FM-Marketplace is a modular marketplace management plugin for the FamilyManager ecosystem, providing robust listing, offer, and transaction capabilities.

## Features
- Create and manage marketplace listings
- Support for multiple listing statuses
- Offer creation and management
- Role-based access control
- Event-driven architecture
- Comprehensive error handling

## Installation
```bash
npm install fm-marketplace-plugin
```

## Configuration
```typescript
import { MarketplacePlugin } from 'fm-marketplace-plugin';
import { PrismaClient } from '@prisma/client';
import { EventBus } from 'your-event-bus';

const prisma = new PrismaClient();
const eventBus = new EventBus();

const marketplacePlugin = new MarketplacePlugin();
await marketplacePlugin.init({ 
  app, 
  prisma, 
  eventBus,
  config: {
    features: {
      autoApproval: false,
      messaging: true,
      offers: true
    },
    roles: {
      canCreateListings: ['PARENT', 'CHILD'],
      canDeleteListings: ['PARENT'],
      canApproveListings: ['PARENT']
    },
    limits: {
      maxListingsPerUser: 50,
      maxImagesPerListing: 10
    }
  }
});
```

## API Endpoints
- `POST /api/marketplace/listings`: Create a new listing
- `GET /api/marketplace/listings`: Retrieve listings
- `GET /api/marketplace/listings/:id`: Get specific listing
- `POST /api/marketplace/listings/:listingId/offers`: Create an offer
- `GET /api/marketplace/offers`: Retrieve offers

## Event Types
- `marketplace.listing.created`
- `marketplace.listing.updated`
- `marketplace.listing.deleted`
- `marketplace.offer.created`
- `marketplace.offer.accepted`

## Dependencies
- Prisma
- Hono
- Zod
- EventBus

## Contributing
1. Fork the repository
2. Create a feature branch
3. Commit your changes
4. Push to the branch
5. Create a Pull Request

Please read [PLUGIN_EXTRACTION_STRATEGY.md](PLUGIN_EXTRACTION_STRATEGY.md) for our plugin extraction principles.

## Performance and Monitoring
- Comprehensive health checks
- Metrics tracking
- Configurable limits and features

## License
MIT License

## Contact
For support or questions, please open an issue in the repository.