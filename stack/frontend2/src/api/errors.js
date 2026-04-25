/**
 * api/errors.js
 *
 * Centralised error classification.
 * Every service function calls classifyError() before returning,
 * so the UI always gets a consistent, human-readable message.
 */

/** HTTP status codes we handle explicitly */
export const HTTP = {
  BAD_REQUEST:  400,
  NOT_FOUND:    404,
  CONFLICT:     409,
  RATE_LIMIT:   429,
  SERVER_ERROR: 500,
  BAD_GATEWAY:  502,
};

/**
 * Extract the raw error message from an axios error.
 * Checks nested backend envelope first: { error: { message } }
 */
export function extractMessage(err) {
  return (
    err?.response?.data?.error?.message ||
    err?.response?.data?.message        ||
    err?.message                         ||
    'Request failed'
  );
}

/**
 * Map a raw error message + HTTP status to a user-friendly string.
 * Used by every service function so pages never see raw backend text.
 */
export function friendlyMessage(raw = '', status = 0) {
  const s = String(raw).toLowerCase();

  if (status === HTTP.RATE_LIMIT || s.includes('too many') || s.includes('rate limit')) {
    return 'Too many requests. Please wait a minute and try again.';
  }
  if (status === HTTP.NOT_FOUND || s.includes('not found')) {
    return 'Job not found. Please re-submit your images.';
  }
  if (status === HTTP.CONFLICT || s.includes('not completed') || s.includes('not ready')) {
    return 'The report is not ready yet. Please wait for the analysis to complete.';
  }
  if (s.includes('valid email') || s.includes('invalid email')) {
    return 'Please enter a valid email address.';
  }
  if (s.includes('smtp') || s.includes('configuration')) {
    return 'Email delivery is not configured on this server.';
  }
  if (s.includes('timeout') || s.includes('aborted')) {
    return 'The request timed out. Please check your connection and try again.';
  }
  if (s.includes('unsupported') || s.includes('file type') || s.includes('only jpg')) {
    return 'Only JPG and PNG images are supported.';
  }
  if (s.includes('too large') || s.includes('file size')) {
    return 'One or more files exceed the 10 MB limit.';
  }
  if (status >= HTTP.SERVER_ERROR || s.includes('server') || s.includes('internal')) {
    return 'The server encountered an error. Please try again shortly.';
  }

  return raw || 'Something went wrong. Please try again.';
}

/**
 * Build a failed ApiResponse from an axios error.
 */
export function failResponse(err) {
  const status  = err?.response?.status ?? 0;
  const raw     = extractMessage(err);
  const message = friendlyMessage(raw, status);

  return {
    ok:      false,
    status,
    data:    null,
    error:   message,
    _raw:    raw,       // original message, useful for debugging
  };
}
