export type FanMessagePeriod =
  | "breakfast"
  | "lunch"
  | "dinner"
  | "late_night"
  | "daytime";

export type FanMessageTimeContext = {
  hour: number;
  minute: number;
  period: FanMessagePeriod;
};

export function getFanMessageTimeContext(date = new Date()): FanMessageTimeContext {
  const hour = date.getHours();
  const minute = date.getMinutes();
  const minutes = hour * 60 + minute;

  let period: FanMessagePeriod = "daytime";
  if (minutes >= 7 * 60 && minutes < 9 * 60) {
    period = "breakfast";
  } else if (minutes >= 11 * 60 + 30 && minutes < 12 * 60 + 30) {
    period = "lunch";
  } else if (minutes >= 17 * 60 && minutes < 19 * 60) {
    period = "dinner";
  } else if (minutes >= 23 * 60 || minutes < 2 * 60) {
    period = "late_night";
  }

  return { hour, minute, period };
}
