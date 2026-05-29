/**
 * @jest-environment jsdom
 */
import "@testing-library/jest-dom"
import { render, waitFor } from "@testing-library/react"
import { SiteNameProvider } from "@/app/components/site-name-provider"
import { NotificationTabIndicator } from "@/app/admin/components/notification-tab-indicator"

// Drives the indicator off a controllable count without a QueryClient. The
// favicon/canvas path is inert under jsdom (Image never loads), so these tests
// exercise the document.title behaviour, which is the testable core.
let mockTotalCount = 0
jest.mock("@/app/admin/hooks/use-admin-notifications", () => ({
  useAdminNotifications: () => ({
    totalCount: mockTotalCount,
    sources: [],
    byKey: {},
    isLoading: false,
  }),
}))

let mockVisibility = "visible"
jest.mock("ahooks", () => ({
  useDocumentVisibility: () => mockVisibility,
}))

const SITE = "测试商城"

function renderIndicator() {
  return render(
    <SiteNameProvider siteName={SITE}>
      <NotificationTabIndicator />
    </SiteNameProvider>,
  )
}

beforeEach(() => {
  mockTotalCount = 0
  mockVisibility = "visible"
  document.title = SITE
})

describe("NotificationTabIndicator", () => {
  it("prefixes the title with the unread count", () => {
    mockTotalCount = 3
    renderIndicator()
    expect(document.title).toBe(`(3) ${SITE}`)
  })

  it("leaves the bare site name when there is nothing unread", () => {
    mockTotalCount = 0
    renderIndicator()
    expect(document.title).toBe(SITE)
  })

  it("caps the badge at 99+", () => {
    mockTotalCount = 150
    renderIndicator()
    expect(document.title).toBe(`(99+) ${SITE}`)
  })

  it("updates the prefix when the count changes", () => {
    mockTotalCount = 0
    const { rerender } = renderIndicator()
    expect(document.title).toBe(SITE)

    mockTotalCount = 5
    rerender(
      <SiteNameProvider siteName={SITE}>
        <NotificationTabIndicator />
      </SiteNameProvider>,
    )
    expect(document.title).toBe(`(5) ${SITE}`)
  })

  it("re-asserts the prefix after an external title overwrite", async () => {
    mockTotalCount = 3
    renderIndicator()
    expect(document.title).toBe(`(3) ${SITE}`)

    // Simulate Next rewriting the title on a soft navigation / router.refresh().
    document.title = SITE
    await waitFor(() => expect(document.title).toBe(`(3) ${SITE}`))
  })

  it("restores the bare site name on unmount", () => {
    mockTotalCount = 4
    const { unmount } = renderIndicator()
    expect(document.title).toBe(`(4) ${SITE}`)

    unmount()
    expect(document.title).toBe(SITE)
  })
})

