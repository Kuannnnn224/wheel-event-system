export function unixTimestampSeconds(date = new Date()) {
  return Math.floor(date.getTime() / 1000);
}
