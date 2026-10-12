import { NextRequest, NextResponse } from 'next/server';
import { badRequest, serverError } from '@/lib/api';
import { listWhatsNew } from '@/lib/questions';

/** Next page of /whats-new for the infinite scroll. Public list-level fields only. */
export async function GET(req: NextRequest) {
  const raw = req.nextUrl.searchParams.get('offset') ?? '0';
  const offset = Number(raw);
  if (!Number.isInteger(offset) || offset < 0) {
    return badRequest('offset must be a non-negative integer');
  }

  try {
    return NextResponse.json(await listWhatsNew(offset));
  } catch {
    return serverError();
  }
}
