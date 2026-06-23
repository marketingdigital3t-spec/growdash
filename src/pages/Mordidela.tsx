import { useEffect, useRef, useState } from "react";
import {
  DollarSign,
  Clock,
  Award,
  Megaphone,
  Truck,
  Utensils,
  Beef,
  TrendingUp,
  Quote,
  Store,
  Settings as Gear,
  BarChart3,
  Star,
  Circle,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  MessageCircle,
  Headphones,
  X,
  Instagram,
} from "lucide-react";

const RED = "#E11D2A";
const RED_DARK = "#B8141F";
const GREEN = "#25D366";

// ───────── helpers ─────────
const ph = (seed: string, w = 800, h = 600) =>
  `https://picsum.photos/seed/${encodeURIComponent(seed)}/${w}/${h}`;

function useModal() {
  const [open, setOpen] = useState(false);
  return { open, openModal: () => setOpen(true), closeModal: () => setOpen(false) };
}

// ───────── Section 1 – Scrolling Marquee ─────────
function ScrollingText() {
  const item = "Praça de alimentação completa  |  menor investimento do segmento";
  return (
    <section className="bg-[color:var(--mord-red)] text-white overflow-hidden" style={{ ["--mord-red" as any]: RED }}>
      <div className="flex whitespace-nowrap animate-[marquee_28s_linear_infinite] py-2.5 text-[12px] tracking-[0.18em] font-semibold uppercase">
        {Array.from({ length: 8 }).map((_, i) => (
          <span key={i} className="mx-6">
            {item} &nbsp;|&nbsp;
          </span>
        ))}
      </div>
    </section>
  );
}

// ───────── Section 2 – Hero ─────────
function Hero({ onOpen }: { onOpen: () => void }) {
  return (
    <section className="relative bg-white">
      <div className="mx-auto max-w-7xl px-6 py-12 lg:py-16 grid lg:grid-cols-2 gap-12 items-center">
        <div>
          <img
            src={ph("mordidela-logo", 240, 100)}
            alt="Mordidela"
            className="h-14 w-auto mb-8 rounded"
          />
          <h1 className="text-4xl md:text-5xl lg:text-[56px] font-black leading-[1.02] text-neutral-900">
            Fature até <span className="text-[color:var(--r)]" style={{ ["--r" as any]: RED }}>R$ 1.8 milhão</span> todos os anos com o seu restaurante{" "}
            <span className="italic" style={{ color: RED }}>fast food</span>.
          </h1>

          <div className="mt-10 grid grid-cols-1 sm:grid-cols-2 gap-5 max-w-xl">
            {[
              { Icon: DollarSign, t: "Menor investimento do mercado" },
              { Icon: Clock, t: "Refeição todas as horas do dia" },
              { Icon: Award, t: "Premio top 10 hamburguerias" },
              { Icon: Megaphone, t: "Marketing constante nas mídias sociais" },
            ].map(({ Icon, t }, i) => (
              <div key={i} className="flex items-start gap-3">
                <div
                  className="h-11 w-11 rounded-lg flex items-center justify-center shrink-0 text-white"
                  style={{ background: RED }}
                >
                  <Icon className="h-5 w-5" />
                </div>
                <h3 className="text-[15px] font-bold text-neutral-900 leading-tight pt-1">{t}</h3>
              </div>
            ))}
          </div>

          <div className="mt-8 flex flex-wrap items-center gap-4">
            {[1, 2, 3, 4].map((i) => (
              <img key={i} src={ph(`selo-${i}`, 120, 120)} alt="Selo" className="h-14 w-14 rounded-full object-cover" />
            ))}
          </div>

          <button
            onClick={onOpen}
            className="mt-8 inline-flex items-center gap-2 font-bold text-white px-7 py-4 rounded-md text-[15px] shadow-lg transition hover:brightness-110"
            style={{ background: GREEN }}
          >
            <WhatsAppIcon className="h-5 w-5" /> Receba apresentação via WhatsApp
          </button>
        </div>

        <div className="relative">
          <img
            src="https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=1400&q=80"
            alt="Hambúrguer Mordidela"
            className="w-full rounded-2xl shadow-2xl object-cover aspect-[4/3]"
          />
        </div>
      </div>
    </section>
  );
}

