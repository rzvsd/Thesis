export interface ZonedDateTimeParts {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
}

function parsePart(
  parts: Intl.DateTimeFormatPart[],
  type: Intl.DateTimeFormatPartTypes
): number {
  const value = parts.find((part) => part.type === type)?.value;
  if (!value) {
    throw new Error(`Missing date part: ${type}`);
  }
  return Number.parseInt(value, 10);
}

export function getZonedDateTimeParts(date: Date, timeZone: string): ZonedDateTimeParts {
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false
  });
  const parts = formatter.formatToParts(date);

  return {
    year: parsePart(parts, "year"),
    month: parsePart(parts, "month"),
    day: parsePart(parts, "day"),
    hour: parsePart(parts, "hour"),
    minute: parsePart(parts, "minute"),
    second: parsePart(parts, "second")
  };
}

function shiftLocalDate(
  year: number,
  month: number,
  day: number,
  dayDelta: number
): { year: number; month: number; day: number } {
  const utc = new Date(Date.UTC(year, month - 1, day));
  utc.setUTCDate(utc.getUTCDate() + dayDelta);
  return {
    year: utc.getUTCFullYear(),
    month: utc.getUTCMonth() + 1,
    day: utc.getUTCDate()
  };
}

export function zonedDateTimeToUtc(
  localDateTime: ZonedDateTimeParts,
  timeZone: string
): Date {
  let guessUtcMs = Date.UTC(
    localDateTime.year,
    localDateTime.month - 1,
    localDateTime.day,
    localDateTime.hour,
    localDateTime.minute,
    localDateTime.second
  );

  const targetLocalAsUtcMs = Date.UTC(
    localDateTime.year,
    localDateTime.month - 1,
    localDateTime.day,
    localDateTime.hour,
    localDateTime.minute,
    localDateTime.second
  );

  for (let attempt = 0; attempt < 4; attempt += 1) {
    const currentParts = getZonedDateTimeParts(new Date(guessUtcMs), timeZone);
    const currentLocalAsUtcMs = Date.UTC(
      currentParts.year,
      currentParts.month - 1,
      currentParts.day,
      currentParts.hour,
      currentParts.minute,
      currentParts.second
    );
    const deltaMs = targetLocalAsUtcMs - currentLocalAsUtcMs;
    if (deltaMs === 0) {
      break;
    }
    guessUtcMs += deltaMs;
  }

  return new Date(guessUtcMs);
}

export function computeNextScheduledRun(
  now: Date,
  timeZone: string,
  hour: number,
  minute: number
): Date {
  const nowParts = getZonedDateTimeParts(now, timeZone);
  const todayCandidate = zonedDateTimeToUtc(
    {
      year: nowParts.year,
      month: nowParts.month,
      day: nowParts.day,
      hour,
      minute,
      second: 0
    },
    timeZone
  );

  if (now.getTime() < todayCandidate.getTime()) {
    return todayCandidate;
  }

  const tomorrow = shiftLocalDate(nowParts.year, nowParts.month, nowParts.day, 1);
  return zonedDateTimeToUtc(
    {
      year: tomorrow.year,
      month: tomorrow.month,
      day: tomorrow.day,
      hour,
      minute,
      second: 0
    },
    timeZone
  );
}

export function computeCycleWindowForRun(
  runAt: Date,
  timeZone: string,
  hour: number,
  minute: number
): { cycleStart: string; cycleEnd: string } {
  const localRun = getZonedDateTimeParts(runAt, timeZone);
  const previousDate = shiftLocalDate(localRun.year, localRun.month, localRun.day, -1);
  const previousBoundary = zonedDateTimeToUtc(
    {
      year: previousDate.year,
      month: previousDate.month,
      day: previousDate.day,
      hour,
      minute,
      second: 0
    },
    timeZone
  );

  return {
    cycleStart: previousBoundary.toISOString(),
    cycleEnd: runAt.toISOString()
  };
}

export function computeTestModeCycleWindow(runAt: Date): {
  cycleStart: string;
  cycleEnd: string;
} {
  return {
    cycleStart: new Date(runAt.getTime() - 24 * 60 * 60 * 1000).toISOString(),
    cycleEnd: runAt.toISOString()
  };
}
