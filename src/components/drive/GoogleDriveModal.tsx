import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  FolderOpen,
  Upload,
  Download,
  Trash2,
  RefreshCw,
  Search,
  Grid,
  List as ListIcon,
  FileText,
  FileSpreadsheet,
  FileImage,
  Film,
  HardDrive,
  Plus,
  ExternalLink,
  CheckCircle2,
  AlertCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

interface DriveFile {
  id: string;
  name: string;
  mimeType?: string;
  size?: string;
  webViewLink?: string;
  webContentLink?: string;
  modifiedTime?: string;
}

interface GoogleDriveModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function GoogleDriveModal({ open, onOpenChange }: GoogleDriveModalProps) {
  const { toast } = useToast();
  const [files, setFiles] = useState<DriveFile[]>([]);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [search, setSearch] = useState("");
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");

  const loadFiles = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("google-drive-files", {
        body: { action: "list" },
      });
      if (error || data?.error) throw error ?? new Error(data.error);
      setFiles(data.files ?? []);
    } catch (error) {
      toast({
        title: "Não foi possível conectar ao Google Drive",
        description: error instanceof Error ? error.message : "Conecte a conta Claude Opus 5 em Integrações.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (open) {
      void loadFiles();
    }
  }, [open]);

  const handleUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) {
      toast({
        title: "Arquivo muito grande",
        description: "Envie arquivos de até 10 MB pelo navegador.",
        variant: "destructive",
      });
      return;
    }
    setUploading(true);
    try {
      const contentBase64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onerror = () => reject(new Error("Falha ao ler arquivo."));
        reader.onload = () => resolve(String(reader.result).split(",")[1] || "");
        reader.readAsDataURL(file);
      });

      const { data, error } = await supabase.functions.invoke("google-drive-files", {
        body: {
          action: "upload",
          name: file.name,
          mimeType: file.type || "application/octet-stream",
          contentBase64,
        },
      });

      if (error || data?.error) throw error ?? new Error(data.error);
      toast({
        title: "Arquivo enviado com sucesso!",
        description: `"${file.name}" foi salvo no seu Google Drive.`,
      });
      await loadFiles();
    } catch (error) {
      toast({
        title: "Erro no envio",
        description: error instanceof Error ? error.message : "Erro inesperado",
        variant: "destructive",
      });
    } finally {
      setUploading(false);
      event.target.value = "";
    }
  };

  const getFileIcon = (mimeType?: string) => {
    if (!mimeType) return <FileText className="h-5 w-5 text-blue-400" />;
    if (mimeType.includes("spreadsheet") || mimeType.includes("excel"))
      return <FileSpreadsheet className="h-5 w-5 text-emerald-400" />;
    if (mimeType.includes("image"))
      return <FileImage className="h-5 w-5 text-amber-400" />;
    if (mimeType.includes("video"))
      return <Film className="h-5 w-5 text-purple-400" />;
    return <FileText className="h-5 w-5 text-blue-400" />;
  };

  const filteredFiles = files.filter((f) =>
    f.name.toLowerCase().includes(search.trim().toLowerCase())
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl h-[85vh] p-0 overflow-hidden flex flex-col bg-[#0b0f19] border-border text-foreground shadow-2xl rounded-2xl">
        {/* Barra superior estilo Google Drive */}
        <header className="flex items-center justify-between px-6 py-4 border-b border-border/80 bg-[#0d1322]">
          <div className="flex items-center gap-3">
            <div className="grid h-9 w-9 place-items-center rounded-xl bg-primary/20 text-primary">
              <HardDrive className="h-5 w-5" />
            </div>
            <div>
              <DialogTitle className="text-base font-bold text-white flex items-center gap-2">
                Google Drive na Growdash
                <span className="text-[11px] font-normal px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                  Sincronizado
                </span>
              </DialogTitle>
              <p className="text-xs text-muted-foreground">
                Gerencie, envie e baixe seus arquivos sem sair da plataforma
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Botao de Upload */}
            <Button asChild className="h-9 gap-2 text-xs font-bold bg-primary hover:bg-primary/90 text-white">
              <label className="cursor-pointer">
                <Upload className="h-4 w-4" />
                {uploading ? "Enviando..." : "Novo Arquivo"}
                <input
                  type="file"
                  className="sr-only"
                  onChange={handleUpload}
                  disabled={uploading}
                />
              </label>
            </Button>

            <Button
              variant="outline"
              size="icon"
              className="h-9 w-9"
              onClick={loadFiles}
              disabled={loading}
              title="Atualizar arquivos"
            >
              <RefreshCw className={cn("h-4 w-4", loading && "animate-spin")} />
            </Button>
          </div>
        </header>

        {/* Barra de Ferramentas / Busca */}
        <div className="flex items-center justify-between gap-4 px-6 py-3 border-b border-border/60 bg-[#0b0f19]">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Pesquisar no Drive..."
              className="pl-9 h-9 text-xs bg-muted/20 border-border/70"
            />
          </div>

          <div className="flex items-center gap-1 bg-muted/20 p-1 rounded-lg border border-border/60">
            <Button
              variant="ghost"
              size="icon"
              className={cn("h-7 w-7 rounded-md", viewMode === "grid" && "bg-primary/20 text-primary")}
              onClick={() => setViewMode("grid")}
              title="Visualização em grade"
            >
              <Grid className="h-3.5 w-3.5" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className={cn("h-7 w-7 rounded-md", viewMode === "list" && "bg-primary/20 text-primary")}
              onClick={() => setViewMode("list")}
              title="Visualização em lista"
            >
              <ListIcon className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>

        {/* Conteúdo Principal com Arquivos */}
        <div className="flex-1 overflow-y-auto p-6 growdash-scrollbar bg-[#080c14]">
          {loading ? (
            <div className="flex flex-col items-center justify-center h-64 text-muted-foreground gap-3">
              <RefreshCw className="h-8 w-8 animate-spin text-primary" />
              <span className="text-xs font-semibold">Carregando arquivos do seu Google Drive...</span>
            </div>
          ) : filteredFiles.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-64 text-center p-6 border border-dashed border-border rounded-xl">
              <FolderOpen className="h-12 w-12 text-muted-foreground/60 mb-2" />
              <p className="text-sm font-bold text-foreground">Nenhum arquivo encontrado</p>
              <p className="text-xs text-muted-foreground mt-1">
                Clique no botão "Novo Arquivo" acima para enviar seu primeiro arquivo ao Google Drive.
              </p>
            </div>
          ) : viewMode === "grid" ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
              {filteredFiles.map((file) => (
                <div
                  key={file.id}
                  className="group relative flex flex-col justify-between p-3 rounded-xl border border-border/70 bg-card/60 hover:border-primary/50 hover:bg-card transition shadow-sm"
                >
                  <div className="flex items-start justify-between gap-2 mb-2">
                    {getFileIcon(file.mimeType)}
                    <a
                      href={file.webViewLink || "#"}
                      target="_blank"
                      rel="noreferrer"
                      className="opacity-0 group-hover:opacity-100 transition p-1 hover:text-primary"
                      title="Abrir no Google Drive"
                    >
                      <ExternalLink className="h-3.5 w-3.5" />
                    </a>
                  </div>

                  <p className="text-xs font-semibold text-foreground truncate" title={file.name}>
                    {file.name}
                  </p>

                  <div className="flex items-center justify-between mt-3 pt-2 border-t border-border/40 text-[10px] text-muted-foreground">
                    <span>{file.size ? `${Math.round(Number(file.size) / 1024)} KB` : "Arquivo"}</span>
                    <a
                      href={file.webContentLink || file.webViewLink || "#"}
                      target="_blank"
                      rel="noreferrer"
                      className="text-primary hover:underline font-bold flex items-center gap-1"
                    >
                      <Download className="h-3 w-3" /> Baixar
                    </a>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="space-y-1.5">
              {filteredFiles.map((file) => (
                <div
                  key={file.id}
                  className="flex items-center justify-between p-3 rounded-xl border border-border/70 bg-card/40 hover:bg-card hover:border-primary/50 transition text-xs"
                >
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    {getFileIcon(file.mimeType)}
                    <span className="font-medium truncate text-foreground" title={file.name}>
                      {file.name}
                    </span>
                  </div>

                  <div className="flex items-center gap-6 shrink-0 text-muted-foreground text-[11px]">
                    <span>{file.size ? `${Math.round(Number(file.size) / 1024)} KB` : "—"}</span>
                    <a
                      href={file.webContentLink || file.webViewLink || "#"}
                      target="_blank"
                      rel="noreferrer"
                      className="text-primary hover:underline font-bold flex items-center gap-1"
                    >
                      <Download className="h-3.5 w-3.5" /> Baixar
                    </a>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
