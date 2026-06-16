export function EmptyState({
  icon,
  title,
  description,
  action,
}: {
  icon?: string;
  title: string;
  description?: string;
  action?: { label: string; onClick: () => void };
}) {
  return (
    <div className="bg-white dark:bg-gray-800 p-12 rounded-lg shadow-sm text-center">
      {icon && <div className="text-4xl mb-3">{icon}</div>}
      <p className="text-gray-400 dark:text-gray-500 text-lg">{title}</p>
      {description && (
        <p className="text-gray-400 dark:text-gray-500 text-sm mt-1">{description}</p>
      )}
      {action && (
        <button
          onClick={action.onClick}
          className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700 transition-colors"
        >
          {action.label}
        </button>
      )}
    </div>
  );
}
