import { supabase } from "../supabase/client";
import { CHAT_AET_URL } from "./index";

export type ChatAetAccount = {
  id: string;
  email?: string | null;
  displayName?: string | null;
};

/**
 * Returns the currently authenticated Stickman Video account for the
 * Chat AET account-selection screen. It intentionally exposes only
 * non-secret profile information to the UI.
 */
export async function getChatAetAccount(): Promise<ChatAetAccount | null> {
  const { data, error } = await supabase.auth.getUser();
  if (error) throw error;

  const user = data.user;
  if (!user) return null;

  return {
    id: user.id,
    email: user.email,
    displayName:
      (user.user_metadata?.display_name as string | undefined) ??
      (user.user_metadata?.name as string | undefined) ??
      null,
  };
}

/**
 * Builds the Chat AET continuation URL. The actual identity exchange must
 * happen server-side; no password or service-role secret is placed here.
 */
export function getChatAetContinuationUrl(): string {
  return `${CHAT_AET_URL}?chat_aet=continue`;
}
