export type MeetingState = 'none' | 'proposed_by_me' | 'proposed_by_other' | 'agreed' | 'expired';

type MeetingFields = {
  meeting_at: string | null;
  meeting_proposed_by: string | null;
  meeting_accepted_at: string | null;
};

/** Where the date negotiation of a trade stands for the person `uid`. */
export function meetingState(trade: MeetingFields, uid: string, now: number = Date.now()): MeetingState {
  if (!trade.meeting_at) return 'none';
  if (trade.meeting_accepted_at) return 'agreed';
  if (new Date(trade.meeting_at).getTime() <= now) return 'expired';
  return trade.meeting_proposed_by === uid ? 'proposed_by_me' : 'proposed_by_other';
}
