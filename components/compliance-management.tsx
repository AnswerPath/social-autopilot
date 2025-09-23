'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Shield, Download, Trash2, FileText, CheckCircle, XCircle, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';

interface ComplianceStatus {
  gdprCompliant: boolean;
  ccpaCompliant: boolean;
  issues: string[];
}

interface UserData {
  userId: string;
  exportDate: string;
  data: {
    credentials: any[];
    [key: string]: any;
  };
}

export function ComplianceManagement({ userId }: { userId: string }) {
  const [complianceStatus, setComplianceStatus] = useState<ComplianceStatus | null>(null);
  const [loading, setLoading] = useState(false);
  const [privacyPolicy, setPrivacyPolicy] = useState<string>('');
  const [termsOfService, setTermsOfService] = useState<string>('');
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [deleteReason, setDeleteReason] = useState('');

  useEffect(() => {
    loadComplianceData();
  }, [userId]);

  const loadComplianceData = async () => {
    setLoading(true);
    try {
      // Load compliance status
      const statusResponse = await fetch('/api/settings/compliance?action=compliance-status');
      const statusData = await statusResponse.json();
      
      if (statusData.success) {
        setComplianceStatus(statusData.compliance);
      }

      // Load privacy policy
      const policyResponse = await fetch('/api/settings/compliance?action=privacy-policy');
      const policyData = await policyResponse.json();
      
      if (policyData.success) {
        setPrivacyPolicy(policyData.privacyPolicy);
      }

      // Load terms of service
      const termsResponse = await fetch('/api/settings/compliance?action=terms-of-service');
      const termsData = await termsResponse.json();
      
      if (termsData.success) {
        setTermsOfService(termsData.termsOfService);
      }
    } catch (error) {
      console.error('Error loading compliance data:', error);
      toast.error('Failed to load compliance data');
    } finally {
      setLoading(false);
    }
  };

  const exportUserData = async () => {
    try {
      const response = await fetch(`/api/settings/compliance?action=data-export&userId=${userId}`);
      const data = await response.json();
      
      if (data.success) {
        // Create and download the JSON file
        const blob = new Blob([JSON.stringify(data.userData, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `user-data-${userId}-${new Date().toISOString().split('T')[0]}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        
        toast.success('User data exported successfully');
      } else {
        toast.error('Failed to export user data');
      }
    } catch (error) {
      console.error('Error exporting user data:', error);
      toast.error('Failed to export user data');
    }
  };

  const deleteUserData = async () => {
    try {
      const response = await fetch('/api/settings/compliance', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: 'delete-data',
          userId,
          reason: deleteReason,
          dataTypes: ['credentials', 'profile', 'analytics', 'logs'],
        }),
      });

      const data = await response.json();
      
      if (data.success) {
        toast.success('User data deleted successfully');
        setShowDeleteDialog(false);
        setDeleteReason('');
      } else {
        toast.error('Failed to delete user data');
      }
    } catch (error) {
      console.error('Error deleting user data:', error);
      toast.error('Failed to delete user data');
    }
  };

  const recordConsent = async () => {
    try {
      const response = await fetch('/api/settings/compliance', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: 'record-consent',
          userId,
          dataUsage: ['api_credentials', 'analytics', 'notifications'],
        }),
      });

      const data = await response.json();
      
      if (data.success) {
        toast.success('Consent recorded successfully');
      } else {
        toast.error('Failed to record consent');
      }
    } catch (error) {
      console.error('Error recording consent:', error);
      toast.error('Failed to record consent');
    }
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            GDPR & CCPA Compliance
          </CardTitle>
          <CardDescription>
            Managing data privacy and compliance
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-gray-900"></div>
            <span className="ml-2">Loading compliance data...</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Shield className="h-5 w-5" />
          GDPR & CCPA Compliance
        </CardTitle>
        <CardDescription>
          Manage data privacy, user rights, and regulatory compliance
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Compliance Status */}
        {complianceStatus && (
          <div className="space-y-4">
            <h3 className="font-semibold">Compliance Status</h3>
            <div className="grid grid-cols-2 gap-4">
              <div className="flex items-center justify-between p-3 border rounded-lg">
                <div className="flex items-center gap-2">
                  {complianceStatus.gdprCompliant ? (
                    <CheckCircle className="h-4 w-4 text-green-500" />
                  ) : (
                    <XCircle className="h-4 w-4 text-red-500" />
                  )}
                  <span className="font-medium">GDPR</span>
                </div>
                <Badge variant={complianceStatus.gdprCompliant ? 'default' : 'destructive'}>
                  {complianceStatus.gdprCompliant ? 'Compliant' : 'Non-Compliant'}
                </Badge>
              </div>
              <div className="flex items-center justify-between p-3 border rounded-lg">
                <div className="flex items-center gap-2">
                  {complianceStatus.ccpaCompliant ? (
                    <CheckCircle className="h-4 w-4 text-green-500" />
                  ) : (
                    <XCircle className="h-4 w-4 text-red-500" />
                  )}
                  <span className="font-medium">CCPA</span>
                </div>
                <Badge variant={complianceStatus.ccpaCompliant ? 'default' : 'destructive'}>
                  {complianceStatus.ccpaCompliant ? 'Compliant' : 'Non-Compliant'}
                </Badge>
              </div>
            </div>

            {complianceStatus.issues.length > 0 && (
              <Alert variant="destructive">
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>
                  <div className="font-medium mb-2">Compliance Issues:</div>
                  <ul className="list-disc list-inside space-y-1">
                    {complianceStatus.issues.map((issue, index) => (
                      <li key={index} className="text-sm">{issue}</li>
                    ))}
                  </ul>
                </AlertDescription>
              </Alert>
            )}
          </div>
        )}

        {/* User Rights */}
        <div className="space-y-4">
          <h3 className="font-semibold">User Rights Management</h3>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Data Export */}
            <div className="p-4 border rounded-lg">
              <div className="flex items-center gap-2 mb-2">
                <Download className="h-4 w-4" />
                <span className="font-medium">Right to Data Portability</span>
              </div>
              <p className="text-sm text-muted-foreground mb-3">
                Export all your personal data in a machine-readable format
              </p>
              <Button
                variant="outline"
                size="sm"
                onClick={exportUserData}
                className="w-full"
              >
                Export My Data
              </Button>
            </div>

            {/* Data Deletion */}
            <div className="p-4 border rounded-lg">
              <div className="flex items-center gap-2 mb-2">
                <Trash2 className="h-4 w-4" />
                <span className="font-medium">Right to be Forgotten</span>
              </div>
              <p className="text-sm text-muted-foreground mb-3">
                Request complete deletion of your personal data
              </p>
              <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
                <DialogTrigger asChild>
                  <Button
                    variant="destructive"
                    size="sm"
                    className="w-full"
                  >
                    Delete My Data
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Delete User Data</DialogTitle>
                    <DialogDescription>
                      This action will permanently delete all your personal data including:
                      <ul className="list-disc list-inside mt-2 space-y-1">
                        <li>API credentials</li>
                        <li>User profile information</li>
                        <li>Analytics data</li>
                        <li>Activity logs</li>
                      </ul>
                      <p className="mt-3 text-sm text-red-600">
                        This action cannot be undone.
                      </p>
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4">
                    <div>
                      <label className="text-sm font-medium">Reason for deletion (optional)</label>
                      <Textarea
                        value={deleteReason}
                        onChange={(e) => setDeleteReason(e.target.value)}
                        placeholder="Please provide a reason for data deletion..."
                        className="mt-1"
                      />
                    </div>
                    <div className="flex gap-2">
                      <Button
                        variant="destructive"
                        onClick={deleteUserData}
                        className="flex-1"
                      >
                        Confirm Deletion
                      </Button>
                      <Button
                        variant="outline"
                        onClick={() => setShowDeleteDialog(false)}
                        className="flex-1"
                      >
                        Cancel
                      </Button>
                    </div>
                  </div>
                </DialogContent>
              </Dialog>
            </div>
          </div>

          {/* Consent Management */}
          <div className="p-4 border rounded-lg">
            <div className="flex items-center gap-2 mb-2">
              <CheckCircle className="h-4 w-4" />
              <span className="font-medium">Consent Management</span>
            </div>
            <p className="text-sm text-muted-foreground mb-3">
              Record your consent for data processing activities
            </p>
            <Button
              variant="outline"
              size="sm"
              onClick={recordConsent}
            >
              Record Consent
            </Button>
          </div>
        </div>

        {/* Legal Documents */}
        <div className="space-y-4">
          <h3 className="font-semibold">Legal Documents</h3>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Dialog>
              <DialogTrigger asChild>
                <Button variant="outline" className="w-full">
                  <FileText className="h-4 w-4 mr-2" />
                  View Privacy Policy
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>Privacy Policy</DialogTitle>
                </DialogHeader>
                <div className="whitespace-pre-wrap text-sm">
                  {privacyPolicy}
                </div>
              </DialogContent>
            </Dialog>

            <Dialog>
              <DialogTrigger asChild>
                <Button variant="outline" className="w-full">
                  <FileText className="h-4 w-4 mr-2" />
                  View Terms of Service
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>Terms of Service</DialogTitle>
                </DialogHeader>
                <div className="whitespace-pre-wrap text-sm">
                  {termsOfService}
                </div>
              </DialogContent>
            </Dialog>
          </div>
        </div>

        {/* Data Retention */}
        <div className="space-y-4">
          <h3 className="font-semibold">Data Retention Policy</h3>
          <div className="p-4 border rounded-lg bg-gray-50">
            <div className="space-y-2">
              <div className="flex justify-between">
                <span className="font-medium">API Credentials:</span>
                <span>365 days</span>
              </div>
              <div className="flex justify-between">
                <span className="font-medium">Analytics Data:</span>
                <span>2 years</span>
              </div>
              <div className="flex justify-between">
                <span className="font-medium">Activity Logs:</span>
                <span>90 days</span>
              </div>
              <div className="flex justify-between">
                <span className="font-medium">User Profiles:</span>
                <span>Until account deletion</span>
              </div>
            </div>
            <p className="text-sm text-muted-foreground mt-3">
              Data is automatically deleted after the retention period expires.
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
