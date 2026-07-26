import type { Transaction } from "../../types/types";
import { TransactionItem } from "./TransactionItem";

type Props = {
  transactions: Transaction[];
};

export function TransactionList({ transactions }: Props) {
  return (
    <ul className="transaction-list">
      {transactions.map((t) => (
        <TransactionItem key={t.id} transaction={t} />
      ))}
    </ul>
  );
}
