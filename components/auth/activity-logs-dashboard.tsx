'use client';

import React, { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/use-auth';
import { useActivityLogs } from '@/hooks/use-activity-logs';
import { ActivityCategory, ActivityLevel } from '@/lib/activity-logging';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { 
  Loader2, 
  Search, 
  Filter, 
  Download, 
  RefreshCw, 
  Trash2, 
  Eye, 
  AlertTriangle, 
  Info, 
  XCircle, 
  CheckCircle,
  Calendar,
  User,
  Activity,
  BarChart3,
  FileText,
  Settings
} from 'lucide-react';
import { cn } from '@/lib/utils';

export function ActivityLogsDashboard() {
  const { user } = useAuth();
  const {
    logs,
    stats,
    pagination,
    loading,
    error,
    fetchActivityLogs,
    fetchActivityStats,
    exportActivityLogs,
    cleanupExpiredLogs,
    loadMoreLogs,
    refreshLogs
  } = useActivityLogs();

  const [activeTab, setActiveTab] = useState('logs');
  const [filters, setFilters] = useState({
    search: '',
    category: '',
    level: '',
    startDate: '',
    endDate: '',
    minSeverity: ''
  });
  const [selectedLog, setSelectedLog] = useState<any>(null);
  const [showFilters, setShowFilters] = useState(false);
  const [exportDialog, setExportDialog] = useState(false);
  const [exportFormat, setExportFormat] = useState<'json' | 'csv'>('json');

  // Apply filters and fetch logs
  const applyFilters = async () => {
    const filterParams = {
      search: filters.search || undefined,
      category: filters.category as ActivityCategory || undefined,
      level: filters.level as ActivityLevel || undefined,
      startDate: filters.startDate || undefined,
      endDate: filters.endDate || undefined,
      minSeverity: filters.minSeverity ? parseInt(filters.minSeverity) : undefined
    };

    await fetchActivityLogs(filterParams);
  };

  // Handle export
  const handleExport = async () => {
    const exportRequest = {
      category: filters.category as ActivityCategory || undefined,
      level: filters.level as ActivityLevel || undefined,
      startDate: filters.startDate || undefined,
      endDate: filters.endDate || undefined,
      format: exportFormat
    };

    const result = await exportActivityLogs(exportRequest);
    if (result) {
      // Create and download file
      const blob = new Blob([exportFormat === 'json' ? JSON.stringify(result.data, null, 2) : result.data], {
        type: exportFormat === 'json' ? 'application/json' : 'text/csv'
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = result.filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      
      setExportDialog(false);
    }
  };

  // Handle cleanup
  const handleCleanup = async () => {
    if (confirm('Are you sure you want to clean up expired logs? This action cannot be undone.')) {
      const success = await cleanupExpiredLogs();
      if (success) {
        alert('Expired logs cleaned up successfully!');
      }
    }
  };

  // Load initial data
  useEffect(() => {
    if (user?.permissions.includes('VIEW_SYSTEM_LOGS')) {
      applyFilters();
    }
  }, []);

  const getLevelIcon = (level: ActivityLevel) => {
    switch (level) {
      case ActivityLevel.CRITICAL:
        return <XCircle className="h-4 w-4 text-red-500" />;
      case ActivityLevel.ERROR:
        return <AlertTriangle className="h-4 w-4 text-red-400" />;
      case ActivityLevel.WARNING:
        return <AlertTriangle className="h-4 w-4 text-yellow-500" />;
      case ActivityLevel.INFO:
        return <Info className="h-4 w-4 text-blue-500" />;
      default:
        return <Info className="h-4 w-4 text-gray-500" />;
    }
  };

  const getLevelBadgeVariant = (level: ActivityLevel) => {
    switch (level) {
      case ActivityLevel.CRITICAL:
        return 'destructive';
      case ActivityLevel.ERROR:
        return 'destructive';
      case ActivityLevel.WARNING:
        return 'secondary';
      case ActivityLevel.INFO:
        return 'outline';
      default:
        return 'outline';
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString();
  };

  const formatSeverity = (score: number) => {
    if (score >= 8) return 'Critical';
    if (score >= 6) return 'High';
    if (score >= 4) return 'Medium';
    return 'Low';
  };

  if (!user?.permissions.includes('VIEW_SYSTEM_LOGS')) {
    return (
      <Card>
        <CardContent className="pt-6">
          <Alert>
            <Info className="h-4 w-4" />
            <AlertDescription>You do not have permission to view activity logs.</AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <Activity className="mr-2 h-5 w-5" />
            Activity Logs Dashboard
          </CardTitle>
          <CardDescription>
            Monitor system activity, user actions, and security events
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="logs">Activity Logs</TabsTrigger>
              <TabsTrigger value="stats">Statistics</TabsTrigger>
              <TabsTrigger value="settings">Settings</TabsTrigger>
            </TabsList>

            <TabsContent value="logs" className="mt-4">
              <div className="space-y-4">
                {/* Filters and Actions */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setShowFilters(!showFilters)}
                    >
                      <Filter className="h-4 w-4 mr-2" />
                      Filters
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={refreshLogs}
                      disabled={loading}
                    >
                      <RefreshCw className={cn("h-4 w-4 mr-2", loading && "animate-spin")} />
                      Refresh
                    </Button>
                    <Dialog open={exportDialog} onOpenChange={setExportDialog}>
                      <DialogTrigger asChild>
                        <Button variant="outline" size="sm">
                          <Download className="h-4 w-4 mr-2" />
                          Export
                        </Button>
                      </DialogTrigger>
                      <DialogContent>
                        <DialogHeader>
                          <DialogTitle>Export Activity Logs</DialogTitle>
                          <DialogDescription>
                            Choose the format and filters for your export
                          </DialogDescription>
                        </DialogHeader>
                        <div className="space-y-4">
                          <div>
                            <Label htmlFor="export-format">Format</Label>
                            <Select value={exportFormat} onValueChange={(value: 'json' | 'csv') => setExportFormat(value)}>
                              <SelectTrigger>
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="json">JSON</SelectItem>
                                <SelectItem value="csv">CSV</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="flex justify-end space-x-2">
                            <Button variant="outline" onClick={() => setExportDialog(false)}>
                              Cancel
                            </Button>
                            <Button onClick={handleExport} disabled={loading}>
                              {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Download className="h-4 w-4 mr-2" />}
                              Export
                            </Button>
                          </div>
                        </div>
                      </DialogContent>
                    </Dialog>
                  </div>
                </div>

                {/* Filters Panel */}
                {showFilters && (
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-lg">Filter Activity Logs</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        <div>
                          <Label htmlFor="search">Search</Label>
                          <Input
                            id="search"
                            placeholder="Search actions or details..."
                            value={filters.search}
                            onChange={(e) => setFilters({ ...filters, search: e.target.value })}
                          />
                        </div>
                        <div>
                          <Label htmlFor="category">Category</Label>
                          <Select value={filters.category} onValueChange={(value) => setFilters({ ...filters, category: value })}>
                            <SelectTrigger>
                              <SelectValue placeholder="All categories" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="">All Categories</SelectItem>
                              {Object.values(ActivityCategory).map(category => (
                                <SelectItem key={category} value={category}>
                                  {category.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div>
                          <Label htmlFor="level">Level</Label>
                          <Select value={filters.level} onValueChange={(value) => setFilters({ ...filters, level: value })}>
                            <SelectTrigger>
                              <SelectValue placeholder="All levels" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="">All Levels</SelectItem>
                              {Object.values(ActivityLevel).map(level => (
                                <SelectItem key={level} value={level}>
                                  {level.charAt(0).toUpperCase() + level.slice(1)}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div>
                          <Label htmlFor="start-date">Start Date</Label>
                          <Input
                            id="start-date"
                            type="date"
                            value={filters.startDate}
                            onChange={(e) => setFilters({ ...filters, startDate: e.target.value })}
                          />
                        </div>
                        <div>
                          <Label htmlFor="end-date">End Date</Label>
                          <Input
                            id="end-date"
                            type="date"
                            value={filters.endDate}
                            onChange={(e) => setFilters({ ...filters, endDate: e.target.value })}
                          />
                        </div>
                        <div>
                          <Label htmlFor="min-severity">Min Severity</Label>
                          <Select value={filters.minSeverity} onValueChange={(value) => setFilters({ ...filters, minSeverity: value })}>
                            <SelectTrigger>
                              <SelectValue placeholder="All severities" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="">All Severities</SelectItem>
                              <SelectItem value="1">Low (1+)</SelectItem>
                              <SelectItem value="4">Medium (4+)</SelectItem>
                              <SelectItem value="6">High (6+)</SelectItem>
                              <SelectItem value="8">Critical (8+)</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                      <div className="flex justify-end">
                        <Button onClick={applyFilters} disabled={loading}>
                          {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Search className="h-4 w-4 mr-2" />}
                          Apply Filters
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                )}

                {/* Logs Table */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center justify-between">
                      <span>Activity Logs</span>
                      <Badge variant="outline">
                        {pagination.total} total
                      </Badge>
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    {loading && logs.length === 0 ? (
                      <div className="flex items-center justify-center py-8">
                        <Loader2 className="h-6 w-6 animate-spin mr-2" />
                        <span>Loading activity logs...</span>
                      </div>
                    ) : error ? (
                      <Alert variant="destructive">
                        <AlertTriangle className="h-4 w-4" />
                        <AlertDescription>{error}</AlertDescription>
                      </Alert>
                    ) : logs.length === 0 ? (
                      <div className="text-center py-8 text-gray-500">
                        No activity logs found matching your criteria.
                      </div>
                    ) : (
                      <div className="space-y-4">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Level</TableHead>
                              <TableHead>Action</TableHead>
                              <TableHead>Category</TableHead>
                              <TableHead>User</TableHead>
                              <TableHead>Resource</TableHead>
                              <TableHead>Severity</TableHead>
                              <TableHead>Date</TableHead>
                              <TableHead>Actions</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {logs.map((log) => (
                              <TableRow key={log.id}>
                                <TableCell>
                                  <div className="flex items-center space-x-2">
                                    {getLevelIcon(log.level)}
                                    <Badge variant={getLevelBadgeVariant(log.level)}>
                                      {log.level}
                                    </Badge>
                                  </div>
                                </TableCell>
                                <TableCell className="font-medium">
                                  {log.action}
                                </TableCell>
                                <TableCell>
                                  <Badge variant="outline">
                                    {log.category.replace(/_/g, ' ')}
                                  </Badge>
                                </TableCell>
                                <TableCell>
                                  <div className="flex items-center space-x-2">
                                    <User className="h-4 w-4 text-gray-500" />
                                    <span className="text-sm">{log.user_id?.substring(0, 8)}...</span>
                                  </div>
                                </TableCell>
                                <TableCell>
                                  {log.resource_type && log.resource_id ? (
                                    <span className="text-sm">
                                      {log.resource_type}:{log.resource_id.substring(0, 8)}...
                                    </span>
                                  ) : (
                                    <span className="text-gray-400">-</span>
                                  )}
                                </TableCell>
                                <TableCell>
                                  <Badge variant="outline">
                                    {formatSeverity(log.severity_score)}
                                  </Badge>
                                </TableCell>
                                <TableCell>
                                  <div className="flex items-center space-x-2">
                                    <Calendar className="h-4 w-4 text-gray-500" />
                                    <span className="text-sm">{formatDate(log.created_at)}</span>
                                  </div>
                                </TableCell>
                                <TableCell>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => setSelectedLog(log)}
                                  >
                                    <Eye className="h-4 w-4" />
                                  </Button>
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>

                        {/* Load More Button */}
                        {pagination.hasMore && (
                          <div className="flex justify-center">
                            <Button
                              variant="outline"
                              onClick={() => loadMoreLogs()}
                              disabled={loading}
                            >
                              {loading ? (
                                <Loader2 className="h-4 w-4 animate-spin mr-2" />
                              ) : (
                                <RefreshCw className="h-4 w-4 mr-2" />
                              )}
                              Load More
                            </Button>
                          </div>
                        )}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            <TabsContent value="stats" className="mt-4">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Total Events</CardTitle>
                    <Activity className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{stats?.totalEvents || 0}</div>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Critical Events</CardTitle>
                    <XCircle className="h-4 w-4 text-red-500" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold text-red-500">{stats?.criticalEvents || 0}</div>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Authentication</CardTitle>
                    <User className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{stats?.eventsByCategory?.authentication || 0}</div>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Security</CardTitle>
                    <AlertTriangle className="h-4 w-4 text-yellow-500" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{stats?.eventsByCategory?.security || 0}</div>
                  </CardContent>
                </Card>
              </div>

              {/* Top Actions */}
              {stats?.topActions && stats.topActions.length > 0 && (
                <Card className="mt-4">
                  <CardHeader>
                    <CardTitle className="flex items-center">
                      <BarChart3 className="mr-2 h-5 w-5" />
                      Top Actions
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      {stats.topActions.slice(0, 10).map((action, index) => (
                        <div key={action.action} className="flex items-center justify-between">
                          <span className="text-sm">{action.action}</span>
                          <Badge variant="outline">{action.count}</Badge>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}
            </TabsContent>

            <TabsContent value="settings" className="mt-4">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center">
                    <Settings className="mr-2 h-5 w-5" />
                    Log Management
                  </CardTitle>
                  <CardDescription>
                    Manage log retention and cleanup
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <Alert>
                    <Info className="h-4 w-4" />
                    <AlertDescription>
                      Log retention policies are automatically applied. Expired logs are cleaned up based on their severity level and category.
                    </AlertDescription>
                  </Alert>
                  
                  <div className="flex justify-end">
                    <Button
                      variant="outline"
                      onClick={handleCleanup}
                      disabled={loading}
                    >
                      {loading ? (
                        <Loader2 className="h-4 w-4 animate-spin mr-2" />
                      ) : (
                        <Trash2 className="h-4 w-4 mr-2" />
                      )}
                      Cleanup Expired Logs
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      {/* Log Details Dialog */}
      <Dialog open={!!selectedLog} onOpenChange={() => setSelectedLog(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Activity Log Details</DialogTitle>
            <DialogDescription>
              Detailed information about this activity log entry
            </DialogDescription>
          </DialogHeader>
          {selectedLog && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-sm font-medium">Level</Label>
                  <div className="flex items-center space-x-2 mt-1">
                    {getLevelIcon(selectedLog.level)}
                    <Badge variant={getLevelBadgeVariant(selectedLog.level)}>
                      {selectedLog.level}
                    </Badge>
                  </div>
                </div>
                <div>
                  <Label className="text-sm font-medium">Severity</Label>
                  <div className="mt-1">
                    <Badge variant="outline">
                      {formatSeverity(selectedLog.severity_score)}
                    </Badge>
                  </div>
                </div>
                <div>
                  <Label className="text-sm font-medium">Action</Label>
                  <p className="text-sm mt-1">{selectedLog.action}</p>
                </div>
                <div>
                  <Label className="text-sm font-medium">Category</Label>
                  <p className="text-sm mt-1">{selectedLog.category}</p>
                </div>
                <div>
                  <Label className="text-sm font-medium">User ID</Label>
                  <p className="text-sm mt-1 font-mono">{selectedLog.user_id}</p>
                </div>
                <div>
                  <Label className="text-sm font-medium">Date</Label>
                  <p className="text-sm mt-1">{formatDate(selectedLog.created_at)}</p>
                </div>
              </div>

              {selectedLog.details && Object.keys(selectedLog.details).length > 0 && (
                <div>
                  <Label className="text-sm font-medium">Details</Label>
                  <pre className="text-xs bg-gray-100 p-3 rounded mt-1 overflow-auto">
                    {JSON.stringify(selectedLog.details, null, 2)}
                  </pre>
                </div>
              )}

              {selectedLog.metadata && Object.keys(selectedLog.metadata).length > 0 && (
                <div>
                  <Label className="text-sm font-medium">Metadata</Label>
                  <pre className="text-xs bg-gray-100 p-3 rounded mt-1 overflow-auto">
                    {JSON.stringify(selectedLog.metadata, null, 2)}
                  </pre>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
