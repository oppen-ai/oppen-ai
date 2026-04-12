import {
	hideLoadingOverlay,
	showLoadingOverlay,
	updateLoadingStatus,
} from "./ui/loading";
import { getMaxContextTokens } from "./token-budget";
import { showToast } from "./ui/toast";

let pdfjsLib: any = null;

const PDFJS_CDN = "https://cdn.jsdelivr.net/npm/pdfjs-dist@4.9.155/+esm";
const PDFJS_WORKER = "https://cdn.jsdelivr.net/npm/pdfjs-dist@4.9.155/build/pdf.worker.min.mjs";


async function loadPDFJS(): Promise<any> {
	if (pdfjsLib) return pdfjsLib;
	showLoadingOverlay({ title: "Loading PDF reader...", subtitle: "PDF.js" });
	try {
		const mod = await import(/* @vite-ignore */ PDFJS_CDN);
		pdfjsLib = mod;
		pdfjsLib.GlobalWorkerOptions.workerSrc = PDFJS_WORKER;
		return pdfjsLib;
	} catch {
		showToast("Failed to load PDF.js");
		return null;
	} finally {
		hideLoadingOverlay();
	}
}


export async function extractTextFromPDF(file: File): Promise<string> {
	const lib = await loadPDFJS();
	if (!lib) return "";

	showLoadingOverlay({ title: "Reading document...", subtitle: file.name });
	try {
		const arrayBuffer = await file.arrayBuffer();
		const pdf = await lib.getDocument({ data: arrayBuffer }).promise;
		const pages: string[] = [];

		for (let i = 1; i <= pdf.numPages; i++) {
			updateLoadingStatus(`Page ${i} of ${pdf.numPages}`);
			const page = await pdf.getPage(i);
			const textContent = await page.getTextContent();
			const text = textContent.items.map((item: any) => item.str).join(" ");
			pages.push(text);
		}

		return pages.join("\n\n");
	} finally {
		hideLoadingOverlay();
	}
}

async function browserOCR(file: File): Promise<string | null> {
	const { dlog } = await import("./debug");
	// biome-ignore lint/suspicious/noExplicitAny: TextDetector is not in standard TS lib
	const win = window as any;

	dlog("info", "ocr", `TextDetector available: ${typeof win.TextDetector}`);
	if (typeof win.TextDetector !== "function") {
		dlog("info", "ocr", "Browser does not support TextDetector API");
		return null;
	}

	try {
		dlog("info", "ocr", `Creating bitmap from file: ${file.name} (${file.type}, ${file.size} bytes)`);
		const bitmap = await createImageBitmap(file);
		dlog("info", "ocr", `Bitmap created: ${bitmap.width}x${bitmap.height}`);

		const detector = new win.TextDetector();
		const results = await detector.detect(bitmap);
		bitmap.close();

		dlog("info", "ocr", `TextDetector returned ${results?.length ?? 0} results`);
		if (results && results.length > 0) {
			for (let i = 0; i < Math.min(results.length, 5); i++) {
				dlog("debug", "ocr", `  [${i}] rawValue="${results[i].rawValue}" cornerPoints=${JSON.stringify(results[i].cornerPoints)}`);
			}
		}

		if (!results || results.length === 0) return null;
		const text = results.map((r: any) => r.rawValue).filter(Boolean).join("\n");
		dlog("info", "ocr", `Extracted text: ${text.length} chars`);
		return text;
	} catch (e) {
		dlog("error", "ocr", `Browser OCR failed: ${(e as Error).message}`);
		return null;
	}
}

const TESSERACT_CDN = "https://cdn.jsdelivr.net/npm/tesseract.js@5/dist/tesseract.min.js";

async function loadTesseract(): Promise<any> {
	// biome-ignore lint/suspicious/noExplicitAny: Tesseract loaded from CDN
	const win = window as any;
	if (win.Tesseract) return win.Tesseract;
	await new Promise<void>((resolve, reject) => {
		const s = document.createElement("script");
		s.src = TESSERACT_CDN;
		s.onload = () => resolve();
		s.onerror = () => reject(new Error("Failed to load Tesseract.js"));
		document.head.appendChild(s);
	});
	return win.Tesseract;
}

