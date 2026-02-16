import { PRESET_IDS, THEME_PRESETS } from "./presets";

let styleEl: HTMLStyleElement | null = null;

function hexToRgba(hex: string, alpha: number): string {
	const r = Number.parseInt(hex.slice(1, 3), 16);
	const g = Number.parseInt(hex.slice(3, 5), 16);
	const b = Number.parseInt(hex.slice(5, 7), 16);
	return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function mapPresetToVars(colors: Record<string, string>): Record<string, string> {
	const bg = colors.background;
	const fg = colors.foreground;
	const isDark = isColorDark(bg);

	return {
		"--bg": bg,
		"--topbar-bg": bg,
		"--surface": colors.card,
		"--surface-hover": colors.muted,
		"--surface-active": colors.secondary,
		"--muted": colors.muted,
		"--secondary": colors.secondary,
		"--sidebar-bg": colors.sidebar,
		"--sidebar-active-bg": colors["sidebar-primary"],
		"--sidebar-active-text": colors["sidebar-primary-foreground"],
		"--sidebar-hover": colors["sidebar-accent"],
		"--modal-bg": colors.card,
		"--border": colors.border,
		"--border-strong": colors.input,
		"--text": fg,
		"--text-secondary": colors["muted-foreground"],
		"--text-tertiary": hexToRgba(fg, 0.4),
		"--primary": colors.primary,
		"--primary-foreground": colors["primary-foreground"],
		"--accent": colors.primary,
		"--accent-hover": colors.primary,
		"--accent-subtle": hexToRgba(colors.primary, 0.12),
		"--danger": colors.destructive,
		"--success": isDark ? "#22c55e" : "#16a34a",
		"--msg-user-bg": colors.primary,
		"--msg-user-text": colors["primary-foreground"],
		"--msg-assistant-bg": colors.muted,
		"--msg-assistant-border": colors.border,
		"--input-border": colors.border,
		"--input-focus": hexToRgba(colors.primary, 0.3),
		"--scrollbar-thumb": hexToRgba(fg, 0.08),
		"--overlay": isDark ? "rgba(0, 0, 0, 0.7)" : "rgba(0, 0, 0, 0.4)",
		"--code-bg": isDark ? hexToRgba(fg, 0.06) : hexToRgba(bg, 0.8),
		"--shadow-input": isDark
			? `0 0 0 1px ${hexToRgba(fg, 0.06)}, 0 2px 8px rgba(0, 0, 0, 0.2)`
			: `0 0 0 1px ${hexToRgba(fg, 0.04)}, 0 2px 8px rgba(0, 0, 0, 0.04)`,
		"--shadow-card": isDark
			? "0 8px 32px rgba(0, 0, 0, 0.6)"
			: "0 8px 32px rgba(0, 0, 0, 0.12)",
	};
}

function isColorDark(hex: string): boolean {
	const r = Number.parseInt(hex.slice(1, 3), 16);
	const g = Number.parseInt(hex.slice(3, 5), 16);
	const b = Number.parseInt(hex.slice(5, 7), 16);
	const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
	return luminance < 0.5;
}

export function applyThemePreset(presetId: string): void {
	const preset = THEME_PRESETS[presetId];
	if (!preset) return;

	if (!styleEl) {
		styleEl = document.createElement("style");
		styleEl.id = "theme-preset-vars";
		document.head.appendChild(styleEl);
	}

	const lightVars = mapPresetToVars(preset.light);
	const darkVars = mapPresetToVars(preset.dark);

	const lightCSS = Object.entries(lightVars)
		.map(([k, v]) => `${k}: ${v};`)
		.join("\n    ");
	const darkCSS = Object.entries(darkVars)
		.map(([k, v]) => `${k}: ${v};`)
		.join("\n    ");

	styleEl.textContent = `
  [data-theme="light"] {
    ${lightCSS}
  }
  [data-theme="dark"] {
    ${darkCSS}
  }
`;
}

export function removeThemePreset(): void {
	if (styleEl) {
		styleEl.remove();
		styleEl = null;
	}
}

export function getPresetLabel(id: string): string {
	return THEME_PRESETS[id]?.label ?? id;
}

export function getPresetIndex(id: string): number {
	return PRESET_IDS.indexOf(id);
}

export function getPresetByIndex(idx: number): string {
	const len = PRESET_IDS.length;
	return PRESET_IDS[((idx % len) + len) % len];
}

export function getRandomPreset(excludeId?: string): string {
	const ids = excludeId ? PRESET_IDS.filter((id) => id !== excludeId) : PRESET_IDS;
	return ids[Math.floor(Math.random() * ids.length)];
}
