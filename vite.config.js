// vite.config.js - tells vite how to build the project

// defineConfig is just a helper that gives you autocomplete/type hints for the config object
import { defineConfig } from "vite";

// the official vite plugin that adds react support (jsx, fast refresh, etc.)
import react from "@vitejs/plugin-react";

// the crxjs plugin - this is the magic piece that makes vite understand it's building a chrome extension instead of a normal web app.
// it reads your manifest.json and automatically handles all the entry points (popup, options, background, content script) as separate bundles
import { crx } from "@crxjs/vite-plugin";

// import your manifest.json as a js object so crxjs can read it.
import manifest from "./manifest.json";

export default defineConfig({
	plugins: [
		// enables jsx and react features:
		react(),
		// hands your manifest to crxjs so it knows what to build:
		crx({ manifest }),
	],
});
