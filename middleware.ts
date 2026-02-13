import { NextRequest, NextResponse } from 'next/server';
import { generateRequestId } from '@/lib/logger';

const REQUEST_ID_HEADER = 'x-request-id';

export function middleware(request: NextRequest) {
  const requestHeaders = new Headers(request.headers);
  if (!requestHeaders.get(REQUEST_ID_HEADER)) {
    requestHeaders.set(REQUEST_ID_HEADER, generateRequestId());
  }
  return NextResponse.next({
    request: {
      headers: requestHeaders,
    },
  });
}

export const config = {
  matcher: ['/api/:path*'],
};
