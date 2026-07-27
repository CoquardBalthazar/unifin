import type { Filter } from "../../types/types";

type Props = {
  active: Filter;
  onChange: (next: Filter) => void;
};

const OPTIONS: { value: Filter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "income", label: "Income" },
  { value: "expense", label: "Expense" },
];

export function FilterBar({ active, onChange }: Props) {
  return (
    <div className="flex gap-2">
      {OPTIONS.map((opt) => (
        <button
          key={opt.value}
          onClick={() => onChange(opt.value)} // call the Parent
          className={
            active === opt.value
              ? "rounded-full bg-primary px-3 py-1 text-sm font-medium text-white"
              : "rounded-full px-3 py-1 text-sm font-medium text-ink/60 hover:bg-surface-alt"
          }
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}
