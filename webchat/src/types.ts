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
	theme: "dark" | "light" | "system";
	bgTheme: "none" | "obsidian" | "spark" | "flux" | "pulse" | "drift" | "nova";
	themePreset: string;
	voiceEngine: "whisper" | "webspeech";
	pendingAttachment: { name: string; text: string } | null;
	debug: boolean;
}

// WebLLM types (dynamically imported from CDN)
export interface MLCEngine {
	setInitProgressCallback(cb: (report: ProgressReport) => void): void;
	reload(modelId: string): Promise<void>;
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
