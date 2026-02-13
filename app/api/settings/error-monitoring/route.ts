import { NextRequest, NextResponse } from 'next/server';
import { ErrorMonitor, ApiErrorHandler, ErrorType } from '@/lib/error-handling';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const action = searchParams.get('action');

    switch (action) {
      case 'stats':
        const monitor = ErrorMonitor.getInstance();
        const stats = monitor.getErrorStats();
        return NextResponse.json({
          success: true,
          stats,
        });

      case 'reset':
        const monitorInstance = ErrorMonitor.getInstance();
        monitorInstance.resetCounts();
        return NextResponse.json({
          success: true,
          message: 'Error counts reset successfully',
        });

      case 'health':
        const healthMonitor = ErrorMonitor.getInstance();
        const healthStats = healthMonitor.getErrorStats();
        return NextResponse.json({
          success: true,
          stats: healthStats,
          circuitBreaker: {
            note: 'Circuit breaker state is per X API / Apify client instance; not aggregated in this API.',
          },
        });

      default:
        return NextResponse.json(
          { error: 'Invalid action' },
          { status: 400 }
        );
    }
  } catch (error) {
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { errorType, message, service, endpoint, userId } = body;

    // Create a test error for monitoring
    const error = ApiErrorHandler.createError(
      errorType as ErrorType || ErrorType.UNKNOWN,
      message || 'Test error',
      service || 'x-api',
      { endpoint, userId }
    );

    // Record the error
    const monitor = ErrorMonitor.getInstance();
    monitor.recordError(error);

    return NextResponse.json({
      success: true,
      message: 'Error recorded successfully',
      error,
    });
  } catch (error) {
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
