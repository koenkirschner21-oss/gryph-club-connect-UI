-- C1 audit: duplicate default group chats
WITH default_chats AS (
  SELECT
    c.club_id,
    lower(trim(c.name)) AS chat_key,
    c.id AS conversation_id,
    c.name,
    c.created_at
  FROM public.conversations c
  WHERE c.type = 'group'
    AND lower(trim(c.name)) IN ('general', 'executive team')
),
dupes AS (
  SELECT club_id, chat_key
  FROM default_chats
  GROUP BY club_id, chat_key
  HAVING count(*) > 1
)
SELECT
  cl.name AS club_name,
  dc.club_id,
  dc.chat_key,
  dc.conversation_id,
  dc.name AS conversation_name,
  dc.created_at,
  (SELECT count(*) FROM public.direct_messages dm WHERE dm.conversation_id = dc.conversation_id) AS message_count,
  (
    SELECT coalesce(array_agg(cm.user_id::text), '{}')
    FROM public.conversation_members cm
    WHERE cm.conversation_id = dc.conversation_id
  ) AS member_user_ids
FROM default_chats dc
JOIN dupes d ON d.club_id = dc.club_id AND d.chat_key = dc.chat_key
JOIN public.clubs cl ON cl.id = dc.club_id
ORDER BY cl.name, dc.chat_key, dc.created_at;
