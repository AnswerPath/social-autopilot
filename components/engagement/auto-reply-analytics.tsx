'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Download, TrendingUp, MessageSquare, Flag, CheckCircle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';

interface EngagementMetrics {
  totalMentions: number;
  positiveCount: number;
  negativeCount: number;
  neutralCount: number;
  autoRepliesSent: number;
  flaggedCount: number;
  responseRate: number;
  avgPriorityScore: number;
}

interface RulePerformance {
  ruleId: string;
  ruleName: string;
  matches: number;
  repliesSent: number;
  successRate: number;
  avgSentiment: 'positive' | 'neutral' | 'negative';
}

interface TimeSeriesData {
  date: string;
  mentions: number;
  replies: number;
  flagged: number;
  positive: number;
  negative: number;
  neutral: number;
}

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8'];

export function AutoReplyAnalytics() {
  const [metrics, setMetrics] = useState<EngagementMetrics | null>(null);
  const [performance, setPerformance] = useState<RulePerformance[]>([]);
  const [timeSeries, setTimeSeries] = useState<TimeSeriesData[]>([]);
  const [loading, setLoading] = useState(true);
  const [days, setDays] = useState(30);
  const { toast } = useToast();

  useEffect(() => {
    fetchAnalytics();
  }, [days]);

  const fetchAnalytics = async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/auto-reply/analytics?type=all&days=${days}`, {
        headers: {
          'x-user-id': 'demo-user',
        },
      });

      const data = await response.json();
      if (data.success) {
        setMetrics(data.metrics);
        setPerformance(data.performance);
        setTimeSeries(data.timeSeries);
      }
    } catch (error) {
      console.error('Error fetching analytics:', error);
      toast({
        title: 'Error',
        description: 'Failed to fetch analytics',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleExport = async () => {
    try {
      const response = await fetch(`/api/auto-reply/analytics/export?format=csv&days=${days}`, {
        headers: {
          'x-user-id': 'demo-user',
        },
      });

      if (response.ok) {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `engagement-analytics-${new Date().toISOString().split('T')[0]}.csv`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);

        toast({
          title: 'Success',
          description: 'Analytics exported successfully',
        });
      }
    } catch (error) {
      console.error('Error exporting analytics:', error);
      toast({
        title: 'Error',
        description: 'Failed to export analytics',
        variant: 'destructive',
      });
    }
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Engagement Analytics</CardTitle>
          <CardDescription>Performance metrics and insights</CardDescription>
        </CardHeader>
        <CardContent>
          <p>Loading...</p>
        </CardContent>
      </Card>
    );
  }

  const sentimentData = metrics ? [
    { name: 'Positive', value: metrics.positiveCount, color: '#10b981' },
    { name: 'Neutral', value: metrics.neutralCount, color: '#6b7280' },
    { name: 'Negative', value: metrics.negativeCount, color: '#ef4444' },
  ] : [];

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Engagement Analytics</CardTitle>
              <CardDescription>Performance metrics and insights</CardDescription>
            </div>
            <div className="flex gap-2">
              <Select value={days.toString()} onValueChange={(value) => setDays(parseInt(value))}>
                <SelectTrigger className="w-32">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="7">Last 7 days</SelectItem>
                  <SelectItem value="30">Last 30 days</SelectItem>
                  <SelectItem value="90">Last 90 days</SelectItem>
                </SelectContent>
              </Select>
              <Button variant="outline" onClick={handleExport}>
                <Download className="h-4 w-4 mr-2" />
                Export
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {metrics && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">Total Mentions</p>
                      <p className="text-2xl font-bold">{metrics.totalMentions}</p>
                    </div>
                    <MessageSquare className="h-8 w-8 text-muted-foreground" />
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">Auto Replies</p>
                      <p className="text-2xl font-bold">{metrics.autoRepliesSent}</p>
                      <p className="text-xs text-muted-foreground">{metrics.responseRate}% response rate</p>
                    </div>
                    <CheckCircle className="h-8 w-8 text-green-500" />
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">Flagged</p>
                      <p className="text-2xl font-bold">{metrics.flaggedCount}</p>
                    </div>
                    <Flag className="h-8 w-8 text-orange-500" />
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">Avg Priority</p>
                      <p className="text-2xl font-bold">{Math.round(metrics.avgPriorityScore)}</p>
                    </div>
                    <TrendingUp className="h-8 w-8 text-blue-500" />
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
            <Card>
              <CardHeader>
                <CardTitle>Mentions Over Time</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={timeSeries}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="date" />
                    <YAxis />
                    <Tooltip />
                    <Legend />
                    <Line type="monotone" dataKey="mentions" stroke="#8884d8" name="Mentions" />
                    <Line type="monotone" dataKey="replies" stroke="#82ca9d" name="Replies" />
                    <Line type="monotone" dataKey="flagged" stroke="#ffc658" name="Flagged" />
                  </LineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Sentiment Distribution</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie
                      data={sentimentData}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                      outerRadius={80}
                      fill="#8884d8"
                      dataKey="value"
                    >
                      {sentimentData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>

          {performance.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Rule Performance</CardTitle>
                <CardDescription>Effectiveness of each auto-reply rule</CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={performance}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="ruleName" />
                    <YAxis />
                    <Tooltip />
                    <Legend />
                    <Bar dataKey="matches" fill="#8884d8" name="Matches" />
                    <Bar dataKey="repliesSent" fill="#82ca9d" name="Replies Sent" />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

