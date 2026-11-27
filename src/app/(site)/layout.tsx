import { Footer } from "@/components/layout/footer";
import { Header } from "@/components/layout/header";

export default function SiteLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <Header />
      <main className="min-h-[60dvh]">{children}</main>
      <div className="mt-16 bg-brand-900 pb-safe-nav">
        <Footer />
      </div>
    </>
  );
}
