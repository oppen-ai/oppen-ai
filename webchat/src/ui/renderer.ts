import { deleteChatById, switchChat } from "../chat";
import { sanitize, sanitizeMarkdown } from "../security";
import { currentChat, state } from "../state";
import { getPresetLabel } from "../themes/engine";
import { showToast } from "./toast";

const SVG_PLUS =
	'<svg width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><line x1="8" y1="3" x2="8" y2="13"/><line x1="3" y1="8" x2="13" y2="8"/></svg>';

const SVG_X =
	'<svg width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><line x1="4" y1="4" x2="10" y2="10"/><line x1="10" y1="4" x2="4" y2="10"/></svg>';

const SVG_SEND =
	'<svg width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="5" y1="12" x2="14" y2="3"/><polyline points="14 10 14 3 7 3"/></svg>';

const SVG_MENU =
	'<svg width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><line x1="3" y1="5" x2="15" y2="5"/><line x1="3" y1="9" x2="15" y2="9"/><line x1="3" y1="13" x2="15" y2="13"/></svg>';

const SVG_LOCK =
	'<svg width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="7" width="10" height="7" rx="1"/><path d="M5.5 7V5a2.5 2.5 0 015 0v2"/></svg>';

const SVG_SETTINGS =
	'<svg width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="8" cy="8" r="2.5"/><path d="M8 2v1.5m0 9V14m-4.24-9.74L4.82 5.32m6.36 6.36 1.06 1.06M2 8h1.5m9 0H14M3.76 12.24l1.06-1.06m6.36-6.36 1.06-1.06"/></svg>';

const SVG_COPY =
	'<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>';

const SVG_CAMERA =
	'<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg>';

const SVG_DOC =
	'<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>';

const SVG_MIC =
	'<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" y1="19" x2="12" y2="23"/><line x1="8" y1="23" x2="16" y2="23"/></svg>';

const SVG_TRASH =
	'<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>';

const SVG_CHEVRON_LEFT =
	'<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"/></svg>';

const SVG_CHEVRON_RIGHT =
	'<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"/></svg>';

const SVG_SHUFFLE =
	'<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="16 3 21 3 21 8"/><line x1="4" y1="20" x2="21" y2="3"/><polyline points="21 16 21 21 16 21"/><line x1="15" y1="15" x2="21" y2="21"/><line x1="4" y1="4" x2="9" y2="9"/></svg>';

