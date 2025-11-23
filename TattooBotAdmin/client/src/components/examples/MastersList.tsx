import { MastersList } from "../MastersList";

const mockMasters = [
  {
    id: "1",
    name: "Александр",
    nickname: "INKMAN",
    specialization: "Черно-белая графика, реализм, минимализм",
    isActive: true,
  },
  {
    id: "2",
    name: "Мария",
    nickname: "INK_QUEEN",
    specialization: "Цветные работы, акварель",
    isActive: true,
  },
  {
    id: "3",
    name: "Дмитрий",
    nickname: "DARK_ART",
    specialization: "Дарк-арт, блэкворк",
    isActive: false,
  },
];

export default function MastersListExample() {
  return (
    <div className="p-6">
      <MastersList
        masters={mockMasters}
        onEdit={(id) => console.log("Edit master:", id)}
        onDelete={(id) => console.log("Delete master:", id)}
        onAdd={() => console.log("Add master")}
      />
    </div>
  );
}
