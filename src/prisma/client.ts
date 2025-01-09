import { PrismaClient, Prisma } from '@prisma/client';
import { ListingCondition, ListingStatus, OfferStatus, MarketplaceListing, ListingOffer, ListingMessage } from '../types';

interface ListingResult extends MarketplaceListing {
  seller: {
    id: string;
    name: string;
  };
  offers: (ListingOffer & {
    buyer: {
      id: string;
      name: string;
    };
  })[];
  messages: (ListingMessage & {
    sender: {
      id: string;
      name: string;
    };
  })[];
}

interface CountResult {
  count: string | number;
}

export class CustomPrismaClient extends PrismaClient {
  constructor() {
    super({
      log: ['query', 'info', 'warn', 'error']
    });
  }

  async findListingById(id: string, includeDetails = true): Promise<ListingResult | null> {
    const result = await this.$queryRaw<ListingResult[]>`
      SELECT 
        l.*,
        json_object(
          'id', s.id,
          'name', s.name
        ) as seller,
        json_group_array(DISTINCT json_object(
          'id', o.id,
          'listingId', o.listingId,
          'buyerId', o.buyerId,
          'amount', o.amount,
          'status', o.status,
          'message', o.message,
          'createdAt', o.createdAt,
          'updatedAt', o.updatedAt,
          'buyer', json_object(
            'id', b.id,
            'name', b.name
          )
        )) as offers,
        json_group_array(DISTINCT json_object(
          'id', m.id,
          'listingId', m.listingId,
          'senderId', m.senderId,
          'content', m.content,
          'createdAt', m.createdAt,
          'sender', json_object(
            'id', ms.id,
            'name', ms.name
          )
        )) as messages
      FROM "MarketplaceListing" l
      LEFT JOIN "User" s ON l.sellerId = s.id
      LEFT JOIN "ListingOffer" o ON l.id = o.listingId
      LEFT JOIN "User" b ON o.buyerId = b.id
      LEFT JOIN "ListingMessage" m ON l.id = m.listingId
      LEFT JOIN "User" ms ON m.senderId = ms.id
      WHERE l.id = ${id}
      GROUP BY l.id
      LIMIT 1
    `;

    if (!result[0]) return null;

    const listing = result[0];
    if (includeDetails) {
      listing.offers = JSON.parse(listing.offers as unknown as string)
        .filter((o: any) => o.id !== null);
      listing.messages = JSON.parse(listing.messages as unknown as string)
        .filter((m: any) => m.id !== null);
    }

    return listing;
  }

  async findListings(where?: {
    sellerId?: string;
    condition?: ListingCondition;
    status?: ListingStatus;
    minPrice?: number;
    maxPrice?: number;
    tags?: string[];
  }): Promise<ListingResult[]> {
    const conditions: Prisma.Sql[] = [];

    if (where?.sellerId) {
      conditions.push(Prisma.sql`l.sellerId = ${where.sellerId}`);
    }
    if (where?.condition) {
      conditions.push(Prisma.sql`l.condition = ${where.condition}`);
    }
    if (where?.status) {
      conditions.push(Prisma.sql`l.status = ${where.status}`);
    }
    if (where?.minPrice) {
      conditions.push(Prisma.sql`l.price >= ${where.minPrice}`);
    }
    if (where?.maxPrice) {
      conditions.push(Prisma.sql`l.price <= ${where.maxPrice}`);
    }
    if (where?.tags?.length) {
      conditions.push(Prisma.sql`l.tags && ${where.tags}`);
    }

    const whereClause = conditions.length > 0
      ? Prisma.sql`WHERE ${Prisma.join(conditions, ' AND ')}`
      : Prisma.empty;

    const result = await this.$queryRaw<ListingResult[]>`
      SELECT 
        l.*,
        json_object(
          'id', s.id,
          'name', s.name
        ) as seller,
        json_group_array(DISTINCT json_object(
          'id', o.id,
          'listingId', o.listingId,
          'buyerId', o.buyerId,
          'amount', o.amount,
          'status', o.status,
          'message', o.message,
          'createdAt', o.createdAt,
          'updatedAt', o.updatedAt,
          'buyer', json_object(
            'id', b.id,
            'name', b.name
          )
        )) as offers,
        json_group_array(DISTINCT json_object(
          'id', m.id,
          'listingId', m.listingId,
          'senderId', m.senderId,
          'content', m.content,
          'createdAt', m.createdAt,
          'sender', json_object(
            'id', ms.id,
            'name', ms.name
          )
        )) as messages
      FROM "MarketplaceListing" l
      LEFT JOIN "User" s ON l.sellerId = s.id
      LEFT JOIN "ListingOffer" o ON l.id = o.listingId
      LEFT JOIN "User" b ON o.buyerId = b.id
      LEFT JOIN "ListingMessage" m ON l.id = m.listingId
      LEFT JOIN "User" ms ON m.senderId = ms.id
      ${whereClause}
      GROUP BY l.id
    `;

    return result.map(listing => ({
      ...listing,
      offers: JSON.parse(listing.offers as unknown as string)
        .filter((o: any) => o.id !== null),
      messages: JSON.parse(listing.messages as unknown as string)
        .filter((m: any) => m.id !== null)
    }));
  }

