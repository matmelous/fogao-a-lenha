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
import { currentExperimentalPayments, currentTenantConfig, currentTenantId, currentTenantMode, tenantStorageKeys } from './tenant';

declare global {
  interface Window {
    MercadoPago?: new (publicKey: string, options?: { locale?: string }) => {
      bricks: () => {
        create: (
          brickType: string,
          containerId: string,
          settings: Record<string, unknown>,
        ) => Promise<{ unmount?: () => Promise<void> | void }>;
      };
    };
  }
}

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

const legacyStorageKeys = {
  categories: 'minas_v2_categories',
  items: 'minas_v2_items',
  settings: 'minas_v2_settings',
  orders: 'minas_v2_orders',
  lastSync: 'minas_v2_lastSync',
  backup: 'minas_v2_backup',
};

const getLegacyStorageKey = (key: string) => {
  if (key === tenantStorageKeys.categories) return legacyStorageKeys.categories;
  if (key === tenantStorageKeys.items) return legacyStorageKeys.items;
  if (key === tenantStorageKeys.settings) return legacyStorageKeys.settings;
  if (key === tenantStorageKeys.orders) return legacyStorageKeys.orders;
  if (key === tenantStorageKeys.lastSync) return legacyStorageKeys.lastSync;
  if (key === tenantStorageKeys.backup) return legacyStorageKeys.backup;
  return '';
};

