import { BotMessagesEditor } from "@/components/BotMessagesEditor";
import { api } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

export default function BotMessages() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const messagesQuery = useQuery({
    queryKey: ["bot-messages"],
    queryFn: () => api.getMessages(),
  });

  const saveMutation = useMutation({
    mutationFn: api.saveMessages,
    onSuccess: () => {
      toast({ title: "Сообщения сохранены" });
      queryClient.invalidateQueries({ queryKey: ["bot-messages"] });
    },
    onError: (error: Error) => {
      toast({ title: "Не удалось сохранить", description: error.message, variant: "destructive" });
    },
  });

  if (messagesQuery.isLoading) {
    return <p>Загрузка сообщений…</p>;
  }

  if (messagesQuery.isError) {
    return <p className="text-destructive">Не удалось загрузить сообщения бота</p>;
  }

  return (
    <BotMessagesEditor
      messages={messagesQuery.data ?? []}
      onSave={(messages) => saveMutation.mutate(messages)}
    />
  );
}
