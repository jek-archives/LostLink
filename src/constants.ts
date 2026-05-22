export const CATEGORIES = [
  { id: 'electronics', label: 'Electronics', icon: 'Laptop' },
  { id: 'clothing', label: 'Clothing', icon: 'Shirt' },
  { id: 'books', label: 'Books', icon: 'Book' },
  { id: 'keys', label: 'Keys', icon: 'Key' },
  { id: 'wallets', label: 'Wallets', icon: 'Wallet' },
  { id: 'other', label: 'Other', icon: 'MoreHorizontal' },
];

export const LOCATIONS = [
  'S&T Building',
  'ICT Building',
  'Engineering Building',
  'Science Complex',
  'Gymnasium',
  'Library',
  'Food Court',
  'CEA Building',
  'Student Center',
  'Other',
];

export const CAMPUS_COORDINATES: Record<string, { lat: number; lng: number }> = {
  'S&T Building': { lat: 8.4855, lng: 124.6568 },
  'ICT Building': { lat: 8.4850, lng: 124.6572 },
  'Engineering Building': { lat: 8.4845, lng: 124.6560 },
  'Science Complex': { lat: 8.4858, lng: 124.6560 },
  'Gymnasium': { lat: 8.4840, lng: 124.6570 },
  'Library': { lat: 8.4852, lng: 124.6565 },
  'Food Court': { lat: 8.4848, lng: 124.6568 },
  'CEA Building': { lat: 8.4842, lng: 124.6558 },
  'Student Center': { lat: 8.4853, lng: 124.6575 },
  'Other': { lat: 8.4851, lng: 124.6565 },
};