// ───────── Section 3 – Market data drag scroll ─────────
function MarketData() {
  const data = [
    { Icon: Truck, html: <><strong>Delivery</strong> cresce 13,2% em 2024, impulsionando o consumo rápido.</> },
    { Icon: Utensils, html: <><strong>25%</strong> da renda vai para <strong>refeições fora de casa</strong>.</> },
    { Icon: Beef, html: <><strong>95%</strong> dos brasileiros consomem hambúrguer mensalmente.</> },
    { Icon: TrendingUp, html: <><strong>Fast-food</strong> no Brasil: 13,7 milhões de consumidores no primeiro trimestre de 2024.</> },
  ];
  return (
    <section className="bg-neutral-50 border-y border-neutral-200">
      <div className="mx-auto max-w-7xl px-6 py-10 overflow-x-auto">
        <div className="flex items-center gap-6 min-w-max">
          {data.map(({ Icon, html }, i) => (
            <div key={i} className="flex items-center gap-6">
              <div className="flex items-center gap-4 max-w-[320px]">
                <div className="h-12 w-12 rounded-lg flex items-center justify-center text-white shrink-0" style={{ background: RED }}>
                  <Icon className="h-5 w-5" />
                </div>
                <h3 className="text-sm text-neutral-800 leading-snug">{html}</h3>
              </div>
              {i < data.length - 1 && <span className="w-px h-12 bg-neutral-300" />}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ───────── Section 4 – Diferenciais ─────────
function Diferenciais() {
  const items = [
    { img: ph("hamb", 600, 400), title: "Hamburgers", text: "100% Artesanal, receitas próprias e combinações incríveis." },
    { img: ph("pratos", 600, 400), title: "Pratos Feitos", text: "Diversas refeições diárias para você vender o dia todo." },
    { img: ph("sobremesa", 600, 400), title: "Sobremesas", text: "Pratos criativos e no hype das atualidades." },
    { img: ph("exclusivo", 600, 400), title: "Pratos exclusivos", text: "Você pode ter prato da sua cidade." },
  ];
  return (
    <section className="bg-white py-20">
      <div className="mx-auto max-w-7xl px-6 text-center">
        <h2 className="text-4xl md:text-5xl font-black text-neutral-900">Diferenciais que garantem seu sucesso!</h2>
        <h3 className="mt-3 text-sm font-bold tracking-[0.2em]" style={{ color: RED }}>
          PRAÇA DE ALIMENTAÇÃO COMPLETA
        </h3>

        <div className="mt-12 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {items.map((it, i) => (
            <div key={i} className="text-left">
              <div className="aspect-square overflow-hidden rounded-2xl">
                <img src={it.img} alt={it.title} className="w-full h-full object-cover hover:scale-105 transition" />
              </div>
              <h4 className="mt-4 text-xl font-bold text-neutral-900">{it.title}</h4>
              <p className="mt-1 text-sm text-neutral-600">{it.text}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ───────── Contact Form ─────────
function ContactForm({ id, withExtras = true }: { id: string; withExtras?: boolean }) {
  return (
    <form id={id} className="bg-white border border-neutral-200 rounded-2xl p-6 md:p-8 shadow-sm grid gap-4 text-left">
      <div className="grid md:grid-cols-2 gap-4">
        <Field label="Nome" placeholder="Digite seu nome" />
        <Field label="E-mail" placeholder="Digite seu e-mail" />
      </div>
      <div className="grid md:grid-cols-2 gap-4">
        <Field label="Telefone" placeholder="Digite seu telefone" />
        {withExtras && (
          <div className="grid grid-cols-2 gap-3">
            <SelectField label="Estado" options={["AC","AL","AP","AM","BA","CE","DF","ES","GO","MA","MT","MS","MG","PA","PB","PR","PE","PI","RJ","RN","RS","RO","RR","SC","SP","SE","TO"]} placeholder="UF" />
            <Field label="Cidade" placeholder="Digite sua cidade" />
          </div>
        )}
      </div>
      {withExtras && (
        <SelectField
          label="Experiência com negócios"
          placeholder="Já possui experiência anterior com negócios ou franquias?"
          options={["Sim, já tive negócio próprio", "Não, mas quero começar agora"]}
        />
      )}
      <SelectField
        label="Valor de Investimento"
        placeholder="Valor de Investimento"
        options={[
          "R$ 50.000,00 até R$ 64.900,00",
          "R$ 64.900,00 até R$ 99.900,00",
          "R$ 99.900,00 até R$ 159.900,00",
          "Acima de R$ 159.900,00",
        ]}
      />
      <button
        type="button"
        className="mt-2 inline-flex items-center justify-center gap-2 font-bold text-white px-6 py-3.5 rounded-md transition hover:brightness-110"
        style={{ background: GREEN }}
      >
        <WhatsAppIcon className="h-5 w-5" /> Fale com um consultor
      </button>
      <p className="text-[11px] text-neutral-500 text-center">
        Ao enviar os dados acima, eu concordo em receber contatos e mensagens por meio do WhatsApp, Telefones e E-mails.
      </p>
    </form>
  );
}

function Field({ label, placeholder }: { label: string; placeholder: string }) {
  return (
    <label className="grid gap-1.5">
      <span className="text-xs font-semibold text-neutral-700">{label}</span>
      <input
        placeholder={placeholder}
        className="rounded-md border border-neutral-300 px-3 py-2.5 text-sm outline-none focus:border-neutral-900"
      />
    </label>
  );
}
function SelectField({ label, options, placeholder }: { label?: string; options: string[]; placeholder: string }) {
  return (
    <label className="grid gap-1.5">
      {label && <span className="text-xs font-semibold text-neutral-700">{label}</span>}
      <select className="rounded-md border border-neutral-300 px-3 py-2.5 text-sm bg-white outline-none focus:border-neutral-900">
        <option value="">{placeholder}</option>
        {options.map((o) => (
          <option key={o}>{o}</option>
        ))}
      </select>
    </label>
  );
}

// ───────── Section 5 – Form CTA ─────────
function FormSection({ paddingTop = true }: { paddingTop?: boolean }) {
  return (
    <section className={`bg-neutral-50 ${paddingTop ? "pt-20" : "pt-0"} pb-20`} id="contato">
      <div className="mx-auto max-w-3xl px-6 text-center">
        <h2 className="text-4xl md:text-5xl font-black text-neutral-900">Fale com a gente</h2>
        <h3 className="mt-3 text-sm font-bold tracking-[0.2em]" style={{ color: RED }}>
          CONVERSE AGORA COM UM CONSULTOR DA MORDIDELA
        </h3>
        <div className="mt-10">
          <ContactForm id="form-top" />
        </div>
      </div>
    </section>
  );
}

// ───────── Section divisor ─────────
function Divider() {
  return (
    <div className="relative h-12 -mt-1">
      <svg viewBox="0 0 1440 60" className="w-full h-full" preserveAspectRatio="none">
        <path d="M0,0 C480,80 960,0 1440,40 L1440,60 L0,60 Z" fill={RED} />
      </svg>
    </div>
  );
}

// ───────── Section 6 – Depoimentos ─────────
function Depoimentos({ onOpen }: { onOpen: () => void }) {
  const items = [
    { city: "Salvador, BA", text: "Entrar para a rede Mordidela foi a melhor decisão que tomei. Com o suporte completo e produtos variados, consigo atender meu público com facilidade e rapidez." },
    { city: "Balneário Camboriú, SC", text: "A Mordidela oferece uma operação simples e muito atrativa. A marca consolidada me ajudou a atrair clientes logo no início, e o retorno foi rápido!" },
    { city: "Ubatuba, SP", text: "Com o mix variado de produtos, posso atender clientes em diferentes horários do dia. A logística própria faz toda a diferença!" },
    { city: "Dourados, MS", text: "O suporte da franquia e a inovação constante no cardápio garantem que sempre ofereçamos algo novo e saboroso. Nossa unidade cresceu muito em pouco tempo!" },
  ];
  const [idx, setIdx] = useState(0);
  return (
    <section className="relative text-white py-20 overflow-hidden" style={{ background: RED }}>
      <div className="mx-auto max-w-7xl px-6 text-center">
        <h2 className="text-4xl md:text-5xl font-black">Experiências que comprovam o sucesso da Mordidela</h2>
        <h3 className="mt-3 text-sm font-bold tracking-[0.2em] opacity-90">O QUE NOSSOS FRANQUEADOS DIZEM!</h3>

        <div className="mt-12 grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {items.map((d, i) => (
            <div
              key={i}
              className={`relative bg-white text-neutral-900 rounded-2xl p-6 text-left transition ${i === idx ? "scale-[1.03] shadow-2xl" : "opacity-90"}`}
            >
              <Quote className="absolute -top-3 -left-3 h-7 w-7 rotate-180 text-white bg-neutral-900 rounded-full p-1.5" />
              <Quote className="absolute -bottom-3 -right-3 h-7 w-7 text-white bg-neutral-900 rounded-full p-1.5" />
              <h3 className="font-bold text-sm" style={{ color: RED }}>Franquia – {d.city}</h3>
              <p className="mt-3 text-sm text-neutral-700 leading-relaxed">"{d.text}"</p>
            </div>
          ))}
        </div>

        <div className="mt-10 flex items-center justify-center gap-3">
          <button onClick={() => setIdx((i) => Math.max(0, i - 1))} className="h-10 w-10 rounded-full bg-white/15 hover:bg-white/25 grid place-items-center">
            <ChevronLeft className="h-5 w-5" />
          </button>
          <button onClick={() => setIdx((i) => Math.min(items.length - 1, i + 1))} className="h-10 w-10 rounded-full bg-white/15 hover:bg-white/25 grid place-items-center">
            <ChevronRight className="h-5 w-5" />
          </button>
        </div>

        <button onClick={onOpen} className="mt-10 inline-flex items-center gap-2 bg-white font-bold px-7 py-4 rounded-md hover:bg-neutral-100 transition" style={{ color: RED }}>
          <WhatsAppIcon className="h-5 w-5" /> Reservar minha área
        </button>
      </div>
    </section>
  );
}

// ───────── Section 7 – Líderes (with video) ─────────
function Lideres({ onOpen }: { onOpen: () => void }) {
  return (
    <section className="bg-white py-20">
      <div className="mx-auto max-w-7xl px-6 grid lg:grid-cols-2 gap-12 items-center">
        <div>
          <h2 className="text-4xl md:text-5xl font-black text-neutral-900">Somos líderes do mercado</h2>
          <h3 className="mt-3 text-sm font-bold tracking-[0.2em]" style={{ color: RED }}>
            FRANQUIA SÓLIDA COM ALTA RENTABILIDADE E SUPORTE TOTAL
          </h3>
          <p className="mt-6 text-neutral-700 leading-relaxed">
            O Grupo ZNTT, com atuação multissetorial, é uma das maiores holdings de franquias do Brasil, abrangendo diversas marcas
            de sucesso. Com essa estrutura robusta, a Mordidela cresce continuamente, oferecendo aos franqueados suporte completo e
            alta rentabilidade.
          </p>

          <div className="mt-8 grid sm:grid-cols-2 gap-5">
            {[
              { Icon: Store, t: "Mais de 3000 unidades." },
              { Icon: Gear, t: "Modelo de negócios de fácil gestão com logística própria." },
              { Icon: Utensils, t: "Cardápio variado: hambúrgueres, sobremesas e pratos executivos." },
              { Icon: BarChart3, t: "Estrutura sólida e alta rentabilidade para franqueados." },
            ].map(({ Icon, t }, i) => (
              <div key={i} className="flex items-start gap-3">
                <div className="h-11 w-11 rounded-lg grid place-items-center text-white shrink-0" style={{ background: RED }}>
                  <Icon className="h-5 w-5" />
                </div>
                <p className="text-sm text-neutral-800 leading-snug pt-1.5">{t}</p>
              </div>
            ))}
          </div>

          <button onClick={onOpen} className="mt-8 inline-flex items-center gap-2 font-bold text-white px-7 py-4 rounded-md transition hover:brightness-110" style={{ background: GREEN }}>
            <WhatsAppIcon className="h-5 w-5" /> Receba apresentação via WhatsApp
          </button>
        </div>

        <div className="aspect-video rounded-2xl overflow-hidden shadow-xl bg-black">
          <iframe
            className="w-full h-full"
            src="https://www.youtube.com/embed/HtfL9_8gTU0"
            title="Mordidela"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
          />
        </div>
      </div>
    </section>
  );
}

// ───────── Section 8 – Marcas + Premiações ─────────
function MarcasPremios() {
  return (
    <section className="bg-neutral-50 py-20">
      <div className="mx-auto max-w-7xl px-6 grid lg:grid-cols-2 gap-12 items-start">
        <div className="text-center lg:text-left">
          <h2 className="text-3xl md:text-4xl font-black text-neutral-900">Descubra as marcas que impulsionam nosso sucesso</h2>
          <h3 className="mt-3 text-sm font-bold tracking-[0.2em]" style={{ color: RED }}>CONHEÇA AS PRINCIPAIS MARCAS</h3>
          <div className="mt-8 grid grid-cols-3 sm:grid-cols-5 gap-4">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="aspect-square rounded-xl bg-white border border-neutral-200 grid place-items-center overflow-hidden">
                <img src={ph(`marca-${i}`, 200, 200)} alt={`Marca ${i}`} className="w-full h-full object-cover" />
              </div>
            ))}
          </div>
        </div>
        <div className="lg:border-l lg:pl-12 border-neutral-200 text-center lg:text-left">
          <h2 className="text-3xl md:text-4xl font-black text-neutral-900">Somos premiados</h2>
          <h3 className="mt-3 text-sm font-bold tracking-[0.2em]" style={{ color: RED }}>POSSUÍMOS EXCELÊNCIA EM PREMIAÇÕES E SEGURANÇA</h3>
          <div className="mt-8 flex flex-wrap items-center gap-5 justify-center lg:justify-start">
            {[2, 1, 5, 4].map((i) => (
              <img key={i} src={ph(`selo-l-${i}`, 160, 160)} alt={`Selo ${i}`} className="h-20 w-20 rounded-full object-cover" />
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

// ───────── Section 9 – iFood ratings ─────────
function NotasIfood({ onOpen }: { onOpen: () => void }) {
  const lojas = [
    { nome: "Mordidela Dourados", nota: "5.0", dist: "1.2Km", aberto: true },
    { nome: "Mordidela Salvador", nota: "4.9", dist: "1.0Km", aberto: true },
    { nome: "Mordidela Nova Friburgo", nota: "4.8", dist: "1.5Km", aberto: true },
    { nome: "Mordidela Lagoa da Prata", nota: "4.7", dist: "2.3Km", aberto: false },
    { nome: "Mordidela Divinópolis", nota: "4.7", dist: "0.8Km", aberto: true },
    { nome: "Mordidela Petrópolis", nota: "4.6", dist: "1.8Km", aberto: false },
  ];
  return (
    <section className="bg-white py-20">
      <div className="mx-auto max-w-7xl px-6 text-center">
        <h2 className="text-4xl md:text-5xl font-black text-neutral-900">Crescimento e solidez no Grupo ZNTT</h2>
        <h3 className="mt-3 text-sm font-bold tracking-[0.2em]" style={{ color: RED }}>SOMOS NOTA 5 NO IFOOD!</h3>

        <div className="mt-12 grid sm:grid-cols-2 lg:grid-cols-3 gap-5 text-left">
          {lojas.map((l, i) => (
            <div key={i} className="flex gap-4 p-4 border border-neutral-200 rounded-2xl hover:shadow-lg transition bg-white">
              <div className="h-16 w-16 rounded-xl shrink-0" style={{ background: `linear-gradient(135deg, ${RED}, #FF6B6B)` }} />
              <div className="flex-1">
                <h4 className="font-bold text-neutral-900">{l.nome}</h4>
                <div className="mt-1 flex items-center gap-2 text-xs text-neutral-600">
                  <span className="font-bold text-neutral-900 flex items-center gap-1"><Star className="h-3 w-3 fill-current" /> {l.nota}</span>
                  <Circle className="h-1.5 w-1.5 fill-current" /> <span>Lanches</span>
                  <Circle className="h-1.5 w-1.5 fill-current" /> <span>{l.dist}</span>
                </div>
                <div className="mt-1 flex items-center gap-2 text-xs">
                  <span className={l.aberto ? "text-emerald-600 font-semibold" : "text-red-600 font-semibold"}>{l.aberto ? "Aberto" : "Fechado"}</span>
                  <Circle className="h-1.5 w-1.5 fill-current text-neutral-400" />
                  <span className="text-neutral-600">2.0Km</span>
                </div>
              </div>
            </div>
          ))}
        </div>

        <button onClick={onOpen} className="mt-12 inline-flex items-center gap-2 font-bold text-white px-7 py-4 rounded-md transition hover:brightness-110" style={{ background: GREEN }}>
          <WhatsAppIcon className="h-5 w-5" /> Fale com um consultor
        </button>
      </div>
    </section>
  );
}

// ───────── Section 10 – Modelos de negócio ─────────
function ModelosNegocio({ onOpen }: { onOpen: () => void }) {
  const modelos = [
    { img: ph("loja", 600, 400), nome: "Loja", invest: "R$159.900,00", roi: "12 meses", fat: "R$60.000,00" },
    { img: ph("quiosque", 600, 400), nome: "Quiosque", invest: "R$99.900,00", roi: "12 meses", fat: "R$50.000,00" },
    { img: ph("delivery", 600, 400), nome: "Delivery", invest: "R$64.900,00", roi: "10 meses", fat: "R$40.000,00" },
  ];
  return (
    <section className="bg-neutral-900 text-white py-20">
      <div className="mx-auto max-w-7xl px-6 text-center">
        <h2 className="text-4xl md:text-5xl font-black">Rentável, escalável e fácil de operar</h2>
        <h3 className="mt-3 text-sm font-bold tracking-[0.2em]" style={{ color: "#FFB3B3" }}>MODELO DE NEGÓCIO</h3>

        <div className="mt-12 grid md:grid-cols-3 gap-6">
          {modelos.map((m, i) => (
            <div key={i} className="bg-neutral-800 rounded-2xl overflow-hidden text-left flex flex-col">
              <img src={m.img} alt={m.nome} className="w-full h-48 object-cover" />
              <div className="p-6 flex-1">
                <h3 className="text-2xl font-black">{m.nome}</h3>
                <div className="mt-5 space-y-4">
                  <Spec Icon={DollarSign} label="Valor de investimento:" value={m.invest} />
                  <Spec Icon={Store} label="ROI:" value={m.roi} />
                  <Spec Icon={BarChart3} label="Faturamento bruto:" value={m.fat} />
                </div>
              </div>
            </div>
          ))}
        </div>

        <button onClick={onOpen} className="mt-12 inline-flex items-center gap-2 font-bold text-white px-7 py-4 rounded-md transition hover:brightness-110" style={{ background: GREEN }}>
          <WhatsAppIcon className="h-5 w-5" /> Reservar minha área
        </button>
      </div>
    </section>
  );
}
function Spec({ Icon, label, value }: { Icon: any; label: string; value: string }) {
  return (
    <div className="flex items-start gap-3">
      <div className="h-10 w-10 rounded-lg grid place-items-center shrink-0" style={{ background: RED }}>
        <Icon className="h-4 w-4" />
      </div>
      <div>
        <h3 className="text-xs text-neutral-400">{label}</h3>
        <h4 className="text-lg font-bold">{value}</h4>
      </div>
    </div>
  );
}

// ───────── Section 11 – Instagram ─────────
function InstagramSection({ onOpen }: { onOpen: () => void }) {
  return (
    <section className="bg-white py-20">
      <div className="mx-auto max-w-7xl px-6 grid lg:grid-cols-2 gap-12 items-center">
        <div>
          <h2 className="text-4xl md:text-5xl font-black text-neutral-900">Nosso instagram</h2>
          <h3 className="mt-3 text-sm font-bold tracking-[0.2em]" style={{ color: RED }}>
            CONFIRA NOSSOS MELHORES MOMENTOS E NOVIDADES!
          </h3>
          <button onClick={onOpen} className="mt-8 inline-flex items-center gap-2 font-bold text-white px-7 py-4 rounded-md transition hover:brightness-110" style={{ background: GREEN }}>
            <WhatsAppIcon className="h-5 w-5" /> Fale com um consultor
          </button>
        </div>
        <div className="grid grid-cols-2 gap-3">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="relative aspect-square rounded-xl overflow-hidden group">
              <img src={ph(`post-${i}`, 500, 500)} alt={`Post ${i}`} className="w-full h-full object-cover group-hover:scale-105 transition" />
              <Instagram className="absolute top-3 right-3 h-5 w-5 text-white drop-shadow" />
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ───────── Section 12 – FAQ ─────────
function FAQ() {
  const items = [
    { q: "Qual é o investimento inicial para abrir uma franquia da Mordidela?", a: "O investimento inicial varia de R$ 64.900,00 a R$ 160.000,00, dependendo do modelo e da localização da unidade." },
    { q: "Qual é o retorno esperado do investimento?", a: "O retorno pode ser alcançado em um período de 12 a 18 meses, dependendo de fatores como localização e gestão do negócio." },
    { q: "A Mordidela oferece suporte para os franqueados?", a: "Sim, a Mordidela oferece suporte completo, incluindo treinamento, marketing e gestão, para garantir o sucesso dos franqueados." },
    { q: "Quais são os principais produtos do cardápio?", a: "O cardápio inclui mini porções, hambúrgueres, açaí, churros, batatas fritas e pratos executivos, atendendo a diferentes preferências dos clientes." },
    { q: "A Mordidela é uma franquia com exclusividade territorial?", a: "Sim, cada franqueado tem exclusividade em sua área, evitando concorrência interna." },
  ];
  const [open, setOpen] = useState<number | null>(0);
  return (
    <section className="bg-neutral-50 py-20">
      <div className="mx-auto max-w-3xl px-6 text-center">
        <h2 className="text-4xl md:text-5xl font-black text-neutral-900">Dúvidas frequentes</h2>
        <h3 className="mt-3 text-sm font-bold tracking-[0.2em]" style={{ color: RED }}>
          TUDO O QUE VOCÊ PRECISA SABER SOBRE A FRANQUIA
        </h3>
        <div className="mt-10 space-y-3 text-left">
          {items.map((it, i) => {
            const isOpen = open === i;
            return (
              <div key={i} className="bg-white border border-neutral-200 rounded-xl overflow-hidden">
                <button
                  onClick={() => setOpen(isOpen ? null : i)}
                  className="w-full flex items-center justify-between px-5 py-4 text-left font-semibold text-neutral-900 hover:bg-neutral-50"
                >
                  {it.q}
                  <ChevronDown className={`h-5 w-5 shrink-0 transition ${isOpen ? "rotate-180" : ""}`} style={{ color: RED }} />
                </button>
                {isOpen && (
                  <div className="px-5 pb-5 text-sm text-neutral-700 leading-relaxed">{it.a}</div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

// ───────── Section 13 – Carousel footer ─────────
function CarouselFooter() {
  return (
    <section className="bg-white py-12">
      <div className="mx-auto max-w-7xl px-6 grid grid-cols-2 md:grid-cols-4 gap-4">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="aspect-[4/3] rounded-xl overflow-hidden">
            <img src={ph(`gallery-${i}`, 600, 450)} alt={`Galeria ${i}`} className="w-full h-full object-cover hover:scale-105 transition" />
          </div>
        ))}
      </div>
    </section>
  );
}

// ───────── Footer ─────────
function Footer({ onOpen }: { onOpen: () => void }) {
  return (
    <footer className="bg-neutral-900 text-white pt-16 pb-8">
      <div className="mx-auto max-w-7xl px-6 grid md:grid-cols-4 gap-10">
        <div className="space-y-4">
          <div className="h-10 w-32 bg-white/90 rounded grid place-items-center text-neutral-900 text-xs font-bold">ABF</div>
          <div className="h-10 w-32 bg-white/90 rounded grid place-items-center text-neutral-900 text-xs font-bold">MORDIDELA</div>
        </div>
        <div>
          <h3 className="font-bold mb-3">Informações</h3>
          <p className="text-sm text-neutral-400 leading-relaxed">
            CNPJ: 23.822.259/0001-13<br />
            Razão Social: SUPER MARCAS FRANCHISING LTDA<br />
            Endereço: Av. Marginal Comendador Vicente Filizola, 5280 – Redentora
          </p>
        </div>
        <div>
          <h3 className="font-bold mb-3">Nosso consultor vai te ligar!</h3>
          <p className="text-sm text-neutral-400 leading-relaxed">Vamos te ligar do DDD 17, fique atento nas próximas horas.</p>
          <button onClick={onOpen} className="mt-4 inline-flex items-center gap-2 text-white font-bold px-5 py-3 rounded-md hover:brightness-110 transition" style={{ background: RED }}>
            <Headphones className="h-4 w-4" /> Consultor on-line
          </button>
        </div>
        <div>
          <h3 className="font-bold mb-3">Horário de Atendimento</h3>
          <p className="text-sm text-neutral-400">Seg-Sex: 8:00 - 18:00</p>
        </div>
      </div>
      <div className="mt-12 pt-6 border-t border-white/10 text-center text-xs text-neutral-500">
        Mordidela © 2024 | Desenvolvido por Grupo ZNTT
      </div>
    </footer>
  );
}

// ───────── Floating WhatsApp ─────────
function FloatingWA({ onOpen }: { onOpen: () => void }) {
  return (
    <button
      onClick={onOpen}
      className="fixed bottom-6 right-6 z-40 h-14 w-14 rounded-full grid place-items-center text-white shadow-2xl hover:scale-110 transition"
      style={{ background: GREEN }}
      aria-label="WhatsApp"
    >
      <WhatsAppIcon className="h-7 w-7" />
    </button>
  );
}

// ───────── Modal ─────────
function Modal({ open, onClose }: { open: boolean; onClose: () => void }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 bg-black/60 grid place-items-center p-4 overflow-y-auto" onClick={onClose}>
      <div className="relative bg-white rounded-2xl max-w-md w-full p-6 md:p-8 my-8" onClick={(e) => e.stopPropagation()}>
        <button onClick={onClose} className="absolute top-3 right-3 h-9 w-9 grid place-items-center rounded-full hover:bg-neutral-100">
          <X className="h-5 w-5" />
        </button>
        <h1 className="text-2xl md:text-3xl font-black text-neutral-900 leading-tight">
          Torne-se um franqueado de <span style={{ color: RED }}>sucesso</span>
        </h1>
        <div className="mt-5">
          <ContactForm id="form-modal" />
        </div>
      </div>
    </div>
  );
}

// ───────── WhatsApp icon (svg) ─────────
function WhatsAppIcon({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="currentColor" aria-hidden="true">
      <path d="M19.05 4.91A10 10 0 0 0 4.93 19.06L4 23l4.05-1.06A10 10 0 1 0 19.05 4.9zM12 21.5a9.49 9.49 0 0 1-4.84-1.32l-.35-.21-2.4.63.64-2.34-.23-.36A9.5 9.5 0 1 1 12 21.5zm5.21-7.1c-.28-.14-1.66-.82-1.92-.92-.26-.1-.45-.14-.64.14-.19.28-.74.91-.91 1.1-.17.19-.34.21-.62.07a7.78 7.78 0 0 1-2.3-1.42 8.66 8.66 0 0 1-1.6-1.98c-.16-.28 0-.43.13-.57.13-.13.28-.34.42-.51.14-.17.18-.28.28-.47.09-.19.04-.36-.02-.5-.07-.14-.64-1.54-.87-2.12-.23-.55-.46-.48-.64-.49h-.55a1.06 1.06 0 0 0-.77.36 3.21 3.21 0 0 0-1 2.39c0 1.41 1.03 2.78 1.17 2.97.14.19 2.02 3.08 4.89 4.32.69.3 1.23.48 1.65.62.69.22 1.31.19 1.81.12.55-.08 1.66-.68 1.9-1.34.23-.66.23-1.22.16-1.34-.07-.12-.26-.19-.55-.32z" />
    </svg>
  );
}

// ───────── Page ─────────
export default function Mordidela() {
  const { open, openModal, closeModal } = useModal();
  useEffect(() => {
    document.title = "Mordidela – Franquia de alimentação";
  }, []);

  return (
    <div className="min-h-screen bg-white text-neutral-900">
      <style>{`
        @keyframes marquee {
          from { transform: translateX(0); }
          to { transform: translateX(-50%); }
        }
      `}</style>

      <ScrollingText />
      <Hero onOpen={openModal} />
      <MarketData />
      <Diferenciais />
      <FormSection paddingTop={false} />
      <Divider />
      <Depoimentos onOpen={openModal} />
      <Lideres onOpen={openModal} />
      <MarcasPremios />
      <NotasIfood onOpen={openModal} />
      <ModelosNegocio onOpen={openModal} />
      <InstagramSection onOpen={openModal} />
      <FAQ />
      <CarouselFooter />
      <FormSection />
      <Footer onOpen={openModal} />

      <FloatingWA onOpen={openModal} />
      <Modal open={open} onClose={closeModal} />
    </div>
  );
}
