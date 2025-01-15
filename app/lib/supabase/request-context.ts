import { AsyncLocalStorage } from "async_hooks";

interface RequestContext {
  requestId: string;
  timestamp: number;
}

export const requestContext = new AsyncLocalStorage<RequestContext>();

export function generateRequestId() {
  return (
    Math.random().toString(36).substring(2, 15) +
    Math.random().toString(36).substring(2, 15)
  );
}
