"use client";

/**
 * UrlInput — glass-styled URL input + "Extract Workout" CTA.
 *
 * INPT-01: Submit via Enter key or button click.
 * INPT-02: Client-side YouTube URL validation with inline error message.
 * INPT-03: Tracking params stripped via parseYouTubeUrl (from Plan 01-01).
 */

import { useState, useRef, type KeyboardEvent } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { parseYouTubeUrl } from "@/lib/youtube/url";

interface UrlInputProps {
  onSubmit: (url: string) => void;
  isLoading: boolean;
}

export function UrlInput({ onSubmit, isLoading }: UrlInputProps) {
  const [value, setValue] = useState("");
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  function handleSubmit() {
    const trimmed = value.trim();
    const parsed = parseYouTubeUrl(trimmed);

    if (!parsed.isValid) {
      setError("Please enter a valid YouTube URL");
      inputRef.current?.focus();
      return;
    }

    setError(null);
    // INPT-03: cleaned URL has tracking params stripped via parseYouTubeUrl
    const cleaned = parsed.cleaned ?? trimmed;
    onSubmit(cleaned);
  }

  function handleKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter") {
      handleSubmit();
    }
  }

  return (
    <div className="w-full space-y-4">
      {/* Glass-styled input frame (UI-SPEC §5.2) */}
      <div className="glass-card flex flex-col gap-4 px-6 py-6">
        <Input
          ref={inputRef}
          type="url"
          placeholder="Paste a YouTube workout video URL"
          aria-label="YouTube video URL"
          value={value}
          onChange={(e) => {
            setValue(e.target.value);
            // Clear error on change
            if (error) setError(null);
          }}
          onKeyDown={handleKeyDown}
          disabled={isLoading}
          className="h-12 border-0 bg-transparent text-base shadow-none focus-visible:ring-0 focus-visible:ring-offset-0"
          style={{
            color: "var(--color-text-primary)",
            backgroundColor: "transparent",
          }}
        />

        {/* Error message — INPT-02 minimal */}
        {error && (
          <p
            className="text-sm"
            style={{ color: "var(--color-destructive-custom)" }}
            role="alert"
          >
            {error}
          </p>
        )}

        {/* "Extract Workout" CTA — h-14 = 56px, large green button */}
        <Button
          size="lg"
          className="h-14 w-full text-base font-semibold"
          style={{
            backgroundColor: "var(--color-accent)",
            color: "var(--color-bg-base)",
          }}
          onClick={handleSubmit}
          disabled={isLoading}
        >
          {isLoading ? "Extracting…" : "Extract Workout"}
        </Button>
      </div>
    </div>
  );
}
