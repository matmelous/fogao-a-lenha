import { promises as fs } from 'node:fs';

type PersistedData = {
  categories?: unknown[];
  items?: unknown[];
  settings?: unknown;
  orders?: unknown[];
  lastUpdated?: string;
};

type ApiRequest = {
  method?: string;
  headers: Record<string, string | string[] | undefined>;
  body?: {
    categories?: unknown[];
    items?: unknown[];
    settings?: unknown;
    orders?: unknown[];
  };
};

type ApiResponse = {
  setHeader: (key: string, value: string) => void;
  status: (code: number) => ApiResponse;
  json: (payload: unknown) => ApiResponse;
  end: () => ApiResponse;
};

const DATA_FILE_PATH = '/tmp/minas-data.json';

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

const readDataStore = async (): Promise<PersistedData> => {
  try {
    const raw = await fs.readFile(DATA_FILE_PATH, 'utf-8');
    return JSON.parse(raw) as PersistedData;
  } catch {
    return {};
  }
};

const writeDataStore = async (data: PersistedData) => {
  await fs.writeFile(DATA_FILE_PATH, JSON.stringify(data), 'utf-8');
};

export default async function handler(
  req: ApiRequest,
  res: ApiResponse,
) {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Origin', resolveAllowedOrigin(req.headers.origin));
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, x-admin-token');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method === 'GET') {
    const dataStore = await readDataStore();
    // Return stored data
    return res.status(200).json({
      success: true,
      data: dataStore,
      lastUpdated: dataStore.lastUpdated || null,
    });
  }

  if (req.method === 'POST') {
    try {
      const adminApiToken = process.env.ADMIN_API_TOKEN;
      if (adminApiToken) {
        const requestToken = req.headers['x-admin-token'];
        const token = Array.isArray(requestToken) ? requestToken[0] : requestToken;
        if (token !== adminApiToken) {
          return res.status(401).json({
            success: false,
            error: 'Unauthorized',
          });
        }
      }

      const { categories, items, settings, orders } = req.body ?? {};

      // Validate required data
      if (!categories || !items || !settings) {
        return res.status(400).json({
          success: false,
          error: 'Missing required data: categories, items, or settings',
        });
      }

      const dataStore: PersistedData = {
        categories,
        items,
        settings,
        orders: orders || [],
        lastUpdated: new Date().toISOString(),
      };

      await writeDataStore(dataStore);

      return res.status(200).json({
        success: true,
        message: 'Data saved successfully',
        lastUpdated: dataStore.lastUpdated,
      });
    } catch (error) {
      console.error('Error saving data:', error);
      return res.status(500).json({
        success: false,
        error: 'Failed to save data',
      });
    }
  }

  return res.status(405).json({
    success: false,
    error: 'Method not allowed',
  });
}