  async createListing(data: {
    title: string;
    description: string;
    price: number;
    sellerId: string;
    condition: ListingCondition;
    images: string[];
    tags?: string[];
  }): Promise<ListingResult> {
    const result = await this.$queryRaw<ListingResult[]>`
      INSERT INTO "MarketplaceListing" (
        id,
        title,
        description,
        price,
        sellerId,
        condition,
        images,
        tags,
        status,
        createdAt,
        updatedAt
      ) VALUES (
        uuid_generate_v4(),
        ${data.title},
        ${data.description},
        ${data.price},
        ${data.sellerId},
        ${data.condition},
        ${data.images},
        ${data.tags || []},
        ${ListingStatus.PENDING_APPROVAL},
        CURRENT_TIMESTAMP,
        CURRENT_TIMESTAMP
      )
      RETURNING *
    `;

    if (!result[0]) {
      throw new Error('Failed to create listing');
    }

    return this.findListingById(result[0].id) as Promise<ListingResult>;
  }

  async updateListing(id: string, data: Partial<{
    title: string;
    description: string;
    price: number;
    condition: ListingCondition;
    images: string[];
    tags: string[];
    status: ListingStatus;
  }>): Promise<ListingResult> {
    const setClauses: Prisma.Sql[] = [];
    Object.entries(data).forEach(([key, value]) => {
      if (value !== undefined) {
        if (key === 'images' || key === 'tags') {
          setClauses.push(Prisma.sql`"${Prisma.raw(key)}" = ${value as string[]}`);
        } else {
          setClauses.push(Prisma.sql`"${Prisma.raw(key)}" = ${value}`);
        }
      }
    });

    if (setClauses.length > 0) {
      await this.$queryRaw`
        UPDATE "MarketplaceListing"
        SET ${Prisma.join(setClauses, ', ')}, "updatedAt" = CURRENT_TIMESTAMP
        WHERE id = ${id}
      `;
    }

    const listing = await this.findListingById(id);
    if (!listing) {
      throw new Error('Failed to update listing');
    }
    return listing;
  }

  async deleteListing(id: string): Promise<MarketplaceListing> {
    const result = await this.$queryRaw<MarketplaceListing[]>`
      DELETE FROM "MarketplaceListing"
      WHERE id = ${id}
      RETURNING *
    `;

    if (!result[0]) {
      throw new Error('Listing not found');
    }

    return result[0];
  }

  async createOffer(data: {
    listingId: string;
    buyerId: string;
    amount: number;
    message?: string;
  }): Promise<ListingOffer> {
    const result = await this.$queryRaw<ListingOffer[]>`
      INSERT INTO "ListingOffer" (
        id,
        listingId,
        buyerId,
        amount,
        status,
        message,
        createdAt,
        updatedAt
      ) VALUES (
        uuid_generate_v4(),
        ${data.listingId},
        ${data.buyerId},
        ${data.amount},
        ${OfferStatus.PENDING},
        ${data.message || null},
        CURRENT_TIMESTAMP,
        CURRENT_TIMESTAMP
      )
      RETURNING *
    `;

    if (!result[0]) {
      throw new Error('Failed to create offer');
    }

    return result[0];
  }

