import { buildTenantStorageKey, DEFAULT_TENANT_ID, findTenantConfigById, resolveTenantId } from '../lib/tenancy';

const getTenantOverride = () => {
  if (typeof window === 'undefined') return '';
  const params = new URLSearchParams(window.location.search);
  return params.get('tenant') ?? '';
};

export const currentTenantId = resolveTenantId({
  hostname: typeof window !== 'undefined' ? window.location.hostname : DEFAULT_TENANT_ID,
  explicitTenantId: getTenantOverride(),
});

export const currentTenantConfig = findTenantConfigById(currentTenantId);
export const currentTenantMode = currentTenantConfig?.mode ?? 'production';
export const currentExperimentalPayments = currentTenantConfig?.experimentalPayments ?? [];

export const tenantStorageKeys = {
  categories: buildTenantStorageKey(currentTenantId, 'categories'),
  items: buildTenantStorageKey(currentTenantId, 'items'),
  settings: buildTenantStorageKey(currentTenantId, 'settings'),
  orders: buildTenantStorageKey(currentTenantId, 'orders'),
  lastSync: buildTenantStorageKey(currentTenantId, 'lastSync'),
  backup: buildTenantStorageKey(currentTenantId, 'backup'),
  version: buildTenantStorageKey(currentTenantId, 'appVersion'),
  buildTime: buildTenantStorageKey(currentTenantId, 'buildTime'),
};