function App() {
  const adminPassword = import.meta.env.VITE_ADMIN_PASSWORD;
  const normalizedAdminPassword = typeof adminPassword === 'string' ? adminPassword.trim() : '';
  const adminApiToken = typeof import.meta.env.VITE_ADMIN_API_TOKEN === 'string'
    ? import.meta.env.VITE_ADMIN_API_TOKEN.trim()
    : '';
  const notifyApiToken = typeof import.meta.env.VITE_NOTIFY_API_TOKEN === 'string'
    ? import.meta.env.VITE_NOTIFY_API_TOKEN.trim()
    : '';
  const tenantDisplayName = currentTenantConfig?.name || initialSettings.name;
  const isLabTenant = currentTenantMode === 'lab';

  // Version check for updates
  useEffect(() => {
    const APP_VERSION = '2.1.0';
    const VERSION_KEY = tenantStorageKeys.version;
    const BUILD_TIME_KEY = tenantStorageKeys.buildTime;
    
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
    if (!stored) {
      const legacyKey = getLegacyStorageKey(key);
      if (!legacyKey) return initial;
      const legacyStored = localStorage.getItem(legacyKey);
      if (!legacyStored) return initial;
      localStorage.setItem(key, legacyStored);
      return JSON.parse(legacyStored) as T;
    }
      const parsed = JSON.parse(stored);
      // No migration - allow any name
      return parsed;
    } catch (error) {
      console.error(`Error loading ${key} from localStorage:`, error);
      return initial;
    }
  };

  const [categories, setCategories] = useState<Category[]>(() => getStoredData(tenantStorageKeys.categories, initialCategories));
  const [items, setItems] = useState<MenuItem[]>(() => getStoredData(tenantStorageKeys.items, initialMenuItems));
  const [settings, setSettings] = useState<RestaurantSettings>(() => getStoredData(tenantStorageKeys.settings, initialSettings));
  const [orders, setOrders] = useState<Order[]>(() => getStoredData(tenantStorageKeys.orders, []));
  const [isInitialized, setIsInitialized] = useState(false);
  const [lastSyncStatus, setLastSyncStatus] = useState<{ success: boolean; time: string | null; error?: string }>({ success: false, time: null });
  const [showUpdateBanner, setShowUpdateBanner] = useState(false);
  const [incomingOrderAlert, setIncomingOrderAlert] = useState<Order | null>(null);
  const latestOrderSignatureRef = useRef<string | null>(null);
  
  // Admin authentication - only you have access
  const [isAdminAuthenticated, setIsAdminAuthenticated] = useState(false);
  const [isAdminAccessModalOpen, setIsAdminAccessModalOpen] = useState(false);
  const [adminAccessPassword, setAdminAccessPassword] = useState('');
  const adminTapCountRef = useRef(0);
  const adminTapTimeoutRef = useRef<number | null>(null);
  
  // Auto-update restaurant name if it's the old one
  useEffect(() => {
    if (settings.name === 'Fogão & Sabor' || settings.name === 'Fogao & Sabor') {
      const updatedSettings = { ...settings, name: 'Sabor Caseiro' };
      setSettings(updatedSettings);
      try {
        localStorage.setItem(tenantStorageKeys.settings, JSON.stringify(updatedSettings));
        console.log('✅ Restaurant name updated from "Fogão & Sabor" to "Sabor Caseiro"');
      } catch (e) {
        console.error('Error updating restaurant name:', e);
      }
    }
  }, [settings]);

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
        localStorage.setItem(tenantStorageKeys.settings, JSON.stringify(updatedSettings));
      } catch (e) {
        console.error('Error initializing bank info and payment tokens:', e);
      }
    }
  }, [settings]);

  useEffect(() => {
    if (currentTenantId !== 'saborcaseiro-lab') return;

    const testItemId = 'lab-item-teste';
    const alreadyExists = items.some((item) => item.id === testItemId);
    if (alreadyExists) return;

    const testItem: MenuItem = {
      id: testItemId,
      name: 'Teste',
      description: 'Produto de homologação para validar checkout e carteiras digitais.',
      price: 2,
      category: categories[0]?.id || '1',
      available: true,
    };

    setItems((prev) => [...prev, testItem]);
  }, [categories, items]);
  
  const handleAdminLogin = () => {
    if (!isDesktop) return;
    setAdminAccessPassword('');
    setIsAdminAccessModalOpen(true);
  };

  const handleAdminAccessSubmit = (event: { preventDefault: () => void }) => {
    event.preventDefault();
    if (!normalizedAdminPassword) {
      alert('Senha de admin nao configurada. Defina VITE_ADMIN_PASSWORD no ambiente.');
      return;
    }
    const typedPassword = adminAccessPassword.trim();
    if (typedPassword === normalizedAdminPassword) {
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
  const [pixOrder, setPixOrder] = useState<Order | null>(null);
  const [pixCopied, setPixCopied] = useState(false);
  const [isCardPaymentOpen, setIsCardPaymentOpen] = useState(false);
  const [cardCheckoutOrder, setCardCheckoutOrder] = useState<Order | null>(null);
  const [isExperimentalPaymentOpen, setIsExperimentalPaymentOpen] = useState(false);
  const [selectedExperimentalPayment, setSelectedExperimentalPayment] = useState('');
  const [cardPaymentError, setCardPaymentError] = useState<string | null>(null);
  const [isCardBrickReady, setIsCardBrickReady] = useState(false);
  const [isCardSubmitting, setIsCardSubmitting] = useState(false);
  const [isNewItemModalOpen, setIsNewItemModalOpen] = useState(false);
  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [newItemForm, setNewItemForm] = useState({ name: '', price: '', description: '', category: '', image: '', available: true });
  const defaultHeroForegroundImage = '/sabor-caseiro-hero.png';
  const heroForegroundImage = settings.heroImage || settings.logo || defaultHeroForegroundImage;
  const checkoutPaymentMethods = Array.from(
    new Set([...(settings.paymentMethods || []), ...currentExperimentalPayments]),
  );
  const latestDataRef = useRef({ categories, items, settings, orders });
  const mercadoPagoScriptPromiseRef = useRef<Promise<void> | null>(null);
  const cardBrickControllerRef = useRef<{ unmount?: () => Promise<void> | void } | null>(null);

  useEffect(() => {
    latestDataRef.current = { categories, items, settings, orders };
  }, [categories, items, settings, orders]);


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

  const openNewItemModal = (categoryId?: string) => {
    if (categories.length === 0) {
      alert('Por favor, crie uma categoria primeiro!');
      return;
    }

    const fallbackCategoryId = categories[0]?.id || '';
    setNewItemForm({
      name: '',
      price: '',
      description: '',
      category: categoryId && categories.some(cat => cat.id === categoryId) ? categoryId : fallbackCategoryId,
      image: '',
      available: true,
    });
    setEditingItemId(null);
    setIsNewItemModalOpen(true);
  };

  const openEditItemModal = (item: MenuItem) => {
    setNewItemForm({
      name: item.name,
      price: item.price.toString(),
      description: item.description || '',
      category: item.category,
      image: item.image || '',
      available: item.available,
    });
    setEditingItemId(item.id);
    setIsNewItemModalOpen(true);
  };

  // Persistence effects
  useEffect(() => {
    document.title = settings.name || tenantDisplayName;
  }, [settings.name, tenantDisplayName]);

  // Sync functions
  const getApiUrl = () => {
    return `${window.location.origin}/api/data`;
  };

  const getStripeCheckoutApiUrl = () => {
    return `${window.location.origin}/api/create-stripe-checkout`;
  };

  const getApiAuthHeaders = () => {
    return {
      'x-tenant-id': currentTenantId,
      ...(adminApiToken ? { 'x-admin-token': adminApiToken } : {}),
    };
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
    const {
      categories: latestCategories,
      items: latestItems,
      settings: latestSettings,
      orders: latestOrders,
    } = latestDataRef.current;

    // Compress images in items (ultra compression for sync)
    const optimizedItems = await Promise.all(
      latestItems.map(async (item) => ({
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
      name: latestSettings.name,
      phone: latestSettings.phone,
      whatsapp: latestSettings.whatsapp,
      address: latestSettings.address,
      openingHours: latestSettings.openingHours,
      deliveryFee: latestSettings.deliveryFee,
      minOrder: latestSettings.minOrder,
      paymentMethods: latestSettings.paymentMethods,
      bankInfo: latestSettings.bankInfo,
      paymentTokens: latestSettings.paymentTokens,
      logoSize: latestSettings.logoSize,
      logoSizePx: latestSettings.logoSizePx,
      aboutImage1Size: latestSettings.aboutImage1Size,
      aboutImage1SizePx: latestSettings.aboutImage1SizePx,
      aboutImage2Size: latestSettings.aboutImage2Size,
      aboutImage2SizePx: latestSettings.aboutImage2SizePx,
      // Compress media images for sync
      logo: latestSettings.logo ? await compressImageForSync(latestSettings.logo, 200, 0.4) : '',
      heroImage: latestSettings.heroImage ? await compressImageForSync(latestSettings.heroImage, 800, 0.4) : '',
      heroVideo: latestSettings.heroVideo || '', // Videos are not compressed
      aboutImage1: latestSettings.aboutImage1 ? await compressImageForSync(latestSettings.aboutImage1, 600, 0.4) : '',
      aboutImage2: latestSettings.aboutImage2 ? await compressImageForSync(latestSettings.aboutImage2, 600, 0.4) : ''
    };

    // Limit orders to last 100 to prevent payload from being too large
    const limitedOrders = (latestOrders || []).slice(-100);

    return {
      categories: latestCategories,
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
          localStorage.setItem(tenantStorageKeys.lastSync, JSON.stringify({ time: now.toISOString(), success: true }));
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
      const response = await fetch(getApiUrl(), {
        headers: {
          'x-tenant-id': currentTenantId,
        },
      });
      const result = await response.json();
      
      if (result.success && result.data) {
        const cloudData = result.data;
        
        // Only update if cloud data exists
        if (cloudData.categories && cloudData.items && cloudData.settings) {
          const { items: localItems, settings: localSettings } = latestDataRef.current;
          // Merge with local data if preserveLocalImages is true
          let mergedItems = cloudData.items;
          let mergedSettings = cloudData.settings;
          
          if (preserveLocalImages) {
            // Preserve local images in items - but only if local image exists
            // If local image is empty, it means it was never set or was cleared
            mergedItems = cloudData.items.map((cloudItem: MenuItem) => {
              const localItem = localItems.find(item => item.id === cloudItem.id);
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
              bankInfo: cloudData.settings.bankInfo || localSettings.bankInfo,
              paymentTokens: cloudData.settings.paymentTokens || localSettings.paymentTokens,
              logo: (cloudData.settings.logo && cloudData.settings.logo.trim() !== '') ? cloudData.settings.logo : (localSettings.logo || ''),
              logoSize: cloudData.settings.logoSize || localSettings.logoSize,
              logoSizePx: cloudData.settings.logoSizePx || localSettings.logoSizePx,
              heroVideo: (cloudData.settings.heroVideo && cloudData.settings.heroVideo.trim() !== '') ? cloudData.settings.heroVideo : (localSettings.heroVideo || ''),
              heroImage: (cloudData.settings.heroImage && cloudData.settings.heroImage.trim() !== '') ? cloudData.settings.heroImage : (localSettings.heroImage || ''),
              aboutImage1: (cloudData.settings.aboutImage1 && cloudData.settings.aboutImage1.trim() !== '') ? cloudData.settings.aboutImage1 : (localSettings.aboutImage1 || ''),
              aboutImage1Size: cloudData.settings.aboutImage1Size || localSettings.aboutImage1Size,
              aboutImage1SizePx: cloudData.settings.aboutImage1SizePx || localSettings.aboutImage1SizePx,
              aboutImage2: (cloudData.settings.aboutImage2 && cloudData.settings.aboutImage2.trim() !== '') ? cloudData.settings.aboutImage2 : (localSettings.aboutImage2 || ''),
              aboutImage2Size: cloudData.settings.aboutImage2Size || localSettings.aboutImage2Size,
              aboutImage2SizePx: cloudData.settings.aboutImage2SizePx || localSettings.aboutImage2SizePx
            };
          } else {
            // If not preserving, use cloud data as-is (but cloud data has no images, so they'll be empty)
            // In this case, we should keep local images if they exist
            mergedItems = cloudData.items.map((cloudItem: MenuItem) => {
              const localItem = localItems.find(item => item.id === cloudItem.id);
              return {
                ...cloudItem,
                image: localItem?.image || '' // Keep local image if exists, otherwise empty
              };
            });
            
            mergedSettings = {
              ...cloudData.settings,
              bankInfo: cloudData.settings.bankInfo || localSettings.bankInfo,
              paymentTokens: cloudData.settings.paymentTokens || localSettings.paymentTokens,
              logo: localSettings.logo || '',
              logoSize: cloudData.settings.logoSize || localSettings.logoSize,
              logoSizePx: cloudData.settings.logoSizePx || localSettings.logoSizePx,
              heroVideo: localSettings.heroVideo || '',
              heroImage: localSettings.heroImage || '',
              aboutImage1: localSettings.aboutImage1 || '',
              aboutImage1Size: cloudData.settings.aboutImage1Size || localSettings.aboutImage1Size,
              aboutImage1SizePx: cloudData.settings.aboutImage1SizePx || localSettings.aboutImage1SizePx,
              aboutImage2: localSettings.aboutImage2 || '',
              aboutImage2Size: cloudData.settings.aboutImage2Size || localSettings.aboutImage2Size,
              aboutImage2SizePx: cloudData.settings.aboutImage2SizePx || localSettings.aboutImage2SizePx
            };
          }
          
          // Auto-update restaurant name if it's the old one
          if (mergedSettings.name === 'Fogão & Sabor' || mergedSettings.name === 'Fogao & Sabor') {
            mergedSettings.name = 'Sabor Caseiro';
            console.log('✅ Restaurant name updated from cloud data: "Fogão & Sabor" → "Sabor Caseiro"');
          }
          
          setCategories(cloudData.categories);
          setItems(mergedItems);
          setSettings(mergedSettings);
          if (cloudData.orders) {
            setOrders(cloudData.orders);
          }
          
          // Also save merged data to localStorage
          try {
            localStorage.setItem(tenantStorageKeys.categories, JSON.stringify(cloudData.categories));
            localStorage.setItem(tenantStorageKeys.items, JSON.stringify(mergedItems));
            localStorage.setItem(tenantStorageKeys.settings, JSON.stringify(mergedSettings));
            if (cloudData.orders) {
              localStorage.setItem(tenantStorageKeys.orders, JSON.stringify(cloudData.orders));
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
      const stored = localStorage.getItem(tenantStorageKeys.lastSync) ?? localStorage.getItem(legacyStorageKeys.lastSync);
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
      localStorage.setItem(tenantStorageKeys.backup, JSON.stringify(backup));
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
        const {
          categories: currentCategories,
          items: currentItems,
          settings: currentSettings,
          orders: currentOrders,
        } = latestDataRef.current;
        // Create backup before loading from cloud
        createBackup(currentCategories, currentItems, currentSettings, currentOrders);
        
        const response = await fetch(getApiUrl(), {
          headers: {
            'x-tenant-id': currentTenantId,
          },
        });
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
    const handleFocus = () => {
      checkCloudUpdates();
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('focus', handleFocus);
    
    return () => {
      clearInterval(interval);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('focus', handleFocus);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
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
    if (!isInitialized || !isDesktop || !isAdminAuthenticated) return;
    
    const syncTimeout = setTimeout(() => {
      syncToCloud();
    }, 2000); // Wait 2 seconds after last change before syncing

    return () => clearTimeout(syncTimeout);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [categories, items, settings, isInitialized, isDesktop, isAdminAuthenticated]);

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
        const backupStr = localStorage.getItem(tenantStorageKeys.backup) ?? localStorage.getItem(legacyStorageKeys.backup);
        const currentCategories = JSON.parse(localStorage.getItem(tenantStorageKeys.categories) || localStorage.getItem(legacyStorageKeys.categories) || '[]');
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
      localStorage.setItem(tenantStorageKeys.categories, JSON.stringify(categories));
    } catch (error) {
      console.error('Error saving categories to localStorage:', error);
    }
  }, [categories, items, settings, orders, isInitialized]);

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
        localStorage.setItem(tenantStorageKeys.items, JSON.stringify(itemsWithoutLargeImages));
      } else {
        localStorage.setItem(tenantStorageKeys.items, itemsJson);
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
        localStorage.setItem(tenantStorageKeys.settings, settingsJson);
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
            localStorage.setItem(tenantStorageKeys.settings, JSON.stringify(settingsWithoutLargeMedia));
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
      localStorage.setItem(tenantStorageKeys.orders, JSON.stringify(orders));
    } catch (error) {
      console.error('Error saving orders to localStorage:', error);
    }
  }, [orders, isInitialized]);

  // Admin tabs
  const [adminTab, setAdminTab] = useState<'items' | 'categories' | 'orders' | 'settings'>('orders');

  // Checkout form
  const [customerName, setCustomerName] = useState('');
  const [customerEmail, setCustomerEmail] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [deliveryAddress, setDeliveryAddress] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('Dinheiro');

  const playOrderAlarm = () => {
    try {
      const audioContext = new window.AudioContext();
      const sequence = [880, 660, 880, 660];
      sequence.forEach((frequency, index) => {
        const oscillator = audioContext.createOscillator();
        const gainNode = audioContext.createGain();
        oscillator.type = 'square';
        oscillator.frequency.value = frequency;
        oscillator.connect(gainNode);
        gainNode.connect(audioContext.destination);
        const start = audioContext.currentTime + index * 0.18;
        const end = start + 0.14;
        gainNode.gain.setValueAtTime(0.0001, start);
        gainNode.gain.exponentialRampToValueAtTime(0.18, start + 0.02);
        gainNode.gain.exponentialRampToValueAtTime(0.0001, end);
        oscillator.start(start);
        oscillator.stop(end);
      });
    } catch (error) {
      console.error('Nao foi possivel tocar o alarme de pedido:', error);
    }
  };

  const notifyOrderByWhatsapp = async (
    order: Order,
    notificationType: 'new_order' | 'payment_confirmed' = 'new_order',
  ) => {
    try {
      const response = await fetch('/api/notify-order', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-tenant-id': currentTenantId,
          ...(notifyApiToken ? { 'x-notify-token': notifyApiToken } : {}),
        },
        body: JSON.stringify({
          ...order,
          notificationType,
        }),
      });
      if (!response.ok) {
        const errorText = await response.text();
        console.error('Falha ao notificar pedido por WhatsApp API:', errorText);
        return false;
      }
      return true;
    } catch (error) {
      console.error('Erro ao enviar notificacao por WhatsApp API:', error);
      return false;
    }
  };

  const copyText = async (text: string) => {
    await navigator.clipboard.writeText(text);
  };

  const isStripeWalletPaymentMethod = (method: string) =>
    method === 'Apple Pay (Teste)' || method === 'Google Pay (Teste)';

  const getRestaurantWhatsappUrl = (message: string) => {
    const normalizedWhatsapp = settings.whatsapp.replace(/\D/g, '');
    return `https://wa.me/55${normalizedWhatsapp}?text=${encodeURIComponent(message)}`;
  };

  const buildOrderWhatsappMessage = (order: Order, paymentLabel?: string) => {
    const itemsList = order.items
      .map((entry) => `*${entry.quantity}x ${entry.item.name}* - R$ ${(entry.item.price * entry.quantity).toFixed(2)}`)
      .join('\n');

    return `*NOVO PEDIDO #${order.id}*\n\n` +
      `*Cliente:* ${order.customerName}\n` +
      `${order.customerEmail ? `*Email:* ${order.customerEmail}\n` : ''}` +
      `*Telefone:* ${order.customerPhone}\n` +
      `*Endereço:* ${order.address}\n` +
      `*Pagamento:* ${paymentLabel || order.paymentMethod}\n\n` +
      `*Itens:*\n${itemsList}\n\n` +
      `*Subtotal:* R$ ${(order.total - settings.deliveryFee).toFixed(2)}\n` +
      `*Taxa de Entrega:* R$ ${settings.deliveryFee.toFixed(2)}\n` +
      `*TOTAL:* R$ ${order.total.toFixed(2)}\n\n` +
      `_Pedido realizado via Site_`;
  };

  const openRestaurantWhatsappFallback = (message: string) => {
    window.open(getRestaurantWhatsappUrl(message), '_blank');
  };

  const getPixKeyLabel = () => settings.bankInfo?.pixKey?.trim() || '';

  const isCardPaymentMethod = (method: string) =>
    method === 'Cartão de Crédito' || method === 'Cartão de Débito';

  const isExperimentalPaymentMethod = (method: string) =>
    currentExperimentalPayments.includes(method);

  const validateCheckoutFields = () => {
    if (!customerName || !customerPhone || !deliveryAddress) {
      alert('Por favor, preencha todos os campos obrigatórios.');
      return false;
    }

    if (isCardPaymentMethod(paymentMethod) && !customerEmail.trim()) {
      alert('Informe um e-mail para continuar com o pagamento no cartão.');
      return false;
    }

    if (isExperimentalPaymentMethod(paymentMethod) && !isLabTenant) {
      alert('Este meio de pagamento está liberado apenas no ambiente de homologação.');
      return false;
    }

    return true;
  };

  const buildOrder = (overrides?: Partial<Order>): Order => {
    const orderId = generateId();
    return {
      id: orderId,
      customerName,
      customerEmail: customerEmail.trim() || undefined,
      customerPhone,
      address: deliveryAddress,
      items: [...cart],
      total: cartTotal + settings.deliveryFee,
      status: overrides?.status || 'pending',
      createdAt: new Date().toISOString(),
      paymentMethod,
      paymentStatus: overrides?.paymentStatus || 'pending',
      paymentId: overrides?.paymentId,
    };
  };

  const resetCheckoutState = () => {
    setCart([]);
    setIsCheckoutOpen(false);
    setIsPaymentReviewOpen(false);
    setIsCartOpen(false);
    setCustomerName('');
    setCustomerEmail('');
    setCustomerPhone('');
    setDeliveryAddress('');
    setPaymentMethod((settings.paymentMethods || [])[0] || 'Dinheiro');
  };

  const persistOrder = async (
    order: Order,
    notificationType: 'new_order' | 'payment_confirmed' = 'new_order',
    fallbackMessage?: string,
  ) => {
    setOrders(prev => [order, ...prev]);
    const notifySucceeded = await notifyOrderByWhatsapp(order, notificationType);
    if (!notifySucceeded && fallbackMessage) {
      openRestaurantWhatsappFallback(fallbackMessage);
    }
  };

  const updateExistingOrder = (orderId: string, updates: Partial<Order>) => {
    setOrders(prev => prev.map(order => (
      order.id === orderId
        ? { ...order, ...updates }
        : order
    )));
  };

  const finalizeSuccessfulOrder = async (order: Order, paymentLabel: string) => {
    const updatedOrder: Order = {
      ...order,
      status: 'preparing',
      paymentStatus: 'approved',
    };

    updateExistingOrder(order.id, {
      status: 'preparing',
      paymentStatus: 'approved',
      paymentId: order.paymentId,
    });

    const paymentConfirmedMessage = `*PAGAMENTO CONFIRMADO #${updatedOrder.id}*\n\n` +
      `Cliente: ${updatedOrder.customerName}\n` +
      `Pagamento: ${paymentLabel}\n` +
      `Total: R$ ${updatedOrder.total.toFixed(2)}\n\n` +
      `Pedido liberado para produção.`;

    const notifySucceeded = await notifyOrderByWhatsapp(updatedOrder, 'payment_confirmed');
    if (!notifySucceeded) {
      openRestaurantWhatsappFallback(paymentConfirmedMessage);
    }

    setPixOrder(null);
    setOrderConfirmation(updatedOrder);
    resetCheckoutState();
  };

  const ensureMercadoPagoSdk = async () => {
    if (window.MercadoPago) return;
    if (mercadoPagoScriptPromiseRef.current) {
      await mercadoPagoScriptPromiseRef.current;
      return;
    }

    mercadoPagoScriptPromiseRef.current = new Promise<void>((resolve, reject) => {
      const existing = document.querySelector<HTMLScriptElement>('script[data-mercado-pago-sdk="true"]');
      if (existing) {
        existing.addEventListener('load', () => resolve(), { once: true });
        existing.addEventListener('error', () => reject(new Error('Falha ao carregar o SDK do Mercado Pago.')), { once: true });
        return;
      }

      const script = document.createElement('script');
      script.src = 'https://sdk.mercadopago.com/js/v2';
      script.async = true;
      script.dataset.mercadoPagoSdk = 'true';
      script.onload = () => resolve();
      script.onerror = () => reject(new Error('Falha ao carregar o SDK do Mercado Pago.'));
      document.head.appendChild(script);
    });

    await mercadoPagoScriptPromiseRef.current;
  };

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
    void notifyOrderByWhatsapp(newOrder);

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

  const startPixCheckout = async () => {
    if (!validateCheckoutFields()) return;

    const pixKey = getPixKeyLabel();
    if (!pixKey) {
      alert('Cadastre a chave PIX no painel administrativo antes de receber pagamentos por PIX.');
      return;
    }

    const newOrder = buildOrder({
      paymentStatus: 'awaiting_pix',
      status: 'pending',
    });

    await persistOrder(newOrder, 'new_order', buildOrderWhatsappMessage(newOrder, 'PIX - aguardando confirmação'));
    setPixCopied(false);
    setPixOrder(newOrder);
  };

  const handlePixCopy = async () => {
    try {
      await copyText(getPixKeyLabel());
      setPixCopied(true);
    } catch (error) {
      console.error('Erro ao copiar chave PIX:', error);
      alert('Não foi possível copiar automaticamente. Copie a chave manualmente.');
    }
  };

  const confirmPixPayment = async () => {
    if (!pixOrder) return;
    await finalizeSuccessfulOrder(pixOrder, 'PIX aprovado');
  };

  const startCardCheckout = async () => {
    if (!validateCheckoutFields()) return;

    const publicKey = settings.paymentTokens?.mercadoPagoPublicKey?.trim();
    if (!publicKey) {
      alert('Cadastre a chave pública do Mercado Pago no painel administrativo para receber pagamentos no cartão.');
      return;
    }

    const pendingOrder = buildOrder({
      paymentStatus: 'pending',
      status: 'pending',
    });

    setCardPaymentError(null);
    setIsCardBrickReady(false);
    setCardCheckoutOrder(pendingOrder);
    setIsCardPaymentOpen(true);
  };

  const startExperimentalPaymentCheckout = () => {
    if (!validateCheckoutFields()) return;

    setSelectedExperimentalPayment(paymentMethod);
    if (isStripeWalletPaymentMethod(paymentMethod)) {
      const pendingOrder = buildOrder({
        paymentStatus: 'pending',
        status: 'pending',
      });

      try {
        sessionStorage.setItem(tenantStorageKeys.pendingStripeOrder, JSON.stringify({
          order: pendingOrder,
          paymentMethod,
        }));
      } catch (error) {
        console.error('Erro ao preparar checkout Stripe no laboratório:', error);
      }

      const successUrl = `${window.location.origin}?tenant=${currentTenantId}&stripe_status=success&wallet=${encodeURIComponent(paymentMethod)}`;
      const cancelUrl = `${window.location.origin}?tenant=${currentTenantId}&stripe_status=cancelled&wallet=${encodeURIComponent(paymentMethod)}`;

      void (async () => {
        try {
          const response = await fetch(getStripeCheckoutApiUrl(), {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'x-tenant-id': currentTenantId,
            },
            body: JSON.stringify({
              orderId: pendingOrder.id,
              total: pendingOrder.total,
              customerName: pendingOrder.customerName,
              customerEmail: customerEmail.trim(),
              customerPhone: pendingOrder.customerPhone,
              address: pendingOrder.address,
              paymentMethod,
              successUrl,
              cancelUrl,
              items: pendingOrder.items,
            }),
          });

          const result = await response.json();
          if (!response.ok || !result.success || !result.checkoutUrl) {
            throw new Error(
              result?.error?.message ||
              'Não foi possível iniciar o checkout Stripe para o laboratório.',
            );
          }

          window.location.href = result.checkoutUrl as string;
        } catch (error) {
          console.error('Erro ao iniciar Stripe Checkout no laboratório:', error);
          alert(
            error instanceof Error
              ? error.message
              : 'Não foi possível abrir o checkout experimental.',
          );
        }
      })();
      return;
    }

    setIsExperimentalPaymentOpen(true);
  };

  const handleCheckoutSubmit = () => {
    if (paymentMethod === 'PIX') {
      void startPixCheckout();
      return;
    }

    if (isCardPaymentMethod(paymentMethod)) {
      void startCardCheckout();
      return;
    }

    if (isExperimentalPaymentMethod(paymentMethod)) {
      startExperimentalPaymentCheckout();
      return;
    }

    placeOrder();
  };

  /* eslint-disable react-hooks/exhaustive-deps */
  useEffect(() => {
    if (!isCardPaymentOpen || !cardCheckoutOrder) return;

    let isCancelled = false;

    const mountBrick = async () => {
      try {
        setCardPaymentError(null);
        setIsCardSubmitting(false);
        await ensureMercadoPagoSdk();

        if (!window.MercadoPago) {
          throw new Error('SDK do Mercado Pago indisponível.');
        }

        await cardBrickControllerRef.current?.unmount?.();

        const mercadoPago = new window.MercadoPago(
          settings.paymentTokens?.mercadoPagoPublicKey?.trim() || '',
          { locale: 'pt-BR' },
        );

        const bricksBuilder = mercadoPago.bricks();
        const controller = await bricksBuilder.create('cardPayment', 'cardPaymentBrick_container', {
          initialization: {
            amount: Number(cardCheckoutOrder.total.toFixed(2)),
            payer: {
              email: customerEmail.trim(),
            },
          },
          customization: {
            visual: {
              hidePaymentButton: false,
              style: {
                theme: 'default',
              },
            },
            paymentMethods: {
              maxInstallments: paymentMethod === 'Cartão de Débito' ? 1 : 12,
            },
          },
          callbacks: {
            onReady: () => {
              if (!isCancelled) {
                setIsCardBrickReady(true);
              }
            },
            onSubmit: async (formData: Record<string, unknown>) => {
              setIsCardSubmitting(true);
              setCardPaymentError(null);

              const response = await fetch('/api/process-payment', {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  'x-tenant-id': currentTenantId,
                },
                body: JSON.stringify({
                  orderId: cardCheckoutOrder.id,
                  total: cardCheckoutOrder.total,
                  customerName: cardCheckoutOrder.customerName,
                  customerEmail: customerEmail.trim(),
                  customerPhone: cardCheckoutOrder.customerPhone,
                  address: cardCheckoutOrder.address,
                  paymentMethod,
                  items: cardCheckoutOrder.items,
                  cardFormData: formData,
                }),
              });

              const result = await response.json();
              if (!response.ok || !result.success || result.status !== 'approved') {
                throw new Error(
                  result?.error?.message ||
                  result?.statusDetail ||
                  'Pagamento não aprovado. Verifique os dados do cartão e tente novamente.',
                );
              }

              const paidOrder: Order = {
                ...cardCheckoutOrder,
                status: 'preparing',
                paymentStatus: 'approved',
                paymentId: String(result.paymentId || ''),
              };

              await persistOrder(
                paidOrder,
                'new_order',
                buildOrderWhatsappMessage(paidOrder, `${paymentMethod} aprovado`),
              );

              setIsCardPaymentOpen(false);
              setCardCheckoutOrder(null);
              await finalizeSuccessfulOrder(paidOrder, `${paymentMethod} aprovado`);
            },
            onError: (error: unknown) => {
              console.error('Erro no Brick do Mercado Pago:', error);
              if (!isCancelled) {
                setCardPaymentError('Não foi possível abrir o formulário do cartão. Confira a chave pública e tente novamente.');
              }
            },
          },
        });

        if (!isCancelled) {
          cardBrickControllerRef.current = controller;
        } else {
          await controller?.unmount?.();
        }
      } catch (error) {
        console.error('Erro ao iniciar pagamento com cartão:', error);
        if (!isCancelled) {
          setCardPaymentError(
            error instanceof Error
              ? error.message
              : 'Não foi possível carregar o checkout do cartão.',
          );
        }
      } finally {
        if (!isCancelled) {
          setIsCardSubmitting(false);
        }
      }
    };

    void mountBrick();

    return () => {
      isCancelled = true;
      setIsCardBrickReady(false);
      void cardBrickControllerRef.current?.unmount?.();
      cardBrickControllerRef.current = null;
    };
  }, [
    isCardPaymentOpen,
    cardCheckoutOrder,
    customerEmail,
    paymentMethod,
    settings.paymentTokens?.mercadoPagoPublicKey,
  ]);
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const params = new URLSearchParams(window.location.search);
    const stripeStatus = params.get('stripe_status');
    const wallet = params.get('wallet') || 'Carteira Digital';

    if (!stripeStatus) return;

    const clearStripeParams = () => {
      params.delete('stripe_status');
      params.delete('wallet');
      const tenantParam = params.get('tenant');
      const nextQuery = new URLSearchParams();
      if (tenantParam) {
        nextQuery.set('tenant', tenantParam);
      }
      const nextSearch = nextQuery.toString();
      window.history.replaceState({}, '', `${window.location.pathname}${nextSearch ? `?${nextSearch}` : ''}`);
    };

    try {
      const stored = sessionStorage.getItem(tenantStorageKeys.pendingStripeOrder);
      if (!stored) {
        clearStripeParams();
        return;
      }

      const parsed = JSON.parse(stored) as { order?: Order };
      const pendingOrder = parsed.order;

      if (!pendingOrder) {
        sessionStorage.removeItem(tenantStorageKeys.pendingStripeOrder);
        clearStripeParams();
        return;
      }

      if (stripeStatus === 'success') {
        sessionStorage.removeItem(tenantStorageKeys.pendingStripeOrder);
        void (async () => {
          await persistOrder(
            pendingOrder,
            'new_order',
            buildOrderWhatsappMessage(pendingOrder, `${wallet} aprovado`),
          );
          await finalizeSuccessfulOrder(
            {
              ...pendingOrder,
              paymentMethod: wallet,
              paymentStatus: 'approved',
              status: 'preparing',
            },
            `${wallet} aprovado`,
          );
        })();
      }

      if (stripeStatus === 'cancelled') {
        sessionStorage.removeItem(tenantStorageKeys.pendingStripeOrder);
        alert(`${wallet} foi cancelado no laboratório. Nenhum pedido foi enviado ao restaurante.`);
      }
    } catch (error) {
      console.error('Erro ao retomar checkout Stripe do laboratório:', error);
    } finally {
      clearStripeParams();
    }
  }, []);

  useEffect(() => {
    if (!orders.length) return;
    const latestOrder = orders[0];
    const currentSignature = `${latestOrder.id}-${latestOrder.createdAt}`;
    if (!latestOrderSignatureRef.current) {
      latestOrderSignatureRef.current = currentSignature;
      return;
    }
    if (latestOrderSignatureRef.current === currentSignature) return;
    latestOrderSignatureRef.current = currentSignature;
    setIncomingOrderAlert(latestOrder);
    playOrderAlarm();
  }, [orders]);

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
      const backupStr = localStorage.getItem(tenantStorageKeys.backup) ?? localStorage.getItem(legacyStorageKeys.backup);
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
      localStorage.setItem(tenantStorageKeys.categories, JSON.stringify(backup.categories));
      localStorage.setItem(tenantStorageKeys.items, JSON.stringify(backup.items));
      localStorage.setItem(tenantStorageKeys.settings, JSON.stringify(backup.settings));
      if (backup.orders) {
        localStorage.setItem(tenantStorageKeys.orders, JSON.stringify(backup.orders));
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
      localStorage.setItem(tenantStorageKeys.categories, JSON.stringify(importedData.categories));
      localStorage.setItem(tenantStorageKeys.items, JSON.stringify(importedData.items));
      localStorage.setItem(tenantStorageKeys.settings, JSON.stringify(importedData.settings));
      if (importedData.orders) {
        localStorage.setItem(tenantStorageKeys.orders, JSON.stringify(importedData.orders));
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
                {(settings.name || 'Sabor Caseiro').split(' ').filter(Boolean).map(n => n[0] || '').join('').slice(0, 2).toUpperCase()}
              </div>
            )}
            <div className="flex flex-col justify-center min-w-0 flex-1 overflow-hidden pr-1 sm:pr-2">
              <h1 className="text-[11px] sm:text-lg md:text-2xl font-black text-orange-900 leading-tight sm:leading-none tracking-tight mb-0.5 sm:mb-1">{settings.name || 'Sabor Caseiro'}</h1>
              <p className="text-[8px] sm:text-[11px] text-green-700 font-bold tracking-[0.1em] sm:tracking-[0.2em] uppercase">Comida Caseira</p>
              {isLabTenant && (
                <p className="mt-1 text-[8px] sm:text-[10px] text-amber-700 font-black tracking-[0.18em] uppercase">
                  Ambiente de Homologação
                </p>
              )}
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
      <section className="relative min-h-[540px] sm:min-h-[620px] md:min-h-[720px] flex items-center justify-center overflow-hidden bg-[#120c09]">
        <div className="hero-wood-bg absolute inset-0" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(251,146,60,0.22),transparent_38%),radial-gradient(circle_at_bottom,rgba(120,53,15,0.55),transparent_42%)]" />
        <div className="absolute inset-0 backdrop-blur-[2px]" />
        {settings.heroVideo && !heroForegroundImage && (
          <video 
            key={`hero-video-${settings.heroVideo.substring(0, 50)}`}
            autoPlay 
            muted 
            loop 
            playsInline 
            preload="auto"
            className="absolute inset-0 h-full w-full object-cover opacity-25 blur-sm scale-105"
            src={settings.heroVideo}
            onError={(e) => {
              console.error('Error loading hero video:', e);
              const videoElement = e.target as HTMLVideoElement;
              videoElement.style.display = 'none';
            }}
            onLoadedData={() => {
              console.log('Hero video loaded successfully');
            }}
          />
        )}
        <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(10,6,4,0.18),rgba(10,6,4,0.7))]" />
        <div className="relative z-20 flex w-full max-w-6xl flex-col items-center gap-10 px-4 py-16 text-center text-white sm:px-6 md:gap-14 md:px-8">
          <div className="relative flex w-full items-center justify-center">
            <div className="absolute h-40 w-40 rounded-full bg-orange-500/20 blur-3xl sm:h-56 sm:w-56 md:h-72 md:w-72" />
            <div className="absolute h-[68%] w-[72%] max-w-3xl rounded-[3rem] border border-white/8 bg-black/18 backdrop-blur-md shadow-[0_30px_120px_rgba(0,0,0,0.45)]" />
            {heroForegroundImage ? (
              <img
                key={`hero-foreground-${heroForegroundImage.substring(0, 50)}`}
                src={heroForegroundImage}
                className="relative z-10 max-h-[180px] w-auto max-w-[min(94vw,1200px)] object-contain mix-blend-multiply drop-shadow-[0_24px_40px_rgba(0,0,0,0.75)] sm:max-h-[240px] md:max-h-[320px] lg:max-h-[360px]"
                alt={settings.name || 'Logo do restaurante'}
                loading="eager"
                onError={(e) => {
                  console.error('Error loading hero foreground image:', e);
                  const target = e.target as HTMLImageElement;
                  target.style.display = 'none';
                }}
                onLoad={() => {
                  console.log('Hero foreground image loaded successfully');
                }}
              />
            ) : (
              <div className="relative z-10 flex h-44 w-44 items-center justify-center rounded-[2.5rem] border border-orange-200/20 bg-white/10 px-8 text-center shadow-[0_24px_60px_rgba(0,0,0,0.55)] backdrop-blur-lg sm:h-56 sm:w-56 md:h-72 md:w-72">
                <span className="text-3xl font-black tracking-tight text-orange-100 sm:text-4xl md:text-5xl">
                  {(settings.name || 'Sabor Caseiro').split(' ').filter(Boolean).slice(0, 2).join(' ')}
                </span>
              </div>
            )}
          </div>
          <div className="w-full max-w-[min(90vw,900px)]">
          <motion.span 
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-4 inline-block rounded-full border border-orange-200/20 bg-orange-500/80 px-3 py-1 text-[10px] font-black uppercase tracking-[0.2em] text-white shadow-xl shadow-orange-950/30 backdrop-blur-sm sm:mb-6 sm:px-4 sm:py-1.5 sm:text-xs sm:tracking-[0.3em]"
          >
            Bem-vindo!
          </motion.span>
          <motion.h2 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="mb-4 px-2 text-3xl font-black leading-[0.92] tracking-tighter text-white sm:mb-6 sm:text-4xl md:mb-8 md:text-5xl lg:text-6xl"
          >
            O sabor <span className="text-orange-400 underline decoration-orange-400/30 underline-offset-4 sm:underline-offset-8">especial</span> que valoriza a sua marca
          </motion.h2>
          <motion.p 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="mx-auto mb-8 max-w-[42rem] px-2 text-sm font-medium leading-relaxed text-stone-200 sm:mb-10 sm:text-lg md:mb-12 md:text-xl lg:text-[1.35rem]"
          >
            Pedidos pelo site em Adicionar ou pelo WhatsApp clicando no botão abaixo.
          </motion.p>
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.3 }}
            className="flex w-full flex-col items-center justify-center gap-3 px-4 sm:flex-row sm:gap-4"
          >
            <a 
              href="#menu" 
              className="w-full rounded-2xl bg-orange-700 px-8 py-3 text-sm font-black uppercase tracking-widest text-white shadow-2xl shadow-orange-950/40 transition-all hover:-translate-y-1 hover:bg-orange-800 active:scale-95 sm:w-auto sm:rounded-3xl sm:px-12 sm:py-5 sm:text-lg"
            >
              Ver Cardápio
            </a>
            <a 
              href="#contact" 
              className="w-full rounded-2xl border border-white/20 bg-white/10 px-8 py-3 text-sm font-black uppercase tracking-widest text-white backdrop-blur-md transition-all hover:-translate-y-1 hover:bg-white/20 active:scale-95 sm:w-auto sm:rounded-3xl sm:px-12 sm:py-5 sm:text-lg"
            >
              Localização
            </a>
          </motion.div>
          </div>
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
              O Sabor Caseiro nasceu para unir cardápio organizado, sabor marcante e uma apresentação mais profissional para cada cliente.
            </p>
            <div className="grid grid-cols-2 gap-4 sm:gap-6 md:gap-10">
              <div className="p-4 sm:p-6 md:p-8 bg-white/5 rounded-xl sm:rounded-2xl border border-white/10">
                <span className="block text-2xl sm:text-3xl md:text-4xl font-black text-orange-400 mb-1 sm:mb-2">100%</span>
                <span className="text-stone-500 font-bold uppercase tracking-widest text-[10px] sm:text-xs">Foco na Apresentação</span>
              </div>
              <div className="p-4 sm:p-6 md:p-8 bg-white/5 rounded-xl sm:rounded-2xl border border-white/10">
                <span className="block text-2xl sm:text-3xl md:text-4xl font-black text-orange-400 mb-1 sm:mb-2">24h</span>
                <span className="text-stone-500 font-bold uppercase tracking-widest text-[10px] sm:text-xs">Presença Online</span>
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
          <h2 className="text-2xl sm:text-3xl font-black text-stone-900 mb-3 sm:mb-4 tracking-tighter">{settings.name || 'Sabor Caseiro'}</h2>
          <p className="text-stone-500 font-medium max-w-lg mx-auto mb-8 sm:mb-12 leading-relaxed text-sm sm:text-base">Cardápio digital, atendimento mais organizado e uma presença online feita para transmitir mais valor ao seu negócio.</p>
          <div className="flex justify-center gap-6 sm:gap-8 md:gap-10 mb-12 sm:mb-16 flex-wrap">
            <a href="#" className="text-stone-400 hover:text-orange-700 font-black uppercase text-xs tracking-[0.2em] transition-colors">Instagram</a>
            <a href="#" className="text-stone-400 hover:text-orange-700 font-black uppercase text-xs tracking-[0.2em] transition-colors">Facebook</a>
            <a href="#" className="text-stone-400 hover:text-orange-700 font-black uppercase text-xs tracking-[0.2em] transition-colors">Twitter</a>
          </div>
          <div className="pt-12 border-t border-orange-200/50">
            <p className="text-stone-400 text-xs font-bold uppercase tracking-widest">© 2026 {settings.name || 'Sabor Caseiro'}. Feito para vender com mais presença.</p>
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

      {/* New Order Alert Modal */}
      <AnimatePresence>
        {incomingOrderAlert && (
          <div className="fixed inset-0 z-[230] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-stone-900/80 backdrop-blur-sm"
            />
            <motion.div
              initial={{ scale: 0.95, opacity: 0, y: 10 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 10 }}
              className="relative w-full max-w-xl bg-white rounded-3xl shadow-2xl border border-orange-200 p-6 sm:p-8"
            >
              <div className="flex items-center justify-between gap-4 mb-4">
                <h3 className="text-2xl font-black text-orange-800 tracking-tight">Novo pedido recebido</h3>
                <button
                  onClick={() => setIncomingOrderAlert(null)}
                  className="w-9 h-9 rounded-xl bg-stone-100 hover:bg-red-50 text-stone-500 hover:text-red-500 transition-all"
                >
                  <X size={18} className="mx-auto" />
                </button>
              </div>
              <div className="space-y-2 text-sm font-bold text-stone-700">
                <p><span className="text-stone-500">Pedido:</span> #{incomingOrderAlert.id}</p>
                <p><span className="text-stone-500">Cliente:</span> {incomingOrderAlert.customerName}</p>
                <p><span className="text-stone-500">WhatsApp:</span> {incomingOrderAlert.customerPhone}</p>
                <p><span className="text-stone-500">Total:</span> {incomingOrderAlert.total.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</p>
              </div>
              <div className="mt-6 flex gap-3">
                <button
                  onClick={() => {
                    setIncomingOrderAlert(null);
                    if (isDesktop && isAdminAuthenticated) {
                      setIsAdminOpen(true);
                      setAdminTab('orders');
                    }
                  }}
                  className="flex-1 px-4 py-3 rounded-2xl bg-orange-700 hover:bg-orange-800 text-white font-black uppercase tracking-widest text-xs transition-all active:scale-95"
                >
                  Abrir painel de pedidos
                </button>
                <button
                  onClick={playOrderAlarm}
                  className="px-4 py-3 rounded-2xl bg-stone-100 hover:bg-stone-200 text-stone-700 font-black uppercase tracking-widest text-xs transition-all active:scale-95"
                >
                  Tocar alarme
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

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
                          onClick={() => openNewItemModal()}
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
                                                    const updatedItems = latestDataRef.current.items.map(i => 
                                                      i.id === item.id ? {...i, category: cat.id} : i
                                                    );
                                                    
                                                    // Update state immediately
                                                    setItems(updatedItems);
                                                    
                                                    // Auto-save to localStorage
                                                    try {
                                                      localStorage.setItem(tenantStorageKeys.items, JSON.stringify(updatedItems));
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
                                onClick={() => openEditItemModal(item)}
                                className="w-12 h-12 flex items-center justify-center text-stone-400 hover:text-orange-700 hover:bg-orange-50 rounded-2xl transition-all"
                                title="Editar Item"
                              >
                                <Edit size={22} />
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
                                localStorage.setItem(tenantStorageKeys.categories, JSON.stringify(updatedCategories));
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
                          <div key={cat.id} data-category-id={cat.id} className="p-8 bg-white border border-stone-100 rounded-[2.5rem] shadow-sm group hover:border-orange-200 transition-colors">
                            <div className="flex items-start justify-between gap-4">
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
                                    const updatedCategories = latestDataRef.current.categories.map(c => c.id === cat.id ? {...c, name: newName.trim()} : c);
                                    setCategories(updatedCategories);
                                    // Update items that use this category
                                    const updatedItems = latestDataRef.current.items.map(item => 
                                      item.category === cat.id ? {...item, category: cat.id} : item
                                    );
                                    setItems(updatedItems);
                                    // Auto-save to localStorage
                                    try {
                                      localStorage.setItem(tenantStorageKeys.categories, JSON.stringify(updatedCategories));
                                      localStorage.setItem(tenantStorageKeys.items, JSON.stringify(updatedItems));
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
                                  const currentItems = latestDataRef.current.items;
                                  const currentCategories = latestDataRef.current.categories;
                                  const itemsUsingCategory = currentItems.filter(item => item.category === cat.id);
                                  
                                  if (itemsUsingCategory.length > 0) {
                                    const itemCount = itemsUsingCategory.length;
                                    // Find first available category (not the one being deleted)
                                    const firstAvailableCategory = currentCategories.find(c => c.id !== cat.id);
                                    
                                    if (firstAvailableCategory) {
                                      const confirmMessage = `Esta categoria está sendo usada por ${itemCount} item(ns) no cardápio.\n\nDeseja realmente excluir?\n\nOs itens serão movidos para a categoria "${firstAvailableCategory.name}".`;
                                      
                                      if (window.confirm(confirmMessage)) {
                                        // Remove category and update items
                                        const updatedCategories = currentCategories.filter(c => c.id !== cat.id);
                                        setCategories(updatedCategories);
                                        
                                        // Move items to first available category
                                        const updatedItems = currentItems.map(item => 
                                          item.category === cat.id ? {...item, category: firstAvailableCategory.id} : item
                                        );
                                        setItems(updatedItems);
                                        
                                        // Auto-save to localStorage
                                        try {
                                          localStorage.setItem(tenantStorageKeys.categories, JSON.stringify(updatedCategories));
                                          localStorage.setItem(tenantStorageKeys.items, JSON.stringify(updatedItems));
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
                                        const updatedCategories = [defaultCategory, ...currentCategories.filter(c => c.id !== cat.id)];
                                        setCategories(updatedCategories);
                                        
                                        // Move items to default category
                                        const updatedItems = currentItems.map(item => 
                                          item.category === cat.id ? {...item, category: defaultCategory.id} : item
                                        );
                                        setItems(updatedItems);
                                        
                                        // Auto-save to localStorage
                                        try {
                                          localStorage.setItem(tenantStorageKeys.categories, JSON.stringify(updatedCategories));
                                          localStorage.setItem(tenantStorageKeys.items, JSON.stringify(updatedItems));
                                        } catch (e) {
                                          console.error('Error saving categories/items:', e);
                                        }
                                      }
                                    }
                                  } else {
                                    // No items using this category, safe to delete
                                    if (window.confirm(`Deseja realmente excluir a categoria "${cat.name}"?`)) {
                                      const updatedCategories = currentCategories.filter(c => c.id !== cat.id);
                                      setCategories(updatedCategories);
                                      // Auto-save to localStorage
                                      try {
                                        localStorage.setItem(tenantStorageKeys.categories, JSON.stringify(updatedCategories));
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
                            <button
                              onClick={() => openNewItemModal(cat.id)}
                              className="mt-5 w-full rounded-2xl border border-orange-200 bg-orange-50 px-4 py-3 text-[11px] font-black uppercase tracking-[0.2em] text-orange-700 transition-all hover:border-orange-300 hover:bg-orange-100"
                            >
                              {itemsInCategory === 0 ? 'Adicionar primeiro item' : 'Adicionar item nesta categoria'}
                            </button>
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
                              localStorage.setItem(tenantStorageKeys.settings, JSON.stringify(settings));
                              localStorage.setItem(tenantStorageKeys.categories, JSON.stringify(categories));
                              localStorage.setItem(tenantStorageKeys.items, JSON.stringify(items));
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
                                            localStorage.setItem(tenantStorageKeys.settings, JSON.stringify(updatedSettings));
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
                                            localStorage.setItem(tenantStorageKeys.settings, JSON.stringify(updatedSettings));
                                          } catch (e) {
                                            console.error('Error saving hero video:', e);
                                            if (e instanceof DOMException && e.name === 'QuotaExceededError') {
                                              // Try automatic cleanup
                                              try {
                                                // Remove old orders (keep only last 5)
                                                const currentOrders = orders;
                                                if (currentOrders.length > 5) {
                                                  const recentOrders = currentOrders.slice(0, 5);
                                                  localStorage.setItem(tenantStorageKeys.orders, JSON.stringify(recentOrders));
                                                  setOrders(recentOrders);
                                                  console.log('Cleaned old orders to free space');
                                                }
                                                
                                                // Remove large images from items
                                                const cleanedItems = items.map(item => ({
                                                  ...item,
                                                  image: item.image && item.image.length > 500000 ? undefined : item.image
                                                }));
                                                localStorage.setItem(tenantStorageKeys.items, JSON.stringify(cleanedItems));
                                                setItems(cleanedItems);
                                                console.log('Cleaned large images from items');
                                                
                                                // Try saving video again
                                                localStorage.setItem(tenantStorageKeys.settings, JSON.stringify(updatedSettings));
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
                                              localStorage.setItem(tenantStorageKeys.settings, JSON.stringify(newSettings));
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
                                              localStorage.setItem(tenantStorageKeys.settings, JSON.stringify(updatedSettings));
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
                                              localStorage.setItem(tenantStorageKeys.settings, JSON.stringify(updatedSettings));
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
                            {Array.from(new Set(['Dinheiro', 'PIX', 'Cartão de Débito', 'Cartão de Crédito', 'Vale Refeição', ...currentExperimentalPayments])).map(method => (
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
                                  const ourKeys = [tenantStorageKeys.categories, tenantStorageKeys.items, tenantStorageKeys.settings, tenantStorageKeys.orders];
                                  const ourDataStatus: string[] = [];
                                  
                                  ourKeys.forEach(key => {
                                    const value = localStorage.getItem(key);
                                    if (value) {
                                      try {
                                        const parsed = JSON.parse(value);
                                        if (Array.isArray(parsed)) {
                                          ourDataStatus.push(`✅ ${key}: ${parsed.length} item(s)`);
                                        } else if (parsed && typeof parsed === 'object') {
                                          if (key === tenantStorageKeys.settings) {
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
                                    localStorage.setItem(tenantStorageKeys.orders, JSON.stringify(recentOrders));
                                    setOrders(recentOrders);
                                    
                                    // Remove large images from items
                                    const cleanedItems = items.map(item => ({
                                      ...item,
                                      image: item.image && item.image.length > 500000 ? undefined : item.image
                                    }));
                                    localStorage.setItem(tenantStorageKeys.items, JSON.stringify(cleanedItems));
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
                              [tenantStorageKeys.settings, tenantStorageKeys.categories, tenantStorageKeys.items, tenantStorageKeys.orders, tenantStorageKeys.lastSync, tenantStorageKeys.backup]
                                .forEach((key) => localStorage.removeItem(key));
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
                              localStorage.setItem(tenantStorageKeys.settings, JSON.stringify(settings));
                              localStorage.setItem(tenantStorageKeys.categories, JSON.stringify(categories));
                              localStorage.setItem(tenantStorageKeys.items, JSON.stringify(items));
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
              className="relative flex h-full w-full max-w-xl flex-col overflow-hidden border-l border-white/20 bg-white shadow-2xl sm:h-auto sm:max-h-[90vh] sm:rounded-[3rem]"
            >
              <div className="flex flex-shrink-0 items-center justify-between border-b border-stone-100 bg-stone-50/50 px-5 py-5 sm:p-10">
                <div className="flex min-w-0 items-center gap-4 sm:gap-6">
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-orange-700 text-white shadow-xl sm:h-14 sm:w-14 sm:rotate-3">
                    <ShoppingCart size={28} />
                  </div>
                  <h3 className="truncate text-2xl font-black tracking-tighter text-stone-900 sm:text-3xl">Seu Pedido</h3>
                </div>
                <button 
                  onClick={() => setIsCartOpen(false)} 
                  className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-white text-stone-300 shadow-lg transition-all hover:bg-red-50 hover:text-red-500 sm:h-12 sm:w-12"
                >
                  <X size={24} />
                </button>
              </div>

              <div className="min-h-0 flex-1 space-y-6 overflow-y-auto px-5 py-5 custom-scrollbar sm:p-10">
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
                <div className="max-h-[50vh] flex-shrink-0 space-y-6 overflow-y-auto border-t border-stone-100 bg-stone-50 px-5 py-5 sm:max-h-[55vh] sm:space-y-8 sm:p-10">
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
                        <input placeholder="E-mail (obrigatório para cartão)" type="email" value={customerEmail} onChange={e => setCustomerEmail(e.target.value)} className="w-full px-6 py-4 rounded-2xl border border-stone-100 focus:ring-4 focus:ring-orange-700/5 bg-white font-bold" />
                        <input placeholder="WhatsApp" value={customerPhone} onChange={e => setCustomerPhone(e.target.value)} className="w-full px-6 py-4 rounded-2xl border border-stone-100 focus:ring-4 focus:ring-orange-700/5 bg-white font-bold" />
                        <textarea placeholder="Endereço Completo" value={deliveryAddress} onChange={e => setDeliveryAddress(e.target.value)} className="w-full px-6 py-4 rounded-2xl border border-stone-100 focus:ring-4 focus:ring-orange-700/5 bg-white font-bold h-24 resize-none" />
                        <select value={paymentMethod} onChange={e => setPaymentMethod(e.target.value)} className="w-full px-6 py-4 rounded-2xl border border-stone-100 focus:ring-4 focus:ring-orange-700/5 bg-white font-black uppercase text-xs tracking-widest">
                          {checkoutPaymentMethods.map(m => <option key={m} value={m}>{m}</option>)}
                        </select>
                        {isLabTenant && currentExperimentalPayments.length > 0 && (
                          <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-[11px] font-bold leading-relaxed text-amber-800">
                            Ambiente de homologação: os meios marcados como teste servem para validar UX e integrações futuras sem impactar o checkout principal.
                          </div>
                        )}
                      </div>
                      <div className="flex gap-4">
                        <button onClick={() => setIsCheckoutOpen(false)} className="flex-1 bg-stone-200 text-stone-600 font-black py-5 rounded-[1.5rem] uppercase text-[10px] tracking-widest">Voltar</button>
                        <button 
                          onClick={() => {
                            if (!validateCheckoutFields()) {
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
                          <p className="text-stone-700 font-bold"><span className="text-stone-500">E-mail:</span> {customerEmail || 'Não informado'}</p>
                          <p className="text-stone-700 font-bold"><span className="text-stone-500">WhatsApp:</span> {customerPhone}</p>
                          <p className="text-stone-700 font-bold"><span className="text-stone-500">Endereço:</span> {deliveryAddress}</p>
                        </div>
                      </div>
                      <div className="flex gap-4">
                        <button onClick={() => setIsPaymentReviewOpen(false)} className="flex-1 bg-stone-200 text-stone-600 font-black py-5 rounded-[1.5rem] uppercase text-[10px] tracking-widest">Voltar</button>
                        <button 
                          onClick={handleCheckoutSubmit} 
                          className="flex-[2] bg-green-600 hover:bg-green-700 text-white font-black py-5 rounded-[1.5rem] shadow-xl uppercase text-[10px] tracking-widest transition-all"
                        >
                          {paymentMethod === 'PIX'
                            ? 'Gerar Chave PIX'
                            : isCardPaymentMethod(paymentMethod)
                              ? 'Pagar com Cartão'
                              : 'Confirmar e Enviar Pedido'}
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

      {/* PIX Payment Modal */}
      <AnimatePresence>
        {pixOrder && (
          <div className="fixed inset-0 z-[380] flex items-center justify-center p-2 sm:p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setPixOrder(null)}
              className="absolute inset-0 bg-stone-900/90 backdrop-blur-xl"
            />
            <motion.div
              initial={{ scale: 0.96, opacity: 0, y: 24 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.96, opacity: 0, y: 24 }}
              onClick={(e) => e.stopPropagation()}
              className="relative w-full max-w-xl overflow-hidden rounded-[2rem] bg-white shadow-2xl"
            >
              <div className="bg-gradient-to-br from-emerald-50 to-stone-50 px-6 py-8 sm:px-8">
                <p className="text-emerald-600 font-black uppercase tracking-[0.25em] text-[11px] mb-2">Pagamento via PIX</p>
                <h3 className="text-3xl font-black tracking-tighter text-stone-900">Copie a chave e conclua o pagamento</h3>
                <p className="mt-3 text-stone-600 font-bold leading-relaxed">
                  Assim que você confirmar o pagamento, o pedido entra em produção imediatamente e o prazo estimado é de até 50 minutos.
                </p>
              </div>

              <div className="p-6 sm:p-8 space-y-6">
                <div className="rounded-[2rem] border border-emerald-100 bg-emerald-50/70 p-5">
                  <p className="text-stone-500 font-black uppercase tracking-[0.25em] text-[10px] mb-3">Chave PIX</p>
                  <button
                    onClick={() => void handlePixCopy()}
                    className="w-full rounded-[1.5rem] bg-white px-5 py-5 text-left shadow-sm border border-emerald-100 hover:border-emerald-300 transition-all"
                  >
                    <span className="block text-stone-900 font-black break-all text-lg">{getPixKeyLabel()}</span>
                    <span className="mt-2 block text-emerald-700 font-bold text-sm">
                      {pixCopied ? 'Chave copiada. Agora finalize o PIX no seu banco.' : 'Toque para copiar a chave PIX.'}
                    </span>
                  </button>
                </div>

                <div className="rounded-[2rem] bg-stone-50 border border-stone-100 p-5 space-y-2 text-sm">
                  <p className="font-bold text-stone-700"><span className="text-stone-500">Pedido:</span> #{pixOrder.id}</p>
                  <p className="font-bold text-stone-700"><span className="text-stone-500">Cliente:</span> {pixOrder.customerName}</p>
                  <p className="font-bold text-stone-700"><span className="text-stone-500">Total:</span> {pixOrder.total.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</p>
                </div>

                <div className="flex gap-3">
                  <button
                    onClick={() => setPixOrder(null)}
                    className="flex-1 bg-stone-200 hover:bg-stone-300 text-stone-700 font-black py-4 rounded-[1.5rem] uppercase text-[10px] tracking-widest transition-all"
                  >
                    Fechar
                  </button>
                  <button
                    onClick={() => void confirmPixPayment()}
                    className="flex-[1.5] bg-emerald-600 hover:bg-emerald-700 text-white font-black py-4 rounded-[1.5rem] uppercase text-[10px] tracking-widest shadow-xl transition-all"
                  >
                    Já fiz o pagamento
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Card Payment Modal */}
      <AnimatePresence>
        {isCardPaymentOpen && cardCheckoutOrder && (
          <div className="fixed inset-0 z-[390] flex items-center justify-center p-2 sm:p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => {
                setIsCardPaymentOpen(false);
                setCardCheckoutOrder(null);
                setCardPaymentError(null);
              }}
              className="absolute inset-0 bg-stone-900/90 backdrop-blur-xl"
            />
            <motion.div
              initial={{ scale: 0.96, opacity: 0, y: 24 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.96, opacity: 0, y: 24 }}
              onClick={(e) => e.stopPropagation()}
              className="relative flex h-[calc(100vh-1rem)] max-h-[920px] w-full max-w-3xl flex-col overflow-hidden rounded-[2rem] bg-white shadow-2xl sm:h-auto sm:max-h-[90vh]"
            >
              <div className="shrink-0 bg-gradient-to-br from-blue-50 to-stone-50 px-6 py-8 sm:px-8">
                <p className="text-blue-600 font-black uppercase tracking-[0.25em] text-[11px] mb-2">Pagamento no cartão</p>
                <h3 className="text-3xl font-black tracking-tighter text-stone-900">Finalize com Mercado Pago</h3>
                <p className="mt-3 text-stone-600 font-bold leading-relaxed">
                  Assim que o pagamento for aprovado, o restaurante recebe a confirmação e seu pedido entra em produção.
                </p>
              </div>

              <div className="flex-1 overflow-y-auto p-6 space-y-5 sm:p-8">
                <div className="rounded-[2rem] bg-stone-50 border border-stone-100 p-5 space-y-2 text-sm">
                  <p className="font-bold text-stone-700"><span className="text-stone-500">Pedido:</span> #{cardCheckoutOrder.id}</p>
                  <p className="font-bold text-stone-700"><span className="text-stone-500">Cliente:</span> {cardCheckoutOrder.customerName}</p>
                  <p className="font-bold text-stone-700"><span className="text-stone-500">E-mail:</span> {customerEmail}</p>
                  <p className="font-bold text-stone-700"><span className="text-stone-500">Total:</span> {cardCheckoutOrder.total.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</p>
                </div>

                {!isCardBrickReady && !cardPaymentError && (
                  <div className="rounded-[1.5rem] bg-blue-50 border border-blue-100 px-5 py-4 text-blue-700 font-bold text-sm">
                    Carregando o formulário seguro do Mercado Pago...
                  </div>
                )}

                {cardPaymentError && (
                  <div className="rounded-[1.5rem] bg-red-50 border border-red-100 px-5 py-4 text-red-600 font-bold text-sm">
                    {cardPaymentError}
                  </div>
                )}

                <div id="cardPaymentBrick_container" className="min-h-24" />

                {isCardSubmitting && (
                  <div className="rounded-[1.5rem] bg-emerald-50 border border-emerald-100 px-5 py-4 text-emerald-700 font-bold text-sm">
                    Processando pagamento. Aguarde alguns segundos...
                  </div>
                )}

                <div className="sticky bottom-0 -mx-6 border-t border-stone-100 bg-white/95 px-6 pt-4 backdrop-blur sm:-mx-8 sm:px-8">
                  <button
                    onClick={() => {
                      setIsCardPaymentOpen(false);
                      setCardCheckoutOrder(null);
                      setCardPaymentError(null);
                    }}
                    className="w-full bg-stone-200 hover:bg-stone-300 text-stone-700 font-black py-4 rounded-[1.5rem] uppercase text-[10px] tracking-widest transition-all"
                  >
                    Cancelar
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Experimental Payment Modal */}
      <AnimatePresence>
        {isExperimentalPaymentOpen && (
          <div className="fixed inset-0 z-[395] flex items-center justify-center p-2 sm:p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsExperimentalPaymentOpen(false)}
              className="absolute inset-0 bg-stone-900/90 backdrop-blur-xl"
            />
            <motion.div
              initial={{ scale: 0.96, opacity: 0, y: 24 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.96, opacity: 0, y: 24 }}
              onClick={(e) => e.stopPropagation()}
              className="relative w-full max-w-2xl overflow-hidden rounded-[2rem] bg-white shadow-2xl"
            >
              <div className="bg-gradient-to-br from-amber-50 to-stone-50 px-6 py-8 sm:px-8">
                <p className="mb-2 text-[11px] font-black uppercase tracking-[0.25em] text-amber-700">Checkout Experimental</p>
                <h3 className="text-3xl font-black tracking-tighter text-stone-900">{selectedExperimentalPayment}</h3>
                <p className="mt-3 text-stone-600 font-bold leading-relaxed">
                  Este ambiente foi separado para validar experiência, viabilidade técnica e escolha do gateway antes de levar o recurso para o site principal.
                </p>
              </div>

              <div className="space-y-5 p-6 sm:p-8">
                <div className="rounded-[2rem] border border-amber-200 bg-amber-50 p-5 text-sm font-bold leading-relaxed text-amber-900">
                  {isStripeWalletPaymentMethod(selectedExperimentalPayment)
                    ? 'Este fluxo usa Stripe Checkout como laboratório para exibir Apple Pay ou Google Pay em dispositivos compatíveis. A carteira disponível depende do aparelho, navegador e configuração do domínio.'
                    : 'Aqui a gente valida o fluxo visual e operacional. A implementação real pode seguir por carteira digital na web ou por app próprio com suporte nativo.'}
                </div>

                <div className="rounded-[2rem] border border-stone-100 bg-stone-50 p-5">
                  <h4 className="mb-3 text-xs font-black uppercase tracking-[0.25em] text-stone-500">Próximos passos desse laboratório</h4>
                  <div className="space-y-2 text-sm font-bold text-stone-700">
                    <p>1. Confirmar se o gateway escolhido suporta {selectedExperimentalPayment}.</p>
                    <p>2. Validar UX mobile sem afetar o checkout oficial.</p>
                    <p>3. Medir se vale seguir por web wallet ou por app próprio.</p>
                  </div>
                </div>

                <div className="flex gap-3">
                  <button
                    onClick={() => setIsExperimentalPaymentOpen(false)}
                    className="flex-1 bg-stone-200 hover:bg-stone-300 text-stone-700 font-black py-4 rounded-[1.5rem] uppercase text-[10px] tracking-widest transition-all"
                  >
                    Fechar
                  </button>
                  <button
                    onClick={() => {
                      if (isStripeWalletPaymentMethod(selectedExperimentalPayment)) {
                        setIsExperimentalPaymentOpen(false);
                        void startExperimentalPaymentCheckout();
                        return;
                      }
                      setIsExperimentalPaymentOpen(false);
                      window.scrollTo({ top: 0, behavior: 'smooth' });
                    }}
                    className="flex-[1.3] bg-amber-600 hover:bg-amber-700 text-white font-black py-4 rounded-[1.5rem] uppercase text-[10px] tracking-widest transition-all"
                  >
                    {isStripeWalletPaymentMethod(selectedExperimentalPayment) ? 'Abrir Checkout Stripe' : 'Continuar Planejamento'}
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Order Confirmation Modal */}
      <AnimatePresence>
        {orderConfirmation && (
          <div className="fixed inset-0 z-[400] flex items-center justify-center p-2 sm:p-4">
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
              className="relative flex h-[calc(100vh-1rem)] max-h-[920px] w-full max-w-2xl flex-col overflow-hidden rounded-[2rem] border border-white/20 bg-white shadow-2xl sm:h-auto sm:max-h-[90vh] sm:rounded-[3rem]"
            >
              <div className="shrink-0 border-b border-stone-100 bg-gradient-to-br from-green-50 to-orange-50 px-5 py-8 text-center sm:p-12">
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ delay: 0.2, type: "spring" }}
                  className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-green-600 shadow-2xl shadow-green-600/30 sm:h-24 sm:w-24"
                >
                  <CheckCircle size={48} className="text-white" strokeWidth={2.5} />
                </motion.div>
                <h3 className="mb-3 text-3xl font-black tracking-tighter text-stone-900 sm:text-4xl">
                  Pedido Confirmado!
                </h3>
                <p className="text-base font-bold text-stone-600 sm:text-lg">
                  Pedido #{orderConfirmation.id}
                </p>
              </div>

              <div className="flex-1 space-y-6 overflow-y-auto px-5 py-5 sm:space-y-8 sm:p-12">
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
                    {orderConfirmation.customerEmail && (
                      <p className="font-bold text-stone-800"><span className="text-stone-500">E-mail:</span> {orderConfirmation.customerEmail}</p>
                    )}
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

                <div className="sticky bottom-0 -mx-5 border-t border-stone-100 bg-white/95 px-5 pt-4 backdrop-blur sm:static sm:mx-0 sm:border-0 sm:bg-transparent sm:px-0 sm:pt-0">
                <div className="flex gap-3 sm:gap-4">
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
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* New Item Modal */}
      <AnimatePresence>
        {isNewItemModalOpen && (
          <div className="fixed inset-0 z-[500] flex items-center justify-center p-2 sm:p-4">
            <motion.div 
              initial={{ opacity: 0 }} 
              animate={{ opacity: 1 }} 
              exit={{ opacity: 0 }} 
              onClick={() => {
                setEditingItemId(null);
                setIsNewItemModalOpen(false);
              }} 
              className="absolute inset-0 bg-stone-900/95 backdrop-blur-xl" 
            />
            <motion.div 
              initial={{ scale: 0.9, opacity: 0, y: 20 }} 
              animate={{ scale: 1, opacity: 1, y: 0 }} 
              exit={{ scale: 0.9, opacity: 0, y: 20 }} 
              onClick={(e) => e.stopPropagation()}
              className="relative flex h-[calc(100vh-1rem)] max-h-[920px] w-full max-w-2xl flex-col overflow-hidden rounded-[2rem] border border-white/20 bg-white shadow-2xl sm:h-auto sm:max-h-[90vh] sm:rounded-[3rem]"
            >
              <div className="flex shrink-0 items-center justify-between border-b border-stone-100 bg-stone-50/50 px-5 py-5 sm:p-10">
                <div className="flex min-w-0 items-center gap-4 sm:gap-6">
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-orange-700 text-white shadow-2xl sm:h-16 sm:w-16 sm:rounded-3xl sm:rotate-3">
                    <Plus size={32} />
                  </div>
                  <div className="min-w-0">
                    <h3 className="text-2xl font-black tracking-tighter text-stone-900 sm:text-4xl">{editingItemId ? 'Editar Item' : 'Novo Item'}</h3>
                    <p className="text-stone-400 font-bold uppercase text-[10px] tracking-widest mt-1">
                      {editingItemId ? 'Atualize o produto completo' : 'Adicionar ao Cardápio'}
                    </p>
                  </div>
                </div>
                <button 
                  onClick={() => {
                    setEditingItemId(null);
                    setIsNewItemModalOpen(false);
                  }} 
                  className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-white text-stone-400 shadow-xl transition-all hover:bg-red-50 hover:text-red-500 active:scale-90 sm:h-14 sm:w-14"
                >
                  <X size={24} />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto px-5 py-5 sm:p-10">
                <div className="space-y-6 pb-4">
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

                <div className="space-y-4">
                  <label className="text-[10px] font-black text-stone-400 uppercase tracking-[0.3em]">Imagem do Produto</label>
                  <div className="rounded-[2rem] border border-stone-100 bg-stone-50/50 p-5">
                    <div className="flex flex-col gap-4 md:flex-row md:items-center">
                      <div className="flex h-32 w-full items-center justify-center overflow-hidden rounded-[1.5rem] border border-stone-200 bg-white md:w-40">
                        {newItemForm.image ? (
                          <img
                            src={newItemForm.image}
                            alt="Preview do produto"
                            className="h-full w-full object-cover"
                          />
                        ) : (
                          <div className="flex flex-col items-center gap-2 text-stone-300">
                            <ImageIcon size={28} />
                            <span className="text-[10px] font-black uppercase tracking-[0.2em]">Sem imagem</span>
                          </div>
                        )}
                      </div>

                      <div className="flex-1 space-y-3">
                        <button
                          onClick={() => {
                            const input = document.createElement('input');
                            input.type = 'file';
                            input.accept = 'image/*';
                            input.onchange = async (e) => {
                              const file = (e.target as HTMLInputElement).files?.[0];
                              if (!file) return;

                              try {
                                await handleFileUpload(file, (base) => {
                                  setNewItemForm({ ...newItemForm, image: base });
                                });
                              } catch (error) {
                                console.error('Error uploading new item image:', error);
                                alert('Erro ao fazer upload da imagem. Tente novamente.');
                              }
                            };
                            input.click();
                          }}
                          className="w-full rounded-xl border border-orange-200 bg-white py-3 text-[10px] font-black uppercase tracking-widest text-orange-700 transition-all hover:bg-orange-50"
                        >
                          <Upload size={14} className="mr-2 inline-flex" /> {newItemForm.image ? 'Trocar imagem' : 'Enviar imagem'}
                        </button>
                        {newItemForm.image && (
                          <button
                            onClick={() => setNewItemForm({ ...newItemForm, image: '' })}
                            className="w-full rounded-xl py-2 text-[10px] font-black uppercase tracking-widest text-red-500 transition-all hover:bg-red-50"
                          >
                            Remover imagem
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                {editingItemId && (
                  <div className="flex items-center justify-between rounded-[2rem] border border-stone-100 bg-stone-50/50 px-6 py-5">
                    <div>
                      <p className="text-[10px] font-black uppercase tracking-[0.3em] text-stone-400">Disponibilidade</p>
                      <p className="mt-2 text-sm font-bold text-stone-600">Controle se o item aparece como disponível no cardápio.</p>
                    </div>
                    <button
                      onClick={() => {
                        setNewItemForm(prev => ({ ...prev, available: !prev.available }));
                      }}
                      className={`relative h-8 w-14 rounded-full transition-all ${newItemForm.available ? 'bg-green-500 shadow-lg shadow-green-500/20' : 'bg-stone-200'}`}
                    >
                      <div className={`absolute top-1 h-6 w-6 rounded-full bg-white shadow-md transition-all ${newItemForm.available ? 'left-7' : 'left-1'}`} />
                    </button>
                  </div>
                )}

                </div>
              </div>

              <div className="shrink-0 border-t border-stone-100 bg-white/95 px-5 py-4 backdrop-blur sm:px-10 sm:py-6">
                <div className="mb-3 text-[10px] font-bold uppercase tracking-widest text-stone-400 sm:hidden">
                  Role o conteudo acima para ver todos os campos.
                </div>
                <div className="flex gap-3 sm:gap-4">
                  <button 
                    onClick={() => {
                      setEditingItemId(null);
                      setIsNewItemModalOpen(false);
                    }}
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
                      const parsedPrice = parseFloat(newItemForm.price.replace(',', '.')) || 0;
                      if (editingItemId) {
                        setItems(prevItems =>
                          prevItems.map(item =>
                            item.id === editingItemId
                              ? {
                                  ...item,
                                  name: newItemForm.name,
                                  price: parsedPrice,
                                  description: newItemForm.description || 'Item especial da casa...',
                                  category: newItemForm.category,
                                  image: newItemForm.image || undefined,
                                  available: newItemForm.available,
                                }
                              : item
                          )
                        );
                      } else {
                        const newItem: MenuItem = {
                          id: generateId(),
                          name: newItemForm.name,
                          price: parsedPrice,
                          description: newItemForm.description || 'Item especial da casa...',
                          category: newItemForm.category,
                          image: newItemForm.image || undefined,
                          available: newItemForm.available
                        };
                        setItems(prevItems => [...prevItems, newItem]);
                      }
                      setNewItemForm({ name: '', price: '', description: '', category: categories[0]?.id || '', image: '', available: true });
                      setEditingItemId(null);
                      setIsNewItemModalOpen(false);
                    }}
                    className="flex-[2] bg-green-600 hover:bg-green-700 text-white font-black py-5 rounded-[1.5rem] shadow-xl uppercase text-xs tracking-widest transition-all"
                  >
                    {editingItemId ? 'Salvar Alterações' : 'Adicionar Item'}
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
