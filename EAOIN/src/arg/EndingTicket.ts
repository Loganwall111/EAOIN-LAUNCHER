/**
 * EndingTicket — the read-once ticket at the end of the credits.
 *
 * 2.0 Update Part 2 ending overhaul: when the player finishes the game (defeats
 * the Creator in the Corrupted Lands / completes the credits), a ticket appears
 * on screen at the very end. It shows a set of numbers that complete the key,
 * and can only be read ONCE before rejoining the world — after that it reads
 * "READ". The numbers combine with the ARG fragments to unlock the secret
 * ending.
 *
 * The ticket numbers are a phone-keypad encoding of "EAOIN": E=3, A=2, O=6,
 * I=4, N=6 → 32646. Combined with the fragments, the full key is revealed.
 */
export interface EndingTicketState {
  granted: boolean;
  read: boolean;
  code: string;
}

const STORAGE_KEY = 'eaoin:ending-ticket:v1';

export function endingTicketDefaults(): EndingTicketState {
  return { granted: false, read: false, code: '32646' };
}

/** Phone-keypad encoding of the EAOIN key. */
export const ENDING_TICKET_CODE = '32646';

export class EndingTicket {
  private state: EndingTicketState;

  constructor() {
    this.state = this.load();
  }

  private load(): EndingTicketState {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const p = JSON.parse(raw) as Partial<EndingTicketState>;
        return {
          granted: Boolean(p.granted),
          read: Boolean(p.read),
          code: typeof p.code === 'string' ? p.code : ENDING_TICKET_CODE,
        };
      }
    } catch { /* ignore */ }
    return endingTicketDefaults();
  }

  private save(): void {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(this.state)); } catch { /* ignore */ }
  }

  /** Grant the ticket (called at the end of the credits). Idempotent. */
  grant(): EndingTicketState {
    if (!this.state.granted) {
      this.state.granted = true;
      this.state.read = false;
      this.save();
    }
    return this.get();
  }

  /** Read the ticket. First read returns the code; later reads return "READ". */
  read(): EndingTicketState {
    if (this.state.granted) {
      this.state.read = true;
      this.save();
    }
    return this.get();
  }

  get(): EndingTicketState {
    return { ...this.state };
  }

  reset(): void {
    this.state = endingTicketDefaults();
    this.save();
  }
}

let _ticket: EndingTicket | null = null;
export function getEndingTicket(): EndingTicket {
  if (!_ticket) _ticket = new EndingTicket();
  return _ticket;
}
