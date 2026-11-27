import { BadgeCheck, MapPin, PackageCheck, Recycle, ShieldCheck, Truck, Wallet } from "lucide-react";
import { ButtonLink } from "@/components/ui/button";
import { CategoryGrid } from "@/components/catalog/category-grid";
import { SearchBox } from "@/components/layout/search-box";
import { listRootCategories } from "@/features/catalog/queries";
import { ProductSection } from "@/features/catalog/product-section";

const steps = [
  { icon: Recycle, title: "Anuncie em minutos", text: "Tire fotos, informe tamanho e estado, defina o preço. Pronto." },
  { icon: Wallet, title: "Pagamento protegido", text: "O comprador paga pela plataforma e o valor só é liberado conforme as regras do pagamento." },
  { icon: Truck, title: "Envio rastreado", text: "Etiqueta de envio e rastreio direto no pedido, sem complicação." },
];

const benefits = [
  { icon: MapPin, title: "Perto de você", text: "Peças de Curitiba e Região: frete mais barato e entrega mais rápida." },
  { icon: Recycle, title: "Moda circular", text: "Cada peça repassada é uma peça a menos no lixo e uma nova a menos produzida." },
  { icon: ShieldCheck, title: "Compra segura", text: "Pagamento confirmado no servidor, dados pessoais protegidos e suporte." },
  { icon: BadgeCheck, title: "Vendedores avaliados", text: "Avaliações após cada compra ajudam você a escolher com confiança." },
];

export default async function LandingPage() {
  const categories = await listRootCategories();

  return (
    <>
      {/* Banner principal */}
      <section className="relative overflow-hidden bg-brand-900 text-white">
        <div aria-hidden className="absolute -right-32 -top-32 size-[28rem] rounded-full border-[64px] border-brand/30" />
        <div aria-hidden className="absolute -bottom-40 left-1/3 size-80 rounded-full bg-accent/10 blur-2xl" />
        <div className="relative mx-auto grid max-w-7xl gap-8 px-4 py-12 md:grid-cols-[1.2fr_1fr] md:py-20">
          <div className="space-y-6">
            <span className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-xs font-semibold text-accent">
              <MapPin className="size-3.5" /> Curitiba e Região Metropolitana
            </span>
            <h1 className="text-4xl font-extrabold leading-[1.05] tracking-tight md:text-6xl">
              Compre perto.
              <br />
              Venda fácil.
              <br />
              <span className="text-accent">Desapegue melhor.</span>
            </h1>
            <p className="max-w-lg text-base text-white/75 md:text-lg">
              Roupas, tênis, sapatos e bolsas de segunda mão de gente da sua cidade — com pagamento protegido e envio rastreado.
            </p>
            <SearchBox size="lg" className="max-w-lg [&_input]:border-transparent" />
            <div className="flex flex-wrap gap-3">
              <ButtonLink href="/vender" variant="accent" size="lg">
                Comece a desapegar
              </ButtonLink>
              <ButtonLink href="/explorar" variant="outline" size="lg" className="border-white/30 bg-transparent text-white hover:border-white hover:text-white">
                Explorar produtos
              </ButtonLink>
            </div>
          </div>
          <div className="hidden items-center justify-center md:flex">
            <div className="grid grid-cols-2 gap-4">
              {[
                { label: "Taxa só quando vende", value: "12%" },
                { label: "Para anunciar", value: "Grátis" },
                { label: "Fotos por anúncio", value: "até 8" },
                { label: "Municípios atendidos", value: "29" },
              ].map((s) => (
                <div key={s.label} className="rounded-card bg-white/10 p-6 backdrop-blur">
                  <p className="text-3xl font-extrabold text-accent">{s.value}</p>
                  <p className="mt-1 text-sm text-white/70">{s.label}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <div className="mx-auto max-w-7xl space-y-14 px-4 py-10 md:py-14">
        <section aria-labelledby="cat-title" className="space-y-4">
          <h2 id="cat-title" className="text-xl font-extrabold md:text-2xl">Categorias</h2>
          <CategoryGrid categories={categories} />
        </section>

        <ProductSection title="Produtos em destaque" kind="featured" />
        <ProductSection title="Recém-anunciados" kind="recent" />

        <section id="como-funciona" aria-labelledby="how-title" className="space-y-6">
          <h2 id="how-title" className="text-xl font-extrabold md:text-2xl">Como funciona</h2>
          <ol className="grid gap-4 md:grid-cols-3">
            {steps.map((s, i) => (
              <li key={s.title} className="rounded-card bg-surface p-6 shadow-card">
                <div className="flex items-center gap-3">
                  <span className="grid size-10 place-items-center rounded-full bg-brand text-sm font-extrabold text-white">{i + 1}</span>
                  <s.icon className="size-6 text-brand" />
                </div>
                <h3 className="mt-4 font-bold">{s.title}</h3>
                <p className="mt-1 text-sm text-muted">{s.text}</p>
              </li>
            ))}
          </ol>
        </section>

        <section aria-labelledby="ben-title" className="rounded-card bg-brand-50 p-6 md:p-10">
          <h2 id="ben-title" className="text-xl font-extrabold text-brand-900 md:text-2xl">Por que comprar localmente?</h2>
          <ul className="mt-6 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {benefits.map((b) => (
              <li key={b.title}>
                <b.icon className="size-7 text-brand" />
                <h3 className="mt-3 font-bold text-brand-900">{b.title}</h3>
                <p className="mt-1 text-sm text-brand-900/70">{b.text}</p>
              </li>
            ))}
          </ul>
        </section>

        <section className="flex flex-col items-start gap-4 rounded-card bg-accent p-6 md:flex-row md:items-center md:justify-between md:p-10">
          <div>
            <h2 className="text-xl font-extrabold text-brand-900 md:text-2xl">Tem peça parada no armário?</h2>
            <p className="mt-1 text-brand-900/80">Transforme em dinheiro. Anunciar é grátis e leva poucos minutos.</p>
          </div>
          <ButtonLink href="/vender" variant="dark" size="lg">
            <PackageCheck className="size-5" /> Quero vender
          </ButtonLink>
        </section>
      </div>
    </>
  );
}