describe("NotificationTabIndicator favicon (away alert)", () => {
  const FAKE_PNG = "data:image/png;base64,FAKE"
  let getContextSpy: jest.SpyInstance
  let toDataUrlSpy: jest.SpyInstance
  let fillText: jest.Mock
  let svgIcon: HTMLLinkElement
  let icoIcon: HTMLLinkElement

  beforeEach(() => {
    document.querySelectorAll('link[rel~="icon"]').forEach((l) => l.remove())

    svgIcon = document.createElement("link")
    svgIcon.setAttribute("rel", "icon")
    svgIcon.setAttribute("type", "image/svg+xml")
    svgIcon.setAttribute("href", "/icon.svg")
    document.head.appendChild(svgIcon)

    icoIcon = document.createElement("link")
    icoIcon.setAttribute("rel", "icon")
    icoIcon.setAttribute("href", "/favicon.ico")
    document.head.appendChild(icoIcon)

    // jsdom has no real canvas; stub the 2D context + toDataURL so the red-disc
    // data URL is produced and we can assert the in-place link mutation.
    fillText = jest.fn()
    const ctx = {
      beginPath: jest.fn(),
      arc: jest.fn(),
      fill: jest.fn(),
      fillText,
      measureText: jest.fn(() => ({ width: 10 })),
      font: "",
      fillStyle: "",
      textAlign: "",
      textBaseline: "",
    }
    getContextSpy = jest
      .spyOn(HTMLCanvasElement.prototype, "getContext")
      .mockReturnValue(ctx as unknown as CanvasRenderingContext2D)
    toDataUrlSpy = jest
      .spyOn(HTMLCanvasElement.prototype, "toDataURL")
      .mockReturnValue(FAKE_PNG)
  })

  afterEach(() => {
    getContextSpy.mockRestore()
    toDataUrlSpy.mockRestore()
    document.querySelectorAll('link[rel~="icon"]').forEach((l) => l.remove())
  })

  it("stays the plain brand icon while the tab is visible", () => {
    mockVisibility = "visible"
    mockTotalCount = 3
    renderIndicator()
    expect(svgIcon.getAttribute("href")).toBe("/icon.svg")
    expect(icoIcon.getAttribute("href")).toBe("/favicon.ico")
    expect(svgIcon.parentNode).toBe(document.head)
  })

  it("flashes the red disc when the tab is hidden with pending items", () => {
    mockVisibility = "hidden"
    mockTotalCount = 3
    renderIndicator()
    // First tick lights the disc immediately; nodes stay attached (no detach —
    // the regression that threw removeChild on a null parent).
    expect(svgIcon.getAttribute("href")).toBe(FAKE_PNG)
    expect(svgIcon.getAttribute("type")).toBe("image/png")
    expect(svgIcon.parentNode).toBe(document.head)
    expect(icoIcon.parentNode).toBe(document.head)
  })

  it("draws the unread count on the badge", () => {
    mockVisibility = "hidden"
    mockTotalCount = 7
    renderIndicator()
    expect(fillText).toHaveBeenCalledWith("7", expect.any(Number), expect.any(Number))
  })

  it("draws 99+ on the badge beyond the cap", () => {
    mockVisibility = "hidden"
    mockTotalCount = 150
    renderIndicator()
    expect(fillText).toHaveBeenCalledWith("99+", expect.any(Number), expect.any(Number))
  })

  it("does not flash when hidden but nothing is pending", () => {
    mockVisibility = "hidden"
    mockTotalCount = 0
    renderIndicator()
    expect(svgIcon.getAttribute("href")).toBe("/icon.svg")
  })

  it("toggles back to the brand icon on the next flash tick", () => {
    jest.useFakeTimers()
    try {
      mockVisibility = "hidden"
      mockTotalCount = 3
      renderIndicator()
      expect(svgIcon.getAttribute("href")).toBe(FAKE_PNG) // tick 1: red disc
      jest.advanceTimersByTime(1200)
      expect(svgIcon.getAttribute("href")).toBe("/icon.svg") // tick 2: brand
      expect(svgIcon.getAttribute("type")).toBe("image/svg+xml")
    } finally {
      jest.useRealTimers()
    }
  })

  it("flashes the live icon nodes after Next replaces them on refresh", () => {
    // Regression: caching node refs at mount went stale once router.refresh()
    // (VisibilityRefresh on refocus) swapped the icon <link>s, and the flash
    // silently died after the first tab switch.
    mockVisibility = "hidden"
    mockTotalCount = 3
    const { rerender } = renderIndicator()
    expect(svgIcon.getAttribute("href")).toBe(FAKE_PNG)

    // Refocus → router.refresh() replaces the head icon nodes.
    mockVisibility = "visible"
    rerender(
      <SiteNameProvider siteName={SITE}>
        <NotificationTabIndicator />
      </SiteNameProvider>,
    )
    svgIcon.remove()
    icoIcon.remove()
    const newSvg = document.createElement("link")
    newSvg.setAttribute("rel", "icon")
    newSvg.setAttribute("type", "image/svg+xml")
    newSvg.setAttribute("href", "/icon.svg")
    document.head.appendChild(newSvg)

    // Leave again → must flash the NEW live node, not the stale detached one.
    mockVisibility = "hidden"
    rerender(
      <SiteNameProvider siteName={SITE}>
        <NotificationTabIndicator />
      </SiteNameProvider>,
    )
    expect(newSvg.getAttribute("href")).toBe(FAKE_PNG)
  })
})
