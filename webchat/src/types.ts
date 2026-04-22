export interface Chat {
	id: string;
	title: string;
	messages: Message[];
	createdAt: number;
	updatedAt: number;
}

export interface Message {
	role: "user" | "assistant" | "system";
	content: string;
	timestamp: number;
	/** Error-message stub that was written in place of a real assistant
	 *  reply (QRNG stream lost, model crashed, etc.). Still shown in the
	 *  UI so the user knows what happened, but deliberately excluded from
	 *  the context we send to the LLM - otherwise the model reads it as
	 *  a previous assistant turn and imitates the apologetic phrasing. */
	isError?: boolean;
}

export interface AppSettings {
	theme: "dark" | "light" | "system";
	modelId: string;
	systemPrompt: string;
}

export interface Model {
	id: string;
	label: string;
}

export interface AppState {
	engine: MLCEngine | null;
	ready: boolean;
	chatId: string | null;
	chats: Record<string, Chat>;
	generating: boolean;
	systemPrompt: string;
	memory: string;
	modelId: string;
	contextSize: number;
	theme: "dark" | "light" | "system";
	bgTheme: "none" | "obsidian" | "spark" | "flux" | "pulse" | "drift" | "nova";
	themePreset: string;
	voiceEngine: "whisper" | "webspeech";
	pendingAttachment: { name: string; text: string } | null;
	debug: boolean;
	qrngEnabled: boolean;
	qrngMode: "buffer" | "realtime";
	qrngProxyUrl: string;
}

// WebLLM types (dynamically imported from CDN)
export interface MLCEngine {
	setInitProgressCallback(cb: (report: ProgressReport) => void): void;
	reload(modelId: string): Promise<void>;
	interruptGenerate?(): void | Promise<void>;
	chat: {
		completions: {
			create(params: ChatParams): Promise<AsyncIterable<ChatChunk>>;
		};
	};
}

export interface ProgressReport {
	progress?: number;
	text?: string;
}

export interface ChatParams {
	messages: { role: string; content: string }[];
	stream: boolean;
	max_tokens: number;
	temperature: number;
	top_p: number;
}

export interface ChatChunk {
	choices: { delta: { content?: string } }[];
}
