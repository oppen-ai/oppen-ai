let toastTimeout: ReturnType<typeof setTimeout> | null = null;

export function showToast(message: string): void {
	const el = document.getElementById("toast");
	if (!el) return;
	el.textContent = message;
	el.classList.add("visible");
	if (toastTimeout) clearTimeout(toastTimeout);
	toastTimeout = setTimeout(() => el.classList.remove("visible"), 3500);
}
