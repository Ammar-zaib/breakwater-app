import { describe, it, expect } from "vitest";
import { roleAtLeast, type AccessRole } from "./access";

const ROLES: AccessRole[] = ["viewer", "editor", "admin", "owner"];

describe("roleAtLeast", () => {
  it("ranks roles viewer < editor < admin < owner", () => {
    for (let i = 0; i < ROLES.length; i++) {
      for (let j = 0; j < ROLES.length; j++) {
        expect(roleAtLeast(ROLES[i], ROLES[j])).toBe(i >= j);
      }
    }
  });

  it("a role always satisfies itself as the minimum", () => {
    for (const role of ROLES) {
      expect(roleAtLeast(role, role)).toBe(true);
    }
  });

  it("a viewer never satisfies a higher minimum", () => {
    expect(roleAtLeast("viewer", "editor")).toBe(false);
    expect(roleAtLeast("viewer", "admin")).toBe(false);
    expect(roleAtLeast("viewer", "owner")).toBe(false);
  });

  it("an owner satisfies every minimum", () => {
    for (const min of ROLES) {
      expect(roleAtLeast("owner", min)).toBe(true);
    }
  });
});
