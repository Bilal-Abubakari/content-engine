import { Injectable } from '@nestjs/common';
import type { InboxStreamEvent } from '@org/shared';
import { Observable, Subject, filter, map } from 'rxjs';

/** An event tagged with its owner so the fan-out can route it per user. */
interface OwnedEvent {
  userId: string;
  event: InboxStreamEvent;
}

/**
 * In-process pub/sub that pushes inbox changes to a user's open SSE streams.
 * Deliberately a single RxJS {@link Subject} filtered per subscriber rather than
 * a per-user map, so there is nothing to clean up when a stream closes — the
 * subscription is torn down by the controller's Observable lifecycle. If the API
 * ever scales past one instance, swap this for a Redis/pubsub-backed bus behind
 * the same {@link emit}/{@link streamFor} surface.
 */
@Injectable()
export class InboxEventsService {
  private readonly events = new Subject<OwnedEvent>();

  /** Broadcast a change for one user to any streams they have open. */
  emit(userId: string, event: InboxStreamEvent): void {
    this.events.next({ userId, event });
  }

  /** A hot stream of just this user's events, for the SSE endpoint to relay. */
  streamFor(userId: string): Observable<InboxStreamEvent> {
    return this.events.asObservable().pipe(
      filter((owned) => owned.userId === userId),
      map((owned) => owned.event),
    );
  }
}
