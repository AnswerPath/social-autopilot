'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Plus, Edit, Trash2, TestTube } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface AutoReplyRule {
  id: string;
  rule_name: string;
  keywords: string[];
  phrases: string[];
  response_template: string;
  is_active: boolean;
  priority: number;
  throttle_settings: {
    max_per_hour: number;
    max_per_day: number;
    cooldown_minutes: number;
  };
  match_type: 'any' | 'all';
  sentiment_filter: string[];
  matchCount?: number;
}

export function AutoReplyRules() {
  const [rules, setRules] = useState<AutoReplyRule[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingRule, setEditingRule] = useState<AutoReplyRule | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [testText, setTestText] = useState('');
  const [testResult, setTestResult] = useState<any>(null);
  const { toast } = useToast();

  // Form state
  const [formData, setFormData] = useState<Partial<AutoReplyRule>>({
    rule_name: '',
    keywords: [],
    phrases: [],
    response_template: '',
    is_active: true,
    priority: 0,
    throttle_settings: {
      max_per_hour: 10,
      max_per_day: 50,
      cooldown_minutes: 5,
    },
    match_type: 'any',
    sentiment_filter: [],
  });

  useEffect(() => {
    fetchRules();
  }, []);

  const fetchRules = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/auto-reply/rules', {
        headers: {
          'x-user-id': 'demo-user',
        },
      });

      const data = await response.json();
      if (data.success) {
        const rulesWithCounts = await Promise.all(
          (data.rules || []).map(async (rule: AutoReplyRule) => {
            // Fetch match count for this rule
            try {
              const logsResponse = await fetch(`/api/auto-reply/analytics?type=metrics`, {
                headers: {
                  'x-user-id': 'demo-user',
                },
              });
              if (logsResponse.ok) {
                const logsData = await logsResponse.json();
                // Count matches for this specific rule from logs
                const matchCount = await fetchRuleMatchCount(rule.id);
                return { ...rule, matchCount };
              }
            } catch (error) {
              console.error('Error fetching match count:', error);
            }
            return rule;
          })
        );
        setRules(rulesWithCounts);
      }
    } catch (error) {
      console.error('Error fetching rules:', error);
      toast({
        title: 'Error',
        description: 'Failed to fetch auto-reply rules',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const fetchRuleMatchCount = async (ruleId: string): Promise<number> => {
    try {
      const response = await fetch(`/api/auto-reply/logs?ruleId=${ruleId}`, {
        headers: {
          'x-user-id': 'demo-user',
        },
      });
      if (response.ok) {
        const data = await response.json();
        return data.count || 0;
      }
    } catch (error) {
      console.error('Error fetching rule match count:', error);
    }
    return 0;
  };

  const handleToggleActive = async (rule: AutoReplyRule) => {
    const newActiveState = !rule.is_active;
    try {
      const response = await fetch('/api/auto-reply/rules', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'x-user-id': 'demo-user',
        },
        body: JSON.stringify({
          id: rule.id,
          is_active: newActiveState,
        }),
      });

      const data = await response.json();
      if (data.success) {
        // Update local state immediately
        setRules(rules.map(r => r.id === rule.id ? { ...r, is_active: newActiveState } : r));
        toast({
          title: 'Success',
          description: `Rule ${newActiveState ? 'activated' : 'deactivated'}`,
        });
      } else {
        throw new Error(data.error);
      }
    } catch (error) {
      console.error('Error toggling rule:', error);
      toast({
        title: 'Error',
        description: 'Failed to update rule status',
        variant: 'destructive',
      });
    }
  };

  const handleSave = async () => {
    try {
      const url = editingRule
        ? '/api/auto-reply/rules'
        : '/api/auto-reply/rules';
      const method = editingRule ? 'PATCH' : 'POST';

      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          'x-user-id': 'demo-user',
        },
        body: JSON.stringify(editingRule ? { id: editingRule.id, ...formData } : formData),
      });

      const data = await response.json();
      if (data.success) {
        toast({
          title: 'Success',
          description: `Rule ${editingRule ? 'updated' : 'created'} successfully`,
        });
        setIsDialogOpen(false);
        setEditingRule(null);
        resetForm();
        fetchRules();
      } else {
        throw new Error(data.error);
      }
    } catch (error) {
      console.error('Error saving rule:', error);
      toast({
        title: 'Error',
        description: 'Failed to save rule',
        variant: 'destructive',
      });
    }
  };

  const handleDelete = async (ruleId: string) => {
    if (!confirm('Are you sure you want to delete this rule?')) {
      return;
    }

    try {
      const response = await fetch(`/api/auto-reply/rules?id=${ruleId}`, {
        method: 'DELETE',
        headers: {
          'x-user-id': 'demo-user',
        },
      });

      const data = await response.json();
      if (data.success) {
        toast({
          title: 'Success',
          description: 'Rule deleted successfully',
        });
        fetchRules();
      }
    } catch (error) {
      console.error('Error deleting rule:', error);
      toast({
        title: 'Error',
        description: 'Failed to delete rule',
        variant: 'destructive',
      });
    }
  };

  const handleTest = async (rule: AutoReplyRule) => {
    if (!testText.trim()) {
      toast({
        title: 'Error',
        description: 'Please enter test text',
        variant: 'destructive',
      });
      return;
    }

    try {
      const response = await fetch('/api/auto-reply/test', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          rule,
          testText,
        }),
      });

      const data = await response.json();
      if (data.success) {
        setTestResult(data);
      }
    } catch (error) {
      console.error('Error testing rule:', error);
      toast({
        title: 'Error',
        description: 'Failed to test rule',
        variant: 'destructive',
      });
    }
  };

  const resetForm = () => {
    setFormData({
      rule_name: '',
      keywords: [],
      phrases: [],
      response_template: '',
      is_active: true,
      priority: 0,
      throttle_settings: {
        max_per_hour: 10,
        max_per_day: 50,
        cooldown_minutes: 5,
      },
      match_type: 'any',
      sentiment_filter: [],
    });
  };

  const openEditDialog = (rule: AutoReplyRule) => {
    setEditingRule(rule);
    setFormData(rule);
    setIsDialogOpen(true);
  };

  const openCreateDialog = () => {
    setEditingRule(null);
    resetForm();
    setIsDialogOpen(true);
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Auto-Reply Rules</CardTitle>
          <CardDescription>Manage your automated reply rules</CardDescription>
        </CardHeader>
        <CardContent>
          <p>Loading...</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Auto-Reply Rules</CardTitle>
            <CardDescription>Manage your automated reply rules</CardDescription>
          </div>
          <Button onClick={openCreateDialog}>
            <Plus className="h-4 w-4 mr-2" />
            Create Rule
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {rules.length === 0 ? (
          <p className="text-muted-foreground">No rules created yet. Create your first rule to get started.</p>
        ) : (
          <div className="space-y-4">
            {rules.map((rule) => (
              <Card key={rule.id}>
                <CardContent className="pt-6">
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <h3 className="font-semibold">{rule.rule_name}</h3>
                        <div className="flex items-center gap-2">
                          <Switch
                            checked={rule.is_active}
                            onCheckedChange={() => handleToggleActive(rule)}
                          />
                          <Badge variant={rule.is_active ? 'default' : 'secondary'}>
                            {rule.is_active ? 'Active' : 'Inactive'}
                          </Badge>
                        </div>
                        <Badge variant="outline">Priority: {rule.priority}</Badge>
                        <Badge variant="outline">{rule.match_type === 'any' ? 'Any Match' : 'All Match'}</Badge>
                        {rule.matchCount !== undefined && (
                          <Badge variant="secondary">{rule.matchCount} matches</Badge>
                        )}
                      </div>
                      <div className="space-y-1 text-sm">
                        {rule.keywords.length > 0 && (
                          <p>
                            <span className="font-medium">Keywords:</span>{' '}
                            {rule.keywords.join(', ')}
                          </p>
                        )}
                        {rule.phrases.length > 0 && (
                          <p>
                            <span className="font-medium">Phrases:</span>{' '}
                            {rule.phrases.join(', ')}
                          </p>
                        )}
                        <p>
                          <span className="font-medium">Response:</span>{' '}
                          {rule.response_template.substring(0, 100)}
                          {rule.response_template.length > 100 ? '...' : ''}
                        </p>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Dialog>
                        <DialogTrigger asChild>
                          <Button size="sm" variant="outline" onClick={() => setTestText('')}>
                            <TestTube className="h-4 w-4 mr-2" />
                            Test
                          </Button>
                        </DialogTrigger>
                        <DialogContent>
                          <DialogHeader>
                            <DialogTitle>Test Rule</DialogTitle>
                            <DialogDescription>
                              Test how this rule matches against sample text
                            </DialogDescription>
                          </DialogHeader>
                          <div className="space-y-4">
                            <div>
                              <Label>Test Text</Label>
                              <Textarea
                                value={testText}
                                onChange={(e) => setTestText(e.target.value)}
                                placeholder="Enter text to test..."
                                rows={4}
                              />
                            </div>
                            <Button onClick={() => handleTest(rule)}>Run Test</Button>
                            {testResult && (
                              <div className="p-4 border rounded">
                                <p className="font-medium mb-2">Result:</p>
                                <p>Matched: {testResult.matched ? 'Yes' : 'No'}</p>
                                {testResult.matched && (
                                  <>
                                    <p>Confidence: {Math.round(testResult.confidence * 100)}%</p>
                                    <p>Matched Keywords: {testResult.matchedKeywords.join(', ') || 'None'}</p>
                                    <p>Matched Phrases: {testResult.matchedPhrases.join(', ') || 'None'}</p>
                                    {testResult.responseText && (
                                      <div className="mt-2">
                                        <p className="font-medium">Generated Response:</p>
                                        <p className="text-sm text-muted-foreground">{testResult.responseText}</p>
                                      </div>
                                    )}
                                  </>
                                )}
                              </div>
                            )}
                          </div>
                        </DialogContent>
                      </Dialog>
                      <Button size="sm" variant="outline" onClick={() => openEditDialog(rule)}>
                        <Edit className="h-4 w-4 mr-2" />
                        Edit
                      </Button>
                      <Button size="sm" variant="destructive" onClick={() => handleDelete(rule.id)}>
                        <Trash2 className="h-4 w-4 mr-2" />
                        Delete
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{editingRule ? 'Edit Rule' : 'Create Rule'}</DialogTitle>
              <DialogDescription>
                Configure your auto-reply rule settings
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label>Rule Name</Label>
                <Input
                  value={formData.rule_name}
                  onChange={(e) => setFormData({ ...formData, rule_name: e.target.value })}
                  placeholder="e.g., Customer Support - Urgent"
                />
              </div>
              <div>
                <Label>Keywords (comma-separated)</Label>
                <Textarea
                  value={formData.keywords?.join(', ') || ''}
                  onChange={(e) => {
                    const value = e.target.value
                    // Allow typing freely, split on blur or when saving
                    setFormData({
                      ...formData,
                      keywords: value.split(',').map(k => k.trim()).filter(Boolean),
                    })
                  }}
                  onBlur={(e) => {
                    // Ensure proper formatting on blur
                    const value = e.target.value
                    const keywords = value.split(',').map(k => k.trim()).filter(Boolean)
                    setFormData({
                      ...formData,
                      keywords,
                    })
                  }}
                  placeholder="help, support, question, issue"
                  rows={2}
                  className="font-mono text-sm"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Enter keywords separated by commas. Spaces and commas are allowed.
                </p>
              </div>
              <div>
                <Label>Phrases (comma-separated)</Label>
                <Textarea
                  value={formData.phrases?.join(', ') || ''}
                  onChange={(e) => {
                    const value = e.target.value
                    // Allow typing freely, split on blur or when saving
                    setFormData({
                      ...formData,
                      phrases: value.split(',').map(p => p.trim()).filter(Boolean),
                    })
                  }}
                  onBlur={(e) => {
                    // Ensure proper formatting on blur
                    const value = e.target.value
                    const phrases = value.split(',').map(p => p.trim()).filter(Boolean)
                    setFormData({
                      ...formData,
                      phrases,
                    })
                  }}
                  placeholder="need help, how do I, can you help"
                  rows={2}
                  className="font-mono text-sm"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Enter phrases separated by commas. Spaces and commas are allowed.
                </p>
              </div>
              <div>
                <Label>Response Template</Label>
                <Textarea
                  value={formData.response_template}
                  onChange={(e) => setFormData({ ...formData, response_template: e.target.value })}
                  placeholder="Hi {{author_username}}, thanks for reaching out! We'll get back to you soon."
                  rows={4}
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Available variables: {'{'}author_username{'}'}, {'{'}author_name{'}'}, {'{'}mention_text{'}'}
                </p>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Priority</Label>
                  <Input
                    type="number"
                    value={formData.priority}
                    onChange={(e) => setFormData({ ...formData, priority: parseInt(e.target.value) || 0 })}
                  />
                </div>
                <div>
                  <Label>Match Type</Label>
                  <Select
                    value={formData.match_type}
                    onValueChange={(value: 'any' | 'all') => setFormData({ ...formData, match_type: value })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="any">Any (OR)</SelectItem>
                      <SelectItem value="all">All (AND)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="flex items-center space-x-2">
                <Switch
                  checked={formData.is_active}
                  onCheckedChange={(checked) => setFormData({ ...formData, is_active: checked })}
                />
                <Label>Active</Label>
              </div>
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
                  Cancel
                </Button>
                <Button onClick={handleSave}>
                  {editingRule ? 'Update' : 'Create'} Rule
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
}

