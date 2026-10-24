/**
 * Issues monotonically increasing tokens so async callers can ignore every
 * completion except the newest one. Invalidating also retires in-flight work.
 */
export class LatestRequest {
  private sequence = 0;

  begin(): number {
    this.sequence += 1;
    return this.sequence;
  }

  invalidate(): void {
    this.sequence += 1;
  }

  isCurrent(token: number): boolean {
    return token === this.sequence;
  }
}
