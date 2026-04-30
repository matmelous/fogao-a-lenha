type OrderPayload = {
  id: string;
  customerName: string;
  customerPhone: string;
  address: string;
  total: number;
  paymentMethod: string;
  items: Array<{ quantity: number; item: { name: string; price: number } }>;
};

type ApiRequest = {
  method?: string;
  headers: Record<string, string | string[] | undefined>;
  body?: OrderPayload;
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

const resolveAllowedOrigin = (requestOrigin: string | string[] | undefined) => {
  const allowedOrigins = parseAllowedOrigins(process.env.ALLOWED_ORIGIN);
  if (allowedOrigins.includes('*')) return '*';

  const origin = Array.isArray(requestOrigin) ? requestOrigin[0] : requestOrigin;
  if (origin && allowedOrigins.includes(origin)) {
    return origin;
  }

  return allowedOrigins[0];
};

const buildOrderMessage = (order: OrderPayload) => {
  const itemsList = (order.items || [])
    .map((entry) => `- ${entry.quantity}x ${entry.item.name} (R$ ${(entry.item.price * entry.quantity).toFixed(2)})`)
    .join('\n');

  return [
    `NOVO PEDIDO #${order.id}`,
    '',
    `Cliente: ${order.customerName}`,
    `Telefone: ${order.customerPhone}`,
    `Endereco: ${order.address}`,
    `Pagamento: ${order.paymentMethod}`,
    '',
    'Itens:',
    itemsList || '- (sem itens)',
    '',
    `TOTAL: R$ ${order.total.toFixed(2)}`,
    '',
    'Pedido realizado pelo site.',
  ].join('\n');
};

export default async function handler(req: ApiRequest, res: ApiResponse) {
  res.setHeader('Access-Control-Allow-Origin', resolveAllowedOrigin(req.headers.origin));
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, x-notify-token');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Method not allowed' });
  }

  const notifyToken = process.env.NOTIFY_API_TOKEN;
  if (notifyToken) {
    const requestToken = req.headers['x-notify-token'];
    const token = Array.isArray(requestToken) ? requestToken[0] : requestToken;
    if (token !== notifyToken) {
      return res.status(401).json({ success: false, error: 'Unauthorized' });
    }
  }

  const apiKey = process.env.WA360_API_KEY;
  const targetNumber = process.env.WA360_TO_NUMBER;
  if (!apiKey || !targetNumber) {
    return res.status(500).json({
      success: false,
      error: 'WA360_API_KEY or WA360_TO_NUMBER is not configured',
    });
  }

  const order = req.body as OrderPayload;
  if (!order?.id || !order?.customerName || !order?.items?.length) {
    return res.status(400).json({ success: false, error: 'Invalid order payload' });
  }

  const endpoint = process.env.WA360_API_URL ?? 'https://waba-v2.360dialog.io/messages';
  const body = {
    messaging_product: 'whatsapp',
    recipient_type: 'individual',
    to: targetNumber,
    type: 'text',
    text: {
      body: buildOrderMessage(order),
    },
  };

  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'D360-API-KEY': apiKey,
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errorText = await response.text();
      return res.status(502).json({
        success: false,
        error: `360dialog request failed: ${response.status} ${errorText.slice(0, 200)}`,
      });
    }

    return res.status(200).json({ success: true });
  } catch (error) {
    return res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unexpected notification error',
    });
  }
}
