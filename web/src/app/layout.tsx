import type { Metadata } from "next";
import { Be_Vietnam_Pro, Saira_Condensed } from "next/font/google";
import type { ReactNode } from "react";

import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";

import "./globals.css";

const displayFont = Saira_Condensed({
  variable: "--font-display",
  subsets: ["latin", "vietnamese"],
  weight: ["500", "600", "700"],
});

const bodyFont = Be_Vietnam_Pro({
  variable: "--font-body",
  subsets: ["latin", "vietnamese"],
  weight: ["400", "500", "600", "700"],
});

export const metadata: Metadata = {
  title: {
    default: "VNR202 - Mạch Quyết Sách",
    template: "%s | VNR202",
  },
  description: "Khám phá lịch sử Việt Nam qua hồ sơ dữ kiện, mạch nguyên nhân và những quyết sách có thật.",
};

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="vi" className={`${displayFont.variable} ${bodyFont.variable}`}>
      <body>
        <a className="skip-link" href="#main-content">
          Bỏ qua điều hướng
        </a>
        <SiteHeader />
        <main id="main-content">{children}</main>
        <SiteFooter />
      </body>
    </html>
  );
}
