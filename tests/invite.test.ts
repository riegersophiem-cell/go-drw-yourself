import { describe, expect, it } from "vitest";
import { buildInviteShareData, buildInviteText, INVITE_MESSAGE } from "../src/multiplayer/invite";

const joinUrl = "https://go-drw-yourself.vercel.app/join/M4X82N";

describe("room invitation", () => {
  it("builds a ready-to-send message with the exact room link", () => {
    expect(buildInviteText(joinUrl)).toBe(`${INVITE_MESSAGE}\n${joinUrl}`);
  });

  it("builds Web Share data as a bare URL, so targets render their own OG-image link card instead of a plain-text message with a tiny auto-linkified preview", () => {
    expect(buildInviteShareData(joinUrl)).toEqual({ url: joinUrl });
  });
});
