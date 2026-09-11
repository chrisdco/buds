export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  public: {
    Tables: {
      destinations: {
        Row: {
          created_at: string
          created_by: string
          id: string
          label: string
          lat: number
          lng: number
          member_id: string | null
          room_id: string
        }
        Insert: {
          created_at?: string
          created_by: string
          id?: string
          label?: string
          lat: number
          lng: number
          member_id?: string | null
          room_id: string
        }
        Update: {
          created_at?: string
          created_by?: string
          id?: string
          label?: string
          lat?: number
          lng?: number
          member_id?: string | null
          room_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "destinations_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "room_members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "destinations_room_id_fkey"
            columns: ["room_id"]
            isOneToOne: false
            referencedRelation: "rooms"
            referencedColumns: ["id"]
          },
        ]
      }
      room_members: {
        Row: {
          arrived_at: string | null
          display_name: string
          id: string
          joined_at: string
          kicked: boolean
          last_heading: number | null
          last_lat: number | null
          last_lng: number | null
          last_seen_at: string | null
          last_speed: number | null
          left_at: string | null
          role: string
          room_id: string
          sharing: boolean
          user_id: string
        }
        Insert: {
          arrived_at?: string | null
          display_name: string
          id?: string
          joined_at?: string
          kicked?: boolean
          last_heading?: number | null
          last_lat?: number | null
          last_lng?: number | null
          last_seen_at?: string | null
          last_speed?: number | null
          left_at?: string | null
          role?: string
          room_id: string
          sharing?: boolean
          user_id: string
        }
        Update: {
          arrived_at?: string | null
          display_name?: string
          id?: string
          joined_at?: string
          kicked?: boolean
          last_heading?: number | null
          last_lat?: number | null
          last_lng?: number | null
          last_seen_at?: string | null
          last_speed?: number | null
          left_at?: string | null
          role?: string
          room_id?: string
          sharing?: boolean
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "room_members_room_id_fkey"
            columns: ["room_id"]
            isOneToOne: false
            referencedRelation: "rooms"
            referencedColumns: ["id"]
          },
        ]
      }
      rooms: {
        Row: {
          code: string
          created_at: string
          ended_at: string | null
          expires_at: string | null
          host_id: string
          id: string
          leader_id: string | null
          locked: boolean
          mode: string
          name: string
          settings: Json
          status: string
          traveler_limit: number
        }
        Insert: {
          code: string
          created_at?: string
          ended_at?: string | null
          expires_at?: string | null
          host_id: string
          id?: string
          leader_id?: string | null
          locked?: boolean
          mode?: string
          name: string
          settings?: Json
          status?: string
          traveler_limit?: number
        }
        Update: {
          code?: string
          created_at?: string
          ended_at?: string | null
          expires_at?: string | null
          host_id?: string
          id?: string
          leader_id?: string | null
          locked?: boolean
          mode?: string
          name?: string
          settings?: Json
          status?: string
          traveler_limit?: number
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      clear_destination: {
        Args: { p_member_id?: string; p_room_id: string }
        Returns: Json
      }
      create_room: {
        Args: {
          p_display_name: string
          p_expires_at?: string
          p_mode?: string
          p_name: string
          p_settings?: Json
          p_traveler_limit?: number
        }
        Returns: Json
      }
      end_room: { Args: { p_room_id: string }; Returns: Json }
      generate_room_code: { Args: never; Returns: string }
      get_room_snapshot: { Args: { p_room_id: string }; Returns: Json }
      is_room_member: { Args: { p_room_id: string }; Returns: boolean }
      is_room_topic_member: { Args: { p_topic: string }; Returns: boolean }
      join_room: {
        Args: { p_code: string; p_display_name: string; p_role?: string }
        Returns: Json
      }
      kick_member: {
        Args: { p_room_id: string; p_user_id: string }
        Returns: Json
      }
      leave_room: { Args: { p_room_id: string }; Returns: Json }
      lock_room: {
        Args: { p_locked: boolean; p_room_id: string }
        Returns: Json
      }
      mark_arrived: { Args: { p_room_id: string }; Returns: Json }
      set_destination: {
        Args: {
          p_label?: string
          p_lat: number
          p_lng: number
          p_member_id?: string
          p_room_id: string
        }
        Returns: Json
      }
      set_expiry: {
        Args: { p_expires_at?: string; p_room_id: string }
        Returns: Json
      }
      set_leader: {
        Args: { p_room_id: string; p_user_id: string }
        Returns: Json
      }
      set_mode: {
        Args: { p_mode: string; p_room_id: string; p_settings?: Json }
        Returns: Json
      }
      set_sharing: {
        Args: { p_room_id: string; p_sharing: boolean }
        Returns: Json
      }
      update_last_seen: {
        Args: {
          p_heading?: number
          p_lat: number
          p_lng: number
          p_room_id: string
          p_speed?: number
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {},
  },
} as const

