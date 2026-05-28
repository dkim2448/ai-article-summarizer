/* global chrome */

// =============================================================================
// Options.jsx - the settings/api key page for the ai summarizer extension
// =============================================================================
// this does two things:
// 1. when the page loads, check if a key is already saved and pre-fill it
// 2. when the user clicks save, store the key in chrome's synced storage
//
// it also adds:
// - show/hide toggle for the api key input (eye icon)
// - a clear button to delete the saved key
// - light/dark theme toggle that stays in sync with the popup by reading/writing to chrome.storage.sync
// =============================================================================

import { useState, useEffect } from "react";
import { Moon, Sun, Eye, EyeOff } from "lucide-react";
import "./Options.css";

export default function Options() {
	// =============================================================================
	// STATE
	// =============================================================================

	// theme starts as "dark" but gets overwritten by chrome.storage on mount.
	// same as in Popup.jsx - this is how both pages stay in sync
	const [theme, setTheme] = useState("dark");

	// the value currently in the api key input field
	const [apiKey, setApiKey] = useState("");

	// controls whether the input shows the key as plain text or **********.
	const [showKey, setShowKey] = useState(false);

	// tracks the save button state.
	// "idle" | "saving" | "saved" | "error" |
	const [saveStatus, setSaveStatus] = useState("idle");

	// =============================================================================
	// LOAD SAVED THEME AND KEY ON MOUNT
	// =============================================================================
	// useEffect with [] runs once after first render - like DOMContentLoaded.
	// we read both theme and the api key from chrome.storage in one call.
	// chrome.storage.sync.get() accepts an array of keys to fetch at once, which is more efficient than making two separate calls.
	useEffect(() => {
		chrome.storage.sync.get(
			["geminiApiKey", "theme"],

			({ geminiApiKey, theme: savedTheme }) => {
				// pre-fill the input if a key is already saved
				if (geminiApiKey) setApiKey(geminiApiKey);

				// apply the saved theme so this page matches the popup.
				// if no theme is saved yet, we stay on "dark" from useState above
				if (savedTheme) setTheme(savedTheme);
			},
		);
	}, []);

	// =============================================================================
	// TOGGLE THEME
	// =============================================================================
	// same logic as Popup.jsx - flips the theme and saves it to chrome.storage so both pages always read the same value.
	function toggleTheme() {
		setTheme((prev) => {
			const next = prev === "dark" ? "light" : "dark";
			chrome.storage.sync.set({ theme: next });
			return next;
		});
	}

	// =============================================================================
	// SAVE KEY
	// =============================================================================
	// handleSave writes the api key to chrome.storage.sync.
	// async is declared here for consistency but the chrome.storage call uses a callback rather than a promise so await isn't needed
	async function handleSave() {
		const trimmed = apiKey.trim();

		// if field is empty after trimming, show the error message and reset back to idle after 3 seconds so the user can retry.
		// return exits early so we don't attempt to save an empty string.
		if (!trimmed) {
			setSaveStatus("error");
			setTimeout(() => setSaveStatus("idle"), 3000);
			return;
		}

		// briefly flip the button to "saving..." while the write happens.
		setSaveStatus("saving");

		// chrome.storage.sync.set() writes the key to chrome's synced storage so it persists across sessions and syncs across the user's devices.
		// the callback fires once the write completed - we show the success message then reset back to idle after 2 seconds.
		chrome.storage.sync.set({ geminiApiKey: trimmed }, () => {
			setSaveStatus("saved");
			setTimeout(() => setSaveStatus("idle"), 2000);
		});
	}

	// =============================================================================
	// CLEAR KEY
	// =============================================================================
	// removes the saved key from chrome storage and clears the input field.
	function handleClear() {
		chrome.storage.sync.remove("geminiApiKey", () => {
			setApiKey("");
			setSaveStatus("idle");
		});
	}

	// =============================================================================
	// RENDER
	// =============================================================================
	return (
		<div className={`options ${theme}`}>
			{/* 
      =============================================================================
      HEADER
      =============================================================================
      */}
			<div className="options-header">
				<div className="options-title">
					<div className="title-dot" />
					<span className="title-text">ai summarizer · settings</span>
				</div>

				{/* 
        THEME TOGGLE
				reads and writes the same chrome.storage key as the popup, so toggling here also affects the popup next time it opens. 
        */}
				<button
					className="icon-btn"
					onClick={toggleTheme}
					title={
						theme === "dark" ? "switch to light mode" : "switch to dark mode"
					}
				>
					{theme === "dark" ? (
						<Sun size={20} strokeWidth={1.8} />
					) : (
						<Moon size={20} strokeWidth={1.8} />
					)}
				</button>
			</div>

			{/*
      =============================================================================
      CONTENT
      =============================================================================
      */}
			<div className="options-content">
				<p className="section-label">gemini api key</p>

				{/* 
        INPUT GROUP
        position: relative lets us position the eye button
				absolutely inside the input's right edge.
        */}
				<div className="input-group">
					{/* 
          controlled input — react owns the value via `apiKey` state.
					type switches between "password" and "text" based on showKey.
					onKeyDown lets the user press Enter to save. 
          */}
					<input
						className="api-input"
						type={showKey ? "text" : "password"}
						value={apiKey}
						onChange={(e) => setApiKey(e.target.value)}
						placeholder="paste your gemini api key here"
						onKeyDown={(e) => e.key === "Enter" && handleSave()}
					/>

					{/* 
          EYE TOGGLE — shows/hides the api key
          */}
					<button
						className="eye-btn"
						onClick={() => setShowKey((prev) => !prev)}
						title={showKey ? "hide api key" : "show api key"}
					>
						{showKey ? (
							<EyeOff size={14} strokeWidth={1.8} />
						) : (
							<Eye size={14} strokeWidth={1.8} />
						)}
					</button>
				</div>

				{/* helper link to google ai studio */}
				<p className="helper-text">
					don't have a key?{" "}
					<a
						href="https://ai.google.dev/gemini-api/docs/api-key"
						target="_blank"
						rel="noreferrer"
					>
						get one from google ai studio
					</a>
				</p>

				{/* 
        =============================================================================
        SAVE BUTTON
        =============================================================================
        */}
				<button
					className="save-btn"
					onClick={handleSave}
					disabled={saveStatus === "saving"}
				>
					{saveStatus === "saving" ? "saving..." : "save key"}
				</button>

				{/* 
        =============================================================================
        STATUS MESSAGES — only one renders at a time
        =============================================================================
        */}
				{saveStatus === "saved" && (
					<p className="status-msg success">api key saved successfully.</p>
				)}
				{saveStatus === "error" && (
					<p className="status-msg error">please enter a valid api key.</p>
				)}

				<hr className="divider" />

				<p className="danger-label">danger zone</p>

				{/* 
        =============================================================================
        CLEAR BUTTON — destructive action, outlined red style
        =============================================================================
        */}
				<button className="clear-btn" onClick={handleClear}>
					clear saved key
				</button>
			</div>
		</div>
	);
}
