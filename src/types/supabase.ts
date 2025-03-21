export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  public: {
    Tables: {
      activity: {
        Row: {
          access_timestamp: string
          created_at: string | null
          generated_tweets: Json | null
          hashtags: string[] | null
          id: string
          input_text: string | null
          saved_tweets: Json | null
          session_duration: unknown | null
          sign_in_time: string | null
          sign_out_time: string | null
          source_url: string | null
          total_tokens_spent: number | null
          total_tweets_generated: number | null
          tweet_lengths: number[] | null
          tweeted_tweet: string | null
          user_id: string | null
          all_generated_tweets: string | null
          generated_tweets_metrics: Json | null
          hashtags_saved: string[] | null
          hashtags_generated: string[] | null
        }
        Insert: {
          access_timestamp: string
          created_at?: string | null
          generated_tweets?: Json | null
          hashtags?: string[] | null
          id?: string
          input_text?: string | null
          saved_tweets?: Json | null
          session_duration?: unknown | null
          sign_in_time?: string | null
          sign_out_time?: string | null
          source_url?: string | null
          total_tokens_spent?: number | null
          total_tweets_generated?: number | null
          tweet_lengths?: number[] | null
          tweeted_tweet?: string | null
          user_id?: string | null
          all_generated_tweets?: string | null
          generated_tweets_metrics?: Json | null
          hashtags_saved?: string[] | null
          hashtags_generated?: string[] | null
        }
        Update: {
          access_timestamp?: string
          created_at?: string | null
          generated_tweets?: Json | null
          hashtags?: string[] | null
          id?: string
          input_text?: string | null
          saved_tweets?: Json | null
          session_duration?: unknown | null
          sign_in_time?: string | null
          sign_out_time?: string | null
          source_url?: string | null
          total_tokens_spent?: number | null
          total_tweets_generated?: number | null
          tweet_lengths?: number[] | null
          tweeted_tweet?: string | null
          user_id?: string | null
          all_generated_tweets?: string | null
          generated_tweets_metrics?: Json | null
          hashtags_saved?: string[] | null
          hashtags_generated?: string[] | null
        }
        Relationships: []
      }
      tweets: {
        Row: {
          content: string
          created_at: string
          generated_tweets: Json | null
          generated_tweets_metrics: Json | null
          hashtags: string[] | null
          id: string
          input_length: number | null
          input_token_cost: number | null
          saved_tweet_length: number | null
          saved_tweet_token_cost: number | null
          source_url: string | null
          user_id: string | null
          user_input: string | null
          all_generated_tweets: string | null
          tweeted: string | null
        }
        Insert: {
          content: string
          created_at?: string
          generated_tweets?: Json | null
          generated_tweets_metrics?: Json | null
          hashtags?: string[] | null
          id?: string
          input_length?: number | null
          input_token_cost?: number | null
          saved_tweet_length?: number | null
          saved_tweet_token_cost?: number | null
          source_url?: string | null
          user_id?: string | null
          user_input?: string | null
          all_generated_tweets?: string | null
          tweeted?: string | null
        }
        Update: {
          content?: string
          created_at?: string
          generated_tweets?: Json | null
          generated_tweets_metrics?: Json | null
          hashtags?: string[] | null
          id?: string
          input_length?: number | null
          input_token_cost?: number | null
          saved_tweet_length?: number | null
          saved_tweet_token_cost?: number | null
          source_url?: string | null
          user_id?: string | null
          user_input?: string | null
          all_generated_tweets?: string | null
          tweeted?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type PublicSchema = Database[Extract<keyof Database, "public">]

export type Tables<
  PublicTableNameOrOptions extends
    | keyof (PublicSchema["Tables"] & PublicSchema["Views"])
    | { schema: keyof Database },
  TableName extends PublicTableNameOrOptions extends { schema: keyof Database }
    ? keyof (Database[PublicTableNameOrOptions["schema"]]["Tables"] &
        Database[PublicTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = PublicTableNameOrOptions extends { schema: keyof Database }
  ? (Database[PublicTableNameOrOptions["schema"]]["Tables"] &
      Database[PublicTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : PublicTableNameOrOptions extends keyof (PublicSchema["Tables"] &
        PublicSchema["Views"])
    ? (PublicSchema["Tables"] &
        PublicSchema["Views"])[PublicTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  PublicTableNameOrOptions extends
    | keyof PublicSchema["Tables"]
    | { schema: keyof Database },
  TableName extends PublicTableNameOrOptions extends { schema: keyof Database }
    ? keyof Database[PublicTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = PublicTableNameOrOptions extends { schema: keyof Database }
  ? Database[PublicTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : PublicTableNameOrOptions extends keyof PublicSchema["Tables"]
    ? PublicSchema["Tables"][PublicTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  PublicTableNameOrOptions extends
    | keyof PublicSchema["Tables"]
    | { schema: keyof Database },
  TableName extends PublicTableNameOrOptions extends { schema: keyof Database }
    ? keyof Database[PublicTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = PublicTableNameOrOptions extends { schema: keyof Database }
  ? Database[PublicTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : PublicTableNameOrOptions extends keyof PublicSchema["Tables"]
    ? PublicSchema["Tables"][PublicTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  PublicEnumNameOrOptions extends
    | keyof PublicSchema["Enums"]
    | { schema: keyof Database },
  EnumName extends PublicEnumNameOrOptions extends { schema: keyof Database }
    ? keyof Database[PublicEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = PublicEnumNameOrOptions extends { schema: keyof Database }
  ? Database[PublicEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : PublicEnumNameOrOptions extends keyof PublicSchema["Enums"]
    ? PublicSchema["Enums"][PublicEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof PublicSchema["CompositeTypes"]
    | { schema: keyof Database },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof Database[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends { schema: keyof Database }
  ? Database[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof PublicSchema["CompositeTypes"]
    ? PublicSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never
