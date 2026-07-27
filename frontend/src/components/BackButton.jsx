export default function BackButton({
  onClick,
  text = "Back",
}) {
  return (
    <button
      className="back-btn"
      onClick={onClick}
    >
      ← {text}
    </button>
  );
}