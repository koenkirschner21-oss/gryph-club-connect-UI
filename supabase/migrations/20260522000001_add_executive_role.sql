ALTER TABLE club_members
DROP CONSTRAINT IF EXISTS club_members_role_check;

ALTER TABLE club_members
ADD CONSTRAINT club_members_role_check
CHECK (role IN ('owner', 'executive', 'member'));
