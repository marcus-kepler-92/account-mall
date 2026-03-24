/**
 * @jest-environment jsdom
 */
import "@testing-library/jest-dom";
import { render, screen } from "@testing-library/react";
import { DashboardKpiSection } from "@/app/distributor/(main)/dashboard-kpi-section";

jest.mock("@/app/components/copy-promo-button", () => ({
  CopyButtonClient: ({ label }: { label: string }) => (
    <button>{label}</button>
  ),
}));

const defaultProps = {
  orderCount: 5,
  level1CommissionTotal: 100,
  level2CommissionTotal: 20,
  withdrawableBalance: 80,
  pendingWithdrawalTotal: 0,
  distributorCode: "PROMO1",
  inviteeCount: 3,
  discountCodeEnabled: false,
  discountPercent: null,
};

describe("DashboardKpiSection — coupon status badge", () => {
  it("shows '未开通' badge when discount code is not enabled", () => {
    render(<DashboardKpiSection {...defaultProps} />);
    expect(screen.getByText("未开通")).toBeInTheDocument();
    expect(screen.queryByText(/已启用/)).not.toBeInTheDocument();
  });

  it("shows '已启用' badge with percentage when enabled and percent is set", () => {
    render(
      <DashboardKpiSection
        {...defaultProps}
        discountCodeEnabled={true}
        discountPercent={8}
      />,
    );
    expect(screen.getByText("已启用 · 8%")).toBeInTheDocument();
    expect(screen.queryByText("未开通")).not.toBeInTheDocument();
  });

  it("shows '已启用' badge without percentage when enabled but percent is null", () => {
    render(
      <DashboardKpiSection
        {...defaultProps}
        discountCodeEnabled={true}
        discountPercent={null}
      />,
    );
    expect(screen.getByText("已启用")).toBeInTheDocument();
    expect(screen.queryByText("未开通")).not.toBeInTheDocument();
  });

  it("shows discount subtitle when enabled with percent", () => {
    render(
      <DashboardKpiSection
        {...defaultProps}
        discountCodeEnabled={true}
        discountPercent={5}
      />,
    );
    expect(screen.getByText(/客户使用此码下单可享 5% 折扣/)).toBeInTheDocument();
  });

  it("does not show discount subtitle when not enabled", () => {
    render(<DashboardKpiSection {...defaultProps} />);
    expect(screen.queryByText(/折扣/)).not.toBeInTheDocument();
  });

  it("does not show discount subtitle when enabled but percent is null", () => {
    render(
      <DashboardKpiSection
        {...defaultProps}
        discountCodeEnabled={true}
        discountPercent={null}
      />,
    );
    expect(screen.queryByText(/折扣/)).not.toBeInTheDocument();
  });

  it("always shows distributor code", () => {
    render(<DashboardKpiSection {...defaultProps} />);
    expect(screen.getByText("PROMO1")).toBeInTheDocument();
  });
});
