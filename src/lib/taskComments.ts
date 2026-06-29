import { supabase } from "./supabaseClient";

export async function addTaskComment(
  taskId: string,
  userId: string,
  content: string,
): Promise<boolean> {
  const trimmed = content.trim();
  if (!trimmed) return false;

  const { error } = await supabase.from("task_comments").insert({
    task_id: taskId,
    user_id: userId,
    content: trimmed,
  });

  if (error) {
    console.error("Failed to add task comment:", error.message);
    return false;
  }

  return true;
}
