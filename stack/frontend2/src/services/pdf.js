/**
 * services/pdf.js
 * PDF URL builder and email sender — built on top of services/api.js.
 */
import { getPDF, sendEmail } from './api';

/**
 * getPdfUrl(uuid, regenerate?)
 * Returns the direct streaming URL for the PDF.
 */
export function getPdfUrl(uuid, regenerate = false) {
  const res = getPDF(uuid, regenerate);
  return res.data?.url ?? null;
}

/**
 * emailReport(uuid, email)
 * Sends the PDF to an email address.
 * Returns { ok, error, data }.
 */
export async function emailReport(uuid, email) {
  const res = await sendEmail(uuid, email);
  if (!res.ok) return { ok: false, error: res.error, data: null };
  return { ok: true, error: null, data: res.data };
}
