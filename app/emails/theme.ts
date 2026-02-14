/**
 * Shared theme for Account Mall email templates.
 * Inline-only; no boxShadow for better Outlook compatibility.
 */

export const colors = {
    primary: "#0ea5e9",
    text: "#18181b",
    textMuted: "#3f3f46",
    textSecondary: "#71717a",
    footer: "#a1a1aa",
    border: "#e4e4e7",
    background: "#f4f4f5",
    white: "#ffffff",
    priceHighlight: "#0c4a6e",
} as const;

export const fontFamily =
    "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Ubuntu, sans-serif";

export const spacing = {
    containerPadding: "32px 24px",
    sectionMargin: "0 0 24px",
    buttonPadding: "14px 24px",
} as const;

export const main = {
    backgroundColor: colors.background,
    fontFamily,
};

export const container = {
    margin: "0 auto" as const,
    padding: spacing.containerPadding,
    maxWidth: "560px",
    backgroundColor: colors.white,
    borderRadius: "8px",
    border: `1px solid ${colors.border}`,
};

export const heading = {
    fontSize: "22px",
    fontWeight: "600" as const,
    lineHeight: "28px",
    margin: "0 0 20px",
    color: colors.text,
};

export const text = {
    fontSize: "16px",
    lineHeight: "24px",
    color: colors.textMuted,
    margin: "0 0 16px",
};

export const textMuted = {
    fontSize: "14px",
    lineHeight: "22px",
    color: colors.textSecondary,
    margin: "0 0 16px",
};

export const footer = {
    fontSize: "12px",
    lineHeight: "20px",
    color: colors.footer,
    margin: "0" as const,
};

export const button = {
    backgroundColor: colors.primary,
    color: colors.white,
    padding: spacing.buttonPadding,
    borderRadius: "6px",
    fontWeight: "600" as const,
    fontSize: "16px",
    textDecoration: "none" as const,
    display: "inline-block" as const,
    margin: "8px 0 24px",
};

export const divider = {
    borderColor: colors.border,
    margin: "24px 0",
};

export const headerBrand = {
    fontSize: "18px",
    fontWeight: "600" as const,
    color: colors.text,
    margin: "0 0 8px",
};

export const priceBlock = {
    backgroundColor: "#f0f9ff",
    borderLeft: `4px solid ${colors.primary}`,
    padding: "16px 20px",
    margin: "0 0 24px",
};

export const priceText = {
    fontSize: "24px",
    fontWeight: "700" as const,
    color: colors.priceHighlight,
    margin: "0",
};

export const BRAND_NAME = "Account Mall";
