export interface MenuItem {
  id: string;
  name: string;
  description: string;
  price: number;
  category: string;
  image?: string;
  available: boolean;
}

export interface Category {
  id: string;
  name: string;
}

export interface BankInfo {
  bankName?: string;
  bankCode?: string;
  agency?: string;
  account?: string;
  accountType?: 'checking' | 'savings';
  accountHolderName?: string;
  cpfCnpj?: string;
  pixKey?: string;
  pixKeyType?: 'cpf' | 'cnpj' | 'email' | 'phone' | 'random';
}

export interface PaymentTokens {
  mercadoPagoToken?: string;
  mercadoPagoPublicKey?: string;
  pagSeguroToken?: string;
  pagSeguroEmail?: string;
  stripeToken?: string;
  stripePublicKey?: string;
  otherTokens?: { name: string; token: string }[];
}

export interface RestaurantSettings {
  name: string;
  logo?: string;
  logoSize?: 'small' | 'medium' | 'large' | 'custom';
  logoSizePx?: number; // Custom size in pixels
  heroVideo?: string;
  heroImage?: string;
  aboutImage1?: string;
  aboutImage1Size?: 'small' | 'medium' | 'large' | 'custom';
  aboutImage1SizePx?: number;
  aboutImage2?: string;
  aboutImage2Size?: 'small' | 'medium' | 'large' | 'custom';
  aboutImage2SizePx?: number;
  phone: string;
  whatsapp: string;
  address: string;
  openingHours: {
    [key: string]: string;
  };
  deliveryFee: number;
  minOrder: number;
  paymentMethods: string[];
  bankInfo?: BankInfo;
  paymentTokens?: PaymentTokens;
}

export interface Order {
  id: string;
  customerName: string;
  customerEmail?: string;
  customerPhone: string;
  address: string;
  items: { item: MenuItem; quantity: number }[];
  total: number;
  status: 'pending' | 'preparing' | 'delivered' | 'cancelled';
  createdAt: string;
  paymentMethod: string;
  paymentStatus?: 'pending' | 'awaiting_pix' | 'approved' | 'failed';
  paymentId?: string;
}
