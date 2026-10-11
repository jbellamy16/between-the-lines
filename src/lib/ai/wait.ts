/** Abortable waits are shared by rate pacing and subscriber cancellation. */
export function wait(ms: number, signal?: AbortSignal) {
  signal?.throwIfAborted();
  return new Promise<void>((resolve, reject) => {
    const done = () => {
      signal?.removeEventListener("abort", abort);
      resolve();
    };
    const timer = setTimeout(done, ms);
    const abort = () => {
      clearTimeout(timer);
      signal?.removeEventListener("abort", abort);
      reject(signal?.reason);
    };
    signal?.addEventListener("abort", abort, { once: true });
  });
}

export function untilAborted<T>(
  task: Promise<T>,
  signal: AbortSignal,
): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const abort = () => reject(signal.reason);
    if (signal.aborted) abort();
    else signal.addEventListener("abort", abort, { once: true });
    void task
      .then(resolve, reject)
      .finally(() => signal.removeEventListener("abort", abort));
  });
}

/** Share work, not ownership of cancellation. The last departing subscriber
 * cancels the transport; a new subscriber must never join an aborted task. */
export function sharedTasks<T>() {
  const pending = new Map<
    string,
    {
      controller: AbortController;
      promise: Promise<T>;
      users: number;
    }
  >();
  return (
    key: string,
    generate: (signal: AbortSignal) => Promise<T>,
    signal?: AbortSignal,
  ): Promise<T> => {
    signal?.throwIfAborted();
    let task = pending.get(key);
    if (!task) {
      const controller = new AbortController();
      task = {
        controller,
        users: 0,
        promise: Promise.resolve().then(() => {
          controller.signal.throwIfAborted();
          return generate(controller.signal);
        }),
      };
      pending.set(key, task);
      const current = task;
      const clean = () => {
        if (pending.get(key) === current) pending.delete(key);
      };
      void task.promise.then(clean, clean);
    }
    const current = task;
    current.users++;
    return new Promise<T>((resolve, reject) => {
      let finished = false;
      const finish = (action: () => void) => {
        if (finished) return;
        finished = true;
        signal?.removeEventListener("abort", abort);
        current.users--;
        if (!current.users) {
          if (pending.get(key) === current) pending.delete(key);
          current.controller.abort();
        }
        action();
      };
      const abort = () => finish(() => reject(signal?.reason));
      signal?.addEventListener("abort", abort, { once: true });
      void current.promise.then(
        (value) => finish(() => resolve(value)),
        (error) => finish(() => reject(error)),
      );
    });
  };
}
