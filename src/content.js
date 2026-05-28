/* global chrome */

// =============================================================================
// content.js - injected directly into every web page the user visits
// =============================================================================
// chrome automatically runs this file inside the context of each webpage, as declared in manifest.json under "content_scripts".

// because it runs inside the page, it CAN read and manipulate the page's DOM (the actual HTML) elements. but it runs in an isolated js environment - it can't access the page's own js variables, and it can't directly call most chrome extension apis (like chrome.tabs).

// its only job here: listen for a message from popup.js, extract the article text from the page's DOM, and send it back.

// =============================================================================
// STEP 1: define a function that extracts readable text from the page
// =============================================================================
function getArticleText() {
	// first, try to find an <article> html element. many blogs and news sites wrap their main content in <article> tags, which is a semantic HTML5 element specifically for self-contained content.
	const article = document.querySelector("article");

	// if an <article> element exists, return its inner text immediately.
	// .innerText gives us the visible text content of the element and all its children, stripping out HTML tags. the early return means we skip the fallback below.
	if (article) return article.innerText;

	// fallback: if no <article> element exists, grab ALL <p> (paragraph) tags.
	// this is a reasonable fallback because most article content lives in paragraph tags even when there's no wrapping <article> element.
	// document.querySelectorAll("p") returns a NodeList (not a real array), so we wrap it in Array.from() to convert it into an actual array so we can use array methods like .map() on it.
	const paragraphs = Array.from(document.querySelectorAll("p"));

	// .map() loops over each <p> element and extracts its visible text.
	// .join("\n") then combines all those strings into one big string, with a newline character between each <p>
	return paragraphs.map((p) => p.innerText).join("\n");
}

// =============================================================================
// STEP 2: listen for messages from popup.js
// =============================================================================
// chrome.runtime.onMessage.addListener() sets up a listener that fires whenever another part of the extension (like popup.js) sends a message to this content script using chrome.tabs.sendMessage().
// the callback receives three arguments:
// req → the message object sent from popup.js
// _sender → info about who sent the message (we don't need it,  so we prefix with _ by convention to signal it's unused)
// sendResponse → a function we call to send data back to popup.js
chrome.runtime.onMessage.addListener((req, _sender, sendResponse) => {
	// check if message type matches what we expect.
	// popup.js sends { type: "GET_ARTICLE_TEXT" }
	if (req.type === "GET_ARTICLE_TEXT") {
		// call our function to extract the text from the current page.
		const text = getArticleText();

		// send the extracted text back to popup.js as an object.
		// popup.js receives this as the `response` argument in its callback.
		sendResponse({ text });

		// CRITICAL: return true here.
		// by default, chrome closes the message channel as soon as this listener function finishes executing. if sendResponse() hasn't been called yet by the time the function returns, the channel is already gone and popup.js gets undefined.
		// returning true tells chrome "keep this channel open, i'll call sendResponse asynchronously." even though we call it synchronously here, this is a required safety net for the message passing to work reliably.
		return true;
	}
});
