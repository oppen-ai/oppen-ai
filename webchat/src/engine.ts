import { dlog } from "./debug";
import type { MLCEngine, ProgressReport } from "./types";
import { showToast } from "./ui/toast";

// biome-ignore lint/suspicious/noExplicitAny: WebLLM is dynamically imported from CDN
let webllm: any = null;

export interface ModelInfo {
	id: string;
	label: string;
	vramMB: number;
	mobileSafe: boolean;
	contextWindow: number;
}

export const CONTEXT_OPTIONS = [1024, 2048, 4096] as const;
export type ContextSize = (typeof CONTEXT_OPTIONS)[number];

export const MODELS: ModelInfo[] = [
	// Mobile-safe (< 600 MB VRAM)
	{ id: "SmolLM2-135M-Instruct-q0f32-MLC", label: "SmolLM2 135M", vramMB: 270, mobileSafe: true, contextWindow: 4096 },
	{ id: "SmolLM2-360M-Instruct-q4f16_1-MLC", label: "SmolLM2 360M", vramMB: 376, mobileSafe: true, contextWindow: 4096 },
	{ id: "SmolLM2-360M-Instruct-q4f32_1-MLC", label: "SmolLM2 360M (f32)", vramMB: 580, mobileSafe: true, contextWindow: 4096 },
	{ id: "Qwen2.5-0.5B-Instruct-q4f16_1-MLC", label: "Qwen2.5 0.5B", vramMB: 400, mobileSafe: true, contextWindow: 4096 },
	{ id: "Qwen2.5-0.5B-Instruct-q4f32_1-MLC", label: "Qwen2.5 0.5B (f32)", vramMB: 500, mobileSafe: true, contextWindow: 4096 },
	// Desktop - medium (1-2 GB)
	{ id: "Llama-3.2-1B-Instruct-q4f16_1-MLC", label: "Llama 3.2 1B", vramMB: 879, mobileSafe: false, contextWindow: 4096 },
	{ id: "Llama-3.2-1B-Instruct-q4f32_1-MLC", label: "Llama 3.2 1B (f32)", vramMB: 1129, mobileSafe: false, contextWindow: 4096 },
	{ id: "SmolLM2-1.7B-Instruct-q4f16_1-MLC", label: "SmolLM2 1.7B", vramMB: 1774, mobileSafe: false, contextWindow: 4096 },
	{ id: "Qwen2.5-1.5B-Instruct-q4f16_1-MLC", label: "Qwen2.5 1.5B", vramMB: 1630, mobileSafe: false, contextWindow: 4096 },
	{ id: "Qwen2.5-1.5B-Instruct-q4f32_1-MLC", label: "Qwen2.5 1.5B (f32)", vramMB: 1889, mobileSafe: false, contextWindow: 4096 },
	// Desktop - large (2-3 GB)
	{ id: "Llama-3.2-3B-Instruct-q4f16_1-MLC", label: "Llama 3.2 3B", vramMB: 2264, mobileSafe: false, contextWindow: 4096 },
	{ id: "Qwen2.5-3B-Instruct-q4f16_1-MLC", label: "Qwen2.5 3B", vramMB: 2505, mobileSafe: false, contextWindow: 4096 },
	// Desktop - extra large (5+ GB)
	{ id: "Qwen2.5-7B-Instruct-q4f16_1-MLC", label: "Qwen2.5 7B", vramMB: 5107, mobileSafe: false, contextWindow: 4096 },
];

let detectedMobile = false;
let detectedMaxBufferMB = 0;

export function isMobileDevice(): boolean {
	return detectedMobile;
}

export function getMaxBufferMB(): number {
	return detectedMaxBufferMB;
}

export async function detectDeviceCapabilities(): Promise<void> {
	detectedMobile =
		/iPhone|iPad|iPod|Android/i.test(navigator.userAgent) ||
		(navigator.maxTouchPoints > 1 && window.innerWidth < 1024);
	dlog("info", "device", `Mobile: ${detectedMobile}, screen: ${window.innerWidth}x${window.innerHeight}`);

	if (!hasWebGPU()) return;
	try {
		// biome-ignore lint/suspicious/noExplicitAny: WebGPU types not in default TS lib
		const gpu = (navigator as any).gpu;
		const adapter = await gpu.requestAdapter();
		if (adapter) {
			detectedMaxBufferMB = Math.round(adapter.limits.maxBufferSize / 1024 / 1024);
			dlog("info", "device", `GPU max buffer: ${detectedMaxBufferMB} MB`);
		}
	} catch (e) {
		dlog("warn", "device", `GPU capability detection failed: ${(e as Error).message}`);
	}
}

const CDN_URLS = [
	"https://cdn.jsdelivr.net/npm/@mlc-ai/web-llm@0.2.80/+esm",
	"https://esm.sh/@mlc-ai/web-llm@0.2.80",
];

export async function loadWebLLM(): Promise<boolean> {
	for (const url of CDN_URLS) {
		try {
			dlog("network", "webllm", `Importing from ${url}`);
			webllm = await import(/* @vite-ignore */ url);
			dlog("info", "webllm", `Loaded successfully from ${url}`);
			return true;
		} catch (e) {
			dlog("error", "webllm", `CDN fail: ${url} - ${(e as Error).message}`);
		}
	}
	return false;
}

export function hasWebGPU(): boolean {
	return "gpu" in navigator;
}

export function hasWebLLM(): boolean {
	return webllm !== null;
}

