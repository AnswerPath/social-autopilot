import { NextRequest, NextResponse } from 'next/server';

const REQUEST_ID_HEADER = 'x-request-id';

function generateRequestId(): string {
  return `req_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 9)}`;
}

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
