SELECT
  c.id AS club_id,
  c.name,
  c.created_at,
  c.created_by,
  cm.id AS member_id,
  cm.role,
  cm.access_level,
  cm.status,
  cm.title
FROM public.clubs c
LEFT JOIN public.club_members cm
  ON cm.club_id = c.id AND cm.user_id = c.created_by
WHERE c.claim_status = 'claimed'
  AND c.created_at > now() - interval '90 days'
ORDER BY c.created_at DESC
LIMIT 15;
