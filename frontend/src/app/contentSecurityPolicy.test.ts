import { describe, expect, it } from "vitest";
import { buildContentSecurityPolicy } from "../../vite.config";

describe("buildContentSecurityPolicy", () => {
  it("defaults to same-origin connections", () => {
    const policy = buildContentSecurityPolicy(undefined);
    expect(policy).toContain("default-src 'none'");
    expect(policy).toContain("connect-src 'self';");
    expect(policy).not.toContain("unsafe");
  });

  it("allows only the origin of an absolute API URL", () => {
    const policy = buildContentSecurityPolicy("https://api.example.test/v1/graphql");
    expect(policy).toContain("connect-src 'self' https://api.example.test;");
  });

  it("ignores relative API URLs", () => {
    expect(buildContentSecurityPolicy("/graphql")).toContain("connect-src 'self';");
  });
});
