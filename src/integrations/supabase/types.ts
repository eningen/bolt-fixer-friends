export type Json =
  | string | number | boolean | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  __InternalSupabase: { PostgrestVersion: "14.15" }
  public: {
    Tables: {
      comments: {
        Row: { body: string; created_at: string; id: string; updated_at: string; user_id: string; video_id: string; parent_comment_id: string | null; is_ai: boolean; ai_model: string | null }
        Insert: { body: string; created_at?: string; id?: string; updated_at?: string; user_id: string; video_id: string; parent_comment_id?: string | null; is_ai?: boolean; ai_model?: string | null }
        Update: { body?: string; created_at?: string; id?: string; updated_at?: string; user_id?: string; video_id?: string; parent_comment_id?: string | null; is_ai?: boolean; ai_model?: string | null }
        Relationships: [
          { foreignKeyName: "comments_user_id_fkey"; columns: ["user_id"]; isOneToOne: false; referencedRelation: "profiles"; referencedColumns: ["id"] },
          { foreignKeyName: "comments_video_id_fkey"; columns: ["video_id"]; isOneToOne: false; referencedRelation: "videos"; referencedColumns: ["id"] },
          { foreignKeyName: "comments_parent_comment_id_fkey"; columns: ["parent_comment_id"]; isOneToOne: false; referencedRelation: "comments"; referencedColumns: ["id"] }
        ]
      }
      comment_likes: {
        Row: { comment_id: string; created_at: string; id: string; user_id: string }
        Insert: { comment_id: string; created_at?: string; id?: string; user_id: string }
        Update: { comment_id?: string; created_at?: string; id?: string; user_id?: string }
        Relationships: [
          { foreignKeyName: "comment_likes_comment_id_fkey"; columns: ["comment_id"]; isOneToOne: false; referencedRelation: "comments"; referencedColumns: ["id"] },
          { foreignKeyName: "comment_likes_user_id_fkey"; columns: ["user_id"]; isOneToOne: false; referencedRelation: "profiles"; referencedColumns: ["id"] }
        ]
      }
      likes: { Row: { created_at: string; id: string; user_id: string; video_id: string }; Insert: { created_at?: string; id?: string; user_id: string; video_id: string }; Update: { created_at?: string; id?: string; user_id?: string; video_id?: string }; Relationships: [{ foreignKeyName: "likes_video_id_fkey"; columns: ["video_id"]; isOneToOne: false; referencedRelation: "videos"; referencedColumns: ["id"] }] }
      notifications: { Row: { actor_id: string | null; created_at: string; id: string; read: boolean; type: Database["public"]["Enums"]["notification_type"]; updated_at: string; user_id: string; video_id: string | null }; Insert: { actor_id?: string | null; created_at?: string; id?: string; read?: boolean; type: Database["public"]["Enums"]["notification_type"]; updated_at?: string; user_id?: string; video_id?: string | null }; Update: { actor_id?: string; created_at?: string; id?: string; read?: boolean; type?: Database["public"]["Enums"]["notification_type"]; updated_at?: string; user_id?: string; video_id?: string | null }; Relationships: [] }
      post_comments: {
        Row: { id: string; post_id: string; user_id: string; body: string; parent_comment_id: string | null; created_at: string; updated_at: string }
        Insert: { id?: string; post_id: string; user_id: string; body: string; parent_comment_id?: string | null; created_at?: string; updated_at?: string }
        Update: { id?: string; post_id?: string; user_id?: string; body?: string; parent_comment_id?: string | null; created_at?: string; updated_at?: string }
        Relationships: [
          { foreignKeyName: "post_comments_post_id_fkey"; columns: ["post_id"]; isOneToOne: false; referencedRelation: "posts"; referencedColumns: ["id"] },
          { foreignKeyName: "post_comments_user_id_fkey"; columns: ["user_id"]; isOneToOne: false; referencedRelation: "profiles"; referencedColumns: ["id"] },
          { foreignKeyName: "post_comments_parent_comment_id_fkey"; columns: ["parent_comment_id"]; isOneToOne: false; referencedRelation: "post_comments"; referencedColumns: ["id"] }
        ]
      }
      posts: { Row: { body: string; created_at: string; id: string; updated_at: string; user_id: string }; Insert: { body: string; created_at?: string; id?: string; updated_at?: string; user_id?: string }; Update: { body?: string; created_at?: string; id?: string; updated_at?: string; user_id?: string }; Relationships: [{ foreignKeyName: "posts_user_id_fkey"; columns: ["user_id"]; isOneToOne: false; referencedRelation: "profiles"; referencedColumns: ["id"] }] }
      profiles: { Row: { avatar_url: string | null; bio: string | null; created_at: string; display_name: string; id: string; updated_at: string; username: string }; Insert: { avatar_url?: string | null; bio?: string | null; created_at?: string; id: string; display_name: string; username: string }; Update: { avatar_url?: string | null; bio?: string | null; created_at?: string; id?: string; updated_at?: string; username?: string }; Relationships: [] }
      saved_videos: { Row: { created_at: string; id: string; user_id: string; video_id: string }; Insert: { created_at?: string; id?: string; user_id: string; video_id: string }; Update: { created_at?: string; id?: string; user_id?: string; video_id?: string }; Relationships: [] }
      subscriptions: { Row: { channel_id: string; created_at: string; id: string; subscriber_id: string }; Insert: { channel_id: string; created_at?: string; id?: string; subscriber_id?: string }; Update: { channel_id?: string; created_at?: string; id?: string; subscriber_id?: string }; Relationships: [] }
      videos: { Row: { created_at: string; description: string | null; id: string; platform: string; storage_path: string | null; thumbnail_url: string | null; title: string; updated_at: string; user_id: string; video_url: string; views: number; youtube_id: string | null }; Insert: { created_at?: string; description?: string | null; id?: string; platform?: string; storage_path?: string | null; thumbnail_url?: string | null; title: string; user_id: string; video_url: string; views?: number; youtube_id?: string | null }; Update: { created_at?: string; description?: string | null; id?: string; platform?: string; storage_path?: string | null; thumbnail_url?: string | null; title?: string; user_id?: string; video_url?: string; views?: number; youtube_id?: string | null }; Relationships: [] }
    }
    Views: { [_ in never]: never }
    Functions: { increment_video_views: { Args: { _video_id: string }; Returns: undefined } }
    Enums: { notification_type: "like" | "comment" | "subscribe" | "new_video" }
    CompositeTypes: { [_ in never]: never }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">
type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]
export type Tables<T extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])> = DefaultSchema["Tables"][T] extends { Row: infer R } ? R : never
export type TablesInsert<T extends keyof DefaultSchema["Tables"]> = DefaultSchema["Tables"][T] extends { Insert: infer I } ? I : never
export type TablesUpdate<T extends keyof DefaultSchema["Tables"]> = DefaultSchema["Tables"][T] extends { Update: infer U } ? U : never
export type Enums<T extends keyof DefaultSchema["Enums"]> = DefaultSchema["Enums"][T]
export type CompositeTypes<T extends keyof DefaultSchema["CompositeTypes"]> = DefaultSchema["CompositeTypes"][T]
export const Constants = { public: { Enums: { notification_type: ["like", "comment", "subscribe", "new_video"] } } } as const