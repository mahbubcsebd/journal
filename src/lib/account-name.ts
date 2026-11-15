/**
 * Default name for an account the MT5 EA adds by itself (MT5 doesn't expose
 * the nickname set in Exness Personal Area), e.g. "Real ··5770".
 */
export function defaultAccountName(login: string, opts: { cent: boolean; demo: boolean }) {
  return `${opts.cent ? "Cent" : opts.demo ? "Demo" : "Real"} ··${login.slice(-4)}`;
}

/** Names the app made up (old "MT5 #123…" style included), so the UI can invite a rename. */
export function isAutoName(nickname: string, login: string) {
  return (
    new RegExp(`^(MT5|Cent) #${login}$`).test(nickname) ||
    /^(Real|Demo|Cent) ··\d{1,4}$/.test(nickname) ||
    nickname === login
  );
}
