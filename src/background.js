/* global chrome */

// =============================================================================
// background.js - the extension's service worker (background brain)
// =============================================================================
// this file runs in the background, completely separate from any web page or popup. it can't touch the DOM of any tab. its job here is simple: when the extension is first installed, check if the user has an api key saved. if not, open the options page so they can add one.

// a service worker is event-driven - it wakes up when something happens, does its job, then goes back to sleep. it doesn't run continuously.

// chrome.runtime.onInstalled fires once when the extension is:
// - installed for the first time
// - updated to a new version
// - chrome is updated (with the extension already installed)

// we attach a listener (a callback function) that runs when this event fires.
chrome.runtime.onInstalled.addListener(() => {
	// chrome.storage.sync.get() reads saved data from chrome's synced storage.
	// synced storage means the data follows the user across devices if they're signed into Chrome.

	// first argument: ["geminiApiKey"] - an array of keys we want to retrieve (we're requesting only one key)
	// second argument: a callback that receives an object with those keys.
	// ({ geminiApiKey }) - we destructure the result object right in the parameter to pull out just the geminiApiKey value directly
	chrome.storage.sync.get(["geminiApiKey"], ({ geminiApiKey }) => {
		// if geminiApiKey is falsy (undefined, empty string, null, etc.), the user hasn't saved an api key yet.
		if (!geminiApiKey) {
			// open a new tab pointing to options.html so the user can enter their gemini api key before trying to use the extension.
			// options.html is a file inside the extension's own directory.
			chrome.tabs.create({ url: "src/options/options.html" });
		}
	});
});