export function buildAppShell(): void {
	const app = document.getElementById("app");
	if (!app) return;

	const presetLabel = getPresetLabel(state.themePreset);

	app.innerHTML = `
		<div id="bg-animated"></div>
		<div id="sidebar-backdrop"></div>
		<nav id="sidebar">
			<div class="sidebar-header">
				<div class="sidebar-logo">ö</div>
				<div>
					<div class="sidebar-title">Öppen AI</div>
					<div class="sidebar-subtitle">On-device · Private</div>
				</div>
			</div>
			<button class="btn btn-full new-chat-btn" id="new-chat-btn">${SVG_PLUS} New Chat</button>
			<div class="chat-list-label">Recent</div>
			<div class="chat-list" id="chat-list"></div>
			<div class="sidebar-footer">
				<button class="btn" id="memory-btn">${SVG_LOCK} Encrypted Memory</button>
				<button class="btn" id="settings-btn">${SVG_SETTINGS} Settings</button>
			</div>
		</nav>
		<main id="main">
			<header class="topbar">
				<button class="btn btn-icon" id="menu-toggle">${SVG_MENU}</button>
				<div class="theme-picker" id="theme-picker">
					<button class="btn-icon-sm" id="theme-prev" title="Previous theme">${SVG_CHEVRON_LEFT}</button>
					<button class="theme-name-btn" id="theme-name" title="Current theme">${sanitize(presetLabel)}</button>
					<button class="btn-icon-sm" id="theme-shuffle" title="Random theme">${SVG_SHUFFLE}</button>
					<button class="btn-icon-sm" id="theme-next" title="Next theme">${SVG_CHEVRON_RIGHT}</button>
				</div>
				<span class="topbar-title" id="topbar-title">New Chat</span>
				<div id="memory-indicator" style="display:none"></div>
				<div class="model-badge" id="model-badge">
					<span class="dot" id="status-dot"></span>
					<span id="model-name-badge">not loaded</span>
				</div>
			</header>
			<div id="messages"><div class="messages-inner" id="messages-inner"></div></div>
			<div id="input-area">
				<div class="input-wrap">
					<div class="input-row">
						<textarea id="chat-input" placeholder="Send a message..." rows="1" inputmode="text" autocomplete="off" autocorrect="on" spellcheck="true"></textarea>
					</div>
					<div id="attachment-area"></div>
					<div class="input-actions">
						<button class="btn-icon-sm" id="upload-image-btn" title="Upload image">${SVG_CAMERA}</button>
						<button class="btn-icon-sm" id="upload-doc-btn" title="Upload document">${SVG_DOC}</button>
						<button class="btn-icon-sm" id="voice-btn" title="Voice input">${SVG_MIC}</button>
						<button class="btn-icon-sm" id="clear-chat-btn" title="Clear chat">${SVG_TRASH}</button>
						<span class="input-actions-spacer"></span>
						<button id="send-btn" disabled>${SVG_SEND}</button>
					</div>
				</div>
				<input type="file" id="image-input" accept="image/*" style="display:none">
				<input type="file" id="doc-input" accept=".pdf,.txt,.md,.csv,.json" style="display:none">
				<div class="input-hint">Runs entirely on your device · <span id="webgpu-hint"></span></div>
			</div>
		</main>
		<div id="loading-overlay">
			<div class="loading-card">
				<h3 id="loading-title">Loading...</h3>
				<p id="loading-subtitle"></p>
				<div class="progress-bar"><div class="progress-fill" id="progress-fill"></div></div>
				<div class="loading-status" id="loading-status"></div>
				<div class="loading-actions" id="loading-actions">
					<button class="btn" id="loading-change-model">Change Model</button>
					<button class="btn btn-primary" id="loading-retry">Retry</button>
				</div>
			</div>
		</div>
		<div class="modal-overlay" id="settings-modal">
			<div class="modal">
				<h3>Settings</h3>
				<p class="modal-desc">Configure your local AI experience.</p>
				<div class="form-group">
					<label>Theme</label>
					<select class="input-field select-field" id="theme-select">
						<option value="dark">Dark</option>
						<option value="light">Light</option>
						<option value="system">System</option>
					</select>
				</div>
				<div class="form-group">
					<label>Background</label>
					<select class="input-field select-field" id="bg-select">
						<option value="none">None</option>
						<option value="obsidian">Obsidian — metallic silver</option>
						<option value="spark">Spark — neon green</option>
						<option value="flux">Flux — purple haze</option>
						<option value="pulse">Pulse — ocean blue</option>
						<option value="drift">Drift — aurora</option>
						<option value="nova">Nova — nebula</option>
					</select>
				</div>
				<div class="form-group">
					<label>Model</label>
					<select class="input-field select-field" id="model-select"></select>
				</div>
				<div class="form-group">
					<label>System Prompt</label>
					<textarea class="input-field" id="system-prompt" rows="3" placeholder="You are a helpful assistant..."></textarea>
				</div>
				<div class="form-group">
					<label>Voice Input Engine</label>
					<select class="input-field select-field" id="voice-engine-select">
						<option value="whisper">Whisper (on-device)</option>
						<option value="webspeech">Web Speech API (browser)</option>
					</select>
				</div>
				<div class="form-group">
					<label class="toggle-label">
						<span>Debug Mode</span>
						<input type="checkbox" id="debug-toggle-setting" class="toggle-input">
						<span class="toggle-switch"></span>
					</label>
					<div class="form-hint">Shows a log panel with console output, network requests, and errors. Useful for troubleshooting.</div>
				</div>
				<div class="modal-actions">
					<button class="btn" id="settings-cancel">Cancel</button>
					<button class="btn btn-primary" id="settings-save">Save & Reload Model</button>
				</div>
			</div>
		</div>
		<div class="modal-overlay" id="memory-modal">
			<div class="modal">
				<h3>Encrypted Memory</h3>
				<p class="modal-desc">Create or load encrypted context via URL hash. Data never reaches the server.</p>
				<div class="memory-tabs">
					<button class="btn btn-primary" id="tab-create">Create</button>
					<button class="btn" id="tab-load">Load from URL</button>
				</div>
				<div id="memory-create-tab">
					<div class="form-group">
						<label>Memory Content</label>
						<textarea class="input-field" id="memory-text" rows="4" placeholder="Preferences, context, instructions..."></textarea>
					</div>
					<div class="form-group">
						<label>Password</label>
						<input type="password" class="input-field" id="memory-password-create" placeholder="Encryption password">
					</div>
					<div class="modal-actions">
						<button class="btn" id="memory-create-cancel">Cancel</button>
						<button class="btn btn-primary" id="memory-create-submit">Encrypt & Generate URL</button>
					</div>
					<div id="memory-result" style="display:none">
						<div class="memory-url-display" id="memory-url-display"></div>
						<button class="btn btn-full" id="memory-copy-url" style="margin-top:8px">Copy URL</button>
					</div>
				</div>
				<div id="memory-load-tab" style="display:none">
					<div class="form-group">
						<label>Encrypted URL or Hash</label>
						<input type="text" class="input-field" id="memory-url-input" placeholder="#/memory/...">
					</div>
					<div class="form-group">
						<label>Password</label>
						<input type="password" class="input-field" id="memory-password-load" placeholder="Decryption password">
					</div>
					<div class="modal-actions">
						<button class="btn" id="memory-load-cancel">Cancel</button>
						<button class="btn btn-primary" id="memory-load-submit">Decrypt & Apply</button>
					</div>
				</div>
			</div>
		</div>
		<div class="modal-overlay" id="password-modal">
			<div class="modal">
				<h3>Unlock Memory</h3>
				<p class="modal-desc">This URL contains encrypted memory. Enter the password to decrypt.</p>
				<div class="form-group">
					<label>Password</label>
					<input type="password" class="input-field" id="hash-password-input" placeholder="Password">
				</div>
				<div class="modal-actions">
					<button class="btn" id="password-skip">Skip</button>
					<button class="btn btn-primary" id="password-unlock">Unlock</button>
				</div>
			</div>
		</div>
		<div class="toast" id="toast"></div>
		<div id="debug-container">
			<div id="debug-pane">
				<div class="dbg-toolbar" id="debug-toggle" role="button" aria-expanded="false" tabindex="0">
					<div class="dbg-toolbar-title">
						<svg width="12" height="12" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="6" cy="6" r="5"/><line x1="6" y1="4" x2="6" y2="6.5"/><circle cx="6" cy="8.5" r="0.4" fill="currentColor"/></svg>
						Debug Log
						<span id="debug-badge">0</span>
					</div>
					<button class="dbg-btn" id="debug-copy">Copy All</button>
					<button class="dbg-btn" id="debug-clear">Clear</button>
					<svg class="dbg-chevron" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="2 4 6 8 10 4"/></svg>
				</div>
				<div id="debug-list"></div>
			</div>
		</div>
	`;
}

