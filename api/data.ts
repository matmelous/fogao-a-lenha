import { promises as fs } from 'node:fs';
import { get, put } from '@vercel/blob';
import type { BlobAccessType } from '@vercel/blob';
import { buildTenantEnvKey, getTenantAliasIds, resolveTenantId } from '../lib/tenancy.js';

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
const BLOB_DATA_PREFIX = 'tenant-data';
const PRIVATE_BLOB_ACCESS_MODE: BlobAccessType = 'private';
const PUBLIC_BLOB_ACCESS_MODE: BlobAccessType = 'public';

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
const getBlobPath = (tenantId: string) => `${BLOB_DATA_PREFIX}/${tenantId}.json`;
const hasBlobStorage = () => Boolean(process.env.BLOB_READ_WRITE_TOKEN?.trim());
const isVercelRuntime = () => process.env.VERCEL === '1' || Boolean(process.env.VERCEL_URL);
const getPreferredBlobAccessMode = (): BlobAccessType =>
  (process.env.BLOB_ACCESS_MODE?.trim().toLowerCase() === PRIVATE_BLOB_ACCESS_MODE
    ? PRIVATE_BLOB_ACCESS_MODE
    : PUBLIC_BLOB_ACCESS_MODE);

const getStorageStatus = () => ({
  backend: hasBlobStorage() ? 'vercel-blob' : 'filesystem',
  persistent: hasBlobStorage(),
  configured: hasBlobStorage(),
  accessMode: hasBlobStorage() ? getPreferredBlobAccessMode() : 'filesystem',
});

const readFilesystemDataStore = async (tenantId: string): Promise<PersistedData> => {
  const candidateTenantIds = [tenantId, ...getTenantAliasIds(tenantId)];

  for (const candidateTenantId of candidateTenantIds) {
    try {
      const raw = await fs.readFile(getDataFilePath(candidateTenantId), 'utf-8');
      return JSON.parse(raw) as PersistedData;
    } catch {
      // Try next candidate.
    }
  }

  return {};
};

const writeFilesystemDataStore = async (tenantId: string, data: PersistedData) => {
  await fs.mkdir(DATA_DIRECTORY_PATH, { recursive: true });
  await fs.writeFile(getDataFilePath(tenantId), JSON.stringify(data), 'utf-8');
};

const blobAccessModes: BlobAccessType[] = [getPreferredBlobAccessMode(), PRIVATE_BLOB_ACCESS_MODE, PUBLIC_BLOB_ACCESS_MODE]
  .filter((mode, index, list) => list.indexOf(mode) === index);

const readBlobDataStore = async (tenantId: string): Promise<PersistedData> => {
  const candidateTenantIds = [tenantId, ...getTenantAliasIds(tenantId)];

  for (const candidateTenantId of candidateTenantIds) {
    for (const accessMode of blobAccessModes) {
      const result = await get(getBlobPath(candidateTenantId), { access: accessMode });
      if (!result || result.statusCode !== 200 || !result.stream) continue;

      const raw = await new Response(result.stream).text();
      return JSON.parse(raw) as PersistedData;
    }
  }

  return {};
};

const readDataStore = async (tenantId: string): Promise<PersistedData> => {
  if (hasBlobStorage()) {
    const blobData = await readBlobDataStore(tenantId);
    if (Object.keys(blobData).length > 0) {
      return blobData;
    }
  }

  return readFilesystemDataStore(tenantId);
};

const writeDataStore = async (tenantId: string, data: PersistedData) => {
  if (hasBlobStorage()) {
    let lastError: unknown = null;

    for (const accessMode of blobAccessModes) {
      try {
        await put(getBlobPath(tenantId), JSON.stringify(data), {
          access: accessMode,
          addRandomSuffix: false,
          allowOverwrite: true,
          contentType: 'application/json',
        });
        return;
      } catch (error) {
        lastError = error;
      }
    }

    throw lastError instanceof Error ? lastError : new Error('Failed to write blob data');
  }

  await writeFilesystemDataStore(tenantId, data);
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
      storage: getStorageStatus(),
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

      if (!hasBlobStorage() && isVercelRuntime()) {
        return res.status(503).json({
          success: false,
          error: 'Persistent storage is not configured. Connect Vercel Blob and set BLOB_READ_WRITE_TOKEN.',
          storage: getStorageStatus(),
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
        storage: getStorageStatus(),
      });
    } catch (error) {
      console.error('Error saving data:', error);
      return res.status(500).json({
        success: false,
        error: 'Failed to save data',
        details: error instanceof Error ? error.message : String(error),
        storage: getStorageStatus(),
      });
    }
  }

  return res.status(405).json({
    success: false,
    error: 'Method not allowed',
  });
}