export async function extractTextFromImage(file: File): Promise<string> {
	const { dlog } = await import("./debug");
	showLoadingOverlay({ title: "Reading image text...", subtitle: "OCR" });
	try {
		// Try browser-native OCR first (Safari TextDetector / Chrome Shape Detection)
		updateLoadingStatus("Trying browser OCR...");
		const nativeText = await browserOCR(file);
		if (nativeText && nativeText.trim().length > 0) {
			dlog("info", "ocr", `Browser OCR extracted ${nativeText.length} chars`);
			showToast("Text extracted via browser OCR");
			return nativeText;
		}

		// Tesseract.js - lightweight full-page OCR (~4MB, runs alongside the chat LLM)
		dlog("info", "ocr", "Loading Tesseract.js for full-page OCR...");
		updateLoadingStatus("Loading OCR engine...");
		const Tesseract = await loadTesseract();

		const blob = URL.createObjectURL(file);
		dlog("info", "ocr", `Running Tesseract on ${file.name} (${file.size} bytes)`);
		updateLoadingStatus("Extracting text...");

		const result = await Tesseract.recognize(blob, "eng", {
			logger: (m: any) => {
				if (m.status === "recognizing text") {
					const pct = Math.round((m.progress || 0) * 100);
					updateLoadingStatus(`Recognizing text... ${pct}%`);
				}
			},
		});
		URL.revokeObjectURL(blob);

		const text = result?.data?.text?.trim() || "";
		dlog("info", "ocr", `Tesseract extracted ${text.length} chars`);
		if (text.length > 0) {
			dlog("debug", "ocr", `First 500 chars: "${text.slice(0, 500)}"`);
			showToast(`Extracted ${text.length} chars from image`);
		} else {
			showToast("No text detected in image");
		}
		return text;
	} catch (e) {
		const msg = (e as Error).message || String(e);
		dlog("error", "ocr", `OCR failed: ${msg}`);
		showToast(`OCR failed: ${msg.slice(0, 80)}`);
		return "";
	} finally {
		hideLoadingOverlay();
	}
}

export async function extractTextFromTextFile(file: File): Promise<string> {
	return new Promise((resolve, reject) => {
		const reader = new FileReader();
		reader.onload = () => resolve(reader.result as string);
		reader.onerror = () => reject(new Error("Failed to read file"));
		reader.readAsText(file);
	});
}

export async function summarizeForContext(text: string): Promise<string> {
	const { dlog } = await import("./debug");
	const maxChars = getMaxContextTokens() * 4;
	dlog("info", "summarize", `Input: ${text.length} chars, maxChars: ${maxChars}, contextTokens: ${getMaxContextTokens()}`);

	if (text.length <= maxChars) {
		dlog("info", "summarize", "Text fits context - returning as-is");
		return text;
	}

	const { state } = await import("./state");
	const { streamChat } = await import("./engine");

	if (!state.engine) {
		dlog("warn", "summarize", "Engine not loaded - truncating instead of summarizing");
		return text.slice(0, maxChars) + "\n... (truncated - model not loaded)";
	}

	dlog("info", "summarize", "Text exceeds context - summarizing in batches via chat LLM");
	showLoadingOverlay({ title: "Summarizing document...", subtitle: "Using chat model" });
	try {
		const chunkSize = maxChars - 400;
		const chunks: string[] = [];
		for (let i = 0; i < text.length; i += chunkSize) {
			chunks.push(text.slice(i, i + chunkSize));
		}
		dlog("info", "summarize", `Split into ${chunks.length} chunks of ~${chunkSize} chars`);

		const summaries: string[] = [];
		for (let i = 0; i < chunks.length; i++) {
			updateLoadingStatus(`Summarizing part ${i + 1} of ${chunks.length}...`);
			dlog("info", "summarize", `Chunk ${i + 1}/${chunks.length}: ${chunks[i].length} chars`);
			const prompt = [
				{ role: "system", content: "You are a summarizer. Output only a concise summary of the provided text. No preamble." },
				{ role: "user", content: `Summarize this text:\n\n${chunks[i]}` },
			];
			const summary = await streamChat(state.engine, prompt, () => {});
			dlog("info", "summarize", `Chunk ${i + 1} summary (${summary.length} chars): "${summary.trim().slice(0, 200)}..."`);
			summaries.push(summary.trim());
		}

		let result = summaries.join("\n\n");
		dlog("info", "summarize", `Combined summary: ${result.length} chars`);
		if (result.length > maxChars) {
			result = result.slice(0, maxChars) + "\n... (summary truncated to fit context)";
			dlog("warn", "summarize", `Summary exceeded maxChars - truncated to ${result.length}`);
		}
		return result;
	} finally {
		hideLoadingOverlay();
	}
}

export async function processDocument(file: File): Promise<{ text: string; summary?: string }> {
	const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
	const mime = file.type;

	let text = "";

	if (mime === "application/pdf" || ext === "pdf") {
		text = await extractTextFromPDF(file);
	} else if (mime.startsWith("image/")) {
		text = await extractTextFromImage(file);
	} else if (["txt", "md", "csv", "json"].includes(ext)) {
		text = await extractTextFromTextFile(file);
	} else {
		showToast("Unsupported file type");
		return { text: "" };
	}

	if (!text.trim()) {
		showToast("No text extracted from document");
		return { text: "" };
	}

	showToast("Document processed");
	return { text };
}
