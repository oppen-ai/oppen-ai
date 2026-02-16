/** Escape HTML entities to prevent XSS */
export function sanitize(text: string): string {
	return text
		.replace(/&/g, "&amp;")
		.replace(/</g, "&lt;")
		.replace(/>/g, "&gt;")
		.replace(/"/g, "&quot;")
		.replace(/'/g, "&#039;");
}

/** Convert markdown-like text to safe HTML (pre-sanitized input only) */
export function sanitizeMarkdown(text: string): string {
	let html = sanitize(text);

	// Code blocks: ```lang\n...\n```
	html = html.replace(/```(\w*)\n([\s\S]*?)```/g, "<pre><code>$2</code></pre>");

	// Inline code: `...`
	html = html.replace(/`([^`]+)`/g, "<code>$1</code>");

	// Bold: **...**
	html = html.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");

	// Italic: *...*
	html = html.replace(/\*(.+?)\*/g, "<em>$1</em>");

	// Paragraphs (double newline)
	html = html
		.split("\n\n")
		.map((p) => `<p>${p}</p>`)
		.join("");

	// Line breaks
	html = html.replace(/\n/g, "<br>");

	return html;
}
