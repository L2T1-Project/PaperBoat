const ROLE_OPTIONS = [
  { value: "user", label: "General User" },
  { value: "researcher", label: "Researcher" },
  { value: "venue_user", label: "Venue User" },
];

export function RoleSelector({ selectedRole, onChange, disabled = false }) {
  return (
    <div
      className="grid grid-cols-1 gap-2 rounded-xl bg-gray-100 p-2 sm:grid-cols-3"
      role="tablist"
      aria-label="Signup role selector"
    >
      {ROLE_OPTIONS.map((option) => {
        const isActive = selectedRole === option.value;

        return (
          <button
            key={option.value}
            type="button"
            role="tab"
            aria-selected={isActive}
            onClick={() => onChange(option.value)}
            disabled={disabled}
            className={`rounded-lg px-4 py-2 text-sm font-semibold transition-all ${
              isActive
                ? "bg-[#1a6eb5] text-white shadow-sm"
                : "bg-white text-gray-700 hover:bg-gray-50"
            } disabled:cursor-not-allowed disabled:opacity-60`}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
