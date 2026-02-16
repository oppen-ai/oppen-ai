import { createNewChat } from "../chat";
import { setDebugEnabled } from "../debug";
import { MODELS, type ModelInfo, initEngine, isMobileDevice } from "../engine";
import {
	clearHash,
	createEncryptedMemory,
	decryptHashMemory,
	loadEncryptedMemory,
} from "../memory";
import { saveSettings, state } from "../state";
import { applyBgTheme, nextPreset, prevPreset, setTheme, shufflePreset } from "../theme";
import type { AppState, MLCEngine } from "../types";
import {
	hideLoadingOverlay,
	showLoadingError,
	showLoadingOverlay,
	updateLoadingProgress,
} from "./loading";
import { renderChatList, renderMessages } from "./renderer";
import { toggleSidebar } from "./sidebar";
import { showToast } from "./toast";

export function initModals(): void {
	initSettingsModal();
	initMemoryModal();
	initPasswordModal();
	initBackdropClose();
	initNewChatButton();
	initModelBadgeClick();
	initSidebarButtons();
	initThemePicker();
}

function initSidebarButtons(): void {
	document.getElementById("memory-btn")?.addEventListener("click", () => openMemoryModal());
	document.getElementById("settings-btn")?.addEventListener("click", () => openSettingsModal());
}

function initNewChatButton(): void {
	const btn = document.getElementById("new-chat-btn");
	btn?.addEventListener("click", () => {
		createNewChat();
		renderChatList();
		renderMessages();
		const titleEl = document.getElementById("topbar-title");
		if (titleEl) titleEl.textContent = "New Chat";
		toggleSidebar(false);
	});
}

function initModelBadgeClick(): void {
	const badge = document.getElementById("model-badge");
	badge?.addEventListener("click", () => openSettingsModal());
}

function initSettingsModal(): void {
	const cancelBtn = document.getElementById("settings-cancel");
	const saveBtn = document.getElementById("settings-save");

	cancelBtn?.addEventListener("click", () => closeModal("settings-modal"));
	saveBtn?.addEventListener("click", handleSaveSettings);
}

function initThemePicker(): void {
	document.getElementById("theme-prev")?.addEventListener("click", () => prevPreset());
	document.getElementById("theme-next")?.addEventListener("click", () => nextPreset());
	document.getElementById("theme-shuffle")?.addEventListener("click", () => shufflePreset());
}

export function openSettingsModal(): void {
	const themeSelect = document.getElementById("theme-select") as HTMLSelectElement | null;
	const modelSelect = document.getElementById("model-select") as HTMLSelectElement | null;
	const sysPrompt = document.getElementById("system-prompt") as HTMLTextAreaElement | null;
	const bgSelect = document.getElementById("bg-select") as HTMLSelectElement | null;
	const debugToggle = document.getElementById("debug-toggle-setting") as HTMLInputElement | null;
	const voiceEngineSelect = document.getElementById("voice-engine-select") as HTMLSelectElement | null;

	if (themeSelect) themeSelect.value = state.theme;
	if (bgSelect) bgSelect.value = state.bgTheme;
	if (modelSelect) populateModels(modelSelect);
	if (sysPrompt) sysPrompt.value = state.systemPrompt;
	if (debugToggle) debugToggle.checked = state.debug;
	if (voiceEngineSelect) voiceEngineSelect.value = state.voiceEngine;

	openModal("settings-modal");
}

function modelOptionLabel(m: ModelInfo): string {
	const mobile = isMobileDevice();
	const vram = m.vramMB >= 1000 ? `${(m.vramMB / 1000).toFixed(1)}GB` : `${m.vramMB}MB`;
	let suffix = "";
	if (mobile && !m.mobileSafe) {
		suffix = " \u26a0\ufe0f may crash";
	}
	return `${m.label} (~${vram})${suffix}`;
}

function populateModels(select: HTMLSelectElement): void {
	select.innerHTML = MODELS.map(
		(m) =>
			`<option value="${m.id}"${m.id === state.modelId ? " selected" : ""}>${modelOptionLabel(m)}</option>`,
	).join("");
}

