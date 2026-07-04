-- Post-reset validation for Group D tester Cameron Berdin (cameronberdin@gmail.com).
-- Run: supabase db query --linked --file scripts/cameron_berdin_reset_verify.sql

SELECT 'auth_users' AS check_name, count(*) AS cnt
FROM auth.users
WHERE lower(trim(email)) = lower('cameronberdin@gmail.com');

SELECT 'club_members' AS check_name, c.name, cm.role, cm.access_level, cm.status, cm.title
FROM public.club_members cm
JOIN public.clubs c ON c.id = cm.club_id
WHERE cm.user_id IN (
  SELECT id FROM auth.users WHERE lower(trim(email)) = lower('cameronberdin@gmail.com')
)
ORDER BY c.name;

SELECT 'other_club_memberships' AS check_name, count(*) AS cnt
FROM public.club_members cm
WHERE cm.user_id IN (
  SELECT id FROM auth.users WHERE lower(trim(email)) = lower('cameronberdin@gmail.com')
)
AND cm.club_id NOT IN (
  'afcde36d-91ca-45a0-ac8a-0dc287c4b5b5'::uuid,
  '91ac4dec-c0e8-4947-b399-5336f5422405'::uuid
);

SELECT 'lego_permission_role' AS check_name,
  public.club_member_permission_role(
    'afcde36d-91ca-45a0-ac8a-0dc287c4b5b5'::uuid,
    (SELECT id FROM auth.users WHERE lower(trim(email)) = lower('cameronberdin@gmail.com') LIMIT 1)
  ) AS role;

SELECT 'connect_permission_role' AS check_name,
  public.club_member_permission_role(
    '91ac4dec-c0e8-4947-b399-5336f5422405'::uuid,
    (SELECT id FROM auth.users WHERE lower(trim(email)) = lower('cameronberdin@gmail.com') LIMIT 1)
  ) AS role;
