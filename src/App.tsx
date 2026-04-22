import { useState, useEffect, useRef } from 'react';
import { 
  ShoppingCart, 
  Settings, 
  Menu as MenuIcon, 
  X, 
  RefreshCw,
  Phone, 
  MapPin, 
  Clock, 
  Plus,
  Minus,
  Trash2,
  Truck,
  CreditCard,
  MessageCircle,
  Edit,
  Save,
  LogOut,
  Upload,
  Video,
  Image as ImageIcon,
  CheckCircle,
  ChevronDown,
  Tag,
  Wallet,
  Key,
  Building2
} from 'lucide-react';
import type { MenuItem, Category, RestaurantSettings, Order } from './types';
import { initialCategories, initialMenuItems, initialSettings } from './data';
import { motion, AnimatePresence } from 'framer-motion';

// Helper function to generate unique IDs
const generateId = () => {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID().substring(0, 8).toUpperCase();
  }
  // Fallback: use performance.now() for timestamp-based ID
  const timestamp = performance.now().toString(36).replace('.', '').toUpperCase();
  const random = Math.floor(Math.random() * 1000).toString(36).toUpperCase();
  return timestamp.slice(-5) + random.slice(-3);
};

function App() {
  const adminPassword = import.meta.env.VITE_ADMIN_PASSWORD;
  const adminApiToken = import.meta.env.VITE_ADMIN_API_TOKEN;

  // Version check for updates
  useEffect(() => {
    const APP_VERSION = '2.1.0';
    const VERSION_KEY = 'minas_app_version';
    const BUILD_TIME_KEY = 'minas_build_time';
    
    const checkForUpdates = async () => {
      try {
        // Get current version and build time from localStorage
        const storedVersion = localStorage.getItem(VERSION_KEY);
        const storedBuildTime = localStorage.getItem(BUILD_TIME_KEY);
        
        // Fetch the main HTML file with cache busting to check for new build
        const timestamp = Date.now();
        const response = await fetch(`/?v=${timestamp}`, { 
          method: 'GET',
          cache: 'no-store',
          headers: {
            'Cache-Control': 'no-cache',
            'Pragma': 'no-cache'
          }
        });
        
        if (response.ok) {
          const html = await response.text();
          
          // Try to extract build hash from script tags or use timestamp
          // Vite typically includes hash in asset filenames
          const scriptMatch = html.match(/src="\/assets\/index-([^"]+)\.js"/);
          const cssMatch = html.match(/href="\/assets\/index-([^"]+)\.css"/);
          const currentBuildHash = scriptMatch?.[1] || cssMatch?.[1] || timestamp.toString();
          
          // Compare with stored build hash
          if (storedBuildTime !== currentBuildHash || storedVersion !== APP_VERSION) {
            console.log('🔄 New version detected!', { 
              storedVersion, 
              newVersion: APP_VERSION,
              storedBuildTime,
              currentBuildHash
            });
            setShowUpdateBanner(true);
            localStorage.setItem(VERSION_KEY, APP_VERSION);
            localStorage.setItem(BUILD_TIME_KEY, currentBuildHash);
          }
        }
      } catch (error) {
        console.error('Error checking for updates:', error);
        // If fetch fails, it might be offline - don't show update banner
      }
    };
    
    // Check immediately on load
    const timeout = setTimeout(checkForUpdates, 2000); // Wait 2s after page load
    
    // Check every 3 minutes
    const interval = setInterval(checkForUpdates, 3 * 60 * 1000);
    
    // Also check when page becomes visible (user comes back to tab)
    const handleVisibilityChange = () => {
      if (!document.hidden) {
        setTimeout(checkForUpdates, 1000);
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);
    
    // Check on focus (when user switches back to tab)
    const handleFocus = () => {
      setTimeout(checkForUpdates, 1000);
    };
    window.addEventListener('focus', handleFocus);
    
    return () => {
      clearTimeout(timeout);
      clearInterval(interval);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('focus', handleFocus);
    };
  }, []);

  // Clean old localStorage keys and check storage usage
  useEffect(() => {
    try {
      // Remove ALL old keys that are no longer used
      const oldKeys = ['minas_settings', 'minas_categories', 'minas_items', 'minas_orders'];
      oldKeys.forEach(key => {
        if (localStorage.getItem(key)) {
          localStorage.removeItem(key);
          console.log(`Removed old localStorage key: ${key}`);
        }
      });
      
      // Check total localStorage usage
      let totalSize = 0;
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key) {
          const value = localStorage.getItem(key) || '';
          totalSize += new Blob([value]).size;
        }
      }
      const totalSizeMB = totalSize / 1024 / 1024;
      console.log(`Total localStorage usage: ${totalSizeMB.toFixed(2)}MB`);
      
      if (totalSizeMB > 4) {
        console.warn('localStorage is getting full. Consider cleaning old data.');
      }
    } catch (e) {
      console.error('Error cleaning old localStorage:', e);
    }
  }, []);


  // Persistence initialization
  const getStoredData = <T,>(key: string, initial: T): T => {
    try {
    const stored = localStorage.getItem(key);
    if (!stored) return initial;
      const parsed = JSON.parse(stored);
      // No migration - allow any name
      return parsed;
    } catch (error) {
      console.error(`Error loading ${key} from localStorage:`, error);
      return initial;
    }
  };

  const [categories, setCategories] = useState<Category[]>(() => getStoredData('minas_v2_categories', initialCategories));
  const [items, setItems] = useState<MenuItem[]>(() => getStoredData('minas_v2_items', initialMenuItems));
  const [settings, setSettings] = useState<RestaurantSettings>(() => getStoredData('minas_v2_settings', initialSettings));
  const [orders, setOrders] = useState<Order[]>(() => getStoredData('minas_v2_orders', []));
  const [isInitialized, setIsInitialized] = useState(false);
  const [lastSyncStatus, setLastSyncStatus] = useState<{ success: boolean; time: string | null; error?: string }>({ success: false, time: null });
  const [showUpdateBanner, setShowUpdateBanner] = useState(false);
  
  // Admin authentication - only you have access
  const [isAdminAuthenticated, setIsAdminAuthenticated] = useState(false);
  const [isAdminAccessModalOpen, setIsAdminAccessModalOpen] = useState(false);
  const [adminAccessPassword, setAdminAccessPassword] = useState('');
  const adminTapCountRef = useRef(0);
  const adminTapTimeoutRef = useRef<number | null>(null);
  
  // Auto-update restaurant name if it's the old one
  useEffect(() => {
    if (settings.name === 'Fogão & Sabor' || settings.name === 'Fogao & Sabor') {
      const updatedSettings = { ...settings, name: 'Fogão a Lenha' };
      setSettings(updatedSettings);
      try {
        localStorage.setItem('minas_v2_settings', JSON.stringify(updatedSettings));
        console.log('✅ Restaurant name updated from "Fogão & Sabor" to "Fogão a Lenha"');
      } catch (e) {
        console.error('Error updating restaurant name:', e);
      }
    }
  }, [settings.name]);

  // Initialize bankInfo and paymentTokens if they don't exist
  useEffect(() => {
    if (!settings.bankInfo || !settings.paymentTokens) {
      const updatedSettings = {
        ...settings,
        bankInfo: settings.bankInfo || {
          bankName: '',
          bankCode: '',
          agency: '',
          account: '',
          accountType: 'checking',
          accountHolderName: '',
          cpfCnpj: '',
          pixKey: '',
          pixKeyType: 'cpf',
        },
        paymentTokens: settings.paymentTokens || {
          mercadoPagoToken: '',
          mercadoPagoPublicKey: '',
          pagSeguroToken: '',
          pagSeguroEmail: '',
          stripeToken: '',
          stripePublicKey: '',
          otherTokens: [],
        },
      };
      setSettings(updatedSettings);
      try {
        localStorage.setItem('minas_v2_settings', JSON.stringify(updatedSettings));
      } catch (e) {
        console.error('Error initializing bank info and payment tokens:', e);
      }
    }
  }, []);
  
  const handleAdminLogin = () => {
    if (!isDesktop) return;
    setAdminAccessPassword('');
    setIsAdminAccessModalOpen(true);
  };

  const handleAdminAccessSubmit = (event: { preventDefault: () => void }) => {
    event.preventDefault();
    if (!adminPassword) {
      alert('Senha de admin nao configurada. Defina VITE_ADMIN_PASSWORD no ambiente.');
      return;
    }
    if (adminAccessPassword === adminPassword) {
      setIsAdminAuthenticated(true);
      setIsAdminOpen(true);
      setIsAdminAccessModalOpen(false);
      setAdminAccessPassword('');
    } else {
      alert('Senha incorreta. Acesso negado.');
      setAdminAccessPassword('');
    }
  };

  const handleHiddenAdminTrigger = () => {
    if (!isDesktop) return;
    adminTapCountRef.current += 1;
    if (adminTapTimeoutRef.current) {
      window.clearTimeout(adminTapTimeoutRef.current);
    }
    adminTapTimeoutRef.current = window.setTimeout(() => {
      adminTapCountRef.current = 0;
    }, 2500);

    if (adminTapCountRef.current >= 5) {
      if (adminTapTimeoutRef.current) {
        window.clearTimeout(adminTapTimeoutRef.current);
        adminTapTimeoutRef.current = null;
      }
      adminTapCountRef.current = 0;
      handleAdminLogin();
    }
  };
  
  const handleAdminLogout = () => {
    setIsAdminAuthenticated(false);
    setIsAdminOpen(false);
  };
  
  // Check if device is desktop/PC (admin access only on desktop)
  const [isDesktop, setIsDesktop] = useState(false);
  
  useEffect(() => {
    const checkIsDesktop = () => {
      // Check screen width (desktop typically >= 1024px)
      const isLargeScreen = window.innerWidth >= 1024;
      // Check user agent for mobile devices
      const isMobileDevice = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
      // Desktop if large screen AND not a mobile device
      setIsDesktop(isLargeScreen && !isMobileDevice);
    };
    
    checkIsDesktop();
    window.addEventListener('resize', checkIsDesktop);
    return () => window.removeEventListener('resize', checkIsDesktop);
  }, []);

  useEffect(() => {
    if (!isDesktop) return;
    if (window.location.pathname !== '/acesso-admin') return;

    setAdminAccessPassword('');
    setIsAdminAccessModalOpen(true);

    // Clean the URL after opening the hidden admin access.
    window.history.replaceState({}, '', '/');
  }, [isDesktop]);

  useEffect(() => {
    return () => {
      if (adminTapTimeoutRef.current) {
        window.clearTimeout(adminTapTimeoutRef.current);
      }
    };
  }, []);
  
  const [cart, setCart] = useState<{ item: MenuItem; quantity: number }[]>([]);
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [isAdminOpen, setIsAdminOpen] = useState(false);
  const [activeCategory, setActiveCategory] = useState<string>('all');
  const [openCategoryDropdown, setOpenCategoryDropdown] = useState<string | null>(null);
  const [isCheckoutOpen, setIsCheckoutOpen] = useState(false);
  const [isPaymentReviewOpen, setIsPaymentReviewOpen] = useState(false);
  const [orderConfirmation, setOrderConfirmation] = useState<Order | null>(null);
  const [isNewItemModalOpen, setIsNewItemModalOpen] = useState(false);
  const [newItemForm, setNewItemForm] = useState({ name: '', price: '', description: '', category: '' });


  const compressImage = (file: File, maxWidth: number = 800, quality: number = 0.7): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement('canvas');
          let width = img.width;
          let height = img.height;

          if (width > maxWidth) {
            height = (height * maxWidth) / width;
            width = maxWidth;
          }

          canvas.width = width;
          canvas.height = height;

          const ctx = canvas.getContext('2d');
          if (!ctx) {
            reject(new Error('Could not get canvas context'));
            return;
          }

          ctx.drawImage(img, 0, 0, width, height);
          const compressedBase64 = canvas.toDataURL('image/jpeg', quality);
          resolve(compressedBase64);
        };
        img.onerror = () => reject(new Error('Failed to load image'));
        if (e.target?.result) {
          img.src = e.target.result as string;
        } else {
          reject(new Error('Failed to read file'));
        }
      };
      reader.onerror = () => reject(new Error('Failed to read file'));
      reader.readAsDataURL(file);
    });
  };

  const handleFileUpload = async (file: File, callback: (base64: string) => void) => {
    try {
      // Compress image before saving
      const compressedBase64 = await compressImage(file);
      callback(compressedBase64);
    } catch (error) {
      console.error('Error compressing image:', error);
      // Fallback to original method if compression fails
    const reader = new FileReader();
    reader.onloadend = () => {
      callback(reader.result as string);
    };
    reader.readAsDataURL(file);
    }
  };

  // Persistence effects
  useEffect(() => {
    document.title = settings.name || 'Fogão a Lenha';
  }, [settings.name]);

  // Sync functions
  const getApiUrl = () => {
    return `${window.location.origin}/api/data`;
  };

  const getApiAuthHeaders = () => {
    if (!adminApiToken) return {};
    return { 'x-admin-token': adminApiToken };
  };

  // Compress image to very small size for cloud sync (ultra compression)
  const compressImageForSync = async (base64Image: string, maxWidth: number = 400, quality: number = 0.4): Promise<string> => {
    if (!base64Image || base64Image.trim() === '') return '';
    
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let width = img.width;
        let height = img.height;
        
        if (width > maxWidth) {
          height = (height * maxWidth) / width;
          width = maxWidth;
        }
        
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(img, 0, 0, width, height);
          const compressed = canvas.toDataURL('image/jpeg', quality);
          resolve(compressed);
        } else {
          resolve(base64Image); // Fallback to original if compression fails
        }
      };
      img.onerror = () => resolve(base64Image); // Fallback to original if load fails
      img.src = base64Image;
    });
  };

  // Optimize data for cloud sync with compressed images (to reduce payload size but keep images)
  const optimizeDataForSync = async () => {
    // Compress images in items (ultra compression for sync)
    const optimizedItems = await Promise.all(
      items.map(async (item) => ({
        id: item.id,
        name: item.name,
        description: item.description,
        price: item.price,
        category: item.category,
        available: item.available,
        image: item.image ? await compressImageForSync(item.image, 400, 0.4) : '' // Ultra compressed
      }))
    );

    // Compress images in settings (ultra compression for sync)
    const optimizedSettings = {
      name: settings.name,
      phone: settings.phone,
      whatsapp: settings.whatsapp,
      address: settings.address,
      openingHours: settings.openingHours,
      deliveryFee: settings.deliveryFee,
      minOrder: settings.minOrder,
      paymentMethods: settings.paymentMethods,
      logoSize: settings.logoSize,
      logoSizePx: settings.logoSizePx,
      aboutImage1Size: settings.aboutImage1Size,
      aboutImage1SizePx: settings.aboutImage1SizePx,
      aboutImage2Size: settings.aboutImage2Size,
      aboutImage2SizePx: settings.aboutImage2SizePx,
      // Compress media images for sync
      logo: settings.logo ? await compressImageForSync(settings.logo, 200, 0.4) : '',
      heroImage: settings.heroImage ? await compressImageForSync(settings.heroImage, 800, 0.4) : '',
      heroVideo: settings.heroVideo || '', // Videos are not compressed
      aboutImage1: settings.aboutImage1 ? await compressImageForSync(settings.aboutImage1, 600, 0.4) : '',
      aboutImage2: settings.aboutImage2 ? await compressImageForSync(settings.aboutImage2, 600, 0.4) : ''
    };

    // Limit orders to last 100 to prevent payload from being too large
    const limitedOrders = (orders || []).slice(-100);

    return {
      categories,
      items: optimizedItems,
      settings: optimizedSettings,
      orders: limitedOrders,
    };
  };

  const syncToCloud = async () => {
    try {
      // Optimize data with compressed images for syncing (reduces payload size but keeps images)
      const optimizedData = await optimizeDataForSync();
      
      // Calculate payload size
      const payloadString = JSON.stringify(optimizedData);
      const payloadSizeKB = new Blob([payloadString]).size / 1024;
      const payloadSizeMB = payloadSizeKB / 1024;
      
      console.log(`📦 Sync payload size: ${payloadSizeKB.toFixed(2)}KB (${payloadSizeMB.toFixed(2)}MB)`);
      console.log(`📸 Images are compressed for sync (400px max, 40% quality)`);
      
      // Vercel has a 4.5MB limit for serverless functions
      // If still too large, limit orders to last 100
      if (payloadSizeMB > 3.5) {
        console.warn('⚠️ Payload still large, limiting orders to last 100');
        optimizedData.orders = (optimizedData.orders || []).slice(-100);
        const newPayloadString = JSON.stringify(optimizedData);
        const newPayloadSizeKB = new Blob([newPayloadString]).size / 1024;
        console.log(`📦 Optimized payload size: ${newPayloadSizeKB.toFixed(2)}KB`);
      }
      
      const response = await fetch(getApiUrl(), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...getApiAuthHeaders(),
        } as Record<string, string>,
        body: JSON.stringify(optimizedData),
      });

      // Check if response is ok before parsing JSON
      if (!response.ok) {
        const errorText = await response.text();
        console.error(`❌ HTTP ${response.status} Error:`, errorText.substring(0, 200));
        
        if (response.status === 413) {
          console.error('❌ Payload too large! Current size:', payloadSizeMB.toFixed(2), 'MB');
          throw new Error(`Payload muito grande (${payloadSizeMB.toFixed(2)}MB). Limite do Vercel: 4.5MB. Tente limpar pedidos antigos.`);
        }
        
        throw new Error(`HTTP ${response.status}: ${errorText.substring(0, 100)}`);
      }

      const result = await response.json();
      if (result.success) {
        console.log('Data synced to cloud successfully');
        const now = new Date();
        setLastSyncStatus({ 
          success: true, 
          time: now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
        });
        // Also save sync time to localStorage
        try {
          localStorage.setItem('minas_v2_lastSync', JSON.stringify({ time: now.toISOString(), success: true }));
        } catch (e) {
          console.error('Error saving sync time:', e);
        }
        return true;
      } else {
        console.error('Failed to sync to cloud:', result.error);
        setLastSyncStatus({ 
          success: false, 
          time: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
          error: result.error 
        });
        return false;
      }
    } catch (error) {
      console.error('Error syncing to cloud:', error);
      setLastSyncStatus({ 
        success: false, 
        time: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
        error: error instanceof Error ? error.message : 'Erro desconhecido'
      });
      return false;
    }
  };

  const loadFromCloud = async (preserveLocalImages = false) => {
    try {
      const response = await fetch(getApiUrl());
      const result = await response.json();
      
      if (result.success && result.data) {
        const cloudData = result.data;
        
        // Only update if cloud data exists
        if (cloudData.categories && cloudData.items && cloudData.settings) {
          // Merge with local data if preserveLocalImages is true
          let mergedItems = cloudData.items;
          let mergedSettings = cloudData.settings;
          
          if (preserveLocalImages) {
            // Preserve local images in items - but only if local image exists
            // If local image is empty, it means it was never set or was cleared
            mergedItems = cloudData.items.map((cloudItem: MenuItem) => {
              const localItem = items.find(item => item.id === cloudItem.id);
              // Use cloud image if it exists (since it now contains compressed images from admin sync),
              // otherwise keep local image. This ensures mobile gets the updated images.
              return {
                ...cloudItem,
                image: (cloudItem.image && cloudItem.image.trim() !== '') ? cloudItem.image : (localItem?.image || '')
              };
            });
            
            // Preserve local images in settings - but only if cloud image is missing
            mergedSettings = {
              ...cloudData.settings,
              logo: (cloudData.settings.logo && cloudData.settings.logo.trim() !== '') ? cloudData.settings.logo : (settings.logo || ''),
              logoSize: cloudData.settings.logoSize || settings.logoSize,
              logoSizePx: cloudData.settings.logoSizePx || settings.logoSizePx,
              heroVideo: (cloudData.settings.heroVideo && cloudData.settings.heroVideo.trim() !== '') ? cloudData.settings.heroVideo : (settings.heroVideo || ''),
              heroImage: (cloudData.settings.heroImage && cloudData.settings.heroImage.trim() !== '') ? cloudData.settings.heroImage : (settings.heroImage || ''),
              aboutImage1: (cloudData.settings.aboutImage1 && cloudData.settings.aboutImage1.trim() !== '') ? cloudData.settings.aboutImage1 : (settings.aboutImage1 || ''),
              aboutImage1Size: cloudData.settings.aboutImage1Size || settings.aboutImage1Size,
              aboutImage1SizePx: cloudData.settings.aboutImage1SizePx || settings.aboutImage1SizePx,
              aboutImage2: (cloudData.settings.aboutImage2 && cloudData.settings.aboutImage2.trim() !== '') ? cloudData.settings.aboutImage2 : (settings.aboutImage2 || ''),
              aboutImage2Size: cloudData.settings.aboutImage2Size || settings.aboutImage2Size,
              aboutImage2SizePx: cloudData.settings.aboutImage2SizePx || settings.aboutImage2SizePx
            };
          } else {
            // If not preserving, use cloud data as-is (but cloud data has no images, so they'll be empty)
            // In this case, we should keep local images if they exist
            mergedItems = cloudData.items.map((cloudItem: MenuItem) => {
              const localItem = items.find(item => item.id === cloudItem.id);
              return {
                ...cloudItem,
                image: localItem?.image || '' // Keep local image if exists, otherwise empty
              };
            });
            
            mergedSettings = {
              ...cloudData.settings,
              logo: settings.logo || '',
              logoSize: cloudData.settings.logoSize || settings.logoSize,
              logoSizePx: cloudData.settings.logoSizePx || settings.logoSizePx,
              heroVideo: settings.heroVideo || '',
              heroImage: settings.heroImage || '',
              aboutImage1: settings.aboutImage1 || '',
              aboutImage1Size: cloudData.settings.aboutImage1Size || settings.aboutImage1Size,
              aboutImage1SizePx: cloudData.settings.aboutImage1SizePx || settings.aboutImage1SizePx,
              aboutImage2: settings.aboutImage2 || '',
              aboutImage2Size: cloudData.settings.aboutImage2Size || settings.aboutImage2Size,
              aboutImage2SizePx: cloudData.settings.aboutImage2SizePx || settings.aboutImage2SizePx
            };
          }
          
          // Auto-update restaurant name if it's the old one
          if (mergedSettings.name === 'Fogão & Sabor' || mergedSettings.name === 'Fogao & Sabor') {
            mergedSettings.name = 'Fogão a Lenha';
            console.log('✅ Restaurant name updated from cloud data: "Fogão & Sabor" → "Fogão a Lenha"');
          }
          
          setCategories(cloudData.categories);
          setItems(mergedItems);
          setSettings(mergedSettings);
          if (cloudData.orders) {
            setOrders(cloudData.orders);
          }
          
          // Also save merged data to localStorage
          try {
            localStorage.setItem('minas_v2_categories', JSON.stringify(cloudData.categories));
            localStorage.setItem('minas_v2_items', JSON.stringify(mergedItems));
            localStorage.setItem('minas_v2_settings', JSON.stringify(mergedSettings));
            if (cloudData.orders) {
              localStorage.setItem('minas_v2_orders', JSON.stringify(cloudData.orders));
            }
          } catch (e) {
            console.error('Error saving to localStorage:', e);
          }
          
          console.log('Data loaded from cloud successfully', preserveLocalImages ? '(preserved local images)' : '');
          return true;
        }
      }
      return false;
    } catch (error) {
      console.error('Error loading from cloud:', error);
      return false;
    }
  };

  // Load last sync status from localStorage
  useEffect(() => {
    try {
      const stored = localStorage.getItem('minas_v2_lastSync');
      if (stored) {
        const syncData = JSON.parse(stored);
        if (syncData.time) {
          const syncTime = new Date(syncData.time);
          setLastSyncStatus({
            success: syncData.success || false,
            time: syncTime.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
          });
        }
      }
    } catch (e) {
      console.error('Error loading sync status:', e);
    }
  }, []);

  // Ref to track admin state for the checkCloudUpdates interval
  const isAdminOpenRef = useRef(isAdminOpen);
  useEffect(() => {
    isAdminOpenRef.current = isAdminOpen;
  }, [isAdminOpen]);

  // Backup function - saves current data before overwriting
  const createBackup = (cats: Category[], its: MenuItem[], sets: RestaurantSettings, ords: Order[]) => {
    try {
      const backup = {
        categories: JSON.parse(JSON.stringify(cats)),
        items: JSON.parse(JSON.stringify(its)),
        settings: JSON.parse(JSON.stringify(sets)),
        orders: JSON.parse(JSON.stringify(ords)),
        timestamp: new Date().toISOString()
      };
      localStorage.setItem('minas_v2_backup', JSON.stringify(backup));
      console.log('✅ Backup created:', backup.timestamp);
    } catch (error) {
      console.error('Error creating backup:', error);
    }
  };

  // Load from cloud on mount - preserve local images
  useEffect(() => {
    let lastCloudUpdate: string | null = null;
    
    const checkCloudUpdates = async () => {
      try {
        // Create backup before loading from cloud
        createBackup(categories, items, settings, orders);
        
        const response = await fetch(getApiUrl());
        const result = await response.json();
        
        if (result.success && result.data && result.lastUpdated) {
          // Check if cloud data is newer than what we have
          if (lastCloudUpdate !== result.lastUpdated) {
            const wasNew = lastCloudUpdate !== null; // First load doesn't count as "new"
            lastCloudUpdate = result.lastUpdated;
            
            if (wasNew) {
              // Don't auto-update if admin panel is open to prevent overwriting local edits
              if (isAdminOpenRef.current) {
                console.log('🔄 New data detected in cloud, but admin panel is open. Skipping auto-update to prevent overwriting edits.');
                return;
              }
              
              console.log('🔄 New data detected in cloud, updating...');
              await loadFromCloud(true);
              
              // Show a subtle notification that data was updated
              setLastSyncStatus({
                success: true,
                time: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
              });
            } else {
              // Initial load
              await loadFromCloud(true);
              console.log('Initial data loaded from cloud (local images preserved)');
            }
          }
        } else {
          console.log('No cloud data found, using localStorage');
        }
        setIsInitialized(true);
      } catch (error) {
        console.error('Error checking cloud updates:', error);
        setIsInitialized(true);
      }
    };
    
    // Initial load
    checkCloudUpdates();
    
    // Check for updates every 30 seconds
    const interval = setInterval(checkCloudUpdates, 30 * 1000);
    
    // Also check when page becomes visible (user comes back to tab)
    const handleVisibilityChange = () => {
      if (!document.hidden) {
        checkCloudUpdates();
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);
    
    return () => {
      clearInterval(interval);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, []);

  // Close category dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      if (!target.closest('.category-dropdown-container')) {
        setOpenCategoryDropdown(null);
      }
    };

    if (openCategoryDropdown) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [openCategoryDropdown]);

  // Auto-sync to cloud when data changes (debounced)
  useEffect(() => {
    if (!isInitialized) return;
    
    const syncTimeout = setTimeout(() => {
      syncToCloud();
    }, 2000); // Wait 2 seconds after last change before syncing

    return () => clearTimeout(syncTimeout);
  }, [categories, items, settings, isInitialized]);

  // No forced migration - allow any name

  // Recovery check ref - ensures recovery only runs once
  const recoveryCheckedRef = useRef(false);
  
  // Recovery check - tries to recover "Prato do Dia" category after initialization
  useEffect(() => {
    if (!isInitialized || recoveryCheckedRef.current) return;
    recoveryCheckedRef.current = true;
    
    // Check if we need to recover or add "Prato do Dia"
    const checkAndRecover = () => {
      try {
        const backupStr = localStorage.getItem('minas_v2_backup');
        const currentCategories = JSON.parse(localStorage.getItem('minas_v2_categories') || '[]');
        const hasPratoDoDia = currentCategories.some((cat: Category) => 
          cat.name && cat.name.toLowerCase().includes('prato') && cat.name.toLowerCase().includes('dia')
        );
        
        if (!hasPratoDoDia && backupStr) {
          const backup = JSON.parse(backupStr);
          const backupHasPratoDoDia = backup.categories?.some((cat: Category) => 
            cat.name && cat.name.toLowerCase().includes('prato') && cat.name.toLowerCase().includes('dia')
          );
          
          if (backupHasPratoDoDia) {
            // Recover from backup
            console.log('🔄 Recovering "Prato do Dia" category from backup...');
            setCategories(backup.categories);
            setItems(backup.items);
            setSettings(backup.settings);
            if (backup.orders) setOrders(backup.orders);
            return;
          }
        }
        
        // If no backup or backup doesn't have it, add the category
        if (!hasPratoDoDia) {
          console.log('➕ Adding "Prato do Dia" category...');
          const newCategory: Category = {
            id: generateId(),
            name: 'Prato do Dia'
          };
          setCategories(prev => {
            // Check if already exists to avoid duplicates
            const exists = prev.some(cat => 
              cat.name.toLowerCase().includes('prato') && cat.name.toLowerCase().includes('dia')
            );
            return exists ? prev : [...prev, newCategory];
          });
        }
      } catch (error) {
        console.error('Error in recovery check:', error);
      }
    };
    
    // Wait a bit for state to settle, then check
    const timeout = setTimeout(checkAndRecover, 1000);
    return () => clearTimeout(timeout);
  }, [isInitialized]);

  // Auto-save to localStorage (only after initialization to avoid overwriting loaded data)
  useEffect(() => {
    if (!isInitialized) return;
    try {
      // Create backup before saving (only once per save cycle to avoid loops)
      createBackup(categories, items, settings, orders);
      localStorage.setItem('minas_v2_categories', JSON.stringify(categories));
    } catch (error) {
      console.error('Error saving categories to localStorage:', error);
    }
  }, [categories, isInitialized]);

  useEffect(() => {
    if (!isInitialized) return;
    try {
      const itemsJson = JSON.stringify(items);
      const sizeInMB = new Blob([itemsJson]).size / 1024 / 1024;
      
      if (sizeInMB > 4) {
        console.warn('Items data is too large for localStorage:', sizeInMB.toFixed(2), 'MB');
        // Try to save without images if too large
        const itemsWithoutLargeImages = items.map(item => ({
          ...item,
          image: item.image && item.image.length > 100000 ? undefined : item.image
        }));
        localStorage.setItem('minas_v2_items', JSON.stringify(itemsWithoutLargeImages));
      } else {
        localStorage.setItem('minas_v2_items', itemsJson);
      }
    } catch (error) {
      console.error('Error saving items to localStorage:', error);
      // Only show alert if it's actually a quota error, not other errors
      if (error instanceof DOMException && error.name === 'QuotaExceededError') {
        try {
          const itemsJsonForSize = JSON.stringify(items);
          const currentSize = new Blob([itemsJsonForSize]).size / 1024 / 1024;
          console.error('Quota exceeded. Current items size:', currentSize.toFixed(2), 'MB');
        } catch (e) {
          console.error('Error calculating size:', e);
        }
        alert('Armazenamento cheio! Algumas imagens podem não ter sido salvas. Tente remover imagens antigas ou usar imagens menores.');
      }
    }
  }, [items, isInitialized]);

  useEffect(() => {
    if (!isInitialized) return;
    try {
      const settingsJson = JSON.stringify(settings);
      const sizeInMB = new Blob([settingsJson]).size / 1024 / 1024;
      
      // Try to save normally first
      try {
        localStorage.setItem('minas_v2_settings', settingsJson);
      } catch (saveError) {
        // Only handle quota errors, ignore other errors
        if (saveError instanceof DOMException && saveError.name === 'QuotaExceededError') {
          console.warn('Quota exceeded. Settings size:', sizeInMB.toFixed(2), 'MB. Trying without largest files.');
          // If still fails, try without very large files
          try {
            const settingsWithoutLargeMedia = {
              ...settings,
              heroVideo: settings.heroVideo && settings.heroVideo.length > 10000000 ? undefined : settings.heroVideo,
              heroImage: settings.heroImage && settings.heroImage.length > 2000000 ? undefined : settings.heroImage,
              aboutImage1: settings.aboutImage1 && settings.aboutImage1.length > 2000000 ? undefined : settings.aboutImage1,
              aboutImage2: settings.aboutImage2 && settings.aboutImage2.length > 2000000 ? undefined : settings.aboutImage2,
            };
            localStorage.setItem('minas_v2_settings', JSON.stringify(settingsWithoutLargeMedia));
            console.warn('Saved settings without largest media files');
          } catch {
            // If still fails, throw to outer catch
            throw saveError;
          }
        } else {
          // Re-throw non-quota errors
          throw saveError;
        }
      }
    } catch (error) {
      console.error('Error saving settings to localStorage:', error);
      // Only show alert if it's actually a quota error
      if (error instanceof DOMException && error.name === 'QuotaExceededError') {
        try {
          const settingsJsonForSize = JSON.stringify(settings);
          const currentSize = new Blob([settingsJsonForSize]).size / 1024 / 1024;
          console.error('Quota exceeded. Current settings size:', currentSize.toFixed(2), 'MB');
        } catch (e) {
          console.error('Error calculating size:', e);
        }
        alert('Armazenamento cheio! Alguns arquivos de mídia podem não ter sido salvos. Tente remover arquivos antigos ou usar arquivos menores.');
      } else {
        // Log other errors but don't show alert
        console.error('Non-quota error saving settings:', error);
      }
    }
  }, [settings, isInitialized]);

  useEffect(() => {
    if (!isInitialized) return;
    try {
      localStorage.setItem('minas_v2_orders', JSON.stringify(orders));
    } catch (error) {
      console.error('Error saving orders to localStorage:', error);
    }
  }, [orders, isInitialized]);

  // Admin tabs
  const [adminTab, setAdminTab] = useState<'items' | 'categories' | 'orders' | 'settings'>('orders');

  // Checkout form
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [deliveryAddress, setDeliveryAddress] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('Dinheiro');

  const addToCart = (item: MenuItem) => {
    console.log('🛒 Adding to cart:', item.name, 'Available:', item.available);
    if (!item.available) {
      console.warn('⚠️ Item is not available:', item.name);
      return;
    }
    setCart(prev => {
      const existing = prev.find(i => i.item.id === item.id);
      if (existing) {
        const updated = prev.map(i => i.item.id === item.id ? { ...i, quantity: i.quantity + 1 } : i);
        console.log('✅ Item quantity increased. Cart:', updated);
        return updated;
      }
      const updated = [...prev, { item, quantity: 1 }];
      console.log('✅ Item added to cart. Cart:', updated);
      return updated;
    });
    // Open cart after adding
    setIsCartOpen(true);
  };

  const removeFromCart = (itemId: string) => {
    setCart(prev => prev.filter(i => i.item.id !== itemId));
  };

  const updateQuantity = (itemId: string, delta: number) => {
    setCart(prev => prev.map(i => {
      if (i.item.id === itemId) {
        const newQty = Math.max(1, i.quantity + delta);
        return { ...i, quantity: newQty };
      }
      return i;
    }));
  };

  const cartTotal = cart.reduce((acc, curr) => acc + (curr.item.price * curr.quantity), 0);

  const placeOrder = () => {
    if (!customerName || !customerPhone || !deliveryAddress) {
      alert('Por favor, preencha todos os campos obrigatórios.');
      return;
    }

    const orderId = generateId();
    const newOrder: Order = {
      id: orderId,
      customerName,
      customerPhone,
      address: deliveryAddress,
      items: [...cart],
      total: cartTotal + settings.deliveryFee,
      status: 'pending',
      createdAt: new Date().toISOString(),
      paymentMethod,
    };

    // Add to orders list
    setOrders(prev => [newOrder, ...prev]);

    // Prepare WhatsApp message
    const itemsList = cart.map(i => `*${i.quantity}x ${i.item.name}* - R$ ${(i.item.price * i.quantity).toFixed(2)}`).join('\n');
    const message = `*NOVO PEDIDO #${orderId}*\n\n` +
      `*Cliente:* ${customerName}\n` +
      `*Telefone:* ${customerPhone}\n` +
      `*Endereço:* ${deliveryAddress}\n` +
      `*Pagamento:* ${paymentMethod}\n\n` +
      `*Itens:*\n${itemsList}\n\n` +
      `*Subtotal:* R$ ${cartTotal.toFixed(2)}\n` +
      `*Taxa de Entrega:* R$ ${settings.deliveryFee.toFixed(2)}\n` +
      `*TOTAL:* R$ ${(cartTotal + settings.deliveryFee).toFixed(2)}\n\n` +
      `_Pedido realizado via Site_`;

    const whatsappUrl = `https://wa.me/55${settings.whatsapp.replace(/\D/g, '')}?text=${encodeURIComponent(message)}`;

    // Clear cart and close modals
    setCart([]);
    setIsCheckoutOpen(false);
    setIsPaymentReviewOpen(false);
    setIsCartOpen(false);
    
    // Show confirmation screen
    setOrderConfirmation(newOrder);
    
    // Reset form
    setCustomerName('');
    setCustomerPhone('');
    setDeliveryAddress('');

    // Open WhatsApp in new tab
    window.open(whatsappUrl, '_blank');
  };

  const filteredItems = activeCategory === 'all' 
    ? items 
    : items.filter(i => i.category === activeCategory);

  // Export all data WITH images for mobile sync (full data including images)
  const exportDataWithImages = () => {
    try {
      const exportData = {
        categories: categories,
        items: items, // Include images
        settings: settings, // Include all images
        orders: [], // Don't export orders
        exportDate: new Date().toISOString(),
        version: '2.0',
        optimized: false, // This export includes images
        hasImages: true
      };
      
      const dataStr = JSON.stringify(exportData);
      const sizeInKB = new Blob([dataStr]).size / 1024;
      const sizeInMB = sizeInKB / 1024;
      
      if (sizeInMB > 4) {
        alert(`⚠️ ATENÇÃO: O arquivo é muito grande (${sizeInMB.toFixed(2)}MB).\n\nPara enviar via WhatsApp, use "Copiar para Celular (Otimizado)" que remove as imagens.\n\nEste export completo é para backup ou sincronização manual.`);
      }
      
      // Copy to clipboard
      navigator.clipboard.writeText(dataStr).then(() => {
        alert(`✅ Dados completos (COM imagens) copiados para área de transferência!\n\nTamanho: ${sizeInKB.toFixed(2)}KB (${sizeInMB.toFixed(2)}MB)\n\nCole no celular usando "Colar JSON (Texto Único)" ou "Colar JSON em Partes".`);
      }).catch(() => {
        // Fallback: show in prompt
        prompt('Copie este JSON completo (COM imagens):', dataStr);
      });
    } catch (error) {
      console.error('Error exporting data with images:', error);
      alert('Erro ao exportar dados com imagens.');
    }
  };

  // Restore backup from localStorage
  const restoreFromBackup = () => {
    try {
      const backupStr = localStorage.getItem('minas_v2_backup');
      if (!backupStr) {
        alert('❌ Nenhum backup encontrado no armazenamento local.\n\nO backup automático é criado antes de sincronizações com a nuvem.');
        return;
      }
      
      const backup = JSON.parse(backupStr);
      
      if (!backup.categories || !backup.items || !backup.settings) {
        alert('❌ Backup inválido ou corrompido.');
        return;
      }
      
      const backupDate = backup.timestamp ? new Date(backup.timestamp).toLocaleString('pt-BR') : 'Data desconhecida';
      const confirmMsg = `🔄 Restaurar backup?\n\n` +
        `Data do backup: ${backupDate}\n` +
        `Categorias: ${backup.categories.length}\n` +
        `Itens: ${backup.items.length}\n\n` +
        `⚠️ ATENÇÃO: Isso substituirá TODOS os dados atuais!\n\n` +
        `Deseja continuar?`;
      
      if (!confirm(confirmMsg)) {
        return;
      }
      
      // Restore data
      setCategories(backup.categories);
      setItems(backup.items);
      setSettings(backup.settings);
      if (backup.orders) {
        setOrders(backup.orders);
      }
      
      // Save to localStorage
      localStorage.setItem('minas_v2_categories', JSON.stringify(backup.categories));
      localStorage.setItem('minas_v2_items', JSON.stringify(backup.items));
      localStorage.setItem('minas_v2_settings', JSON.stringify(backup.settings));
      if (backup.orders) {
        localStorage.setItem('minas_v2_orders', JSON.stringify(backup.orders));
      }
      
      alert('✅ Backup restaurado com sucesso!\n\nA página será recarregada em 1 segundo...');
      setTimeout(() => window.location.reload(), 1000);
    } catch (error) {
      console.error('Error restoring backup:', error);
      alert('❌ Erro ao restaurar backup. Verifique o console para mais detalhes.');
    }
  };

  // Export all data to JSON file (full backup)
  const exportData = () => {
    try {
      const exportData = {
        categories: categories,
        items: items,
        settings: settings,
        orders: orders,
        exportDate: new Date().toISOString(),
        version: '2.0'
      };
      
      const dataStr = JSON.stringify(exportData, null, 2);
      const dataBlob = new Blob([dataStr], { type: 'application/json' });
      const url = URL.createObjectURL(dataBlob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `minas-backup-${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      
      alert('Dados exportados com sucesso! Salve este arquivo em local seguro.');
    } catch (error) {
      console.error('Error exporting data:', error);
      alert('Erro ao exportar dados. Tente novamente.');
    }
  };

  // Export optimized data for sync (removes ALL images to minimize size)
  const exportDataForSync = () => {
    try {
      // Remove ALL images from items (keep only text data)
      const optimizedItems = items.map(item => ({
        id: item.id,
        name: item.name,
        description: item.description,
        price: item.price,
        category: item.category,
        available: item.available
        // image removed completely
      }));

      // Remove ALL media from settings (keep only text/config)
      const optimizedSettings = {
        name: settings.name,
        phone: settings.phone,
        whatsapp: settings.whatsapp,
        address: settings.address,
        openingHours: settings.openingHours,
        deliveryFee: settings.deliveryFee,
        minOrder: settings.minOrder,
        paymentMethods: settings.paymentMethods
        // All images and videos removed
      };

      const exportData = {
        categories: categories,
        items: optimizedItems,
        settings: optimizedSettings,
        orders: [], // Don't export orders for sync
        exportDate: new Date().toISOString(),
        version: '2.0',
        optimized: true
      };
      
      // Compress JSON (no formatting, single line)
      const dataStr = JSON.stringify(exportData);
      const sizeInKB = new Blob([dataStr]).size / 1024;
      
      // Split into chunks if too large (WhatsApp limit ~65KB per message)
      const maxChunkSize = 60000; // 60KB per chunk
      
      if (dataStr.length > maxChunkSize) {
        // Split into multiple chunks
        const chunks: string[] = [];
        const totalChunks = Math.ceil(dataStr.length / maxChunkSize);
        
        for (let i = 0; i < totalChunks; i++) {
          const start = i * maxChunkSize;
          const end = start + maxChunkSize;
          chunks.push(dataStr.substring(start, end));
        }
        
        // Create a formatted message with all chunks
        let message = `📱 SINCRONIZAÇÃO DE DADOS\n\n`;
        message += `Total: ${totalChunks} parte(s)\n`;
        message += `Tamanho: ${sizeInKB.toFixed(2)} KB\n\n`;
        message += `⚠️ IMPORTANTE: Copie TODAS as partes abaixo e cole no celular usando o botão "Colar JSON em Partes"\n\n`;
        message += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n`;
        
        chunks.forEach((chunk, index) => {
          message += `PARTE ${index + 1}/${totalChunks}:\n`;
          message += `${chunk}\n\n`;
          message += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n`;
        });
        
        // Copy to clipboard
        navigator.clipboard.writeText(message).then(() => {
          alert(`Dados divididos em ${totalChunks} partes!\n\nTamanho total: ${sizeInKB.toFixed(2)} KB\n\nTodas as partes foram copiadas. Envie via WhatsApp e depois use o botão "Colar JSON em Partes" no celular.\n\nNota: Todas as imagens foram removidas para reduzir o tamanho.`);
        }).catch(() => {
          prompt('Copie esta mensagem completa:', message);
        });
      } else {
        // Single chunk - small enough
        navigator.clipboard.writeText(dataStr).then(() => {
          alert(`Dados otimizados copiados!\n\nTamanho: ${sizeInKB.toFixed(2)} KB\n\nCole no celular usando o botão "Colar JSON".\n\nNota: Todas as imagens foram removidas para reduzir o tamanho.`);
        }).catch(() => {
          const textarea = document.createElement('textarea');
          textarea.value = dataStr;
          textarea.style.position = 'fixed';
          textarea.style.opacity = '0';
          document.body.appendChild(textarea);
          textarea.select();
          try {
            document.execCommand('copy');
            alert('Dados copiados! Agora cole no celular usando o botão "Colar JSON".');
          } catch {
            prompt('Copie este texto:', dataStr);
          }
          document.body.removeChild(textarea);
        });
      }
    } catch (error) {
      console.error('Error exporting optimized data:', error);
      alert('Erro ao exportar dados otimizados. Tente novamente.');
    }
  };

  // Import data from multiple chunks (flexible - can paste multiple parts at once)
  const importFromChunks = () => {
    const collectedChunks: Map<number, string> = new Map();
    let totalChunks = 0;
    
    // Helper function to extract chunks from text
    const extractChunksFromText = (text: string): Map<number, string> => {
      const foundChunks: Map<number, string> = new Map();
      
      // Extract total chunks from header
      const totalMatch = text.match(/Total:\s*(\d+)/i);
      if (totalMatch && !totalChunks) {
        totalChunks = parseInt(totalMatch[1]);
      }
      
      // Extract each PARTE X/Y: chunk
      const parteRegex = /PARTE\s*(\d+)\/(\d+):\s*([\s\S]*?)(?=\n\n━━|PARTE\s*\d+\/|$)/gi;
      let match;
      
      while ((match = parteRegex.exec(text)) !== null) {
        const partNum = parseInt(match[1]);
        const totalParts = parseInt(match[2]);
        const chunkData = match[3].trim();
        
        if (!totalChunks) {
          totalChunks = totalParts;
        }
        
        if (chunkData && chunkData.length > 10) {
          foundChunks.set(partNum, chunkData);
        }
      }
      
      return foundChunks;
    };
    
    // First attempt: try to get everything at once
    const firstInput = prompt('Cole o máximo que conseguir do WhatsApp:\n\n(Pode ser o cabeçalho, uma parte, ou várias partes juntas)\n\nSe não conseguir copiar tudo, cole o que conseguir e depois continuaremos.');
    
    if (!firstInput) return;
    
    // Extract chunks from first input
    const firstChunks = extractChunksFromText(firstInput);
    firstChunks.forEach((chunk, partNum) => {
      collectedChunks.set(partNum, chunk);
    });
    
    // If we still don't know total, ask user
    if (!totalChunks) {
      const userInput = prompt(`Quantas partes no total? (veja no início da mensagem do WhatsApp)\n\nJá coletadas: ${collectedChunks.size}`);
      if (!userInput) return;
      totalChunks = parseInt(userInput) || collectedChunks.size;
    }
    
    // Continue collecting missing parts
    while (collectedChunks.size < totalChunks) {
      const missingParts: number[] = [];
      for (let i = 1; i <= totalChunks; i++) {
        if (!collectedChunks.has(i)) {
          missingParts.push(i);
        }
      }
      
      if (missingParts.length === 0) break;
      
      const missingList = missingParts.length <= 5 
        ? missingParts.join(', ')
        : `${missingParts.slice(0, 5).join(', ')}... (e mais ${missingParts.length - 5})`;
      
      const nextInput = prompt(`Faltam ${missingParts.length} parte(s): ${missingList}\n\nCole a(s) parte(s) que faltam:\n\n(Pode colar uma ou várias partes de uma vez)`);
      
      if (!nextInput) {
        const cancel = confirm(`Você cancelou. Deseja continuar com as ${collectedChunks.size} parte(s) já coletadas de ${totalChunks}?`);
        if (!cancel) return;
        break;
      }
      
      // Extract chunks from this input
      const newChunks = extractChunksFromText(nextInput);
      newChunks.forEach((chunk, partNum) => {
        collectedChunks.set(partNum, chunk);
      });
      
      // If no new chunks found, try to extract JSON directly
      if (newChunks.size === 0) {
        const jsonMatch = nextInput.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          // Try to guess which part this is based on missing parts
          const guessPart = missingParts[0];
          collectedChunks.set(guessPart, jsonMatch[0]);
        }
      }
    }
    
    if (collectedChunks.size === 0) {
      alert('Nenhuma parte foi coletada. Importação cancelada.');
      return;
    }
    
    // Reconstruct JSON in order
    const orderedChunks: string[] = [];
    for (let i = 1; i <= totalChunks; i++) {
      if (collectedChunks.has(i)) {
        orderedChunks.push(collectedChunks.get(i)!);
      }
    }
    
    // Combine all chunks
    const combinedData = orderedChunks.join('');
    
    // Show info before importing
    const info = `Coletadas ${collectedChunks.size} parte(s) de ${totalChunks} total.\n\nTamanho: ${(combinedData.length / 1024).toFixed(2)} KB\n\nContinuar com a importação?`;
    if (!confirm(info)) return;
    
    try {
      const importedData = JSON.parse(combinedData);
      processImportedData(importedData);
    } catch (error) {
      console.error('Error parsing combined chunks:', error);
      const missing = totalChunks - collectedChunks.size;
      alert(`Erro ao processar as partes.\n\nPartes coletadas: ${collectedChunks.size}/${totalChunks}${missing > 0 ? `\nFaltam: ${missing} parte(s)` : ''}\nTamanho: ${(combinedData.length / 1024).toFixed(2)} KB\n\nCertifique-se de que copiou todas as partes corretamente do WhatsApp.`);
    }
  };

  // Helper function to process imported data
  const processImportedData = (importedData: {
    categories?: Category[];
    items?: MenuItem[];
    settings?: RestaurantSettings;
    orders?: Order[];
    optimized?: boolean;
  }) => {
    if (!importedData.categories || !importedData.items || !importedData.settings) {
      alert('Arquivo inválido. Certifique-se de que é um backup válido do sistema.');
      return false;
    }
    
    // Check if this is an optimized export (without images)
    const isOptimized = importedData.optimized === true;
    
    // Import data
    console.log('Importing categories:', importedData.categories.length);
    console.log('Importing items:', importedData.items.length);
    console.log('Importing settings:', importedData.settings);
    console.log('Is optimized (no images):', isOptimized);
    
    // Import categories
    setCategories(importedData.categories);
    
    // Import items - preserve images if optimized
    if (isOptimized) {
      // Merge: keep existing images, update other data
      const mergedItems = importedData.items.map(importedItem => {
        const existingItem = items.find(item => item.id === importedItem.id);
        return {
          ...importedItem,
          image: existingItem?.image || importedItem.image || '' // Keep existing image if available
        };
      });
      setItems(mergedItems);
    } else {
      // Full import - replace everything including images
      setItems(importedData.items);
    }
    
    // Import settings - preserve images/videos if optimized
    if (isOptimized) {
      // Merge: keep existing media, update other settings
      const mergedSettings: RestaurantSettings = {
        ...importedData.settings,
        logo: settings.logo || importedData.settings.logo || '', // Keep existing logo
        logoSize: importedData.settings.logoSize || settings.logoSize,
        logoSizePx: importedData.settings.logoSizePx || settings.logoSizePx,
        heroVideo: settings.heroVideo || importedData.settings.heroVideo || '', // Keep existing video
        heroImage: settings.heroImage || importedData.settings.heroImage || '', // Keep existing hero image
        aboutImage1: settings.aboutImage1 || importedData.settings.aboutImage1 || '', // Keep existing about image 1
        aboutImage1Size: importedData.settings.aboutImage1Size || settings.aboutImage1Size,
        aboutImage1SizePx: importedData.settings.aboutImage1SizePx || settings.aboutImage1SizePx,
        aboutImage2: settings.aboutImage2 || importedData.settings.aboutImage2 || '', // Keep existing about image 2
        aboutImage2Size: importedData.settings.aboutImage2Size || settings.aboutImage2Size,
        aboutImage2SizePx: importedData.settings.aboutImage2SizePx || settings.aboutImage2SizePx
      };
      setSettings(mergedSettings);
    } else {
      // Full import - replace everything including media
      setSettings(importedData.settings);
    }
    
    if (importedData.orders) {
      setOrders(importedData.orders);
    }
    
    // Save to localStorage immediately
    try {
      localStorage.setItem('minas_v2_categories', JSON.stringify(importedData.categories));
      localStorage.setItem('minas_v2_items', JSON.stringify(importedData.items));
      localStorage.setItem('minas_v2_settings', JSON.stringify(importedData.settings));
      if (importedData.orders) {
        localStorage.setItem('minas_v2_orders', JSON.stringify(importedData.orders));
      }
      
      console.log('Data saved to localStorage successfully');
      alert('✅ Dados importados com sucesso!\n\nA página será recarregada em 1 segundo...');
      setTimeout(() => window.location.reload(), 1000);
      return true;
    } catch (error) {
      console.error('Error saving imported data:', error);
      if (error instanceof DOMException && error.name === 'QuotaExceededError') {
        alert('Armazenamento cheio! Alguns dados podem não ter sido salvos. Tente limpar o armazenamento primeiro.');
      } else {
        alert('Erro ao salvar dados importados. Tente novamente.');
      }
      return false;
    }
  };

  // Import data from JSON file
  const importData = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'application/json';
    input.onchange = (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;
      
      const reader = new FileReader();
      reader.onload = (event) => {
        try {
          const importedData = JSON.parse(event.target?.result as string);
          
          // Validate structure
          if (!importedData.categories || !Array.isArray(importedData.categories)) {
            alert('Erro: O arquivo não contém categorias válidas.');
            return;
          }
          if (!importedData.items || !Array.isArray(importedData.items)) {
            alert('Erro: O arquivo não contém itens válidos.');
            return;
          }
          if (!importedData.settings || typeof importedData.settings !== 'object') {
            alert('Erro: O arquivo não contém configurações válidas.');
            return;
          }
          
          // Check if optimized (no images)
          const isOptimized = importedData.optimized === true;
          
          // Show summary before importing
          const summary = `Dados encontrados:\n\n` +
            `• ${importedData.categories.length} categoria(s)\n` +
            `• ${importedData.items.length} item(ns)\n` +
            `• Configurações: ${importedData.settings.name || 'N/A'}\n` +
            `${isOptimized ? '\n⚠️ JSON OTIMIZADO: Imagens/vídeos serão preservados (não substituídos).' : '\n📸 Backup completo: Todas as imagens serão substituídas.'}\n\n` +
            `Continuar com a importação?`;
          
          if (confirm(summary)) {
            processImportedData(importedData);
          } else {
            alert('Importação cancelada.');
          }
        } catch (error) {
          console.error('Error importing data:', error);
          const errorMsg = error instanceof Error ? error.message : String(error);
          alert(`Erro ao importar dados:\n\n${errorMsg}\n\nCertifique-se de que o arquivo é um JSON válido.`);
        }
      };
      reader.readAsText(file);
    };
    input.click();
  };

  // Import data from pasted JSON
  const importFromPaste = () => {
    const jsonText = prompt('Cole o JSON exportado aqui:');
    if (!jsonText || jsonText.trim().length === 0) {
      alert('Nenhum texto foi colado. Tente novamente.');
      return;
    }
    
    console.log('Pasted JSON length:', jsonText.length);
    console.log('Pasted JSON preview:', jsonText.substring(0, 100));
    
    try {
      const importedData = JSON.parse(jsonText.trim());
      console.log('Parsed data:', importedData);
      
      // Validate structure
      if (!importedData.categories || !Array.isArray(importedData.categories)) {
        alert('Erro: O JSON não contém categorias válidas.');
        return;
      }
      if (!importedData.items || !Array.isArray(importedData.items)) {
        alert('Erro: O JSON não contém itens válidos.');
        return;
      }
      if (!importedData.settings || typeof importedData.settings !== 'object') {
        alert('Erro: O JSON não contém configurações válidas.');
        return;
      }
      
      // Check if optimized (no images)
      const isOptimized = importedData.optimized === true;
      
      // Show summary before importing
      const summary = `Dados encontrados:\n\n` +
        `• ${importedData.categories.length} categoria(s)\n` +
        `• ${importedData.items.length} item(ns)\n` +
        `• Configurações: ${importedData.settings.name || 'N/A'}\n` +
        `${isOptimized ? '\n⚠️ JSON OTIMIZADO: Imagens/vídeos serão preservados (não substituídos).' : '\n📸 Backup completo: Todas as imagens serão substituídas.'}\n\n` +
        `Continuar com a importação?`;
      
      if (confirm(summary)) {
        processImportedData(importedData);
        const successMsg = isOptimized
          ? '✅ Dados importados com sucesso!\n\nImagens e vídeos foram preservados.\n\nA página será recarregada em 1 segundo...'
          : '✅ Dados importados com sucesso!\n\nA página será recarregada em 1 segundo...';
        alert(successMsg);
      } else {
        alert('Importação cancelada.');
      }
    } catch (error) {
      console.error('Error parsing pasted JSON:', error);
      const errorMsg = error instanceof Error ? error.message : String(error);
      alert(`Erro ao processar JSON:\n\n${errorMsg}\n\nCertifique-se de que:\n• O texto está completo\n• Não há espaços extras no início/fim\n• O JSON está válido`);
    }
  };

  return (
    <div className="min-h-screen font-sans bg-orange-50 text-stone-900 selection:bg-orange-200 selection:text-orange-900">
      {/* Update Banner */}
      {showUpdateBanner && (
        <div className="fixed top-0 left-0 right-0 z-[9999] bg-orange-600 text-white px-4 py-3 sm:py-4 flex items-center justify-between gap-4 shadow-lg">
          <div className="flex items-center gap-3 flex-1">
            <div className="flex-shrink-0">
              <RefreshCw size={20} className="sm:w-6 sm:h-6 animate-spin" />
            </div>
            <div className="flex-1">
              <p className="font-black text-xs sm:text-sm uppercase tracking-widest">Nova versão disponível!</p>
              <p className="text-[10px] sm:text-xs opacity-90 mt-0.5">Toque para atualizar e obter as últimas melhorias</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                setShowUpdateBanner(false);
                // Force reload with cache bypass
                window.location.reload();
              }}
              className="px-4 sm:px-6 py-2 bg-white text-orange-600 font-black text-[10px] sm:text-xs uppercase tracking-widest rounded-lg sm:rounded-xl hover:bg-orange-50 active:scale-95 transition-all"
              style={{ touchAction: 'manipulation', WebkitTapHighlightColor: 'transparent' }}
            >
              Atualizar
            </button>
            <button
              onClick={() => setShowUpdateBanner(false)}
              className="p-2 text-white/80 hover:text-white active:scale-95 transition-all"
              style={{ touchAction: 'manipulation', WebkitTapHighlightColor: 'transparent' }}
            >
              <X size={18} className="sm:w-5 sm:h-5" />
            </button>
          </div>
        </div>
      )}
      {/* Header */}
      <header className="sticky top-0 z-50 bg-white/95 backdrop-blur-md shadow-sm border-b border-orange-100">
        <div className="container mx-auto px-3 sm:px-6 md:px-8 h-16 sm:h-24 flex items-center justify-between gap-3 py-2 sm:py-3">
          <div
            className="flex items-center gap-2 sm:gap-4 min-w-0 flex-1 overflow-hidden"
            onClick={handleHiddenAdminTrigger}
            title="Restaurante"
          >
            {settings.logo ? (
              (() => {
                // Logo size matches title text size: text-[11px] sm:text-lg md:text-2xl
                // Mobile: 11px, sm: 18px (text-lg), md: 24px (text-2xl)
                const logoSizeClasses = 'h-[11px] sm:h-[18px] md:h-[24px] w-auto';
                const customStyle = settings.logoSize === 'custom' && settings.logoSizePx
                  ? { height: `${settings.logoSizePx}px`, width: 'auto' }
                  : {};
                return (
                  <img 
                    src={settings.logo} 
                    alt={settings.name || 'Logo'} 
                    className={`${logoSizeClasses} object-contain rounded-lg sm:rounded-xl flex-shrink-0`}
                    style={customStyle}
                  />
                );
              })()
            ) : (
              <div className="h-[11px] sm:h-[18px] md:h-[24px] aspect-square bg-orange-700 rounded-xl sm:rounded-2xl flex items-center justify-center text-white font-black text-[11px] sm:text-lg md:text-2xl shadow-lg shadow-orange-700/20 rotate-3 flex-shrink-0">
                {(settings.name || 'Fogão a Lenha').split(' ').filter(Boolean).map(n => n[0] || '').join('').slice(0, 2).toUpperCase()}
              </div>
            )}
            <div className="flex flex-col justify-center min-w-0 flex-1 overflow-hidden pr-1 sm:pr-2">
              <h1 className="text-[11px] sm:text-lg md:text-2xl font-black text-orange-900 leading-tight sm:leading-none tracking-tight mb-0.5 sm:mb-1">{settings.name || 'Fogão a Lenha'}</h1>
              <p className="text-[8px] sm:text-[11px] text-green-700 font-bold tracking-[0.1em] sm:tracking-[0.2em] uppercase">Comida Caseira</p>
            </div>
          </div>

          <div className="hidden md:flex items-center gap-8">
            <a href="#menu" className="text-stone-600 hover:text-orange-700 font-bold text-sm uppercase tracking-widest transition-colors">Cardápio</a>
            <a href="#about" className="text-stone-600 hover:text-orange-700 font-bold text-sm uppercase tracking-widest transition-colors">Sobre</a>
            <a href="#contact" className="text-stone-600 hover:text-orange-700 font-bold text-sm uppercase tracking-widest transition-colors">Contato</a>
          </div>

          <div className="flex items-center gap-2 sm:gap-3 flex-shrink-0">
            <button 
              onClick={() => setIsCartOpen(true)}
              onTouchStart={(e) => e.stopPropagation()}
              className="relative p-2 sm:p-3 bg-orange-50 text-orange-700 hover:bg-orange-100 rounded-xl sm:rounded-2xl transition-all active:scale-95"
              style={{ touchAction: 'manipulation', WebkitTapHighlightColor: 'transparent' }}
            >
              <ShoppingCart size={18} className="sm:w-[22px] sm:h-[22px]" />
              {cart.length > 0 && (
                <span className="absolute -top-1 -right-1 bg-green-600 text-white text-[9px] sm:text-[10px] font-black w-5 h-5 sm:w-6 sm:h-6 rounded-full flex items-center justify-center border-2 sm:border-4 border-white shadow-md">
                  {cart.length}
                </span>
              )}
            </button>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="relative h-[400px] sm:h-[500px] md:h-[600px] flex items-center justify-center overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-black/60 via-black/40 to-transparent z-10" />
        {settings.heroVideo ? (
          <video 
            key={`hero-video-${settings.heroVideo.substring(0, 50)}`}
            autoPlay 
            muted 
            loop 
            playsInline 
            preload="auto"
            className="absolute inset-0 w-full h-full object-cover scale-105"
            src={settings.heroVideo}
            onError={(e) => {
              console.error('Error loading hero video:', e);
              // Fallback to image if video fails
              const videoElement = e.target as HTMLVideoElement;
              videoElement.style.display = 'none';
            }}
            onLoadedData={() => {
              console.log('Hero video loaded successfully');
            }}
          />
        ) : (
          <img 
            key={`hero-image-${settings.heroImage ? settings.heroImage.substring(0, 50) : 'default'}`}
            src={settings.heroImage || "https://images.unsplash.com/photo-1547592166-23ac45744acd?q=80&w=2071&auto=format&fit=crop"} 
            className="absolute inset-0 w-full h-full object-cover scale-105"
            alt="Restaurante"
            loading="eager"
            onError={(e) => {
              console.error('Error loading hero image:', e);
              // Fallback if image fails to load
              const target = e.target as HTMLImageElement;
              target.src = "https://images.unsplash.com/photo-1547592166-23ac45744acd?q=80&w=2071&auto=format&fit=crop";
            }}
            onLoad={() => {
              console.log('Hero image loaded successfully');
            }}
          />
        )}
        <div className="relative z-20 text-center text-white px-4 max-w-4xl">
          <motion.span 
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="inline-block px-3 py-1 sm:px-4 sm:py-1.5 bg-orange-700 text-white text-[10px] sm:text-xs font-black uppercase tracking-[0.2em] sm:tracking-[0.3em] rounded-full mb-4 sm:mb-6 shadow-xl"
          >
            Bem-vindo!
          </motion.span>
          <motion.h2 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="text-3xl sm:text-4xl md:text-6xl lg:text-8xl font-black mb-4 sm:mb-6 md:mb-8 leading-[0.9] tracking-tighter px-2"
          >
            O sabor <span className="text-orange-400 underline decoration-orange-400/30 underline-offset-4 sm:underline-offset-8">autêntico</span> da Comida Caseira
          </motion.h2>
          <motion.p 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="text-sm sm:text-lg md:text-xl lg:text-2xl mb-8 sm:mb-10 md:mb-12 font-medium text-stone-200 max-w-2xl mx-auto leading-relaxed px-2"
          >
            Pedidos pelo site em Adicionar ou pelo WhatssApp clicando no botão abaixo.
          </motion.p>
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.3 }}
            className="flex flex-col sm:flex-row items-center justify-center gap-3 sm:gap-4 w-full px-4"
          >
            <a 
              href="#menu" 
              className="w-full sm:w-auto px-8 sm:px-12 py-3 sm:py-5 bg-orange-700 hover:bg-orange-800 text-white text-sm sm:text-lg font-black rounded-2xl sm:rounded-3xl transition-all shadow-2xl shadow-orange-700/40 hover:-translate-y-1 active:scale-95 uppercase tracking-widest"
            >
              Ver Cardápio
            </a>
            <a 
              href="#contact" 
              className="w-full sm:w-auto px-8 sm:px-12 py-3 sm:py-5 bg-white/10 hover:bg-white/20 backdrop-blur-md text-white text-sm sm:text-lg font-black rounded-2xl sm:rounded-3xl transition-all border border-white/30 hover:-translate-y-1 active:scale-95 uppercase tracking-widest"
            >
              Localização
            </a>
          </motion.div>
        </div>
      </section>

      {/* Categories Bar */}
      <div className="sticky top-16 sm:top-24 z-40 bg-orange-50/90 backdrop-blur-xl border-b border-orange-100 py-3 sm:py-6">
        <div className="container mx-auto px-3 sm:px-4 flex items-center gap-2 sm:gap-4 overflow-x-auto no-scrollbar">
          <button 
            onClick={() => setActiveCategory('all')} 
            onTouchStart={(e) => e.stopPropagation()}
            className={`px-4 sm:px-8 py-2 sm:py-3 rounded-xl sm:rounded-2xl font-black text-[10px] sm:text-xs uppercase tracking-widest whitespace-nowrap transition-all active:scale-95 ${
              activeCategory === 'all' 
                ? 'bg-orange-700 text-white shadow-xl shadow-orange-700/20 -translate-y-0.5' 
                : 'bg-white text-stone-400 hover:text-stone-800 hover:bg-orange-100'
            }`}
            style={{ touchAction: 'manipulation', WebkitTapHighlightColor: 'transparent' }}
          >
            Todos
          </button>
          {[...categories].sort((a, b) => a.name.localeCompare(b.name, 'pt-BR')).map(cat => (
            <button 
              key={cat.id} 
              onClick={() => setActiveCategory(cat.id)} 
              onTouchStart={(e) => e.stopPropagation()}
              className={`px-4 sm:px-8 py-2 sm:py-3 rounded-xl sm:rounded-2xl font-black text-[10px] sm:text-xs uppercase tracking-widest whitespace-nowrap transition-all active:scale-95 ${
                activeCategory === cat.id 
                  ? 'bg-orange-700 text-white shadow-xl shadow-orange-700/20 -translate-y-0.5' 
                  : 'bg-white text-stone-400 hover:text-stone-800 hover:bg-orange-100'
              }`}
              style={{ touchAction: 'manipulation', WebkitTapHighlightColor: 'transparent' }}
            >
              {cat.name}
            </button>
          ))}
        </div>
      </div>

      {/* Menu Grid */}
      <section id="menu" className="py-12 sm:py-16 md:py-24 container mx-auto px-3 sm:px-4">
        <div className="flex flex-col items-center mb-8 sm:mb-12 md:mb-16 text-center">
          <span className="text-orange-700 font-black uppercase tracking-[0.3em] text-[10px] sm:text-xs mb-3 sm:mb-4">Seleção Especial</span>
          <h3 className="text-3xl sm:text-4xl md:text-5xl font-black text-stone-900 tracking-tighter">Nosso Cardápio</h3>
          <div className="w-16 sm:w-20 h-1 sm:h-1.5 bg-orange-700 rounded-full mt-4 sm:mt-6" />
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 sm:gap-8 md:gap-10">
          <AnimatePresence mode="popLayout">
            {filteredItems.map(item => (
              <motion.div 
                layout
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95 }}
                key={item.id} 
                className="bg-white rounded-2xl sm:rounded-[2.5rem] shadow-[0_20px_50px_rgba(0,0,0,0.04)] hover:shadow-[0_40px_80px_rgba(0,0,0,0.08)] transition-all overflow-hidden border border-orange-100 group flex flex-col h-full"
                style={{ pointerEvents: 'auto' }}
                onClick={(e) => {
                  // Prevent card click from interfering with button clicks
                  if ((e.target as HTMLElement).closest('button')) {
                    return;
                  }
                }}
              >
                <div className="h-48 sm:h-64 md:h-72 relative overflow-hidden shrink-0">
                  <img 
                    key={`item-${item.id}-${item.image ? item.image.substring(0, 30) : 'no-image'}`}
                    src={item.image || "https://images.unsplash.com/photo-1514327605112-b887c0e61c0a?q=80&w=2070&auto=format&fit=crop"} 
                    className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700" 
                    alt={item.name} 
                    loading="lazy"
                    onError={(e) => {
                      console.error(`Error loading image for item ${item.name}:`, e);
                      const target = e.target as HTMLImageElement;
                      target.src = "https://images.unsplash.com/photo-1514327605112-b887c0e61c0a?q=80&w=2070&auto=format&fit=crop";
                    }}
                    onLoad={() => {
                      console.log(`Image loaded for item: ${item.name}`);
                    }}
                  />
                  {!item.available && (
                    <div className="absolute inset-0 bg-stone-900/80 backdrop-blur-sm flex items-center justify-center">
                      <span className="text-white font-black uppercase tracking-widest text-sm sm:text-lg px-4 sm:px-6 py-1.5 sm:py-2 border-2 border-white/30 rounded-full">Esgotado</span>
                    </div>
                  )}
                  <div className="absolute top-3 right-3 sm:top-6 sm:right-6 bg-white/95 backdrop-blur shadow-xl px-3 py-1.5 sm:px-4 sm:py-2 rounded-xl sm:rounded-2xl font-black text-orange-700 text-sm sm:text-lg">
                    {item.price.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                  </div>
                </div>
                <div className="p-4 sm:p-6 md:p-8 flex flex-col flex-1">
                  <h4 className="text-lg sm:text-xl md:text-2xl font-black text-stone-900 mb-2 sm:mb-3 group-hover:text-orange-700 transition-colors">{item.name}</h4>
                  <p className="text-stone-500 text-xs sm:text-sm mb-4 sm:mb-6 md:mb-8 leading-relaxed line-clamp-4">{item.description}</p>
                  <button 
                    type="button"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      console.log('🔘 Add button clicked for:', item.name, 'Available:', item.available);
                      if (!item.available) {
                        console.warn('⚠️ Cannot add unavailable item:', item.name);
                        alert('Este item não está disponível no momento.');
                        return;
                      }
                      addToCart(item);
                    }}
                    onTouchStart={(e) => {
                      e.stopPropagation();
                      if (!item.available) {
                        e.preventDefault();
                        return;
                      }
                    }}
                    onMouseDown={(e) => {
                      e.stopPropagation();
                    }}
                    disabled={!item.available} 
                    className="mt-auto w-full bg-stone-50 hover:bg-orange-700 text-stone-800 hover:text-white font-black py-3 sm:py-4 md:py-5 rounded-xl sm:rounded-[1.5rem] transition-all flex items-center justify-center gap-2 sm:gap-3 disabled:opacity-30 disabled:cursor-not-allowed group/btn text-xs sm:text-sm active:scale-95 relative z-20 touch-manipulation"
                    style={{ 
                      pointerEvents: 'auto', 
                      zIndex: 20,
                      position: 'relative',
                      touchAction: 'manipulation',
                      WebkitTapHighlightColor: 'transparent'
                    }}
                  >
                    <Plus size={16} className="sm:w-5 sm:h-5 group-hover/btn:rotate-90 transition-transform" /> 
                    ADICIONAR
                  </button>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      </section>

      {/* About Section */}
      <section id="about" className="py-16 sm:py-24 md:py-32 bg-stone-900 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-1/3 h-full bg-orange-700/5 rotate-12 translate-x-1/2" />
        <div className="container mx-auto px-3 sm:px-4 grid md:grid-cols-2 gap-12 sm:gap-16 md:gap-24 items-center relative z-10">
          <div>
            <span className="text-orange-400 font-black tracking-[0.3em] uppercase text-[10px] sm:text-xs mb-4 sm:mb-6 block">Tradição & Família</span>
            <h3 className="text-3xl sm:text-4xl md:text-5xl lg:text-7xl font-black text-white mb-6 sm:mb-8 tracking-tighter leading-[0.9]">Sabor e dedicação em cada detalhe</h3>
            <p className="text-stone-400 text-base sm:text-lg md:text-xl leading-relaxed mb-8 sm:mb-10 md:mb-12 font-medium">
              O restaurante Fogão a Lenha nasceu do desejo de trazer os sabores autênticos da comida caseira.
            </p>
            <div className="grid grid-cols-2 gap-4 sm:gap-6 md:gap-10">
              <div className="p-4 sm:p-6 md:p-8 bg-white/5 rounded-xl sm:rounded-2xl border border-white/10">
                <span className="block text-2xl sm:text-3xl md:text-4xl font-black text-orange-400 mb-1 sm:mb-2">10+</span>
                <span className="text-stone-500 font-bold uppercase tracking-widest text-[10px] sm:text-xs">Anos de Tradição</span>
              </div>
              <div className="p-4 sm:p-6 md:p-8 bg-white/5 rounded-xl sm:rounded-2xl border border-white/10">
                <span className="block text-2xl sm:text-3xl md:text-4xl font-black text-orange-400 mb-1 sm:mb-2">100%</span>
                <span className="text-stone-500 font-bold uppercase tracking-widest text-[10px] sm:text-xs">Ingredientes Locais</span>
              </div>
            </div>
          </div>
          <div className="relative group mt-8 md:mt-0">
            <div className="absolute -inset-4 bg-orange-700/20 blur-[100px] rounded-full group-hover:bg-orange-700/30 transition-all duration-700" />
            <div className="grid grid-cols-2 gap-3 sm:gap-4 md:gap-6 relative">
              {(() => {
                const getImage1HeightClasses = () => {
                  if (settings.aboutImage1Size === 'custom' && settings.aboutImage1SizePx) {
                    return '';
                  }
                  const sizeMap: Record<string, string> = {
                    small: 'h-[150px] sm:h-[200px] md:h-[250px] lg:h-[300px]',
                    medium: 'h-[200px] sm:h-[300px] md:h-[400px] lg:h-[450px]',
                    large: 'h-[250px] sm:h-[350px] md:h-[500px] lg:h-[600px]',
                  };
                  return sizeMap[settings.aboutImage1Size || 'medium'] || sizeMap.medium;
                };
                const image1HeightClasses = getImage1HeightClasses();
                const image1CustomStyle = settings.aboutImage1Size === 'custom' && settings.aboutImage1SizePx
                  ? { height: `${settings.aboutImage1SizePx}px` }
                  : {};
                return (
                  <img 
                    key={`about-1-${settings.aboutImage1 ? settings.aboutImage1.substring(0, 30) : 'default'}`}
                    src={settings.aboutImage1 || "https://images.unsplash.com/photo-1544148103-0773bf10d330?q=80&w=2070&auto=format&fit=crop"} 
                    className={`rounded-2xl sm:rounded-3xl ${image1HeightClasses} w-full object-cover shadow-2xl rotate-3`}
                    style={image1CustomStyle}
                    alt="Ambiente"
                    loading="lazy"
                    onError={(e) => {
                      const target = e.target as HTMLImageElement;
                      target.src = "https://images.unsplash.com/photo-1544148103-0773bf10d330?q=80&w=2070&auto=format&fit=crop";
                    }}
                  />
                );
              })()}
              {(() => {
                const getImage2HeightClasses = () => {
                  if (settings.aboutImage2Size === 'custom' && settings.aboutImage2SizePx) {
                    return '';
                  }
                  const sizeMap: Record<string, string> = {
                    small: 'h-[150px] sm:h-[200px] md:h-[250px] lg:h-[300px]',
                    medium: 'h-[200px] sm:h-[300px] md:h-[400px] lg:h-[450px]',
                    large: 'h-[250px] sm:h-[350px] md:h-[500px] lg:h-[600px]',
                  };
                  return sizeMap[settings.aboutImage2Size || 'medium'] || sizeMap.medium;
                };
                const image2HeightClasses = getImage2HeightClasses();
                const image2CustomStyle = settings.aboutImage2Size === 'custom' && settings.aboutImage2SizePx
                  ? { height: `${settings.aboutImage2SizePx}px` }
                  : {};
                return (
                  <img 
                    key={`about-2-${settings.aboutImage2 ? settings.aboutImage2.substring(0, 30) : 'default'}`}
                    src={settings.aboutImage2 || "https://images.unsplash.com/photo-1541544741938-0af808871cc0?q=80&w=2069&auto=format&fit=crop"} 
                    className={`rounded-2xl sm:rounded-3xl ${image2HeightClasses} w-full object-cover shadow-2xl -rotate-3 mt-6 sm:mt-8 md:mt-12`}
                    style={image2CustomStyle}
                    alt="Comida"
                    loading="lazy"
                    onError={(e) => {
                      const target = e.target as HTMLImageElement;
                      target.src = "https://images.unsplash.com/photo-1541544741938-0af808871cc0?q=80&w=2069&auto=format&fit=crop";
                    }}
                  />
                );
              })()}
            </div>
          </div>
        </div>
      </section>

      {/* Contact Section */}
      <section id="contact" className="py-12 sm:py-20 md:py-32 bg-white">
        <div className="container mx-auto px-3 sm:px-4">
          <div className="grid md:grid-cols-3 gap-6 sm:gap-10 md:gap-16">
            <div className="p-6 sm:p-8 md:p-12 bg-stone-50 rounded-2xl sm:rounded-3xl text-center border border-stone-100 hover:border-orange-200 transition-colors group">
              <div className="w-16 h-16 sm:w-20 sm:h-20 bg-white text-orange-700 rounded-2xl sm:rounded-3xl flex items-center justify-center mb-6 sm:mb-8 mx-auto shadow-xl group-hover:scale-110 transition-transform">
                <Phone size={24} className="sm:w-8 sm:h-8" />
              </div>
              <h4 className="font-black text-xl sm:text-2xl mb-3 sm:mb-4 tracking-tight">Contato</h4>
              <p className="text-stone-500 font-bold mb-1 text-sm sm:text-base">{settings.phone || '(00) 0000-0000'}</p>
              <p className="text-orange-700 font-black text-sm sm:text-base">{settings.whatsapp || '(00) 00000-0000'}</p>
            </div>
            <div className="p-6 sm:p-8 md:p-12 bg-stone-50 rounded-2xl sm:rounded-3xl text-center border border-stone-100 hover:border-orange-200 transition-colors group">
              <div className="w-16 h-16 sm:w-20 sm:h-20 bg-white text-green-700 rounded-2xl sm:rounded-3xl flex items-center justify-center mb-6 sm:mb-8 mx-auto shadow-xl group-hover:scale-110 transition-transform">
                <MapPin size={24} className="sm:w-8 sm:h-8" />
              </div>
              <h4 className="font-black text-xl sm:text-2xl mb-3 sm:mb-4 tracking-tight">Endereço</h4>
              <p className="text-stone-500 font-medium leading-relaxed text-sm sm:text-base">{settings.address || 'Endereço não informado'}</p>
            </div>
            <div className="p-6 sm:p-8 md:p-12 bg-stone-50 rounded-2xl sm:rounded-3xl text-center border border-stone-100 hover:border-orange-200 transition-colors group">
              <div className="w-16 h-16 sm:w-20 sm:h-20 bg-white text-amber-600 rounded-2xl sm:rounded-3xl flex items-center justify-center mb-6 sm:mb-8 mx-auto shadow-xl group-hover:scale-110 transition-transform">
                <Clock size={24} className="sm:w-8 sm:h-8" />
              </div>
              <h4 className="font-black text-xl sm:text-2xl mb-3 sm:mb-4 tracking-tight">Horários</h4>
              <div className="space-y-1">
                {Object.entries(settings.openingHours || {}).map(([day, hours]) => (
                  <p key={day} className="text-stone-500 font-medium text-xs sm:text-sm">
                    <span className="font-black text-stone-800 uppercase text-[9px] sm:text-[10px] tracking-widest mr-2">{day}:</span>
                    {hours}
                  </p>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-orange-50 py-12 sm:py-16 md:py-24 border-t border-orange-100">
        <div className="container mx-auto px-3 sm:px-4 text-center">
          <h2 className="text-2xl sm:text-3xl font-black text-stone-900 mb-3 sm:mb-4 tracking-tighter">{settings.name || 'Fogão a Lenha'}</h2>
          <p className="text-stone-500 font-medium max-w-lg mx-auto mb-8 sm:mb-12 leading-relaxed text-sm sm:text-base">O melhor da culinária mineira direto para sua mesa, com o tempero que você só encontra no interior.</p>
          <div className="flex justify-center gap-6 sm:gap-8 md:gap-10 mb-12 sm:mb-16 flex-wrap">
            <a href="#" className="text-stone-400 hover:text-orange-700 font-black uppercase text-xs tracking-[0.2em] transition-colors">Instagram</a>
            <a href="#" className="text-stone-400 hover:text-orange-700 font-black uppercase text-xs tracking-[0.2em] transition-colors">Facebook</a>
            <a href="#" className="text-stone-400 hover:text-orange-700 font-black uppercase text-xs tracking-[0.2em] transition-colors">Twitter</a>
          </div>
          <div className="pt-12 border-t border-orange-200/50">
            <p className="text-stone-400 text-xs font-bold uppercase tracking-widest">© 2026 {settings.name || 'Fogão a Lenha'}. Feito com paixão mineira.</p>
          </div>
        </div>
      </footer>

      {/* Floating Action Button - WhatsApp */}
      <a 
        href={`https://wa.me/55${(settings.whatsapp || '').replace(/\D/g, '')}`} 
        target="_blank" 
        rel="noopener noreferrer" 
        className="fixed bottom-10 right-10 z-[100] bg-green-600 hover:bg-green-700 text-white p-6 rounded-[2rem] shadow-[0_20px_50px_rgba(22,101,52,0.4)] hover:shadow-[0_20px_50px_rgba(22,101,52,0.6)] transition-all hover:-translate-y-2 active:scale-95 group"
      >
        <MessageCircle size={32} />
        <span className="absolute right-full mr-6 top-1/2 -translate-y-1/2 bg-stone-900 text-white px-6 py-3 rounded-2xl text-xs font-black uppercase tracking-widest opacity-0 group-hover:opacity-100 transition-all translate-x-4 group-hover:translate-x-0 pointer-events-none whitespace-nowrap shadow-2xl">
          Peça pelo WhatsApp
        </span>
      </a>

      {/* Admin Access Modal - hidden access flow */}
      <AnimatePresence>
        {isAdminAccessModalOpen && isDesktop && (
          <div className="fixed inset-0 z-[210] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-stone-900/80 backdrop-blur-sm"
              onClick={() => setIsAdminAccessModalOpen(false)}
            />
            <motion.div
              initial={{ scale: 0.95, opacity: 0, y: 10 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 10 }}
              className="relative w-full max-w-md bg-white rounded-3xl shadow-2xl border border-stone-200 p-6 sm:p-8"
            >
              <div className="flex items-center justify-between mb-5">
                <h3 className="text-xl font-black text-stone-900 tracking-tight">Acesso administrativo</h3>
                <button
                  onClick={() => setIsAdminAccessModalOpen(false)}
                  className="w-9 h-9 rounded-xl bg-stone-100 hover:bg-red-50 text-stone-500 hover:text-red-500 transition-all"
                >
                  <X size={18} className="mx-auto" />
                </button>
              </div>
              <form onSubmit={handleAdminAccessSubmit} className="space-y-4">
                <div>
                  <label className="block text-[11px] font-black uppercase tracking-widest text-stone-500 mb-2">
                    Senha
                  </label>
                  <input
                    type="password"
                    value={adminAccessPassword}
                    onChange={(e) => setAdminAccessPassword(e.target.value)}
                    autoFocus
                    className="w-full px-4 py-3 rounded-2xl border border-stone-300 focus:outline-none focus:ring-2 focus:ring-orange-600"
                    placeholder="Digite a senha de administrador"
                  />
                </div>
                <button
                  type="submit"
                  className="w-full px-4 py-3 rounded-2xl bg-orange-700 hover:bg-orange-800 text-white font-black uppercase tracking-widest text-xs transition-all active:scale-95"
                >
                  Entrar no painel
                </button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Admin Modal - Only accessible on desktop/PC and when authenticated */}
      <AnimatePresence>
        {isAdminOpen && isDesktop && isAdminAuthenticated && (
          <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 sm:p-10">
            <motion.div 
              initial={{ opacity: 0 }} 
              animate={{ opacity: 1 }} 
              exit={{ opacity: 0 }} 
              className="absolute inset-0 bg-stone-900/95 backdrop-blur-xl" 
              onClick={() => setIsAdminOpen(false)} 
            />
            <motion.div 
              initial={{ scale: 0.9, opacity: 0, y: 20 }} 
              animate={{ scale: 1, opacity: 1, y: 0 }} 
              exit={{ scale: 0.9, opacity: 0, y: 20 }} 
              className="relative w-full max-w-7xl bg-white rounded-2xl sm:rounded-[3rem] h-full max-h-[900px] flex flex-col shadow-2xl overflow-hidden border border-white/20"
            >
              <div className="p-4 sm:p-6 md:p-10 border-b border-stone-100 flex items-center justify-between bg-stone-50/50">
                <div className="flex items-center gap-3 sm:gap-6 min-w-0 flex-1">
                  <div className="w-12 h-12 sm:w-16 sm:h-16 bg-orange-700 rounded-2xl sm:rounded-3xl flex items-center justify-center text-white shadow-2xl rotate-3 flex-shrink-0">
                    <Settings size={24} className="sm:w-8 sm:h-8" />
                  </div>
                  <div className="min-w-0">
                    <h3 className="text-xl sm:text-3xl md:text-4xl font-black text-stone-900 tracking-tighter truncate">Painel de Controle</h3>
                    <p className="text-stone-400 font-bold uppercase text-[9px] sm:text-[10px] tracking-widest mt-1 hidden sm:block">Gestão Administrativa do Restaurante</p>
                  </div>
                </div>
                <button 
                  onClick={() => setIsAdminOpen(false)} 
                  className="w-10 h-10 sm:w-14 sm:h-14 bg-white hover:bg-red-50 text-stone-400 hover:text-red-500 rounded-xl sm:rounded-2xl transition-all shadow-xl flex items-center justify-center active:scale-90 flex-shrink-0"
                >
                  <X size={20} className="sm:w-7 sm:h-7" />
                </button>
              </div>

              {/* Sync Status Banner */}
              <div className={`px-4 sm:px-6 md:px-10 py-3 sm:py-4 border-b ${
                lastSyncStatus.success ? 'bg-green-50/50 border-green-200' : 'bg-yellow-50/50 border-yellow-200'
              }`}>
                <div className="flex items-center justify-between gap-4 flex-wrap">
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    <div className={`w-2 h-2 rounded-full flex-shrink-0 ${
                      lastSyncStatus.success ? 'bg-green-500 animate-pulse' : 'bg-yellow-500'
                    }`} />
                    <div className="min-w-0">
                      <p className={`text-xs sm:text-sm font-black uppercase tracking-widest ${
                        lastSyncStatus.success ? 'text-green-700' : 'text-yellow-700'
                      }`}>
                        {lastSyncStatus.success 
                          ? `✅ Última sincronização: ${lastSyncStatus.time || 'Nunca'}`
                          : '⚠️ Armazenamento temporário - Faça backup regularmente'
                        }
                      </p>
                      {lastSyncStatus.error && (
                        <p className="text-[10px] text-yellow-600 mt-1">Erro: {lastSyncStatus.error}</p>
                      )}
                    </div>
                  </div>
                  <button
                    onClick={async (e) => {
                      const button = e.currentTarget;
                      const originalText = button.textContent;
                      button.textContent = 'Sincronizando...';
                      button.disabled = true;
                      const success = await syncToCloud();
                      if (success) {
                        button.textContent = '✅ Sincronizado!';
                        setTimeout(() => {
                          button.textContent = originalText || 'Sincronizar Agora';
                          button.disabled = false;
                        }, 2000);
                      } else {
                        button.textContent = '❌ Erro';
                        setTimeout(() => {
                          button.textContent = originalText || 'Sincronizar Agora';
                          button.disabled = false;
                        }, 2000);
                      }
                    }}
                    className="px-4 sm:px-6 py-2 sm:py-2.5 bg-orange-700 hover:bg-orange-800 text-white font-black uppercase tracking-widest rounded-xl sm:rounded-2xl transition-all active:scale-95 text-[10px] sm:text-xs whitespace-nowrap flex-shrink-0 shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    ☁️ Sincronizar Agora
                  </button>
                </div>
                <div className="mt-2 pt-2 border-t border-yellow-200/50">
                  <p className="text-[10px] text-yellow-700/80 font-medium">
                    ⚠️ <strong>Importante:</strong> O armazenamento na nuvem é temporário. Sempre faça backup completo antes de fechar o navegador.
                  </p>
                </div>
              </div>

              {/* Mobile Tabs - Horizontal */}
              <div className="md:hidden border-b border-stone-100 bg-stone-50/30 overflow-x-auto no-scrollbar">
                <div className="flex gap-2 p-3">
                  {[
                    { id: 'orders', icon: ShoppingCart, label: 'Pedidos' },
                    { id: 'items', icon: MenuIcon, label: 'Cardápio' },
                    { id: 'categories', icon: Plus, label: 'Categorias' },
                    { id: 'settings', icon: Settings, label: 'Configurações' }
                  ].map(tab => (
                    <button 
                      key={tab.id}
                      onClick={() => setAdminTab(tab.id as 'items' | 'categories' | 'orders' | 'settings')} 
                      className={`flex items-center gap-2 px-4 py-3 rounded-xl font-black uppercase text-[10px] tracking-widest transition-all whitespace-nowrap flex-shrink-0 ${
                        adminTab === tab.id 
                          ? 'bg-orange-700 text-white shadow-lg shadow-orange-700/30' 
                          : 'text-stone-400 hover:text-stone-800 hover:bg-white hover:shadow-md'
                      }`}
                    >
                      <tab.icon size={16} />
                      <span className="hidden sm:inline">{tab.label}</span>
                      {tab.id === 'orders' && orders.filter(o => o.status === 'pending').length > 0 && (
                        <span className={`${adminTab === tab.id ? 'bg-white text-orange-700' : 'bg-orange-700 text-white'} w-5 h-5 rounded-full flex items-center justify-center text-[9px] shadow-lg`}>
                          {orders.filter(o => o.status === 'pending').length}
                        </span>
                      )}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex flex-1 overflow-y-auto overflow-x-hidden">
                {/* Desktop Sidebar */}
                <aside className="hidden md:flex w-80 border-r border-stone-100 p-8 flex-col gap-3 bg-stone-50/30">
                  {[
                    { id: 'orders', icon: ShoppingCart, label: 'Pedidos' },
                    { id: 'items', icon: MenuIcon, label: 'Cardápio' },
                    { id: 'categories', icon: Plus, label: 'Categorias' },
                    { id: 'settings', icon: Settings, label: 'Configurações' }
                  ].map(tab => (
                    <button 
                      key={tab.id}
                      onClick={() => setAdminTab(tab.id as 'items' | 'categories' | 'orders' | 'settings')} 
                      className={`flex items-center gap-4 px-6 py-5 rounded-[1.5rem] font-black uppercase text-xs tracking-widest transition-all ${
                        adminTab === tab.id 
                          ? 'bg-orange-700 text-white shadow-2xl shadow-orange-700/30 -translate-y-0.5' 
                          : 'text-stone-400 hover:text-stone-800 hover:bg-white hover:shadow-lg'
                      }`}
                    >
                      <tab.icon size={20} />
                      {tab.label}
                      {tab.id === 'orders' && orders.filter(o => o.status === 'pending').length > 0 && (
                        <span className="ml-auto bg-white text-orange-700 w-6 h-6 rounded-full flex items-center justify-center text-[10px] shadow-lg">
                          {orders.filter(o => o.status === 'pending').length}
                        </span>
                      )}
                    </button>
                  ))}
                  
                  <div className="mt-auto pt-8 border-t border-stone-100">
                    <button 
                      onClick={handleAdminLogout}
                      className="w-full flex items-center gap-4 px-6 py-5 rounded-[1.5rem] font-black uppercase text-xs tracking-widest text-red-500 hover:bg-red-50 transition-all"
                    >
                      <LogOut size={20} /> Sair do Painel
                    </button>
                  </div>
                </aside>

                <main className="flex-1 overflow-y-auto p-4 sm:p-6 md:p-12 bg-white">
                  {adminTab === 'orders' && (
                    <div className="space-y-10">
                      <div className="flex justify-between items-end">
                        <div>
                          <h4 className="text-4xl font-black text-stone-900 tracking-tighter mb-2">Pedidos Recebidos</h4>
                          <p className="text-stone-400 font-bold text-xs uppercase tracking-widest">Acompanhe e gerencie as solicitações</p>
                        </div>
                      </div>
                      
                      {orders.length === 0 ? (
                        <div className="py-32 flex flex-col items-center justify-center bg-stone-50 rounded-[3rem] border-4 border-dashed border-stone-100 text-stone-300">
                          <ShoppingCart size={80} strokeWidth={1} className="mb-6 opacity-20" />
                          <p className="font-black uppercase tracking-[0.2em] text-sm">Nenhum pedido no momento</p>
                        </div>
                      ) : (
                        <div className="grid grid-cols-1 gap-6">
                          {orders.map(order => (
                            <div key={order.id} className="p-8 bg-white border border-stone-100 rounded-[2.5rem] shadow-[0_10px_30px_rgba(0,0,0,0.02)] hover:shadow-[0_20px_60px_rgba(0,0,0,0.05)] transition-all">
                              <div className="flex flex-wrap justify-between items-start gap-6 mb-8">
                                <div>
                                  <div className="flex items-center gap-4 mb-2">
                                    <span className="font-black text-2xl tracking-tighter">#{order.id}</span>
                                    <span className={`px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest ${
                                      order.status === 'pending' ? 'bg-amber-100 text-amber-600' :
                                      order.status === 'preparing' ? 'bg-blue-100 text-blue-600' :
                                      order.status === 'delivered' ? 'bg-green-100 text-green-700' :
                                      'bg-red-100 text-red-700'
                                    }`}>
                                      {order.status === 'pending' ? 'Pendente' :
                                       order.status === 'preparing' ? 'Preparando' :
                                       order.status === 'delivered' ? 'Entregue' : 'Cancelado'}
                                    </span>
                                  </div>
                                  <p className="text-stone-400 font-bold text-xs uppercase tracking-widest">{new Date(order.createdAt).toLocaleString('pt-BR')}</p>
                                </div>
                                <div className="text-right">
                                  <p className="text-3xl font-black text-orange-700 tracking-tighter">{order.total.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</p>
                                  <p className="text-stone-400 font-bold text-[10px] uppercase tracking-widest mt-1">{order.paymentMethod}</p>
                                </div>
                              </div>
                              
                              <div className="grid md:grid-cols-2 gap-12 py-8 border-y border-stone-50">
                                <div className="space-y-4">
                                  <h5 className="font-black text-stone-900 uppercase text-xs tracking-widest flex items-center gap-3">
                                    <MessageCircle size={14} className="text-orange-700" /> Detalhes do Cliente
                                  </h5>
                                  <div>
                                    <p className="font-black text-lg text-stone-900">{order.customerName}</p>
                                    <p className="text-stone-500 font-bold">{order.customerPhone}</p>
                                    <div className="flex items-start gap-2 mt-4 text-stone-400">
                                      <MapPin size={16} className="shrink-0 mt-1" />
                                      <p className="text-sm font-medium leading-relaxed">{order.address}</p>
                                    </div>
                                  </div>
                                </div>
                                <div className="space-y-4">
                                  <h5 className="font-black text-stone-900 uppercase text-xs tracking-widest flex items-center gap-3">
                                    <MenuIcon size={14} className="text-orange-700" /> Itens do Pedido
                                  </h5>
                                  <div className="space-y-2">
                                    {order.items.map((item, idx) => (
                                      <div key={idx} className="flex justify-between items-center bg-stone-50 p-3 rounded-2xl">
                                        <span className="font-bold text-stone-800">{item.quantity}x <span className="font-medium text-stone-500">{item.item.name}</span></span>
                                        <span className="font-black text-stone-900">{(item.item.price * item.quantity).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              </div>
                              
                              <div className="flex flex-wrap gap-3 mt-8">
                                {order.status === 'pending' && (
                                  <button 
                                    onClick={() => setOrders(orders.map(o => o.id === order.id ? {...o, status: 'preparing'} : o))}
                                    className="px-8 py-4 bg-blue-600 hover:bg-blue-700 text-white rounded-2xl font-black uppercase text-xs tracking-widest shadow-xl shadow-blue-600/20 transition-all active:scale-95"
                                  >
                                    Iniciar Preparo
                                  </button>
                                )}
                                {order.status === 'preparing' && (
                                  <button 
                                    onClick={() => setOrders(orders.map(o => o.id === order.id ? {...o, status: 'delivered'} : o))}
                                    className="px-8 py-4 bg-green-600 hover:bg-green-700 text-white rounded-2xl font-black uppercase text-xs tracking-widest shadow-xl shadow-green-600/20 transition-all active:scale-95"
                                  >
                                    Confirmar Entrega
                                  </button>
                                )}
                                {order.status !== 'delivered' && order.status !== 'cancelled' && (
                                  <button 
                                    onClick={() => setOrders(orders.map(o => o.id === order.id ? {...o, status: 'cancelled'} : o))}
                                    className="px-8 py-4 bg-red-50 hover:bg-red-100 text-red-500 rounded-2xl font-black uppercase text-xs tracking-widest transition-all active:scale-95"
                                  >
                                    Cancelar
                                  </button>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  {adminTab === 'items' && (
                    <div className="space-y-10">
                      <div className="flex justify-between items-end">
                        <div>
                          <h4 className="text-4xl font-black text-stone-900 tracking-tighter mb-2">Gerenciar Cardápio</h4>
                          <p className="text-stone-400 font-bold text-xs uppercase tracking-widest">Adicione e edite seus pratos</p>
                        </div>
                        <button 
                          onClick={() => {
                            if (categories.length === 0) {
                              alert('Por favor, crie uma categoria primeiro!');
                              return;
                            }
                            setNewItemForm({ name: '', price: '', description: '', category: categories[0]?.id || '' });
                            setIsNewItemModalOpen(true);
                          }}
                          className="px-8 py-4 bg-orange-700 hover:bg-orange-800 text-white rounded-2xl font-black uppercase text-xs tracking-widest shadow-2xl shadow-orange-700/20 transition-all active:scale-95 flex items-center gap-3"
                        >
                          <Plus size={20} /> Novo Item
                        </button>
                      </div>

                      <div className="grid grid-cols-1 gap-4">
                        {items.map(item => (
                          <div key={item.id} className="p-6 bg-white border border-stone-100 rounded-[2rem] flex flex-wrap items-center gap-8 shadow-sm group">
                            <div className="w-24 h-24 bg-stone-100 rounded-3xl overflow-hidden shrink-0 shadow-lg group-hover:scale-105 transition-transform duration-500">
                              <img src={item.image || "https://images.unsplash.com/photo-1514327605112-b887c0e61c0a?q=80&w=2070&auto=format&fit=crop"} className="w-full h-full object-cover" alt="" />
                            </div>
                            <div className="flex-1 min-w-[200px]">
                              <div className="flex items-center gap-4 mb-2 flex-wrap">
                                <h5 className="font-black text-xl text-stone-900">{item.name}</h5>
                                <div className="relative z-[100] category-dropdown-container" style={{ position: 'relative' }}>
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.preventDefault();
                                      e.stopPropagation();
                                      console.log('Button clicked for item:', item.id);
                                      setOpenCategoryDropdown(openCategoryDropdown === item.id ? null : item.id);
                                    }}
                                    onMouseDown={(e) => {
                                      e.preventDefault();
                                      e.stopPropagation();
                                    }}
                                    className="px-4 py-2 bg-orange-50 text-orange-700 rounded-full font-black uppercase text-[10px] tracking-widest border-2 border-orange-300 hover:border-orange-500 hover:bg-orange-100 active:bg-orange-200 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-orange-500 cursor-pointer transition-all min-w-[140px] flex items-center justify-center gap-2 shadow-sm hover:shadow-md"
                                    title="Clique para alterar a categoria"
                                    style={{ 
                                      pointerEvents: 'auto',
                                      zIndex: 100,
                                      position: 'relative'
                                    }}
                                  >
                                    <Tag size={14} className="flex-shrink-0" />
                                    <span className="truncate text-xs">
                                      {categories.find(c => c.id === item.category)?.name || 'Sem categoria'}
                                </span>
                                    <ChevronDown size={14} className={`flex-shrink-0 transition-transform ${openCategoryDropdown === item.id ? 'rotate-180' : ''}`} />
                                  </button>
                                  {openCategoryDropdown === item.id && (
                                    <div 
                                      className="absolute top-full left-0 mt-2 bg-white border-2 border-orange-300 rounded-2xl shadow-2xl z-[200] min-w-[220px]"
                                      style={{ 
                                        zIndex: 200, 
                                        position: 'absolute',
                                        top: '100%',
                                        left: 0,
                                        maxHeight: 'min(500px, calc(100vh - 200px))'
                                      }}
                                      onClick={(e) => e.stopPropagation()}
                                    >
                                      {categories.length === 0 ? (
                                        <div className="px-4 py-3 text-stone-400 text-xs font-bold">Nenhuma categoria</div>
                                      ) : (
                                        <>
                                          <div className="px-4 py-2 bg-orange-50 border-b border-orange-200 text-[9px] font-black text-orange-700 uppercase tracking-widest sticky top-0 z-10">
                                            {categories.length} Categoria{categories.length !== 1 ? 's' : ''} Disponíve{categories.length !== 1 ? 'is' : 'l'}
                                          </div>
                                          <div 
                                            className="overflow-y-auto"
                                            style={{ 
                                              maxHeight: '400px',
                                              overscrollBehavior: 'contain'
                                            }}
                                          >
                                            {(() => {
                                              console.log('📋 Rendering ALL categories in dropdown:', {
                                                total: categories.length,
                                                allCategories: categories.map((c, i) => `${i + 1}. ${c.name} (ID: ${c.id})`)
                                              });
                                              return null;
                                            })()}
                                            {categories.map((cat, idx) => {
                                              return (
                                                <button
                                                  key={`${item.id}-${cat.id}-${idx}`}
                                                  type="button"
                                                  onClick={(e) => {
                                                    e.preventDefault();
                                                    e.stopPropagation();
                                                    if (cat.id === item.category) {
                                                      setOpenCategoryDropdown(null);
                                                      return;
                                                    }
                                                    
                                                    // Update items state
                                                    const updatedItems = items.map(i => 
                                                      i.id === item.id ? {...i, category: cat.id} : i
                                                    );
                                                    
                                                    // Update state immediately
                                                    setItems(updatedItems);
                                                    
                                                    // Auto-save to localStorage
                                                    try {
                                                      localStorage.setItem('minas_v2_items', JSON.stringify(updatedItems));
                                                      console.log('✅ Category updated:', {
                                                        item: item.name,
                                                        oldCategory: item.category,
                                                        newCategory: cat.id,
                                                        categoryName: cat.name
                                                      });
                                                    } catch (err) {
                                                      console.error('❌ Error saving items:', err);
                                                      alert('Erro ao salvar alteração. Tente novamente.');
                                                    }
                                                    
                                                    setOpenCategoryDropdown(null);
                                                  }}
                                                  className={`w-full text-left px-4 py-3 font-black uppercase text-[10px] tracking-widest transition-all flex items-center gap-2 border-b border-stone-50 last:border-b-0 ${
                                                    cat.id === item.category
                                                      ? 'bg-orange-50 text-orange-700'
                                                      : 'text-stone-700 hover:bg-orange-50 hover:text-orange-700'
                                                  }`}
                                                  style={{ pointerEvents: 'auto' }}
                                                >
                                                  {cat.id === item.category && <CheckCircle size={14} className="flex-shrink-0" />}
                                                  <span className="flex-1">{cat.name}</span>
                                                </button>
                                              );
                                            })}
                                          </div>
                                        </>
                                      )}
                                    </div>
                                  )}
                                </div>
                              </div>
                              <p className="text-stone-400 text-sm line-clamp-1 font-medium">{item.description}</p>
                              <p className="text-orange-700 font-black text-lg mt-2">{item.price.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</p>
                            </div>
                            <div className="flex items-center gap-4">
                              <div className="flex flex-col items-end mr-4">
                                <span className="text-[10px] font-black text-stone-300 uppercase tracking-widest mb-2">Disponível</span>
                                <button 
                                  onClick={() => setItems(items.map(i => i.id === item.id ? {...i, available: !i.available} : i))}
                                  className={`w-14 h-8 rounded-full transition-all relative ${item.available ? 'bg-green-500 shadow-lg shadow-green-500/20' : 'bg-stone-200'}`}
                                >
                                  <div className={`absolute top-1 w-6 h-6 bg-white rounded-full shadow-md transition-all ${item.available ? 'left-7' : 'left-1'}`} />
                                </button>
                              </div>
                              <button 
                                onClick={() => {
                                  const input = document.createElement('input');
                                  input.type = 'file';
                                  input.accept = 'image/*';
                                  input.onchange = async (e) => {
                                    const file = (e.target as HTMLInputElement).files?.[0];
                                    if (file) {
                                      // Check file size (max 5MB before compression)
                                      if (file.size > 5 * 1024 * 1024) {
                                        alert('Imagem muito grande! Por favor, escolha uma imagem menor que 5MB.');
                                        return;
                                      }
                                      try {
                                        await handleFileUpload(file, (base64) => {
                                      setItems(items.map(i => i.id === item.id ? {...i, image: base64} : i));
                                          // Show success feedback
                                          const button = e.target as HTMLElement;
                                          const originalTitle = button.getAttribute('title');
                                          button.setAttribute('title', 'Imagem salva!');
                                          setTimeout(() => {
                                            button.setAttribute('title', originalTitle || 'Trocar Imagem');
                                          }, 2000);
                                        });
                                      } catch (error) {
                                        console.error('Error uploading image:', error);
                                        alert('Erro ao fazer upload da imagem. Tente novamente.');
                                      }
                                    }
                                  };
                                  input.click();
                                }}
                                className="w-12 h-12 flex items-center justify-center text-stone-400 hover:text-green-600 hover:bg-green-50 rounded-2xl transition-all"
                                title="Trocar Imagem"
                              >
                                <Upload size={22} />
                              </button>
                              <button 
                                onClick={() => {
                                  const newName = prompt('Novo nome:', item.name);
                                  if (newName) setItems(items.map(i => i.id === item.id ? {...i, name: newName} : i));
                                }}
                                className="w-12 h-12 flex items-center justify-center text-stone-400 hover:text-orange-700 hover:bg-orange-50 rounded-2xl transition-all"
                                title="Editar Nome"
                              >
                                <Edit size={22} />
                              </button>
                              <button 
                                onClick={() => {
                                  const newPrice = prompt('Novo preço (R$):', item.price.toString());
                                  if (newPrice) {
                                    const price = parseFloat(newPrice.replace(',', '.'));
                                    if (!isNaN(price) && price >= 0) {
                                      setItems(items.map(i => i.id === item.id ? {...i, price} : i));
                                    } else {
                                      alert('Preço inválido. Use apenas números.');
                                    }
                                  }
                                }}
                                className="w-12 h-12 flex items-center justify-center text-stone-400 hover:text-blue-600 hover:bg-blue-50 rounded-2xl transition-all"
                                title="Editar Preço"
                              >
                                <CreditCard size={22} />
                              </button>
                              <button 
                                onClick={() => {
                                  const newDescription = prompt('Nova descrição:', item.description);
                                  if (newDescription !== null) {
                                    setItems(items.map(i => i.id === item.id ? {...i, description: newDescription} : i));
                                  }
                                }}
                                className="w-12 h-12 flex items-center justify-center text-stone-400 hover:text-purple-600 hover:bg-purple-50 rounded-2xl transition-all"
                                title="Editar Descrição"
                              >
                                <MessageCircle size={22} />
                              </button>
                              <button 
                                onClick={() => setItems(items.filter(i => i.id !== item.id))}
                                className="w-12 h-12 flex items-center justify-center text-stone-400 hover:text-red-500 hover:bg-red-50 rounded-2xl transition-all"
                                title="Excluir Item"
                              >
                                <Trash2 size={22} />
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {adminTab === 'categories' && (
                    <div className="space-y-10">
                      <div className="flex justify-between items-end">
                        <div>
                          <h4 className="text-4xl font-black text-stone-900 tracking-tighter mb-2">Categorias</h4>
                          <p className="text-stone-400 font-bold text-xs uppercase tracking-widest">Organize seu cardápio em seções</p>
                        </div>
                        <button 
                          onClick={() => {
                            const name = prompt('Nome da categoria:');
                            if (name && name.trim()) {
                              const newCategory = { id: generateId(), name: name.trim() };
                              const updatedCategories = [...categories, newCategory];
                              setCategories(updatedCategories);
                              // Auto-save to localStorage
                              try {
                                localStorage.setItem('minas_v2_categories', JSON.stringify(updatedCategories));
                              } catch (e) {
                                console.error('Error saving categories:', e);
                              }
                              // Scroll to the new category after a short delay
                              setTimeout(() => {
                                const categoryElement = document.querySelector(`[data-category-id="${newCategory.id}"]`);
                                if (categoryElement) {
                                  categoryElement.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
                                  // Highlight the new category briefly
                                  categoryElement.classList.add('ring-2', 'ring-orange-500');
                                  setTimeout(() => {
                                    categoryElement.classList.remove('ring-2', 'ring-orange-500');
                                  }, 2000);
                                }
                              }, 100);
                            }
                          }}
                          className="px-8 py-4 bg-orange-700 hover:bg-orange-800 text-white rounded-2xl font-black uppercase text-xs tracking-widest shadow-2xl shadow-orange-700/20 transition-all active:scale-95 flex items-center gap-3"
                        >
                          <Plus size={20} /> Nova Categoria
                        </button>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {categories.map(cat => {
                          const itemsInCategory = items.filter(item => item.category === cat.id).length;
                          return (
                          <div key={cat.id} data-category-id={cat.id} className="p-8 bg-white border border-stone-100 rounded-[2.5rem] flex items-center justify-between shadow-sm group hover:border-orange-200 transition-colors">
                            <div className="flex flex-col">
                            <span className="font-black text-lg text-stone-900 tracking-tight">{cat.name}</span>
                              <span className="text-xs text-stone-400 font-bold uppercase tracking-widest mt-1">
                                {itemsInCategory} {itemsInCategory === 1 ? 'item' : 'itens'}
                              </span>
                            </div>
                            <div className="flex gap-2">
                              <button 
                                onClick={() => {
                                  const newName = prompt('Novo nome:', cat.name);
                                  if (newName && newName.trim()) {
                                    const updatedCategories = categories.map(c => c.id === cat.id ? {...c, name: newName.trim()} : c);
                                    setCategories(updatedCategories);
                                    // Update items that use this category
                                    const updatedItems = items.map(item => 
                                      item.category === cat.id ? {...item, category: cat.id} : item
                                    );
                                    setItems(updatedItems);
                                    // Auto-save to localStorage
                                    try {
                                      localStorage.setItem('minas_v2_categories', JSON.stringify(updatedCategories));
                                      localStorage.setItem('minas_v2_items', JSON.stringify(updatedItems));
                                    } catch (e) {
                                      console.error('Error saving categories/items:', e);
                                    }
                                  }
                                }}
                                className="w-10 h-10 flex items-center justify-center text-stone-300 hover:text-orange-700 hover:bg-orange-50 rounded-xl transition-all"
                                title="Editar categoria"
                              >
                                <Edit size={18} />
                              </button>
                              <button 
                                onClick={() => {
                                  // Check if category is being used by any items
                                  const itemsUsingCategory = items.filter(item => item.category === cat.id);
                                  
                                  if (itemsUsingCategory.length > 0) {
                                    const itemCount = itemsUsingCategory.length;
                                    // Find first available category (not the one being deleted)
                                    const firstAvailableCategory = categories.find(c => c.id !== cat.id);
                                    
                                    if (firstAvailableCategory) {
                                      const confirmMessage = `Esta categoria está sendo usada por ${itemCount} item(ns) no cardápio.\n\nDeseja realmente excluir?\n\nOs itens serão movidos para a categoria "${firstAvailableCategory.name}".`;
                                      
                                      if (window.confirm(confirmMessage)) {
                                        // Remove category and update items
                                        const updatedCategories = categories.filter(c => c.id !== cat.id);
                                        setCategories(updatedCategories);
                                        
                                        // Move items to first available category
                                        const updatedItems = items.map(item => 
                                          item.category === cat.id ? {...item, category: firstAvailableCategory.id} : item
                                        );
                                        setItems(updatedItems);
                                        
                                        // Auto-save to localStorage
                                        try {
                                          localStorage.setItem('minas_v2_categories', JSON.stringify(updatedCategories));
                                          localStorage.setItem('minas_v2_items', JSON.stringify(updatedItems));
                                        } catch (e) {
                                          console.error('Error saving categories/items:', e);
                                        }
                                      }
                                    } else {
                                      // No other categories available, create a default one
                                      const confirmMessage = `Esta categoria está sendo usada por ${itemCount} item(ns) no cardápio.\n\nDeseja realmente excluir?\n\nSerá criada uma categoria "Sem Categoria" para os itens.`;
                                      
                                      if (window.confirm(confirmMessage)) {
                                        // Create default category
                                        const defaultCategory = { id: generateId(), name: 'Sem Categoria' };
                                        const updatedCategories = [defaultCategory, ...categories.filter(c => c.id !== cat.id)];
                                        setCategories(updatedCategories);
                                        
                                        // Move items to default category
                                        const updatedItems = items.map(item => 
                                          item.category === cat.id ? {...item, category: defaultCategory.id} : item
                                        );
                                        setItems(updatedItems);
                                        
                                        // Auto-save to localStorage
                                        try {
                                          localStorage.setItem('minas_v2_categories', JSON.stringify(updatedCategories));
                                          localStorage.setItem('minas_v2_items', JSON.stringify(updatedItems));
                                        } catch (e) {
                                          console.error('Error saving categories/items:', e);
                                        }
                                      }
                                    }
                                  } else {
                                    // No items using this category, safe to delete
                                    if (window.confirm(`Deseja realmente excluir a categoria "${cat.name}"?`)) {
                                      const updatedCategories = categories.filter(c => c.id !== cat.id);
                                      setCategories(updatedCategories);
                                      // Auto-save to localStorage
                                      try {
                                        localStorage.setItem('minas_v2_categories', JSON.stringify(updatedCategories));
                                      } catch (e) {
                                        console.error('Error saving categories:', e);
                                      }
                                    }
                                  }
                                }}
                                className="w-10 h-10 flex items-center justify-center text-stone-300 hover:text-red-500 hover:bg-red-50 rounded-xl transition-all"
                                title="Excluir categoria"
                              >
                                <Trash2 size={18} />
                              </button>
                            </div>
                          </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {adminTab === 'settings' && (
                    <div className="max-w-3xl space-y-6 sm:space-y-12">
                      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                        <div>
                          <h4 className="text-2xl sm:text-3xl md:text-4xl font-black text-stone-900 tracking-tighter mb-2">Configurações</h4>
                          <p className="text-stone-400 font-bold text-[10px] sm:text-xs uppercase tracking-widest">Informações públicas do restaurante</p>
                        </div>
                        {/* Mobile Sair Button */}
                        <button 
                          onClick={handleAdminLogout}
                          className="sm:hidden flex items-center gap-2 px-4 py-2 rounded-xl font-black uppercase text-[10px] tracking-widest text-red-500 hover:bg-red-50 transition-all"
                        >
                          <LogOut size={16} /> Sair
                        </button>
                        <div className="flex gap-2 sm:gap-4">
                          <button 
                            onClick={() => {
                              localStorage.setItem('minas_v2_settings', JSON.stringify(settings));
                              localStorage.setItem('minas_v2_categories', JSON.stringify(categories));
                              localStorage.setItem('minas_v2_items', JSON.stringify(items));
                              alert('Todas as alterações foram salvas com sucesso!');
                            }}
                            className="px-4 sm:px-8 py-2 sm:py-4 bg-green-600 hover:bg-green-700 text-white font-black uppercase tracking-widest rounded-xl sm:rounded-2xl shadow-xl shadow-green-600/20 transition-all active:scale-95 flex items-center gap-2 text-[10px] sm:text-xs"
                          >
                            <Save size={14} className="sm:w-[18px] sm:h-[18px]" /> Salvar Tudo
                          </button>
                        </div>
                      </div>
                      
                      <div className="grid grid-cols-1 gap-10">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                          <div className="space-y-4">
                            <label className="text-[10px] font-black text-stone-400 uppercase tracking-[0.3em] flex items-center gap-2">
                              <ImageIcon size={14} className="text-orange-700" /> Logo da Marca
                            </label>
                            <div className="flex items-center gap-6 p-6 bg-stone-50/50 rounded-3xl border border-stone-100">
                              <div className="w-20 h-20 bg-white rounded-2xl border border-stone-200 flex items-center justify-center overflow-hidden shrink-0 p-2">
                                {settings.logo ? (
                                  <img src={settings.logo} className="w-full h-full object-contain object-center" alt="Logo" style={{ maxWidth: '100%', maxHeight: '100%' }} />
                                ) : (
                                  <ImageIcon size={24} className="text-stone-200" />
                                )}
                              </div>
                              <div className="flex-1 space-y-3">
                                <button 
                                  onClick={() => {
                                    const input = document.createElement('input');
                                    input.type = 'file';
                                    input.accept = 'image/*';
                                    input.onchange = (e) => {
                                      const file = (e.target as HTMLInputElement).files?.[0];
                                      if (file) {
                                        handleFileUpload(file, (base) => {
                                          const updatedSettings = {...settings, logo: base};
                                          setSettings(updatedSettings);
                                          // Force immediate save
                                          try {
                                            localStorage.setItem('minas_v2_settings', JSON.stringify(updatedSettings));
                                          } catch (e) {
                                            console.error('Error saving logo:', e);
                                          }
                                        });
                                      }
                                    };
                                    input.click();
                                  }}
                                  className="w-full py-3 bg-white hover:bg-orange-50 text-orange-700 border border-orange-200 rounded-xl font-black text-[10px] uppercase tracking-widest transition-all flex items-center justify-center gap-2"
                                >
                                  <Upload size={14} /> {settings.logo ? 'Trocar Logo' : 'Enviar Logo'}
                                </button>
                                {settings.logo && (
                                  <>
                                    <div className="space-y-2 pt-2 border-t border-stone-200">
                                      <label className="text-[9px] font-black text-stone-400 uppercase tracking-[0.2em]">Tamanho da Logo</label>
                                      <div className="grid grid-cols-3 gap-2">
                                        <button
                                          onClick={() => setSettings({...settings, logoSize: 'small'})}
                                          className={`py-2 px-2 text-[9px] font-black uppercase rounded-lg transition-all ${
                                            settings.logoSize === 'small' || !settings.logoSize
                                              ? 'bg-orange-700 text-white'
                                              : 'bg-white text-stone-600 hover:bg-orange-50'
                                          }`}
                                        >
                                          Pequena
                                        </button>
                                        <button
                                          onClick={() => setSettings({...settings, logoSize: 'medium'})}
                                          className={`py-2 px-2 text-[9px] font-black uppercase rounded-lg transition-all ${
                                            settings.logoSize === 'medium'
                                              ? 'bg-orange-700 text-white'
                                              : 'bg-white text-stone-600 hover:bg-orange-50'
                                          }`}
                                        >
                                          Média
                                        </button>
                                        <button
                                          onClick={() => setSettings({...settings, logoSize: 'large'})}
                                          className={`py-2 px-2 text-[9px] font-black uppercase rounded-lg transition-all ${
                                            settings.logoSize === 'large'
                                              ? 'bg-orange-700 text-white'
                                              : 'bg-white text-stone-600 hover:bg-orange-50'
                                          }`}
                                        >
                                          Grande
                                        </button>
                                      </div>
                                      <div className="flex items-center gap-2">
                                        <button
                                          onClick={() => setSettings({...settings, logoSize: 'custom'})}
                                          className={`flex-1 py-2 px-2 text-[9px] font-black uppercase rounded-lg transition-all ${
                                            settings.logoSize === 'custom'
                                              ? 'bg-orange-700 text-white'
                                              : 'bg-white text-stone-600 hover:bg-orange-50'
                                          }`}
                                        >
                                          Personalizado
                                        </button>
                                        {settings.logoSize === 'custom' && (
                                          <input
                                            type="number"
                                            min="20"
                                            max="120"
                                            value={settings.logoSizePx || 64}
                                            onChange={(e) => setSettings({...settings, logoSizePx: parseInt(e.target.value) || 64})}
                                            className="w-20 px-2 py-2 text-xs font-black text-stone-900 rounded-lg border border-stone-200 focus:outline-none focus:ring-2 focus:ring-orange-700"
                                            placeholder="px"
                                          />
                                        )}
                                      </div>
                                    </div>
                                  <button 
                                    onClick={() => setSettings({...settings, logo: ''})}
                                    className="w-full py-3 text-red-500 hover:bg-red-50 rounded-xl font-black text-[10px] uppercase tracking-widest transition-all"
                                  >
                                    Remover
                                  </button>
                                  </>
                                )}
                              </div>
                            </div>
                          </div>

                          <div className="space-y-4">
                            <label className="text-[10px] font-black text-stone-400 uppercase tracking-[0.3em] flex items-center gap-2">
                              <Video size={14} className="text-orange-700" /> Vídeo Promocional (Hero)
                            </label>
                            <div className="flex items-center gap-6 p-6 bg-stone-50/50 rounded-3xl border border-stone-100 h-[128px]">
                              <div className="flex-1 space-y-3 text-center">
                                <button 
                                  onClick={() => {
                                    const input = document.createElement('input');
                                    input.type = 'file';
                                    input.accept = 'video/*';
                                    input.onchange = (e) => {
                                      const file = (e.target as HTMLInputElement).files?.[0];
                                      if (file) {
                                        // Check file size (base64 is ~33% larger, so 10MB file becomes ~13MB)
                                        if (file.size > 10 * 1024 * 1024) { // 10MB limit before base64 conversion
                                          alert('O vídeo deve ter menos de 10MB antes da conversão. Vídeos maiores podem não ser salvos corretamente.');
                                        }
                                        handleFileUpload(file, (base) => {
                                          // Check base64 size
                                          const base64SizeMB = base.length / 1024 / 1024;
                                          if (base64SizeMB > 8) {
                                            alert(`Atenção: O vídeo convertido tem ${base64SizeMB.toFixed(2)}MB. Pode não ser salvo se o armazenamento estiver cheio.`);
                                          }
                                          const updatedSettings = {...settings, heroVideo: base};
                                          setSettings(updatedSettings);
                                          // Force immediate save with automatic cleanup
                                          try {
                                            localStorage.setItem('minas_v2_settings', JSON.stringify(updatedSettings));
                                          } catch (e) {
                                            console.error('Error saving hero video:', e);
                                            if (e instanceof DOMException && e.name === 'QuotaExceededError') {
                                              // Try automatic cleanup
                                              try {
                                                // Remove old orders (keep only last 5)
                                                const currentOrders = orders;
                                                if (currentOrders.length > 5) {
                                                  const recentOrders = currentOrders.slice(0, 5);
                                                  localStorage.setItem('minas_v2_orders', JSON.stringify(recentOrders));
                                                  setOrders(recentOrders);
                                                  console.log('Cleaned old orders to free space');
                                                }
                                                
                                                // Remove large images from items
                                                const cleanedItems = items.map(item => ({
                                                  ...item,
                                                  image: item.image && item.image.length > 500000 ? undefined : item.image
                                                }));
                                                localStorage.setItem('minas_v2_items', JSON.stringify(cleanedItems));
                                                setItems(cleanedItems);
                                                console.log('Cleaned large images from items');
                                                
                                                // Try saving video again
                                                localStorage.setItem('minas_v2_settings', JSON.stringify(updatedSettings));
                                                console.log('Video saved after automatic cleanup');
                                                alert('Vídeo salvo! Alguns dados antigos foram removidos automaticamente para liberar espaço.');
                                              } catch (retryError) {
                                                console.error('Failed even after cleanup:', retryError);
                                                alert('Armazenamento cheio! Não foi possível salvar o vídeo. Vá em Configurações > Limpar Armazenamento para liberar espaço.');
                                              }
                                            }
                                          }
                                        });
                                      }
                                    };
                                    input.click();
                                  }}
                                  className="w-full py-4 bg-white hover:bg-orange-50 text-orange-700 border border-orange-200 rounded-xl font-black text-[10px] uppercase tracking-widest transition-all flex items-center justify-center gap-2"
                                >
                                  <Video size={14} /> {settings.heroVideo ? 'Trocar Vídeo' : 'Enviar Vídeo Local'}
                                </button>
                                {settings.heroVideo && (
                                  <p className="text-[9px] text-green-600 font-bold uppercase tracking-widest">Vídeo Carregado com Sucesso</p>
                                )}
                              </div>
                            </div>
                          </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                          <div className="space-y-4">
                            <label className="text-[10px] font-black text-stone-400 uppercase tracking-[0.3em] flex items-center gap-2">
                              <ImageIcon size={14} className="text-orange-700" /> Imagem do Topo (Hero)
                            </label>
                            <div className="flex items-center gap-6 p-6 bg-stone-50/50 rounded-3xl border border-stone-100 h-[128px]">
                              <div className="flex-1 space-y-3 text-center">
                                <button 
                                  onClick={() => {
                                    const input = document.createElement('input');
                                    input.type = 'file';
                                    input.accept = 'image/*';
                                    input.onchange = async (e) => {
                                      const file = (e.target as HTMLInputElement).files?.[0];
                                      if (file) {
                                        try {
                                          await handleFileUpload(file, (base) => {
                                            const newSettings = {...settings, heroImage: base};
                                            setSettings(newSettings);
                                            // Force immediate save
                                            try {
                                              localStorage.setItem('minas_v2_settings', JSON.stringify(newSettings));
                                            } catch (e) {
                                              console.error('Error saving hero image:', e);
                                            }
                                          });
                                        } catch (error) {
                                          console.error('Error uploading hero image:', error);
                                          alert('Erro ao fazer upload da imagem. Tente novamente.');
                                        }
                                      }
                                    };
                                    input.click();
                                  }}
                                  className="w-full py-4 bg-white hover:bg-orange-50 text-orange-700 border border-orange-200 rounded-xl font-black text-[10px] uppercase tracking-widest transition-all flex items-center justify-center gap-2"
                                >
                                  <Upload size={14} /> {settings.heroImage ? 'Trocar Imagem Hero' : 'Enviar Imagem Hero'}
                                </button>
                                {settings.heroImage && (
                                  <button onClick={() => setSettings({...settings, heroImage: ''})} className="text-[9px] text-red-500 font-bold uppercase tracking-widest hover:underline">Remover</button>
                                )}
                              </div>
                            </div>
                          </div>

                          <div className="space-y-4">
                            <label className="text-[10px] font-black text-stone-400 uppercase tracking-[0.3em] flex items-center gap-2">
                              <ImageIcon size={14} className="text-orange-700" /> Imagens "Sobre Nós"
                            </label>
                            <div className="flex flex-col gap-4 p-6 bg-stone-50/50 rounded-3xl border border-stone-100">
                              <div className="grid grid-cols-2 gap-4">
                                <div className="flex flex-col gap-2">
                                  <div className="w-full h-32 bg-white rounded-2xl border border-stone-200 flex items-center justify-center overflow-hidden p-2">
                                    {settings.aboutImage1 ? (
                                      <img src={settings.aboutImage1} className="w-full h-full object-contain object-center" alt="About Image 1" style={{ maxWidth: '100%', maxHeight: '100%' }} />
                                    ) : (
                                      <ImageIcon size={32} className="text-stone-200" />
                                    )}
                                  </div>
                                <button 
                                  onClick={() => {
                                    const input = document.createElement('input');
                                    input.type = 'file';
                                    input.accept = 'image/*';
                                    input.onchange = (e) => {
                                      const file = (e.target as HTMLInputElement).files?.[0];
                                        if (file) {
                                          handleFileUpload(file, (base) => {
                                            const updatedSettings = {...settings, aboutImage1: base};
                                            setSettings(updatedSettings);
                                            // Force immediate save
                                            try {
                                              localStorage.setItem('minas_v2_settings', JSON.stringify(updatedSettings));
                                            } catch (e) {
                                              console.error('Error saving aboutImage1:', e);
                                            }
                                          });
                                        }
                                    };
                                    input.click();
                                  }}
                                    className="w-full py-3 bg-white hover:bg-orange-50 text-orange-700 border border-orange-200 rounded-xl font-black text-[9px] uppercase tracking-widest transition-all"
                                >
                                  Img 1 {settings.aboutImage1 ? '✓' : '+'}
                                </button>
                                  {settings.aboutImage1 && (
                                    <>
                                      <button onClick={() => setSettings({...settings, aboutImage1: ''})} className="text-[8px] text-red-500 font-bold uppercase tracking-widest hover:underline">Remover</button>
                                      <div className="space-y-2 pt-2 border-t border-stone-200">
                                        <label className="text-[8px] font-black text-stone-400 uppercase tracking-widest">Tamanho Img 1</label>
                                        <div className="flex flex-wrap gap-1 items-center">
                                          <button
                                            onClick={() => setSettings({...settings, aboutImage1Size: 'small'})}
                                            className={`py-1.5 px-2 text-[8px] font-black uppercase rounded-lg transition-all ${
                                              settings.aboutImage1Size === 'small' || !settings.aboutImage1Size
                                                ? 'bg-orange-700 text-white'
                                                : 'bg-white text-stone-600 hover:bg-orange-50'
                                            }`}
                                          >
                                            Pequena
                                          </button>
                                          <button
                                            onClick={() => setSettings({...settings, aboutImage1Size: 'medium'})}
                                            className={`py-1.5 px-2 text-[8px] font-black uppercase rounded-lg transition-all ${
                                              settings.aboutImage1Size === 'medium'
                                                ? 'bg-orange-700 text-white'
                                                : 'bg-white text-stone-600 hover:bg-orange-50'
                                            }`}
                                          >
                                            Média
                                          </button>
                                          <button
                                            onClick={() => setSettings({...settings, aboutImage1Size: 'large'})}
                                            className={`py-1.5 px-2 text-[8px] font-black uppercase rounded-lg transition-all ${
                                              settings.aboutImage1Size === 'large'
                                                ? 'bg-orange-700 text-white'
                                                : 'bg-white text-stone-600 hover:bg-orange-50'
                                            }`}
                                          >
                                            Grande
                                          </button>
                                          <button
                                            onClick={() => setSettings({...settings, aboutImage1Size: 'custom'})}
                                            className={`py-1.5 px-2 text-[8px] font-black uppercase rounded-lg transition-all ${
                                              settings.aboutImage1Size === 'custom'
                                                ? 'bg-orange-700 text-white'
                                                : 'bg-white text-stone-600 hover:bg-orange-50'
                                            }`}
                                          >
                                            Personalizado
                                          </button>
                                          {settings.aboutImage1Size === 'custom' && (
                                            <input
                                              type="number"
                                              min="100"
                                              max="600"
                                              value={settings.aboutImage1SizePx || 300}
                                              onChange={(e) => setSettings({...settings, aboutImage1SizePx: parseInt(e.target.value) || 300})}
                                              className="w-16 px-1.5 py-1.5 text-[10px] font-black text-stone-900 rounded-lg border border-stone-200 focus:outline-none focus:ring-2 focus:ring-orange-700"
                                              placeholder="px"
                                            />
                                          )}
                                        </div>
                                      </div>
                                    </>
                                  )}
                                </div>
                                <div className="flex flex-col gap-2">
                                  <div className="w-full h-32 bg-white rounded-2xl border border-stone-200 flex items-center justify-center overflow-hidden p-2">
                                    {settings.aboutImage2 ? (
                                      <img src={settings.aboutImage2} className="w-full h-full object-contain object-center" alt="About Image 2" style={{ maxWidth: '100%', maxHeight: '100%' }} />
                                    ) : (
                                      <ImageIcon size={32} className="text-stone-200" />
                                    )}
                                  </div>
                                <button 
                                  onClick={() => {
                                    const input = document.createElement('input');
                                    input.type = 'file';
                                    input.accept = 'image/*';
                                    input.onchange = (e) => {
                                      const file = (e.target as HTMLInputElement).files?.[0];
                                        if (file) {
                                          handleFileUpload(file, (base) => {
                                            const updatedSettings = {...settings, aboutImage2: base};
                                            setSettings(updatedSettings);
                                            // Force immediate save
                                            try {
                                              localStorage.setItem('minas_v2_settings', JSON.stringify(updatedSettings));
                                            } catch (e) {
                                              console.error('Error saving aboutImage2:', e);
                                            }
                                          });
                                        }
                                    };
                                    input.click();
                                  }}
                                    className="w-full py-3 bg-white hover:bg-orange-50 text-orange-700 border border-orange-200 rounded-xl font-black text-[9px] uppercase tracking-widest transition-all"
                                >
                                  Img 2 {settings.aboutImage2 ? '✓' : '+'}
                                </button>
                                  {settings.aboutImage2 && (
                                    <>
                                      <button onClick={() => setSettings({...settings, aboutImage2: ''})} className="text-[8px] text-red-500 font-bold uppercase tracking-widest hover:underline">Remover</button>
                                      <div className="space-y-2 pt-2 border-t border-stone-200">
                                        <label className="text-[8px] font-black text-stone-400 uppercase tracking-widest">Tamanho Img 2</label>
                                        <div className="flex flex-wrap gap-1 items-center">
                                          <button
                                            onClick={() => setSettings({...settings, aboutImage2Size: 'small'})}
                                            className={`py-1.5 px-2 text-[8px] font-black uppercase rounded-lg transition-all ${
                                              settings.aboutImage2Size === 'small' || !settings.aboutImage2Size
                                                ? 'bg-orange-700 text-white'
                                                : 'bg-white text-stone-600 hover:bg-orange-50'
                                            }`}
                                          >
                                            Pequena
                                          </button>
                                          <button
                                            onClick={() => setSettings({...settings, aboutImage2Size: 'medium'})}
                                            className={`py-1.5 px-2 text-[8px] font-black uppercase rounded-lg transition-all ${
                                              settings.aboutImage2Size === 'medium'
                                                ? 'bg-orange-700 text-white'
                                                : 'bg-white text-stone-600 hover:bg-orange-50'
                                            }`}
                                          >
                                            Média
                                          </button>
                                          <button
                                            onClick={() => setSettings({...settings, aboutImage2Size: 'large'})}
                                            className={`py-1.5 px-2 text-[8px] font-black uppercase rounded-lg transition-all ${
                                              settings.aboutImage2Size === 'large'
                                                ? 'bg-orange-700 text-white'
                                                : 'bg-white text-stone-600 hover:bg-orange-50'
                                            }`}
                                          >
                                            Grande
                                          </button>
                                          <button
                                            onClick={() => setSettings({...settings, aboutImage2Size: 'custom'})}
                                            className={`py-1.5 px-2 text-[8px] font-black uppercase rounded-lg transition-all ${
                                              settings.aboutImage2Size === 'custom'
                                                ? 'bg-orange-700 text-white'
                                                : 'bg-white text-stone-600 hover:bg-orange-50'
                                            }`}
                                          >
                                            Personalizado
                                          </button>
                                          {settings.aboutImage2Size === 'custom' && (
                                            <input
                                              type="number"
                                              min="100"
                                              max="600"
                                              value={settings.aboutImage2SizePx || 300}
                                              onChange={(e) => setSettings({...settings, aboutImage2SizePx: parseInt(e.target.value) || 300})}
                                              className="w-16 px-1.5 py-1.5 text-[10px] font-black text-stone-900 rounded-lg border border-stone-200 focus:outline-none focus:ring-2 focus:ring-orange-700"
                                              placeholder="px"
                                            />
                                          )}
                                        </div>
                                      </div>
                                    </>
                                  )}
                                </div>
                              </div>
                              {(settings.aboutImage1 || settings.aboutImage2) && (
                                <button onClick={() => setSettings({...settings, aboutImage1: '', aboutImage2: ''})} className="text-[9px] text-red-500 font-bold uppercase tracking-widest hover:underline text-center">Remover Ambas</button>
                              )}
                            </div>
                          </div>
                        </div>

                        <div className="space-y-4">
                          <label className="text-[10px] font-black text-stone-400 uppercase tracking-[0.3em]">Nome do Estabelecimento</label>
                          <input 
                            value={settings.name}
                            onChange={(e) => setSettings({...settings, name: e.target.value})}
                            className="w-full px-8 py-5 rounded-3xl border border-stone-100 focus:outline-none focus:ring-4 focus:ring-orange-700/5 focus:border-orange-700/20 bg-stone-50/50 font-black text-lg text-stone-900 transition-all"
                          />
                        </div>
                        
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                          <div className="space-y-4">
                            <label className="text-[10px] font-black text-stone-400 uppercase tracking-[0.3em]">Telefone Fixo</label>
                            <input 
                              value={settings.phone}
                              onChange={(e) => setSettings({...settings, phone: e.target.value})}
                              className="w-full px-8 py-5 rounded-3xl border border-stone-100 focus:outline-none focus:ring-4 focus:ring-orange-700/5 bg-stone-50/50 font-bold text-stone-900"
                            />
                          </div>
                          <div className="space-y-4">
                            <label className="text-[10px] font-black text-stone-400 uppercase tracking-[0.3em]">WhatsApp Business</label>
                            <input 
                              value={settings.whatsapp}
                              onChange={(e) => setSettings({...settings, whatsapp: e.target.value})}
                              className="w-full px-8 py-5 rounded-3xl border border-stone-100 focus:outline-none focus:ring-4 focus:ring-orange-700/5 bg-stone-50/50 font-bold text-stone-900"
                            />
                          </div>
                        </div>

                        <div className="space-y-4">
                          <label className="text-[10px] font-black text-stone-400 uppercase tracking-[0.3em]">Endereço Completo</label>
                          <input 
                            value={settings.address}
                            onChange={(e) => setSettings({...settings, address: e.target.value})}
                            className="w-full px-8 py-5 rounded-3xl border border-stone-100 focus:outline-none focus:ring-4 focus:ring-orange-700/5 bg-stone-50/50 font-bold text-stone-900"
                          />
                        </div>

                        <div className="space-y-4">
                          <label className="text-[10px] font-black text-stone-400 uppercase tracking-[0.3em] flex items-center gap-2">
                            <Clock size={14} className="text-orange-700" /> Horários de Funcionamento
                          </label>
                          <div className="space-y-3 p-6 bg-stone-50/50 rounded-3xl border border-stone-100">
                            {Object.entries(settings.openingHours || {}).map(([day, hours]) => (
                              <div key={day} className="flex items-center gap-3">
                                <label className="w-32 text-[9px] font-black text-stone-600 uppercase tracking-widest shrink-0">
                                  {day}:
                                </label>
                                <input
                                  type="text"
                                  value={hours}
                                  onChange={(e) => {
                                    const updatedHours = { ...settings.openingHours };
                                    updatedHours[day] = e.target.value;
                                    setSettings({ ...settings, openingHours: updatedHours });
                                  }}
                                  placeholder="Ex: 11:00 às 22:00"
                                  className="flex-1 px-4 py-3 rounded-xl border border-stone-100 focus:outline-none focus:ring-2 focus:ring-orange-700/20 bg-white font-bold text-stone-900 text-sm"
                                />
                              </div>
                            ))}
                          </div>
                        </div>

                          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                            <div className="p-8 bg-stone-50/50 rounded-[2rem] border border-stone-100 space-y-4">
                              <label className="flex items-center gap-3 text-[10px] font-black text-stone-400 uppercase tracking-[0.3em]">
                                <Truck size={14} className="text-orange-700" /> Taxa de Entrega
                              </label>
                              <div className="relative">
                                <span className="absolute left-6 top-1/2 -translate-y-1/2 font-black text-stone-400">R$</span>
                                <input 
                                  type="number"
                                  value={settings.deliveryFee}
                                  onChange={(e) => setSettings({...settings, deliveryFee: parseFloat(e.target.value) || 0})}
                                  className="w-full pl-14 pr-8 py-5 rounded-2xl border border-stone-100 focus:outline-none focus:ring-4 focus:ring-orange-700/5 bg-white font-black text-stone-900"
                                />
                              </div>
                            </div>
                            <div className="p-8 bg-stone-50/50 rounded-[2rem] border border-stone-100 space-y-4">
                              <label className="flex items-center gap-3 text-[10px] font-black text-stone-400 uppercase tracking-[0.3em]">
                                <ShoppingCart size={14} className="text-orange-700" /> Pedido Mínimo
                              </label>
                              <div className="relative">
                                <span className="absolute left-6 top-1/2 -translate-y-1/2 font-black text-stone-400">R$</span>
                                <input 
                                  type="number"
                                  value={settings.minOrder}
                                  onChange={(e) => setSettings({...settings, minOrder: parseFloat(e.target.value) || 0})}
                                  className="w-full pl-14 pr-8 py-5 rounded-2xl border border-stone-100 focus:outline-none focus:ring-4 focus:ring-orange-700/5 bg-white font-black text-stone-900"
                                />
                              </div>
                            </div>
                          </div>

                        <div className="space-y-6">
                          <label className="flex items-center gap-3 text-[10px] font-black text-stone-400 uppercase tracking-[0.3em]">
                            <CreditCard size={14} className="text-orange-700" /> Meios de Pagamento
                          </label>
                          <div className="flex flex-wrap gap-3">
                            {['Dinheiro', 'PIX', 'Cartão de Débito', 'Cartão de Crédito', 'Vale Refeição'].map(method => (
                              <button 
                                key={method}
                                onClick={() => {
                                  const currentMethods = settings.paymentMethods || [];
                                  const exists = currentMethods.includes(method);
                                  const newMethods = exists 
                                    ? currentMethods.filter(m => m !== method)
                                    : [...currentMethods, method];
                                  setSettings({...settings, paymentMethods: newMethods});
                                }}
                                className={`px-8 py-4 rounded-2xl font-black uppercase text-[10px] tracking-widest transition-all ${
                                  (settings.paymentMethods || []).includes(method) 
                                    ? 'bg-orange-700 text-white shadow-xl shadow-orange-700/20' 
                                    : 'bg-stone-50 text-stone-400 hover:bg-stone-100 border border-stone-100'
                                }`}
                              >
                                {method}
                              </button>
                            ))}
                          </div>
                        </div>
                      </div>

                      <div className="pt-8 sm:pt-12 border-t border-stone-100 space-y-6 sm:space-y-8">
                        <div>
                          <h5 className="text-lg sm:text-xl font-black text-stone-900 mb-4 uppercase tracking-widest text-xs">Sincronização de Dados</h5>
                          <div className="space-y-3 sm:space-y-4">
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                              <button 
                                onClick={async (e) => {
                                  const button = e.currentTarget;
                                  const originalText = button.textContent;
                                  button.textContent = '⏳ Sincronizando...';
                                  button.disabled = true;
                                  const success = await syncToCloud();
                                  if (success) {
                                    button.textContent = '✅ Sincronizado com Sucesso!';
                                    button.className = button.className.replace('bg-green-50', 'bg-green-100').replace('text-green-600', 'text-green-700');
                                    setTimeout(() => {
                                      button.textContent = originalText;
                                      button.className = button.className.replace('bg-green-100', 'bg-green-50').replace('text-green-700', 'text-green-600');
                                      button.disabled = false;
                                    }, 3000);
                                  } else {
                                    button.textContent = '❌ Erro ao Sincronizar';
                                    button.className = button.className.replace('bg-green-50', 'bg-red-50').replace('text-green-600', 'text-red-600');
                                    setTimeout(() => {
                                      button.textContent = originalText;
                                      button.className = button.className.replace('bg-red-50', 'bg-green-50').replace('text-red-600', 'text-green-600');
                                      button.disabled = false;
                                    }, 3000);
                                  }
                                }}
                                className="px-4 sm:px-8 py-3 sm:py-5 bg-green-50 text-green-600 font-black uppercase tracking-widest rounded-xl sm:rounded-[1.5rem] hover:bg-green-100 transition-all active:scale-95 flex items-center justify-center gap-2 text-xs sm:text-sm border-2 border-green-200 disabled:opacity-50 disabled:cursor-not-allowed"
                              >
                                <Save size={14} className="sm:w-4 sm:h-4" /> ☁️ Sincronizar com Nuvem (Salvar)
                              </button>
                              <button 
                                onClick={async () => {
                                  const preserve = confirm('Deseja preservar as imagens locais ao carregar da nuvem?\n\nSim = Mantém suas imagens locais\nNão = Substitui tudo pelos dados da nuvem');
                                  alert('Carregando dados da nuvem...');
                                  const success = await loadFromCloud(preserve);
                                  if (success) {
                                    alert(`✅ Dados carregados da nuvem com sucesso!\n\n${preserve ? 'Imagens locais foram preservadas.' : 'Todos os dados foram substituídos.'}\n\nA página será recarregada.`);
                                    setTimeout(() => window.location.reload(), 1000);
                                  } else {
                                    alert('❌ Nenhum dado encontrado na nuvem ou erro ao carregar.');
                                  }
                                }}
                                className="px-4 sm:px-8 py-3 sm:py-5 bg-blue-50 text-blue-600 font-black uppercase tracking-widest rounded-xl sm:rounded-[1.5rem] hover:bg-blue-100 transition-all active:scale-95 flex items-center justify-center gap-2 text-xs sm:text-sm border-2 border-blue-200"
                              >
                                <Save size={14} className="sm:w-4 sm:h-4" /> ⬇️ Carregar da Nuvem (Baixar)
                              </button>
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                              <button 
                                onClick={exportData}
                                className="px-4 sm:px-8 py-3 sm:py-5 bg-green-50 text-green-600 font-black uppercase tracking-widest rounded-xl sm:rounded-[1.5rem] hover:bg-green-100 transition-all active:scale-95 flex items-center justify-center gap-2 text-xs sm:text-sm"
                                title="Exporta todos os dados completos (arquivo grande)"
                              >
                                <Save size={14} className="sm:w-4 sm:h-4" /> Backup Completo
                              </button>
                              <button 
                                onClick={importData}
                                className="px-4 sm:px-8 py-3 sm:py-5 bg-purple-50 text-purple-600 font-black uppercase tracking-widest rounded-xl sm:rounded-[1.5rem] hover:bg-purple-100 transition-all active:scale-95 flex items-center justify-center gap-2 text-xs sm:text-sm"
                              >
                                <Upload size={14} className="sm:w-4 sm:h-4" /> Importar Arquivo
                              </button>
                            </div>
                            <button 
                              onClick={restoreFromBackup}
                              className="w-full px-4 sm:px-8 py-3 sm:py-5 bg-blue-50 text-blue-600 font-black uppercase tracking-widest rounded-xl sm:rounded-[1.5rem] hover:bg-blue-100 transition-all active:scale-95 flex items-center justify-center gap-2 text-xs sm:text-sm border-2 border-blue-200"
                              title="Restaura o último backup automático salvo no navegador"
                            >
                              <RefreshCw size={14} className="sm:w-4 sm:h-4" /> 🔄 Restaurar Backup Automático
                            </button>
                            <button 
                              onClick={exportDataWithImages}
                              className="w-full px-4 sm:px-8 py-3 sm:py-5 bg-green-50 text-green-600 font-black uppercase tracking-widest rounded-xl sm:rounded-[1.5rem] hover:bg-green-100 transition-all active:scale-95 flex items-center justify-center gap-2 text-xs sm:text-sm border-2 border-green-200"
                            >
                              <MessageCircle size={14} className="sm:w-4 sm:h-4" /> 📸 Copiar Completo (COM Imagens)
                            </button>
                            <button 
                              onClick={exportDataForSync}
                              className="w-full px-4 sm:px-8 py-3 sm:py-5 bg-orange-50 text-orange-600 font-black uppercase tracking-widest rounded-xl sm:rounded-[1.5rem] hover:bg-orange-100 transition-all active:scale-95 flex items-center justify-center gap-2 text-xs sm:text-sm border-2 border-orange-200"
                            >
                              <MessageCircle size={14} className="sm:w-4 sm:h-4" /> 📱 Copiar para Celular (Sem Imagens)
                            </button>
                            <button 
                              onClick={importFromPaste}
                              className="w-full px-4 sm:px-8 py-3 sm:py-5 bg-blue-50 text-blue-600 font-black uppercase tracking-widest rounded-xl sm:rounded-[1.5rem] hover:bg-blue-100 transition-all active:scale-95 flex items-center justify-center gap-2 text-xs sm:text-sm"
                            >
                              <MessageCircle size={14} className="sm:w-4 sm:h-4" /> Colar JSON (Texto Único)
                            </button>
                            <button 
                              onClick={importFromChunks}
                              className="w-full px-4 sm:px-8 py-3 sm:py-5 bg-indigo-50 text-indigo-600 font-black uppercase tracking-widest rounded-xl sm:rounded-[1.5rem] hover:bg-indigo-100 transition-all active:scale-95 flex items-center justify-center gap-2 text-xs sm:text-sm border-2 border-indigo-200"
                            >
                              <MessageCircle size={14} className="sm:w-4 sm:h-4" /> 📱 Colar JSON em Partes (WhatsApp)
                            </button>
                            <p className="text-[10px] sm:text-xs text-stone-400 text-center px-2">
                              💡 <strong>Para sincronizar imagens:</strong> Use "Copiar Completo (COM Imagens)" no PC, depois "Colar JSON" no celular. Para WhatsApp (sem imagens), use "Copiar para Celular (Sem Imagens)" que divide automaticamente.
                            </p>
                          </div>
                        </div>

                        <div>
                          <h5 className="text-lg sm:text-xl font-black text-stone-900 mb-4 uppercase tracking-widest text-xs flex items-center gap-2">
                            <Building2 size={18} className="text-orange-700" /> Informações Bancárias
                          </h5>
                          <div className="space-y-4 p-6 bg-stone-50/50 rounded-2xl border border-stone-100">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                              <div>
                                <label className="text-[10px] font-black text-stone-400 uppercase tracking-[0.3em] mb-2 block">Nome do Banco</label>
                                <input
                                  type="text"
                                  value={settings.bankInfo?.bankName || ''}
                                  onChange={(e) => setSettings({
                                    ...settings,
                                    bankInfo: { ...settings.bankInfo, bankName: e.target.value }
                                  })}
                                  className="w-full px-4 py-3 bg-white border border-stone-200 rounded-xl text-sm font-medium text-stone-900 focus:outline-none focus:ring-2 focus:ring-orange-700 focus:border-orange-700"
                                  placeholder="Ex: Banco do Brasil"
                                />
                              </div>
                              <div>
                                <label className="text-[10px] font-black text-stone-400 uppercase tracking-[0.3em] mb-2 block">Código do Banco</label>
                                <input
                                  type="text"
                                  value={settings.bankInfo?.bankCode || ''}
                                  onChange={(e) => setSettings({
                                    ...settings,
                                    bankInfo: { ...settings.bankInfo, bankCode: e.target.value }
                                  })}
                                  className="w-full px-4 py-3 bg-white border border-stone-200 rounded-xl text-sm font-medium text-stone-900 focus:outline-none focus:ring-2 focus:ring-orange-700 focus:border-orange-700"
                                  placeholder="Ex: 001"
                                />
                              </div>
                              <div>
                                <label className="text-[10px] font-black text-stone-400 uppercase tracking-[0.3em] mb-2 block">Agência</label>
                                <input
                                  type="text"
                                  value={settings.bankInfo?.agency || ''}
                                  onChange={(e) => setSettings({
                                    ...settings,
                                    bankInfo: { ...settings.bankInfo, agency: e.target.value }
                                  })}
                                  className="w-full px-4 py-3 bg-white border border-stone-200 rounded-xl text-sm font-medium text-stone-900 focus:outline-none focus:ring-2 focus:ring-orange-700 focus:border-orange-700"
                                  placeholder="Ex: 1234-5"
                                />
                              </div>
                              <div>
                                <label className="text-[10px] font-black text-stone-400 uppercase tracking-[0.3em] mb-2 block">Conta</label>
                                <input
                                  type="text"
                                  value={settings.bankInfo?.account || ''}
                                  onChange={(e) => setSettings({
                                    ...settings,
                                    bankInfo: { ...settings.bankInfo, account: e.target.value }
                                  })}
                                  className="w-full px-4 py-3 bg-white border border-stone-200 rounded-xl text-sm font-medium text-stone-900 focus:outline-none focus:ring-2 focus:ring-orange-700 focus:border-orange-700"
                                  placeholder="Ex: 12345-6"
                                />
                              </div>
                              <div>
                                <label className="text-[10px] font-black text-stone-400 uppercase tracking-[0.3em] mb-2 block">Tipo de Conta</label>
                                <select
                                  value={settings.bankInfo?.accountType || 'checking'}
                                  onChange={(e) => setSettings({
                                    ...settings,
                                    bankInfo: { ...settings.bankInfo, accountType: e.target.value as 'checking' | 'savings' }
                                  })}
                                  className="w-full px-4 py-3 bg-white border border-stone-200 rounded-xl text-sm font-medium text-stone-900 focus:outline-none focus:ring-2 focus:ring-orange-700 focus:border-orange-700"
                                >
                                  <option value="checking">Conta Corrente</option>
                                  <option value="savings">Conta Poupança</option>
                                </select>
                              </div>
                              <div>
                                <label className="text-[10px] font-black text-stone-400 uppercase tracking-[0.3em] mb-2 block">Nome do Titular</label>
                                <input
                                  type="text"
                                  value={settings.bankInfo?.accountHolderName || ''}
                                  onChange={(e) => setSettings({
                                    ...settings,
                                    bankInfo: { ...settings.bankInfo, accountHolderName: e.target.value }
                                  })}
                                  className="w-full px-4 py-3 bg-white border border-stone-200 rounded-xl text-sm font-medium text-stone-900 focus:outline-none focus:ring-2 focus:ring-orange-700 focus:border-orange-700"
                                  placeholder="Nome completo do titular"
                                />
                              </div>
                              <div>
                                <label className="text-[10px] font-black text-stone-400 uppercase tracking-[0.3em] mb-2 block">CPF/CNPJ</label>
                                <input
                                  type="text"
                                  value={settings.bankInfo?.cpfCnpj || ''}
                                  onChange={(e) => setSettings({
                                    ...settings,
                                    bankInfo: { ...settings.bankInfo, cpfCnpj: e.target.value }
                                  })}
                                  className="w-full px-4 py-3 bg-white border border-stone-200 rounded-xl text-sm font-medium text-stone-900 focus:outline-none focus:ring-2 focus:ring-orange-700 focus:border-orange-700"
                                  placeholder="000.000.000-00 ou 00.000.000/0000-00"
                                />
                              </div>
                              <div>
                                <label className="text-[10px] font-black text-stone-400 uppercase tracking-[0.3em] mb-2 block">Chave PIX</label>
                                <input
                                  type="text"
                                  value={settings.bankInfo?.pixKey || ''}
                                  onChange={(e) => setSettings({
                                    ...settings,
                                    bankInfo: { ...settings.bankInfo, pixKey: e.target.value }
                                  })}
                                  className="w-full px-4 py-3 bg-white border border-stone-200 rounded-xl text-sm font-medium text-stone-900 focus:outline-none focus:ring-2 focus:ring-orange-700 focus:border-orange-700"
                                  placeholder="Chave PIX"
                                />
                              </div>
                              <div>
                                <label className="text-[10px] font-black text-stone-400 uppercase tracking-[0.3em] mb-2 block">Tipo de Chave PIX</label>
                                <select
                                  value={settings.bankInfo?.pixKeyType || 'cpf'}
                                  onChange={(e) => setSettings({
                                    ...settings,
                                    bankInfo: { ...settings.bankInfo, pixKeyType: e.target.value as 'cpf' | 'cnpj' | 'email' | 'phone' | 'random' }
                                  })}
                                  className="w-full px-4 py-3 bg-white border border-stone-200 rounded-xl text-sm font-medium text-stone-900 focus:outline-none focus:ring-2 focus:ring-orange-700 focus:border-orange-700"
                                >
                                  <option value="cpf">CPF</option>
                                  <option value="cnpj">CNPJ</option>
                                  <option value="email">E-mail</option>
                                  <option value="phone">Telefone</option>
                                  <option value="random">Chave Aleatória</option>
                                </select>
                              </div>
                            </div>
                          </div>
                        </div>

                        <div>
                          <h5 className="text-lg sm:text-xl font-black text-stone-900 mb-4 uppercase tracking-widest text-xs flex items-center gap-2">
                            <Key size={18} className="text-orange-700" /> Tokens de Recebimento
                          </h5>
                          <div className="space-y-4 p-6 bg-stone-50/50 rounded-2xl border border-stone-100">
                            <div className="space-y-4">
                              <div>
                                <label className="text-[10px] font-black text-stone-400 uppercase tracking-[0.3em] mb-2 block flex items-center gap-2">
                                  <Wallet size={14} /> Mercado Pago
                                </label>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                  <div>
                                    <label className="text-[9px] font-black text-stone-500 uppercase tracking-[0.2em] mb-1 block">Access Token</label>
                                    <input
                                      type="password"
                                      value={settings.paymentTokens?.mercadoPagoToken || ''}
                                      onChange={(e) => setSettings({
                                        ...settings,
                                        paymentTokens: { ...settings.paymentTokens, mercadoPagoToken: e.target.value }
                                      })}
                                      className="w-full px-4 py-3 bg-white border border-stone-200 rounded-xl text-sm font-medium text-stone-900 focus:outline-none focus:ring-2 focus:ring-orange-700 focus:border-orange-700 font-mono"
                                      placeholder="APP_USR-..."
                                    />
                                  </div>
                                  <div>
                                    <label className="text-[9px] font-black text-stone-500 uppercase tracking-[0.2em] mb-1 block">Public Key</label>
                                    <input
                                      type="text"
                                      value={settings.paymentTokens?.mercadoPagoPublicKey || ''}
                                      onChange={(e) => setSettings({
                                        ...settings,
                                        paymentTokens: { ...settings.paymentTokens, mercadoPagoPublicKey: e.target.value }
                                      })}
                                      className="w-full px-4 py-3 bg-white border border-stone-200 rounded-xl text-sm font-medium text-stone-900 focus:outline-none focus:ring-2 focus:ring-orange-700 focus:border-orange-700 font-mono"
                                      placeholder="APP_USR-..."
                                    />
                                  </div>
                                </div>
                              </div>

                              <div>
                                <label className="text-[10px] font-black text-stone-400 uppercase tracking-[0.3em] mb-2 block flex items-center gap-2">
                                  <Wallet size={14} /> PagSeguro
                                </label>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                  <div>
                                    <label className="text-[9px] font-black text-stone-500 uppercase tracking-[0.2em] mb-1 block">Token</label>
                                    <input
                                      type="password"
                                      value={settings.paymentTokens?.pagSeguroToken || ''}
                                      onChange={(e) => setSettings({
                                        ...settings,
                                        paymentTokens: { ...settings.paymentTokens, pagSeguroToken: e.target.value }
                                      })}
                                      className="w-full px-4 py-3 bg-white border border-stone-200 rounded-xl text-sm font-medium text-stone-900 focus:outline-none focus:ring-2 focus:ring-orange-700 focus:border-orange-700 font-mono"
                                      placeholder="Token do PagSeguro"
                                    />
                                  </div>
                                  <div>
                                    <label className="text-[9px] font-black text-stone-500 uppercase tracking-[0.2em] mb-1 block">E-mail</label>
                                    <input
                                      type="email"
                                      value={settings.paymentTokens?.pagSeguroEmail || ''}
                                      onChange={(e) => setSettings({
                                        ...settings,
                                        paymentTokens: { ...settings.paymentTokens, pagSeguroEmail: e.target.value }
                                      })}
                                      className="w-full px-4 py-3 bg-white border border-stone-200 rounded-xl text-sm font-medium text-stone-900 focus:outline-none focus:ring-2 focus:ring-orange-700 focus:border-orange-700"
                                      placeholder="email@exemplo.com"
                                    />
                                  </div>
                                </div>
                              </div>

                              <div>
                                <label className="text-[10px] font-black text-stone-400 uppercase tracking-[0.3em] mb-2 block flex items-center gap-2">
                                  <Wallet size={14} /> Stripe
                                </label>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                  <div>
                                    <label className="text-[9px] font-black text-stone-500 uppercase tracking-[0.2em] mb-1 block">Secret Key</label>
                                    <input
                                      type="password"
                                      value={settings.paymentTokens?.stripeToken || ''}
                                      onChange={(e) => setSettings({
                                        ...settings,
                                        paymentTokens: { ...settings.paymentTokens, stripeToken: e.target.value }
                                      })}
                                      className="w-full px-4 py-3 bg-white border border-stone-200 rounded-xl text-sm font-medium text-stone-900 focus:outline-none focus:ring-2 focus:ring-orange-700 focus:border-orange-700 font-mono"
                                      placeholder="sk_live_..."
                                    />
                                  </div>
                                  <div>
                                    <label className="text-[9px] font-black text-stone-500 uppercase tracking-[0.2em] mb-1 block">Publishable Key</label>
                                    <input
                                      type="text"
                                      value={settings.paymentTokens?.stripePublicKey || ''}
                                      onChange={(e) => setSettings({
                                        ...settings,
                                        paymentTokens: { ...settings.paymentTokens, stripePublicKey: e.target.value }
                                      })}
                                      className="w-full px-4 py-3 bg-white border border-stone-200 rounded-xl text-sm font-medium text-stone-900 focus:outline-none focus:ring-2 focus:ring-orange-700 focus:border-orange-700 font-mono"
                                      placeholder="pk_live_..."
                                    />
                                  </div>
                                </div>
                              </div>

                              <div>
                                <label className="text-[10px] font-black text-stone-400 uppercase tracking-[0.3em] mb-2 block flex items-center gap-2">
                                  <Key size={14} /> Outros Tokens
                                </label>
                                <div className="space-y-3">
                                  {(settings.paymentTokens?.otherTokens || []).map((token, index) => (
                                    <div key={index} className="flex gap-2">
                                      <input
                                        type="text"
                                        value={token.name}
                                        onChange={(e) => {
                                          const updated = [...(settings.paymentTokens?.otherTokens || [])];
                                          updated[index] = { ...updated[index], name: e.target.value };
                                          setSettings({
                                            ...settings,
                                            paymentTokens: { ...settings.paymentTokens, otherTokens: updated }
                                          });
                                        }}
                                        className="flex-1 px-4 py-3 bg-white border border-stone-200 rounded-xl text-sm font-medium text-stone-900 focus:outline-none focus:ring-2 focus:ring-orange-700 focus:border-orange-700"
                                        placeholder="Nome do serviço"
                                      />
                                      <input
                                        type="password"
                                        value={token.token}
                                        onChange={(e) => {
                                          const updated = [...(settings.paymentTokens?.otherTokens || [])];
                                          updated[index] = { ...updated[index], token: e.target.value };
                                          setSettings({
                                            ...settings,
                                            paymentTokens: { ...settings.paymentTokens, otherTokens: updated }
                                          });
                                        }}
                                        className="flex-1 px-4 py-3 bg-white border border-stone-200 rounded-xl text-sm font-medium text-stone-900 focus:outline-none focus:ring-2 focus:ring-orange-700 focus:border-orange-700 font-mono"
                                        placeholder="Token"
                                      />
                                      <button
                                        onClick={() => {
                                          const updated = (settings.paymentTokens?.otherTokens || []).filter((_, i) => i !== index);
                                          setSettings({
                                            ...settings,
                                            paymentTokens: { ...settings.paymentTokens, otherTokens: updated }
                                          });
                                        }}
                                        className="px-4 py-3 bg-red-50 text-red-600 hover:bg-red-100 rounded-xl font-black text-xs uppercase transition-all"
                                      >
                                        <Trash2 size={16} />
                                      </button>
                                    </div>
                                  ))}
                                  <button
                                    onClick={() => {
                                      const current = settings.paymentTokens?.otherTokens || [];
                                      setSettings({
                                        ...settings,
                                        paymentTokens: {
                                          ...settings.paymentTokens,
                                          otherTokens: [...current, { name: '', token: '' }]
                                        }
                                      });
                                    }}
                                    className="w-full px-4 py-3 bg-stone-100 hover:bg-stone-200 text-stone-700 rounded-xl font-black text-xs uppercase tracking-widest transition-all flex items-center justify-center gap-2"
                                  >
                                    <Plus size={16} /> Adicionar Token
                                  </button>
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>

                        <div>
                          <h5 className="text-lg sm:text-xl font-black text-stone-900 mb-4 uppercase tracking-widest text-xs">Manutenção</h5>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                        <button 
                          onClick={() => {
                                try {
                                  // Analyze localStorage
                                  let totalSize = 0;
                                  const storageInfo: { key: string; size: number; sizeKB: string; items?: number }[] = [];
                                  
                                  // Check all localStorage keys
                                  for (let i = 0; i < localStorage.length; i++) {
                                    const key = localStorage.key(i);
                                    if (key) {
                                      const value = localStorage.getItem(key) || '';
                                      const size = new Blob([value]).size;
                                      const sizeKB = (size / 1024).toFixed(2);
                                      totalSize += size;
                                      
                                      // Try to parse and count items if it's our data
                                      let itemCount: number | undefined;
                                      try {
                                        const parsed = JSON.parse(value);
                                        if (Array.isArray(parsed)) {
                                          itemCount = parsed.length;
                                        } else if (parsed && typeof parsed === 'object') {
                                          // Count keys in object
                                          itemCount = Object.keys(parsed).length;
                                        }
                                      } catch {
                                        // Not JSON, ignore
                                      }
                                      
                                      storageInfo.push({
                                        key,
                                        size,
                                        sizeKB,
                                        items: itemCount
                                      });
                                    }
                                  }
                                  
                                  const totalSizeMB = (totalSize / (1024 * 1024)).toFixed(2);
                                  const totalSizeKB = (totalSize / 1024).toFixed(2);
                                  
                                  // Check our specific keys
                                  const ourKeys = ['minas_v2_categories', 'minas_v2_items', 'minas_v2_settings', 'minas_v2_orders'];
                                  const ourDataStatus: string[] = [];
                                  
                                  ourKeys.forEach(key => {
                                    const value = localStorage.getItem(key);
                                    if (value) {
                                      try {
                                        const parsed = JSON.parse(value);
                                        if (Array.isArray(parsed)) {
                                          ourDataStatus.push(`✅ ${key}: ${parsed.length} item(s)`);
                                        } else if (parsed && typeof parsed === 'object') {
                                          if (key === 'minas_v2_settings') {
                                            ourDataStatus.push(`✅ ${key}: ${parsed.name || 'Sem nome'}`);
                                          } else {
                                            ourDataStatus.push(`✅ ${key}: Existe`);
                                          }
                                        }
                                      } catch {
                                        ourDataStatus.push(`⚠️ ${key}: Inválido`);
                                      }
                                    } else {
                                      ourDataStatus.push(`❌ ${key}: Não existe`);
                                    }
                                  });
                                  
                                  // Build debug message
                                  let debugMessage = `🔍 DEBUG: Estado do localStorage\n\n`;
                                  debugMessage += `📊 Tamanho Total: ${totalSizeMB} MB (${totalSizeKB} KB)\n\n`;
                                  debugMessage += `📦 Nossos Dados:\n${ourDataStatus.join('\n')}\n\n`;
                                  debugMessage += `📋 Todas as Chaves (${storageInfo.length}):\n`;
                                  
                                  storageInfo
                                    .sort((a, b) => b.size - a.size)
                                    .forEach(info => {
                                      const itemInfo = info.items !== undefined ? ` (${info.items} itens)` : '';
                                      debugMessage += `  • ${info.key}: ${info.sizeKB} KB${itemInfo}\n`;
                                    });
                                  
                                  debugMessage += `\n🌐 Ambiente: ${window.location.hostname}\n`;
                                  debugMessage += `📱 Viewport: ${window.innerWidth}x${window.innerHeight}px\n`;
                                  debugMessage += `💾 Quota Disponível: ~${((5 * 1024 * 1024 - totalSize) / (1024 * 1024)).toFixed(2)} MB (estimado)`;
                                  
                                  // Show in alert (may be truncated if too long)
                                  if (debugMessage.length > 2000) {
                                    // If too long, show in console and alert with summary
                                    console.log('=== DEBUG LOCALSTORAGE ===');
                                    console.log(debugMessage);
                                    alert(`Debug completo no console (F12)\n\nResumo:\n\nTamanho Total: ${totalSizeMB} MB\n\nNossos Dados:\n${ourDataStatus.join('\n')}\n\nAbra o console para ver detalhes completos.`);
                                  } else {
                                    alert(debugMessage);
                                  }
                                } catch (error) {
                                  console.error('Error analyzing localStorage:', error);
                                  alert('Erro ao analisar localStorage. Veja o console (F12) para detalhes.');
                                }
                              }}
                              className="px-4 sm:px-8 py-3 sm:py-5 bg-purple-50 text-purple-600 font-black uppercase tracking-widest rounded-xl sm:rounded-[1.5rem] hover:bg-purple-100 transition-all active:scale-95 text-xs sm:text-sm"
                            >
                              🔍 Debug localStorage
                        </button>
                        <button 
                          onClick={() => {
                                if (confirm('Isso limpará pedidos antigos e imagens grandes para liberar espaço, mas manterá suas configurações. Continuar?')) {
                                  try {
                                    // Keep only last 5 orders
                                    const recentOrders = orders.slice(0, 5);
                                    localStorage.setItem('minas_v2_orders', JSON.stringify(recentOrders));
                                    setOrders(recentOrders);
                                    
                                    // Remove large images from items
                                    const cleanedItems = items.map(item => ({
                                      ...item,
                                      image: item.image && item.image.length > 500000 ? undefined : item.image
                                    }));
                                    localStorage.setItem('minas_v2_items', JSON.stringify(cleanedItems));
                                    setItems(cleanedItems);
                                    
                                    // Remove old localStorage keys
                                    const oldKeys = ['minas_settings', 'minas_categories', 'minas_items', 'minas_orders'];
                                    oldKeys.forEach(key => localStorage.removeItem(key));
                                    
                                    alert('Armazenamento limpo! Pedidos antigos e imagens grandes foram removidos.');
                                  } catch (error) {
                                    console.error('Error cleaning storage:', error);
                                    alert('Erro ao limpar armazenamento. Tente novamente.');
                                  }
                                }
                              }}
                              className="px-4 sm:px-8 py-3 sm:py-5 bg-blue-50 text-blue-600 font-black uppercase tracking-widest rounded-xl sm:rounded-[1.5rem] hover:bg-blue-100 transition-all active:scale-95 text-xs sm:text-sm"
                            >
                              Limpar Armazenamento
                            </button>
                            <button 
                              onClick={() => {
                                if (confirm('Isso apagará TODAS as suas personalizações e voltará aos dados padrão. Continuar?')) {
                              localStorage.clear();
                              window.location.reload();
                            }
                          }}
                              className="px-4 sm:px-8 py-3 sm:py-5 bg-red-50 text-red-500 font-black uppercase tracking-widest rounded-xl sm:rounded-[1.5rem] hover:bg-red-100 transition-all active:scale-95 text-xs sm:text-sm"
                        >
                              Resetar Tudo
                        </button>
                          </div>
                        </div>

                        <div>
                          <button 
                            onClick={() => {
                              localStorage.setItem('minas_v2_settings', JSON.stringify(settings));
                              localStorage.setItem('minas_v2_categories', JSON.stringify(categories));
                              localStorage.setItem('minas_v2_items', JSON.stringify(items));
                              alert('Todas as alterações foram salvas com sucesso!');
                            }}
                            className="w-full px-6 sm:px-12 py-4 sm:py-6 bg-green-600 hover:bg-green-700 text-white font-black uppercase tracking-widest rounded-xl sm:rounded-[1.5rem] shadow-2xl shadow-green-600/30 transition-all active:scale-95 flex items-center justify-center gap-3 sm:gap-4 text-sm sm:text-base"
                          >
                            <Save size={18} className="sm:w-5 sm:h-5" /> Salvar Todas as Alterações
                          </button>
                        </div>
                      </div>
                    </div>
                  )}
                </main>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Cart Modal */}
      <AnimatePresence>
        {isCartOpen && (
          <div className="fixed inset-0 z-[300] flex items-end sm:items-center justify-end sm:p-6">
            <motion.div 
              initial={{ opacity: 0 }} 
              animate={{ opacity: 1 }} 
              exit={{ opacity: 0 }} 
              onClick={() => setIsCartOpen(false)} 
              className="absolute inset-0 bg-stone-900/80 backdrop-blur-md" 
            />
            <motion.div 
              initial={{ x: "100%" }} 
              animate={{ x: 0 }} 
              exit={{ x: "100%" }} 
              transition={{ type: "spring", damping: 30, stiffness: 300 }}
              className="relative w-full max-w-xl bg-white h-full sm:h-auto sm:max-h-[90vh] sm:rounded-[3rem] flex flex-col shadow-2xl overflow-hidden border-l border-white/20"
            >
              <div className="p-10 border-b border-stone-100 flex items-center justify-between bg-stone-50/50 flex-shrink-0">
                <div className="flex items-center gap-6">
                  <div className="w-14 h-14 bg-orange-700 rounded-2xl flex items-center justify-center text-white shadow-xl rotate-3">
                    <ShoppingCart size={28} />
                  </div>
                  <h3 className="text-3xl font-black text-stone-900 tracking-tighter">Seu Pedido</h3>
                </div>
                <button 
                  onClick={() => setIsCartOpen(false)} 
                  className="w-12 h-12 bg-white hover:bg-red-50 text-stone-300 hover:text-red-500 rounded-2xl transition-all shadow-lg flex items-center justify-center"
                >
                  <X size={24} />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-10 space-y-6 custom-scrollbar min-h-0">
                {cart.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center text-center py-20">
                    <div className="w-24 h-24 bg-stone-50 text-stone-200 rounded-[2rem] flex items-center justify-center mb-8">
                      <ShoppingCart size={48} strokeWidth={1} />
                    </div>
                    <p className="text-stone-400 font-black uppercase tracking-[0.2em] text-sm mb-6">Carrinho Vazio</p>
                    <button onClick={() => setIsCartOpen(false)} className="text-orange-700 font-black uppercase text-xs tracking-widest hover:underline decoration-2 underline-offset-8">Voltar ao Cardápio</button>
                  </div>
                ) : (
                  cart.map(({ item, quantity }) => (
                    <div key={item.id} className="p-6 bg-stone-50/50 border border-stone-100 rounded-[2rem] flex items-center gap-6 group hover:bg-white hover:shadow-xl transition-all">
                      <div className="w-20 h-20 rounded-2xl overflow-hidden shrink-0 shadow-lg">
                        <img src={item.image || "https://images.unsplash.com/photo-1514327605112-b887c0e61c0a?q=80&w=2070&auto=format&fit=crop"} className="w-full h-full object-cover" alt="" />
                      </div>
                      <div className="flex-1">
                        <h5 className="font-black text-stone-900 tracking-tight">{item.name}</h5>
                        <p className="text-orange-700 font-black mt-1">{item.price.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</p>
                      </div>
                      <div className="flex items-center gap-4 bg-white p-2 rounded-2xl shadow-sm border border-stone-100">
                        <button onClick={() => updateQuantity(item.id, -1)} className="w-8 h-8 flex items-center justify-center text-stone-400 hover:text-orange-700 transition-colors"><Minus size={16} strokeWidth={3}/></button>
                        <span className="font-black text-stone-900 w-4 text-center">{quantity}</span>
                        <button onClick={() => updateQuantity(item.id, 1)} className="w-8 h-8 flex items-center justify-center text-stone-400 hover:text-orange-700 transition-colors"><Plus size={16} strokeWidth={3}/></button>
                      </div>
                      <button onClick={() => removeFromCart(item.id)} className="w-10 h-10 flex items-center justify-center text-stone-300 hover:text-red-500 transition-colors"><Trash2 size={20}/></button>
                    </div>
                  ))
                )}
              </div>

              {cart.length > 0 && (
                <div className="p-10 bg-stone-50 border-t border-stone-100 space-y-8 flex-shrink-0 overflow-y-auto max-h-[50vh]">
                  <div className="space-y-4">
                    <div className="flex justify-between items-center text-stone-400 font-bold uppercase text-[10px] tracking-[0.2em]">
                      <span>Subtotal</span>
                      <span>{cartTotal.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span>
                    </div>
                    <div className="flex justify-between items-center text-stone-400 font-bold uppercase text-[10px] tracking-[0.2em]">
                      <span>Entrega</span>
                      <span>{(settings.deliveryFee || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span>
                    </div>
                    <div className="flex justify-between items-center pt-6 border-t border-stone-200">
                      <span className="text-stone-900 font-black text-2xl tracking-tighter uppercase">Total</span>
                      <span className="text-orange-700 font-black text-4xl tracking-tighter">
                        {(cartTotal + (settings.deliveryFee || 0)).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                      </span>
                    </div>
                  </div>

                  {!isCheckoutOpen ? (
                    <button 
                      onClick={() => setIsCheckoutOpen(true)} 
                      className="w-full bg-orange-700 hover:bg-orange-800 text-white font-black py-6 rounded-[1.5rem] shadow-[0_20px_50px_rgba(194,65,12,0.3)] hover:shadow-[0_20px_50px_rgba(194,65,12,0.5)] transition-all hover:-translate-y-1 active:scale-95 uppercase tracking-[0.2em] text-xs"
                    >
                      Finalizar Pedido
                    </button>
                  ) : !isPaymentReviewOpen ? (
                    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
                      <div className="space-y-3">
                        <input placeholder="Nome Completo" value={customerName} onChange={e => setCustomerName(e.target.value)} className="w-full px-6 py-4 rounded-2xl border border-stone-100 focus:ring-4 focus:ring-orange-700/5 bg-white font-bold" />
                        <input placeholder="WhatsApp" value={customerPhone} onChange={e => setCustomerPhone(e.target.value)} className="w-full px-6 py-4 rounded-2xl border border-stone-100 focus:ring-4 focus:ring-orange-700/5 bg-white font-bold" />
                        <textarea placeholder="Endereço Completo" value={deliveryAddress} onChange={e => setDeliveryAddress(e.target.value)} className="w-full px-6 py-4 rounded-2xl border border-stone-100 focus:ring-4 focus:ring-orange-700/5 bg-white font-bold h-24 resize-none" />
                        <select value={paymentMethod} onChange={e => setPaymentMethod(e.target.value)} className="w-full px-6 py-4 rounded-2xl border border-stone-100 focus:ring-4 focus:ring-orange-700/5 bg-white font-black uppercase text-xs tracking-widest">
                          {(settings.paymentMethods || []).map(m => <option key={m} value={m}>{m}</option>)}
                        </select>
                      </div>
                      <div className="flex gap-4">
                        <button onClick={() => setIsCheckoutOpen(false)} className="flex-1 bg-stone-200 text-stone-600 font-black py-5 rounded-[1.5rem] uppercase text-[10px] tracking-widest">Voltar</button>
                        <button 
                          onClick={() => {
                            if (!customerName || !customerPhone || !deliveryAddress) {
                              alert('Por favor, preencha todos os campos obrigatórios.');
                              return;
                            }
                            setIsPaymentReviewOpen(true);
                          }} 
                          className="flex-[2] bg-blue-600 hover:bg-blue-700 text-white font-black py-5 rounded-[1.5rem] shadow-xl uppercase text-[10px] tracking-widest transition-all"
                        >
                          Revisar Pagamento
                        </button>
                      </div>
                    </motion.div>
                  ) : (
                    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
                      <div className="bg-blue-50 rounded-[2rem] p-6 border-2 border-blue-200">
                        <h4 className="font-black text-blue-900 mb-4 uppercase tracking-widest text-xs flex items-center gap-2">
                          <CreditCard size={18} /> Revisão do Pagamento
                        </h4>
                        <div className="space-y-3 text-sm">
                          <div className="flex justify-between">
                            <span className="text-stone-600 font-bold">Método de Pagamento:</span>
                            <span className="text-stone-900 font-black">{paymentMethod}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-stone-600 font-bold">Subtotal:</span>
                            <span className="text-stone-900 font-black">{cartTotal.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-stone-600 font-bold">Taxa de Entrega:</span>
                            <span className="text-stone-900 font-black">{settings.deliveryFee.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span>
                          </div>
                          <div className="pt-3 border-t border-blue-200 flex justify-between">
                            <span className="text-blue-900 font-black text-lg">Total a Pagar:</span>
                            <span className="text-blue-900 font-black text-xl">{(cartTotal + settings.deliveryFee).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span>
                          </div>
                        </div>
                      </div>
                      <div className="bg-stone-50 rounded-[2rem] p-6 border border-stone-100">
                        <h4 className="font-black text-stone-900 mb-3 uppercase tracking-widest text-xs">Dados de Entrega</h4>
                        <div className="space-y-2 text-sm">
                          <p className="text-stone-700 font-bold"><span className="text-stone-500">Nome:</span> {customerName}</p>
                          <p className="text-stone-700 font-bold"><span className="text-stone-500">WhatsApp:</span> {customerPhone}</p>
                          <p className="text-stone-700 font-bold"><span className="text-stone-500">Endereço:</span> {deliveryAddress}</p>
                        </div>
                      </div>
                      <div className="flex gap-4">
                        <button onClick={() => setIsPaymentReviewOpen(false)} className="flex-1 bg-stone-200 text-stone-600 font-black py-5 rounded-[1.5rem] uppercase text-[10px] tracking-widest">Voltar</button>
                        <button 
                          onClick={placeOrder} 
                          className="flex-[2] bg-green-600 hover:bg-green-700 text-white font-black py-5 rounded-[1.5rem] shadow-xl uppercase text-[10px] tracking-widest transition-all"
                        >
                          Confirmar e Enviar Pedido
                        </button>
                      </div>
                    </motion.div>
                  )}
                </div>
              )}
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Order Confirmation Modal */}
      <AnimatePresence>
        {orderConfirmation && (
          <div className="fixed inset-0 z-[400] flex items-center justify-center p-4 overflow-y-auto">
            <motion.div 
              initial={{ opacity: 0 }} 
              animate={{ opacity: 1 }} 
              exit={{ opacity: 0 }} 
              onClick={() => setOrderConfirmation(null)} 
              className="absolute inset-0 bg-stone-900/95 backdrop-blur-xl" 
            />
            <motion.div 
              initial={{ scale: 0.9, opacity: 0, y: 20 }} 
              animate={{ scale: 1, opacity: 1, y: 0 }} 
              exit={{ scale: 0.9, opacity: 0, y: 20 }} 
              onClick={(e) => e.stopPropagation()}
              className="relative w-full max-w-2xl bg-white rounded-[3rem] shadow-2xl overflow-hidden border border-white/20"
            >
              <div className="p-12 text-center bg-gradient-to-br from-green-50 to-orange-50 border-b border-stone-100">
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ delay: 0.2, type: "spring" }}
                  className="w-24 h-24 bg-green-600 rounded-full flex items-center justify-center mx-auto mb-6 shadow-2xl shadow-green-600/30"
                >
                  <CheckCircle size={48} className="text-white" strokeWidth={2.5} />
                </motion.div>
                <h3 className="text-4xl font-black text-stone-900 tracking-tighter mb-3">
                  Pedido Confirmado!
                </h3>
                <p className="text-stone-600 font-bold text-lg">
                  Pedido #{orderConfirmation.id}
                </p>
              </div>

              <div className="p-12 space-y-8">
                <div className="bg-stone-50 rounded-[2rem] p-8 border border-stone-100">
                  <h4 className="font-black text-stone-900 mb-6 uppercase tracking-widest text-xs">Resumo do Pedido</h4>
                  <div className="space-y-4">
                    {orderConfirmation.items.map((cartItem, idx) => (
                      <div key={idx} className="flex justify-between items-center py-3 border-b border-stone-100 last:border-0">
                        <span className="font-bold text-stone-800">
                          {cartItem.quantity}x {cartItem.item.name}
                        </span>
                        <span className="font-black text-stone-900">
                          {(cartItem.item.price * cartItem.quantity).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                        </span>
                      </div>
                    ))}
                  </div>
                  <div className="mt-6 pt-6 border-t border-stone-200 space-y-3">
                    <div className="flex justify-between text-stone-600 font-bold text-sm">
                      <span>Subtotal</span>
                      <span>{(orderConfirmation.total - settings.deliveryFee).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span>
                    </div>
                    <div className="flex justify-between text-stone-600 font-bold text-sm">
                      <span>Taxa de Entrega</span>
                      <span>{settings.deliveryFee.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span>
                    </div>
                    <div className="flex justify-between pt-4 border-t border-stone-300">
                      <span className="text-2xl font-black text-stone-900 uppercase">Total</span>
                      <span className="text-3xl font-black text-orange-700">
                        {orderConfirmation.total.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="bg-blue-50 rounded-[2rem] p-6 border border-blue-100">
                  <h4 className="font-black text-blue-900 mb-4 uppercase tracking-widest text-xs flex items-center gap-2">
                    <MessageCircle size={16} /> Informações do Cliente
                  </h4>
                  <div className="space-y-2 text-sm">
                    <p className="font-bold text-stone-800"><span className="text-stone-500">Nome:</span> {orderConfirmation.customerName}</p>
                    <p className="font-bold text-stone-800"><span className="text-stone-500">WhatsApp:</span> {orderConfirmation.customerPhone}</p>
                    <p className="font-bold text-stone-800"><span className="text-stone-500">Endereço:</span> {orderConfirmation.address}</p>
                    <p className="font-bold text-stone-800"><span className="text-stone-500">Pagamento:</span> {orderConfirmation.paymentMethod}</p>
                  </div>
                </div>

                <div className="bg-green-50 rounded-[2rem] p-6 border border-green-100">
                  <p className="text-green-800 font-bold text-sm leading-relaxed">
                    ✓ Seu pedido foi enviado para o WhatsApp do restaurante. 
                    Em breve você receberá a confirmação e o tempo estimado de entrega.
                  </p>
                </div>

                <div className="flex gap-4">
                  <button 
                    onClick={() => setOrderConfirmation(null)}
                    className="flex-1 bg-stone-200 hover:bg-stone-300 text-stone-700 font-black py-5 rounded-[1.5rem] uppercase text-xs tracking-widest transition-all"
                  >
                    Fechar
                  </button>
                  <button 
                    onClick={() => {
                      setOrderConfirmation(null);
                      window.scrollTo({ top: 0, behavior: 'smooth' });
                    }}
                    className="flex-1 bg-orange-700 hover:bg-orange-800 text-white font-black py-5 rounded-[1.5rem] uppercase text-xs tracking-widest shadow-xl transition-all"
                  >
                    Ver Cardápio
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* New Item Modal */}
      <AnimatePresence>
        {isNewItemModalOpen && (
          <div className="fixed inset-0 z-[500] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }} 
              animate={{ opacity: 1 }} 
              exit={{ opacity: 0 }} 
              onClick={() => setIsNewItemModalOpen(false)} 
              className="absolute inset-0 bg-stone-900/95 backdrop-blur-xl" 
            />
            <motion.div 
              initial={{ scale: 0.9, opacity: 0, y: 20 }} 
              animate={{ scale: 1, opacity: 1, y: 0 }} 
              exit={{ scale: 0.9, opacity: 0, y: 20 }} 
              onClick={(e) => e.stopPropagation()}
              className="relative w-full max-w-2xl bg-white rounded-[3rem] shadow-2xl overflow-hidden border border-white/20"
            >
              <div className="p-10 border-b border-stone-100 flex items-center justify-between bg-stone-50/50">
                <div className="flex items-center gap-6">
                  <div className="w-16 h-16 bg-orange-700 rounded-3xl flex items-center justify-center text-white shadow-2xl rotate-3">
                    <Plus size={32} />
                  </div>
                  <div>
                    <h3 className="text-4xl font-black text-stone-900 tracking-tighter">Novo Item</h3>
                    <p className="text-stone-400 font-bold uppercase text-[10px] tracking-widest mt-1">Adicionar ao Cardápio</p>
                  </div>
                </div>
                <button 
                  onClick={() => setIsNewItemModalOpen(false)} 
                  className="w-14 h-14 bg-white hover:bg-red-50 text-stone-400 hover:text-red-500 rounded-2xl transition-all shadow-xl flex items-center justify-center active:scale-90"
                >
                  <X size={28} />
                </button>
              </div>

              <div className="p-10 space-y-6">
                <div className="space-y-4">
                  <label className="text-[10px] font-black text-stone-400 uppercase tracking-[0.3em]">Nome do Item</label>
                  <input 
                    value={newItemForm.name}
                    onChange={(e) => setNewItemForm({...newItemForm, name: e.target.value})}
                    placeholder="Ex: Refrigerante, Pudim, etc."
                    className="w-full px-8 py-5 rounded-3xl border border-stone-100 focus:outline-none focus:ring-4 focus:ring-orange-700/5 focus:border-orange-700/20 bg-stone-50/50 font-black text-lg text-stone-900 transition-all"
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-4">
                    <label className="text-[10px] font-black text-stone-400 uppercase tracking-[0.3em]">Preço (R$)</label>
                    <input 
                      type="number"
                      step="0.01"
                      value={newItemForm.price}
                      onChange={(e) => setNewItemForm({...newItemForm, price: e.target.value})}
                      placeholder="15.90"
                      className="w-full px-8 py-5 rounded-3xl border border-stone-100 focus:outline-none focus:ring-4 focus:ring-orange-700/5 bg-stone-50/50 font-black text-lg text-stone-900"
                    />
                  </div>

                  <div className="space-y-4">
                    <label className="text-[10px] font-black text-stone-400 uppercase tracking-[0.3em]">Categoria</label>
                    <select 
                      value={newItemForm.category}
                      onChange={(e) => setNewItemForm({...newItemForm, category: e.target.value})}
                      className="w-full px-8 py-5 rounded-3xl border border-stone-100 focus:outline-none focus:ring-4 focus:ring-orange-700/5 bg-stone-50/50 font-black text-lg text-stone-900"
                    >
                      {categories.map(cat => (
                        <option key={cat.id} value={cat.id}>{cat.name}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="space-y-4">
                  <label className="text-[10px] font-black text-stone-400 uppercase tracking-[0.3em]">Descrição</label>
                  <textarea 
                    value={newItemForm.description}
                    onChange={(e) => setNewItemForm({...newItemForm, description: e.target.value})}
                    placeholder="Descreva o item..."
                    rows={3}
                    className="w-full px-8 py-5 rounded-3xl border border-stone-100 focus:outline-none focus:ring-4 focus:ring-orange-700/5 bg-stone-50/50 font-bold text-stone-900 resize-none"
                  />
                </div>

                <div className="flex gap-4 pt-6">
                  <button 
                    onClick={() => setIsNewItemModalOpen(false)}
                    className="flex-1 bg-stone-200 text-stone-600 font-black py-5 rounded-[1.5rem] uppercase text-xs tracking-widest transition-all hover:bg-stone-300"
                  >
                    Cancelar
                  </button>
                  <button 
                    onClick={() => {
                      if (!newItemForm.name || !newItemForm.price || !newItemForm.category) {
                        alert('Por favor, preencha todos os campos obrigatórios!');
                        return;
                      }
                      const newItem: MenuItem = {
                        id: generateId(),
                        name: newItemForm.name,
                        price: parseFloat(newItemForm.price.replace(',', '.')) || 0,
                        description: newItemForm.description || 'Item especial da casa...',
                        category: newItemForm.category,
                        available: true
                      };
                      setItems([...items, newItem]);
                      setNewItemForm({ name: '', price: '', description: '', category: categories[0]?.id || '' });
                      setIsNewItemModalOpen(false);
                    }}
                    className="flex-[2] bg-green-600 hover:bg-green-700 text-white font-black py-5 rounded-[1.5rem] shadow-xl uppercase text-xs tracking-widest transition-all"
                  >
                    Adicionar Item
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default App;
