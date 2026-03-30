export type CalendarEventType = "earnings" | "dividend" | "split";
export type CalendarEventTime = "before_market" | "after_market" | "during_market";

export interface CalendarEvent {
  id: string;
  ticker: string;
  event_type: CalendarEventType;
  event_date: string;
  event_time?: CalendarEventTime;
  provider: string;
  retrieved_at: string;
}

