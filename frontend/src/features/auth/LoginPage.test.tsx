import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { it, describe } from "vitest";
import { LoginPage } from "./LoginPage";
describe("LoginPage", () => {
  it("fills in and submits without throwing", async () => {
    render(<LoginPage />);

    await userEvent.type(
      screen.getByPlaceholderText("Email"),
      "me@example.com",
    );
    await userEvent.type(screen.getByPlaceholderText("Password"), "hunter2");
    await userEvent.click(screen.getByRole("button", { name: "Log in" }));
  });
});
