export function buildEmailHtml(uuid, resultLink) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Your Rice Quality Report</title>
</head>
<body style="margin:0;padding:0;background:#f4f4f5;font-family:Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f5;padding:40px 0;">
    <tr>
      <td align="center">
        <table width="560" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;overflow:hidden;border:1px solid #e4e4e7;">

          <!-- Header -->
          <tr>
            <td style="background:#16a34a;padding:32px 40px;">
              <p style="margin:0;font-size:22px;font-weight:700;color:#ffffff;">Rice Quality Report</p>
              <p style="margin:6px 0 0;font-size:14px;color:#bbf7d0;">Your analysis is ready to view.</p>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="padding:36px 40px;">
              <p style="margin:0 0 20px;font-size:15px;color:#374151;line-height:1.7;">
                Hello,
              </p>
              <p style="margin:0 0 28px;font-size:15px;color:#374151;line-height:1.7;">
                Your rice quality analysis has been completed. The full report is attached to this email as a PDF. You can also view the results online using the link below.
              </p>

              <!-- Result link button -->
              <table cellpadding="0" cellspacing="0" style="margin-bottom:32px;">
                <tr>
                  <td style="background:#16a34a;border-radius:8px;">
                    <a href="${resultLink}" target="_blank"
                       style="display:inline-block;padding:13px 28px;font-size:14px;font-weight:600;color:#ffffff;text-decoration:none;">
                      View Your Report &rarr;
                    </a>
                  </td>
                </tr>
              </table>

              <!-- UUID section -->
              <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:28px;">
                <tr>
                  <td style="background:#f9fafb;border:1px solid #e4e4e7;border-radius:8px;padding:16px 20px;">
                    <p style="margin:0 0 4px;font-size:12px;font-weight:600;color:#6b7280;text-transform:uppercase;letter-spacing:0.05em;">Reference ID</p>
                    <p style="margin:0;font-size:13px;color:#111827;font-family:monospace;word-break:break-all;">${uuid}</p>
                  </td>
                </tr>
              </table>

              <!-- Recovery note -->
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td style="background:#fffbeb;border:1px solid #fde68a;border-radius:8px;padding:14px 18px;">
                    <p style="margin:0;font-size:13px;color:#92400e;line-height:1.6;">
                      <strong>Keep this email.</strong> If you need to access your report later, use the Reference ID or the link above to retrieve it at any time.
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background:#f9fafb;border-top:1px solid #e4e4e7;padding:20px 40px;">
              <p style="margin:0;font-size:12px;color:#9ca3af;line-height:1.6;">
                This report was generated on request. Your email address was not stored and will not be used for any other purpose.
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

export function buildEmailText(uuid, resultLink) {
  return [
    'RICE QUALITY REPORT',
    '===================',
    '',
    'Your rice quality analysis has been completed.',
    'The full report is attached to this email as a PDF.',
    '',
    'VIEW YOUR REPORT ONLINE',
    '-----------------------',
    resultLink,
    '',
    'REFERENCE ID',
    '------------',
    uuid,
    '',
    'Keep this email. Use the Reference ID or the link above to retrieve your report at any time.',
    '',
    '---',
    'This report was generated on request. Your email address was not stored.',
  ].join('\n');
}
