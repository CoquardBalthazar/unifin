/// <reference types="cypress" />

describe("Navigation", () => {
  it("navigates from Dashboard to Transactions and back", () => {
    cy.visit("/");
    cy.contains("h1", /dashboard/i);

    // Navigate to Transactions (via NavBar)
    cy.contains("a", "Transactions").click();
    cy.url().should("match", /transactions/i);
    cy.should("include", "/transactions");

    // Navigate back to Home (DashboardPage)
    cy.contains("a", "Home").click();
    cy.url().should("eq", "http://localhost:5173/");
  });
  it("navigates to /transactions via the See all button on the dashboard", () => {
    cy.visit("/");
    cy.contains("button", /see all/i).click();
    cy.url().should("include", "/transactions");
  });

  it("supports the browser back button after navigating", () => {
    cy.visit("/");
    cy.contains("a", "Transactions").click();
    cy.url().should("include", "/transactions");

    cy.go("back");
    cy.url().should("eq", "http://localhost:5173/");
    cy.contains("h1", "Dashboard");
  });
});