async function handleSaveSettings(): Promise<void> {
	const modelSelect = document.getElementById("model-select") as HTMLSelectElement | null;
	const sysPrompt = document.getElementById("system-prompt") as HTMLTextAreaElement | null;
	const themeSelect = document.getElementById("theme-select") as HTMLSelectElement | null;

	if (themeSelect) setTheme(themeSelect.value as AppState["theme"]);

	const bgSelect = document.getElementById("bg-select") as HTMLSelectElement | null;
	if (bgSelect) {
		state.bgTheme = bgSelect.value as AppState["bgTheme"];
		applyBgTheme(state.bgTheme);
	}

	if (sysPrompt) state.systemPrompt = sysPrompt.value;

	const debugToggle = document.getElementById("debug-toggle-setting") as HTMLInputElement | null;
	if (debugToggle) {
		state.debug = debugToggle.checked;
		setDebugEnabled(state.debug);
	}

	const voiceEngineSelect = document.getElementById("voice-engine-select") as HTMLSelectElement | null;
	if (voiceEngineSelect) {
		state.voiceEngine = voiceEngineSelect.value as AppState["voiceEngine"];
	}

	const newModelId = modelSelect?.value || state.modelId;
	const modelChanged = newModelId !== state.modelId;

	// Warn on mobile if selecting a large model
	if (modelChanged && isMobileDevice()) {
		const model = MODELS.find((m) => m.id === newModelId);
		if (model && !model.mobileSafe) {
			const proceed = confirm(
				`${model.label} needs ~${model.vramMB >= 1000 ? `${(model.vramMB / 1000).toFixed(1)}GB` : `${model.vramMB}MB`} of GPU memory.\n\nThis may crash Safari on your device. Continue anyway?`,
			);
			if (!proceed) return;
		}
	}

	state.modelId = newModelId;

	await saveSettings();
	closeModal("settings-modal");

	if (modelChanged) {
		state.ready = false;
		state.engine = null;
		startEngineLoad();
	} else {
		showToast("Settings saved");
	}
}

function initMemoryModal(): void {
	const createTab = document.getElementById("tab-create");
	const loadTab = document.getElementById("tab-load");
	const createCancel = document.getElementById("memory-create-cancel");
	const loadCancel = document.getElementById("memory-load-cancel");
	const createSubmit = document.getElementById("memory-create-submit");
	const loadSubmit = document.getElementById("memory-load-submit");
	const copyBtn = document.getElementById("memory-copy-url");

	createTab?.addEventListener("click", () => switchMemoryTab("create"));
	loadTab?.addEventListener("click", () => switchMemoryTab("load"));
	createCancel?.addEventListener("click", () => closeModal("memory-modal"));
	loadCancel?.addEventListener("click", () => closeModal("memory-modal"));
	createSubmit?.addEventListener("click", handleCreateMemory);
	loadSubmit?.addEventListener("click", handleLoadMemory);
	copyBtn?.addEventListener("click", handleCopyUrl);
}

let memoryUrl = "";

function switchMemoryTab(tab: "create" | "load"): void {
	const isCreate = tab === "create";
	const createTab = document.getElementById("memory-create-tab");
	const loadTab = document.getElementById("memory-load-tab");
	const createBtn = document.getElementById("tab-create");
	const loadBtn = document.getElementById("tab-load");

	if (createTab) createTab.style.display = isCreate ? "" : "none";
	if (loadTab) loadTab.style.display = isCreate ? "none" : "";
	createBtn?.classList.toggle("btn-primary", isCreate);
	loadBtn?.classList.toggle("btn-primary", !isCreate);
}

async function handleCreateMemory(): Promise<void> {
	const text = (document.getElementById("memory-text") as HTMLTextAreaElement | null)?.value.trim();
	const pw = (document.getElementById("memory-password-create") as HTMLInputElement | null)?.value;

	if (!text || !pw) {
		showToast("Fill both fields");
		return;
	}

	const url = await createEncryptedMemory(text, pw);
	if (url) {
		memoryUrl = url;
		const display = document.getElementById("memory-url-display");
		const result = document.getElementById("memory-result");
		if (display) display.textContent = url;
		if (result) result.style.display = "";
		showToast("Encrypted");
	}
}

async function handleLoadMemory(): Promise<void> {
	const url = (
		document.getElementById("memory-url-input") as HTMLInputElement | null
	)?.value.trim();
	const pw = (document.getElementById("memory-password-load") as HTMLInputElement | null)?.value;

	if (!url || !pw) {
		showToast("Fill both fields");
		return;
	}

	const ok = await loadEncryptedMemory(url, pw);
	if (ok) closeModal("memory-modal");
}

