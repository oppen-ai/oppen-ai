interface LoadingEntry {
	title: string;
	subtitle: string;
	showProgress: boolean;
}

const stack: LoadingEntry[] = [];

function render(entry: LoadingEntry): void {
	const overlay = document.getElementById("loading-overlay");
	const titleEl = document.getElementById("loading-title");
	const subtitleEl = document.getElementById("loading-subtitle");
	const fillEl = document.getElementById("progress-fill");
	const statusEl = document.getElementById("loading-status");
	const actionsEl = document.getElementById("loading-actions");

	if (titleEl) titleEl.textContent = entry.title;
	if (subtitleEl) subtitleEl.textContent = entry.subtitle;
	if (fillEl) fillEl.style.width = "0%";
	if (statusEl) {
		statusEl.textContent = "";
		statusEl.style.whiteSpace = "";
		statusEl.style.textAlign = "";
	}
	if (actionsEl) actionsEl.style.display = "none";
	overlay?.classList.add("visible");
}

export function showLoadingOverlay({
	title,
	subtitle = "",
	showProgress = true,
}: {
	title: string;
	subtitle?: string;
	showProgress?: boolean;
}): void {
	const entry: LoadingEntry = { title, subtitle, showProgress };
	stack.push(entry);
	render(entry);
}

export function updateLoadingProgress(percent: number, statusText?: string): void {
	const fillEl = document.getElementById("progress-fill");
	const statusEl = document.getElementById("loading-status");
	if (fillEl) fillEl.style.width = `${Math.round(percent)}%`;
	if (statusText && statusEl) statusEl.textContent = statusText;
}

export function updateLoadingStatus(text: string): void {
	const statusEl = document.getElementById("loading-status");
	if (statusEl) statusEl.textContent = text;
}

export function showLoadingError(title: string, detail: string): void {
	const titleEl = document.getElementById("loading-title");
	const statusEl = document.getElementById("loading-status");
	const actionsEl = document.getElementById("loading-actions");

	if (titleEl) titleEl.textContent = title;
	if (statusEl) {
		statusEl.textContent = detail;
		statusEl.style.whiteSpace = "pre-wrap";
		statusEl.style.textAlign = "left";
	}
	if (actionsEl) actionsEl.style.display = "flex";
}

export function hideLoadingOverlay(): void {
	stack.pop();
	if (stack.length > 0) {
		render(stack[stack.length - 1]);
		return;
	}
	const overlay = document.getElementById("loading-overlay");
	overlay?.classList.remove("visible");
}
