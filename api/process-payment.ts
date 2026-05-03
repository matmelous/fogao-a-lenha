import { promises as fs } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { buildTenantEnvKey, resolveTenantId } from '../lib/tenancy.js';

type CartItemPayload = {
  quantity: number;
  item: {
    name: string;
    price: number;
  };
};

type PaymentRequestBody = {
  orderId: string;
  total: number;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  address: string;
  paymentMethod: string;
  cardFormData: {
    token?: string;
    issuer_id?: string;
    payment_method_id?: string;
    transaction_amount?: number;
    installments?: number | string;
    payer?: {
      email?: string;
      identification?: {
        type?: string;
        number?: string;
      };
    };
  };
  items: CartItemPayload[];
};

type PersistedData = {
  settings?: {
    name?: string;
    paymentTokens?: {
      mercadoPagoToken?: string;
    };
  };
};

type ApiRequest = {
  method?: string;
  headers: Record<string, string | string[] | undefined>;
  body?: PaymentRequestBody;
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

const getMercadoPagoAccessToken = async (tenantId: string) => {
  const envToken = getTenantEnvValue('MERCADO_PAGO_ACCESS_TOKEN', tenantId);
  if (envToken) return envToken;

  const dataStore = await readDataStore(tenantId);
  return dataStore.settings?.paymentTokens?.mercadoPagoToken?.trim() || '';
};

const splitCustomerName = (fullName: string) => {
  const trimmed = fullName.trim();
  if (!trimmed) return { firstName: 'Cliente', lastName: 'Site' };

  const parts = trimmed.split(/\s+/);
  return {
    firstName: parts[0],
    lastName: parts.slice(1).join(' ') || 'Site',
  };
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

  const accessToken = await getMercadoPagoAccessToken(tenantId);
  if (!accessToken) {
    return res.status(500).json({
      success: false,
      error: 'Mercado Pago access token not configured',
    });
  }

  const body = req.body;
  if (!body?.orderId || !body.total || !body.customerEmail || !body.cardFormData?.token) {
    return res.status(400).json({
      success: false,
      error: 'Missing required payment data',
    });
  }

  const tenantData = await readDataStore(tenantId);
  const restaurantName = tenantData.settings?.name?.trim() || tenantId;
  const { firstName, lastName } = splitCustomerName(body.customerName);

  const paymentPayload = {
    transaction_amount: Number(body.total.toFixed(2)),
    token: body.cardFormData.token,
    description: `Pedido ${restaurantName} #${body.orderId}`,
    installments: Number(body.cardFormData.installments || 1),
    payment_method_id: body.cardFormData.payment_method_id,
    issuer_id: body.cardFormData.issuer_id || undefined,
    payer: {
      email: body.customerEmail,
      first_name: firstName,
      last_name: lastName,
      identification: body.cardFormData.payer?.identification,
    },
    additional_info: {
      items: (body.items || []).map((entry) => ({
        title: entry.item.name,
        quantity: entry.quantity,
        unit_price: Number(entry.item.price),
      })),
    },
  };

  try {
    const response = await fetch('https://api.mercadopago.com/v1/payments', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
        'X-Idempotency-Key': randomUUID(),
      },
      body: JSON.stringify(paymentPayload),
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
      paymentId: result.id,
      status: result.status,
      statusDetail: result.status_detail,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unexpected payment error',
    });
  }
}
