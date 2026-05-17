"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { HeartIcon, RefreshCcwIcon, XIcon } from "lucide-react";

import { getCandidates, recordSwipe } from "@/app/actions/swipe.actions";
import type { ActionData } from "@/components/app/action-data";
import { EmptyState } from "@/components/app/empty-state";
import { LoadingSpinner } from "@/components/app/loading-spinner";
import { Modal } from "@/components/app/modal";
import { UserCard } from "@/components/app/user-card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type Candidate = ActionData<typeof getCandidates>[number];

const swipeThreshold = 120;

export function DiscoverBoard() {
  const router = useRouter();
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeMatchName, setActiveMatchName] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const dragStartX = useRef<number | null>(null);
  const [dragOffsetX, setDragOffsetX] = useState(0);

  const activeCandidate = candidates[0] ?? null;
  const previewCandidates = useMemo(() => candidates.slice(0, 3), [candidates]);

  async function loadCandidates() {
    setIsLoading(true);
    setError(null);
    const result = await getCandidates();

    if (!result.success) {
      setError(result.error);
      setCandidates([]);
      setIsLoading(false);
      return;
    }

    setCandidates(result.data);
    setIsLoading(false);
  }

  useEffect(() => {
    let cancelled = false;

    async function bootstrap() {
      setIsLoading(true);
      setError(null);
      const result = await getCandidates();

      if (cancelled) {
        return;
      }

      if (!result.success) {
        setError(result.error);
        setCandidates([]);
        setIsLoading(false);
        return;
      }

      setCandidates(result.data);
      setIsLoading(false);
    }

    void bootstrap();

    return () => {
      cancelled = true;
    };
  }, []);

  async function handleSwipe(direction: "like" | "pass") {
    if (!activeCandidate) {
      return;
    }

    setError(null);

    const swipedCandidate = activeCandidate;

    // Optimistically remove the candidate from the stack
    setCandidates((currentCandidates) => currentCandidates.slice(1));
    setDragOffsetX(0);

    startTransition(async () => {
      const result = await recordSwipe({
        targetId: swipedCandidate.userId,
        direction,
      });

      if (!result.success) {
        setError(result.error);
        // Revert the optimistic update on error
        setCandidates((currentCandidates) => [swipedCandidate, ...currentCandidates]);
        return;
      }

      if (result.data.matched) {
        setActiveMatchName(swipedCandidate.name);
      }
    });
  }

  function finishDrag() {
    if (dragOffsetX >= swipeThreshold) {
      void handleSwipe("like");
    } else if (dragOffsetX <= -swipeThreshold) {
      void handleSwipe("pass");
    } else {
      setDragOffsetX(0);
    }

    dragStartX.current = null;
  }

  if (isLoading) {
    return <LoadingSpinner className="py-20" label="Ranking candidates..." />;
  }

  return (
    <div className="space-y-6">
      {error ? (
        <Alert variant="destructive">
          <AlertTitle>Couldn&apos;t load discover</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}

      {previewCandidates.length === 0 ? (
        <EmptyState
          icon={RefreshCcwIcon}
          title="No more candidates right now"
          description="You’ve worked through the current queue. Check back after more students finish onboarding or once new matches enter the pool."
          actionLabel="Refresh Queue"
          onAction={() => {
            void loadCandidates();
          }}
        />
      ) : (
        <>
          <div className="relative mx-auto min-h-[36rem] max-w-4xl mb-56 md:mb-12">
            {previewCandidates
              .slice()
              .reverse()
              .map((candidate, reverseIndex) => {
                const visualIndex = previewCandidates.length - reverseIndex - 1;
                const isTopCard = visualIndex === 0;
                const translateY = visualIndex * 18;
                const scale = 1 - visualIndex * 0.03;

                return (
                  <div
                    key={candidate.userId}
                    className={cn(
                      "absolute inset-x-0 top-0 origin-top select-none touch-none",
                      dragStartX.current === null && "transition-transform duration-200"
                    )}
                    style={{
                      transform: `translateY(${translateY}px) scale(${scale}) ${
                        isTopCard ? `translateX(${dragOffsetX}px) rotate(${dragOffsetX / 20}deg)` : ""
                      }`,
                      zIndex: 20 - visualIndex,
                      opacity: 1,
                    }}
                    onPointerDown={
                      isTopCard
                        ? (event) => {
                            event.currentTarget.setPointerCapture(event.pointerId);
                            dragStartX.current = event.clientX;
                          }
                        : undefined
                    }
                    onPointerMove={
                      isTopCard
                        ? (event) => {
                            if (dragStartX.current === null) return;
                            setDragOffsetX(event.clientX - dragStartX.current);
                          }
                        : undefined
                    }
                    onPointerUp={
                      isTopCard
                        ? (event) => {
                            event.currentTarget.releasePointerCapture(event.pointerId);
                            finishDrag();
                          }
                        : undefined
                    }
                    onPointerCancel={
                      isTopCard
                        ? (event) => {
                            event.currentTarget.releasePointerCapture(event.pointerId);
                            finishDrag();
                          }
                        : undefined
                    }
                  >
                    <UserCard {...candidate} />
                  </div>
                );
              })}
          </div>

          <div className="fixed bottom-0 left-0 right-0 z-50 flex items-center justify-center gap-4 border-t border-border/80 bg-background/80 p-4 backdrop-blur md:static md:z-auto md:border-none md:bg-transparent md:p-0">
            <Button className="flex-1 md:flex-none" variant="outline" size="lg" disabled={!activeCandidate} onClick={() => void handleSwipe("pass")}>
              <XIcon />
              Pass
            </Button>
            <Button className="flex-1 md:flex-none" size="lg" disabled={!activeCandidate} onClick={() => void handleSwipe("like")}>
              <HeartIcon />
              Like
            </Button>
          </div>
        </>
      )}

      <Modal
        open={Boolean(activeMatchName)}
        onClose={() => setActiveMatchName(null)}
        title="It’s a match!"
        description={
          activeMatchName
            ? `You and ${activeMatchName} are compatible. Open your matches to create a group and start planning.`
            : undefined
        }
        footer={
          <div className="flex flex-col gap-3 sm:flex-row sm:justify-end">
            <Button variant="outline" onClick={() => setActiveMatchName(null)}>
              Keep Swiping
            </Button>
            <Button
              onClick={() => {
                setActiveMatchName(null);
                router.push("/matches");
              }}
            >
              View Matches
            </Button>
          </div>
        }
      >
        <div className="space-y-3">
          <p className="text-sm leading-7 text-muted-foreground">
            Mutual likes create matches automatically. From there you can create a group, invite the
            matched peer in directly, and move into tasks or session logs.
          </p>
        </div>
      </Modal>
    </div>
  );
}
