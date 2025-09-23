import { NextRequest, NextResponse } from 'next/server';
import { ComplianceService, ComplianceUtils } from '@/lib/compliance';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const action = searchParams.get('action');
    const userId = searchParams.get('userId');

    switch (action) {
      case 'compliance-status':
        const compliance = ComplianceService.validateCompliance();
        return NextResponse.json({
          success: true,
          compliance,
        });

      case 'privacy-policy':
        const privacyPolicy = ComplianceUtils.generatePrivacyPolicy();
        return NextResponse.json({
          success: true,
          privacyPolicy,
        });

      case 'terms-of-service':
        const termsOfService = ComplianceUtils.generateTermsOfService();
        return NextResponse.json({
          success: true,
          termsOfService,
        });

      case 'data-export':
        if (!userId) {
          return NextResponse.json(
            { error: 'Missing userId parameter' },
            { status: 400 }
          );
        }
        const userData = await ComplianceService.exportUserData(userId);
        return NextResponse.json({
          success: true,
          userData,
        });

      default:
        return NextResponse.json(
          { error: 'Invalid action' },
          { status: 400 }
        );
    }
  } catch (error) {
    console.error('Error in compliance API:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action, userId, dataUsage, reason, dataTypes } = body;

    switch (action) {
      case 'record-consent':
        if (!userId || !dataUsage) {
          return NextResponse.json(
            { error: 'Missing required fields: userId and dataUsage' },
            { status: 400 }
          );
        }
        await ComplianceService.recordUserConsent(userId, dataUsage);
        return NextResponse.json({
          success: true,
          message: 'Consent recorded successfully',
        });

      case 'delete-data':
        if (!userId) {
          return NextResponse.json(
            { error: 'Missing userId parameter' },
            { status: 400 }
          );
        }
        const deletionRequest = {
          userId,
          requestDate: new Date().toISOString(),
          reason,
          dataTypes: dataTypes || ['credentials'],
        };
        const deletionResult = await ComplianceService.processDeletionRequest(deletionRequest);
        
        if (deletionResult) {
          return NextResponse.json({
            success: true,
            message: 'Data deleted successfully',
          });
        } else {
          return NextResponse.json(
            { error: 'Failed to delete data' },
            { status: 500 }
          );
        }

      default:
        return NextResponse.json(
          { error: 'Invalid action' },
          { status: 400 }
        );
    }
  } catch (error) {
    console.error('Error in compliance API:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
