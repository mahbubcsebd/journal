/**
 * Interface language. Text is written in English in the code; `translate`
 * looks up the Bangla version by the English text, and falls back to English
 * where no translation exists yet. `{name}` placeholders are filled from params.
 */
export type Locale = "en" | "bn";
export const LOCALE_COOKIE = "jr_locale";

type Params = Record<string, string | number>;

export function translate(locale: Locale, text: string, params?: Params) {
  let out = locale === "bn" ? (BN[text] ?? text) : text;
  if (params) for (const [k, v] of Object.entries(params)) out = out.replaceAll(`{${k}}`, String(v));
  return out;
}

export const isLocale = (v: unknown): v is Locale => v === "en" || v === "bn";

export const BN: Record<string, string> = {
  // Navigation
  Overview: "ওভারভিউ",
  Dashboard: "ড্যাশবোর্ড",
  "AI Coach": "AI কোচ",
  Calendar: "ক্যালেন্ডার",
  News: "নিউজ",
  Sessions: "সেশন",
  Trades: "ট্রেড",
  Analytics: "অ্যানালিটিক্স",
  Reports: "রিপোর্ট",
  Journal: "জার্নাল",
  "Daily journal": "দৈনিক জার্নাল",
  Notebook: "নোটবুক",
  Playbook: "প্লেবুক",
  Psychology: "সাইকোলজি",
  Discipline: "শৃঙ্খলা",
  Goals: "লক্ষ্য",
  "Risk tools": "রিস্ক টুল",
  Challenges: "চ্যালেঞ্জ",
  "AI insights": "AI ইনসাইট",
  Data: "ডাটা",
  Accounts: "অ্যাকাউন্ট",
  Import: "ইমপোর্ট",
  "Tags & mistakes": "ট্যাগ ও ভুল",
  Settings: "সেটিংস",
  Home: "হোম",
  More: "আরও",
  Menu: "মেনু",

  // Header
  "All accounts": "সব অ্যাকাউন্ট",
  "No accounts": "কোনো অ্যাকাউন্ট নেই",
  "Manage accounts": "অ্যাকাউন্ট ম্যানেজ",
  Live: "লাইভ",
  Backtest: "ব্যাকটেস্ট",
  All: "সব",
  "Real trades only": "শুধু আসল ট্রেড",
  "Only trades marked as backtest": "শুধু ব্যাকটেস্ট ট্রেড",
  "Live and backtest together": "লাইভ আর ব্যাকটেস্ট একসাথে",
  "Search or jump to…": "খুঁজুন বা যান…",
  Search: "খুঁজুন",
  "Trading accounts": "ট্রেডিং অ্যাকাউন্ট",
  "Light theme": "লাইট থিম",
  "Dark theme": "ডার্ক থিম",
  "Sign out": "সাইন আউট",
  "No major news": "বড় নিউজ নেই",
  "No new trades": "নতুন ট্রেড নয়",
  "Just released": "এইমাত্র প্রকাশিত",
  "High impact": "হাই ইমপ্যাক্ট",
  "Medium impact": "মিডিয়াম ইমপ্যাক্ট",
  "Low impact": "লো ইমপ্যাক্ট",

  // Sessions
  "Market sessions": "মার্কেট সেশন",
  Sydney: "সিডনি",
  Tokyo: "টোকিও",
  London: "লন্ডন",
  "New York": "নিউ ইয়র্ক",
  Open: "খোলা",
  Closed: "বন্ধ",
  "closes in": "বন্ধ হবে",
  "opens in": "খুলবে",
  closes: "বন্ধ হবে",
  "Closes {t}": "বন্ধ {t}",
  "Opens {t}": "খুলবে {t}",
  "Closes in": "বন্ধ হবে",
  "Opens in": "খুলবে",
  "Between sessions": "সেশনের মাঝে",
  "Market closed": "মার্কেট বন্ধ",
  "Market closed for the weekend": "উইকেন্ডে মার্কেট বন্ধ",
  "Sessions & your performance": "সেশন ও আপনার পারফরম্যান্স",
  "Open now": "এখন খোলা",
  "Next to open": "পরে খুলবে",
  "until {name} closes at {t}": "{name} বন্ধ হবে {t}-এ",
  "until the market reopens ({t})": "মার্কেট আবার খুলবে ({t})",
  "opens {t} your time": "আপনার সময় {t}-এ খুলবে",
  "{t} your time": "আপনার সময় {t}",
  Activity: "অ্যাক্টিভিটি",
  "Today in your time": "আজ, আপনার সময়ে",
  "{name} overlap": "{name} ওভারল্যাপ",
  "{t} left": "{t} বাকি",
  "Your performance by session": "সেশন অনুযায়ী আপনার পারফরম্যান্স",
  "Where you trade": "কোথায় ট্রেড করেন",
  "Net P&L by session": "সেশন অনুযায়ী নেট P&L",
  "Where your losses come from": "লস কোথা থেকে আসে",
  "Where your profits come from": "লাভ কোথা থেকে আসে",
  "Session × weekday": "সেশন × বার",
  "High-impact news by session": "সেশন অনুযায়ী হাই-ইমপ্যাক্ট নিউজ",
  "How each session trades": "কোন সেশন কেমন চলে",
  "Ask coach": "কোচকে জিজ্ঞেস",
  trades: "ট্রেড",
  lost: "লস",
  won: "লাভ",

  // Page headers
  "Which session is open, when the next one starts, and how you trade in each.": "কোন সেশন খোলা, পরেরটা কখন, আর প্রতিটায় আপনি কেমন ট্রেড করেন।",
  "Size every position before you click buy or sell.": "বাই বা সেল চাপার আগে প্রতিটা পজিশনের সাইজ ঠিক করুন।",
  "Economic calendar": "অর্থনৈতিক ক্যালেন্ডার",
  "Know every release before it hits your chart.": "চার্টে লাগার আগেই প্রতিটা নিউজ জানুন।",
  "Your setups, the rules behind them, and what each one actually earns.": "আপনার সেটআপ, তার নিয়ম, আর প্রতিটা আসলে কত আয় করে।",
  "A clean summary of any period — print it, export it, or share it.": "যেকোনো সময়ের পরিষ্কার সারাংশ — প্রিন্ট, এক্সপোর্ট বা শেয়ার করুন।",
  "Ideas, research, reviews and lessons — everything that isn't tied to a single trade.": "আইডিয়া, রিসার্চ, রিভিউ আর শিক্ষা — যা একটা ট্রেডের সাথে বাঁধা নয়।",
  "Track prop-firm style evaluations: profit target, drawdown floor, daily loss and minimum days.": "প্রপ-ফার্মের মতো চ্যালেঞ্জ ট্র্যাক করুন: প্রফিট টার্গেট, ড্রডাউন, দৈনিক লস আর ন্যূনতম দিন।",
  "Every trading day, green or red. Click a day to see what happened.": "প্রতিটা ট্রেডিং দিন, সবুজ বা লাল। কী হয়েছিল দেখতে দিনে ক্লিক করুন।",
  "A coach that reads your trades and journal, and tells you what to fix next.": "একজন কোচ যে আপনার ট্রেড আর জার্নাল পড়ে বলে এরপর কী ঠিক করতে হবে।",
  "How discipline, emotions and tilt show up in your P&L.": "শৃঙ্খলা, আবেগ আর টিল্ট আপনার P&L-এ কীভাবে দেখা দেয়।",
  "Profile, timezone, currency and appearance.": "প্রোফাইল, টাইমজোন, কারেন্সি আর থিম।",
  "Hi, {name}": "হাই, {name}",
  "All time": "সব সময়",
  "{from} – today": "{from} – আজ",

  // Dashboard
  "Net P&L": "নেট P&L",
  "Win rate": "উইন রেট",
  "Profit factor": "প্রফিট ফ্যাক্টর",
  Expectancy: "প্রত্যাশিত আয়",
  "Avg win / avg loss": "গড় লাভ / গড় লস",
  "Max drawdown": "সর্বোচ্চ ড্রডাউন",
  "Green days": "সবুজ দিন",
  "Current streak": "বর্তমান ধারা",
  "{n} trades · {d} days": "{n} ট্রেড · {d} দিন",
  "{w} wins · {l} losses": "{w} জয় · {l} লস",
  "Gross profit ÷ gross loss": "মোট লাভ ÷ মোট লস",
  "Average net per trade": "প্রতি ট্রেডে গড় নেট",
  "Payoff ratio": "পেঅফ রেশিও",
  "Deepest fall from a peak": "চূড়া থেকে সবচেয়ে বড় পতন",
  "{g} green · {r} red": "{g} সবুজ · {r} লাল",
  "Best {g} green · worst {r} red": "সেরা {g} সবুজ · খারাপ {r} লাল",

  // Settings
  "Alerts & app": "অ্যালার্ট ও অ্যাপ",
};
