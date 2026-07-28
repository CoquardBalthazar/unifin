import type { Knex } from "knex";

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable("transactions", (table) => {
    table.increments("id").primary();
    table.date("date").notNullable();
    table.string("raw_name").notNullable();
    table.decimal("amount", 10, 2).notNullable();
    table.enu("flow", ["income", "expense"]).notNullable();
    table.timestamp("created_at").defaultTo(knex.fn.now());
  });
}

// Always write down if write up
export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTable("transactions");
}
