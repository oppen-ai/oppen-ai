import { defineConfig } from "playwright/test";

export default defineConfig({
	testDir: "./tests",
	timeout: 30000,
	use: {
		baseURL: "http://localhost:4174",
		headless: true,
		// WebGPU flags are harmless to non-WebGPU tests but required for
		// the qrng-llm-pipeline spec which loads a real WebLLM model.
		launchOptions: {
			args: ["--enable-unsafe-webgpu", "--enable-features=Vulkan"],
		},
	},
	webServer: {
		command: "npx vite preview --port 4174",
		port: 4174,
		reuseExistingServer: false,
	},
});
