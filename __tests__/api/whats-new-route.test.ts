import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const listWhatsNew = vi.fn();
vi.mock('@/lib/questions', () => ({ listWhatsNew: (...a: unknown[]) => listWhatsNew(...a) }));

async function call(query = '') {
  const { GET } = await import('@/app/api/whats-new/route');
  return GET(new NextRequest(`http://localhost/api/whats-new${query}`));
}

describe('GET /api/whats-new', () => {
  beforeEach(() => {
    listWhatsNew.mockReset().mockResolvedValue({ items: [], nextOffset: null });
  });

  it('defaults to offset 0', async () => {
    expect((await call()).status).toBe(200);
    expect(listWhatsNew).toHaveBeenCalledWith(0);
  });

  it('passes the offset through', async () => {
    await call('?offset=12');
    expect(listWhatsNew).toHaveBeenCalledWith(12);
  });

  it.each(['-1', '1.5', 'abc'])('400 for offset=%s', async (offset) => {
    expect((await call(`?offset=${offset}`)).status).toBe(400);
    expect(listWhatsNew).not.toHaveBeenCalled();
  });

  it('500 when the query fails', async () => {
    listWhatsNew.mockRejectedValue(new Error('db down'));
    expect((await call()).status).toBe(500);
  });
});
