-- Summary counts
WITH default_chats AS (
  SELECT c.club_id, lower(trim(c.name)) AS chat_key, c.id
  FROM public.conversations c
  WHERE c.type = 'group'
    AND lower(trim(c.name)) IN ('general', 'executive team')
)
SELECT
  count(DISTINCT club_id) FILTER (WHERE dup_count > 1) AS clubs_with_duplicates,
  sum(dup_count - 1) FILTER (WHERE dup_count > 1) AS redundant_conversations
FROM (
  SELECT club_id, chat_key, count(*) AS dup_count
  FROM default_chats
  GROUP BY club_id, chat_key
) s;

-- All clubs default chat counts
SELECT
  cl.name,
  lower(trim(c.name)) AS chat_key,
  count(*) AS chat_count
FROM public.conversations c
JOIN public.clubs cl ON cl.id = c.club_id
WHERE c.type = 'group'
  AND lower(trim(c.name)) IN ('general', 'executive team')
GROUP BY cl.name, c.club_id, lower(trim(c.name))
HAVING count(*) <> 1
ORDER BY cl.name, chat_key;
