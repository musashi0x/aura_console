"use client";

import { useEffect, useState, useTransition } from "react";
import { Badge } from "@astryxdesign/core/Badge";
import { HStack } from "@astryxdesign/core/Stack";
import { Token } from "@astryxdesign/core/Token";
import { ArrowRight, Clock, History, RotateCcw, Sparkles } from "lucide-react";

import { apiClient, type TemporalReputationReconstruction } from "@/lib/api-client";

export interface CounterpartyTemporalViewProps {
  counterpartyKey: string;
  initialReconstruction?: TemporalReputationReconstruction | null;
  totalEpisodes?: number;
  className?: string;
}

export function CounterpartyTemporalView({
  counterpartyKey,
  initialReconstruction,
  totalEpisodes = 1,
  className,
}: CounterpartyTemporalViewProps) {
  const [selectedEpisode, setSelectedEpisode] = useState<number>(0);
  const [reconstruction, setReconstruction] = useState<TemporalReputationReconstruction | null>(
    initialReconstruction ?? null
  );
  const [isPending, startTransition] = useTransition();

  const handleSelectEpisode = (episode: number) => {
    setSelectedEpisode(episode);
    if (episode === 0 && initialReconstruction) {
      setReconstruction(initialReconstruction);
    }
  };

  useEffect(() => {
    if (initialReconstruction && selectedEpisode === 0) {
      return;
    }

    let isMounted = true;
    startTransition(async () => {
      const data = await apiClient.getCounterpartyTemporal(counterpartyKey, selectedEpisode);
      if (isMounted && data) {
        setReconstruction(data);
      }
    });

    return () => {
      isMounted = false;
    };
  }, [counterpartyKey, selectedEpisode, initialReconstruction]);

  const maxEpisodes = Math.max(
    1,
    totalEpisodes,
    reconstruction?.currentState.episodesCount ?? 1
  );

  const delta = reconstruction?.delta;
  const historical = reconstruction?.historicalState;
  const current = reconstruction?.currentState;

  return (
    <section
      data-testid="temporal-view-container"
      aria-label="Temporal Reputation Reconstruction"
      className={`p-5 rounded-2xl bg-[var(--color-surface)] border border-[var(--color-border)] flex flex-col gap-4 ${className ?? ""}`}
    >
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[var(--color-border)] pb-3">
        <HStack gap={2} align="center">
          <History size={16} className="text-[var(--color-accent)]" />
          <span className="font-semibold text-sm text-[var(--color-text)]">
            Point-in-Time History & Time-Travel
          </span>
        </HStack>
        <HStack gap={1} align="center">
          <Sparkles size={13} className="text-[var(--color-accent)] opacity-80" />
          <span className="text-[11px] font-mono text-[var(--color-text-muted)]">
            Sibyl R3 Temporal Engine
          </span>
        </HStack>
      </div>

      {/* Episode Scrubber Controls */}
      <div className="p-4 rounded-xl bg-[var(--color-canvas)] border border-[var(--color-border)] flex flex-col gap-3">
        <div className="flex items-center justify-between gap-2 text-xs">
          <span className="font-semibold text-[var(--color-text)] flex items-center gap-1.5">
            <Clock size={13} />
            <span>Time-Travel Scrubber: Inspecting Checkpoint $t_{selectedEpisode}</span>
          </span>
          <span className="font-mono text-[11px] text-[var(--color-text-muted)]">
            {isPending ? "Reconstructing..." : `Checkpoint ${selectedEpisode} of ${maxEpisodes}`}
          </span>
        </div>

        {/* Step Buttons */}
        <div className="flex items-center gap-1.5 flex-wrap">
          {Array.from({ length: maxEpisodes + 1 }).map((_, idx) => (
            <button
              key={idx}
              type="button"
              data-testid={`checkpoint-btn-t${idx}`}
              onClick={() => handleSelectEpisode(idx)}
              className={`px-3 py-1 rounded-md text-xs font-mono transition-colors border ${
                selectedEpisode === idx
                  ? "bg-[var(--color-accent)] text-[var(--color-canvas)] border-[var(--color-accent)] font-bold"
                  : "bg-[var(--color-surface)] text-[var(--color-text-muted)] border-[var(--color-border)] hover:border-[var(--color-accent)] hover:text-[var(--color-text)]"
              }`}
            >
              $t_{idx}$
            </button>
          ))}
          {selectedEpisode !== 0 && (
            <button
              type="button"
              onClick={() => handleSelectEpisode(0)}
              className="inline-flex items-center gap-1 px-2.5 py-1 text-xs text-[var(--color-text-muted)] hover:text-[var(--color-text)]"
              title="Reset to initial prior t_0"
            >
              <RotateCcw size={12} />
              <span>Reset ($t_0$)</span>
            </button>
          )}
        </div>
      </div>

      {/* Side-by-Side Comparison */}
      {historical && current ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Past State Card */}
          <div
            data-testid="historical-state-card"
            className="p-4 rounded-xl bg-[var(--color-canvas)] border border-[var(--color-border)] flex flex-col gap-3"
          >
            <div className="flex items-center justify-between gap-2 border-b border-[var(--color-border)] pb-2">
              <span className="text-xs font-semibold text-[var(--color-text)]">
                Historical State ($t_{selectedEpisode}$)
              </span>
              <Token
                label={historical.relationshipStatus}
                size="sm"
                color={historical.relationshipStatus === "BLOCKED" ? "red" : historical.relationshipStatus === "WATCH" ? "orange" : "cyan"}
              />
            </div>
            <div className="grid grid-cols-2 gap-2 text-xs font-mono">
              <div className="flex flex-col">
                <span className="text-[11px] text-[var(--color-text-muted)]">Reliability</span>
                <span className="font-semibold text-[var(--color-text)]">
                  {(historical.overallReliability * 100).toFixed(1)}%
                </span>
              </div>
              <div className="flex flex-col">
                <span className="text-[11px] text-[var(--color-text-muted)]">Confidence</span>
                <span className="font-semibold text-[var(--color-text)]">
                  {(historical.confidence * 100).toFixed(1)}%
                </span>
              </div>
              <div className="flex flex-col">
                <span className="text-[11px] text-[var(--color-text-muted)]">Failures</span>
                <span className="font-semibold text-[var(--color-text)]">
                  {historical.consecutiveFailures}
                </span>
              </div>
              <div className="flex flex-col">
                <span className="text-[11px] text-[var(--color-text-muted)]">Missions</span>
                <span className="font-semibold text-[var(--color-text)]">
                  {historical.totalMissions}
                </span>
              </div>
            </div>
          </div>

          {/* Current State Card */}
          <div
            data-testid="current-state-card"
            className="p-4 rounded-xl bg-[var(--color-canvas)] border border-[var(--color-border)] flex flex-col gap-3"
          >
            <div className="flex items-center justify-between gap-2 border-b border-[var(--color-border)] pb-2">
              <span className="text-xs font-semibold text-[var(--color-text)]">
                Current Present State ($t_{maxEpisodes}$)
              </span>
              <Token
                label={current.relationshipStatus}
                size="sm"
                color={current.relationshipStatus === "BLOCKED" ? "red" : current.relationshipStatus === "WATCH" ? "orange" : "green"}
              />
            </div>
            <div className="grid grid-cols-2 gap-2 text-xs font-mono">
              <div className="flex flex-col">
                <span className="text-[11px] text-[var(--color-text-muted)]">Reliability</span>
                <span className="font-semibold text-[var(--color-text)]">
                  {(current.overallReliability * 100).toFixed(1)}%
                </span>
              </div>
              <div className="flex flex-col">
                <span className="text-[11px] text-[var(--color-text-muted)]">Confidence</span>
                <span className="font-semibold text-[var(--color-text)]">
                  {(current.confidence * 100).toFixed(1)}%
                </span>
              </div>
              <div className="flex flex-col">
                <span className="text-[11px] text-[var(--color-text-muted)]">Failures</span>
                <span className="font-semibold text-[var(--color-text)]">
                  {current.consecutiveFailures}
                </span>
              </div>
              <div className="flex flex-col">
                <span className="text-[11px] text-[var(--color-text-muted)]">Missions</span>
                <span className="font-semibold text-[var(--color-text)]">
                  {current.totalMissions}
                </span>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="p-4 rounded-xl bg-[var(--color-canvas)] border border-[var(--color-border)] text-xs text-[var(--color-text-muted)]">
          Loading point-in-time state reconstruction...
        </div>
      )}

      {/* Delta Row */}
      {delta && (
        <div
          data-testid="temporal-deltas-bar"
          className="p-3 rounded-xl bg-[var(--color-canvas)] border border-[var(--color-border)] flex flex-wrap items-center justify-between gap-3 text-xs font-mono"
        >
          <div className="flex items-center gap-2">
            <span className="text-[var(--color-text-muted)]">Status Delta:</span>
            <span className="font-semibold text-[var(--color-text)]">
              {delta.pastStatus}
            </span>
            <ArrowRight size={12} className="text-[var(--color-text-muted)]" />
            <span className="font-semibold text-[var(--color-text)]">
              {delta.currentStatus}
            </span>
            {delta.statusChanged && (
              <Badge variant="warning" label="Status Shifted" />
            )}
          </div>

          <div className="flex items-center gap-3">
            <span>
              Reliability Delta:{" "}
              <strong
                className={
                  delta.reliabilityDelta > 0
                    ? "text-[var(--color-success)]"
                    : delta.reliabilityDelta < 0
                    ? "text-[var(--color-error)]"
                    : "text-[var(--color-text)]"
                }
              >
                {delta.reliabilityDelta > 0 ? `+${(delta.reliabilityDelta * 100).toFixed(1)}%` : `${(delta.reliabilityDelta * 100).toFixed(1)}%`}
              </strong>
            </span>
            <span>
              Missions Delta: <strong>+{delta.missionsDelta}</strong>
            </span>
          </div>
        </div>
      )}
    </section>
  );
}

CounterpartyTemporalView.displayName = "CounterpartyTemporalView";
