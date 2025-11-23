import { ServicesList } from "@/components/ServicesList";
import ServiceFormDialog from "@/components/ServiceFormDialog";
import { api } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import type { Service } from "@shared/schema";

export default function Services() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingService, setEditingService] = useState<Service | null>(null);

  const servicesQuery = useQuery({
    queryKey: ["services"],
    queryFn: () => api.getServices(),
  });

  const createMutation = useMutation({
    mutationFn: api.createService,
    onSuccess: () => {
      toast({ title: "Услуга создана" });
      queryClient.invalidateQueries({ queryKey: ["services"] });
      setDialogOpen(false);
    },
    onError: (error: Error) => {
      toast({ title: "Не удалось создать услугу", description: error.message, variant: "destructive" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, values }: { id: string; values: Record<string, unknown> }) =>
      api.updateService(id, values),
    onSuccess: () => {
      toast({ title: "Услуга обновлена" });
      queryClient.invalidateQueries({ queryKey: ["services"] });
      setDialogOpen(false);
      setEditingService(null);
    },
    onError: (error: Error) => {
      toast({ title: "Не удалось обновить услугу", description: error.message, variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: api.deleteService,
    onSuccess: () => {
      toast({ title: "Услуга удалена" });
      queryClient.invalidateQueries({ queryKey: ["services"] });
    },
    onError: (error: Error) => {
      toast({ title: "Не удалось удалить услугу", description: error.message, variant: "destructive" });
    },
  });

  const handleAdd = () => {
    setEditingService(null);
    setDialogOpen(true);
  };

  const handleEdit = (id: string) => {
    if (!servicesQuery.data) return;
    const service = servicesQuery.data.find((item) => item.id === id);
    if (!service) return;
    setEditingService(service);
    setDialogOpen(true);
  };

  const handleDelete = (id: string) => {
    if (!window.confirm("Удалить услугу?")) return;
    deleteMutation.mutate(id);
  };

  const handleSubmit = (values: Partial<Service>) => {
    if (editingService) {
      updateMutation.mutate({ id: editingService.id, values });
    } else {
      createMutation.mutate(values as any);
    }
  };

  if (servicesQuery.isLoading) {
    return <p>Загрузка услуг…</p>;
  }

  if (servicesQuery.isError) {
    return <p className="text-destructive">Не удалось загрузить услуги</p>;
  }

  return (
    <>
      <ServicesList
        services={servicesQuery.data ?? []}
        onEdit={handleEdit}
        onDelete={handleDelete}
        onAdd={handleAdd}
      />
      <ServiceFormDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        initialData={editingService}
        onSubmit={handleSubmit}
        title={editingService ? "Редактировать услугу" : "Добавить услугу"}
        submitText={editingService ? "Сохранить" : "Добавить"}
      />
    </>
  );
}
