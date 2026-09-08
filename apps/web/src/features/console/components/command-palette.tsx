"use client";

import { useCallback, useEffect, useId, useRef, useState, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";
import { Kbd } from "@astryxdesign/core/Kbd";
import { HStack, VStack } from "@astryxdesign/core/Stack";
import { Text } from "@astryxdesign/core/Text";

import { CONSOLE_COMMANDS, type ConsoleCommand } from "../console-commands";
import { console_ } from "../copy";
import {
  MEMORY_VIEW_SERVER_SNAPSHOT,
  getMemoryViewEnabled,
  subscribeMemoryView,
} from "../memory-view-state";

export function CommandPalette() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const opener = useRef<HTMLElement | null>(null);
  const listId = useId();
  const titleId = useId();

  const memoryOn = useSyncExternalStore(
    subscribeMemoryView,
    getMemoryViewEnabled,
    () => MEMORY_VIEW_SERVER_SNAPSHOT,
  );

  const matches = CONSOLE_COMMANDS.filter((c) =>
    c.label.toLowerCase().includes(query.trim().toLowerCase()),
  );

  const show = useCallback(() => {
    // Remember who opened it so focus has somewhere honest to return to.
    opener.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    setQuery("");
    setActive(0);
    setOpen(true);
  }, []);

  const hide = useCallback(() => {
    setOpen(false);
    // Focus must never be left on a removed node: a keyboard operator would be
    // dropped back to the top of the document with no idea where they were.
    opener.current?.focus();
  }, []);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setOpen((wasOpen) => {
          if (wasOpen) {
            opener.current?.focus();
            return false;
          }
          opener.current =
            document.activeElement instanceof HTMLElement ? document.activeElement : null;
          setQuery("");
          setActive(0);
          return true;
        });
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  const choose = (command: ConsoleCommand | undefined) => {
    if (!command) return;
    setOpen(false);
    command.run((href) => router.push(href));
  };

  const onKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === "Escape") {
      event.preventDefault();
      hide();
      return;
    }
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActive((i) => (matches.length === 0 ? 0 : (i + 1) % matches.length));
      return;
    }
    if (event.key === "ArrowUp") {
      event.preventDefault();
      setActive((i) => (matches.length === 0 ? 0 : (i - 1 + matches.length) % matches.length));
      return;
    }
    if (event.key === "Enter") {
      event.preventDefault();
      choose(matches[active]);
    }
  };

  return (
    <>
      <button
        type="button"
        className="cs__palette-trigger"
        onClick={show}
        aria-haspopup="dialog"
        aria-expanded={open}
      >
        <span className="cs__palette-text">{console_.palette.open}</span>
        {/* `mod`, not a hardcoded glyph. The handler accepts metaKey OR ctrlKey,
            so the old literal "⌘K" told a Windows or Linux operator to press a
            key their keyboard does not have, for a shortcut that works. */}
        <Kbd keys="mod+k" />
      </button>

      {open ? (
        <div className="cs__palette-scrim" onMouseDown={hide}>
          <div
            className="cs__palette"
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            onMouseDown={(event) => event.stopPropagation()}
            onKeyDown={onKeyDown}
          >
            <h2 id={titleId} className="visually-hidden">
              {console_.palette.label}
            </h2>
            <input
              ref={inputRef}
              type="text"
              className="cs__palette-input"
              placeholder={console_.palette.placeholder}
              aria-label={console_.palette.placeholder}
              aria-controls={listId}
              value={query}
              onChange={(event) => {
                setQuery(event.target.value);
                setActive(0);
              }}
            />
            <ul id={listId} className="cs__palette-list">
              {matches.length === 0 ? (
                <li className="cs__muted">{console_.palette.empty}</li>
              ) : (
                matches.map((command, index) => (
                  <li key={command.id}>
                    <button
                      type="button"
                      className="cs__palette-item"
                      data-active={index === active ? "true" : undefined}
                      onClick={() => choose(command)}
                      onMouseEnter={() => setActive(index)}
                    >
                      <span>{command.label}</span>
                      <span className="cs__palette-group">
                        {command.id === "memory"
                          ? memoryOn
                            ? console_.memoryView.on
                            : console_.memoryView.off
                          : command.group}
                      </span>
                    </button>
                  </li>
                ))
              )}
            </ul>
            {/* Only the keys this palette actually binds: mod+k, Escape,
                Arrow Up/Down and Enter. A shortcut listed here that does
                nothing is the same defect as a control that does nothing. */}
            <VStack gap={1}>
              <HStack gap={1} align="center" wrap="wrap">
                <Text as="span" size="xsm" color="secondary">
                  {console_.palette.keys.navigate}
                </Text>
                <Kbd keys="up" />
                <Kbd keys="down" />
                <Text as="span" size="xsm" color="secondary">
                  {console_.palette.keys.select}
                </Text>
                <Kbd keys="enter" />
                <Text as="span" size="xsm" color="secondary">
                  {console_.palette.keys.close}
                </Text>
                <Kbd keys="escape" />
              </HStack>
              <p className="cs__palette-foot">{console_.palette.readOnly}</p>
            </VStack>
          </div>
        </div>
      ) : null}
    </>
  );
}
