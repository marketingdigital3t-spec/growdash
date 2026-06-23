import { useEffect, useState } from "react";
import {
  TrendingUp,
  Utensils,
  Globe,
  Zap,
  DollarSign,
  Clock,
  BarChart3,
  MessageCircle,
  ChevronLeft,
  ChevronRight,
  Plus,
  Minus,
  Play,
  Pause,
  Star,
  Quote,
} from "lucide-react";

// ============ Marquee Strip ============
function Marquee() {
  const items = [
    "PRAÇA DE ALIMENTAÇÃO COMPLETA",
    "MENOR INVESTIMENTO DO SEGMENTO",
  ];
  return (
    <div className="bg-[#C8102E] text-white text-[11px] font-semibold tracking-[0.18em] overflow-hidden border-b border-black/20">
      <div className="flex whitespace-nowrap animate-[marquee_30s_linear_infinite] py-2">
        {Array.from({ length: 8 }).map((_, i) => (
          <span key={i} className="mx-6 flex items-center gap-6">
            {items.map((t, j) => (
              <span key={j} className="flex items-center gap-6">
                {t}
                <span className="opacity-50">|</span>
              </span>
            ))}
          </span>
        ))}
      </div>
    </div>
  );
}

// ============ Section Container ============
function Section({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <section className={`w-full ${className}`}>{children}</section>;
}

// ============ Hero ============
function Hero() {
  return (
    <Section className="bg-white">
      <div className="mx-auto max-w-6xl px-6 py-10 grid lg:grid-cols-[1.05fr_1fr] gap-10 items-center">
        <div>
          <div className="text-[#C8102E] font-black text-sm tracking-widest mb-4">MORDIDELA</div>
          <h1 className="text-4xl md:text-5xl font-black leading-[1.05] text-neutral-900">
            Fature até <span className="text-[#C8102E]">R$ 1.8 milhão</span><br />
            todos os anos com o seu<br />
            restaurante <span className="italic text-[#C8102E]">fast food</span>.
          </h1>

          <div className="mt-8 grid grid-cols-1 sm:grid-cols-2 gap-3 max-w-md">
            {[
              { icon: DollarSign, t: "Menor investimento do mercado" },
              { icon: Utensils, t: "Refeição todas as horas do dia" },
              { icon: Star, t: "Prêmio top 10 hamburguerias" },
              { icon: TrendingUp, t: "Marketing constante nas mídias sociais" },
            ].map(({ icon: Icon, t }, i) => (
              <div key={i} className="flex items-start gap-2 text-sm text-neutral-700">
                <div className="mt-0.5 h-7 w-7 rounded-md bg-[#C8102E]/10 text-[#C8102E] flex items-center justify-center shrink-0">
                  <Icon className="h-3.5 w-3.5" />
                </div>
                <span className="leading-tight">{t}</span>
              </div>
            ))}
          </div>

          <div className="mt-6 flex items-center gap-3 text-xs text-neutral-500">
            <span>Mídia:</span>
            {["G1", "UOL", "R7", "FOLHA"].map((m) => (
              <span key={m} className="px-2 py-1 rounded bg-neutral-100 font-bold">
                {m}
              </span>
            ))}
          </div>

          <a
            href="#contato"
            className="mt-7 inline-flex items-center gap-2 bg-[#16A34A] hover:bg-[#15803D] text-white font-bold px-6 py-3.5 rounded-md shadow-lg shadow-emerald-500/20 transition"
          >
            <MessageCircle className="h-4 w-4" />
            RECEBA APRESENTAÇÃO VIA WHATSAPP
          </a>
        </div>

        <div className="relative">
          <div className="rounded-2xl overflow-hidden aspect-[4/3] shadow-2xl">
            <img
              src="https://images.unsplash.com/photo-1571091718767-18b5b1457add?w=1200&q=80"
              alt="Restaurante Mordidela"
              className="w-full h-full object-cover"
            />
          </div>
        </div>
      </div>

      {/* stats bar */}
      <div className="mx-auto max-w-6xl px-6 pb-10">
        <div className="bg-white border border-neutral-200 rounded-2xl shadow-sm grid grid-cols-2 lg:grid-cols-4 divide-x divide-neutral-200">
          {[
            { v: "13,2%", t: "Delivery cresceu 13,2% em 2024, impulsionando o consumo rápido." },
            { v: "25%", t: "25% da renda vai para refeições fora de casa." },
            { v: "99%", t: "99% dos brasileiros consomem hambúrguer mensalmente." },
            { v: "13,7M", t: "Fast-food no Brasil: 13,7 milhões de consumidores no primeiro trimestre de 2024." },
          ].map((s, i) => (
            <div key={i} className="p-5 flex items-start gap-3">
              <div className="h-9 w-9 rounded-md bg-[#C8102E] text-white flex items-center justify-center shrink-0">
                <TrendingUp className="h-4 w-4" />
              </div>
              <div>
                <div className="text-xl font-black text-neutral-900">{s.v}</div>
                <div className="text-[11px] text-neutral-500 leading-snug mt-1">{s.t}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </Section>
  );
}

// ============ Diferenciais ============
function Diferenciais() {
  const items = [
    { t: "Hamburgers", d: "100% Artesanal, receitas próprias e combinações incríveis.", img: "https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=600&q=80" },
    { t: "Pratos Feitos", d: "Diversas refeições diárias para você vender o dia todo.", img: "https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=600&q=80" },
    { t: "Sobremesas", d: "Pratos criativos e na hype das atualidades.", img: "https://images.unsplash.com/photo-1551024506-0bccd828d307?w=600&q=80" },
    { t: "Pratos exclusivos", d: "Você pode ter o prato da sua cidade.", img: "https://images.unsplash.com/photo-1565299624946-b28f40a0ae38?w=600&q=80" },
  ];
  return (
    <Section className="bg-white py-14">
      <div className="mx-auto max-w-6xl px-6">
        <p className="text-center text-sm text-neutral-500">Diferenciais que garantem seu sucesso!</p>
        <h2 className="text-center text-3xl md:text-4xl font-black text-[#C8102E] mt-1">
          PRAÇA DE ALIMENTAÇÃO COMPLETA
        </h2>

        <div className="mt-10 grid grid-cols-2 lg:grid-cols-4 gap-6">
          {items.map((it, i) => (
            <div key={i} className="group">
              <div className="aspect-square rounded-2xl overflow-hidden bg-neutral-100">
                <img
                  src={it.img}
                  alt={it.t}
                  className="w-full h-full object-cover group-hover:scale-105 transition duration-500"
                />
              </div>
              <h3 className="mt-4 text-[#C8102E] font-bold text-lg">{it.t}</h3>
              <p className="text-sm text-neutral-600 mt-1">{it.d}</p>
            </div>
          ))}
        </div>
      </div>
    </Section>
  );
}

// ============ Form CTA (red) ============
function FormCTA({ id = "contato" }: { id?: string }) {
  return (
    <Section className="bg-[#C8102E] py-14 relative overflow-hidden" >
      <div id={id} className="mx-auto max-w-3xl px-6 text-white relative">
        <p className="text-center text-sm opacity-90">Fale com a gente</p>
        <h2 className="text-center text-2xl md:text-3xl font-black mt-1">
          CONVERSE AGORA COM UM<br />CONSULTOR DA MORDIDELA
        </h2>

        <form
          className="mt-8 grid grid-cols-1 md:grid-cols-2 gap-3"
          onSubmit={(e) => {
            e.preventDefault();
            alert("Solicitação enviada! Em breve nosso consultor entrará em contato.");
          }}
        >
          <Field label="Nome" placeholder="Digite seu nome" />
          <Field label="E-mail" placeholder="Digite seu e-mail" type="email" />
          <Field label="Telefone" placeholder="Digite seu telefone" />
          <Field label="Estado" placeholder="Selecione o Estado" />
          <div className="md:col-span-2">
            <Field label="Cidade" placeholder="Digite sua cidade" />
          </div>
          <div className="md:col-span-2">
            <label className="text-xs font-semibold uppercase tracking-wide">Experiência com negócios</label>
            <select className="mt-1 w-full bg-white text-neutral-900 rounded-md px-3 py-2.5 text-sm">
              <option>Já possui experiência anterior com negócios ou franquias?</option>
              <option>Sim</option>
              <option>Não</option>
            </select>
          </div>
          <div className="md:col-span-2">
            <label className="text-xs font-semibold uppercase tracking-wide">Valor de investimento</label>
            <select className="mt-1 w-full bg-white text-neutral-900 rounded-md px-3 py-2.5 text-sm">
              <option>Valor de investimento</option>
              <option>Até R$ 200 mil</option>
              <option>R$ 200 a R$ 500 mil</option>
              <option>Acima de R$ 500 mil</option>
            </select>
          </div>
          <button
            type="submit"
            className="md:col-span-2 mt-2 bg-[#16A34A] hover:bg-[#15803D] text-white font-bold py-3.5 rounded-md transition flex items-center justify-center gap-2"
          >
            <MessageCircle className="h-4 w-4" /> FALE COM UM CONSULTOR
          </button>
          <p className="md:col-span-2 text-[10px] text-center text-white/80 mt-1">
            Ao enviar os dados acima, eu concordo em receber contatos e mensagens por meio do WhatsApp, Telefones e E-mails.
          </p>
        </form>
      </div>
    </Section>
  );
}

function Field({ label, placeholder, type = "text" }: { label: string; placeholder: string; type?: string }) {
  return (
    <div>
      <label className="text-xs font-semibold uppercase tracking-wide">{label}</label>
      <input
        type={type}
        placeholder={placeholder}
        className="mt-1 w-full bg-white text-neutral-900 rounded-md px-3 py-2.5 text-sm placeholder:text-neutral-400 focus:outline-none focus:ring-2 focus:ring-[#FBBF24]"
      />
    </div>
  );
}

// ============ Testimonials ============
function Testimonials() {
  const items = [
    { name: "Franquia • Salvador, BA", text: "Entrar para a rede Mordidela foi a melhor decisão que tomei. Com o suporte completo e produtos variados, consigo atender meu público com facilidade e rapidez." },
    { name: "Franquia • Recife, PE", text: "Marca forte, marketing presente e operação enxuta. Meu faturamento cresceu mês a mês desde a inauguração." },
    { name: "Franquia • Curitiba, PR", text: "O modelo de negócio é simples e muito rentável. Recomendo a quem quer empreender no fast food." },
  ];
  const [idx, setIdx] = useState(0);
  const t = items[idx];
  return (
    <Section className="bg-white py-16 relative">
      <div className="mx-auto max-w-6xl px-6 grid lg:grid-cols-[1fr_1.4fr_1fr] items-center gap-6">
        <div className="hidden lg:block">
          <img src="https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=600&q=80" className="rounded-2xl aspect-square object-cover" alt="" />
        </div>
        <div className="text-center">
          <p className="text-sm text-neutral-500">Experiências que comprovam o sucesso da Mordidela</p>
          <h2 className="text-2xl md:text-3xl font-black text-[#C8102E] mt-1">
            O QUE NOSSOS FRANQUEADOS DIZEM!
          </h2>
          <div className="mt-8 bg-neutral-50 border border-neutral-200 rounded-2xl p-6 relative">
            <Quote className="absolute -top-3 left-6 h-8 w-8 text-[#C8102E]" />
            <div className="text-[#C8102E] font-bold">{t.name}</div>
            <p className="text-sm text-neutral-700 italic mt-3">"{t.text}"</p>
            <Quote className="ml-auto mt-4 h-8 w-8 text-[#C8102E] rotate-180" />
          </div>
          <div className="flex items-center justify-center gap-3 mt-5">
            <button onClick={() => setIdx((idx - 1 + items.length) % items.length)} className="h-8 w-8 rounded-full bg-[#C8102E] text-white flex items-center justify-center">
              <ChevronLeft className="h-4 w-4" />
            </button>
            <button onClick={() => setIdx((idx + 1) % items.length)} className="h-8 w-8 rounded-full bg-[#C8102E] text-white flex items-center justify-center">
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
          <a href="#contato" className="mt-6 inline-flex items-center gap-2 bg-[#16A34A] hover:bg-[#15803D] text-white font-bold px-6 py-3 rounded-md">
            <MessageCircle className="h-4 w-4" /> RESERVAR MINHA ÁREA
          </a>
        </div>
        <div className="hidden lg:block">
          <img src="https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=600&q=80" className="rounded-2xl aspect-square object-cover" alt="" />
        </div>
      </div>
    </Section>
  );
}

// ============ Líderes (dark) ============
function Lideres() {
  const [playing, setPlaying] = useState(false);
  return (
    <Section className="bg-neutral-950 text-white py-16">
      <div className="mx-auto max-w-6xl px-6 grid lg:grid-cols-2 gap-10 items-center">
        <div>
          <p className="text-sm text-neutral-400">Somos líderes do mercado</p>
          <h2 className="text-3xl md:text-4xl font-black text-[#EF4444] mt-1 leading-tight">
            FRANQUIA SÓLIDA COM ALTA<br />RENTABILIDADE E SUPORTE TOTAL
          </h2>
          <p className="text-sm text-neutral-300 mt-4 max-w-lg">
            O Grupo ZNTT, com atuação multissegmentada, é uma das maiores holdings de franquias do Brasil, abrangendo diversas marcas de sucesso. Com essa estrutura robusta, a Mordidela cresce continuamente, oferecendo aos franqueados suporte completo e alta rentabilidade.
          </p>

          <div className="mt-6 grid grid-cols-2 gap-4 max-w-md">
            {[
              { t: "Mais de 3000 unidades." },
              { t: "Modelo de negócios de fácil gestão com logística própria." },
              { t: "Cardápio variado: hamburgueres, sobremesas e pratos exclusivos." },
              { t: "Estrutura sólida e alta rentabilidade para franqueados." },
            ].map((s, i) => (
              <div key={i} className="flex items-start gap-2 text-sm">
                <div className="h-7 w-7 rounded-md bg-[#EF4444]/15 text-[#EF4444] flex items-center justify-center shrink-0">
                  <Star className="h-3.5 w-3.5" />
                </div>
                <span className="text-neutral-200 leading-tight">{s.t}</span>
              </div>
            ))}
          </div>

          <a href="#contato" className="mt-7 inline-flex items-center gap-2 bg-[#16A34A] hover:bg-[#15803D] text-white font-bold px-6 py-3 rounded-md">
            <MessageCircle className="h-4 w-4" /> RECEBA APRESENTAÇÃO VIA WHATSAPP
          </a>
        </div>

        <div className="relative aspect-video rounded-2xl overflow-hidden bg-neutral-800">
          <img src="https://images.unsplash.com/photo-1565299624946-b28f40a0ae38?w=900&q=80" className="absolute inset-0 w-full h-full object-cover" alt="" />
          <button
            onClick={() => setPlaying((p) => !p)}
            className="absolute inset-0 m-auto h-16 w-16 rounded-full bg-white/95 text-neutral-900 flex items-center justify-center shadow-2xl hover:scale-105 transition"
          >
            {playing ? <Pause className="h-6 w-6" /> : <Play className="h-6 w-6 ml-1" />}
          </button>
          <div className="absolute bottom-3 left-3 right-3 h-1 bg-white/20 rounded">
            <div className="h-full w-1/3 bg-[#EF4444] rounded" />
          </div>
        </div>
      </div>
    </Section>
  );
}

// ============ Marcas + Prêmios ============
function Marcas() {
  return (
    <Section className="bg-neutral-950 pb-16">
      <div className="mx-auto max-w-6xl px-6">
        <div className="bg-white rounded-3xl p-10 shadow-xl">
          <p className="text-center text-sm text-neutral-500">Descubra as marcas que impulsionam nosso sucesso</p>
          <h2 className="text-center text-2xl md:text-3xl font-black text-[#C8102E] mt-1">CONHEÇA AS PRINCIPAIS MARCAS</h2>
          <div className="mt-6 flex flex-wrap justify-center items-center gap-x-10 gap-y-4 text-neutral-700 font-black">
            {["BEM", "MORDIDELA", "TIFLOW", "Vida Leve", "THE OUTLET"].map((m) => (
              <span key={m} className="opacity-70 hover:opacity-100 transition">{m}</span>
            ))}
          </div>

          <div className="mt-10 border-t border-neutral-200 pt-8">
            <p className="text-center text-sm text-neutral-500">Somos premiados</p>
            <h3 className="text-center text-2xl md:text-3xl font-black text-[#C8102E] mt-1">POSSUÍMOS EXCELÊNCIA EM PREMIAÇÕES E SEGURANÇA</h3>
            <div className="mt-6 flex flex-wrap justify-center gap-3">
              {["TOP 100", "ABF", "ISO 9001", "PREMIUM"].map((p) => (
                <span key={p} className="px-4 py-2 rounded-lg bg-neutral-100 text-xs font-bold text-neutral-700">{p}</span>
              ))}
            </div>
          </div>
        </div>
      </div>
    </Section>
  );
}

// ============ Crescimento (unidades) ============
function Crescimento() {
  const units = [
    { name: "Mordidela Salvador", rating: "4.9", lanches: "1.0k", dist: "1.3km", status: "Aberto" },
    { name: "Mordidela Nova Friburgo", rating: "4.8", lanches: "1.5k", dist: "1.7km", status: "Aberto" },
    { name: "Mordidela Lagoa da Prata", rating: "4.7", lanches: "2.3k", dist: "0.5km", status: "Fechado" },
  ];
  return (
    <Section className="bg-neutral-950 text-white pb-20">
      <div className="mx-auto max-w-6xl px-6 grid lg:grid-cols-[1.2fr_1fr] gap-10 items-center">
        <div>
          <p className="text-sm text-neutral-400 text-center lg:text-left">Crescimento e solidez no Grupo ZNTT</p>
          <h2 className="text-3xl md:text-4xl font-black text-[#EF4444] mt-1 text-center lg:text-left">SOMOS NOTA 5 NO IFOOD!</h2>

          <div className="mt-8 grid sm:grid-cols-3 gap-3">
            {units.map((u, i) => (
              <div key={i} className="bg-white text-neutral-900 rounded-xl overflow-hidden">
                <div className="bg-[#C8102E] text-white text-xs font-black px-3 py-2">MORDIDELA</div>
                <div className="p-3">
                  <div className="font-bold text-sm">{u.name}</div>
                  <div className="text-xs text-neutral-600 mt-2 flex items-center gap-1">
                    <Star className="h-3 w-3 fill-amber-400 text-amber-400" /> {u.rating} • Lanches • {u.lanches}
                  </div>
                  <div className="mt-1 text-xs font-bold">
                    <span className={u.status === "Aberto" ? "text-emerald-600" : "text-neutral-400"}>{u.status}</span>
                    <span className="text-neutral-500 font-normal"> • {u.dist}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="flex items-center justify-center gap-3 mt-6">
            <button className="h-8 w-8 rounded-full bg-[#C8102E] text-white flex items-center justify-center"><ChevronLeft className="h-4 w-4" /></button>
            <button className="h-8 w-8 rounded-full bg-[#C8102E] text-white flex items-center justify-center"><ChevronRight className="h-4 w-4" /></button>
          </div>

          <div className="text-center lg:text-left mt-6">
            <a href="#contato" className="inline-flex items-center gap-2 bg-[#16A34A] hover:bg-[#15803D] text-white font-bold px-6 py-3 rounded-md">
              <MessageCircle className="h-4 w-4" /> FALE COM UM CONSULTOR
            </a>
          </div>
        </div>
        <div className="hidden lg:block">
          <img src="https://images.unsplash.com/photo-1551782450-a2132b4ba21d?w=900&q=80" className="rounded-2xl aspect-square object-cover" alt="" />
        </div>
      </div>
    </Section>
  );
}

// ============ Modelo de Negócio ============
function ModeloNegocio() {
  const models = [
    { title: "Loja", img: "https://images.unsplash.com/photo-1552566626-52f8b828add9?w=600&q=80", invest: "R$159.900,00", roi: "12 meses", fat: "R$60.000,00" },
    { title: "Quiosque", img: "https://images.unsplash.com/photo-1559339352-11d035aa65de?w=600&q=80", invest: "R$99.900,00", roi: "10 meses", fat: "R$50.000,00" },
    { title: "Delivery", img: "https://images.unsplash.com/photo-1513104890138-7c749659a591?w=600&q=80", invest: "R$64.900,00", roi: "10 meses", fat: "R$40.000,00" },
  ];
  return (
    <Section className="bg-[#FBBF24] py-16">
      <div className="mx-auto max-w-6xl px-6">
        <p className="text-center text-sm text-neutral-800">Rentável, escalável e fácil de operar</p>
        <h2 className="text-center text-3xl md:text-4xl font-black text-[#C8102E] mt-1">MODELO DE NEGÓCIO</h2>

        <div className="mt-10 grid sm:grid-cols-3 gap-5">
          {models.map((m, i) => (
            <div key={i} className="bg-white rounded-2xl overflow-hidden shadow-md">
              <div className="aspect-[5/3] bg-neutral-100">
                <img src={m.img} className="w-full h-full object-cover" alt={m.title} />
              </div>
              <div className="p-5">
                <div className="font-black text-lg">{m.title}</div>
                <div className="mt-3 space-y-2 text-sm">
                  <Row label="Valor de investimento:" value={m.invest} />
                  <Row label="ROI:" value={m.roi} />
                  <Row label="Faturamento bruto:" value={m.fat} />
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="text-center mt-10">
          <a href="#contato" className="inline-flex items-center gap-2 bg-[#16A34A] hover:bg-[#15803D] text-white font-bold px-6 py-3 rounded-md">
            <MessageCircle className="h-4 w-4" /> RESERVAR MINHA ÁREA
          </a>
        </div>
      </div>
    </Section>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start gap-2">
      <div className="h-6 w-6 rounded-md bg-[#FBBF24]/30 text-[#C8102E] flex items-center justify-center shrink-0">
        <DollarSign className="h-3.5 w-3.5" />
      </div>
      <div className="text-xs">
        <div className="text-neutral-500">{label}</div>
        <div className="font-bold text-neutral-900">{value}</div>
      </div>
    </div>
  );
}

// ============ Instagram ============
function Instagram() {
  const imgs = [
    "https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=400&q=80",
    "https://images.unsplash.com/photo-1571091718767-18b5b1457add?w=400&q=80",
    "https://images.unsplash.com/photo-1550317138-10000687a72b?w=400&q=80",
  ];
  return (
    <Section className="bg-white py-16">
      <div className="mx-auto max-w-6xl px-6 grid lg:grid-cols-2 gap-10 items-center">
        <div>
          <p className="text-sm text-neutral-500">Nosso instagram</p>
          <h2 className="text-2xl md:text-3xl font-black text-[#C8102E] mt-1">
            CONFIRA NOSSOS MELHORES<br />MOMENTOS E NOVIDADES!
          </h2>
          <a href="#contato" className="mt-6 inline-flex items-center gap-2 bg-[#16A34A] hover:bg-[#15803D] text-white font-bold px-6 py-3 rounded-md">
            <MessageCircle className="h-4 w-4" /> FALE COM UM CONSULTOR
          </a>
        </div>
        <div className="grid grid-cols-3 gap-3">
          {imgs.map((src, i) => (
            <div key={i} className="aspect-[3/5] rounded-xl overflow-hidden bg-neutral-100 border border-neutral-200">
              <div className="h-6 bg-neutral-50 border-b border-neutral-200 flex items-center px-2 gap-1">
                <div className="h-2 w-2 rounded-full bg-red-400" />
                <div className="h-2 w-2 rounded-full bg-amber-400" />
                <div className="h-2 w-2 rounded-full bg-emerald-400" />
              </div>
              <img src={src} alt="" className="w-full h-[calc(100%-1.5rem)] object-cover" />
            </div>
          ))}
        </div>
      </div>
    </Section>
  );
}

// ============ FAQ ============
function FAQ() {
  const items = [
    { q: "Qual é o investimento inicial para abrir uma franquia da Mordidela?", a: "Os investimentos começam a partir de R$ 64.900 no modelo Delivery, com opções de Quiosque e Loja completa." },
    { q: "Qual é o retorno esperado do investimento?", a: "O ROI médio é de 10 a 12 meses, variando conforme o modelo e localização." },
    { q: "A Mordidela oferece suporte para os franqueados?", a: "Sim. Oferecemos suporte completo desde a implantação até a operação contínua: marketing, treinamento e logística." },
    { q: "Quais são os principais produtos do cardápio?", a: "Hamburgueres artesanais, pratos feitos, sobremesas e itens exclusivos por região." },
    { q: "A Mordidela é uma franquia com exclusividade territorial?", a: "Sim. Garantimos exclusividade territorial para proteger o investimento do franqueado." },
  ];
  const [open, setOpen] = useState<number | null>(0);
  return (
    <Section className="bg-white py-16">
      <div className="mx-auto max-w-3xl px-6">
        <p className="text-center text-sm text-neutral-500">Dúvidas frequentes</p>
        <h2 className="text-center text-2xl md:text-3xl font-black text-[#C8102E] mt-1">
          TUDO O QUE VOCÊ PRECISA<br />SABER SOBRE A FRANQUIA
        </h2>

        <div className="mt-8 space-y-3">
          {items.map((it, i) => {
            const isOpen = open === i;
            return (
              <button
                key={i}
                onClick={() => setOpen(isOpen ? null : i)}
                className="w-full text-left bg-neutral-50 hover:bg-neutral-100 border border-neutral-200 rounded-xl px-5 py-4 flex items-start gap-4 transition"
              >
                <div className="flex-1">
                  <div className="font-semibold text-sm text-neutral-900">{it.q}</div>
                  {isOpen && <div className="mt-2 text-sm text-neutral-600">{it.a}</div>}
                </div>
                <div className="h-7 w-7 rounded-full bg-[#C8102E] text-white flex items-center justify-center shrink-0">
                  {isOpen ? <Minus className="h-3.5 w-3.5" /> : <Plus className="h-3.5 w-3.5" />}
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </Section>
  );
}

// ============ Big Food Image ============
function BigFood() {
  return (
    <Section className="bg-white">
      <div className="aspect-[3/1] w-full overflow-hidden">
        <img
          src="https://images.unsplash.com/photo-1565958011703-44f9829ba187?w=2000&q=80"
          alt=""
          className="w-full h-full object-cover"
        />
      </div>
    </Section>
  );
}

// ============ Footer ============
function Footer() {
  return (
    <footer className="bg-[#C8102E] text-white">
      <div className="mx-auto max-w-6xl px-6 py-12 grid md:grid-cols-4 gap-8 text-sm">
        <div>
          <div className="flex items-center gap-2 mb-3">
            <div className="px-2 py-1 rounded bg-white text-[#C8102E] text-[10px] font-black">ABF</div>
            <div className="font-black tracking-widest">MORDIDELA</div>
          </div>
          <p className="text-xs text-white/80">Associado ABF. Franquia premiada e reconhecida.</p>
        </div>
        <div>
          <div className="font-bold mb-2">Informações</div>
          <p className="text-xs text-white/85 leading-relaxed">
            CNPJ: 23.822.259/0001-13<br />
            Razão Social: SUPER MARCAS FRANCHISING LTDA<br />
            Endereço: Av. Marginal Comendador Vicente Filizola, Redentora
          </p>
        </div>
        <div>
          <div className="font-bold mb-2">Nosso consultor vai te ligar!</div>
          <p className="text-xs text-white/85">Vamos te ligar do DDD 17 fique atento nas próximas horas.</p>
        </div>
        <div>
          <div className="font-bold mb-2">Horário de Atendimento</div>
          <p className="text-xs text-white/85">Seg-Sex: 8:00AM - 18:00PM</p>
          <a href="#contato" className="mt-4 inline-flex items-center gap-2 bg-white text-[#C8102E] font-bold px-4 py-2 rounded-md text-xs">
            <MessageCircle className="h-3.5 w-3.5" /> CONSULTOR ON-LINE
          </a>
        </div>
      </div>
      <div className="border-t border-white/20 py-4 text-center text-xs text-white/80">
        Mordidela © 2024 | Desenvolvido por ZNTT
      </div>
    </footer>
  );
}

// ============ Page ============
export default function Mordidela() {
  useEffect(() => {
    document.title = "Mordidela — Franquia de Fast Food";
  }, []);
  return (
    <div
      className="min-h-screen bg-white text-neutral-900"
      style={{
        backgroundImage:
          "linear-gradient(rgba(0,0,0,0.07) 1px, transparent 1px), linear-gradient(90deg, rgba(0,0,0,0.07) 1px, transparent 1px)",
        backgroundSize: "8px 8px",
      }}
    >
      <Marquee />
      <Hero />
      <Diferenciais />
      <FormCTA />
      <Testimonials />
      <Lideres />
      <Marcas />
      <Crescimento />
      <ModeloNegocio />
      <Instagram />
      <FAQ />
      <BigFood />
      <FormCTA id="contato2" />
      <Footer />
      <style>{`
        @keyframes marquee {
          0% { transform: translateX(0); }
          100% { transform: translateX(-50%); }
        }
      `}</style>

    </div>
  );
}
