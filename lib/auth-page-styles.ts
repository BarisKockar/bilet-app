import type { CSSProperties } from "react";

export const authPageStyles = {
  page: {
    minHeight: "100vh",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    background: "#0b1020",
    color: "white",
    fontFamily: "Arial, sans-serif",
    padding: 20,
  } satisfies CSSProperties,
  card: {
    width: "100%",
    background: "#111827",
    borderRadius: 20,
    padding: 28,
    border: "1px solid rgba(255,255,255,0.08)",
    boxShadow: "0 10px 30px rgba(0,0,0,0.35)",
  } satisfies CSSProperties,
  input: {
    width: "100%",
    padding: "12px 14px",
    borderRadius: 12,
    border: "1px solid rgba(255,255,255,0.08)",
    background: "#0f172a",
    color: "white",
    marginBottom: 14,
    outline: "none",
  } satisfies CSSProperties,
  link: {
    color: "#93c5fd",
    textDecoration: "none",
  } satisfies CSSProperties,
};
