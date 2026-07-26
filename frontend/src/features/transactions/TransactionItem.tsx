import type { Transaction } from "../../types/types";

type Props = {
  transaction: Transaction;
  onDelete: (id: string) => void;
};

export function TransactionItem({ transaction, onDelete }: Props) {
  const { id, label, amount, date, category } = transaction;
  const isIncome = amount > 0;
  return (
    <li className="flex items-center justify-between gap-4 rounded-(--radius-DEFAULT) border border-border bg-surface px-4 py-3">
      <div className="flex min-w-0 flex-col">
        <span className="truncate font-medium text-ink">{label}</span>
        {category && (
          <span className="w-fit rounded-full bg-secondary/10 px-2 py-0.5 text-xs text-secondary">
            {category}
          </span>
        )}
      </div>

      <span className="shrink-0 text-sm text-ink/60">
        {new Date(date).toLocaleDateString("de-DE")}
      </span>

      <span
        className={
          isIncome
            ? "shrink-0 font-semibold text-income"
            : "shrink-0 font-semibold text-expense"
        }
      >
        {isIncome ? "+" : ""}
        {new Intl.NumberFormat("de-DE", {
          style: "currency",
          currency: "EUR",
        }).format(amount)}
      </span>

      <button
        onClick={() => onDelete(id)}
        aria-label={`Delete ${label}`}
        className="shrink-0 rounded-full px-2 py-1 text-ink/40 hover:bg-expense-soft hover:text-expense"
      >
        ×
      </button>
    </li>
  );
}
