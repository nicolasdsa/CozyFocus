const pad = (value: number): string => value.toString().padStart(2, "0");

export const getLocalDayKey = (date: Date = new Date()): string => {
  const year = date.getFullYear();
  const month = pad(date.getMonth() + 1);
  const day = pad(date.getDate());
  return `${year}-${month}-${day}`;
};
