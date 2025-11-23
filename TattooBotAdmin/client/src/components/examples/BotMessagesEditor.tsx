import { BotMessagesEditor } from "../BotMessagesEditor";

const mockMessages = [
  {
    id: "1",
    key: "welcome",
    label: "Приветствие",
    value: "👋 Привет! Я бот тату-мастера.\n• Запись в пару кликов\n• Напомню о визите\n• Покажу маршрут до студии\n\nРаботаю 24/7 и экономлю до 8 часов в неделю.",
    type: "textarea" as const,
  },
  {
    id: "2",
    key: "booking_start",
    label: "Начало записи",
    value: "Услуга: {service}\nДлительность: {duration} мин\nЦена: {price} ₽\n\nВыберите дату:",
    type: "textarea" as const,
  },
  {
    id: "3",
    key: "booking_confirmed",
    label: "Подтверждение записи",
    value: "✅ Запись подтверждена!\n\nУслуга: {service}\nДата и время: {date} • {time}\nАдрес: {address}\n\nЯ пришлю напоминание заранее. До встречи!",
    type: "textarea" as const,
  },
  {
    id: "4",
    key: "button_booking",
    label: "Кнопка записи",
    value: "📅 Записаться",
    type: "text" as const,
  },
  {
    id: "5",
    key: "button_portfolio",
    label: "Кнопка портфолио",
    value: "🖼️ Портфолио",
    type: "text" as const,
  },
  {
    id: "6",
    key: "button_location",
    label: "Кнопка локации",
    value: "📍 Как добраться",
    type: "text" as const,
  },
];

export default function BotMessagesEditorExample() {
  return (
    <div className="p-6 max-w-4xl">
      <BotMessagesEditor
        messages={mockMessages}
        onSave={(messages) => console.log("Save messages:", messages)}
      />
    </div>
  );
}
