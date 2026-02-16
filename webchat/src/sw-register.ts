export function registerServiceWorker(): void {
	if ("serviceWorker" in navigator) {
		navigator.serviceWorker
			.register("/sw.js")
			.then((reg) => {
				console.log("[Oppen] SW registered:", reg.scope);
			})
			.catch((err) => {
				console.warn("[Oppen] SW registration failed:", err);
			});
	}
}
