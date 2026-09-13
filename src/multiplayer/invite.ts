export const INVITE_MESSAGE = "Lust auf eine Runde GO DR*W YOURSELF mit mir?";

export function buildInviteText(joinUrl: string): string {
  return `${INVITE_MESSAGE}\n${joinUrl}`;
}

export function buildInviteShareData(joinUrl: string): ShareData {
  // Deliberately URL-only: WhatsApp (and most share targets) render a big,
  // properly-proportioned OG-image card only for a message that IS just a
  // link. Adding our own text/title here made WhatsApp treat it as a text
  // message with an auto-linkified URL instead, which gets its own tiny,
  // squashed inline preview - losing the branded card entirely. The site's
  // own og:title/og:description already carry the same invite line, so
  // nothing is lost by leaving them out of the share payload.
  return { url: joinUrl };
}
