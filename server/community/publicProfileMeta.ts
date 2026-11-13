/** Static public HTML sharing metadata. Only whitelisted, public information reaches this helper. */
export type PublicShareMetadata = {
  title: string;
  description: string;
  canonicalUrl: string;
  type: "profile" | "article";
};

export function safePublicShareText(value: unknown, max: number): string {
  return typeof value === "string"
    ? value.replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " ").trim().slice(0, max)
    : "";
}

export function escapePublicHtml(value: string): string {
  return value.replace(/[&<>"']/g, c => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  })[c]!);
}

/** No meta element is ever generated from arbitrary request Host/Origin headers. */
export function injectPublicShareMetadata(html: string, data: PublicShareMetadata): string {
  if (!/<\/head\s*>/i.test(html)) return html;
  const title = escapePublicHtml(safePublicShareText(data.title, 180));
  const description = escapePublicHtml(safePublicShareText(data.description, 200));
  const url = new URL(data.canonicalUrl);
  if (!["https:", "http:"].includes(url.protocol) || url.username || url.password)
    throw new Error("Некоректна канонічна адреса");
  const canonical = escapePublicHtml(url.toString());
  const original = html.replace(/<title>[\s\S]*?<\/title>/i, "").replace(/<meta\s+name=["']description["'][^>]*>/i, "");
  const tags = [
    `<title>${title}</title>`,
    `<meta name="description" content="${description}" />`,
    `<link rel="canonical" href="${canonical}" />`,
    `<meta property="og:site_name" content="h00k Community" />`,
    `<meta property="og:type" content="${data.type}" />`,
    `<meta property="og:title" content="${title}" />`,
    `<meta property="og:description" content="${description}" />`,
    `<meta property="og:url" content="${canonical}" />`,
    `<meta name="twitter:card" content="summary" />`,
    `<meta name="twitter:title" content="${title}" />`,
    `<meta name="twitter:description" content="${description}" />`,
  ].join("\n");
  return original.replace(/<\/head\s*>/i, tags + "\n</head>");
}
