import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { NewRunPromptSuggestions } from "./new-run-prompt-suggestions";
import { MISSION_TEMPLATES } from "../model/draft-run-store";

describe("NewRunPromptSuggestions", () => {
  it("renders prompt templates and tips", () => {
    const onSelect = vi.fn();
    render(<NewRunPromptSuggestions onSelect={onSelect} />);

    expect(screen.getByText("Prompt Templates & Objectives")).toBeInTheDocument();
    expect(screen.getByText("TIPS FOR EFFECTIVE PROMPTS")).toBeInTheDocument();

    for (const template of MISSION_TEMPLATES) {
      expect(screen.getByText(template.title)).toBeInTheDocument();
    }
  });

  it("calls onSelect when a template card is clicked", async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();
    render(<NewRunPromptSuggestions onSelect={onSelect} />);

    const first = MISSION_TEMPLATES[0]!;
    const button = screen.getByRole("button", { name: first.title });
    await user.click(button);

    expect(onSelect).toHaveBeenCalledWith(first);
  });
});
