import { describe, expect, it } from "vitest";
import { buildInviteShareData, buildInviteText, INVITE_MESSAGE } from "../src/multiplayer/invite";

const joinUrl = "https://go-drw-yourself.vercel.app/join/M4X82N";

describe("room invitation", () => {
  it("builds a ready-to-send message with the exact room link", () => {
    expect(buildInviteText(joinUrl)).toBe(`${INVITE_MESSAGE}\n${joinUrl}`);
  });

  it("builds Web Share data with title, invitation, and room link kept separate", () => {
    expect(buildInviteShareData(joinUrl)).toEqual({
      title: "GO DR*W YOURSELF",
      text: "Lust auf eine Runde GO DR*W YOURSELF mit mir?",
      url: joinUrl,
    });
  });
});
