/**
 * Automated Tests for Task 21: Engagement Automation
 * 
 * These tests verify code structure, API endpoints, and core functionality
 * that can be tested programmatically without requiring a running server.
 */

import { describe, it, expect } from '@jest/globals';
import * as fs from 'fs';
import * as path from 'path';

describe('Task 21: Engagement Automation - Code Structure Tests', () => {
  
  describe('1. Database Migration Structure', () => {
    it('should have migration file with correct table names', () => {
      // Verify migration file exists and contains expected tables
      const migrationPath = path.join(process.cwd(), 'supabase', 'migrations', '20250120000000_engagement_automation.sql');
      expect(fs.existsSync(migrationPath)).toBe(true);
      
      const migrationContent = fs.readFileSync(migrationPath, 'utf-8');
      expect(migrationContent).toContain('auto_reply_rules');
      expect(migrationContent).toContain('mentions');
      expect(migrationContent).toContain('auto_reply_logs');
      expect(migrationContent).toContain('mention_analytics');
    });
  });

  describe('2. Sentiment Analysis Service', () => {
    it('should have sentiment service file', () => {
      const servicePath = path.join(process.cwd(), 'lib', 'sentiment', 'sentiment-service.ts');
      expect(fs.existsSync(servicePath)).toBe(true);
    });

    it('should export createSentimentService function', () => {
      const servicePath = path.join(process.cwd(), 'lib', 'sentiment', 'sentiment-service.ts');
      const content = fs.readFileSync(servicePath, 'utf-8');
      expect(content).toContain('createSentimentService');
      expect(content).toContain('SentimentService');
    });
  });

  describe('3. Rule Engine', () => {
    it('should have rule engine file', () => {
      const enginePath = path.join(process.cwd(), 'lib', 'auto-reply', 'rule-engine.ts');
      expect(fs.existsSync(enginePath)).toBe(true);
    });

    it('should export RuleEngine class and createRuleEngine function', () => {
      const enginePath = path.join(process.cwd(), 'lib', 'auto-reply', 'rule-engine.ts');
      const content = fs.readFileSync(enginePath, 'utf-8');
      expect(content).toContain('RuleEngine');
      expect(content).toContain('createRuleEngine');
      expect(content).toContain('matchMention');
      expect(content).toContain('generateResponse');
    });
  });

  describe('4. Flagging Service', () => {
    it('should have flagging service file', () => {
      const servicePath = path.join(process.cwd(), 'lib', 'priority', 'flagging-service.ts');
      expect(fs.existsSync(servicePath)).toBe(true);
    });

    it('should export FlaggingService class and createFlaggingService function', () => {
      const servicePath = path.join(process.cwd(), 'lib', 'priority', 'flagging-service.ts');
      const content = fs.readFileSync(servicePath, 'utf-8');
      expect(content).toContain('FlaggingService');
      expect(content).toContain('createFlaggingService');
      expect(content).toContain('evaluateMention');
      expect(content).toContain('getFlaggedMentions');
    });
  });

  describe('5. Analytics Service', () => {
    it('should have analytics service file', () => {
      const servicePath = path.join(process.cwd(), 'lib', 'analytics', 'engagement-analytics.ts');
      expect(fs.existsSync(servicePath)).toBe(true);
    });

    it('should export EngagementAnalyticsService class and factory function', () => {
      const servicePath = path.join(process.cwd(), 'lib', 'analytics', 'engagement-analytics.ts');
      const content = fs.readFileSync(servicePath, 'utf-8');
      expect(content).toContain('EngagementAnalyticsService');
      expect(content).toContain('createEngagementAnalyticsService');
      expect(content).toContain('getMetrics');
      expect(content).toContain('getRulePerformance');
      expect(content).toContain('getTimeSeriesData');
    });
  });

  describe('6. API Route Structure', () => {
    it('should have mentions stream route', () => {
      const routePath = path.join(process.cwd(), 'app', 'api', 'mentions', 'stream', 'route.ts');
      expect(fs.existsSync(routePath)).toBe(true);
      
      const routeContent = fs.readFileSync(routePath, 'utf-8');
      expect(routeContent).toContain('GET');
      expect(routeContent).toContain('DELETE');
      expect(routeContent).toContain('POST');
    });

    it('should have auto-reply rules route', () => {
      const routePath = path.join(process.cwd(), 'app', 'api', 'auto-reply', 'rules', 'route.ts');
      expect(fs.existsSync(routePath)).toBe(true);
      
      const routeContent = fs.readFileSync(routePath, 'utf-8');
      expect(routeContent).toContain('GET');
      expect(routeContent).toContain('POST');
      expect(routeContent).toContain('PATCH');
      expect(routeContent).toContain('DELETE');
    });

    it('should have sentiment analysis route', () => {
      const routePath = path.join(process.cwd(), 'app', 'api', 'mentions', 'sentiment', 'route.ts');
      expect(fs.existsSync(routePath)).toBe(true);
    });

    it('should have flagged mentions route', () => {
      const routePath = path.join(process.cwd(), 'app', 'api', 'mentions', 'flagged', 'route.ts');
      expect(fs.existsSync(routePath)).toBe(true);
    });

    it('should have analytics route', () => {
      const routePath = path.join(process.cwd(), 'app', 'api', 'auto-reply', 'analytics', 'route.ts');
      expect(fs.existsSync(routePath)).toBe(true);
    });

    it('should have rule test route', () => {
      const routePath = path.join(process.cwd(), 'app', 'api', 'auto-reply', 'test', 'route.ts');
      expect(fs.existsSync(routePath)).toBe(true);
    });
  });

  describe('7. Component Structure', () => {
    it('should have EngagementMonitor component', () => {
      const componentPath = path.join(process.cwd(), 'components', 'engagement-monitor.tsx');
      expect(fs.existsSync(componentPath)).toBe(true);
    });

    it('should have AutoReplyRules component', () => {
      const componentPath = path.join(process.cwd(), 'components', 'engagement', 'auto-reply-rules.tsx');
      expect(fs.existsSync(componentPath)).toBe(true);
    });

    it('should have FlaggedMentions component', () => {
      const componentPath = path.join(process.cwd(), 'components', 'engagement', 'flagged-mentions.tsx');
      expect(fs.existsSync(componentPath)).toBe(true);
    });

    it('should have AutoReplyAnalytics component', () => {
      const componentPath = path.join(process.cwd(), 'components', 'engagement', 'auto-reply-analytics.tsx');
      expect(fs.existsSync(componentPath)).toBe(true);
    });
  });
});

