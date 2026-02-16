import { dbPut, state } from "./state";
import {
	applyThemePreset as applyPreset,
	getPresetByIndex,
	getPresetIndex,
	getPresetLabel,
	getRandomPreset,
} from "./themes/engine";

export function applyTheme(theme: "dark" | "light" | "system"): void {
	const resolved =
		theme === "system"
			? matchMedia("(prefers-color-scheme: dark)").matches
				? "dark"
				: "light"
			: theme;
	document.documentElement.setAttribute("data-theme", resolved);
}

export function setTheme(theme: "dark" | "light" | "system"): void {
	state.theme = theme;
	applyTheme(theme);
	dbPut("settings", { key: "theme", value: theme });
}

export function applyBgTheme(bg: string): void {
	document.documentElement.setAttribute("data-bg", bg);
}

export function listenSystemTheme(): void {
	matchMedia("(prefers-color-scheme: dark)").addEventListener("change", () => {
		if (state.theme === "system") applyTheme("system");
	});
}

export function setThemePreset(id: string): void {
	state.themePreset = id;
	applyPreset(id);
	dbPut("settings", { key: "themePreset", value: id });
	updateThemePickerLabel();
}

export function nextPreset(): void {
	const idx = getPresetIndex(state.themePreset);
	setThemePreset(getPresetByIndex(idx + 1));
}

export function prevPreset(): void {
	const idx = getPresetIndex(state.themePreset);
	setThemePreset(getPresetByIndex(idx - 1));
}

export function shufflePreset(): void {
	setThemePreset(getRandomPreset(state.themePreset));
}

export function initThemePreset(): void {
	applyPreset(state.themePreset);
}

function updateThemePickerLabel(): void {
	const el = document.getElementById("theme-name");
	if (el) el.textContent = getPresetLabel(state.themePreset);
}
