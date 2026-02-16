import {
	hideLoadingOverlay,
	showLoadingOverlay,
	updateLoadingStatus,
} from "./ui/loading";
import { showToast } from "./ui/toast";

let pdfjsLib: any = null;
let transformersPipeline: any = null;
let summarizationPipeline: any = null;

const PDFJS_CDN = "https://cdn.jsdelivr.net/npm/pdfjs-dist@4.9.155/+esm";
const PDFJS_WORKER = "https://cdn.jsdelivr.net/npm/pdfjs-dist@4.9.155/build/pdf.worker.min.mjs";
const TRANSFORMERS_CDN = "https://cdn.jsdelivr.net/npm/@huggingface/transformers@3/+esm";

export const SUMMARIZE_THRESHOLD = 3000;

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

async function loadTransformers(): Promise<any> {
	if (transformersPipeline) return transformersPipeline;
	try {
		const mod = await import(/* @vite-ignore */ TRANSFORMERS_CDN);
		transformersPipeline = mod.pipeline;
		return transformersPipeline;
	} catch {
		showToast("Failed to load Transformer.js");
		return null;
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

export async function extractTextFromImage(file: File): Promise<string> {
	showLoadingOverlay({ title: "Reading image text...", subtitle: "OCR model" });
	try {
		const pipeline = await loadTransformers();
		if (!pipeline) return "";

		updateLoadingStatus("Loading OCR model...");
		const ocr = await pipeline("image-to-text", "Xenova/trocr-small-printed");
		const blob = URL.createObjectURL(file);
		updateLoadingStatus("Extracting text...");
		const result = await ocr(blob);
		URL.revokeObjectURL(blob);

		if (Array.isArray(result) && result.length > 0) {
			return result.map((r: any) => r.generated_text).join("\n");
		}
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

export async function summarizeText(text: string): Promise<string> {
	showLoadingOverlay({ title: "Summarizing document...", subtitle: "Summarization model" });
	try {
		const pipeline = await loadTransformers();
		if (!pipeline) {
			throw new Error("Failed to load Transformer.js");
		}

		if (!summarizationPipeline) {
			updateLoadingStatus("Loading summarization model...");
			summarizationPipeline = await pipeline("summarization", "Xenova/distilbart-cnn-6-6");
		}

		// Chunk input (~3500 chars per chunk for model's 1024-token input limit)
		const CHUNK_SIZE = 3500;
		const chunks: string[] = [];
		for (let i = 0; i < text.length; i += CHUNK_SIZE) {
			chunks.push(text.slice(i, i + CHUNK_SIZE));
		}

		const summaries: string[] = [];
		for (let i = 0; i < chunks.length; i++) {
			updateLoadingStatus(`Summarizing chunk ${i + 1} of ${chunks.length}`);
			const result = await summarizationPipeline(chunks[i], {
				max_length: 150,
				min_length: 30,
			});
			if (Array.isArray(result) && result[0]?.summary_text) {
				summaries.push(result[0].summary_text);
			}
		}

		return summaries.join("\n\n");
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
