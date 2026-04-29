/**
 * @jest-environment jsdom
 */
import "@testing-library/jest-dom"
import { render, screen, fireEvent } from "@testing-library/react"
import { OrderCardsTable } from "@/app/admin/(main)/orders/[orderId]/order-cards-table"

jest.mock("next/navigation", () => ({ useRouter: () => ({ refresh: jest.fn() }) }))
jest.mock("sonner", () => ({ toast: { success: jest.fn(), error: jest.fn() } }))

const clipboardMock = { writeText: jest.fn().mockResolvedValue(undefined) }
Object.defineProperty(navigator, "clipboard", { value: clipboardMock, writable: true })

const formattedCard = {
  id: "c1",
  content: "user@example.com----pass123",
  status: "SOLD",
  createdAt: "2024-01-01T00:00:00.000Z",
  productId: "p1",
  resolved: {
    type: "formatted" as const,
    fields: [
      { label: "账号", value: "user@example.com" },
      { label: "密码", value: "pass123" },
    ],
  },
}

const plainCard = {
  id: "c2",
  content: "XXXX-YYYY-ZZZZ",
  status: "UNSOLD",
  createdAt: "2024-01-02T00:00:00.000Z",
  productId: "p1",
  resolved: { type: "plain" as const, content: "XXXX-YYYY-ZZZZ" },
}

describe("OrderCardsTable", () => {
  it("renders content in the table", () => {
    render(<OrderCardsTable cards={[formattedCard]} />)
    expect(screen.getByText("user@example.com----pass123")).toBeInTheDocument()
  })

  it("opens sheet with parsed fields when row is clicked", () => {
    render(<OrderCardsTable cards={[formattedCard]} />)
    fireEvent.click(screen.getByText("user@example.com----pass123"))
    expect(screen.getByText("账号")).toBeInTheDocument()
    expect(screen.getByText("user@example.com")).toBeInTheDocument()
    expect(screen.getByText("密码")).toBeInTheDocument()
    expect(screen.getByText("pass123")).toBeInTheDocument()
  })

  it("shows raw content for plain card in sheet", () => {
    render(<OrderCardsTable cards={[plainCard]} />)
    fireEvent.click(screen.getByText("XXXX-YYYY-ZZZZ"))
    expect(screen.getAllByText("XXXX-YYYY-ZZZZ").length).toBeGreaterThan(0)
  })

  it("calls clipboard.writeText when single field copy button clicked", async () => {
    render(<OrderCardsTable cards={[formattedCard]} />)
    fireEvent.click(screen.getByText("user@example.com----pass123"))
    const copyBtns = screen.getAllByLabelText("复制账号")
    fireEvent.click(copyBtns[0])
    expect(clipboardMock.writeText).toHaveBeenCalledWith("user@example.com")
  })
})
