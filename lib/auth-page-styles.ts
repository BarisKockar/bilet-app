import type { CSSProperties } from "react";

export const authPageStyles = {
  page: {
    minHeight: "100vh",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    background:
      "radial-gradient(circle at top, rgba(214,166,79,0.1), transparent 24%), linear-gradient(180deg, #0f172a 0%, #0b1020 100%)",
    color: "white",
    fontFamily: "Arial, sans-serif",
    padding: 20,
  } satisfies CSSProperties,
  card: {
    width: "100%",
    background:
      "linear-gradient(180deg, rgba(255,255,255,0.05), rgba(255,255,255,0)), rgba(11,18,32,0.9)",
    borderRadius: 28,
    padding: 32,
    border: "1px solid rgba(214,166,79,0.14)",
    boxShadow: "0 24px 60px rgba(0,0,0,0.4)",
    backdropFilter: "blur(16px)",
  } satisfies CSSProperties,
  input: {
    width: "100%",
    padding: "14px 16px",
    borderRadius: 14,
    border: "1px solid rgba(255,255,255,0.12)",
    background: "rgba(15,23,42,0.82)",
    color: "white",
    marginBottom: 14,
    outline: "none",
    boxShadow: "inset 0 1px 0 rgba(255,255,255,0.04)",
  } satisfies CSSProperties,
  link: {
    color: "#f4d7a1",
    textDecoration: "none",
  } satisfies CSSProperties,
};
