import { promises as fs } from 'node:fs';
import { buildTenantEnvKey, resolveTenantId } from '../lib/tenancy.js';

type CartItemPayload = {
  quantity: number;
  item: {
    name: string;
    price: number;
  };
};

type StripeCheckoutRequestBody = {
  orderId: string;
  total: number;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  address: string;
  paymentMethod: string;
  successUrl: string;
  cancelUrl: string;
  items: CartItemPayload[];
};

type PersistedData = {
  settings?: {
    name?: string;
    paymentTokens?: {
      stripeToken?: string;
    };
  };
};

type ApiRequest = {
  method?: string;
  headers: Record<string, string | string[] | undefined>;
  body?: StripeCheckoutRequestBody;
  query?: Record<string, string | string[] | undefined>;
};

type ApiResponse = {
  setHeader: (key: string, value: string) => void;
  status: (code: number) => ApiResponse;
  json: (payload: unknown) => ApiResponse;
  end: () => ApiResponse;
};

const DATA_DIRECTORY_PATH = '/tmp/minas-data';

const parseAllowedOrigins = (rawValue: string | undefined) => {
  if (!rawValue) return ['*'];

  const normalized = rawValue
    .split(',')
    .map((value) => value.trim().replace(/^['"]|['"]$/g, ''))
    .filter(Boolean)
    .filter((value) => !/[\r\n]/.test(value));

  const validOrigins = normalized.filter((value) => {
    if (value === '*') return true;
    try {
      return new URL(value).origin === value;
    } catch {
      return false;
    }
  });

  return validOrigins.length > 0 ? validOrigins : ['*'];
};

const getHeaderValue = (value: string | string[] | undefined) =>
  Array.isArray(value) ? value[0] : value;

const getTenantIdFromRequest = (req: ApiRequest) => {
  const explicitTenantId =
    getHeaderValue(req.headers['x-tenant-id']) ??
    getHeaderValue(req.query?.tenant);
  const requestHost =
    getHeaderValue(req.headers['x-forwarded-host']) ??
    getHeaderValue(req.headers.host) ??
    getHeaderValue(req.headers.origin);

  return resolveTenantId({
    hostname: requestHost,
    explicitTenantId,
  });
};

const resolveAllowedOrigin = (req: ApiRequest, tenantId: string) => {
  const allowedOrigins = parseAllowedOrigins(
    process.env[buildTenantEnvKey('ALLOWED_ORIGIN', tenantId)] ?? process.env.ALLOWED_ORIGIN,
  );
  if (allowedOrigins.includes('*')) return '*';

  const origin = getHeaderValue(req.headers.origin);
  if (origin && allowedOrigins.includes(origin)) {
    return origin;
  }

  return allowedOrigins[0];
};

const getDataFilePath = (tenantId: string) => `${DATA_DIRECTORY_PATH}/${tenantId}.json`;

const readDataStore = async (tenantId: string): Promise<PersistedData> => {
  try {
    const raw = await fs.readFile(getDataFilePath(tenantId), 'utf-8');
    return JSON.parse(raw) as PersistedData;
  } catch {
    return {};
  }
};

const getTenantEnvValue = (key: string, tenantId: string) =>
  (process.env[buildTenantEnvKey(key, tenantId)] ?? process.env[key] ?? '').trim();

const getStripeSecretKey = async (tenantId: string) => {
  const envKey = getTenantEnvValue('STRIPE_SECRET_KEY', tenantId);
  if (envKey) return envKey;

  const dataStore = await readDataStore(tenantId);
  return dataStore.settings?.paymentTokens?.stripeToken?.trim() || '';
};

const createLineItems = (items: CartItemPayload[]) => {
  const params = new URLSearchParams();

  items.forEach((entry, index) => {
    params.append(`line_items[${index}][price_data][currency]`, 'brl');
    params.append(`line_items[${index}][price_data][product_data][name]`, entry.item.name);
    params.append(`line_items[${index}][price_data][unit_amount]`, String(Math.round(entry.item.price * 100)));
    params.append(`line_items[${index}][quantity]`, String(entry.quantity));
  });

  return params;
};

export default async function handler(req: ApiRequest, res: ApiResponse) {
  const tenantId = getTenantIdFromRequest(req);

  res.setHeader('Access-Control-Allow-Origin', resolveAllowedOrigin(req, tenantId));
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, x-tenant-id');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Method not allowed' });
  }

  const secretKey = await getStripeSecretKey(tenantId);
  if (!secretKey) {
    return res.status(500).json({
      success: false,
      error: 'Stripe secret key not configured',
    });
  }

  const body = req.body;
  if (!body?.orderId || !body.customerEmail || !body.items?.length || !body.successUrl || !body.cancelUrl) {
    return res.status(400).json({
      success: false,
      error: 'Missing required checkout data',
    });
  }

  const params = createLineItems(body.items);
  params.append('mode', 'payment');
  params.append('success_url', body.successUrl);
  params.append('cancel_url', body.cancelUrl);
  params.append('customer_email', body.customerEmail);
  params.append('billing_address_collection', 'required');
  params.append('phone_number_collection[enabled]', 'true');
  params.append('metadata[tenant_id]', tenantId);
  params.append('metadata[order_id]', body.orderId);
  params.append('metadata[payment_method_label]', body.paymentMethod);
  params.append('metadata[customer_name]', body.customerName);
  params.append('metadata[customer_phone]', body.customerPhone);
  params.append('metadata[address]', body.address);

  try {
    const response = await fetch('https://api.stripe.com/v1/checkout/sessions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${secretKey}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: params.toString(),
    });

    const result = await response.json();
    if (!response.ok) {
      return res.status(502).json({
        success: false,
        error: result,
      });
    }

    return res.status(200).json({
      success: true,
      checkoutUrl: result.url,
      sessionId: result.id,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unexpected Stripe checkout error',
    });
  }
}