export function renderChatList(): void {
	const el = document.getElementById("chat-list");
	if (!el) return;

	const sorted = Object.values(state.chats).sort((a, b) => b.updatedAt - a.updatedAt);
	el.innerHTML = "";

	for (const chat of sorted) {
		const item = document.createElement("div");
		item.className = `chat-item${chat.id === state.chatId ? " active" : ""}`;
		item.dataset.chatId = chat.id;

		const text = document.createElement("span");
		text.className = "chat-item-text";
		text.textContent = chat.title;

		const del = document.createElement("button");
		del.className = "chat-item-delete";
		del.title = "Delete";
		del.innerHTML = SVG_X;

		item.appendChild(text);
		item.appendChild(del);
		el.appendChild(item);
	}
}

/** Event delegation for chat list clicks */
export function initChatListEvents(): void {
	const el = document.getElementById("chat-list");
	if (!el) return;

	el.addEventListener("click", (e) => {
		const target = e.target as HTMLElement;

		// Delete button
		const deleteBtn = target.closest(".chat-item-delete") as HTMLElement | null;
		if (deleteBtn) {
			e.stopPropagation();
			const item = deleteBtn.closest(".chat-item") as HTMLElement | null;
			if (item?.dataset.chatId) {
				deleteChatById(item.dataset.chatId);
			}
			return;
		}

		// Chat item click
		const item = target.closest(".chat-item") as HTMLElement | null;
		if (item?.dataset.chatId) {
			switchChat(item.dataset.chatId);
			// Close sidebar on mobile
			const sidebar = document.getElementById("sidebar");
			const backdrop = document.getElementById("sidebar-backdrop");
			sidebar?.classList.remove("open");
			backdrop?.classList.remove("visible");
		}
	});
}

