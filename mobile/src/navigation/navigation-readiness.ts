type ReadyListener = () => void;

class NavigationReadiness {
  private ready = false;
  private readonly listeners = new Set<ReadyListener>();

  isReady(): boolean {
    return this.ready;
  }

  subscribe(listener: ReadyListener): () => void {
    this.listeners.add(listener);
    if (this.ready) {
      listener();
    }
    return () => {
      this.listeners.delete(listener);
    };
  }

  markReady(): void {
    if (this.ready) {
      return;
    }
    this.ready = true;
    for (const listener of this.listeners) {
      listener();
    }
  }

  markNotReady(): void {
    this.ready = false;
  }
}

export const rootNavigationReadiness = new NavigationReadiness();
