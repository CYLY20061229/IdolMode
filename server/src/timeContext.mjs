const PERIODS = new Set(["breakfast", "lunch", "dinner", "late_night", "daytime"]);

const lateNightPatterns = [
  /凌晨/,
  /深夜/,
  /睡不着/,
  /睡前/,
  /晚安/,
  /熬夜/,
  /夜深/,
  /月亮/,
  /梦里/,
  /midnight/i,
  /late night/i,
  /goodnight/i,
  /can't sleep/i,
  /couldn't sleep/i,
  /寝/,
  /잠이/,
  /밤/
];

export function resolveTimeContext(input = {}) {
  const now = new Date();
  const hour = Number.isFinite(Number(input.hour)) ? Number(input.hour) : now.getHours();
  const minute = Number.isFinite(Number(input.minute)) ? Number(input.minute) : now.getMinutes();
  const rawPeriod = String(input.period || "");

  if (PERIODS.has(rawPeriod)) {
    return { hour, minute, period: rawPeriod };
  }

  const minutes = hour * 60 + minute;
  let period = "daytime";
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

export function isLateNightPeriod(timeContext = {}) {
  return resolveTimeContext(timeContext).period === "late_night";
}

export function isMessageAllowedForTime(message = {}, timeContext = {}) {
  if (isLateNightPeriod(timeContext)) return true;
  if (message.personaType === "late night fan") return false;

  const text = [
    message.content,
    message.translatedContent,
    message.translated_content
  ].filter(Boolean).join(" ");

  return !lateNightPatterns.some((pattern) => pattern.test(text));
}

export function describeTimeContext(timeContext = {}) {
  const { hour, minute, period } = resolveTimeContext(timeContext);
  const clock = `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;

  if (period === "breakfast") {
    return `Current user local time is ${clock}. Morning breakfast window: fans may mention breakfast, commute, early class, or getting ready for work.`;
  }
  if (period === "lunch") {
    return `Current user local time is ${clock}. Lunch window: fans may ask about lunch, cafeteria, takeout, or eating properly.`;
  }
  if (period === "dinner") {
    return `Current user local time is ${clock}. Dinner window: fans may ask about dinner, after-school or after-work tiredness.`;
  }
  if (period === "late_night") {
    return `Current user local time is ${clock}. Late window: softer evening messages are allowed, but do not create a separate "late night fan" persona.`;
  }
  return `Current user local time is ${clock}. Daytime window: avoid late-night, insomnia, bedtime, midnight, goodnight, and moon imagery.`;
}

export function preferredPersonaTypesForTime(timeContext = {}) {
  const { period } = resolveTimeContext(timeContext);
  if (period === "breakfast") return ["breakfast check fan", "school fan", "working adult fan", "mom fan"];
  if (period === "lunch") return ["lunch break fan", "mom fan", "life diary fan", "working adult fan"];
  if (period === "dinner") return ["dinner check fan", "working adult fan", "mom fan", "life diary fan"];
  if (period === "late_night") return ["sleep police", "quiet poet", "random confession fan"];
  return [];
}
