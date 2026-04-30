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

const dataFilePath = '/tmp/minas-data.json';

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
  await fs.rm(dataFilePath, { force: true });
});

describe('api/data handler', () => {
  it('bloqueia POST sem token quando token esta configurado', async () => {
    process.env.ADMIN_API_TOKEN = 'segredo';
    const req = {
      method: 'POST',
      headers: {},
      body: { categories: [], items: [], settings: {} },
    };
    const res = createMockResponse();

    await handler(req as never, res as never);

    expect(res.statusCode).toBe(401);
  });

  it('salva e retorna dados com sucesso', async () => {
    const saveReq = {
      method: 'POST',
      headers: {},
      body: { categories: [{ id: 'c1' }], items: [{ id: 'i1' }], settings: { name: 'Minas' } },
    };
    const saveRes = createMockResponse();
    await handler(saveReq as never, saveRes as never);
    expect(saveRes.statusCode).toBe(200);

    const getReq = { method: 'GET', headers: {} };
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
});
