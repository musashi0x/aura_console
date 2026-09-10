"use client";

import { HStack, VStack } from "@astryxdesign/core/Stack";
import { Text } from "@astryxdesign/core/Text";
import { Token } from "@astryxdesign/core/Token";
import { AlertCircle, CheckCircle2, FileCode, Lightbulb, Sparkles } from "lucide-react";

import type { ReflectionRecord } from "@/lib/api-client";

export interface CounterpartyReflectionsProps {
  reflections: ReflectionRecord[];
  counterpartyKey?: string;
  className?: string;
}

function getDefectCategoryColor(category: ReflectionRecord["failureCategory"]): "red" | "orange" | "cyan" {
  switch (category) {
    case "MISSING_CITATIONS":
    case "SCHEMA_VIOLATION":
    case "TIMEOUT":
      return "red";
    case "INSUFFICIENT_COMPETITORS":
    case "TEST_FAILURE":
      return "orange";
    default:
      return "cyan";
  }
}

export function CounterpartyReflections({
  reflections,
  counterpartyKey,
  className,
}: CounterpartyReflectionsProps) {
  if (!reflections || reflections.length === 0) {
    return (
      <section
        data-testid="reflections-clean-state"
        aria-label="Reflected Failure Lessons"
        className={`p-4 rounded-xl bg-[var(--color-surface)] border border-[var(--color-border)] flex items-center justify-between gap-3 ${className ?? ""}`}
      >
        <div className="flex items-center gap-2.5">
          <CheckCircle2 size={16} className="text-[var(--color-success)] flex-shrink-0" />
          <Text as="p" size="sm">
            Clean verification history: 0 defect reflections on record for {counterpartyKey ?? "this counterparty"}.
          </Text>
        </div>
        <Token label="Zero Defects" size="sm" color="green" />
      </section>
    );
  }

  return (
    <section
      data-testid="reflections-container"
      aria-label="Reflected Failure Lessons"
      className={`p-5 rounded-2xl bg-[var(--color-surface)] border border-[var(--color-border)] flex flex-col gap-4 ${className ?? ""}`}
    >
      <div className="flex items-center justify-between gap-2 border-b border-[var(--color-border)] pb-3">
        <HStack gap={2} align="center">
          <AlertCircle size={16} className="text-[var(--color-warning)]" />
          <span className="font-semibold text-sm text-[var(--color-text)]">
            Reflected Lessons & Root Causes ({reflections.length})
          </span>
        </HStack>
        <HStack gap={1} align="center">
          <Sparkles size={13} className="text-[var(--color-accent)] opacity-80" />
          <span className="text-[11px] font-mono text-[var(--color-text-muted)]">
            Sibyl R1 Reflection Engine
          </span>
        </HStack>
      </div>

      <VStack gap={3}>
        {reflections.map((item) => (
          <div
            key={item.id}
            data-testid={`reflection-card-${item.id}`}
            className="p-4 rounded-xl bg-[var(--color-canvas)] border border-[var(--color-border)] flex flex-col gap-3"
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <HStack gap={2} align="center" wrap="wrap">
                <Token
                  label={item.failureCategory}
                  size="sm"
                  color={getDefectCategoryColor(item.failureCategory)}
                />
                <span className="font-mono text-xs text-[var(--color-text-muted)]">
                  Run: {item.runId}
                </span>
              </HStack>
              <span className="font-mono text-[11px] text-[var(--color-text-muted)]">
                {new Date(item.createdAt).toLocaleString()}
              </span>
            </div>

            {/* Root Cause & Lesson */}
            <div className="flex flex-col gap-1 text-xs">
              <span className="font-semibold text-[var(--color-text)]">Root Cause:</span>
              <p className="text-[var(--color-text-muted)] leading-relaxed">{item.rootCause}</p>
            </div>

            <div className="flex flex-col gap-1 text-xs">
              <span className="font-semibold text-[var(--color-text)]">Learned Lesson:</span>
              <p className="text-[var(--color-text)] leading-relaxed italic">{item.lesson}</p>
            </div>

            {/* Schema Errors Mono Code Block */}
            {item.schemaErrors && item.schemaErrors.length > 0 && (
              <div className="flex flex-col gap-1">
                <span className="text-[11px] font-mono text-[var(--color-text-muted)] flex items-center gap-1">
                  <FileCode size={12} />
                  <span>Schema Errors:</span>
                </span>
                <div
                  data-testid="schema-errors-block"
                  className="p-3 rounded-lg bg-[var(--color-surface)] border border-[var(--color-border)] font-mono text-xs text-[var(--color-error)] overflow-x-auto max-h-40"
                >
                  {item.schemaErrors.map((err, idx) => (
                    <div key={idx} className="whitespace-pre-wrap">
                      {err}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Remediation Guidance */}
            {item.remediationGuidance && (
              <div className="flex items-start gap-2 p-2.5 rounded-lg bg-[var(--color-surface)] border border-[var(--color-border)] text-xs">
                <Lightbulb size={14} className="text-[var(--color-warning)] mt-0.5 flex-shrink-0" />
                <div className="flex flex-col gap-0.5">
                  <span className="font-semibold text-[var(--color-text)]">Remediation Guidance:</span>
                  <span className="text-[var(--color-text-muted)] leading-relaxed">
                    {item.remediationGuidance}
                  </span>
                </div>
              </div>
            )}
          </div>
        ))}
      </VStack>
    </section>
  );
}

CounterpartyReflections.displayName = "CounterpartyReflections";
