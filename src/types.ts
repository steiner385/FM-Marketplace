export enum ListingCondition {
  NEW = 'NEW',
  LIKE_NEW = 'LIKE_NEW',
  GOOD = 'GOOD',
  FAIR = 'FAIR'
}

export enum ListingStatus {
  DRAFT = 'DRAFT',
  PENDING_APPROVAL = 'PENDING_APPROVAL',
  AVAILABLE = 'AVAILABLE',
  PENDING_PAYMENT = 'PENDING_PAYMENT',
  SOLD = 'SOLD',
  CANCELLED = 'CANCELLED'
}

export enum OfferStatus {
  PENDING = 'PENDING',
  ACCEPTED = 'ACCEPTED',
  REJECTED = 'REJECTED',
  CANCELLED = 'CANCELLED'
}

export interface MarketplaceListing {
  id: string;
  title: string;
  description: string;
  price: number;
  sellerId: string;
  condition: ListingCondition;
  images: string[];
  tags: string[];
  status: ListingStatus;
  createdAt: Date;
  updatedAt: Date;
  seller?: {
    id: string;
    name: string;
  };
  offers?: ListingOffer[];
  messages?: ListingMessage[];
}

export interface ListingOffer {
  id: string;
  listingId: string;
  buyerId: string;
  amount: number;
  status: OfferStatus;
  message?: string;
  createdAt: Date;
  updatedAt: Date;
  listing?: MarketplaceListing;
  buyer?: {
    id: string;
    name: string;
  };
}

export interface ListingMessage {
  id: string;
  listingId: string;
  senderId: string;
  content: string;
  createdAt: Date;
  listing?: MarketplaceListing;
  sender?: {
    id: string;
    name: string;
  };
}

export interface CreateListingInput {
  title: string;
  description: string;
  price: number;
  condition: ListingCondition;
  images: string[];
  tags?: string[];
}

export interface UpdateListingInput {
  title?: string;
  description?: string;
  price?: number;
  condition?: ListingCondition;
  images?: string[];
  tags?: string[];
  status?: ListingStatus;
}

export interface CreateOfferInput {
  amount: number;
  message?: string;
}

export interface UpdateOfferInput {
  amount?: number;
  message?: string;
  status?: OfferStatus;
}

export interface CreateMessageInput {
  content: string;
}

export interface ListingFilters {
  condition?: ListingCondition;
  minPrice?: number;
  maxPrice?: number;
  status?: ListingStatus;
  tags?: string[];
  sellerId?: string;
}

export interface OfferFilters {
  status?: OfferStatus;
  minAmount?: number;
  maxAmount?: number;
  buyerId?: string;
  listingId?: string;
}

export interface ListingWithDetails extends MarketplaceListing {
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

export interface OfferWithDetails extends ListingOffer {
  listing: MarketplaceListing;
  buyer: {
    id: string;
    name: string;
  };
}
