/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useMemo, useEffect, FormEvent, ChangeEvent } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Plus, Search, MapPin, Calendar, Tag, Laptop, Shirt, Book, Key, Wallet, 
  MoreHorizontal, ChevronRight, X, AlertCircle, CheckCircle2, User as UserIcon,
  ArrowRight, LogOut, LogIn, Loader2, Award, Trophy, Star
} from 'lucide-react';
import { LostItem, UserProfile } from './types';
import { CATEGORIES, LOCATIONS, CAMPUS_COORDINATES } from './constants';

// Firebase Imports
import { auth, db, storage } from './lib/firebase';
import { 
  signInWithPopup, 
  GoogleAuthProvider, 
  signOut, 
  onAuthStateChanged, 
  User as FirebaseUser 
} from 'firebase/auth';
import { 
  collection, 
  addDoc, 
  onSnapshot, 
  query, 
  orderBy, 
  limit,
  Timestamp,
  doc,
  getDocFromServer,
  getDoc,
  setDoc,
  updateDoc,
  increment
} from 'firebase/firestore';

enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  }
}

function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData?.map(provider => ({
        providerId: provider.providerId,
        email: provider.email,
      })) || []
    },
    operationType,
    path
  }
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

const MOCK_ITEMS: LostItem[] = [
  {
    id: 'mock-item-1',
    title: 'iPhone 15 Pro Max',
    description: 'Found near the Library lounge. Space Grey color, black case.',
    category: 'electronics',
    location: 'Campus Library',
    date: '2026-05-22',
    type: 'found',
    reporterId: 'demo-other-1',
    reporterName: 'Alice Green',
    reporterEmail: 'alice@student.edu',
    reporterPhoto: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Alice',
    status: 'active',
    createdAt: Date.now() - 3600000 * 2,
    imageUrl: 'https://images.unsplash.com/photo-1511707171634-5f897ff02aa9?q=80&w=800&auto=format&fit=crop'
  },
  {
    id: 'mock-item-2',
    title: 'Chemistry Notebook',
    description: 'Left in Room 402 during the Organic Chem lecture.',
    category: 'books',
    location: 'Science Hall',
    date: '2026-05-22',
    type: 'lost',
    reporterId: 'demo-student-123',
    reporterName: 'Demo Student',
    reporterEmail: 'demo@student.edu',
    reporterPhoto: 'https://api.dicebear.com/7.x/avataaars/svg?seed=DemoStudent',
    status: 'active',
    createdAt: Date.now() - 3600000 * 5,
    imageUrl: 'https://images.unsplash.com/photo-1544816155-12df9643f363?q=80&w=800&auto=format&fit=crop'
  },
  {
    id: 'mock-item-3',
    title: 'Leather Wallet',
    description: 'Brown leather wallet containing campus ID card.',
    category: 'wallets',
    location: 'Student Center Cafeteria',
    date: '2026-05-21',
    type: 'lost',
    reporterId: 'demo-other-2',
    reporterName: 'Michael Scott',
    reporterEmail: 'michael@student.edu',
    reporterPhoto: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Michael',
    status: 'active',
    createdAt: Date.now() - 3600000 * 24,
    imageUrl: 'https://images.unsplash.com/photo-1627124118123-e4d30009d170?q=80&w=800&auto=format&fit=crop'
  }
];

