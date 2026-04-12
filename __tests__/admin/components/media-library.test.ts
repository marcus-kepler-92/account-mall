import { formatSize, fileNameFromPath, isImagePath } from "@/app/admin/components/media-library"

describe("formatSize", () => {
  it("formats bytes", () => expect(formatSize(512)).toBe("512 B"))
  it("formats KB", () => expect(formatSize(1536)).toBe("1.5 KB"))
  it("formats MB", () => expect(formatSize(2 * 1024 * 1024)).toBe("2.00 MB"))
})

describe("fileNameFromPath", () => {
  it("extracts filename from path", () =>
    expect(fileNameFromPath("products/abc-123.jpg")).toBe("abc-123.jpg"))
  it("returns input when no slash", () =>
    expect(fileNameFromPath("filename.jpg")).toBe("filename.jpg"))
})

describe("isImagePath", () => {
  it("returns true for jpg", () => expect(isImagePath("products/photo.jpg")).toBe(true))
  it("returns true for jpeg", () => expect(isImagePath("photo.jpeg")).toBe(true))
  it("returns true for png uppercase", () => expect(isImagePath("photo.PNG")).toBe(true))
  it("returns true for webp", () => expect(isImagePath("photo.webp")).toBe(true))
  it("returns false for pdf", () => expect(isImagePath("document.pdf")).toBe(false))
  it("returns false for no extension", () => expect(isImagePath("noext")).toBe(false))
})
