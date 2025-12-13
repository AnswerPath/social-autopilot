import { NextRequest, NextResponse } from 'next/server';
import { cleanupDemoMentions } from '@/lib/x-api-storage';
import { activeMonitors } from '@/app/api/mentions/stream/route';

export async function POST(request: NextRequest) {
  try {
    const userId = request.headers.get('x-user-id') || 'demo-user';
    
    console.log('🧹 [CLEANUP] Manual cleanup requested for user:', userId);
    
    // Stop any active demo monitoring first - do this aggressively
    const monitor = activeMonitors.get(userId);
    if (monitor) {
      if (monitor.type === 'demo') {
        console.log('🛑 [CLEANUP] Stopping demo monitoring during cleanup');
        if (monitor.interval) {
          clearInterval(monitor.interval);
          console.log('✅ [CLEANUP] Demo interval cleared');
        }
      } else {
        console.log('⚠️ [CLEANUP] Found non-demo monitor, stopping it too');
        try {
          if (monitor.stop) {
            await monitor.stop();
          }
        } catch (stopError) {
          console.error('Error stopping monitor:', stopError);
        }
      }
      activeMonitors.delete(userId);
      console.log('✅ [CLEANUP] Monitor removed from active monitors');
    } else {
      console.log('ℹ️ [CLEANUP] No active monitor found for user');
    }
    
    // Clean up demo mentions from database
    console.log('🧹 [CLEANUP] Starting database cleanup...');
    const cleanupResult = await cleanupDemoMentions(userId);
    
    if (cleanupResult.success) {
      console.log(`✅ [CLEANUP] Successfully cleaned up ${cleanupResult.deletedCount || 0} demo mentions`);
    } else {
      console.error(`❌ [CLEANUP] Failed to clean up demo mentions: ${cleanupResult.error}`);
    }
    
    return NextResponse.json({
      success: cleanupResult.success,
      message: cleanupResult.success 
        ? `Cleaned up ${cleanupResult.deletedCount || 0} demo mentions${monitor && monitor.type === 'demo' ? ' and stopped demo monitoring' : ''}`
        : 'Failed to clean up demo mentions',
      deletedCount: cleanupResult.deletedCount || 0,
      error: cleanupResult.error,
      demoMonitoringStopped: monitor && monitor.type === 'demo'
    });
  } catch (error) {
    console.error('❌ [CLEANUP] Error cleaning up demo mentions:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to clean up demo mentions'
      },
      { status: 500 }
    );
  }
}

