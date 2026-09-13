export const INVITE_MESSAGE = "Lust auf eine Runde GO DR*W YOURSELF mit mir?";

export function buildInviteText(joinUrl: string): string {
  return `${INVITE_MESSAGE}\n${joinUrl}`;
}

export function buildInviteShareData(joinUrl: string): ShareData {
  return {
    title: "GO DR*W YOURSELF",
    text: INVITE_MESSAGE,
    url: joinUrl,
  };
}
