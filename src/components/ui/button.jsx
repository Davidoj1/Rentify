export function Button({ children, className, variant = 'default' }) {
  const styles =
    variant === 'outline'
      ? 'border border-gray-300 bg-white text-gray-800'
      : 'bg-purple-600 text-white';

  return (
    <button className={`px-4 py-1 rounded ${styles} ${className}`}>
      {children}
    </button>
  );
}
