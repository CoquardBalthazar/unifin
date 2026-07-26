import type { Transaction } from "../../types/types";

type Props = {
  transaction: Transaction;
  onDelete: (id: string) => void;
};

export function TransactionItem({ transaction, onDelete }: Props) {
  const { id, label, amount, date, category } = transaction;
  const isIncome = amount > 0;
  return (
    <li className="transaction-item">
      <div>
        <span className="label">{label}</span>
        {category && <span className="label">{category}</span>}
      </div>

      <span className="date">{new Date(date).toLocaleDateString("de-DE")}</span>

      <span className={isIncome ? "amount positive" : "amount negative"}>
        {isIncome ? "+" : ""}
        {new Intl.NumberFormat("de-DE", {
          style: "currency",
          currency: "EUR",
        }).format(amount)}
      </span>

      <button onClick={() => onDelete(id)} aria-label={`Delete ${label}`}>
        x
      </button>
    </li>
  );
}
