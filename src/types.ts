export interface LostItem {
  id: string;
  title: string;
  description: string;
  category: string;
  location: string;
  date: string;
  type: 'lost' | 'found';
  imageUrl?: string;
  reporterId: string;
  reporterName: string;
  reporterEmail?: string;
  reporterPhoto?: string;
  status: 'active' | 'resolved';
  createdAt: number;
}

export interface UserProfile {
  displayName: string;
  email?: string;
  photoURL: string;
  xp: number;
  helpfulReturns: number;
}

export type Category = 'electronics' | 'clothing' | 'books' | 'keys' | 'wallets' | 'other';
