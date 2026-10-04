import type { Metadata, Viewport } from "next";
import "@fontsource/ibm-plex-sans/400.css";
import "@fontsource/ibm-plex-sans/500.css";
import "@fontsource/ibm-plex-sans/600.css";
import "@fontsource/fraunces/500.css";
import "@fontsource/fraunces/600.css";
import "@fontsource/jetbrains-mono/400.css";
import "@fontsource/jetbrains-mono/600.css";
import "reactflow/dist/style.css";
import "./globals.css";
import { HealthProvider } from "@/components/layout/health-provider";
import { ExperienceProvider } from "@/components/layout/experience-provider";
import { AppSidebar } from "@/components/layout/app-sidebar";
import { AlertCenter } from "@/components/alerts/alert-center";
import { getSettings } from "@/lib/services/settings";
import { DEFAULT_EXPERIENCE } from "@/lib/types";

export const metadata: Metadata = {
  title: "IntentGuard",
  description: "An AI assistant whose every action is checked against what you actually asked for.",
};

export const viewport: Viewport = { themeColor: "#1E4D3B" };

export const dynamic = "force-dynamic";

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const experience = await getSettings()
    .then((s) => s.experience)
    .catch(() => DEFAULT_EXPERIENCE);
  return (
    <html lang="en">
      <body className="min-h-screen bg-ink text-fog antialiased">
        <HealthProvider>
          <ExperienceProvider initial={experience}>
            <div className="flex min-h-screen flex-col md:flex-row">
              <AppSidebar />
              <main className="min-w-0 flex-1">{children}</main>
            </div>
            <AlertCenter />
          </ExperienceProvider>
        </HealthProvider>
      </body>
    </html>
  );
}
