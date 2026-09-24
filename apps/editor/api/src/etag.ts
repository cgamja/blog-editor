export const etagOf = (revision: string) => `"${revision}"`;

/** `If-Match: "<revision>"`에서 revision을 꺼낸다. 모양이 다르면 어떤 revision과도 맞지 않는 값이 된다. */
export function revisionFromEtag(etag: string): string {
  const match = /^"([^"]*)"$/.exec(etag.trim());
  return match?.[1] ?? etag;
}
