type Matcher<
  T extends {
    [key: string]: boolean | number | string | symbol | undefined | null;
  }
> = [T, (rest: { [key: string]: any }) => any];
type MatcherSet<
  T,
  A extends (value: T) => any,
  M extends MatcherSet<T, any, any> = MatcherSet<T, any, any>
> = [] | [Partial<Parameters<A>[0]>, A, ...M];

export function createMatch<T, M extends MatcherSet<T, Partial<T>, any>>(
  goal: Partial<T>,
  action: (value: T) => any,
  ...more: M
) {
  return function (value: T) {};
}

function equal(target, goal) {
  if (target === goal) return true;
  if (typeof goal === "object") {
    if (typeof target !== "object") return false;
    for (const key of Object.keys(goal)) {
      if (!(key in target)) return false;
      if (!equal(target[key], goal[key])) {
        return false;
      }
    }
    return true;
  }
  return false;
}

export function match<
  T extends { [key: string]: any },
  A extends (value: T) => any,
  M extends MatcherSet<T, any, any>
>(target: T, goal: Partial<Parameters<A>[0]>, action: A, ...more: M): any {
  if (!equal(target, goal)) {
    if (more.length > 1) {
      return match(target, ...more);
    }
    return;
  }

  return action(target);
}
