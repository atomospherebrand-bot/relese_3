import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Save, Upload, X } from "lucide-react";
import { useEffect, useState } from "react";

interface BotMessage {
  id: string;
  key: string;
  label: string;
  value: string;
  type: "text" | "textarea";
  imageUrl?: string | null;
}

interface BotMessagesEditorProps {
  messages: BotMessage[];
  onSave: (messages: BotMessage[]) => void;
}

export function BotMessagesEditor({ messages: initialMessages, onSave }: BotMessagesEditorProps) {
  const [messages, setMessages] = useState(initialMessages);
  const [uploading, setUploading] = useState<string | null>(null);

  useEffect(() => {
    setMessages(initialMessages);
  }, [initialMessages]);

  const handleChange = (id: string, value: string) => {
    setMessages((prev) =>
      prev.map((msg) => (msg.id === id ? { ...msg, value } : msg))
    );
  };

  const handleImageUpload = async (id: string, file: File) => {
    setUploading(id);
    try {
      const formData = new FormData();
      formData.append("file", file);

      const response = await fetch("/api/upload", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        throw new Error("Upload failed");
      }

      const data = await response.json();
      const imageUrl = data.url;

      setMessages((prev) =>
        prev.map((msg) => (msg.id === id ? { ...msg, imageUrl } : msg))
      );
    } catch (error) {
      console.error("Image upload failed:", error);
      alert("Не удалось загрузить изображение");
    } finally {
      setUploading(null);
    }
  };

  const handleRemoveImage = (id: string) => {
    setMessages((prev) =>
      prev.map((msg) => (msg.id === id ? { ...msg, imageUrl: null } : msg))
    );
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold">Сообщения бота</h2>
        <Button onClick={() => onSave(messages)} data-testid="button-save-messages">
          <Save className="h-4 w-4 mr-2" />
          Сохранить изменения
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Текст сообщений</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-6">
            {messages.map((message) => (
              <div key={message.id} className="space-y-2" data-testid={`message-field-${message.key}`}>
                <Label htmlFor={message.id}>{message.label}</Label>
                {message.type === "textarea" ? (
                  <Textarea
                    id={message.id}
                    value={message.value}
                    onChange={(e) => handleChange(message.id, e.target.value)}
                    rows={4}
                    data-testid={`textarea-${message.key}`}
                  />
                ) : (
                  <Input
                    id={message.id}
                    value={message.value}
                    onChange={(e) => handleChange(message.id, e.target.value)}
                    data-testid={`input-${message.key}`}
                  />
                )}
                
                <div className="mt-3">
                  <Label className="text-sm text-muted-foreground">Изображение (опционально)</Label>
                  {message.imageUrl ? (
                    <div className="mt-2 relative inline-block">
                      <img 
                        src={message.imageUrl} 
                        alt="Message attachment" 
                        className="max-w-xs rounded-lg border"
                      />
                      <Button
                        type="button"
                        variant="destructive"
                        size="icon"
                        className="absolute top-2 right-2"
                        onClick={() => handleRemoveImage(message.id)}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  ) : (
                    <div className="mt-2">
                      <Input
                        type="file"
                        accept="image/*"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) {
                            handleImageUpload(message.id, file);
                          }
                        }}
                        disabled={uploading === message.id}
                      />
                      {uploading === message.id && (
                        <p className="text-sm text-muted-foreground mt-1">Загрузка...</p>
                      )}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
