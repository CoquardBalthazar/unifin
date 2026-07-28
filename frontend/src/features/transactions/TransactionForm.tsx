import { useState } from "react";
import type { Transaction } from "../../types/types";

type Props = {
  onAdd: (t: Omit<Transaction, "id">) => void;
};

export function TransactionForm({ onAdd }: Props) {
  const [label, setLabel] = useState("");
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState("");
  const [category, setCategory] = useState("");

  function handleSubmit(e: React.SubmitEvent<HTMLFormElement>) {
    e.preventDefault(); // avoid default form behavior
    onAdd({
      label,
      amount: Number(amount),
      date,
      category,
    });

    // Cleanup UI once given to parent
    setLabel("");
    setAmount("");
    setDate("");
    setCategory("");
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-wrap gap-2">
      <input
        value={label}
        onChange={(e) => setLabel(e.target.value)}
        placeholder="Label"
        className="rounded-(--radius-DEFAULT) border border-border px-2 py-1"
      />
      <input
        type="number"
        value={amount}
        onChange={(e) => setAmount(e.target.value)}
        placeholder="Amount"
        className="rounded-(--radius-DEFAULT) border border-border px-2 py-1"
      />
      <input
        type="date"
        value={date}
        onChange={(e) => setDate(e.target.value)}
        className="rounded-(--radius-DEFAULT) border border-border px-2 py-1"
      />
      <input
        value={category}
        onChange={(e) => setCategory(e.target.value)}
        placeholder="Category"
        className="rounded-(--radius-DEFAULT) border border-border px-2 py-1"
      />
      <button
        type="submit"
        className="rounded-full bg-primary px-3 py-1 text-sm font-medium text-white"
      >
        Add
      </button>
    </form>
  );
}
