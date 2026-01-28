import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth-utils';
import { supabaseAdmin } from '@/lib/supabase';

/**
 * GET /api/analytics/followers
 * Get follower analytics data for a user, optionally filtered by date range
 * Returns weekly follower growth data
 */
export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser(request);
    const userId = user?.id || request.headers.get('x-user-id') || 'demo-user';
    const { searchParams } = new URL(request.url);
    
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');
    
    console.log(`📊 Follower analytics requested for userId: ${userId}`);
    if (startDate && endDate) {
      console.log(`   Date range: ${startDate} to ${endDate}`);
    }

    // Build query
    let query = supabaseAdmin
      .from('follower_analytics')
      .select('date, follower_count, following_count, tweet_count, collected_at')
      .eq('user_id', userId)
      .order('date', { ascending: true });

    // Apply date range filter if provided
    if (startDate && endDate) {
      query = query
        .gte('date', startDate)
        .lte('date', endDate);
    }

    const { data, error } = await query;

    if (error) {
      console.error(`❌ Database error fetching follower analytics: ${error.message}`);
      return NextResponse.json(
        { success: false, error: `Database error: ${error.message}` },
        { status: 500 }
      );
    }

    if (!data || data.length === 0) {
      console.log(`⚠️ No follower analytics data found for user ${userId}`);
      return NextResponse.json({
        success: true,
        data: [],
        message: 'No follower analytics data available. Sync follower data first.',
      });
    }

    // Group data by week and calculate growth
    const weeklyData = groupByWeek(data);
    
    // Calculate growth for each week
    const weeklyGrowth = weeklyData.map((week, index) => {
      const previousWeek = index > 0 ? weeklyData[index - 1] : null;
      const growth = previousWeek 
        ? week.followerCount - previousWeek.followerCount 
        : 0;
      const growthPercent = previousWeek && previousWeek.followerCount > 0
        ? ((growth / previousWeek.followerCount) * 100)
        : 0;

      return {
        date: week.weekStart,
        followerCount: week.followerCount,
        followingCount: week.followingCount,
        tweetCount: week.tweetCount,
        growth,
        growthPercent: Number(growthPercent.toFixed(2)),
      };
    });

    console.log(`✅ Returning ${weeklyGrowth.length} weeks of follower analytics data`);

    return NextResponse.json({
      success: true,
      data: weeklyGrowth,
    });
  } catch (error) {
    console.error('Error in GET /api/analytics/followers:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch follower analytics' },
      { status: 500 }
    );
  }
}

/**
 * Group follower analytics data by week
 * Returns array of weekly aggregates
 */
function groupByWeek(data: Array<{ date: string; follower_count: number; following_count: number; tweet_count: number }>) {
  const weekMap = new Map<string, { weekStart: string; followerCount: number; followingCount: number; tweetCount: number; dates: string[] }>();

  data.forEach((record) => {
    const date = new Date(record.date);
    // Get the start of the week (Monday)
    const weekStart = getWeekStart(date);
    const weekKey = weekStart.toISOString().split('T')[0];

    if (!weekMap.has(weekKey)) {
      weekMap.set(weekKey, {
        weekStart: weekKey,
        followerCount: 0,
        followingCount: 0,
        tweetCount: 0,
        dates: [],
      });
    }

    const week = weekMap.get(weekKey)!;
    // Use the latest data point for each week (most recent follower count)
    if (!week.dates.includes(record.date) || new Date(record.date) > new Date(week.dates[week.dates.length - 1] || '')) {
      week.followerCount = record.follower_count;
      week.followingCount = record.following_count;
      week.tweetCount = record.tweet_count;
      week.dates.push(record.date);
    }
  });

  // Convert map to array and sort by week start date
  return Array.from(weekMap.values())
    .sort((a, b) => new Date(a.weekStart).getTime() - new Date(b.weekStart).getTime());
}

/**
 * Get the start of the week (Monday) for a given date
 */
function getWeekStart(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1); // Adjust when day is Sunday
  return new Date(d.setDate(diff));
}
