import { vi, it, expect } from "vitest";

it("should mock bar", async () => {
  vi.mock("./foo", () => ({
    bar: vi.fn(async (arg: any) => {
      console.log("MOCK CALLED", arg);
      return "mocked:" + JSON.stringify(arg);
    }),
  }));
  const { bar } = await import("./foo");
  const result = await bar({ hello: "world" });
  expect(result).toContain("mocked");
});
