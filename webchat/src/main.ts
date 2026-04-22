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
import { configureQrng } from "./qrng";
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
		configureQrng({
			enabled: state.qrngEnabled,
			mode: state.qrngMode,
			proxyUrl: state.qrngProxyUrl,
		});

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
		initModeIndicators();

		// 8. WebGPU check & device capabilities
		const hasGPU = hasWebGPU();
		dlog(hasGPU ? "info" : "error", "webgpu", hasGPU ? "WebGPU available" : "WebGPU NOT available");
		const gpuIndicator = document.getElementById("gpu-indicator");
		const gpuPopover = document.getElementById("gpu-popover");
		if (gpuIndicator && gpuPopover) {
			if (!hasGPU) {
				gpuIndicator.classList.add("gpu-missing");
				gpuPopover.textContent =
					"WebGPU not available in this browser. The chat cannot run on-device. Need Safari 18+, Chrome 113+, or Edge 113+.";
			} else {
				gpuPopover.textContent =
					"GPU accelerator in use. The chat runs entirely on your device via WebGPU - no servers see your messages.";
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
		// Test-only escape hatch: ?noengine=1 skips model load so UI tests
		// that don't need the LLM don't race with a slow download. Only
		// recognized when on localhost to avoid surprising prod users.
		const skipEngine =
			new URLSearchParams(location.search).get("noengine") === "1" &&
			(location.hostname === "localhost" || location.hostname === "127.0.0.1");

		if (skipEngine) {
			dlog("info", "engine", "?noengine=1 on localhost - skipping WebLLM load for UI-only tests");
		} else {
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
		}

		dlog("info", "init", "Boot sequence complete");
	} catch (e) {
		const msg = (e as Error).message || String(e);
		dlog("error", "init", `Fatal init error: ${msg}`);
		console.error("[Oppen] Init error:", e);
	}
}

/**
 * Status-strip icons (GPU, brain, atom). Clicking opens a popover with a
 * description and, for brain/atom, controls to toggle that mode on/off
 * without leaving the chat. Clicking outside dismisses any open popover.
 */
function initModeIndicators(): void {
	const indicators = document.querySelectorAll<HTMLElement>(".mode-indicator");
	for (const el of indicators) {
		el.addEventListener("click", (e) => {
			e.stopPropagation();
			const popover = el.querySelector(".mode-popover") as HTMLElement | null;
			if (!popover) return;
			const wasHidden = popover.hasAttribute("hidden");
			for (const other of document.querySelectorAll<HTMLElement>(".mode-popover")) {
				if (other !== popover) other.setAttribute("hidden", "");
			}
			if (wasHidden) popover.removeAttribute("hidden");
			else popover.setAttribute("hidden", "");
		});
	}

	// Clicks INSIDE a popover should not bubble up to the document handler
	// (which closes popovers) and should not re-toggle the parent indicator.
	for (const popover of document.querySelectorAll<HTMLElement>(".mode-popover")) {
		popover.addEventListener("click", (e) => e.stopPropagation());
	}

	document.addEventListener("click", () => {
		for (const other of document.querySelectorAll<HTMLElement>(".mode-popover")) {
			other.setAttribute("hidden", "");
		}
	});

	// QRNG enable/disable toggle in the atom popover
	const qrngToggle = document.getElementById("qrng-popover-toggle") as HTMLInputElement | null;
	qrngToggle?.addEventListener("change", async () => {
		const { configureQrng } = await import("./qrng");
		const { saveSettings, state } = await import("./state");
		state.qrngEnabled = qrngToggle.checked;
		await saveSettings();
		configureQrng({
			enabled: state.qrngEnabled,
			mode: state.qrngMode,
			proxyUrl: state.qrngProxyUrl,
		});
	});

	// Memory enable/disable toggle in the brain popover.
	// - Toggle ON when no memory: opens the memory modal so the user can paste
	//   an encrypted URL. If they cancel, updateMemoryIndicator() flips the
	//   toggle back off automatically.
	// - Toggle OFF when memory loaded: clears the active memory immediately.
	const memoryToggle = document.getElementById("memory-popover-toggle") as HTMLInputElement | null;
	memoryToggle?.addEventListener("change", async () => {
		const wantOn = memoryToggle.checked;
		const { state } = await import("./state");
		const isOn = !!state.memory;
		if (wantOn === isOn) return;
		if (!wantOn) {
			const { clearActiveMemory } = await import("./memory");
			await clearActiveMemory();
		} else {
			const { openMemoryModal } = await import("./ui/modals");
			openMemoryModal();
			// switch to Load tab if the modal exposes it
			document.getElementById("tab-load")?.click();
			// Optimistic toggle is already on; updateMemoryIndicator will
			// re-sync once load succeeds (or stays off if user cancels).
			const { updateMemoryIndicator } = await import("./memory");
			updateMemoryIndicator();
		}
		for (const p of document.querySelectorAll<HTMLElement>(".mode-popover")) {
			p.setAttribute("hidden", "");
		}
	});
}

init();
