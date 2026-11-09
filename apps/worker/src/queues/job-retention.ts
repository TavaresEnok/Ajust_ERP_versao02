/** Bound Redis usage even for recurring schedules created before these defaults existed. */
export const JOB_RETENTION = {
  removeOnComplete: { age: 24 * 60 * 60, count: 1000 },
  removeOnFail: { age: 7 * 24 * 60 * 60, count: 1000 },
};

export function jobInterval(name: string, fallback: number) {
  const value = Number(process.env[name] ?? fallback);
  if (!Number.isSafeInteger(value) || value < 1000)
    throw new Error(`${name} must be an integer of at least 1000 ms.`);
  return value;
}
