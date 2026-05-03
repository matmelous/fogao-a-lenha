import { afterEach, describe, expect, it } from 'vitest';
import { promises as fs } from 'node:fs';
import handler from '../api/data.js';

type MockResponse = {
  statusCode: number;
  headers: Record<string, string>;
  body: unknown;
  setHeader: (key: string, value: string) => void;
  status: (code: number) => MockResponse;
  json: (payload: unknown) => MockResponse;
  end: () => MockResponse;
};

const dataDirectoryPath = '/tmp/minas-data';
const dataFilePath = `${dataDirectoryPath}/fogao-a-lenha.json`;

const createMockResponse = (): MockResponse => {
  const response: MockResponse = {
    statusCode: 200,
    headers: {},
    body: null,
    setHeader(key, value) {
      this.headers[key] = value;
    },
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(payload) {
      this.body = payload;
      return this;
    },
    end() {
      return this;
    },
  };

  return response;
};

afterEach(async () => {
  delete process.env.ADMIN_API_TOKEN;
  await fs.rm(dataDirectoryPath, { force: true, recursive: true });
});

describe('api/data handler', () => {
  it('bloqueia POST sem token quando token esta configurado', async () => {
    process.env.ADMIN_API_TOKEN = 'segredo';
    const req = {
      method: 'POST',
      headers: { 'x-tenant-id': 'fogao-a-lenha' },
      body: { categories: [], items: [], settings: {} },
    };
    const res = createMockResponse();

    await handler(req as never, res as never);

    expect(res.statusCode).toBe(401);
  });

  it('salva e retorna dados com sucesso', async () => {
    const saveReq = {
      method: 'POST',
      headers: { 'x-tenant-id': 'fogao-a-lenha' },
      body: { categories: [{ id: 'c1' }], items: [{ id: 'i1' }], settings: { name: 'Minas' } },
    };
    const saveRes = createMockResponse();
    await handler(saveReq as never, saveRes as never);
    expect(saveRes.statusCode).toBe(200);
    await expect(fs.readFile(dataFilePath, 'utf-8')).resolves.toContain('"name":"Minas"');

    const getReq = { method: 'GET', headers: { 'x-tenant-id': 'fogao-a-lenha' } };
    const getRes = createMockResponse();
    await handler(getReq as never, getRes as never);

    expect(getRes.statusCode).toBe(200);
    expect(getRes.body).toMatchObject({
      success: true,
      data: {
        categories: [{ id: 'c1' }],
        items: [{ id: 'i1' }],
        settings: { name: 'Minas' },
      },
    });
  });

  it('isola dados entre tenants diferentes', async () => {
    const tenantAReq = {
      method: 'POST',
      headers: { 'x-tenant-id': 'tenant-a' },
      body: { categories: [{ id: 'a' }], items: [], settings: { name: 'Tenant A' } },
    };
    const tenantBReq = {
      method: 'POST',
      headers: { 'x-tenant-id': 'tenant-b' },
      body: { categories: [{ id: 'b' }], items: [], settings: { name: 'Tenant B' } },
    };

    await handler(tenantAReq as never, createMockResponse() as never);
    await handler(tenantBReq as never, createMockResponse() as never);

    const getResA = createMockResponse();
    await handler({ method: 'GET', headers: { 'x-tenant-id': 'tenant-a' } } as never, getResA as never);

    const getResB = createMockResponse();
    await handler({ method: 'GET', headers: { 'x-tenant-id': 'tenant-b' } } as never, getResB as never);

    expect(getResA.body).toMatchObject({
      success: true,
      tenantId: 'tenant-a',
      data: { settings: { name: 'Tenant A' } },
    });
    expect(getResB.body).toMatchObject({
      success: true,
      tenantId: 'tenant-b',
      data: { settings: { name: 'Tenant B' } },
    });
  });
});
