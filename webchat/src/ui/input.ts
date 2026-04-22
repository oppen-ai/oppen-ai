import { clearCurrentChat, sendMessage } from "../chat";
import { dlog } from "../debug";
import { processDocument } from "../documents";
import { state } from "../state";
import { isRecording, startRecording, stopRecording } from "../voice";
import { SVG_STOP } from "./renderer";

const SEND_SVG =
	'<svg width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="5" y1="12" x2="14" y2="3"/><polyline points="14 10 14 3 7 3"/></svg>';

export function initInput(): void {
	const input = document.getElementById("chat-input") as HTMLTextAreaElement | null;
	const sendBtn = document.getElementById("send-btn") as HTMLButtonElement | null;
	if (!input || !sendBtn) return;

	// Auto-resize on input
	input.addEventListener("input", () => {
		requestAnimationFrame(() => {
			input.style.height = "auto";
			input.style.height = `${Math.min(input.scrollHeight, 160)}px`;
			refreshSendButton();
		});
	});

	// Enter to send, Shift+Enter for newline
	input.addEventListener("keydown", (e) => {
		if (e.key === "Enter" && !e.shiftKey) {
			e.preventDefault();
			handleSendClick();
		}
	});

	// Send button click - either start a new send, or stop the current generation
	sendBtn.addEventListener("click", handleSendClick);

	// Action buttons
	initActionButtons();
}

function handleSendClick(): void {
	if (state.generating) {
		stopGeneration();
		return;
	}
	const input = document.getElementById("chat-input") as HTMLTextAreaElement | null;
	if (!input) return;
	const text = input.value.trim();
	if (!text) return;
	input.value = "";
	input.style.height = "auto";
	sendMessage(text);
}

function stopGeneration(): void {
	dlog("info", "chat", "User pressed stop - interrupting generation");
	try {
		const eng = state.engine as { interruptGenerate?: () => void } | null;
		eng?.interruptGenerate?.();
	} catch (e) {
		dlog("warn", "chat", `interruptGenerate threw: ${(e as Error).message}`);
	}
}

/**
 * Sync the send button's mode (send/stop) and disabled state with the
 * current state. Called from input events, from chat.ts on generation
 * start/end, and from engine ready transitions.
 */
export function refreshSendButton(): void {
	const input = document.getElementById("chat-input") as HTMLTextAreaElement | null;
	const sendBtn = document.getElementById("send-btn") as HTMLButtonElement | null;
	if (!sendBtn) return;
	if (state.generating) {
		sendBtn.disabled = false;
		sendBtn.classList.add("stop-mode");
		sendBtn.setAttribute("aria-label", "Stop generation");
		sendBtn.setAttribute("title", "Stop");
		sendBtn.innerHTML = SVG_STOP;
	} else {
		sendBtn.disabled = !input?.value.trim() || !state.ready;
		sendBtn.classList.remove("stop-mode");
		sendBtn.setAttribute("aria-label", "Send");
		sendBtn.setAttribute("title", "Send");
		sendBtn.innerHTML = SEND_SVG;
	}
}

function initActionButtons(): void {
	// Upload image
	const imageBtn = document.getElementById("upload-image-btn");
	const imageInput = document.getElementById("image-input") as HTMLInputElement | null;
	imageBtn?.addEventListener("click", () => imageInput?.click());
	imageInput?.addEventListener("change", () => handleFileUpload(imageInput));

	// Upload document
	const docBtn = document.getElementById("upload-doc-btn");
	const docInput = document.getElementById("doc-input") as HTMLInputElement | null;
	docBtn?.addEventListener("click", () => docInput?.click());
	docInput?.addEventListener("change", () => handleFileUpload(docInput));

	// Voice input
	const voiceBtn = document.getElementById("voice-btn");
	voiceBtn?.addEventListener("click", handleVoiceToggle);

	// Clear chat
	const clearBtn = document.getElementById("clear-chat-btn");
	clearBtn?.addEventListener("click", () => {
		if (confirm("Clear all messages in this chat?")) {
			clearCurrentChat();
		}
	});
}

async function handleFileUpload(input: HTMLInputElement): Promise<void> {
	const { dlog } = await import("../debug");
	const file = input.files?.[0];
	if (!file) return;

	dlog("info", "upload", `File selected: ${file.name} (${file.type}, ${file.size} bytes)`);

	// Reset input so the same file can be re-selected
	input.value = "";

	const result = await processDocument(file);
	dlog("info", "upload", `processDocument returned: ${result.text.length} chars`);
	if (result.text) {
		dlog("debug", "upload", `Extracted text: "${result.text.slice(0, 200)}"`);
	}
	if (!result.text) return;

	state.pendingAttachment = { name: file.name, text: result.text };
	dlog("info", "upload", `Attachment set: "${file.name}" (${result.text.length} chars). Type a message to send it.`);
	renderAttachmentChip();
}

function renderAttachmentChip(): void {
	const area = document.getElementById("attachment-area");
	if (!area || !state.pendingAttachment) return;

	area.innerHTML = `<div class="attachment-chip">
		<span>${state.pendingAttachment.name}</span>
		<button class="attachment-chip-remove" id="remove-attachment" title="Remove">&times;</button>
	</div>`;

	document.getElementById("remove-attachment")?.addEventListener("click", () => {
		state.pendingAttachment = null;
		area.innerHTML = "";
	});
}

async function handleVoiceToggle(): Promise<void> {
	if (isRecording()) {
		const text = await stopRecording();
		if (text) {
			const input = document.getElementById("chat-input") as HTMLTextAreaElement | null;
			if (input) {
				input.value = text;
				input.style.height = "auto";
				input.style.height = `${Math.min(input.scrollHeight, 160)}px`;
				input.focus();
				// Programmatic .value assignment doesn't fire "input", so the
				// send button stays disabled. Sync state explicitly.
				input.dispatchEvent(new Event("input", { bubbles: true }));
				refreshSendButton();
			}
		}
	} else {
		await startRecording();
	}
}

// Backwards-compat alias - older callers use updateSendButton().
export const updateSendButton = refreshSendButton;
