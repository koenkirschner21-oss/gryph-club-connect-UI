import { supabase } from "./supabaseClient";
import { filterRsvpQuestionsForLoggedInUser } from "./eventRsvpUtils";

export async function eventRequiresRsvpQuestionnaire(
  eventId: string,
  forLoggedInUser = true,
): Promise<boolean> {
  const { data, error } = await supabase
    .from("event_form_questions")
    .select("id, question")
    .eq("event_id", eventId)
    .order("order_index", { ascending: true });

  if (error) {
    console.error("Failed to load RSVP questions:", error.message);
    return false;
  }

  const questions = (data ?? []).map((row) => ({
    question: (row.question as string) ?? "",
  }));

  if (!forLoggedInUser) {
    return questions.length > 0;
  }

  return filterRsvpQuestionsForLoggedInUser(questions).length > 0;
}