export function renderMessages(): void {
	const chat = currentChat();
	const el = document.getElementById("messages-inner");
	if (!el) return;

	if (!chat || chat.messages.length === 0) {
		renderEmptyState(el);
		initLogoAnimations();
		return;
	}

	el.innerHTML = chat.messages
		.map((m, idx) => {
			const isUser = m.role === "user";
			const time = new Date(m.timestamp).toLocaleTimeString([], {
				hour: "2-digit",
				minute: "2-digit",
			});
			if (isUser) {
				return `<div class="message user">
				<div class="msg-body">
					<div class="msg-content">${sanitizeMarkdown(m.content)}</div>
					<div class="msg-meta"><span class="msg-time">${sanitize(time)}</span></div>
				</div>
			</div>`;
			}
			return `<div class="message ${sanitize(m.role)}" data-msg-idx="${idx}">
				<div class="msg-body">
					<div class="msg-content">${sanitizeMarkdown(m.content)}</div>
					<div class="msg-meta">
						<span class="msg-time">${sanitize(time)}</span>
						<button class="msg-copy-btn" title="Copy">${SVG_COPY}</button>
					</div>
				</div>
			</div>`;
		})
		.join("");

	scrollToBottom();
}

function renderEmptyState(el: HTMLElement): void {
	el.innerHTML = `<div class="empty-state">
		<div class="empty-logo">
			<span class="logo-char">O</span>
			<div class="logo-eyes">
				<div class="logo-eye"></div>
				<div class="logo-eye"></div>
			</div>
		</div>
		<h2>Öppen AI</h2>
		<p>Private AI running entirely on your device. No data leaves your browser.</p>
		<div class="empty-chips">
			<div class="empty-chip" data-prompt="Explain quantum computing simply">Explain quantum computing</div>
			<div class="empty-chip" data-prompt="Write a short poem about rain">Write a poem about rain</div>
			<div class="empty-chip" data-prompt="Give me 5 tips for productivity">Tips for productivity</div>
			<div class="empty-chip" data-prompt="What are the benefits of meditation?">Benefits of meditation</div>
		</div>
	</div>`;
}

/** Event delegation for empty state suggestion chips */
export function initChipEvents(): void {
	const el = document.getElementById("messages-inner");
	if (!el) return;

	el.addEventListener("click", (e) => {
		const chip = (e.target as HTMLElement).closest(".empty-chip") as HTMLElement | null;
		if (chip?.dataset.prompt) {
			const input = document.getElementById("chat-input") as HTMLTextAreaElement | null;
			if (input) {
				input.value = chip.dataset.prompt;
				input.style.height = "auto";
				input.style.height = `${Math.min(input.scrollHeight, 160)}px`;
				input.focus();
			}
		}
	});
}

/** Event delegation for copy buttons on assistant messages */
export function initCopyEvents(): void {
	const el = document.getElementById("messages-inner");
	if (!el) return;

	el.addEventListener("click", (e) => {
		const btn = (e.target as HTMLElement).closest(".msg-copy-btn") as HTMLElement | null;
		if (!btn) return;

		const msgEl = btn.closest(".message") as HTMLElement | null;
		const idx = msgEl?.dataset.msgIdx;
		if (idx == null) return;

		const chat = currentChat();
		if (!chat) return;

		const msg = chat.messages[Number(idx)];
		if (!msg) return;

		navigator.clipboard.writeText(msg.content).then(() => showToast("Copied to clipboard"));
	});
}

export function scrollToBottom(): void {
	const el = document.getElementById("messages");
	if (el) {
		requestAnimationFrame(() => {
			el.scrollTop = el.scrollHeight;
		});
	}
}

export function fillPrompt(text: string): void {
	const input = document.getElementById("chat-input") as HTMLTextAreaElement | null;
	if (input) {
		input.value = text;
		input.style.height = "auto";
		input.style.height = `${Math.min(input.scrollHeight, 160)}px`;
		input.focus();
	}
}

// --- Logo Animations ---

let blinkTimer: ReturnType<typeof setTimeout> | null = null;

