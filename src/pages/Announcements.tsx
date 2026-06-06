import { useEffect, useState } from "react";
import { ImagePlus, Loader2, Save, Trash2, UploadCloud } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { useToast } from "@/hooks/use-toast";
import {
  deactivateAnnouncement,
  fetchActiveAnnouncement,
  publishAnnouncement,
  readAnnouncement,
  type PlatformAnnouncement,
} from "@/lib/announcement";

export default function Announcements() {
  const { toast } = useToast();
  const [announcement, setAnnouncement] = useState<PlatformAnnouncement | null>(() => readAnnouncement());
  const [alt, setAlt] = useState(() => announcement?.alt || "Anúncio Growdash");
  const [draftImage, setDraftImage] = useState<string>(() => announcement?.imageDataUrl || "");
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    const refresh = () => {
      const current = readAnnouncement();
      setAnnouncement(current);
      setAlt(current?.alt || "Anúncio Growdash");
      setDraftImage(current?.imageDataUrl || "");
    };
    void fetchActiveAnnouncement().then((current) => {
      setAnnouncement(current);
      setAlt(current?.alt || "Anúncio Growdash");
      setDraftImage(current?.imageDataUrl || "");
    });
    window.addEventListener("growdash:announcement-updated", refresh);
    return () => window.removeEventListener("growdash:announcement-updated", refresh);
  }, []);

  const handleFile = (file?: File) => {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast({ title: "Arquivo inválido", description: "Envie uma imagem PNG, JPG, WEBP ou SVG.", variant: "destructive" });
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      setDraftImage(String(reader.result));
      toast({
        title: "Imagem carregada",
        description: "Confira a prévia e clique em Salvar anúncio para fixar em todas as telas.",
      });
    };
    reader.readAsDataURL(file);
  };

  const hasChanges =
    Boolean(draftImage) &&
    (draftImage !== announcement?.imageDataUrl || (alt.trim() || "Anúncio Growdash") !== announcement?.alt);

  const save = async () => {
    if (!draftImage) {
      toast({ title: "Envie uma imagem", description: "Escolha um banner antes de salvar.", variant: "destructive" });
      return;
    }

    const payload = {
      imageDataUrl: draftImage,
      alt: alt.trim() || "Anúncio Growdash",
      updatedAt: new Date().toISOString(),
    };

    setIsSaving(true);
    const { error } = await publishAnnouncement(payload);
    setIsSaving(false);
    setAnnouncement(payload);

    if (error) {
      toast({
        title: "Anúncio salvo localmente",
        description: "Ele ficará fixo nesta instalação. Para todos os usuários em produção, aplique a tabela/permissões do banco.",
      });
      return;
    }

    toast({ title: "Anúncio salvo", description: "O banner já aparece no topo das telas autenticadas." });
  };

  const clear = () => {
    void deactivateAnnouncement().then(({ error }) => {
      setAnnouncement(null);
      setDraftImage("");
      setAlt("Anúncio Growdash");
      toast({
        title: "Anúncio removido",
        description: error
          ? "Removido localmente. A remoção global depende da tabela Supabase estar aplicada."
          : "O banner deixou de aparecer para os usuários.",
      });
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="text-2xl font-bold">Anúncios</h1>
          <p className="text-muted-foreground">
            Publique um banner global para aparecer no topo das telas dos usuários cadastrados.
          </p>
        </div>
        {announcement && (
          <div className="flex flex-col gap-2 sm:flex-row">
            <Button className="gap-2" onClick={save} disabled={isSaving || !hasChanges}>
              {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              Salvar anúncio
            </Button>
            <Button variant="destructive" className="gap-2" onClick={clear}>
              <Trash2 className="h-4 w-4" />
              Remover anúncio
            </Button>
          </div>
        )}
      </div>

      <Alert className="border-primary/25 bg-primary/10">
        <ImagePlus className="h-4 w-4" />
        <AlertTitle>Comportamento do banner</AlertTitle>
        <AlertDescription>
          O usuário pode fechar no X, mas o banner volta ao recarregar a página ou ao fazer novo login.
        </AlertDescription>
      </Alert>

      <div className="grid gap-6 lg:grid-cols-[0.9fr_1.1fr]">
        <section className="rounded-lg border border-white/10 bg-card/70 p-5 shadow-2xl shadow-primary/5">
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="announcement-alt">Nome interno / texto alternativo</Label>
              <Input
                id="announcement-alt"
                value={alt}
                onChange={(event) => setAlt(event.target.value)}
                placeholder="Ex: Lançamento do plano Pro"
              />
            </div>

            <label className="flex min-h-52 cursor-pointer flex-col items-center justify-center rounded-lg border border-dashed border-primary/35 bg-background/60 p-6 text-center transition hover:border-primary hover:bg-primary/10">
              <UploadCloud className="mb-3 h-9 w-9 text-primary" />
              <span className="font-semibold">Clique para enviar a imagem</span>
              <span className="mt-1 text-sm text-muted-foreground">
                Use um banner horizontal. Recomendado: 1600 x 320 px.
              </span>
              <Input className="hidden" type="file" accept="image/*" onChange={(event) => handleFile(event.target.files?.[0])} />
            </label>

            <Button className="w-full gap-2" onClick={save} disabled={isSaving || !draftImage || !hasChanges}>
              {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              Salvar anúncio
            </Button>
          </div>
        </section>

        <section className="rounded-lg border border-white/10 bg-card/70 p-5">
          <h2 className="mb-3 text-lg font-semibold">Prévia</h2>
          {draftImage ? (
            <div className="overflow-hidden rounded-lg border border-primary/25">
              <img src={draftImage} alt={alt || "Anúncio Growdash"} className="max-h-72 w-full object-cover" />
            </div>
          ) : (
            <div className="flex min-h-72 items-center justify-center rounded-lg border border-dashed border-white/15 text-center text-muted-foreground">
              Nenhum anúncio publicado ainda.
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
