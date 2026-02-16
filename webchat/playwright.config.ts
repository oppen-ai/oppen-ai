import { defineConfig } from "playwright/test";

export default defineConfig({
	testDir: "./tests",
	timeout: 30000,
	use: {
		baseURL: "http://localhost:4174",
		headless: true,
	},
	webServer: {
		command: "npx vite preview --port 4174",
		port: 4174,
		reuseExistingServer: false,
	},
});
