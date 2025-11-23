import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Edit, Trash2, Plus, Clock } from "lucide-react";

interface Service {
  id: string;
  name: string;
  duration: number;
  price: number;
  description: string;
}

interface ServicesListProps {
  services: Service[];
  onEdit: (id: string) => void;
  onDelete: (id: string) => void;
  onAdd: () => void;
}

export function ServicesList({ services, onEdit, onDelete, onAdd }: ServicesListProps) {
  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold">Услуги</h2>
        <Button onClick={onAdd} data-testid="button-add-service">
          <Plus className="h-4 w-4 mr-2" />
          Добавить услугу
        </Button>
      </div>

      <div className="grid gap-4">
        {services.map((service) => (
          <Card key={service.id} data-testid={`card-service-${service.id}`}>
            <CardHeader className="pb-3">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1">
                  <CardTitle className="text-lg" data-testid="text-service-name">{service.name}</CardTitle>
                  <p className="text-sm text-muted-foreground mt-1">{service.description}</p>
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => onEdit(service.id)}
                    data-testid={`button-edit-${service.id}`}
                  >
                    <Edit className="h-3 w-3" />
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => onDelete(service.id)}
                    data-testid={`button-delete-${service.id}`}
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-6">
                <div className="flex items-center gap-2">
                  <Clock className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm">{service.duration} мин</span>
                </div>
                <Badge variant="outline" className="font-mono" data-testid="badge-price">
                  ₽{service.price.toLocaleString()}
                </Badge>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
