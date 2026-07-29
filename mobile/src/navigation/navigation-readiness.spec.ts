import { rootNavigationReadiness } from './navigation-readiness';

describe('root navigation readiness', () => {
  beforeEach(() => {
    rootNavigationReadiness.markNotReady();
  });

  it('defers subscribers until navigation is ready', () => {
    const listener = jest.fn();
    const unsubscribe = rootNavigationReadiness.subscribe(listener);

    expect(listener).not.toHaveBeenCalled();
    rootNavigationReadiness.markReady();
    rootNavigationReadiness.markReady();

    expect(listener).toHaveBeenCalledTimes(1);
    unsubscribe();
  });

  it('runs late subscribers immediately and supports cleanup', () => {
    rootNavigationReadiness.markReady();
    const listener = jest.fn();
    const unsubscribe = rootNavigationReadiness.subscribe(listener);

    expect(listener).toHaveBeenCalledTimes(1);
    unsubscribe();
    rootNavigationReadiness.markNotReady();
    rootNavigationReadiness.markReady();

    expect(listener).toHaveBeenCalledTimes(1);
  });
});
