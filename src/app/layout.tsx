import type { Metadata } from "next";
import Link from "next/link";
import { IBM_Plex_Mono, IBM_Plex_Sans, Montserrat } from "next/font/google";
import { Analytics } from "@/components/Analytics";
import "./globals.css";

const display = Montserrat({ subsets: ["latin"], weight: ["500", "700", "800"], variable: "--f-display" });
const body = IBM_Plex_Sans({ subsets: ["latin"], weight: ["400", "500", "600"], variable: "--f-body" });
const mono = IBM_Plex_Mono({ subsets: ["latin"], weight: ["400", "500"], variable: "--f-mono" });

export const metadata: Metadata = {
  title: "Cenários de Faturamento | Alpha",
  description: "Compare cenários de faturamento de cotações e apresente à diretoria.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" className={`${display.variable} ${body.variable} ${mono.variable}`}>
      <body>
        <Analytics />
        <div className="site-head">
          <div className="in">
            <Link href="/" aria-label="Alpha Automação de Sistemas Elétricos — início">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/logo-alpha.svg" alt="Alpha Automação de Sistemas Elétricos" />
            </Link>
            <div className="eyebrow">Análise para aprovação da diretoria</div>
          </div>
        </div>
        <div className="wrap">
          {children}
          <footer>
            Valores em reais. Cálculos: ICMS e PIS/COFINS sobre o total bruto; taxa financeira apenas
            sobre as parcelas a prazo.
          </footer>
        </div>
      </body>
    </html>
  );
}
