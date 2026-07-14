import { useState } from "react";
import { useProducts, useCreateProduct, useUpdateProduct, useDeleteProduct, Product } from "@/hooks/useProducts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { CurrencyInput } from "@/components/ui/CurrencyInput";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Plus, Pencil, Trash2, Package } from "lucide-react";
import { toast } from "sonner";
import { MotionPage, MotionItem } from "@/components/motion/MotionContainer";
import { MotionCard } from "@/components/motion/MotionCard";

export default function Products() {
  const { data: products = [], isLoading } = useProducts();
  const createProduct = useCreateProduct();
  const updateProduct = useUpdateProduct();
  const deleteProduct = useDeleteProduct();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Product | null>(null);
  const [name, setName] = useState("");
  const [price, setPrice] = useState(0);
  const [taxRate, setTaxRate] = useState(0);

  const openCreate = () => {
    setEditing(null);
    setName("");
    setPrice(0);
    setTaxRate(0);
    setDialogOpen(true);
  };

  const openEdit = (p: Product) => {
    setEditing(p);
    setName(p.name);
    setPrice(p.price);
    setTaxRate(p.tax_rate);
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!name.trim()) { toast.error("Nome é obrigatório"); return; }
    try {
      if (editing) {
        await updateProduct.mutateAsync({ id: editing.id, name, price, tax_rate: taxRate });
        toast.success("Produto atualizado!");
      } else {
        await createProduct.mutateAsync({ name, price, tax_rate: taxRate });
        toast.success("Produto criado!");
      }
      setDialogOpen(false);
    } catch {
      toast.error("Erro ao salvar produto");
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteProduct.mutateAsync(id);
      toast.success("Produto excluído!");
    } catch {
      toast.error("Erro ao excluir");
    }
  };

  return (
    <MotionPage className="space-y-6">
      <MotionItem>
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Produtos</h1>
            <p className="text-sm text-muted-foreground mt-1">Gerencie seus produtos para vincular às vendas</p>
          </div>
          <Button onClick={openCreate}><Plus className="h-4 w-4 mr-2" />Novo Produto</Button>
        </div>
      </MotionItem>

      <MotionItem>
        {isLoading ? (
          <div className="text-center py-12 text-muted-foreground">Carregando...</div>
        ) : products.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12 text-center">
              <Package className="h-12 w-12 text-muted-foreground/50 mb-4" />
              <h3 className="font-medium text-lg">Nenhum produto cadastrado</h3>
              <p className="text-sm text-muted-foreground mt-1">Crie um produto para vincular às suas vendas</p>
              <Button className="mt-4" onClick={openCreate}><Plus className="h-4 w-4 mr-2" />Criar Produto</Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {products.map((p) => (
              <MotionCard key={p.id}>
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base flex items-center justify-between">
                      <span className="truncate">{p.name}</span>
                      <div className="flex gap-1 shrink-0">
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(p)}>
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive">
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Excluir produto?</AlertDialogTitle>
                              <AlertDialogDescription>Esta ação não pode ser desfeita.</AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancelar</AlertDialogCancel>
                              <AlertDialogAction onClick={() => handleDelete(p.id)}>Excluir</AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </div>
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Preço</span>
                      <span className="font-medium">R$ {p.price.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between text-sm mt-1">
                      <span className="text-muted-foreground">Imposto</span>
                      <span className="font-medium">{p.tax_rate}%</span>
                    </div>
                  </CardContent>
                </Card>
              </MotionCard>
            ))}
          </div>
        )}
      </MotionItem>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing ? "Editar Produto" : "Novo Produto"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-2">
            <div><Label>Nome</Label><Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Nome do produto" /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Preço (R$)</Label><CurrencyInput value={price} onChange={setPrice} /></div>
              <div><Label>Taxa de Imposto (%)</Label><Input type="number" step="0.01" value={taxRate} onChange={(e) => setTaxRate(Number(e.target.value))} /></div>
            </div>
            <Button className="w-full" onClick={handleSave} disabled={createProduct.isPending || updateProduct.isPending}>
              {editing ? "Salvar Alterações" : "Criar Produto"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </MotionPage>
  );
}
