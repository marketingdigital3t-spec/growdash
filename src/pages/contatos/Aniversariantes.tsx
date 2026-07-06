import { Cake, MessageCircle } from "lucide-react";
import { PageHeader } from "@/components/page-primitives";
import { Card, Button } from "@/components/list-primitives";

const list = [
  { nome: "Ana Beatriz Souza", dia: "08/07", idade: 34 },
  { nome: "Camila Oliveira", dia: "11/07", idade: 29 },
  { nome: "Juliana Ramos", dia: "14/07", idade: 41 },
  { nome: "Débora Martins", dia: "22/07", idade: 37 },
];

export default function Aniversariantes() {
  return (
    <div className="p-6 md:p-8">
      <PageHeader
        breadcrumb={["Clínica", "Contatos", "Aniversariantes"]}
        title="Aniversariantes"
        subtitle="Envie uma mensagem carinhosa e fortaleça o vínculo com suas pacientes."
      />
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {list.map((p) => (
          <Card key={p.nome}>
            <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-primary-soft text-primary">
              <Cake className="h-6 w-6" />
            </div>
            <p className="text-base font-extrabold text-foreground">{p.nome}</p>
            <p className="text-sm font-semibold text-muted-foreground">{p.dia} • {p.idade} anos</p>
            <Button className="mt-4 w-full" variant="secondary"><MessageCircle className="h-4 w-4" /> Enviar mensagem</Button>
          </Card>
        ))}
      </div>
    </div>
  );
}
