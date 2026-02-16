import { SUMMARIZE_THRESHOLD, summarizeText } from "./documents";
import { streamChat } from "./engine";
import { sanitizeMarkdown } from "./security";
import { currentChat, deleteChat, generateId, saveChat, state } from "./state";
import { applyTokenBudget } from "./token-budget";
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
		msgs.push({ role: m.role, content: m.content });
	}
	return applyTokenBudget(msgs);
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
		let attachText = state.pendingAttachment.text;

		if (attachText.length > SUMMARIZE_THRESHOLD) {
			try {
				attachText = await summarizeText(attachText);
			} catch {
				// Fall back to truncation if summarization fails
				attachText = attachText.length > 8000
					? `${attachText.slice(0, 8000)}\n... (truncated)`
					: attachText;
			}
		}

		messageContent = `[Attached document: ${state.pendingAttachment.name}]\n---\n${attachText}\n---\n\n${text}`;
		state.pendingAttachment = null;
		// Clear attachment chip
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

	// Stream response
	state.generating = true;
	const sendBtn = document.getElementById("send-btn") as HTMLButtonElement | null;
	if (sendBtn) sendBtn.disabled = true;

	try {
		const context = buildContext(chat);
		// Remove the empty assistant message from context (it was added for display)
		context.pop();

		await streamChat(state.engine, context, (fullText) => {
			assistantMsg.content = fullText;
			if (contentEl) contentEl.innerHTML = sanitizeMarkdown(fullText);
			scrollToBottom();
		});

		assistantMsg.timestamp = Date.now();
		chat.updatedAt = Date.now();
		await saveChat(chat);
	} catch (e) {
		const errMsg = (e as Error).message || String(e);
		assistantMsg.content = `Error: ${errMsg}`;
		if (contentEl) contentEl.innerHTML = sanitizeMarkdown(assistantMsg.content);
		await saveChat(chat);
	}

	state.generating = false;
	if (sendBtn) sendBtn.disabled = !state.ready;
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
