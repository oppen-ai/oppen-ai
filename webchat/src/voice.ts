import { state } from "./state";
import { hideLoadingOverlay, showLoadingOverlay, updateLoadingStatus } from "./ui/loading";
import { showToast } from "./ui/toast";

let recording = false;
let mediaRecorder: MediaRecorder | null = null;
let audioChunks: Blob[] = [];
let recognition: any = null;
let transformersPipeline: any = null;

const TRANSFORMERS_CDN = "https://cdn.jsdelivr.net/npm/@huggingface/transformers@3/+esm";

async function loadTransformers(): Promise<any> {
	if (transformersPipeline) return transformersPipeline;
	try {
		const mod = await import(/* @vite-ignore */ TRANSFORMERS_CDN);
		transformersPipeline = mod.pipeline;
		return transformersPipeline;
	} catch {
		return null;
	}
}

export function isRecording(): boolean {
	return recording;
}

export async function startRecording(): Promise<void> {
	if (recording) return;

	if (state.voiceEngine === "webspeech") {
		startWebSpeech();
		return;
	}

	// Whisper mode: record audio
	try {
		const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
		audioChunks = [];
		mediaRecorder = new MediaRecorder(stream);

		mediaRecorder.ondataavailable = (e) => {
			if (e.data.size > 0) audioChunks.push(e.data);
		};

		mediaRecorder.start();
		recording = true;
		updateVoiceButtonState();
	} catch {
		showToast("Microphone access denied");
	}
}

export async function stopRecording(): Promise<string> {
	if (!recording) return "";

	if (state.voiceEngine === "webspeech") {
		return stopWebSpeech();
	}

	// Whisper mode: stop and transcribe
	return new Promise((resolve) => {
		if (!mediaRecorder) {
			recording = false;
			updateVoiceButtonState();
			resolve("");
			return;
		}

		mediaRecorder.onstop = async () => {
			// Stop all tracks
			for (const track of mediaRecorder!.stream.getTracks()) {
				track.stop();
			}

			recording = false;
			updateVoiceButtonState();

			const blob = new Blob(audioChunks, { type: "audio/webm" });
			if (blob.size === 0) {
				resolve("");
				return;
			}

			showLoadingOverlay({ title: "Transcribing speech...", subtitle: "Whisper" });

			try {
				const pipeline = await loadTransformers();
				if (!pipeline) {
					hideLoadingOverlay();
					showToast("Failed to load Whisper");
					resolve("");
					return;
				}

				updateLoadingStatus("Loading speech model...");
				const transcriber = await pipeline(
					"automatic-speech-recognition",
					"Xenova/whisper-tiny.en",
				);
				updateLoadingStatus("Transcribing...");
				const url = URL.createObjectURL(blob);
				const result = await transcriber(url);
				URL.revokeObjectURL(url);

				hideLoadingOverlay();
				resolve(result?.text?.trim() ?? "");
			} catch {
				hideLoadingOverlay();
				showToast("Transcription failed");
				resolve("");
			}
		};

		mediaRecorder.stop();
	});
}

function startWebSpeech(): void {
	const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
	if (!SpeechRecognition) {
		showToast("Web Speech API not supported");
		return;
	}

	recognition = new SpeechRecognition();
	recognition.continuous = false;
	recognition.interimResults = true;
	recognition.lang = "en-US";

	const input = document.getElementById("chat-input") as HTMLTextAreaElement | null;

	recognition.onresult = (e: any) => {
		let transcript = "";
		for (let i = 0; i < e.results.length; i++) {
			transcript += e.results[i][0].transcript;
		}
		if (input) input.value = transcript;
	};

	recognition.onerror = () => {
		recording = false;
		updateVoiceButtonState();
	};

	recognition.onend = () => {
		recording = false;
		updateVoiceButtonState();
	};

	recognition.start();
	recording = true;
	updateVoiceButtonState();
}

function stopWebSpeech(): Promise<string> {
	return new Promise((resolve) => {
		if (recognition) {
			recognition.onend = () => {
				recording = false;
				updateVoiceButtonState();
				const input = document.getElementById("chat-input") as HTMLTextAreaElement | null;
				resolve(input?.value ?? "");
			};
			recognition.stop();
		} else {
			recording = false;
			updateVoiceButtonState();
			resolve("");
		}
	});
}

function updateVoiceButtonState(): void {
	const btn = document.getElementById("voice-btn");
	if (btn) {
		btn.classList.toggle("recording", recording);
	}
}
