SELECT
  cr.id AS request_id,
  cr.name,
  cr.status,
  cr.submitted_by,
  cr.club_id,
  cr.reviewed_at,
  cm.role,
  cm.access_level,
  cm.status AS member_status,
  cm.title
FROM public.club_requests cr
LEFT JOIN public.club_members cm
  ON cm.club_id = cr.club_id AND cm.user_id = cr.submitted_by
WHERE cr.status = 'approved'
ORDER BY cr.reviewed_at DESC NULLS LAST
LIMIT 10;
