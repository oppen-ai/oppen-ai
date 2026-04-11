import "./styles/variables.css";
import "./styles/reset.css";
import "./styles/backgrounds.css";
import "./styles/components.css";
import "./styles/layout.css";
import "./styles/chat.css";
import "./styles/input.css";
import "./styles/modals.css";
import "./styles/debug.css";

import { createNewChat } from "./chat";
import {
	dlog,
	initDebugPane,
	interceptConsole,
	interceptFetch,
	interceptGlobalErrors,
	setDebugEnabled,
} from "./debug";
import { detectDeviceCapabilities, hasWebGPU, hasWebLLM, loadWebLLM } from "./engine";
import { hasMemoryHash } from "./memory";
import { loadChats, loadSettings, state } from "./state";
import { registerServiceWorker } from "./sw-register";
import { applyBgTheme, applyTheme, initThemePreset, listenSystemTheme } from "./theme";
import { initInput } from "./ui/input";
import { initModals, openModal, startEngineLoad } from "./ui/modals";
import {
	buildAppShell,
	initChatListEvents,
	initChipEvents,
	initCopyEvents,
	renderChatList,
	renderMessages,
} from "./ui/renderer";
import { initSidebar } from "./ui/sidebar";

// Install interceptors early (before any other code runs)
interceptConsole();
interceptFetch();
interceptGlobalErrors();

async function init(): Promise<void> {
	try {
		dlog("info", "init", "Boot sequence started");
		dlog("info", "init", `UA: ${navigator.userAgent}`);
		dlog("info", "init", `Protocol: ${location.protocol} | Host: ${location.host}`);

		// 1. Register service worker
		registerServiceWorker();

		// 2. Load settings
		await loadSettings();
		dlog("info", "init", `Settings loaded - model: ${state.modelId}, debug: ${state.debug}`);

		// 3. Apply theme
		applyTheme(state.theme);
		applyBgTheme(state.bgTheme);
		initThemePreset();
		listenSystemTheme();

		// 4. Build app shell
		buildAppShell();
		initDebugPane();

		// 5. Enable debug if persisted (must be after DOM is built)
		setDebugEnabled(state.debug);

		// 6. Load chats and render
		await loadChats();
		const keys = Object.keys(state.chats);
		if (keys.length > 0) {
			state.chatId = keys[0];
		} else {
			createNewChat();
		}
		renderChatList();
		renderMessages();

		const chat = state.chatId ? state.chats[state.chatId] : null;
		const titleEl = document.getElementById("topbar-title");
		if (titleEl && chat) titleEl.textContent = chat.title;

		// 7. Init UI event handlers
		initInput();
		initSidebar();
		initModals();
		initChatListEvents();
		initChipEvents();
		initCopyEvents();

		// 8. WebGPU check & device capabilities
		const gpuHint = document.getElementById("webgpu-hint");
		const hasGPU = hasWebGPU();
		dlog(hasGPU ? "info" : "error", "webgpu", hasGPU ? "WebGPU available" : "WebGPU NOT available");
		if (gpuHint) {
			if (hasGPU) {
				gpuHint.textContent = "WebGPU available";
				gpuHint.style.color = "var(--success)";
			} else {
				gpuHint.textContent = "WebGPU not available - need Safari 18+ / Chrome 113+";
				gpuHint.style.color = "var(--danger)";
			}
		}

		// Detect device capabilities (mobile, GPU memory) for model recommendations
		await detectDeviceCapabilities();

		// 10. Remove splash
		const splash = document.getElementById("splash");
		if (splash) {
			splash.style.opacity = "0";
			splash.style.pointerEvents = "none";
			setTimeout(() => splash.remove(), 500);
		}

		// 11. Check for hash-based memory
		if (hasMemoryHash()) {
			openModal("password-modal");
			(document.getElementById("hash-password-input") as HTMLInputElement | null)?.focus();
		}
		window.addEventListener("hashchange", () => {
			if (hasMemoryHash()) {
				openModal("password-modal");
			}
		});

		// 12. Load WebLLM and start engine
		dlog("info", "engine", "Loading WebLLM library from CDN...");
		const llmLoaded = await loadWebLLM();
		dlog(
			llmLoaded ? "info" : "error",
			"engine",
			llmLoaded ? "WebLLM library loaded" : "WebLLM library FAILED to load",
		);

		if (hasWebLLM()) {
			dlog("info", "engine", `Starting engine with model: ${state.modelId}`);
		}
		startEngineLoad();

		dlog("info", "init", "Boot sequence complete");
	} catch (e) {
		const msg = (e as Error).message || String(e);
		dlog("error", "init", `Fatal init error: ${msg}`);
		console.error("[Oppen] Init error:", e);
	}
}

init();
