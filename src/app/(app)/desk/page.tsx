import type { Metadata } from "next";
import Desk from "@/components/desk/Desk";

export const metadata: Metadata = { title: "SMC Desk" };

/** Live SMC charts, scanner, backtest and reaction zones (data from the SMC server via /api/desk). */
export default function DeskPage() {
  return <Desk />;
}