export interface EngineCallbacks {
	onProgress: (report: ProgressReport) => void;
	onStatusText: (text: string) => void;
	onDiagnosticError: (lines: string[]) => void;
	onReady: (engine: MLCEngine) => void;
	onError: (lines: string[]) => void;
}

export async function initEngine(modelId: string, callbacks: EngineCallbacks): Promise<void> {
	// Diagnostic 1: Protocol check
	if (location.protocol === "file:") {
		dlog("error", "engine", "Cannot load from file:// protocol");
		callbacks.onDiagnosticError([
			"Cannot load models from file:// protocol.",
			"Please serve via HTTP: npx serve . or python3 -m http.server",
		]);
		return;
	}

	// Diagnostic 2: WebGPU check
	if (!hasWebGPU()) {
		dlog("error", "engine", "WebGPU not available");
		callbacks.onDiagnosticError([
			"WebGPU is not available in this browser.",
			"Need Safari 18+, Chrome 113+, or Edge 113+.",
		]);
		return;
	}

	// Diagnostic 3: Library check
	if (!hasWebLLM()) {
		dlog("error", "engine", "WebLLM library not loaded");
		callbacks.onDiagnosticError([
			"AI library failed to load.",
			"Check your internet connection and refresh.",
		]);
		return;
	}

	// Diagnostic 4: HuggingFace connectivity
	callbacks.onStatusText("Testing connection to model server...");
	const testUrl = `https://huggingface.co/api/models/mlc-ai/${modelId}`;
	dlog("network", "engine", `Preflight check: ${testUrl}`);
	try {
		const resp = await fetch(testUrl, { method: "HEAD", mode: "cors" });
		if (!resp.ok) {
			dlog("warn", "engine", `HuggingFace preflight: HTTP ${resp.status}`);
		} else {
			dlog("info", "engine", "HuggingFace connectivity OK");
		}
	} catch (err) {
		const msg = (err as Error).message || String(err);
		dlog("error", "engine", `HuggingFace connectivity FAILED: ${msg}`);
		callbacks.onDiagnosticError([
			"Cannot reach model server (huggingface.co).",
			"",
			"Possible fixes:",
			"Check if a content blocker is active",
			"Try opening https://huggingface.co in a new tab",
			"On Safari: disable 'Prevent cross-site tracking'",
			"",
			`Error: ${msg}`,
		]);
		return;
	}

	// Diagnostic 5: Test model file fetch (catches CSP/CORS/redirect issues)
	const configUrl = `https://huggingface.co/mlc-ai/${modelId}/resolve/main/mlc-chat-config.json`;
	dlog("network", "engine", `Testing model config fetch: ${configUrl}`);
	try {
		const configResp = await fetch(configUrl, { mode: "cors" });
		if (configResp.ok) {
			dlog("info", "engine", `Model config fetch OK (${configResp.status}), final URL reachable`);
		} else {
			dlog("warn", "engine", `Model config fetch HTTP ${configResp.status}: ${configResp.statusText}`);
		}
	} catch (err) {
		const msg = (err as Error).message || String(err);
		dlog("error", "engine", `Model config fetch FAILED: ${msg}`);
		dlog("error", "engine", "This likely means CSP, CORS, or a content blocker is preventing model downloads");
	}

	// Load engine
	callbacks.onStatusText("Getting your AI ready...");
	dlog("info", "engine", `Creating MLCEngine and loading model: ${modelId}`);
	try {
		const engine = new webllm.MLCEngine() as MLCEngine;
		engine.setInitProgressCallback((report: ProgressReport) => {
			callbacks.onProgress(report);
			if (report.text) {
				dlog("debug", "engine", report.text);
			}
		});
		await engine.reload(modelId);
		dlog("info", "engine", "Model loaded successfully - ready to chat");
		callbacks.onReady(engine);
		showToast("Model loaded - ready to chat");
	} catch (e) {
		const msg = (e as Error).message || String(e);
		const stack = (e as Error).stack || "";
		dlog("error", "engine", `Engine load failed: ${msg}`);
		if (stack && stack !== msg) {
			dlog("debug", "engine", `Stack: ${stack.slice(0, 500)}`);
		}
		const lines = ["Something went wrong loading the model.", ""];
		if (modelId.includes("f16")) {
			lines.push("This model needs special GPU support. Try a different model in Settings.");
		}
		if (msg.includes("memory") || msg.includes("OOM")) {
			lines.push("Not enough GPU memory. Try a smaller model.");
		}
		if (msg.includes("CSP") || msg.includes("Content Security Policy") || msg.includes("blocked")) {
			lines.push("A browser security policy blocked a required resource.");
		}
		if (msg.includes("wasm") || msg.includes("WebAssembly")) {
			lines.push("WebAssembly failed - this may be a browser compatibility issue.");
		}
		lines.push("", `Detail: ${msg}`);
		if (stack && stack !== msg) {
			lines.push("", stack.slice(0, 500));
		}
		callbacks.onError(lines);
	}
}

export async function streamChat(
	engine: MLCEngine,
	messages: { role: string; content: string }[],
	onChunk: (fullText: string) => void,
): Promise<string> {
	let full = "";
	const chunks = await engine.chat.completions.create({
		messages,
		stream: true,
		max_tokens: 1024,
		temperature: 0.7,
		top_p: 0.9,
	});
	for await (const chunk of chunks) {
		full += chunk.choices[0]?.delta?.content || "";
		onChunk(full);
	}
	return full;
}
