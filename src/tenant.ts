import {
  buildTenantStorageKey,
  DEFAULT_TENANT_ID,
  findTenantConfigById,
  getTenantAliasIds,
  resolveTenantId,
} from '../lib/tenancy';

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
export const currentTenantLegacyIds = getTenantAliasIds(currentTenantId);

export const tenantStorageKeys = {
  categories: buildTenantStorageKey(currentTenantId, 'categories'),
  items: buildTenantStorageKey(currentTenantId, 'items'),
  settings: buildTenantStorageKey(currentTenantId, 'settings'),
  orders: buildTenantStorageKey(currentTenantId, 'orders'),
  lastSync: buildTenantStorageKey(currentTenantId, 'lastSync'),
  backup: buildTenantStorageKey(currentTenantId, 'backup'),
  version: buildTenantStorageKey(currentTenantId, 'appVersion'),
  buildTime: buildTenantStorageKey(currentTenantId, 'buildTime'),
  pendingStripeOrder: buildTenantStorageKey(currentTenantId, 'pendingStripeOrder'),
};

export const tenantStorageLegacyKeys = {
  categories: currentTenantLegacyIds.map((tenantId) => buildTenantStorageKey(tenantId, 'categories')),
  items: currentTenantLegacyIds.map((tenantId) => buildTenantStorageKey(tenantId, 'items')),
  settings: currentTenantLegacyIds.map((tenantId) => buildTenantStorageKey(tenantId, 'settings')),
  orders: currentTenantLegacyIds.map((tenantId) => buildTenantStorageKey(tenantId, 'orders')),
  lastSync: currentTenantLegacyIds.map((tenantId) => buildTenantStorageKey(tenantId, 'lastSync')),
  backup: currentTenantLegacyIds.map((tenantId) => buildTenantStorageKey(tenantId, 'backup')),
  version: currentTenantLegacyIds.map((tenantId) => buildTenantStorageKey(tenantId, 'appVersion')),
  buildTime: currentTenantLegacyIds.map((tenantId) => buildTenantStorageKey(tenantId, 'buildTime')),
  pendingStripeOrder: currentTenantLegacyIds.map((tenantId) => buildTenantStorageKey(tenantId, 'pendingStripeOrder')),
};
