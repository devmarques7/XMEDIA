import { describe, expect, it } from "vitest";
import { inviteState, needsInviteAction } from "./inviteState";

const base = { status: "draft" as const, active: true, email: "a@x.com", invited_at: null, invite_expires_at: null, registered_at: null, last_login_at: null };
const now = new Date("2026-10-16T12:00:00Z");

describe("inviteState", () => {
  it("cada etapa do convite", () => {
    expect(inviteState(base, now)).toBe("not_invited");
    expect(inviteState({ ...base, status: "invited", invited_at: "2026-10-15T10:00:00Z", invite_expires_at: "2026-10-22T10:00:00Z" }, now)).toBe("pending");
    expect(inviteState({ ...base, status: "invited", invited_at: "2026-10-01T10:00:00Z", invite_expires_at: "2026-10-08T10:00:00Z" }, now)).toBe("expired");
    expect(inviteState({ ...base, status: "active", invited_at: "2026-10-01T10:00:00Z", registered_at: "2026-10-02T10:00:00Z" }, now)).toBe("registered");
    expect(inviteState({ ...base, status: "active", registered_at: "2026-10-02T10:00:00Z", last_login_at: "2026-10-10T08:00:00Z" }, now)).toBe("active");
    expect(inviteState({ ...base, status: "disabled", last_login_at: "2026-10-10T08:00:00Z" }, now)).toBe("disabled");
    expect(inviteState({ ...base, active: false }, now)).toBe("disabled");
  });
  it("o que pede ação do admin", () => {
    expect(["not_invited", "pending", "expired", "registered"].every((s) => needsInviteAction(s as never))).toBe(true);
    expect(needsInviteAction("active")).toBe(false);
  });
});