  async updateOffer(id: string, data: Partial<{
    amount: number;
    status: OfferStatus;
    message: string;
  }>): Promise<ListingOffer> {
    const setClauses: Prisma.Sql[] = [];
    Object.entries(data).forEach(([key, value]) => {
      if (value !== undefined) {
        setClauses.push(Prisma.sql`"${Prisma.raw(key)}" = ${value}`);
      }
    });

    const result = await this.$queryRaw<ListingOffer[]>`
      UPDATE "ListingOffer"
      SET ${Prisma.join(setClauses, ', ')}, "updatedAt" = CURRENT_TIMESTAMP
      WHERE id = ${id}
      RETURNING *
    `;

    if (!result[0]) {
      throw new Error('Failed to update offer');
    }

    return result[0];
  }

  async createMessage(data: {
    listingId: string;
    senderId: string;
    content: string;
  }): Promise<ListingMessage> {
    const result = await this.$queryRaw<ListingMessage[]>`
      INSERT INTO "ListingMessage" (
        id,
        listingId,
        senderId,
        content,
        createdAt
      ) VALUES (
        uuid_generate_v4(),
        ${data.listingId},
        ${data.senderId},
        ${data.content},
        CURRENT_TIMESTAMP
      )
      RETURNING *
    `;

    if (!result[0]) {
      throw new Error('Failed to create message');
    }

    return result[0];
  }

  async countListings(where?: {
    sellerId?: string;
    condition?: ListingCondition;
    status?: ListingStatus;
    minPrice?: number;
    maxPrice?: number;
  }): Promise<number> {
    const conditions: Prisma.Sql[] = [];

    if (where?.sellerId) {
      conditions.push(Prisma.sql`sellerId = ${where.sellerId}`);
    }
    if (where?.condition) {
      conditions.push(Prisma.sql`condition = ${where.condition}`);
    }
    if (where?.status) {
      conditions.push(Prisma.sql`status = ${where.status}`);
    }
    if (where?.minPrice) {
      conditions.push(Prisma.sql`price >= ${where.minPrice}`);
    }
    if (where?.maxPrice) {
      conditions.push(Prisma.sql`price <= ${where.maxPrice}`);
    }

    const whereClause = conditions.length > 0
      ? Prisma.sql`WHERE ${Prisma.join(conditions, ' AND ')}`
      : Prisma.empty;

    const [result] = await this.$queryRaw<[CountResult]>`
      SELECT COUNT(*) as count 
      FROM "MarketplaceListing"
      ${whereClause}
    `;

    return Number(result.count);
  }

  async countOffers(where?: {
    listingId?: string;
    buyerId?: string;
    status?: OfferStatus;
    minAmount?: number;
    maxAmount?: number;
  }): Promise<number> {
    const conditions: Prisma.Sql[] = [];

    if (where?.listingId) {
      conditions.push(Prisma.sql`listingId = ${where.listingId}`);
    }
    if (where?.buyerId) {
      conditions.push(Prisma.sql`buyerId = ${where.buyerId}`);
    }
    if (where?.status) {
      conditions.push(Prisma.sql`status = ${where.status}`);
    }
    if (where?.minAmount) {
      conditions.push(Prisma.sql`amount >= ${where.minAmount}`);
    }
    if (where?.maxAmount) {
      conditions.push(Prisma.sql`amount <= ${where.maxAmount}`);
    }

    const whereClause = conditions.length > 0
      ? Prisma.sql`WHERE ${Prisma.join(conditions, ' AND ')}`
      : Prisma.empty;

    const [result] = await this.$queryRaw<[CountResult]>`
      SELECT COUNT(*) as count 
      FROM "ListingOffer"
      ${whereClause}
    `;

    return Number(result.count);
  }
}

export const prisma = new CustomPrismaClient();
