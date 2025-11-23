import { BookingsList } from "../BookingsList";

const mockBookings = [
  {
    id: "1",
    clientName: "Александр Иванов",
    clientPhone: "+7 999 123-45-67",
    masterName: "INKMAN",
    service: "Сеанс 2ч",
    date: "23.10.2025",
    time: "14:00",
    status: "confirmed" as const,
  },
  {
    id: "2",
    clientName: "Мария Петрова",
    clientPhone: "+7 999 234-56-78",
    masterName: "INKMAN",
    service: "Консультация",
    date: "24.10.2025",
    time: "11:00",
    status: "pending" as const,
  },
  {
    id: "3",
    clientName: "Дмитрий Сидоров",
    clientPhone: "+7 999 345-67-89",
    masterName: "INK_QUEEN",
    service: "Сеанс 4ч",
    date: "25.10.2025",
    time: "16:00",
    status: "confirmed" as const,
  },
  {
    id: "4",
    clientName: "Анна Смирнова",
    clientPhone: "+7 999 456-78-90",
    masterName: "DARK_ART",
    service: "Сеанс 2ч",
    date: "22.10.2025",
    time: "12:00",
    status: "cancelled" as const,
  },
];

export default function BookingsListExample() {
  return (
    <div className="p-6">
      <BookingsList bookings={mockBookings} />
    </div>
  );
}
