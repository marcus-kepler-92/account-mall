/**
 * @jest-environment jsdom
 */
import "@testing-library/jest-dom";
import { render, screen } from "@testing-library/react";
import { DashboardKpiSection } from "@/app/distributor/(main)/dashboard-kpi-section";

const defaultProps = {
  orderCount: 5,
  level1CommissionTotal: 100,
  level2CommissionTotal: 20,
  inviteeCount: 3,
};

describe("DashboardKpiSection", () => {
  it("shows level1 commission total", () => {
    render(<DashboardKpiSection {...defaultProps} />);
    expect(screen.getByText("¥100.00")).toBeInTheDocument();
    expect(screen.getByText("累计推广奖金")).toBeInTheDocument();
  });

  it("shows order count", () => {
    render(<DashboardKpiSection {...defaultProps} />);
    expect(screen.getByText("5")).toBeInTheDocument();
    expect(screen.getByText("成交订单数")).toBeInTheDocument();
  });

  it("shows level2 commission total and invitee count", () => {
    render(<DashboardKpiSection {...defaultProps} />);
    expect(screen.getByText("¥20.00")).toBeInTheDocument();
    expect(screen.getByText(/3 人团队/)).toBeInTheDocument();
  });

  it("formats amounts to 2 decimal places", () => {
    render(
      <DashboardKpiSection
        {...defaultProps}
        level1CommissionTotal={99.9}
        level2CommissionTotal={0.1}
      />,
    );
    expect(screen.getByText("¥99.90")).toBeInTheDocument();
    expect(screen.getByText("¥0.10")).toBeInTheDocument();
  });
});
