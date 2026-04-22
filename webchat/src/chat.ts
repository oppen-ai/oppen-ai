import { dlog } from "./debug";
import { summarizeForContext } from "./documents";
import { isQrngPerTokenActive, streamChat } from "./engine";
import { clearBuffer as clearQrngBuffer, isQrngActive, nextQuantumU32 } from "./qrng";
import { sanitizeMarkdown } from "./security";
import { onAssistantComplete, onAssistantUpdate } from "./speech";
import { currentChat, deleteChat, generateId, saveChat, state } from "./state";
import { refreshSendButton } from "./ui/input";
import { applyTokenBudget, estimateTokens } from "./token-budget";
import type { Chat, Message } from "./types";
import { renderChatList, renderMessages, scrollToBottom } from "./ui/renderer";
import { showToast } from "./ui/toast";

export function createNewChat(): Chat {
	const chat: Chat = {
		id: generateId(),
		title: "New Chat",
		messages: [],
		createdAt: Date.now(),
		updatedAt: Date.now(),
	};
	state.chats[chat.id] = chat;
	state.chatId = chat.id;
	saveChat(chat);
	return chat;
}

export async function switchChat(id: string): Promise<void> {
	state.chatId = id;
	renderChatList();
	renderMessages();
	const chat = currentChat();
	const titleEl = document.getElementById("topbar-title");
	if (titleEl && chat) titleEl.textContent = chat.title;
}

async function autoTitle(chat: Chat): Promise<void> {
	if (chat.messages.length === 1 && chat.title === "New Chat") {
		const first = chat.messages[0].content;
		chat.title = first.length > 40 ? `${first.slice(0, 40)}...` : first;
		const titleEl = document.getElementById("topbar-title");
		if (titleEl) titleEl.textContent = chat.title;
		await saveChat(chat);
		renderChatList();
	}
}

function buildContext(chat: Chat): { role: string; content: string }[] {
	const systemParts = [state.systemPrompt, state.memory].filter(Boolean);
	const msgs: { role: string; content: string }[] = [];
	if (systemParts.length > 0) {
		msgs.push({ role: "system", content: systemParts.join("\n\n") });
	}
	for (const m of chat.messages.slice(-20)) {
		// Skip error stubs (QRNG_STREAM_LOST etc.) so the model doesn't
		// see them as its own past turns and imitate the phrasing.
		if (m.isError) continue;
		msgs.push({ role: m.role, content: m.content });
	}
	const totalBefore = msgs.reduce((s, m) => s + estimateTokens(m.content), 0);
	dlog("info", "context", `Before budget: ${msgs.length} msgs, ~${totalBefore} tokens`);
	const result = applyTokenBudget(msgs);
	const totalAfter = result.reduce((s, m) => s + estimateTokens(m.content), 0);
	dlog("info", "context", `After budget: ${result.length} msgs, ~${totalAfter} tokens (budget cut ${msgs.length - result.length} msgs, ${totalBefore - totalAfter} tokens)`);
	return result;
}

