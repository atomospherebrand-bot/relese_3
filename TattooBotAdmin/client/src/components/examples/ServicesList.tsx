import { ServicesList } from "../ServicesList";

const mockServices = [
  {
    id: "1",
    name: "Сеанс 2ч",
    duration: 120,
    price: 12000,
    description: "Стандартный сеанс тату",
  },
  {
    id: "2",
    name: "Сеанс 4ч",
    duration: 240,
    price: 22000,
    description: "Расширенный сеанс для крупных работ",
  },
  {
    id: "3",
    name: "Консультация",
    duration: 30,
    price: 0,
    description: "Бесплатная консультация и разработка эскиза",
  },
];

export default function ServicesListExample() {
  return (
    <div className="p-6 max-w-4xl">
      <ServicesList
        services={mockServices}
        onEdit={(id) => console.log("Edit service:", id)}
        onDelete={(id) => console.log("Delete service:", id)}
        onAdd={() => console.log("Add service")}
      />
    </div>
  );
}
