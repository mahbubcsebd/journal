const APP = process.env.NEXT_PUBLIC_APP_NAME ?? "Journal";

export function otpEmail(otp: string) {
  const digits = otp
    .split("")
    .map(
      (d) =>
        `<td style="width:44px;height:52px;border:1px solid #e4e4e7;border-radius:10px;text-align:center;font:600 24px/52px ui-monospace,Menlo,monospace;color:#09090b;background:#fafafa">${d}</td>`,
    )
    .join('<td style="width:8px"></td>');

  const html = `<!doctype html>
<html><body style="margin:0;background:#f4f4f5;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="padding:40px 16px">
    <tr><td align="center">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:440px;background:#ffffff;border-radius:16px;padding:36px 32px;border:1px solid #e4e4e7">
        <tr><td style="font:600 18px/1.2 inherit;color:#09090b;letter-spacing:-0.01em">
          <span style="display:inline-block;width:10px;height:10px;border-radius:3px;background:#10b981;margin-right:8px"></span>${APP}
        </td></tr>
        <tr><td style="padding-top:28px;font:600 22px/1.3 inherit;color:#09090b">Your sign-in code</td></tr>
        <tr><td style="padding-top:8px;font:400 14px/1.6 inherit;color:#52525b">Enter this code to sign in. It expires in 10 minutes.</td></tr>
        <tr><td style="padding-top:24px"><table role="presentation" cellpadding="0" cellspacing="0"><tr>${digits}</tr></table></td></tr>
        <tr><td style="padding-top:28px;font:400 12px/1.6 inherit;color:#a1a1aa">If you didn't request this, you can safely ignore this email. Never share this code with anyone.</td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;

  return {
    subject: `${otp} is your ${APP} sign-in code`,
    html,
    text: `Your ${APP} sign-in code is ${otp}. It expires in 10 minutes.`,
  };
}
