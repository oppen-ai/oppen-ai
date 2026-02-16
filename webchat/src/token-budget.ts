export const MAX_CONTEXT_TOKENS = 1800;
const TRUNCATION_MARKER = "\n... (truncated to fit context)";

export function estimateTokens(text: string): number {
	return Math.ceil(text.length / 4);
}

export function applyTokenBudget(
	messages: { role: string; content: string }[],
): { role: string; content: string }[] {
	if (messages.length === 0) return messages;

	const totalTokens = messages.reduce((sum, m) => sum + estimateTokens(m.content), 0);
	if (totalTokens <= MAX_CONTEXT_TOKENS) return messages;

	// System prompt is always first and always preserved
	const system = messages[0]?.role === "system" ? messages[0] : null;
	const rest = system ? messages.slice(1) : [...messages];

	// Most recent user message is always preserved (last message from user)
	const lastMsg = rest.length > 0 ? rest[rest.length - 1] : null;
	const middle = rest.length > 1 ? rest.slice(0, -1) : [];

	let budget = MAX_CONTEXT_TOKENS;

	// Reserve space for system prompt
	if (system) {
		budget -= estimateTokens(system.content);
	}

	// Reserve space for last message (may need truncation)
	let lastTokens = lastMsg ? estimateTokens(lastMsg.content) : 0;
	const budgetForMiddle = budget - Math.min(lastTokens, budget);

	// Keep as many recent middle messages as fit (drop oldest first)
	const kept: { role: string; content: string }[] = [];
	let usedMiddle = 0;
	for (let i = middle.length - 1; i >= 0; i--) {
		const tokens = estimateTokens(middle[i].content);
		if (usedMiddle + tokens <= budgetForMiddle) {
			kept.unshift(middle[i]);
			usedMiddle += tokens;
		} else {
			break;
		}
	}

	// Remaining budget for last message
	const remainingForLast = budget - usedMiddle;

	const result: { role: string; content: string }[] = [];
	if (system) result.push(system);
	result.push(...kept);

	if (lastMsg) {
		if (lastTokens <= remainingForLast) {
			result.push(lastMsg);
		} else {
			// Truncate last message to fit
			const maxChars = remainingForLast * 4 - TRUNCATION_MARKER.length;
			if (maxChars > 0) {
				result.push({
					role: lastMsg.role,
					content: lastMsg.content.slice(0, maxChars) + TRUNCATION_MARKER,
				});
			}
		}
	}

	return result;
}
