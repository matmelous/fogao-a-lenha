export type TenantConfig = {
  id: string;
  name: string;
  domains: string[];
  aliases?: string[];
  mode?: 'production' | 'lab';
  experimentalPayments?: string[];
};

const normalizeHost = (value: string) =>
  value
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, '')
    .replace(/\/.*$/, '')
    .replace(/:\d+$/, '');

export const tenantConfigs: TenantConfig[] = [
  {
    id: 'sabor-caseiro',
    name: 'Granatto',
    domains: ['localhost', '127.0.0.1', 'saborcaseiro.vercel.app'],
    aliases: ['fogao-a-lenha'],
    mode: 'production',
  },
  {
    id: 'saborcaseiro-lab',
    name: 'Granatto Lab',
    domains: ['saborcaseiro-lab.vercel.app', 'teste-saborcaseiro.vercel.app'],
    mode: 'lab',
    experimentalPayments: ['Apple Pay (Teste)', 'Google Pay (Teste)', 'Aproximação no Celular (Teste)'],
  },
  {
    id: 'cliente-centro',
    name: 'Cliente Centro',
    domains: ['clientecentro.com.br', 'www.clientecentro.com.br'],
  },
  {
    id: 'pizzaria-modelo',
    name: 'Pizzaria Modelo',
    domains: ['pizzariamodelo.com.br', 'www.pizzariamodelo.com.br'],
  },
  {
    id: 'burger-do-bairro',
    name: 'Burger do Bairro',
    domains: ['burgerdobairro.com.br', 'www.burgerdobairro.com.br'],
  },
];

export const DEFAULT_TENANT_ID = tenantConfigs[0]?.id ?? 'default';

export const sanitizeTenantId = (value: string | null | undefined) =>
  (value ?? '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');

export const findTenantConfigById = (tenantId: string) => {
  const normalizedTenantId = sanitizeTenantId(tenantId);
  return tenantConfigs.find((tenant) =>
    tenant.id === normalizedTenantId ||
    tenant.aliases?.some((alias) => sanitizeTenantId(alias) === normalizedTenantId),
  );
};

export const findTenantConfigByHost = (hostname: string) => {
  const normalizedHost = normalizeHost(hostname);
  return tenantConfigs.find((tenant) =>
    tenant.domains.some((domain) => normalizeHost(domain) === normalizedHost),
  );
};

export const resolveTenantId = (options: {
  hostname?: string | null;
  explicitTenantId?: string | null;
}) => {
  const explicitTenantId = sanitizeTenantId(options.explicitTenantId);
  if (explicitTenantId) {
    const explicitTenant = findTenantConfigById(explicitTenantId);
    return explicitTenant?.id ?? explicitTenantId;
  }

  if (options.hostname) {
    const tenant = findTenantConfigByHost(options.hostname);
    if (tenant) {
      return tenant.id;
    }
  }

  return DEFAULT_TENANT_ID;
};

export const getTenantAliasIds = (tenantId: string) => {
  const tenant = findTenantConfigById(tenantId);
  if (!tenant?.aliases?.length) return [];
  return tenant.aliases.map((alias) => sanitizeTenantId(alias)).filter(Boolean);
};

export const buildTenantStorageKey = (tenantId: string, suffix: string) =>
  `minas_${sanitizeTenantId(tenantId) || DEFAULT_TENANT_ID}_${suffix}`;

export const buildTenantEnvKey = (baseKey: string, tenantId: string) =>
  `${baseKey}__${sanitizeTenantId(tenantId).replace(/-/g, '_').toUpperCase()}`;
