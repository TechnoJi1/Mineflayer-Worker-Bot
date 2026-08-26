function printable(details: unknown): unknown {
  if (details instanceof Error) {
    return { name: details.name, message: details.message, stack: details.stack };
  }
  return details;
}

export function log(prefix: string, message: string, details?: unknown): void {
  const suffix = details === undefined ? "" : ` ${JSON.stringify(printable(details))}`;
  console.log(`${prefix} ${message}${suffix}`);
}

export function error(prefix: string, message: string, details?: unknown): void {
  const suffix = details === undefined ? "" : ` ${JSON.stringify(printable(details))}`;
  console.error(`${prefix} ${message}${suffix}`);
}