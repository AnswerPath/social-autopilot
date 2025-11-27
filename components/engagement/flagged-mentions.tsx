'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { AlertCircle, CheckCircle, XCircle, MessageSquare } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface FlaggedMention {
  id: string;
  tweet_id: string;
  author_username: string;
  author_name?: string;
  text: string;
  sentiment?: 'positive' | 'neutral' | 'negative';
  priority_score: number;
  priority_level: 'low' | 'medium' | 'high' | 'critical';
  flag_reasons: string[];
  created_at: string;
  is_replied: boolean;
}

export function FlaggedMentions() {
  const [mentions, setMentions] = useState<FlaggedMention[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedMention, setSelectedMention] = useState<FlaggedMention | null>(null);
  const [responseText, setResponseText] = useState('');
  const [responding, setResponding] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    fetchFlaggedMentions();
  }, []);

  const fetchFlaggedMentions = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/mentions/flagged?limit=50', {
        headers: {
          'x-user-id': 'demo-user', // In production, get from auth context
        },
      });

      const data = await response.json();
      if (data.success) {
        setMentions(data.mentions);
      }
    } catch (error) {
      console.error('Error fetching flagged mentions:', error);
      toast({
        title: 'Error',
        description: 'Failed to fetch flagged mentions',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleRespond = async (mention: FlaggedMention) => {
    if (!responseText.trim()) {
      toast({
        title: 'Error',
        description: 'Please enter a response',
        variant: 'destructive',
      });
      return;
    }

    try {
      setResponding(true);
      const response = await fetch(`/api/mentions/${mention.id}/respond`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-user-id': 'demo-user',
        },
        body: JSON.stringify({
          action: 'responded',
          responseText,
        }),
      });

      const data = await response.json();
      if (data.success) {
        toast({
          title: 'Success',
          description: 'Response recorded',
        });
        setResponseText('');
        setSelectedMention(null);
        fetchFlaggedMentions();
      } else {
        throw new Error(data.error);
      }
    } catch (error) {
      console.error('Error responding to mention:', error);
      toast({
        title: 'Error',
        description: 'Failed to record response',
        variant: 'destructive',
      });
    } finally {
      setResponding(false);
    }
  };

  const handleIgnore = async (mention: FlaggedMention) => {
    try {
      const response = await fetch(`/api/mentions/${mention.id}/respond`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-user-id': 'demo-user',
        },
        body: JSON.stringify({
          action: 'ignored',
        }),
      });

      const data = await response.json();
      if (data.success) {
        toast({
          title: 'Success',
          description: 'Mention marked as ignored',
        });
        fetchFlaggedMentions();
      }
    } catch (error) {
      console.error('Error ignoring mention:', error);
      toast({
        title: 'Error',
        description: 'Failed to ignore mention',
        variant: 'destructive',
      });
    }
  };

  const handleUnflag = async (mention: FlaggedMention) => {
    try {
      const response = await fetch(`/api/mentions/${mention.id}/flag`, {
        method: 'DELETE',
        headers: {
          'x-user-id': 'demo-user',
        },
      });

      const data = await response.json();
      if (data.success) {
        toast({
          title: 'Success',
          description: 'Mention unflagged',
        });
        fetchFlaggedMentions();
      }
    } catch (error) {
      console.error('Error unflagging mention:', error);
      toast({
        title: 'Error',
        description: 'Failed to unflag mention',
        variant: 'destructive',
      });
    }
  };

  const getPriorityColor = (level: string) => {
    switch (level) {
      case 'critical':
        return 'bg-red-500';
      case 'high':
        return 'bg-orange-500';
      case 'medium':
        return 'bg-yellow-500';
      default:
        return 'bg-blue-500';
    }
  };

  const getSentimentColor = (sentiment?: string) => {
    switch (sentiment) {
      case 'positive':
        return 'bg-green-500';
      case 'negative':
        return 'bg-red-500';
      default:
        return 'bg-gray-500';
    }
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Flagged Mentions</CardTitle>
          <CardDescription>Mentions requiring human attention</CardDescription>
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
        <CardTitle>Flagged Mentions</CardTitle>
        <CardDescription>
          {mentions.length} mention{mentions.length !== 1 ? 's' : ''} requiring human attention
        </CardDescription>
      </CardHeader>
      <CardContent>
        {mentions.length === 0 ? (
          <p className="text-muted-foreground">No flagged mentions at this time.</p>
        ) : (
          <div className="space-y-4">
            {mentions.map((mention) => (
              <Card key={mention.id} className="border-l-4" style={{ borderLeftColor: getPriorityColor(mention.priority_level).replace('bg-', '') }}>
                <CardContent className="pt-6">
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <span className="font-semibold">@{mention.author_username}</span>
                        {mention.author_name && (
                          <span className="text-muted-foreground">({mention.author_name})</span>
                        )}
                        <Badge className={getPriorityColor(mention.priority_level)}>
                          {mention.priority_level}
                        </Badge>
                        {mention.sentiment && (
                          <Badge variant="outline" className={getSentimentColor(mention.sentiment)}>
                            {mention.sentiment}
                          </Badge>
                        )}
                        <Badge variant="outline">Score: {mention.priority_score}</Badge>
                      </div>
                      <p className="text-sm mb-2">{mention.text}</p>
                      <div className="flex flex-wrap gap-2 mb-2">
                        {mention.flag_reasons.map((reason, idx) => (
                          <Badge key={idx} variant="secondary" className="text-xs">
                            {reason}
                          </Badge>
                        ))}
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {new Date(mention.created_at).toLocaleString()}
                      </p>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Dialog>
                      <DialogTrigger asChild>
                        <Button
                          size="sm"
                          onClick={() => setSelectedMention(mention)}
                          disabled={mention.is_replied}
                        >
                          <MessageSquare className="h-4 w-4 mr-2" />
                          Respond
                        </Button>
                      </DialogTrigger>
                      <DialogContent>
                        <DialogHeader>
                          <DialogTitle>Respond to Mention</DialogTitle>
                          <DialogDescription>
                            Reply to @{mention.author_username}
                          </DialogDescription>
                        </DialogHeader>
                        <div className="space-y-4">
                          <div>
                            <p className="text-sm font-medium mb-2">Original Mention:</p>
                            <p className="text-sm text-muted-foreground">{mention.text}</p>
                          </div>
                          <div>
                            <label className="text-sm font-medium mb-2 block">Your Response:</label>
                            <Textarea
                              value={responseText}
                              onChange={(e) => setResponseText(e.target.value)}
                              placeholder="Type your response here..."
                              rows={4}
                            />
                          </div>
                          <div className="flex justify-end gap-2">
                            <Button
                              variant="outline"
                              onClick={() => {
                                setSelectedMention(null);
                                setResponseText('');
                              }}
                            >
                              Cancel
                            </Button>
                            <Button
                              onClick={() => handleRespond(mention)}
                              disabled={responding || !responseText.trim()}
                            >
                              {responding ? 'Sending...' : 'Send Response'}
                            </Button>
                          </div>
                        </div>
                      </DialogContent>
                    </Dialog>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleIgnore(mention)}
                    >
                      <XCircle className="h-4 w-4 mr-2" />
                      Ignore
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleUnflag(mention)}
                    >
                      <CheckCircle className="h-4 w-4 mr-2" />
                      Unflag
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

