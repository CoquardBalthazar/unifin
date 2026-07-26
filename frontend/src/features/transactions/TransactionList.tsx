import type { Transaction } from "../../types/types";
import { TransactionItem } from "./TransactionItem";

type Props = {
  transactions: Transaction[];
  onDelete: (id: string) => void;
};

export function TransactionList({ transactions, onDelete }: Props) {
  return (
    <ul className="transaction-list">
      {transactions.map((t) => (
        <TransactionItem key={t.id} transaction={t} onDelete={onDelete} />
      ))}
    </ul>
  );
}
