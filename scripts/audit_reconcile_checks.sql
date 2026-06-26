SELECT check_name, exists_flag FROM (
  SELECT '20260524000009.table.club_resource_links' AS check_name,
    EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='club_resource_links') AS exists_flag
  UNION ALL SELECT '20260524000010.table.chat_polls',
    EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='chat_polls')
  UNION ALL SELECT '20260524000011.table.meeting_proposals',
    EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='meeting_proposals')
  UNION ALL SELECT '20260524000012.col.events.is_recurring',
    EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='events' AND column_name='is_recurring')
  UNION ALL SELECT '20260526000001.table.post_reactions',
    EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='post_reactions')
  UNION ALL SELECT '20260526000001.table.post_views',
    EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='post_views')
  UNION ALL SELECT '20260526000001.col.posts.is_pinned',
    EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='posts' AND column_name='is_pinned')
  UNION ALL SELECT '20260527000001.table.job_applications',
    EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='job_applications')
  UNION ALL SELECT '20260528000001.table.club_requests',
    EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='club_requests')
  UNION ALL SELECT '20260529000001.table.post_reports',
    EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='post_reports')
  UNION ALL SELECT '20260529000002.table.club_invites',
    EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='club_invites')
  UNION ALL SELECT '20260530000001.table.bug_reports',
    EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='bug_reports')
  UNION ALL SELECT '20260530000002.table.club_join_applications',
    EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='club_join_applications')
  UNION ALL SELECT '20260530000002.col.clubs.join_type',
    EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='clubs' AND column_name='join_type')
  UNION ALL SELECT '20260530000003.col.club_positions.commitment_level',
    EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='club_positions' AND column_name='commitment_level')
  UNION ALL SELECT '20260530000004.table.hiring_listings',
    EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='hiring_listings')
  UNION ALL SELECT '20260530000004.col.profiles.onboarding_completed',
    EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='profiles' AND column_name='onboarding_completed')
  UNION ALL SELECT '20260530000005.col.club_positions.hiring_listing_id',
    EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='club_positions' AND column_name='hiring_listing_id')
  UNION ALL SELECT '20260530000006.col.club_invites.expires_at',
    EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='club_invites' AND column_name='expires_at')
  UNION ALL SELECT '20260603000001.col.posts.updated_at',
    EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='posts' AND column_name='updated_at')
  UNION ALL SELECT '20260603000002.col.direct_messages.reply_to_id',
    EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='direct_messages' AND column_name='reply_to_id')
  UNION ALL SELECT '20260603000003.fk.hiring_applications_applicant_fk',
    EXISTS (SELECT 1 FROM pg_constraint WHERE conname='hiring_applications_applicant_fk')
  UNION ALL SELECT '20260604000001.table.message_reactions',
    EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='message_reactions')
  UNION ALL SELECT '20260610000003.col.clubs.setup_completed',
    EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='clubs' AND column_name='setup_completed')
  UNION ALL SELECT '20260610000004.col.club_members.access_level',
    EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='club_members' AND column_name='access_level')
  UNION ALL SELECT '20260610000005.col.club_documents.visibility',
    EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='club_documents' AND column_name='visibility')
  UNION ALL SELECT '20260610000006.col.club_members.join_answers',
    EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='club_members' AND column_name='join_answers')
  UNION ALL SELECT '20260610000007.table.inbox_messages',
    EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='inbox_messages')
  UNION ALL SELECT '20260610000008.table.application_notes',
    EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='application_notes')
  UNION ALL SELECT '20260610000008.col.hiring_applications.sub_status',
    EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='hiring_applications' AND column_name='sub_status')
  UNION ALL SELECT '20260610000009.table.club_reports',
    EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='club_reports')
  UNION ALL SELECT '20260610000010.table.ownership_transfers',
    EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='ownership_transfers')
  UNION ALL SELECT '20260610000011.table.executive_invites',
    EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='executive_invites')
  UNION ALL SELECT '20260610000011.fn.accept_executive_invite',
    EXISTS (SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND p.proname='accept_executive_invite')
  UNION ALL SELECT '20260612000001.fn.user_conversation_ids',
    EXISTS (SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND p.proname='user_conversation_ids')
  UNION ALL SELECT '20260612000002.col.clubs.custom_permissions',
    EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='clubs' AND column_name='custom_permissions')
  UNION ALL SELECT '20260612000003.table.club_meetings',
    EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='club_meetings')
  UNION ALL SELECT '20260612000003.table.meeting_action_items',
    EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='meeting_action_items')
  UNION ALL SELECT '20260612000005.col.tasks.task_type',
    EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='tasks' AND column_name='task_type')
  UNION ALL SELECT '20260612000006.fn.get_executive_invite_by_token',
    EXISTS (SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND p.proname='get_executive_invite_by_token')
  UNION ALL SELECT '20260614000001.fn.send_app_notifications',
    EXISTS (SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND p.proname='send_app_notifications')
  UNION ALL SELECT '20260614000001.policy.notifications_select_own',
    EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='notifications' AND policyname='Users can view own notifications')
  UNION ALL SELECT '20260614000002.policy.claim_cancel_own',
    EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='club_claim_requests' AND policyname='Users can cancel own pending claim requests')
  UNION ALL SELECT '20260615000001.tasks_status_cancelled',
    EXISTS (SELECT 1 FROM pg_constraint c JOIN pg_class t ON t.oid=c.conrelid JOIN pg_namespace n ON n.oid=t.relnamespace WHERE n.nspname='public' AND t.relname='tasks' AND c.conname='tasks_status_check' AND pg_get_constraintdef(c.oid) ILIKE '%cancelled%')
  UNION ALL SELECT '20260616000001.col.clubs.description_confirmed',
    EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='clubs' AND column_name='description_confirmed')
  UNION ALL SELECT '20260617000001.col.events.notes',
    EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='events' AND column_name='notes')
  UNION ALL SELECT '20260630000001.policy.event_rsvps_insert_public_or_member',
    EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='event_rsvps' AND policyname='event_rsvps_insert_public_or_member')
  UNION ALL SELECT '20260630000001.policy.event_rsvps_select_own_or_tenant',
    EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='event_rsvps' AND policyname='event_rsvps_select_own_or_tenant')
) c ORDER BY check_name;