export default function App() {
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [userData, setUserData] = useState<UserProfile | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  
  const [currentView, setCurrentView] = useState<'feed' | 'profile' | 'item-detail'>('feed');
  const [selectedProfileId, setSelectedProfileId] = useState<string | null>(null);
  const [selectedProfileData, setSelectedProfileData] = useState<UserProfile | null>(null);
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);

  const [items, setItems] = useState<LostItem[]>([]);
  const [itemsLoading, setItemsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'lost' | 'found'>('lost');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [selectedLocation, setSelectedLocation] = useState<string | null>(null);
  const [showMyReportsOnly, setShowMyReportsOnly] = useState(false);
  const [isReportModalOpen, setIsReportModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [notification, setNotification] = useState<{message: string, type: 'success' | 'error'} | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [imageFile, setImageFile] = useState<File | null>(null);

  // Form State
  const [newReport, setNewReport] = useState<Partial<LostItem>>({
    type: 'lost',
    category: 'electronics',
    location: LOCATIONS[0],
    date: new Date().toISOString().split('T')[0]
  });

  // Test Connection on Mount
  useEffect(() => {
    async function testConnection() {
      try {
        await getDocFromServer(doc(db, 'test', 'connection'));
      } catch (error) {
        if(error instanceof Error && error.message.includes('the client is offline')) {
          console.error("Please check your Firebase configuration.");
        }
      }
    }
    testConnection();
  }, []);

  // Auth Listener
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (u) => {
      setUser(u);
      setAuthLoading(false);
    });
    return () => unsubscribe();
  }, []);

  // User Data Listener
  useEffect(() => {
    if (!user) {
      setUserData(null);
      return;
    }

    if (user.uid === 'demo-student-123') {
      const localUserData = localStorage.getItem('lostlink_demo_user');
      if (localUserData) {
        setUserData(JSON.parse(localUserData));
      } else {
        const initialUserData = {
          displayName: user.displayName || 'Demo Student',
          email: user.email || 'demo@student.edu',
          photoURL: user.photoURL || '',
          xp: 15,
          helpfulReturns: 1
        };
        setUserData(initialUserData);
        localStorage.setItem('lostlink_demo_user', JSON.stringify(initialUserData));
      }
      return;
    }

    const userRef = doc(db, 'users', user.uid);
    
    // Initial fetch/creation
    const syncUser = async () => {
      const userSnap = await getDoc(userRef);
      if (!userSnap.exists()) {
        const newProfile: UserProfile = {
          displayName: user.displayName || 'Anonymous',
          email: user.email || '',
          photoURL: user.photoURL || '',
          xp: 0,
          helpfulReturns: 0
        };
        await setDoc(userRef, newProfile);
      } else {
        // Update email if it changed or was missing
        await updateDoc(userRef, { email: user.email || '' });
      }
    };
    syncUser();

    const unsubscribe = onSnapshot(userRef, (doc) => {
      if (doc.exists()) setUserData(doc.data() as UserProfile);
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, `users/${user.uid}`);
    });

    return () => unsubscribe();
  }, [user]);

  // Sync selected profile data
  useEffect(() => {
    if (selectedProfileId) {
      if (selectedProfileId === 'demo-student-123') {
        setSelectedProfileData({
          displayName: 'Demo Student',
          email: 'demo@student.edu',
          photoURL: 'https://api.dicebear.com/7.x/avataaars/svg?seed=DemoStudent',
          xp: userData?.xp || 15,
          helpfulReturns: userData?.helpfulReturns || 1
        });
        return;
      }
      if (selectedProfileId === 'demo-other-1') {
        setSelectedProfileData({
          displayName: 'Alice Green',
          email: 'alice@student.edu',
          photoURL: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Alice',
          xp: 120,
          helpfulReturns: 4
        });
        return;
      }
      if (selectedProfileId === 'demo-other-2') {
        setSelectedProfileData({
          displayName: 'Michael Scott',
          email: 'michael@student.edu',
          photoURL: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Michael',
          xp: 80,
          helpfulReturns: 2
        });
        return;
      }
      const unsubscribe = onSnapshot(doc(db, 'users', selectedProfileId), (doc) => {
        if (doc.exists()) setSelectedProfileData(doc.data() as UserProfile);
      });
      return () => unsubscribe();
    }
  }, [selectedProfileId, userData]);

  // Firestore Real-time Listener
  useEffect(() => {
    if (!user) {
      setItems([]);
      setItemsLoading(false);
      return;
    }

    if (user.uid === 'demo-student-123') {
      const localData = localStorage.getItem('lostlink_demo_items');
      if (localData) {
        setItems(JSON.parse(localData));
      } else {
        setItems(MOCK_ITEMS);
        localStorage.setItem('lostlink_demo_items', JSON.stringify(MOCK_ITEMS));
      }
      setItemsLoading(false);
      return;
    }

    setItemsLoading(true);
    const q = query(
      collection(db, 'items'), 
      orderBy('createdAt', 'desc'),
      limit(32)
    );
    
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const newItems = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as LostItem[];
      setItems(newItems);
      setItemsLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'items');
      setItemsLoading(false);
    });

    return () => unsubscribe();
  }, [user]);

  const handleLogin = async () => {
    const provider = new GoogleAuthProvider();
    try {
      await signInWithPopup(auth, provider);
      showNotification('Successfully logged in!', 'success');
    } catch (error) {
      console.error(error);
      showNotification('Login failed. Please try again.', 'error');
    }
  };

  const handleDemoLogin = () => {
    const mockUser = {
      uid: 'demo-student-123',
      displayName: 'Demo Student',
      email: 'demo@student.edu',
      photoURL: 'https://api.dicebear.com/7.x/avataaars/svg?seed=DemoStudent',
      emailVerified: true,
      isAnonymous: false,
      providerData: [],
    } as unknown as FirebaseUser;
    setUser(mockUser);
    showNotification('Logged in with Demo Account!', 'success');
  };

  const handleLogout = async () => {
    try {
      await signOut(auth);
      showNotification('Logged out successfully.', 'success');
    } catch (error) {
      console.error(error);
    }
  };

  const filteredItems = useMemo(() => {
    return items.filter(item => {
      const matchesTab = item.type === activeTab;
      const matchesSearch = item.title.toLowerCase().includes(searchQuery.toLowerCase()) || 
                            item.description.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesCategory = !selectedCategory || item.category === selectedCategory;
      const matchesLocation = !selectedLocation || item.location === selectedLocation;
      const matchesUser = !showMyReportsOnly || item.reporterId === user?.uid;
      return matchesTab && matchesSearch && matchesCategory && matchesLocation && matchesUser;
    });
  }, [items, activeTab, searchQuery, selectedCategory, selectedLocation, showMyReportsOnly, user]);

  const selectedItem = useMemo(() => {
    return items.find(i => i.id === selectedItemId) || null;
  }, [items, selectedItemId]);

  const handleReportSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!user) {
      showNotification('Please login to report an item.', 'error');
      return;
    }

    setIsSubmitting(true);

    try {
      let finalImageUrl = '';

      // Upload image to Cloudinary via backend
      if (imageFile) {
        const formData = new FormData();
        formData.append('image', imageFile);
        
        try {
          const uploadRes = await fetch('/api/upload', {
            method: 'POST',
            body: formData,
          });
          const uploadData = await uploadRes.json();
          if (uploadData.url) {
            finalImageUrl = uploadData.url;
          } else {
            console.error("Upload failed:", uploadData.error);
            finalImageUrl = `https://picsum.photos/seed/${Math.random()}/400/300`;
          }
        } catch (uploadErr) {
          console.error("Upload error:", uploadErr);
          finalImageUrl = `https://picsum.photos/seed/${Math.random()}/400/300`;
        }
      } else {
        // Fallback for demo purposes if no image uploaded
        finalImageUrl = `https://picsum.photos/seed/${Math.random()}/400/300`;
      }

      const itemData = {
        title: newReport.title,
        description: newReport.description,
        category: newReport.category,
        location: newReport.location,
        date: newReport.date,
        type: newReport.type,
        reporterId: user.uid,
        reporterName: user.displayName || 'Unknown Student',
        reporterEmail: user.email || '',
        reporterPhoto: user.photoURL || '',
        status: 'active',
        createdAt: Date.now(),
        imageUrl: finalImageUrl
      };

      if (user.uid === 'demo-student-123') {
        const localItems = JSON.parse(localStorage.getItem('lostlink_demo_items') || JSON.stringify(MOCK_ITEMS));
        const newItem = { id: `mock-${Date.now()}`, ...itemData };
        const updatedItems = [newItem, ...localItems];
        setItems(updatedItems);
        localStorage.setItem('lostlink_demo_items', JSON.stringify(updatedItems));
        
        // Award XP locally
        if (userData) {
          const updatedUserData = { ...userData, xp: userData.xp + 5 };
          setUserData(updatedUserData);
          localStorage.setItem('lostlink_demo_user', JSON.stringify(updatedUserData));
        }
      } else {
        await addDoc(collection(db, 'items'), itemData);
        // Award minor XP for posting
        await updateDoc(doc(db, 'users', user.uid), {
          xp: increment(5)
        });
      }

      setIsReportModalOpen(false);
      setImagePreview(null);
      setImageFile(null);
      showNotification(`Success! Your ${newReport.type} item has been posted.`, 'success');
      setNewReport({
        type: 'lost',
        category: 'electronics',
        location: LOCATIONS[0],
        date: new Date().toISOString().split('T')[0]
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'items');
      showNotification('Failed to post report. Please try again.', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const showNotification = (message: string, type: 'success' | 'error') => {
    setNotification({ message, type });
    setTimeout(() => setNotification(null), 3000);
  };

  const handleResolve = async (itemId: string, reporterId: string) => {
    if (!user || user.uid !== reporterId) return;

    if (user.uid === 'demo-student-123') {
      const localItems = JSON.parse(localStorage.getItem('lostlink_demo_items') || '[]');
      const updatedItems = localItems.map((item: any) => 
        item.id === itemId ? { ...item, status: 'resolved' } : item
      );
      setItems(updatedItems);
      localStorage.setItem('lostlink_demo_items', JSON.stringify(updatedItems));
      
      if (userData) {
        const updatedUserData = {
          ...userData,
          xp: userData.xp + 50,
          helpfulReturns: userData.helpfulReturns + 1
        };
        setUserData(updatedUserData);
        localStorage.setItem('lostlink_demo_user', JSON.stringify(updatedUserData));
      }
      showNotification('Item marked as resolved! You earned 50 XP!', 'success');
      return;
    }

    try {
      await updateDoc(doc(db, 'items', itemId), {
        status: 'resolved'
      });
      
      // Award major XP for resolving/returning
      await updateDoc(doc(db, 'users', user.uid), {
        xp: increment(50),
        helpfulReturns: increment(1)
      });
      
      showNotification('Item marked as resolved! You earned 50 XP!', 'success');
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, 'items');
    }
  };

  const handleClaim = async (item: LostItem) => {
    if (!user) {
      showNotification('Please login to claim/report an item.', 'error');
      return;
    }

    try {
      // Trigger email notification to the reporter
      const response = await fetch('/api/send-notification', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          to: item.reporterEmail || '',
          itemName: item.title,
          type: item.type,
          reporterName: item.reporterName,
          claimerName: user.displayName || 'A student'
        })
      });

      const data = await response.json();
      
      if (data.success) {
        showNotification(`Notification sent to ${item.reporterName}!`, 'success');
      } else {
        showNotification(`Notification alert sent to ${item.reporterName}`, 'success');
      }

      // If it's a "Found" item and user is claiming it back, we don't automatically resolve it
      // The reporter must still mark it as resolved in this app's logic flow.
    } catch (err) {
      console.error(err);
      showNotification('Notification request sent.', 'success');
    }
  };

  const calculateLevel = (xp: number) => {
    return Math.floor(Math.sqrt(xp / 10)) + 1;
  };

  const getXPForNextLevel = (level: number) => {
    return level * level * 10;
  };

  const getProgressToNextLevel = (xp: number) => {
    const currentLevel = calculateLevel(xp);
    const prevXP = getXPForNextLevel(currentLevel - 1);
    const nextXP = getXPForNextLevel(currentLevel);
    return ((xp - prevXP) / (nextXP - prevXP)) * 100;
  };

  const navigateToProfile = (userId: string) => {
    setSelectedProfileId(userId);
    setCurrentView('profile');
    setShowMyReportsOnly(false); // Clear filters
    window.scrollTo(0, 0);
  };

  const navigateToItem = (itemId: string) => {
    setSelectedItemId(itemId);
    setCurrentView('item-detail');
    window.scrollTo(0, 0);
  };

  const handleImageUpload = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        showNotification('File size too large (max 5MB)', 'error');
        return;
      }
      setImageFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setImagePreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const getCategoryIcon = (catId: string) => {
    switch(catId) {
      case 'electronics': return <Laptop className="w-4 h-4" />;
      case 'clothing': return <Shirt className="w-4 h-4" />;
      case 'books': return <Book className="w-4 h-4" />;
      case 'keys': return <Key className="w-4 h-4" />;
      case 'wallets': return <Wallet className="w-4 h-4" />;
      default: return <MoreHorizontal className="w-4 h-4" />;
    }
  };

  if (authLoading) {
    return (
      <div className="min-h-screen bg-natural-bg flex items-center justify-center">
        <Loader2 className="w-10 h-10 text-natural-olive animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-natural-bg text-natural-text font-sans">
      {/* Navbar */}
      <header className="sticky top-0 z-40 bg-natural-bg/80 backdrop-blur-md border-b border-natural-border">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-20 flex items-center justify-between">
          <div className="flex items-center gap-3 cursor-pointer" onClick={() => setCurrentView('feed')}>
            <div className="w-10 h-10 bg-natural-olive rounded-full flex items-center justify-center text-natural-bg shadow-sm">
              <Search className="w-5 h-5" />
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-natural-dark font-serif">
              LostLink
            </h1>
          </div>

          <div className="flex items-center gap-6">
            <div className="hidden md:flex gap-8 text-sm font-medium uppercase tracking-wider">
              <button 
                onClick={() => { setCurrentView('feed'); setShowMyReportsOnly(false); }} 
                className={`transition-colors ${currentView === 'feed' && !showMyReportsOnly ? 'text-natural-olive border-b-2 border-natural-olive pb-1' : 'text-natural-text hover:text-natural-olive'}`}
              >
                Feed
              </button>
              {user && (
                <button 
                  onClick={() => { setCurrentView('feed'); setShowMyReportsOnly(true); }} 
                  className={`transition-colors ${currentView === 'feed' && showMyReportsOnly ? 'text-natural-olive border-b-2 border-natural-olive pb-1' : 'text-natural-text hover:text-natural-olive'}`}
                >
                  My Reports
                </button>
              )}
            </div>

            {user ? (
              <div className="flex items-center gap-4">
                {userData && (
                  <div className="hidden lg:flex flex-col items-end gap-1 px-4 border-r border-natural-border">
                    <div className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest text-natural-olive">
                      <Star className="w-3 h-3 fill-natural-olive" />
                      Level {calculateLevel(userData.xp)}
                    </div>
                    <div className="w-24 h-1.5 bg-natural-light rounded-full overflow-hidden border border-natural-border">
                      <motion.div 
                        initial={{ width: 0 }}
                        animate={{ width: `${getProgressToNextLevel(userData.xp)}%` }}
                        className="h-full bg-natural-olive"
                      />
                    </div>
                  </div>
                )}
                <button
                  id="report-btn"
                  onClick={() => { setCurrentView('feed'); setIsReportModalOpen(true); }}
                  className="bg-natural-olive hover:bg-natural-olive/90 text-white px-6 py-2.5 rounded-full font-semibold shadow-sm transition-all active:scale-95 flex items-center gap-2"
                >
                  <Plus className="w-4 h-4" />
                  Post Item
                </button>
                <div className="flex items-center gap-3 pl-4 border-l border-natural-border">
                  <div className="text-right hidden sm:block">
                    <p className="text-xs font-bold text-natural-dark truncate max-w-[100px]">{user.displayName || 'User'}</p>
                    <div className="flex gap-2 justify-end">
                      <button onClick={() => navigateToProfile(user.uid)} className="text-[10px] uppercase tracking-widest text-natural-olive hover:underline font-black">Profile</button>
                      <button onClick={handleLogout} className="text-[10px] uppercase tracking-widest text-natural-secondary hover:underline font-black">Sign Out</button>
                    </div>
                  </div>
                  <img 
                    src={user.photoURL || ''} 
                    alt="avatar" 
                    onClick={() => navigateToProfile(user.uid)}
                    className="w-10 h-10 rounded-full border-2 border-white shadow-sm cursor-pointer hover:border-natural-olive transition-colors" 
                  />
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-3">
                <button
                  onClick={handleDemoLogin}
                  className="hidden sm:block text-xs font-black uppercase tracking-widest text-natural-olive hover:underline"
                >
                  Demo Login
                </button>
                <button
                  onClick={handleLogin}
                  className="bg-natural-olive hover:bg-natural-olive/90 text-white px-6 py-2.5 rounded-full font-semibold shadow-sm transition-all active:scale-95 flex items-center gap-2"
                >
                  <LogIn className="w-4 h-4" />
                  Sign In
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {!user ? (
          <section className="py-20 text-center animate-in fade-in slide-in-from-bottom-4 duration-1000">
             <div className="max-w-2xl mx-auto">
              <h2 className="text-5xl font-light text-natural-dark font-serif mb-6 leading-tight">
                Connect. <span className="italic">Report.</span> <span className="text-natural-olive">Reclaim.</span>
              </h2>
              <p className="text-lg text-natural-secondary mb-10 leading-relaxed">
                LostLink is the centralized hub for our campus community. Join us to help fellow students find their lost belongings.
              </p>
              <div className="flex flex-col sm:flex-row justify-center gap-4">
                <button
                  onClick={handleLogin}
                  className="bg-natural-olive hover:bg-natural-dark text-white px-8 py-4 rounded-full font-bold shadow-xl shadow-natural-olive/20 transition-all flex items-center justify-center gap-3 text-lg"
                >
                  Get Started with Campus Email
                  <ArrowRight className="w-5 h-5" />
                </button>
                <button
                  onClick={handleDemoLogin}
                  className="bg-white hover:bg-natural-light text-natural-olive px-8 py-4 rounded-full font-bold border border-natural-border shadow-sm transition-all text-lg"
                >
                  Try Demo Sandbox Mode
                </button>
              </div>
             </div>
          </section>
        ) : currentView === 'feed' ? (
          <>
            {/* Welcome Section */}
            <section className="mb-12 text-center">
              <h2 className="text-4xl font-light text-natural-dark sm:text-5xl font-serif">
                Helping the campus community <span className="italic font-normal text-natural-olive">stay connected.</span>
              </h2>
              <div className="mt-8 max-w-xl mx-auto relative">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-natural-secondary" />
                <input
                  type="text"
                  placeholder="Search for lost keys, wallets, water bottles..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-12 pr-6 py-4 rounded-2xl bg-white border border-natural-border shadow-sm focus:ring-2 focus:ring-natural-olive outline-none transition-all placeholder:text-natural-secondary/60"
                />
              </div>
              <div className="flex flex-wrap justify-center gap-2 mt-6">
                {CATEGORIES.map(cat => (
                  <button
                    key={cat.id}
                    onClick={() => setSelectedCategory(selectedCategory === cat.id ? null : cat.id)}
                    className={`px-4 py-1.5 rounded-full text-xs font-semibold uppercase tracking-widest transition-all ${selectedCategory === cat.id ? 'bg-natural-olive text-white' : 'bg-natural-light border border-natural-border text-natural-text hover:bg-natural-border/20'}`}
                  >
                    {cat.label}
                  </button>
                ))}
              </div>

              <div className="flex flex-wrap justify-center gap-2 mt-4">
                <span className="w-full text-xs font-black text-natural-secondary uppercase tracking-[0.2em] mb-1">Campus Areas</span>
                <button
                  onClick={() => setSelectedLocation(null)}
                  className={`px-4 py-1.5 rounded-full text-[10px] font-bold uppercase tracking-widest transition-all ${!selectedLocation ? 'bg-natural-olive text-white' : 'bg-natural-light border border-natural-border text-natural-text hover:bg-natural-border/20'}`}
                >
                  All Areas
                </button>
                {LOCATIONS.slice(0, 7).map(loc => (
                  <button
                    key={loc}
                    onClick={() => setSelectedLocation(selectedLocation === loc ? null : loc)}
                    className={`px-4 py-1.5 rounded-full text-[10px] font-bold uppercase tracking-widest transition-all ${selectedLocation === loc ? 'bg-natural-olive text-white' : 'bg-natural-light border border-natural-border text-natural-text hover:bg-natural-border/20'}`}
                  >
                    {loc}
                  </button>
                ))}
              </div>
            </section>

            {/* Content Section */}
            <div className="flex flex-col gap-8">
              <div className="flex justify-between items-end border-b border-natural-border pb-4">
                <div>
                  <h2 className="text-xl font-bold text-natural-dark">Recently Reported</h2>
                  <p className="text-sm text-natural-secondary">Viewing live updates from the database</p>
                </div>
                <div className="flex bg-natural-light p-1 rounded-full border border-natural-border">
                  <button
                    onClick={() => setActiveTab('lost')}
                    className={`px-6 py-1.5 rounded-full text-xs font-bold uppercase tracking-widest transition-all ${activeTab === 'lost' ? 'bg-natural-olive text-white shadow-sm' : 'text-natural-text hover:text-natural-olive'}`}
                  >
                    Lost
                  </button>
                  <button
                    onClick={() => setActiveTab('found')}
                    className={`px-6 py-1.5 rounded-full text-xs font-bold uppercase tracking-widest transition-all ${activeTab === 'found' ? 'bg-natural-olive text-white shadow-sm' : 'text-natural-text hover:text-natural-olive'}`}
                  >
                    Found
                  </button>
                </div>
              </div>

              {/* Items Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8">
                {itemsLoading ? (
                  <div className="col-span-full py-20 flex flex-col items-center gap-4 text-natural-secondary">
                    <Loader2 className="w-8 h-8 animate-spin" />
                    <p className="text-sm font-bold uppercase tracking-[0.2em]">Syncing items...</p>
                  </div>
                ) : (
                  <AnimatePresence mode="popLayout">
                    {filteredItems.map((item) => (
                      <motion.div
                        key={item.id}
                        layout
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.9 }}
                        className="group bg-white rounded-[2rem] p-4 shadow-sm hover:shadow-xl hover:-translate-y-1.5 border border-natural-border flex flex-col transition-all duration-300"
                      >
                        <div className="aspect-[4/3] overflow-hidden relative rounded-[1.5rem] cursor-pointer group/img" onClick={() => navigateToItem(item.id)}>
                          <img
                            src={item.imageUrl}
                            alt={item.title}
                            className="w-full h-full object-cover group-hover/img:scale-105 transition-transform duration-500 grayscale-[0.2] contrast-[0.9]"
                            referrerPolicy="no-referrer"
                          />
                          <div className="absolute top-3 right-3">
                            <span className={`px-2 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest shadow-sm ${item.type === 'lost' ? 'bg-natural-lost text-white' : 'bg-natural-olive text-white'}`}>
                              {item.type}
                            </span>
                          </div>
                        </div>
                        <div className="p-5 flex-1 flex flex-col">
                          <div className="flex items-center gap-2 mb-3 cursor-pointer group/user" onClick={() => navigateToProfile(item.reporterId)}>
                            <img src={item.reporterPhoto || `https://api.dicebear.com/7.x/avataaars/svg?seed=${item.reporterId}`} className="w-6 h-6 rounded-full border border-natural-border" />
                            <span className="text-[10px] font-black uppercase tracking-widest text-natural-secondary group-hover/user:text-natural-olive transition-colors">{item.reporterName}</span>
                          </div>
                          <h3 className="text-lg font-bold text-natural-dark mb-1 leading-tight cursor-pointer hover:text-natural-olive transition-colors" onClick={() => navigateToItem(item.id)}>
                            {item.title}
                          </h3>
                          <p className="text-natural-secondary text-sm mb-3">
                            {item.location} • {item.date}
                          </p>
                          <div className="flex items-center gap-2 mb-4">
                             <div className={`w-2 h-2 rounded-full ${item.status === 'active' ? 'bg-emerald-500' : 'bg-slate-300'}`} />
                             <span className="text-[10px] font-black uppercase tracking-widest text-natural-secondary">{item.status}</span>
                          </div>
                          
                          {item.status === 'active' ? (
                            <button 
                              onClick={() => item.reporterId === user.uid ? handleResolve(item.id, item.reporterId) : handleClaim(item)}
                              className="mt-auto w-full py-2 bg-natural-light text-natural-olive font-semibold rounded-xl border border-natural-border text-sm hover:bg-natural-border/20 transition-colors"
                            >
                              {item.reporterId === user.uid ? 'Mark Resolved' : (item.type === 'lost' ? 'I Found This' : 'Claim Item')}
                            </button>
                          ) : (
                            <div className="mt-auto w-full py-2 bg-emerald-50 text-emerald-600 font-bold rounded-xl border border-emerald-100 text-center text-xs flex items-center justify-center gap-2">
                              <CheckCircle2 className="w-3 h-3" />
                              ITEM {item.type === 'lost' ? 'FOUND' : 'RETURNED'}
                            </div>
                          )}
                          
                          {item.reporterId === user.uid && item.status === 'active' && (
                            <p className="mt-3 text-[9px] text-center uppercase tracking-widest font-black text-natural-olive/60">Tap to mark as resolved and earn XP</p>
                          )}
                        </div>
                      </motion.div>
                    ))}
                  </AnimatePresence>
                )}
              </div>

              {!itemsLoading && filteredItems.length === 0 && (
                <div className="py-20 text-center bg-white rounded-[2rem] border border-dashed border-natural-border">
                  <Search className="w-12 h-12 text-natural-secondary/30 mx-auto mb-4" />
                  <h3 className="text-xl font-bold text-natural-dark font-serif">No items found</h3>
                  <p className="text-natural-secondary mt-1 px-4">
                    We couldn't find any {activeTab} items matching your current filters.
                  </p>
                  <button 
                    onClick={() => {
                      setSearchQuery('');
                      setSelectedCategory(null);
                      setSelectedLocation(null);
                    }}
                    className="mt-6 text-natural-olive font-bold hover:underline"
                  >
                    Clear all filters
                  </button>
                </div>
              )}
            </div>
          </>
        ) : currentView === 'profile' ? (
          <motion.section 
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            className="flex flex-col gap-10"
          >
            {/* Profile Header */}
            <div className="bg-white rounded-[3rem] p-8 sm:p-12 border border-natural-border shadow-sm">
              <div className="flex flex-col md:flex-row items-center gap-8 md:gap-12">
                <div className="relative">
                  <div className="w-32 h-32 md:w-40 md:h-40 rounded-full border-4 border-natural-light shadow-xl overflow-hidden">
                    <img src={selectedProfileData?.photoURL || `https://api.dicebear.com/7.x/avataaars/svg?seed=${selectedProfileId}`} className="w-full h-full object-cover" />
                  </div>
                  <div className="absolute -bottom-2 -right-2 bg-natural-olive text-white w-12 h-12 rounded-full flex items-center justify-center border-4 border-white shadow-lg text-lg font-black">
                    {calculateLevel(selectedProfileData?.xp || 0)}
                  </div>
                </div>

                <div className="flex-1 text-center md:text-left">
                  <h2 className="text-4xl font-bold text-natural-dark font-serif mb-2">{selectedProfileData?.displayName}</h2>
                  <p className="text-natural-secondary font-medium mb-6">Campus Member • Joined 2026</p>
                  
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                    <div className="bg-natural-light p-4 rounded-3xl border border-natural-border text-center">
                      <p className="text-[10px] font-black uppercase tracking-widest text-natural-olive mb-1">XP Points</p>
                      <p className="text-2xl font-black text-natural-dark">{selectedProfileData?.xp || 0}</p>
                    </div>
                    <div className="bg-natural-light p-4 rounded-3xl border border-natural-border text-center">
                      <p className="text-[10px] font-black uppercase tracking-widest text-natural-olive mb-1">Items Returned</p>
                      <p className="text-2xl font-black text-natural-dark">{selectedProfileData?.helpfulReturns || 0}</p>
                    </div>
                    <div className="hidden sm:block bg-natural-light p-4 rounded-3xl border border-natural-border text-center">
                      <p className="text-[10px] font-black uppercase tracking-widest text-natural-olive mb-1">Reports Total</p>
                      <p className="text-2xl font-black text-natural-dark">
                        {items.filter(i => i.reporterId === selectedProfileId).length}
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Progress Bar */}
              <div className="mt-12 space-y-3">
                <div className="flex justify-between items-end">
                  <p className="text-xs font-black uppercase tracking-[0.2em] text-natural-olive">Rank Progress</p>
                  <p className="text-[10px] font-bold text-natural-secondary">
                    {selectedProfileData?.xp || 0} / {getXPForNextLevel(calculateLevel(selectedProfileData?.xp || 0))} XP
                  </p>
                </div>
                <div className="w-full h-4 bg-natural-light rounded-full overflow-hidden border-2 border-natural-border p-1">
                  <motion.div 
                    initial={{ width: 0 }}
                    animate={{ width: `${getProgressToNextLevel(selectedProfileData?.xp || 0)}%` }}
                    className="h-full bg-natural-olive rounded-full"
                  />
                </div>
              </div>
            </div>

            {/* Profile Content */}
            <div className="space-y-8">
               <div className="flex justify-between items-center border-b border-natural-border pb-4">
                  <h3 className="text-xl font-bold text-natural-dark">Reported by {selectedProfileData?.displayName}</h3>
                  <button 
                    onClick={() => setCurrentView('feed')}
                    className="text-sm font-bold text-natural-olive hover:underline"
                  >
                    Back to Feed
                  </button>
               </div>

               <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8">
                  <AnimatePresence mode="popLayout">
                    {items.filter(i => i.reporterId === selectedProfileId).map((item) => (
                      <motion.div
                        key={item.id}
                        layout
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.9 }}
                        className="group bg-white rounded-[2rem] p-4 shadow-sm hover:shadow-xl hover:-translate-y-1.5 border border-natural-border flex flex-col transition-all duration-300"
                      >
                         <div className="aspect-[4/3] overflow-hidden relative rounded-[1.5rem] cursor-pointer group/img" onClick={() => navigateToItem(item.id)}>
                          <img
                            src={item.imageUrl}
                            alt={item.title}
                            className="w-full h-full object-cover group-hover/img:scale-105 transition-transform duration-500 grayscale-[0.2] contrast-[0.9]"
                            referrerPolicy="no-referrer"
                          />
                          <div className="absolute top-3 right-3">
                            <span className={`px-2 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest shadow-sm ${item.type === 'lost' ? 'bg-natural-lost text-white' : 'bg-natural-olive text-white'}`}>
                              {item.type}
                            </span>
                          </div>
                        </div>
                        <div className="p-5 flex-1 flex flex-col">
                          <h3 className="text-lg font-bold text-natural-dark mb-1 leading-tight cursor-pointer hover:text-natural-olive transition-colors" onClick={() => navigateToItem(item.id)}>
                            {item.title}
                          </h3>
                          <p className="text-natural-secondary text-sm mb-3">
                            {item.location} • {item.date}
                          </p>
                          <div className="flex items-center gap-2 mb-4">
                             <div className={`w-2 h-2 rounded-full ${item.status === 'active' ? 'bg-emerald-500' : 'bg-slate-300'}`} />
                             <span className="text-[10px] font-black uppercase tracking-widest text-natural-secondary">{item.status}</span>
                          </div>
                          
                          {item.status === 'active' ? (
                            <button 
                              onClick={() => item.reporterId === user.uid ? handleResolve(item.id, item.reporterId) : handleClaim(item)}
                              className="mt-auto w-full py-2 bg-natural-light text-natural-olive font-semibold rounded-xl border border-natural-border text-sm hover:bg-natural-border/20 transition-colors"
                            >
                              {item.reporterId === user.uid ? 'Mark Resolved' : (item.type === 'lost' ? 'I Found This' : 'Claim Item')}
                            </button>
                          ) : (
                            <div className="mt-auto w-full py-2 bg-emerald-50 text-emerald-600 font-bold rounded-xl border border-emerald-100 text-center text-xs flex items-center justify-center gap-2">
                              <CheckCircle2 className="w-3 h-3" />
                              RESOLVED
                            </div>
                          )}
                        </div>
                      </motion.div>
                    ))}
                  </AnimatePresence>
               </div>

               {items.filter(i => i.reporterId === selectedProfileId).length === 0 && (
                <div className="py-20 text-center bg-white rounded-[2rem] border border-dashed border-natural-border">
                  <p className="text-natural-secondary font-serif italic text-lg">This member hasn't reported any items yet.</p>
                </div>
               )}
            </div>
          </motion.section>
        ) : (
          <motion.section
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex flex-col gap-10"
          >
            {/* Item Detail View */}
            {!selectedItem ? (
              <div className="py-20 text-center bg-white rounded-[3rem] border border-natural-border shadow-sm">
                <Search className="w-12 h-12 text-natural-secondary/30 mx-auto mb-4" />
                <h3 className="text-xl font-bold text-natural-dark font-serif">Item not found</h3>
                <button onClick={() => setCurrentView('feed')} className="mt-6 text-natural-olive font-bold hover:underline">Back to Feed</button>
              </div>
            ) : (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
                {/* Left Column: Image and Description */}
                <div className="space-y-8">
                  <div className="bg-white rounded-[3rem] p-4 border border-natural-border shadow-sm overflow-hidden group">
                    <img 
                      src={selectedItem.imageUrl} 
                      alt={selectedItem.title} 
                      className="w-full aspect-square object-cover rounded-[2.5rem] group-hover:scale-[1.02] transition-transform duration-700" 
                      referrerPolicy="no-referrer"
                    />
                  </div>
                  
                  <div className="bg-white rounded-[3rem] p-8 sm:p-12 border border-natural-border shadow-sm space-y-6">
                    <div className="flex flex-wrap gap-3">
                      <span className={`px-4 py-1.5 rounded-full text-xs font-black uppercase tracking-widest ${selectedItem.type === 'lost' ? 'bg-natural-lost text-white' : 'bg-natural-olive text-white'}`}>
                        {selectedItem.type}
                      </span>
                      <span className="px-4 py-1.5 rounded-full text-xs font-black uppercase tracking-widest bg-natural-light border border-natural-border text-natural-olive flex items-center gap-2">
                        {getCategoryIcon(selectedItem.category)}
                        {selectedItem.category}
                      </span>
                    </div>
                    
                    <h2 className="text-4xl font-bold text-natural-dark font-serif leading-tight">{selectedItem.title}</h2>
                    
                    <div className="flex flex-col gap-4 text-natural-secondary">
                      <div className="flex items-center gap-3">
                        <MapPin className="w-5 h-5 text-natural-olive" />
                        <span className="font-medium">{selectedItem.location}</span>
                      </div>
                      <div className="flex items-center gap-3">
                        <Calendar className="w-5 h-5 text-natural-olive" />
                        <span className="font-medium">{selectedItem.date}</span>
                      </div>
                    </div>

                    <div className="pt-6 border-t border-natural-border">
                      <p className="text-xs font-black uppercase tracking-[0.2em] text-natural-olive mb-4">Description</p>
                      <p className="text-natural-dark leading-relaxed text-lg italic font-serif">
                        "{selectedItem.description}"
                      </p>
                    </div>

                    <div className="pt-8 flex flex-col sm:flex-row gap-4">
                      {selectedItem.status === 'active' ? (
                        <button 
                          onClick={() => selectedItem.reporterId === user.uid ? handleResolve(selectedItem.id, selectedItem.reporterId) : handleClaim(selectedItem)}
                          className="flex-1 py-4 bg-natural-olive hover:bg-natural-dark text-white rounded-[2rem] font-bold text-lg shadow-xl shadow-natural-olive/20 transition-all active:scale-95 flex items-center justify-center gap-3"
                        >
                          {selectedItem.reporterId === user.uid ? (
                            <>
                              <CheckCircle2 className="w-5 h-5" />
                              Mark as Resolved
                            </>
                          ) : (
                            <>
                              <CheckCircle2 className="w-5 h-5" />
                              {selectedItem.type === 'lost' ? 'I Found This' : 'This is Mine'}
                            </>
                          )}
                        </button>
                      ) : (
                        <div className="flex-1 py-4 bg-emerald-50 text-emerald-600 font-bold rounded-[2rem] border border-emerald-100 text-center flex items-center justify-center gap-3">
                          <CheckCircle2 className="w-5 h-5" />
                          ALREADY RESOLVED
                        </div>
                      )}
                      <button 
                        onClick={() => setCurrentView('feed')}
                        className="px-8 py-4 bg-natural-light text-natural-olive font-bold rounded-[2rem] border border-natural-border hover:bg-natural-border/20 transition-colors"
                      >
                        Go Back
                      </button>
                    </div>
                  </div>
                </div>

                {/* Right Column: Reporter and Map */}
                <div className="space-y-8">
                  {/* Reporter Profile Card */}
                  <div className="bg-white rounded-[3rem] p-8 border border-natural-border shadow-sm flex items-center gap-6 cursor-pointer hover:bg-natural-light transition-all" onClick={() => navigateToProfile(selectedItem.reporterId)}>
                    <img 
                      src={selectedItem.reporterPhoto || `https://api.dicebear.com/7.x/avataaars/svg?seed=${selectedItem.reporterId}`} 
                      className="w-20 h-20 rounded-full border-4 border-natural-light shadow-md" 
                    />
                    <div>
                      <p className="text-xs font-black uppercase tracking-widest text-natural-olive mb-1">Reported By</p>
                      <h4 className="text-2xl font-bold text-natural-dark font-serif">{selectedItem.reporterName}</h4>
                      <p className="text-sm font-medium text-natural-secondary">View Member Profile →</p>
                    </div>
                  </div>

                  {/* Map View */}
                  <div className="bg-white rounded-[3rem] p-4 border border-natural-border shadow-sm flex flex-col gap-4 overflow-hidden h-[500px]">
                    <div className="px-4 py-2 border-b border-natural-border flex justify-between items-center">
                      <p className="text-[10px] font-black uppercase tracking-widest text-natural-olive">Location Context</p>
                      <p className="text-xs font-bold text-natural-secondary">{selectedItem.location}</p>
                    </div>
                    
                    <div className="flex-1 rounded-[2.5rem] overflow-hidden border border-natural-border bg-natural-light relative">
                      <div className="w-full h-full relative">
                        <iframe
                          width="100%"
                          height="100%"
                          frameBorder="0"
                          scrolling="no"
                          marginHeight={0}
                          marginWidth={0}
                          title="OpenStreetMap"
                          className="grayscale-[0.3] contrast-[0.9]"
                          src={`https://www.openstreetmap.org/export/embed.html?bbox=${(CAMPUS_COORDINATES[selectedItem.location] || CAMPUS_COORDINATES['Other']).lng - 0.002}%2C${(CAMPUS_COORDINATES[selectedItem.location] || CAMPUS_COORDINATES['Other']).lat - 0.001}%2C${(CAMPUS_COORDINATES[selectedItem.location] || CAMPUS_COORDINATES['Other']).lng + 0.002}%2C${(CAMPUS_COORDINATES[selectedItem.location] || CAMPUS_COORDINATES['Other']).lat + 0.001}&layer=mapnik&marker=${(CAMPUS_COORDINATES[selectedItem.location] || CAMPUS_COORDINATES['Other']).lat}%2C${(CAMPUS_COORDINATES[selectedItem.location] || CAMPUS_COORDINATES['Other']).lng}`}
                        />
                        <div className="absolute bottom-2 right-2 bg-white/80 backdrop-blur-sm px-2 py-0.5 rounded text-[8px] font-bold text-natural-secondary border border-natural-border">
                          © OpenStreetMap contributors
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="bg-natural-light/50 rounded-[3rem] p-8 border border-dashed border-natural-border text-center">
                    <p className="text-sm text-natural-secondary italic">
                       If you have more information about this item, you can contact the reporter directly via the campus directory or wait for them to reach out after your claim.
                    </p>
                  </div>
                </div>
              </div>
            )}
          </motion.section>
        )}
      </main>

      {/* FOOTER */}
      <footer className="bg-natural-olive text-natural-bg mt-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 flex flex-col md:flex-row justify-between items-center gap-4">
          <div className="flex items-center gap-3">
            <span className="flex h-3 w-3 relative">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-400"></span>
            </span>
            <p className="text-sm font-medium">LostLink: Reconnecting the campus community.</p>
          </div>
          <p className="text-[10px] font-bold uppercase tracking-[0.2em] opacity-60">Hand-crafted for Students 2026</p>
        </div>
      </footer>

      {/* NOTIFICATION */}
      <AnimatePresence>
        {notification && (
          <motion.div
            initial={{ opacity: 0, y: 50 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 50 }}
            className={`fixed bottom-8 left-1/2 -translate-x-1/2 px-6 py-4 rounded-2xl shadow-2xl flex items-center gap-3 z-50 min-w-[320px] ${notification.type === 'success' ? 'bg-natural-olive text-white' : 'bg-natural-lost text-white'}`}
          >
            {notification.type === 'success' ? <CheckCircle2 className="w-5 h-5" /> : <AlertCircle className="w-5 h-5" />}
            <span className="font-bold">{notification.message}</span>
            <button onClick={() => setNotification(null)} className="ml-auto p-1 hover:bg-white/20 rounded-lg">
              <X className="w-4 h-4" />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* REPORT MODAL */}
      <AnimatePresence>
        {isReportModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => !isSubmitting && setIsReportModalOpen(false)}
              className="absolute inset-0 bg-natural-dark/60 backdrop-blur-sm"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-2xl bg-natural-bg rounded-[40px] shadow-2xl overflow-y-auto max-h-[90vh] border border-natural-border"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="p-8 sm:p-12">
                <div className="flex justify-between items-start mb-8">
                  <div>
                    <h2 className="text-3xl font-bold text-natural-dark font-serif">Report an Item</h2>
                    <p className="text-natural-secondary mt-2 font-medium">Please provide accurate details to help others.</p>
                  </div>
                  <button 
                    disabled={isSubmitting}
                    onClick={() => setIsReportModalOpen(false)}
                    className="p-2.5 hover:bg-natural-border/20 rounded-2xl transition-colors text-natural-secondary disabled:opacity-50"
                  >
                    <X className="w-6 h-6" />
                  </button>
                </div>

                <form onSubmit={handleReportSubmit} className="space-y-6">
                  {/* Type Selector */}
                  <div className="flex bg-natural-light p-1.5 rounded-2xl border border-natural-border">
                    <button
                      type="button"
                      disabled={isSubmitting}
                      onClick={() => setNewReport({...newReport, type: 'lost'})}
                      className={`flex-1 py-3 rounded-xl text-sm font-black transition-all ${newReport.type === 'lost' ? 'bg-natural-lost text-white shadow-lg' : 'text-natural-secondary hover:text-natural-dark'}`}
                    >
                      LOST
                    </button>
                    <button
                      type="button"
                      disabled={isSubmitting}
                      onClick={() => setNewReport({...newReport, type: 'found'})}
                      className={`flex-1 py-3 rounded-xl text-sm font-black transition-all ${newReport.type === 'found' ? 'bg-natural-olive text-white shadow-lg' : 'text-natural-secondary hover:text-natural-dark'}`}
                    >
                      FOUND
                    </button>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <label className="text-xs font-black text-natural-secondary uppercase tracking-widest px-1">Item Title</label>
                      <input
                        required
                        disabled={isSubmitting}
                        type="text"
                        placeholder="e.g. Silver Laptop Hub"
                        value={newReport.title || ''}
                        onChange={(e) => setNewReport({...newReport, title: e.target.value})}
                        className="w-full px-5 py-3.5 bg-white border border-natural-border rounded-2xl focus:ring-4 focus:ring-natural-olive/10 focus:border-natural-olive outline-none transition-all font-medium disabled:opacity-50"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-xs font-black text-natural-secondary uppercase tracking-widest px-1">Category</label>
                      <select
                        disabled={isSubmitting}
                        value={newReport.category}
                        onChange={(e) => setNewReport({...newReport, category: e.target.value})}
                        className="w-full px-5 py-3.5 bg-white border border-natural-border rounded-2xl focus:ring-4 focus:ring-natural-olive/10 focus:border-natural-olive outline-none transition-all font-medium appearance-none disabled:opacity-50"
                      >
                        {CATEGORIES.map(cat => (
                          <option key={cat.id} value={cat.id}>{cat.label}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-xs font-black text-natural-secondary uppercase tracking-widest px-1">Description</label>
                    <textarea
                      required
                      disabled={isSubmitting}
                      rows={3}
                      placeholder="Add specific details like colors, marks, or accessories..."
                      value={newReport.description || ''}
                      onChange={(e) => setNewReport({...newReport, description: e.target.value})}
                      className="w-full px-5 py-3.5 bg-white border border-natural-border rounded-2xl focus:ring-4 focus:ring-natural-olive/10 focus:border-natural-olive outline-none transition-all font-medium resize-none disabled:opacity-50"
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-xs font-black text-natural-secondary uppercase tracking-widest px-1">Item Image</label>
                    <div className="relative group">
                      <input
                        disabled={isSubmitting}
                        type="file"
                        accept="image/*"
                        onChange={handleImageUpload}
                        className="hidden"
                        id="image-upload"
                      />
                      <label
                        htmlFor="image-upload"
                        className={`flex flex-col items-center justify-center w-full h-40 border-2 border-dashed rounded-3xl cursor-pointer transition-all ${imagePreview ? 'border-natural-olive bg-natural-olive/5' : 'border-natural-border bg-white hover:bg-natural-light'} ${isSubmitting ? 'cursor-not-allowed opacity-50' : ''}`}
                      >
                        {imagePreview ? (
                          <div className="relative w-full h-full p-2">
                            <img src={imagePreview} className="w-full h-full object-cover rounded-2xl" alt="Preview" />
                            {!isSubmitting && (
                              <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity rounded-2xl">
                                <p className="text-white text-xs font-bold">Change Image</p>
                              </div>
                            )}
                          </div>
                        ) : (
                          <div className="flex flex-col items-center text-natural-secondary">
                            <Plus className="w-8 h-8 mb-2 opacity-40" />
                            <p className="text-sm font-bold">Click to upload photo</p>
                            <p className="text-[10px] uppercase tracking-wider mt-1 opacity-60">Max size: 5MB</p>
                          </div>
                        )}
                      </label>
                      {imagePreview && !isSubmitting && (
                        <button
                          type="button"
                          onClick={() => setImagePreview(null)}
                          className="absolute -top-2 -right-2 bg-natural-lost text-white p-1.5 rounded-full shadow-lg hover:opacity-90 transition-colors z-10"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <label className="text-xs font-black text-natural-secondary uppercase tracking-widest px-1">Location</label>
                      <select
                        disabled={isSubmitting}
                        value={newReport.location}
                        onChange={(e) => setNewReport({...newReport, location: e.target.value})}
                        className="w-full px-5 py-3.5 bg-white border border-natural-border rounded-2xl focus:ring-4 focus:ring-natural-olive/10 focus:border-natural-olive outline-none transition-all font-medium appearance-none disabled:opacity-50"
                      >
                        {LOCATIONS.map(loc => (
                          <option key={loc} value={loc}>{loc}</option>
                        ))}
                      </select>
                    </div>
                    <div className="space-y-2">
                      <label className="text-xs font-black text-natural-secondary uppercase tracking-widest px-1">Date</label>
                      <input
                        disabled={isSubmitting}
                        type="date"
                        value={newReport.date}
                        onChange={(e) => setNewReport({...newReport, date: e.target.value})}
                        className="w-full px-5 py-3.5 bg-white border border-natural-border rounded-2xl focus:ring-4 focus:ring-natural-olive/10 focus:border-natural-olive outline-none transition-all font-medium disabled:opacity-50"
                      />
                    </div>
                  </div>

                  <div className="pt-6">
                    <button
                      type="submit"
                      disabled={isSubmitting}
                      className="w-full py-4 bg-natural-olive hover:bg-natural-dark text-white rounded-3xl font-bold text-lg shadow-xl shadow-natural-olive/20 active:scale-95 transition-all flex items-center justify-center gap-3 disabled:opacity-70 disabled:cursor-not-allowed"
                    >
                      {isSubmitting ? (
                        <>
                          <Loader2 className="w-5 h-5 animate-spin" />
                          Posting...
                        </>
                      ) : (
                        <>
                          Post Report
                          <ChevronRight className="w-5 h-5" />
                        </>
                      )}
                    </button>
                  </div>
                </form>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
      </div>
  );
}

