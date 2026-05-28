/* global chrome */

// =============================================================================
// Popup.jsx
// =============================================================================
// this is does 4 things:
// 1. gets the saved api key from chrome storage
// 2. asks content.js for the article text from the current tab
// 3. sends that text to the gemini api
// 4. displays the summary back in the popup
// =============================================================================

// useCallback lets us memoize a function so it isn't recreated on every render.
import { useState, useCallback, useEffect } from "react";

// lucide-react gives clean, consistent svg icons as react components
import { Moon, Sun, Settings, Copy, Check, ChevronDown } from "lucide-react";

// importing css file directly here (instead of index.css) to ensure Vite bundles these styles specifically with the popup page. since each chrome extension page is isolated, global css from index.css won't apply here.
import "./Popup.css";

// =============================================================================
// GEMINI API FUNCTION
// =============================================================================
// defined outside the component so it's created once when the file loads, not re-created every time the component re-renders. it's a pure async function - it takes inputs, calls the api, and returns the summary text.
//
// parameters:
// rawText → the full article text extracted by content.js
// type → "brief", "detailed", or "bullets"
// apiKey → the user's gemini api key from chrome storage
// =============================================================================
async function getGeminiSummary(rawText, type, apiKey) {
	// gemini has token limits. sending a massive article would fail or be slow.
	// we cap the input as 20,000 characters as a safety measure.
	// if the text is longer, we slice it and add "..." to signal truncation.
	const max = 20000;
	const text = rawText.length > max ? rawText.slice(0, max) + "..." : rawText;

	// a prompt map - each key is a summary type, each value is the instruction we send to gemini.
	// template literals (backticks) let us embed the article text directly into the prompt using ${text}.
	const promptMap = {
		brief: `Summarize in 2-3 sentences:\n\n${text}`,
		detailed: `Give a detailed summary:\n\n${text}`,
		bullets: `Summarize in 5-7 bullet points (start each line with "- "):\n\n${text}`,
	};

	// lookup the prompt for the selected type.
	// the || fallback means if an unknown type somehow gets passed in, we default to brief instead of sending undefined to gemini.
	const prompt = promptMap[type] || promptMap.brief;

	// fetch() sends an HTTP request and returns a Promise.
	// await pauses execution here until the response comes back.

	// the URL includes the model name and the api key as a query parameter.
	// method: "POST" → we're sending data, not just retrieving it
	// headers → tells the server we're sending JSON
	// body → the actual data, serialized to a JSON string.
	// gemini expects the format: { contents: [{ parts: [{ text: "..." }] }] }
	const res = await fetch(
		`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
		{
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({
				contents: [{ parts: [{ text: prompt }] }],
			}),
		},
	);

	// res.ok is true if HTTP status is in the 200-299 range (success).
	// if it's false (401 unauthorized, 429 rate limit, etc.) we read the error details from the response body and throw an Error.
	// throw causes execution to jump to the catch block inside handleSummarize below.
	if (!res.ok) {
		const { error } = await res.json();
		throw new Error(error?.message || "request failed");
	}

	// parse the successful response body from JSON into a JS object.
	const data = await res.json();

	// navigate the deeply nested gemini response structure to get the text.
	// gemini returns: { candidates: [{ contents: { parts: [{ text: "..." }] } }] }

	// optional chaining (?.) means if any part of the chain is undefined or null, the whole expression returns undefined instead of throwing a crash.
	// the ?? at the end provides a fallback if the result is null or undefined.
	return data.candidates?.[0]?.content?.parts?.[0]?.text ?? "no summary.";
}

// =============================================================================
// POPUP COMPONENT
// =============================================================================
export default function Popup() {
	// =============================================================================
	// STATE
	// =============================================================================

	// controls which css class is on the root div: "dark" or "light".
	// starts as "dark" but will be overwritten by chrome.storage on mount if user previously saved a different theme preference.
	const [theme, setTheme] = useState("dark");

	// tracks which option is selected in the dropdown.
	const [summaryType, setSummaryType] = useState("brief");

	// tracks what the result area should currently display.
	// "idle" | "loading" | "done" | "error" |
	const [status, setStatus] = useState("idle");

	// the summary text returned from gemini.
	const [summary, setSummary] = useState("");

	// the error message to display when something goes wrong.
	const [errorMsg, setErrorMsg] = useState("");

	// tracks whether the copy button was just clicked.
	const [copied, setCopied] = useState(false);

	// wordCount is derived directly from the summary string rather than stored as its own piece of state.
	// summary.trim() removes leading/trialing whitespace - if the result is truthy (non-empty), we split the string on /\s+/ (any whitespace: spaces, newlines, tabs) and count the pieces with .length.
	// the ternary guards against calling .split() on an empty string, which would return [""] and give us a word count of 1 instead of 0.
	const wordCount = summary.trim() ? summary.trim().split(/\s+/).length : 0;

	// =============================================================================
	// LOADING SAVED THEME ON MOUNT
	// =============================================================================
	// useEffect with [] runs once after the first render, like DOMContentLoaded.
	// we read the saved theme from chrome.storage so the popup always opens in whatever theme the user last chose - even after closing and reopening.
	useEffect(() => {
		chrome.storage.sync.get(["theme"], ({ theme: savedTheme }) => {
			// only update if a theme was previously saved.
			// if nothing is saved, we stay on the "dark" default from useState().
			if (savedTheme) setTheme(savedTheme);
		});
	}, []);

	// =============================================================================
	// TOGGLE THEME
	// =============================================================================
	// flips the theme and saves the new value to chrome.storage.sync so:
	// 1. the popup remembers the choice next time it opens
	// 2. the options page can read the same value and match
	function toggleTheme() {
		setTheme((prev) => {
			const next = prev === "dark" ? "light" : "dark";

			// persist the new theme to chrome storage so both pages stay in sync.
			// we don't need a callback here since we're not waiting on the result.
			chrome.storage.sync.set({ theme: next });

			return next;
		});
	}

	// =============================================================================
	// OPEN OPTIONS PAGE
	// =============================================================================
	// chrome.runtime.openOptionsPage() opens the page registers as "options_page" in manifest.json.
	function openOptions() {
		// "options_page" in manifest.json registers your options page with chrome.
		// chrome.runtime.openOptionsPage() is a built-in chrome api that reads whatever file is registered under "options_page" in the manifest and opens it.
		// you don't pass a URL to openOptionsPage() - chrome already knows where to go because the manifest told it.
		// so if you changed the path in manifest.json, openOptionsPage() would automatically open the new path with no code changes needed.
		try {
			chrome.runtime.openOptionsPage();
		} catch (e) {
			console.error("could not open options page:", e);
		}
	}

	// =============================================================================
	// COPY TO CLIPBOARD
	// =============================================================================
	function handleCopy() {
		if (!summary) return;

		navigator.clipboard.writeText(summary).then(() => {
			setCopied(true);
			setTimeout(() => setCopied(false), 2000);
		});
	}

	// =============================================================================
	// SUMMARIZE
	// =============================================================================
	// useCallback memoizes this function - only re-created when summaryType changes.
	const handleSummarize = useCallback(async () => {
		setStatus("loading");
		setSummary("");
		setErrorMsg("");

		// =============================================================================
		// STEP 1: get the saved gemini api key from chrome's synced storage.
		// =============================================================================
		chrome.storage.sync.get(["geminiApiKey"], async ({ geminiApiKey }) => {
			if (!geminiApiKey) {
				setErrorMsg("no api key set. click the gear icon to add one.");
				setStatus("error");
				return;
			}

			// =============================================================================
			// STEP 2: find the active tab and ask content.js for the article text.
			// =============================================================================
			// chrome.tabs.query() finds tabs matching certain criteria.
			// { active: true, currentWindow: true } means: the tab that's currently in focus in the window the user is interacting with.
			// the result is an array of matching tabs. we destructure it as ([tab]) to pull out just the first (and only) tab directly.
			chrome.tabs.query(
				{ active: true, currentWindow: true },

				async ([tab]) => {
					// chrome.tabs.sendMessage() sends a message to the content script running inside the specified tab (tab.id)
					// argument 1: tab.id - which tab to send the message to
					// argument 2: { type: "GET_ARTICLE_TEXT" } - the message object. content.js checks req.type to know what we're asking for
					// argument 3: async callback - runs when content.js calls sendResponse(). we mark it async because inside we use await for the gemini fetch.
					chrome.tabs.sendMessage(
						// argument 1:
						tab.id,

						// argument 2:
						{ type: "GET_ARTICLE_TEXT" },

						// argument 3:
						async (response) => {
							// chrome.runtime.lastError is set by chrome if something went wrong with the message (e.g. content script not loaded, tab not ready). we also check !response in case content.js returned nothing. either way, we can't continue without a valid response
							if (chrome.runtime.lastError || !response) {
								setErrorMsg("could not connect to page. try refreshing.");
								setStatus("error");
								return;
							}

							// destructure the response object to get the text property.
							// content.js sent back { text: "...article text..." }
							const { text } = response;

							// if text is empty or falsy (content.js found no paragraphs), tell the user and stop
							if (!text) {
								setErrorMsg("couldn't extract text from this page.");
								setStatus("error");
								return;
							}

							// =============================================================================
							// STEP 3: call gemini and display the result
							// =============================================================================
							try {
								// call our async function (defined above) that hits the gemini API.
								// await pauses here until the fetch completes and we have a summary.
								// we pass the article text, the selected summary type, and the key.
								const result = await getGeminiSummary(
									text,
									summaryType,
									geminiApiKey,
								);

								setSummary(result);
								setStatus("done");
							} catch (err) {
								// if anything inside getGeminiSummary() throws an error (bad api key, network failure, etc.), catch it and display the error message instead of crashing silently
								setErrorMsg("gemini error: " + err.message);
								setStatus("error");
							}
						},
					);
				},
			);
		});
	}, [summaryType]);

	// =============================================================================
	// RENDER
	// =============================================================================
	return (
		<div className={`popup ${theme}`}>
			{/* 
      =============================================================================
      HEADER 
      =============================================================================
      */}
			<div className="popup-header">
				<div className="popup-title">
					<div className="title-dot" />
					<span className="title-text">ai summarizer</span>
				</div>

				<div className="header-icons">
					{/* button 1: change theme */}
					{/* moon/sun toggles theme and saves to chrome.storage so the options page can read and match it */}
					<button
						className="icon-btn"
						onClick={toggleTheme}
						title={
							theme === "dark" ? "switch to light mode" : "switch to dark mode"
						}
					>
						{theme === "dark" ? (
							<Sun size={15} strokeWidth={1.8} />
						) : (
							<Moon size={15} strokeWidth={1.8} />
						)}
					</button>

					{/* button 2: open settings */}
					<button className="icon-btn" onClick={openOptions} title="settings">
						{/* gear opens options/api key page */}
						<Settings size={15} strokeWidth={1.8} />
					</button>
				</div>
			</div>

			{/* 
      =============================================================================
      BODY 
      =============================================================================
      */}
			<div className="popup-body">
				{/* 
        =============================================================================
        CONTROLS ROW (dropdown + summarize button) 
        =============================================================================
        */}
				<div className="controls-row">
					{/*
          SUMMARY TYPE DROPDOWN
          select-wrap is position: relative so we can overlay the custom chevron arrow on the right side of the select.
          value={summaryType} makes this a controlled component - react owns the value, not the DOM.
          onChange fires every selection change and updates summaryType state.
          */}
					<div className="select-wrap">
						<select
							value={summaryType}
							onChange={(e) => setSummaryType(e.target.value)}
						>
							<option value="brief">brief</option>
							<option value="detailed">detailed</option>
							<option value="bullets">bullet points</option>
						</select>
						{/* 
            custom chevron overlaid on the right of the select. 
            pointer-events: none in css lets clicks pass through to the select underneath.
            */}
						<div className="select-arrow">
							<ChevronDown size={12} strokeWidth={2} />
						</div>
					</div>

					{/*
          SUMMARIZE BUTTON
          disabled while loading === true to prevent duplicate api calls.
          label swaps to "loading..." as additional feedback.
          */}
					<button
						className="summarize-btn"
						onClick={handleSummarize}
						disabled={status === "loading"}
					>
						{status === "loading" ? "loading..." : "summarize"}
					</button>
				</div>

				{/* 
        =============================================================================
        RESULT BOX
        =============================================================================
        */}
				<div className="result-box">
					{/*
          only one of these four blocks renders at a time since status can only hold one value at once:
          */}
					<div className="result-content">
						{/* IDLE - before the user has clicked "summarize" */}
						{status === "idle" && (
							<span className="result-placeholder">
								select a type and click summarize...
							</span>
						)}

						{/* LOADING - spinner animates via css while awaiting gemini */}
						{status === "loading" && (
							<div className="loading-wrap">
								<div className="spinner" />
							</div>
						)}

						{/* DONE - the summary text returned from gemini */}
						{status === "done" && (
							<span className="result-text">{summary}</span>
						)}

						{/* ERROR - message set in handleSummarize's catch/guard blocks */}
						{status === "error" && (
							<span className="result-error">{errorMsg}</span>
						)}
					</div>

					{/* 
          RESULT FOOTER 
          only mounts when status is `done` - no point showing word count or copy before there's anything to copy.
          */}
					{status === "done" && (
						<div className="result-footer">
							{/* shows the active summary type and derived word count */}
							<span className="result-meta">
								{summaryType} · {wordCount} words
							</span>

							{/*
              COPY BUTTON
              template literal flips className to "copy-btn copied" when copied is true, turning the icon and border green.
              resets after 2 seconds via setTimeout in handleCopy.
              */}
							<button
								className={`copy-btn ${copied ? "copied" : ""}`}
								onClick={handleCopy}
								title="copy to clipboard"
							>
								{/* swaps Copy icon for check icon briefly after copying */}
								{copied ? (
									<Check size={13} strokeWidth={2} />
								) : (
									<Copy size={13} strokeWidth={1.8} />
								)}
							</button>
						</div>
					)}
				</div>
			</div>
		</div>
	);
}
