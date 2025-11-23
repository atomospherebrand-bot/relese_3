import { RecentBookings } from "../RecentBookings";

const mockBookings = [
  {
    id: "1",
    clientName: "Александр Иванов",
    clientTelegram: "a.ink",
    masterName: "INKMAN",
    masterTelegram: "inkman_tattoo",
    service: "Сеанс 2ч",
    date: "23.10.2025",
    time: "14:00",
    status: "confirmed" as const,
  },
  {
    id: "2",
    clientName: "Мария Петрова",
    masterName: "INKMAN",
    service: "Консультация",
    date: "24.10.2025",
    time: "11:00",
    status: "pending" as const,
  },
  {
    id: "3",
    clientName: "Дмитрий Сидоров",
    masterName: "INKMAN",
    service: "Сеанс 4ч",
    date: "25.10.2025",
    time: "16:00",
    status: "confirmed" as const,
  },
];

export default function RecentBookingsExample() {
  return (
    <div className="p-6 max-w-4xl">
      <RecentBookings bookings={mockBookings} />
    </div>
  );
}
