import { buildTenantEnvKey, resolveTenantId } from '../lib/tenancy.js';

type OrderPayload = {
  id: string;
  customerName: string;
  customerEmail?: string;
  customerPhone: string;
  address: string;
  total: number;
  paymentMethod: string;
  paymentStatus?: string;
  notificationType?: 'new_order' | 'payment_confirmed';
  items: Array<{ quantity: number; item: { name: string; price: number } }>;
};

type ApiRequest = {
  method?: string;
  headers: Record<string, string | string[] | undefined>;
  body?: OrderPayload;
  query?: Record<string, string | string[] | undefined>;
};

type ApiResponse = {
  setHeader: (key: string, value: string) => void;
  status: (code: number) => ApiResponse;
  json: (payload: unknown) => ApiResponse;
  end: () => ApiResponse;
};

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

const buildOrderMessage = (order: OrderPayload) => {
  const itemsList = (order.items || [])
    .map((entry) => `- ${entry.quantity}x ${entry.item.name} (R$ ${(entry.item.price * entry.quantity).toFixed(2)})`)
    .join('\n');

  const title = order.notificationType === 'payment_confirmed'
    ? `PAGAMENTO CONFIRMADO #${order.id}`
    : `NOVO PEDIDO #${order.id}`;

  return [
    title,
    '',
    `Cliente: ${order.customerName}`,
    order.customerEmail ? `Email: ${order.customerEmail}` : null,
    `Telefone: ${order.customerPhone}`,
    `Endereco: ${order.address}`,
    `Pagamento: ${order.paymentMethod}`,
    order.paymentStatus ? `Status do Pagamento: ${order.paymentStatus}` : null,
    '',
    'Itens:',
    itemsList || '- (sem itens)',
    '',
    `TOTAL: R$ ${order.total.toFixed(2)}`,
    '',
    order.notificationType === 'payment_confirmed'
      ? 'Pagamento confirmado pelo cliente. Iniciar producao.'
      : 'Pedido realizado pelo site.',
  ]
    .filter(Boolean)
    .join('\n');
};

const getTenantEnvValue = (key: string, tenantId: string) =>
  (process.env[buildTenantEnvKey(key, tenantId)] ?? process.env[key] ?? '').trim();

const parseTargetNumbers = (rawValue: string) =>
  rawValue
    .split(',')
    .map((value) => value.replace(/\D/g, '').trim())
    .filter(Boolean);

export default async function handler(req: ApiRequest, res: ApiResponse) {
  const tenantId = getTenantIdFromRequest(req);

  res.setHeader('Access-Control-Allow-Origin', resolveAllowedOrigin(req, tenantId));
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, x-notify-token, x-tenant-id');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Method not allowed' });
  }

  const notifyToken = getTenantEnvValue('NOTIFY_API_TOKEN', tenantId);
  if (notifyToken) {
    const token = getHeaderValue(req.headers['x-notify-token'])?.trim();
    if (token !== notifyToken) {
      return res.status(401).json({ success: false, error: 'Unauthorized' });
    }
  }

  const apiKey = getTenantEnvValue('WA360_API_KEY', tenantId);
  const targetNumbers = parseTargetNumbers(
    getTenantEnvValue('WA360_TO_NUMBERS', tenantId) || getTenantEnvValue('WA360_TO_NUMBER', tenantId),
  );
  if (!apiKey || targetNumbers.length === 0) {
    return res.status(500).json({
      success: false,
      error: 'WA360_API_KEY and WA360_TO_NUMBER or WA360_TO_NUMBERS must be configured',
    });
  }

  const order = req.body as OrderPayload;
  if (!order?.id || !order?.customerName || !order?.items?.length) {
    return res.status(400).json({ success: false, error: 'Invalid order payload' });
  }

  const endpoint = getTenantEnvValue('WA360_API_URL', tenantId) || 'https://waba-v2.360dialog.io/messages';
  const messageBody = buildOrderMessage(order);

  try {
    const failures: string[] = [];

    for (const targetNumber of targetNumbers) {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'D360-API-KEY': apiKey,
        },
        body: JSON.stringify({
          messaging_product: 'whatsapp',
          recipient_type: 'individual',
          to: targetNumber,
          type: 'text',
          text: {
            body: messageBody,
          },
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        failures.push(`${targetNumber}: ${response.status} ${errorText.slice(0, 160)}`);
      }
    }

    if (failures.length > 0) {
      return res.status(502).json({
        success: false,
        error: `360dialog request failed for ${failures.length} recipient(s): ${failures.join(' | ')}`,
      });
    }

    return res.status(200).json({ success: true, tenantId, recipients: targetNumbers.length });
  } catch (error) {
    return res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unexpected notification error',
    });
  }
}
