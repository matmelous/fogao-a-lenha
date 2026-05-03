import { promises as fs } from 'node:fs';
import { buildTenantEnvKey, resolveTenantId } from '../lib/tenancy.js';

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

const getAllowedOriginEnvKey = (tenantId: string) =>
  buildTenantEnvKey('ALLOWED_ORIGIN', tenantId);

const resolveAllowedOrigin = (req: ApiRequest, tenantId: string) => {
  const allowedOrigins = parseAllowedOrigins(
    process.env[getAllowedOriginEnvKey(tenantId)] ?? process.env.ALLOWED_ORIGIN,
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

const writeDataStore = async (tenantId: string, data: PersistedData) => {
  await fs.mkdir(DATA_DIRECTORY_PATH, { recursive: true });
  await fs.writeFile(getDataFilePath(tenantId), JSON.stringify(data), 'utf-8');
};

const getAdminApiToken = (tenantId: string) =>
  (process.env[buildTenantEnvKey('ADMIN_API_TOKEN', tenantId)] ?? process.env.ADMIN_API_TOKEN ?? '').trim();

export default async function handler(
  req: ApiRequest,
  res: ApiResponse,
) {
  const tenantId = getTenantIdFromRequest(req);

  res.setHeader('Access-Control-Allow-Origin', resolveAllowedOrigin(req, tenantId));
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, x-admin-token, x-tenant-id');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method === 'GET') {
    const dataStore = await readDataStore(tenantId);
    return res.status(200).json({
      success: true,
      tenantId,
      data: dataStore,
      lastUpdated: dataStore.lastUpdated || null,
    });
  }

  if (req.method === 'POST') {
    try {
      const adminApiToken = getAdminApiToken(tenantId);
      if (adminApiToken) {
        const token = getHeaderValue(req.headers['x-admin-token'])?.trim();
        if (token !== adminApiToken) {
          return res.status(401).json({
            success: false,
            error: 'Unauthorized',
          });
        }
      }

      const { categories, items, settings, orders } = req.body ?? {};
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

      await writeDataStore(tenantId, dataStore);

      return res.status(200).json({
        success: true,
        tenantId,
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