const TAP_ANIMATIONS = [
	"logo-squeeze", "logo-jump", "logo-kiss",
	"logo-shake", "logo-nod",
	"logo-crazy-eyes", "logo-bonk",
] as const;

const EYE_CLASSES = [
	"logo-eye-cw", "logo-eye-ccw",
	"logo-eye-bonk-l", "logo-eye-bonk-r",
];

function clearAnimations(logo: HTMLElement): void {
	for (const cls of TAP_ANIMATIONS) logo.classList.remove(cls);
	const eyes = logo.querySelectorAll(".logo-eye");
	for (const eye of eyes) {
		for (const cls of EYE_CLASSES) eye.classList.remove(cls);
	}
}

function playSingleAnimation(onDone: () => void): void {
	const logo = document.querySelector(".empty-logo") as HTMLElement | null;
	if (!logo) {
		onDone();
		return;
	}

	clearAnimations(logo);
	void logo.offsetWidth;

	const cls = TAP_ANIMATIONS[Math.floor(Math.random() * TAP_ANIMATIONS.length)];
	logo.classList.add(cls);

	// Apply per-eye animations for special types
	const eyes = logo.querySelectorAll(".logo-eye");
	if (cls === "logo-crazy-eyes" && eyes.length === 2) {
		eyes[0].classList.add("logo-eye-cw");
		eyes[1].classList.add("logo-eye-ccw");
	} else if (cls === "logo-bonk" && eyes.length === 2) {
		eyes[0].classList.add("logo-eye-bonk-l");
		eyes[1].classList.add("logo-eye-bonk-r");
	}

	logo.addEventListener(
		"animationend",
		() => {
			clearAnimations(logo);
			onDone();
		},
		{ once: true },
	);
}

function playRandomAnimation(): void {
	// Double animation: play once, 100ms pause, play again
	playSingleAnimation(() => {
		setTimeout(() => {
			playSingleAnimation(() => scheduleBlink());
		}, 100);
	});
}

function scheduleBlink(): void {
	if (blinkTimer) clearTimeout(blinkTimer);
	const delay = 3000 + Math.random() * 2000; // 3-5s
	blinkTimer = setTimeout(playRandomAnimation, delay);
}

export function initLogoAnimations(): void {
	if (blinkTimer) clearTimeout(blinkTimer);
	// Play a random animation after 500ms, then keep going every 3-5s
	blinkTimer = setTimeout(playRandomAnimation, 500);

	const logo = document.querySelector(".empty-logo") as HTMLElement | null;
	if (!logo) return;

	logo.style.cursor = "pointer";
	logo.addEventListener("click", () => {
		if (blinkTimer) clearTimeout(blinkTimer);
		playRandomAnimation();
	});

	initMouseTracking(logo);
}

let mouseHandler: ((e: MouseEvent) => void) | null = null;

function initMouseTracking(logo: HTMLElement): void {
	// Clean up previous handler
	if (mouseHandler) document.removeEventListener("mousemove", mouseHandler);

	const char = logo.querySelector(".logo-char") as HTMLElement | null;
	const eyes = logo.querySelector(".logo-eyes") as HTMLElement | null;
	if (!char || !eyes) return;

	const MAX_CHAR_OFFSET = 4;  // O letter max shift in px
	const MAX_EYES_OFFSET = 6;  // eyes max shift in px

	mouseHandler = (e: MouseEvent) => {
		const rect = logo.getBoundingClientRect();
		const cx = rect.left + rect.width / 2;
		const cy = rect.top + rect.height / 2;

		const dx = e.clientX - cx;
		const dy = e.clientY - cy;
		const dist = Math.sqrt(dx * dx + dy * dy);

		if (dist === 0) return;

		// Normalize and scale by proximity (closer = less, farther = more, capped at 1)
		const factor = Math.min(dist / 300, 1);

		const nx = dx / dist;
		const ny = dy / dist;

		const charX = nx * MAX_CHAR_OFFSET * factor;
		const charY = ny * MAX_CHAR_OFFSET * factor;
		char.style.transform = `translate(${charX}px, ${charY}px)`;

		const eyeX = nx * MAX_EYES_OFFSET * factor;
		const eyeY = ny * MAX_EYES_OFFSET * factor;
		eyes.style.transform = `translateX(-50%) translate(${eyeX}px, ${eyeY}px)`;
	};

	document.addEventListener("mousemove", mouseHandler);
}
