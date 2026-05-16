"use client";

import { useState } from "react";
import { HandshakeIcon } from "lucide-react";

import { getMyMatches } from "@/app/actions/match.actions";
import type { ActionData } from "@/components/app/action-data";
import { CreateGroupModal } from "@/components/app/create-group-modal";
import { EmptyState } from "@/components/app/empty-state";
import { SkillBadge } from "@/components/app/skill-badge";
import { UserAvatar } from "@/components/app/user-avatar";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type MatchItem = ActionData<typeof getMyMatches>[number];

interface MatchesPanelProps {
  initialMatches: MatchItem[];
  initialError?: string | null;
}

export function MatchesPanel({ initialMatches, initialError = null }: MatchesPanelProps) {
  const [selectedMatch, setSelectedMatch] = useState<MatchItem | null>(null);

  return (
    <div className="space-y-6">
      {initialError ? (
        <Alert variant="destructive">
          <AlertTitle>Couldn&apos;t load matches</AlertTitle>
          <AlertDescription>{initialError}</AlertDescription>
        </Alert>
      ) : null}

      {initialMatches.length === 0 ? (
        <EmptyState
          icon={HandshakeIcon}
          title="No mutual matches yet"
          description="When someone you liked also likes you back, they’ll land here with their compatibility score and profile summary."
        />
      ) : (
        <div className="grid gap-5">
          {initialMatches.map((match) => (
            <Card key={match.matchId} className="surface-panel py-0">
              <CardHeader className="border-b border-border/80 py-6">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                  <div className="flex items-center gap-4">
                    <UserAvatar name={match.peer.name} avatarUrl={match.peer.avatarUrl} className="size-14" />
                    <div>
                      <p className="section-kicker">Mutual Match</p>
                      <CardTitle className="text-3xl">{match.peer.name}</CardTitle>
                      <p className="mt-2 max-w-2xl text-sm leading-7 text-muted-foreground">
                        {match.peer.bio ?? "No bio shared yet."}
                      </p>
                    </div>
                  </div>
                  <Badge variant="secondary" className="border border-primary/15 px-3 py-2 text-primary">
                    {Math.round(match.compatibilityScore * 100)}% compatibility
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-6 py-6">
                <div className="flex flex-wrap gap-3">
                  {match.peer.skills.map((skill) => (
                    <SkillBadge key={`${match.matchId}-${skill.name}`} {...skill} />
                  ))}
                </div>
                <div className="flex justify-end">
                  <Button onClick={() => setSelectedMatch(match)}>Create Group</Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <CreateGroupModal
        open={Boolean(selectedMatch)}
        onClose={() => setSelectedMatch(null)}
        invitedUserIds={selectedMatch ? [selectedMatch.peer.userId] : []}
        defaultName={selectedMatch ? `${selectedMatch.peer.name.split(" ")[0]} + Me` : ""}
      />
    </div>
  );
}
