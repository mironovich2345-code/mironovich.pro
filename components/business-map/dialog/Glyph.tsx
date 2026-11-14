export default function Glyph({
  name = "arrow",
}: {
  name?: "dialog" | "map" | "plan" | "arrow";
}) {
  return (
    <svg
      width="19"
      height="19"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.4"
      aria-hidden="true"
      focusable="false"
    >
      {name === "dialog" ? (
        <path d="M4 4h16v12H9l-5 4V4Zm4 4h8M8 12h5" />
      ) : name === "map" ? (
        <path d="M3 3h7v7H3zM14 3h7v7h-7zM3 14h7v7H3zM14 14h7v7h-7z" />
      ) : name === "plan" ? (
        <path d="M6 3h12v18H6zM9 8h6M9 12h6M9 16h4" />
      ) : (
        <path d="M5 19 19 5M6 5h13v13" />
      )}
    </svg>
  );
}
