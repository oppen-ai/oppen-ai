export function initSidebar(): void {
	const sidebar = document.getElementById("sidebar");
	const backdrop = document.getElementById("sidebar-backdrop");
	const menuToggle = document.getElementById("menu-toggle");

	if (!sidebar || !backdrop || !menuToggle) return;

	menuToggle.addEventListener("click", () => toggleSidebar(true));
	backdrop.addEventListener("click", () => toggleSidebar(false));
}

export function toggleSidebar(show: boolean): void {
	const sidebar = document.getElementById("sidebar");
	const backdrop = document.getElementById("sidebar-backdrop");
	sidebar?.classList.toggle("open", show);
	backdrop?.classList.toggle("visible", show);
}
