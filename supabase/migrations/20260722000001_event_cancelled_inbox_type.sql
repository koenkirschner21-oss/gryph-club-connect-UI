-- Allow event_cancelled inbox messages for formal cancellation records.

ALTER TABLE public.inbox_messages
  DROP CONSTRAINT IF EXISTS inbox_messages_type_check;

ALTER TABLE public.inbox_messages
  ADD CONSTRAINT inbox_messages_type_check
  CHECK (type IN (
    'interview_invite', 'interview_confirmed', 'role_offer',
    'club_invite', 'executive_invite', 'ownership_transfer',
    'join_approved', 'join_rejected', 'join_request_submitted',
    'club_claim_approved', 'club_claim_rejected',
    'club_request_approved', 'club_request_rejected',
    'application_update', 'offer_accepted', 'offer_declined', 'admin_message',
    'candidate_selected_time', 'invite_accepted', 'invite_declined',
    'role_updated', 'system_message', 'event_cancelled'
  ));
