import { Flower2, MessageSquare, Heart } from "lucide-react";
import { PageHeader } from "@/components/page-primitives";
import { Card, Button, Badge } from "@/components/list-primitives";

const posts = [
  { autor: "Dra. Renata Alves", titulo: "Cuidados pós-laser CO2 — o que sempre repito às pacientes", tags: ["Laser", "Pós-op"], hora: "há 2h", likes: 24, coments: 8 },
  { autor: "Enf. Carla Duarte", titulo: "Rotina de higienização entre sessões: meu passo a passo", tags: ["Higiene", "Rotina"], hora: "Ontem", likes: 41, coments: 15 },
  { autor: "Dra. Paula Menezes", titulo: "Como acolher a paciente na primeira consulta íntima", tags: ["Acolhimento"], hora: "3 dias", likes: 68, coments: 22 },
];

export default function Comunidade() {
  return (
    <div className="p-6 md:p-8">
      <PageHeader
        breadcrumb={["Clínica", "Comunidade"]}
        title="Comunidade"
        subtitle="Espaço seguro para profissionais trocarem experiências e evoluírem juntas."
        actions={<Button><Flower2 className="h-4 w-4" /> Novo post</Button>}
      />

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          {posts.map((p) => (
            <Card key={p.titulo}>
              <div className="mb-2 flex items-center gap-2 text-xs font-semibold text-muted-foreground">
                <span>{p.autor}</span><span>•</span><span>{p.hora}</span>
              </div>
              <p className="text-base font-extrabold text-foreground">{p.titulo}</p>
              <div className="mt-2 flex flex-wrap gap-1">
                {p.tags.map((t) => <Badge key={t} tone="primary">{t}</Badge>)}
              </div>
              <div className="mt-4 flex items-center gap-4 text-xs font-bold text-muted-foreground">
                <span className="inline-flex items-center gap-1"><Heart className="h-4 w-4" /> {p.likes}</span>
                <span className="inline-flex items-center gap-1"><MessageSquare className="h-4 w-4" /> {p.coments}</span>
              </div>
            </Card>
          ))}
        </div>

        <div className="space-y-4">
          <Card title="Regras da comunidade">
            <ul className="list-disc space-y-2 pl-5 text-sm font-semibold text-muted-foreground">
              <li>Nunca compartilhe fotos ou dados de pacientes.</li>
              <li>Respeito acima de tudo entre colegas.</li>
              <li>Cite fontes ao trazer estudos.</li>
            </ul>
          </Card>
          <Card title="Tópicos populares">
            <div className="flex flex-wrap gap-1">
              {["Laser", "Ácido hialurônico", "LGPD", "Marketing", "Pós-op", "Financeiro", "Acolhimento"].map((t) => (
                <Badge key={t} tone="pink">#{t.toLowerCase()}</Badge>
              ))}
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
