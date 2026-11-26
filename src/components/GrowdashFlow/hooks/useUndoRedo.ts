import { useCallback, useRef, useState } from "react";

export function useUndoRedo<T>(initialValue: T, limit = 80) {
  const [value, setValueState] = useState(initialValue);
  const valueRef = useRef(initialValue);
  const pastRef = useRef<T[]>([]);
  const futureRef = useRef<T[]>([]);
  const [, forceRender] = useState(0);

  const replace = useCallback((next: T | ((current: T) => T)) => {
    const resolved = typeof next === "function" ? (next as (current: T) => T)(valueRef.current) : next;
    valueRef.current = resolved;
    setValueState(resolved);
  }, []);

  const commit = useCallback((next: T | ((current: T) => T)) => {
    const current = valueRef.current;
    const resolved = typeof next === "function" ? (next as (current: T) => T)(current) : next;
    if (Object.is(current, resolved)) return;
    pastRef.current = [...pastRef.current, structuredClone(current)].slice(-limit);
    futureRef.current = [];
    valueRef.current = resolved;
    setValueState(resolved);
    forceRender((version) => version + 1);
  }, [limit]);

  const checkpoint = useCallback((previous: T) => {
    if (JSON.stringify(previous) === JSON.stringify(valueRef.current)) return;
    pastRef.current = [...pastRef.current, structuredClone(previous)].slice(-limit);
    futureRef.current = [];
    forceRender((version) => version + 1);
  }, [limit]);

  const undo = useCallback(() => {
    const previous = pastRef.current.pop();
    if (previous === undefined) return;
    futureRef.current.unshift(structuredClone(valueRef.current));
    valueRef.current = previous;
    setValueState(previous);
    forceRender((version) => version + 1);
  }, []);

  const redo = useCallback(() => {
    const next = futureRef.current.shift();
    if (next === undefined) return;
    pastRef.current.push(structuredClone(valueRef.current));
    valueRef.current = next;
    setValueState(next);
    forceRender((version) => version + 1);
  }, []);

  const reset = useCallback((next: T) => {
    pastRef.current = [];
    futureRef.current = [];
    valueRef.current = next;
    setValueState(next);
    forceRender((version) => version + 1);
  }, []);

  return {
    value,
    valueRef,
    commit,
    replace,
    checkpoint,
    undo,
    redo,
    reset,
    canUndo: pastRef.current.length > 0,
    canRedo: futureRef.current.length > 0,
  };
}
