// svelte.config.js
import { vitePreprocess } from "@sveltejs/vite-plugin-svelte";

export default {
	preprocess: [
		vitePreprocess({
			sourceMap: process.env.NODE_ENV !== "production",
			script: true,
			postcss: true,
		}),
	],
};
