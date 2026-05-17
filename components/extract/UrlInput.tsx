"use client";

/**
 * UrlInput — glass-styled URL input + "Extract Workout" CTA.
 *
 * INPT-01: Submit via Enter key or button click.
 * INPT-02: Client-side YouTube URL validation with full inline error message,
 *          aria-invalid + aria-describedby for screen reader accessibility (UI-SPEC §14).
 * INPT-03: Tracking params stripped via parseYouTubeUrl (from Plan 01-01).
 *
 * Inline error copy (verbatim from UI-SPEC §7.1):
 *   "That doesn't look like a YouTube link. Try a URL from youtube.com or youtu.be."
 *
 * Correcting the URL clears the error (no reload required).
 */

import { useState, useRef, type KeyboardEvent } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { parseYouTubeUrl } from "@/lib/youtube/url";

interface UrlInputProps {
  onSubmit: (url: string) => void;
  isLoading: boolean;
}

const INVALID_URL_ERROR =
  "That doesn't look like a YouTube link. Try a URL from youtube.com or youtu.be.";

function validate(value: string): { isValid: boolean; cleaned: string; error?: string } {
  const parsed = parseYouTubeUrl(value.trim());
  if (!parsed.isValid) {
    return {
      isValid: false,
      cleaned: value.trim(),
      error: INVALID_URL_ERROR,
    };
  }
  return {
    isValid: true,
    cleaned: parsed.cleaned ?? value.trim(),
  };
}

export function UrlInput({ onSubmit, isLoading }: UrlInputProps) {
  const [value, setValue] = useState("");
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  function handleSubmit() {
    const result = validate(value);

    if (!result.isValid) {
      setError(result.error ?? INVALID_URL_ERROR);
      inputRef.current?.focus();
      return;
    }

    // Valid URL — clear error and submit cleaned URL (tracking params stripped via INPT-03)
    setError(null);
    onSubmit(result.cleaned);
  }

  function handleChange(newValue: string) {
    setValue(newValue);
    // Clear error as user corrects the URL (real-time validation)
    if (error) {
      const result = validate(newValue);
      if (result.isValid) {
        setError(null);
      }
    }
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
          aria-invalid={error ? "true" : undefined}
          aria-describedby={error ? "url-error" : undefined}
          value={value}
          onChange={(e) => handleChange(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={isLoading}
          className="h-12 border-0 bg-transparent text-base shadow-none focus-visible:ring-0 focus-visible:ring-offset-0"
          style={{
            color: "var(--color-text-primary)",
            backgroundColor: "transparent",
          }}
        />

        {/* Inline error message — INPT-02 full (UI-SPEC §7.1) */}
        {error && (
          <p
            id="url-error"
            role="alert"
            className="text-sm"
            style={{ color: "var(--color-destructive, #ef4444)" }}
          >
            {error}
          </p>
        )}

        {/* "Extract Workout" CTA — h-14 = 56px, large green button (UI-SPEC §2 "massive") */}
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
