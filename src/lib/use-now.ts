import { useEffect, useState } from 'react';

const MINUTE_MS = 60_000;

// The current time (milliseconds), updated every minute: for anything that changes with the
// clock, like "Open · closes 18:00" turning into "Closes soon". Reading Date.now() directly while
// rendering would freeze at the first render (the React Compiler keeps results it has computed).
export function useNow(): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), MINUTE_MS);
    return () => clearInterval(timer);
  }, []);
  return now;
}
