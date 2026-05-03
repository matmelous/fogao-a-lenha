import type { Category, MenuItem, RestaurantSettings } from './types';

export const initialCategories: Category[] = [
  { id: '1', name: 'Pratos Principais' },
  { id: '2', name: 'Bebidas' },
  { id: '3', name: 'Sobremesas' },
  { id: '4', name: 'Porções' },
];

export const initialMenuItems: MenuItem[] = [
  {
    id: '1',
    name: 'Feijoada Mineira',
    description: 'Feijoada completa com arroz, couve, farofa e laranja.',
    price: 45.9,
    category: '1',
    available: true,
  },
  {
    id: '2',
    name: 'Tutu à Mineira',
    description: 'Tutu de feijão, arroz, lombo, couve e ovo frito.',
    price: 39.9,
    category: '1',
    available: true,
  },
  {
    id: '3',
    name: 'Frango com Quiabo',
    description: 'Frango caipira, arroz, quiabo refogado e angu.',
    price: 42.0,
    category: '1',
    available: true,
  },
  {
    id: '4',
    name: 'Pão de Queijo Recheado',
    description: 'Porção com 6 unidades recheadas com requeijão ou linguiça.',
    price: 22.0,
    category: '4',
    available: true,
  },
];

export const initialSettings: RestaurantSettings = {
  name: 'Sabor Caseiro',
  logo: '',
  heroVideo: '',
  phone: '(42) 99162-8586',
  whatsapp: '(42) 99162-8586',
  address: 'Avenida Atlanta, 830 - Jd. Atlanta - Carambeí - PR',
  openingHours: {
    'Segunda-Sexta': '11:00 às 22:00',
    'Sábado': '11:00 às 22:00',
    'Domingo': '11:00 às 18:00',
  },
  deliveryFee: 10.0,
  minOrder: 30.0,
  paymentMethods: ['Dinheiro', 'PIX', 'Cartão de Débito', 'Cartão de Crédito'],
  bankInfo: {
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
  paymentTokens: {
    mercadoPagoToken: '',
    mercadoPagoPublicKey: '',
    pagSeguroToken: '',
    pagSeguroEmail: '',
    stripeToken: '',
    stripePublicKey: '',
    otherTokens: [],
  },
};