export async function sendMessage(text: string): Promise<void> {
	if (!text.trim() || state.generating) return;
	if (!state.ready || !state.engine) {
		showToast("Model still loading...");
		return;
	}

	if (!state.chatId) createNewChat();
	const chat = currentChat();
	if (!chat) return;

	// Prepend attachment text if present
	let messageContent = text;
	if (state.pendingAttachment) {
		const rawText = state.pendingAttachment.text;
		dlog("info", "attach", `Raw attachment: ${rawText.length} chars (~${estimateTokens(rawText)} tokens) from "${state.pendingAttachment.name}"`);

		const attachText = await summarizeForContext(rawText);
		dlog("info", "attach", `After summarizeForContext: ${attachText.length} chars (~${estimateTokens(attachText)} tokens)`);
		dlog("debug", "attach", `Attachment content (first 500 chars): ${attachText.slice(0, 500)}`);

		messageContent = `[Attached document: ${state.pendingAttachment.name}]\n---\n${attachText}\n---\n\n${text}`;
		dlog("info", "attach", `Final messageContent: ${messageContent.length} chars (~${estimateTokens(messageContent)} tokens)`);

		state.pendingAttachment = null;
		const area = document.getElementById("attachment-area");
		if (area) area.innerHTML = "";
	}

	// Add user message
	const userMsg: Message = { role: "user", content: messageContent, timestamp: Date.now() };
	chat.messages.push(userMsg);
	chat.updatedAt = Date.now();
	renderMessages();
	await autoTitle(chat);
	await saveChat(chat);

	// Add placeholder assistant message
	const assistantMsg: Message = { role: "assistant", content: "", timestamp: Date.now() };
	chat.messages.push(assistantMsg);
	renderMessages();

	// Show typing indicator
	const messagesEl = document.getElementById("messages-inner");
	const allMsgEls = messagesEl?.querySelectorAll(".message");
	const lastMsgEl = allMsgEls?.[allMsgEls.length - 1];
	const contentEl = lastMsgEl?.querySelector(".msg-content");
	if (contentEl) {
		contentEl.innerHTML =
			'<div class="typing-indicator"><span></span><span></span><span></span></div>';
	}

	// Stream response. Drop any leftover quantum bytes so this generation
	// only consumes entropy that arrives from now on.
	state.generating = true;
	if (isQrngActive()) clearQrngBuffer();
	refreshSendButton();

	try {
		const context = buildContext(chat);
		// Remove the empty assistant message from context (it was added for display)
		context.pop();

		dlog("info", "context", `Sending ${context.length} messages to LLM`);
		for (let i = 0; i < context.length; i++) {
			const m = context[i];
			dlog("debug", "context", `  [${i}] ${m.role}: ${m.content.length} chars - "${m.content.slice(0, 120)}..."`);
		}

		// Per-token quantum seeding is the only supported mode. If the
		// sampler patch failed to install (e.g., WebLLM internals shifted
		// in an upgrade), we refuse to generate with an error.
		if (isQrngActive() && !isQrngPerTokenActive()) {
			throw new Error(
				"Quantum randomness is enabled but the per-token sampler patch could not be installed for this WebLLM version. Disable Quantum randomness in Settings > Experimental, or file an issue.",
			);
		}

		// Per-prompt quantum temperature. Derive once per response from a
		// fresh quantum u32, mapped to [0.5, 1.0] - the coherent range for
		// the small models we run (100M-3B params). Going past ~1.2 on
		// these models produces gibberish because their probability
		// distributions aren't sharp enough to survive high randomness.
		// Per-token reseeding continues independently in the patched sampler.
		let temperature = 0.7;
		if (isQrngActive()) {
			const tempU32 = await nextQuantumU32();
			if (tempU32 === null) throw new Error("QRNG_STREAM_LOST");
			temperature = 0.5 + (tempU32 / 0x100000000) * 0.5;
			dlog(
				"info",
				"qrng",
				`per-prompt quantum temperature: ${temperature.toFixed(3)} (from u32=${tempU32})`,
			);
		}

		// The quantum stream is always-on when QRNG is enabled; the sampler
		// consumes from its local buffer per token.
		const assistantIdx = chat.messages.indexOf(assistantMsg);
		const final = await streamChat(
			state.engine,
			context,
			(fullText) => {
				assistantMsg.content = fullText;
				if (contentEl) contentEl.innerHTML = sanitizeMarkdown(fullText);
				scrollToBottom();
				onAssistantUpdate(chat.id, assistantIdx, fullText);
			},
			temperature,
		);
		onAssistantComplete(chat.id, assistantIdx, final);

		assistantMsg.timestamp = Date.now();
		chat.updatedAt = Date.now();
		await saveChat(chat);
	} catch (e) {
		const errMsg = (e as Error).message || String(e);
		if (errMsg === "QRNG_STREAM_LOST") {
			assistantMsg.content =
				"I lost my quantum random real-time feed. Please try again later, or disable Quantum randomness in Settings > Experimental.";
		} else {
			assistantMsg.content = `Error: ${errMsg}`;
		}
		// Mark as error so buildContext skips it - otherwise the model reads
		// it as one of its own previous replies and starts imitating the
		// apology phrasing on unrelated follow-ups.
		assistantMsg.isError = true;
		if (contentEl) contentEl.innerHTML = sanitizeMarkdown(assistantMsg.content);
		await saveChat(chat);
	}

	state.generating = false;
	if (isQrngActive()) clearQrngBuffer();
	refreshSendButton();
	renderChatList();
}

export async function deleteChatById(id: string): Promise<void> {
	await deleteChat(id);
	if (state.chatId === id) {
		const keys = Object.keys(state.chats);
		if (keys.length > 0) {
			await switchChat(keys[0]);
		} else {
			state.chatId = null;
			createNewChat();
		}
	}
	renderChatList();
	renderMessages();
}

export function clearCurrentChat(): void {
	const chat = currentChat();
	if (!chat) return;
	chat.messages = [];
	chat.title = "New Chat";
	chat.updatedAt = Date.now();
	saveChat(chat);
	renderMessages();
	renderChatList();
	const titleEl = document.getElementById("topbar-title");
	if (titleEl) titleEl.textContent = "New Chat";
}