function handleCopyUrl(): void {
	if (memoryUrl) {
		navigator.clipboard.writeText(memoryUrl).then(() => showToast("Copied!"));
	}
}

export function openMemoryModal(): void {
	openModal("memory-modal");
	switchMemoryTab("create");
}

function initPasswordModal(): void {
	const skipBtn = document.getElementById("password-skip");
	const unlockBtn = document.getElementById("password-unlock");
	const pwInput = document.getElementById("hash-password-input") as HTMLInputElement | null;

	skipBtn?.addEventListener("click", () => {
		closeModal("password-modal");
		clearHash();
	});

	unlockBtn?.addEventListener("click", handleUnlockMemory);

	pwInput?.addEventListener("keydown", (e) => {
		if (e.key === "Enter") handleUnlockMemory();
	});
}

async function handleUnlockMemory(): Promise<void> {
	const pw = (document.getElementById("hash-password-input") as HTMLInputElement | null)?.value;
	if (!pw) return;
	const ok = await decryptHashMemory(pw);
	if (ok) closeModal("password-modal");
}

function initBackdropClose(): void {
	for (const id of ["settings-modal", "memory-modal", "password-modal"]) {
		const overlay = document.getElementById(id);
		overlay?.addEventListener("click", (e) => {
			if (e.target === overlay) closeModal(id);
		});
	}
}

export function openModal(id: string): void {
	document.getElementById(id)?.classList.add("visible");
}

export function closeModal(id: string): void {
	document.getElementById(id)?.classList.remove("visible");
}

export function startEngineLoad(): void {
	const dot = document.getElementById("status-dot");
	const badge = document.getElementById("model-name-badge");

	const modelLabel =
		MODELS.find((m) => m.id === state.modelId)?.label ?? state.modelId.split("-").slice(0, 2).join(" ");

	if (dot) dot.className = "dot loading";
	if (badge) badge.textContent = modelLabel;

	let isDownloading = false;
	let titleSet = false;

	showLoadingOverlay({
		title: "Loading my brain...",
		subtitle: modelLabel,
	});

	initEngine(state.modelId, {
		onProgress(report) {
			const pct = Math.round((report.progress || 0) * 100);
			const text = report.text || "";

			// Detect download vs cached on first meaningful progress
			if (!titleSet && text) {
				if (/Fetching|Loading/.test(text) && pct < 5) {
					isDownloading = true;
				}
				titleSet = true;
				const titleEl = document.getElementById("loading-title");
				if (titleEl) {
					titleEl.textContent = isDownloading
						? "Downloading my brain..."
						: "Loading my brain...";
				}
			}

			// Parse status: strip technical prefixes, show brief info
			let statusText = "";
			if (text) {
				const match = text.match(/(?:Loading|Fetching)\s+(?:param\s+)?(?:shard\s+\d+\s+of\s+\d+:\s+)?(.+)/i);
				statusText = match ? `${match[1]} \u2014 ${pct}%` : `${pct}%`;
			}
			updateLoadingProgress(pct, statusText);
		},
		onStatusText(text) {
			const statusEl = document.getElementById("loading-status");
			if (statusEl) statusEl.textContent = text;
		},
		onDiagnosticError(lines) {
			if (dot) dot.className = "dot error";
			if (badge) badge.textContent = "error";
			showLoadingError("Something went wrong", lines.join("\n"));
			showToast(lines[0] || "Error");
		},
		onReady(engine: MLCEngine) {
			state.engine = engine;
			state.ready = true;
			if (dot) dot.className = "dot ready";
			const sendBtn = document.getElementById("send-btn") as HTMLButtonElement | null;
			if (sendBtn) sendBtn.disabled = false;
			hideLoadingOverlay();
		},
		onError(lines) {
			if (dot) dot.className = "dot error";
			if (badge) badge.textContent = "error";
			showLoadingError("Failed to load model", lines.join("\n"));
			showToast("Model load failed");
			setTimeout(() => hideLoadingOverlay(), 8000);
		},
	});

	// Loading overlay action buttons
	const retryBtn = document.getElementById("loading-retry");
	const changeModelBtn = document.getElementById("loading-change-model");

	retryBtn?.addEventListener("click", () => {
		hideLoadingOverlay();
		startEngineLoad();
	});

	changeModelBtn?.addEventListener("click", () => {
		hideLoadingOverlay();
		openSettingsModal();
	});
}
