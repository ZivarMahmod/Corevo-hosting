export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      audit_log: {
        Row: {
          action: string
          actor_profile_id: string | null
          created_at: string
          entity: string
          entity_id: string | null
          id: string
          meta: Json
          tenant_id: string
        }
        Insert: {
          action: string
          actor_profile_id?: string | null
          created_at?: string
          entity: string
          entity_id?: string | null
          id?: string
          meta?: Json
          tenant_id: string
        }
        Update: {
          action?: string
          actor_profile_id?: string | null
          created_at?: string
          entity?: string
          entity_id?: string | null
          id?: string
          meta?: Json
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "audit_log_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      bookings: {
        Row: {
          created_at: string
          customer_profile_id: string | null
          end_ts: string
          id: string
          location_id: string
          note: string | null
          price_cents: number | null
          service_id: string
          staff_id: string
          start_ts: string
          status: string
          tenant_id: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string
          customer_profile_id?: string | null
          end_ts: string
          id?: string
          location_id: string
          note?: string | null
          price_cents?: number | null
          service_id: string
          staff_id: string
          start_ts: string
          status?: string
          tenant_id: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string
          customer_profile_id?: string | null
          end_ts?: string
          id?: string
          location_id?: string
          note?: string | null
          price_cents?: number | null
          service_id?: string
          staff_id?: string
          start_ts?: string
          status?: string
          tenant_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "bookings_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bookings_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "services"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bookings_staff_id_fkey"
            columns: ["staff_id"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bookings_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      locations: {
        Row: {
          address: string | null
          created_at: string
          id: string
          is_primary: boolean
          name: string
          tenant_id: string
          timezone: string
          updated_at: string | null
        }
        Insert: {
          address?: string | null
          created_at?: string
          id?: string
          is_primary?: boolean
          name: string
          tenant_id: string
          timezone?: string
          updated_at?: string | null
        }
        Update: {
          address?: string | null
          created_at?: string
          id?: string
          is_primary?: boolean
          name?: string
          tenant_id?: string
          timezone?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "locations_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      payments: {
        Row: {
          amount_cents: number
          booking_id: string
          created_at: string
          currency: string
          id: string
          status: string
          stripe_payment_intent_id: string | null
          tenant_id: string
          updated_at: string | null
        }
        Insert: {
          amount_cents: number
          booking_id: string
          created_at?: string
          currency?: string
          id?: string
          status?: string
          stripe_payment_intent_id?: string | null
          tenant_id: string
          updated_at?: string | null
        }
        Update: {
          amount_cents?: number
          booking_id?: string
          created_at?: string
          currency?: string
          id?: string
          status?: string
          stripe_payment_intent_id?: string | null
          tenant_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "payments_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      roles: {
        Row: {
          created_at: string
          id: string
          level: number
          name: string
          tenant_id: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          level: number
          name: string
          tenant_id?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          level?: number
          name?: string
          tenant_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "roles_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      services: {
        Row: {
          active: boolean
          category: string | null
          created_at: string
          description: string | null
          duration_min: number
          id: string
          location_id: string | null
          name: string
          price_cents: number
          tenant_id: string
          updated_at: string | null
        }
        Insert: {
          active?: boolean
          category?: string | null
          created_at?: string
          description?: string | null
          duration_min: number
          id?: string
          location_id?: string | null
          name: string
          price_cents?: number
          tenant_id: string
          updated_at?: string | null
        }
        Update: {
          active?: boolean
          category?: string | null
          created_at?: string
          description?: string | null
          duration_min?: number
          id?: string
          location_id?: string | null
          name?: string
          price_cents?: number
          tenant_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "services_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "services_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      staff: {
        Row: {
          active: boolean
          created_at: string
          id: string
          location_id: string | null
          profile_id: string | null
          tenant_id: string
          title: string | null
          updated_at: string | null
        }
        Insert: {
          active?: boolean
          created_at?: string
          id?: string
          location_id?: string | null
          profile_id?: string | null
          tenant_id: string
          title?: string | null
          updated_at?: string | null
        }
        Update: {
          active?: boolean
          created_at?: string
          id?: string
          location_id?: string | null
          profile_id?: string | null
          tenant_id?: string
          title?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "staff_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "staff_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "staff_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      staff_services: {
        Row: {
          service_id: string
          staff_id: string
          tenant_id: string
        }
        Insert: {
          service_id: string
          staff_id: string
          tenant_id: string
        }
        Update: {
          service_id?: string
          staff_id?: string
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "staff_services_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "services"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "staff_services_staff_id_fkey"
            columns: ["staff_id"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "staff_services_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      tenant_domains: {
        Row: {
          created_at: string
          domain: string
          id: string
          is_primary: boolean
          tenant_id: string
          verified: boolean
        }
        Insert: {
          created_at?: string
          domain: string
          id?: string
          is_primary?: boolean
          tenant_id: string
          verified?: boolean
        }
        Update: {
          created_at?: string
          domain?: string
          id?: string
          is_primary?: boolean
          tenant_id?: string
          verified?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "tenant_domains_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      tenant_settings: {
        Row: {
          branding: Json
          created_at: string
          id: string
          payment_mode: string
          service_fee_type: string
          service_fee_value: number
          settings: Json
          tenant_id: string
          updated_at: string | null
        }
        Insert: {
          branding?: Json
          created_at?: string
          id?: string
          payment_mode?: string
          service_fee_type?: string
          service_fee_value?: number
          settings?: Json
          tenant_id: string
          updated_at?: string | null
        }
        Update: {
          branding?: Json
          created_at?: string
          id?: string
          payment_mode?: string
          service_fee_type?: string
          service_fee_value?: number
          settings?: Json
          tenant_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "tenant_settings_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: true
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      tenants: {
        Row: {
          created_at: string
          id: string
          name: string
          plan: string
          slug: string
          status: string
          stripe_account_id: string | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          plan?: string
          slug: string
          status?: string
          stripe_account_id?: string | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          plan?: string
          slug?: string
          status?: string
          stripe_account_id?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      time_off: {
        Row: {
          created_at: string
          end_ts: string
          id: string
          location_id: string | null
          reason: string | null
          staff_id: string
          start_ts: string
          tenant_id: string
        }
        Insert: {
          created_at?: string
          end_ts: string
          id?: string
          location_id?: string | null
          reason?: string | null
          staff_id: string
          start_ts: string
          tenant_id: string
        }
        Update: {
          created_at?: string
          end_ts?: string
          id?: string
          location_id?: string | null
          reason?: string | null
          staff_id?: string
          start_ts?: string
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "time_off_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "time_off_staff_id_fkey"
            columns: ["staff_id"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "time_off_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      users: {
        Row: {
          created_at: string
          email: string | null
          id: string
          phone: string | null
          role_id: string | null
          status: string
          tenant_id: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string
          email?: string | null
          id: string
          phone?: string | null
          role_id?: string | null
          status?: string
          tenant_id: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string
          email?: string | null
          id?: string
          phone?: string | null
          role_id?: string | null
          status?: string
          tenant_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "users_role_id_fkey"
            columns: ["role_id"]
            isOneToOne: false
            referencedRelation: "roles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "users_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      working_hours: {
        Row: {
          end_time: string
          id: string
          location_id: string | null
          staff_id: string
          start_time: string
          tenant_id: string
          weekday: number
        }
        Insert: {
          end_time: string
          id?: string
          location_id?: string | null
          staff_id: string
          start_time: string
          tenant_id: string
          weekday: number
        }
        Update: {
          end_time?: string
          id?: string
          location_id?: string | null
          staff_id?: string
          start_time?: string
          tenant_id?: string
          weekday?: number
        }
        Relationships: [
          {
            foreignKeyName: "working_hours_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "working_hours_staff_id_fkey"
            columns: ["staff_id"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "working_hours_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      create_public_booking: {
        Args: {
          p_customer?: string
          p_note?: string
          p_service: string
          p_staff: string
          p_start: string
          p_tenant_slug: string
        }
        Returns: string
      }
      custom_access_token_hook: { Args: { event: Json }; Returns: Json }
      get_busy_intervals: {
        Args: {
          p_from: string
          p_staff_ids: string[]
          p_tenant: string
          p_to: string
        }
        Returns: {
          end_ts: string
          staff_id: string
          start_ts: string
        }[]
      }
      get_public_booking: {
        Args: { p_id: string }
        Returns: {
          end_ts: string
          id: string
          location_name: string
          location_timezone: string
          payment_mode: string
          price_cents: number
          service_name: string
          staff_title: string
          start_ts: string
          status: string
          tenant_name: string
          tenant_slug: string
        }[]
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
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
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
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
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
