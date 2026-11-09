export function signatureLinkExpired(expiresAt: string, now = Date.now()) {
  const expiry = Date.parse(expiresAt);
  return !Number.isFinite(expiry) || expiry <= now;
}

export function hasSignatureConsent(accept: unknown) {
  return accept === true;
}
