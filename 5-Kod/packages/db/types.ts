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
      blog_posts: {
        Row: {
          body: string | null
          cover_asset_id: string | null
          created_at: string
          excerpt: string | null
          id: string
          published_at: string | null
          slug: string | null
          sort_order: number
          status: string
          tenant_id: string
          title: string
          updated_at: string | null
        }
        Insert: {
          body?: string | null
          cover_asset_id?: string | null
          created_at?: string
          excerpt?: string | null
          id?: string
          published_at?: string | null
          slug?: string | null
          sort_order?: number
          status?: string
          tenant_id: string
          title: string
          updated_at?: string | null
        }
        Update: {
          body?: string | null
          cover_asset_id?: string | null
          created_at?: string
          excerpt?: string | null
          id?: string
          published_at?: string | null
          slug?: string | null
          sort_order?: number
          status?: string
          tenant_id?: string
          title?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "blog_posts_cover_asset_id_fkey"
            columns: ["cover_asset_id"]
            isOneToOne: false
            referencedRelation: "media_assets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "blog_posts_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      booking_status_history: {
        Row: {
          booking_id: string
          changed_at: string
          changed_by: string | null
          from_status: string | null
          id: string
          rebooked_from: string | null
          rebooked_to: string | null
          source: string
          tenant_id: string
          to_status: string
        }
        Insert: {
          booking_id: string
          changed_at?: string
          changed_by?: string | null
          from_status?: string | null
          id?: string
          rebooked_from?: string | null
          rebooked_to?: string | null
          source?: string
          tenant_id: string
          to_status: string
        }
        Update: {
          booking_id?: string
          changed_at?: string
          changed_by?: string | null
          from_status?: string | null
          id?: string
          rebooked_from?: string | null
          rebooked_to?: string | null
          source?: string
          tenant_id?: string
          to_status?: string
        }
        Relationships: [
          {
            foreignKeyName: "booking_status_history_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
        ]
      }
      bookings: {
        Row: {
          created_at: string
          customer_id: string | null
          customer_profile_id: string | null
          end_ts: string
          id: string
          location_id: string
          note: string | null
          price_cents: number | null
          reminded_at: string | null
          service_id: string
          staff_id: string
          start_ts: string
          status: string
          tenant_id: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string
          customer_id?: string | null
          customer_profile_id?: string | null
          end_ts: string
          id?: string
          location_id: string
          note?: string | null
          price_cents?: number | null
          reminded_at?: string | null
          service_id: string
          staff_id: string
          start_ts: string
          status?: string
          tenant_id: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string
          customer_id?: string | null
          customer_profile_id?: string | null
          end_ts?: string
          id?: string
          location_id?: string
          note?: string | null
          price_cents?: number | null
          reminded_at?: string | null
          service_id?: string
          staff_id?: string
          start_ts?: string
          status?: string
          tenant_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "bookings_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
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
      content_slots: {
        Row: {
          asset_id: string | null
          created_at: string
          id: string
          kind: string
          module_ref: Json | null
          slot_key: string
          template_key: string
          tenant_id: string
          text_value: Json | null
          updated_at: string | null
          updated_by: string | null
        }
        Insert: {
          asset_id?: string | null
          created_at?: string
          id?: string
          kind: string
          module_ref?: Json | null
          slot_key: string
          template_key: string
          tenant_id: string
          text_value?: Json | null
          updated_at?: string | null
          updated_by?: string | null
        }
        Update: {
          asset_id?: string | null
          created_at?: string
          id?: string
          kind?: string
          module_ref?: Json | null
          slot_key?: string
          template_key?: string
          tenant_id?: string
          text_value?: Json | null
          updated_at?: string | null
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "content_slots_asset_id_fkey"
            columns: ["asset_id"]
            isOneToOne: false
            referencedRelation: "media_assets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "content_slots_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "content_slots_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      customer_favorites: {
        Row: {
          created_at: string
          customer_id: string
          id: string
          kind: string
          service_id: string | null
          staff_id: string | null
          tenant_id: string
        }
        Insert: {
          created_at?: string
          customer_id: string
          id?: string
          kind: string
          service_id?: string | null
          staff_id?: string | null
          tenant_id: string
        }
        Update: {
          created_at?: string
          customer_id?: string
          id?: string
          kind?: string
          service_id?: string | null
          staff_id?: string | null
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "customer_favorites_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customer_favorites_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "services"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customer_favorites_staff_id_fkey"
            columns: ["staff_id"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customer_favorites_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      customer_notes: {
        Row: {
          allergies: string[]
          created_at: string
          created_by: string | null
          customer_id: string
          hair_length: string | null
          hair_type: string | null
          id: string
          internal_note: string | null
          preferences: string[]
          products: string[]
          sensitivity: string | null
          tenant_id: string
          updated_at: string | null
        }
        Insert: {
          allergies?: string[]
          created_at?: string
          created_by?: string | null
          customer_id: string
          hair_length?: string | null
          hair_type?: string | null
          id?: string
          internal_note?: string | null
          preferences?: string[]
          products?: string[]
          sensitivity?: string | null
          tenant_id: string
          updated_at?: string | null
        }
        Update: {
          allergies?: string[]
          created_at?: string
          created_by?: string | null
          customer_id?: string
          hair_length?: string | null
          hair_type?: string | null
          id?: string
          internal_note?: string | null
          preferences?: string[]
          products?: string[]
          sensitivity?: string | null
          tenant_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "customer_notes_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customer_notes_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customer_notes_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      customers: {
        Row: {
          auth_user_id: string | null
          contact_hash: string | null
          created_at: string
          display_name: string | null
          email: string | null
          first_seen_at: string
          full_name: string | null
          id: string
          last_seen_at: string
          name_hidden: boolean
          phone: string | null
          status: string
          tenant_id: string
          updated_at: string | null
        }
        Insert: {
          auth_user_id?: string | null
          contact_hash?: string | null
          created_at?: string
          display_name?: string | null
          email?: string | null
          first_seen_at?: string
          full_name?: string | null
          id?: string
          last_seen_at?: string
          name_hidden?: boolean
          phone?: string | null
          status?: string
          tenant_id: string
          updated_at?: string | null
        }
        Update: {
          auth_user_id?: string | null
          contact_hash?: string | null
          created_at?: string
          display_name?: string | null
          email?: string | null
          first_seen_at?: string
          full_name?: string | null
          id?: string
          last_seen_at?: string
          name_hidden?: boolean
          phone?: string | null
          status?: string
          tenant_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "customers_auth_user_id_fkey"
            columns: ["auth_user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customers_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      locations: {
        Row: {
          active: boolean
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
          active?: boolean
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
          active?: boolean
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
      gift_cards: {
        Row: {
          balance_cents: number
          code: string
          created_at: string
          currency: string
          expires_at: string | null
          id: string
          initial_amount_cents: number
          message: string | null
          recipient_email: string | null
          recipient_name: string | null
          status: string
          tenant_id: string
          updated_at: string | null
        }
        Insert: {
          balance_cents?: number
          code: string
          created_at?: string
          currency?: string
          expires_at?: string | null
          id?: string
          initial_amount_cents?: number
          message?: string | null
          recipient_email?: string | null
          recipient_name?: string | null
          status?: string
          tenant_id: string
          updated_at?: string | null
        }
        Update: {
          balance_cents?: number
          code?: string
          created_at?: string
          currency?: string
          expires_at?: string | null
          id?: string
          initial_amount_cents?: number
          message?: string | null
          recipient_email?: string | null
          recipient_name?: string | null
          status?: string
          tenant_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "gift_cards_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      loyalty_ledger: {
        Row: {
          booking_id: string | null
          created_at: string
          customer_id: string
          id: string
          note: string | null
          points_delta: number
          reason: string
          tenant_id: string
        }
        Insert: {
          booking_id?: string | null
          created_at?: string
          customer_id: string
          id?: string
          note?: string | null
          points_delta: number
          reason: string
          tenant_id: string
        }
        Update: {
          booking_id?: string | null
          created_at?: string
          customer_id?: string
          id?: string
          note?: string | null
          points_delta?: number
          reason?: string
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "loyalty_ledger_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "loyalty_ledger_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "loyalty_ledger_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      media_assets: {
        Row: {
          alt: string | null
          content_hash: string | null
          created_at: string
          height: number | null
          id: string
          library_item_id: string | null
          r2_key: string
          size_bytes: number
          source: string
          tenant_id: string
          type: string
          updated_at: string | null
          url: string
          width: number | null
        }
        Insert: {
          alt?: string | null
          content_hash?: string | null
          created_at?: string
          height?: number | null
          id?: string
          library_item_id?: string | null
          r2_key: string
          size_bytes?: number
          source?: string
          tenant_id: string
          type?: string
          updated_at?: string | null
          url: string
          width?: number | null
        }
        Update: {
          alt?: string | null
          content_hash?: string | null
          created_at?: string
          height?: number | null
          id?: string
          library_item_id?: string | null
          r2_key?: string
          size_bytes?: number
          source?: string
          tenant_id?: string
          type?: string
          updated_at?: string | null
          url?: string
          width?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "media_assets_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      modules: {
        Row: {
          created_at: string
          default_config: Json
          default_section_position: string | null
          key: string
          name: string
          owns_tables: Json
          updated_at: string | null
          variant_schema: Json
        }
        Insert: {
          created_at?: string
          default_config?: Json
          default_section_position?: string | null
          key: string
          name: string
          owns_tables?: Json
          updated_at?: string | null
          variant_schema?: Json
        }
        Update: {
          created_at?: string
          default_config?: Json
          default_section_position?: string | null
          key?: string
          name?: string
          owns_tables?: Json
          updated_at?: string | null
          variant_schema?: Json
        }
        Relationships: []
      }
      offert_requests: {
        Row: {
          created_at: string
          currency: string
          customer_email: string | null
          customer_id: string | null
          customer_name: string | null
          customer_phone: string | null
          details: Json
          estimate_cents: number | null
          id: string
          message: string | null
          mode: string
          note: string | null
          payment_status: string
          status: string
          subject: string | null
          tenant_id: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string
          currency?: string
          customer_email?: string | null
          customer_id?: string | null
          customer_name?: string | null
          customer_phone?: string | null
          details?: Json
          estimate_cents?: number | null
          id?: string
          message?: string | null
          mode?: string
          note?: string | null
          payment_status?: string
          status?: string
          subject?: string | null
          tenant_id: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string
          currency?: string
          customer_email?: string | null
          customer_id?: string | null
          customer_name?: string | null
          customer_phone?: string | null
          details?: Json
          estimate_cents?: number | null
          id?: string
          message?: string | null
          mode?: string
          note?: string | null
          payment_status?: string
          status?: string
          subject?: string | null
          tenant_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "offert_requests_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "offert_requests_tenant_id_fkey"
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
          stripe_checkout_session_id: string | null
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
          stripe_checkout_session_id?: string | null
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
          stripe_checkout_session_id?: string | null
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
      role_permissions: {
        Row: {
          area: string
          id: string
          perm: string
          role_name: string
          updated_at: string
        }
        Insert: {
          area: string
          id?: string
          perm: string
          role_name: string
          updated_at?: string
        }
        Update: {
          area?: string
          id?: string
          perm?: string
          role_name?: string
          updated_at?: string
        }
        Relationships: []
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
          buffer_min: number | null
          category: string | null
          created_at: string
          description: string | null
          duration_min: number
          id: string
          location_id: string | null
          name: string
          price_cents: number
          slot_step_min: number | null
          tenant_id: string
          updated_at: string | null
        }
        Insert: {
          active?: boolean
          buffer_min?: number | null
          category?: string | null
          created_at?: string
          description?: string | null
          duration_min: number
          id?: string
          location_id?: string | null
          name: string
          price_cents?: number
          slot_step_min?: number | null
          tenant_id: string
          updated_at?: string | null
        }
        Update: {
          active?: boolean
          buffer_min?: number | null
          category?: string | null
          created_at?: string
          description?: string | null
          duration_min?: number
          id?: string
          location_id?: string | null
          name?: string
          price_cents?: number
          slot_step_min?: number | null
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
      shop_products: {
        Row: {
          active: boolean
          created_at: string
          currency: string
          description: string | null
          id: string
          image_asset_id: string | null
          name: string
          price_cents: number
          slug: string | null
          sort_order: number
          stock: number | null
          tenant_id: string
          updated_at: string | null
        }
        Insert: {
          active?: boolean
          created_at?: string
          currency?: string
          description?: string | null
          id?: string
          image_asset_id?: string | null
          name: string
          price_cents?: number
          slug?: string | null
          sort_order?: number
          stock?: number | null
          tenant_id: string
          updated_at?: string | null
        }
        Update: {
          active?: boolean
          created_at?: string
          currency?: string
          description?: string | null
          id?: string
          image_asset_id?: string | null
          name?: string
          price_cents?: number
          slug?: string | null
          sort_order?: number
          stock?: number | null
          tenant_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "shop_products_image_asset_id_fkey"
            columns: ["image_asset_id"]
            isOneToOne: false
            referencedRelation: "media_assets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shop_products_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      shop_orders: {
        Row: {
          created_at: string
          currency: string
          customer_email: string | null
          customer_id: string | null
          customer_name: string | null
          customer_phone: string | null
          fulfilment: string
          id: string
          note: string | null
          payment_status: string
          pickup_by: string | null
          pickup_location_id: string | null
          ready_at: string | null
          ship_address: string | null
          status: string
          tenant_id: string
          total_cents: number
          updated_at: string | null
        }
        Insert: {
          created_at?: string
          currency?: string
          customer_email?: string | null
          customer_id?: string | null
          customer_name?: string | null
          customer_phone?: string | null
          fulfilment?: string
          id?: string
          note?: string | null
          payment_status?: string
          pickup_by?: string | null
          pickup_location_id?: string | null
          ready_at?: string | null
          ship_address?: string | null
          status?: string
          tenant_id: string
          total_cents?: number
          updated_at?: string | null
        }
        Update: {
          created_at?: string
          currency?: string
          customer_email?: string | null
          customer_id?: string | null
          customer_name?: string | null
          customer_phone?: string | null
          fulfilment?: string
          id?: string
          note?: string | null
          payment_status?: string
          pickup_by?: string | null
          pickup_location_id?: string | null
          ready_at?: string | null
          ship_address?: string | null
          status?: string
          tenant_id?: string
          total_cents?: number
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "shop_orders_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shop_orders_pickup_location_id_fkey"
            columns: ["pickup_location_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shop_orders_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      shop_order_items: {
        Row: {
          created_at: string
          id: string
          order_id: string
          product_id: string | null
          product_name: string
          quantity: number
          tenant_id: string
          unit_price_cents: number
        }
        Insert: {
          created_at?: string
          id?: string
          order_id: string
          product_id?: string | null
          product_name: string
          quantity?: number
          tenant_id: string
          unit_price_cents?: number
        }
        Update: {
          created_at?: string
          id?: string
          order_id?: string
          product_id?: string | null
          product_name?: string
          quantity?: number
          tenant_id?: string
          unit_price_cents?: number
        }
        Relationships: [
          {
            foreignKeyName: "shop_order_items_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "shop_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shop_order_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "shop_products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shop_order_items_tenant_id_fkey"
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
          buffer_min: number | null
          created_at: string
          id: string
          location_id: string | null
          profile_id: string | null
          slot_step_min: number | null
          tenant_id: string
          title: string | null
          updated_at: string | null
        }
        Insert: {
          active?: boolean
          buffer_min?: number | null
          created_at?: string
          id?: string
          location_id?: string | null
          profile_id?: string | null
          slot_step_min?: number | null
          tenant_id: string
          title?: string | null
          updated_at?: string | null
        }
        Update: {
          active?: boolean
          buffer_min?: number | null
          created_at?: string
          id?: string
          location_id?: string | null
          profile_id?: string | null
          slot_step_min?: number | null
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
      template_slots: {
        Row: {
          aspect_hint: string | null
          asset_role: string | null
          default_asset_key: string | null
          default_kind: string | null
          default_text: string | null
          id: string
          kind: string
          label: string
          module_key: string | null
          module_view: string | null
          repeatable: boolean
          section_key: string
          slot_key: string
          sort_order: number
          template_key: string
        }
        Insert: {
          aspect_hint?: string | null
          asset_role?: string | null
          default_asset_key?: string | null
          default_kind?: string | null
          default_text?: string | null
          id?: string
          kind: string
          label: string
          module_key?: string | null
          module_view?: string | null
          repeatable?: boolean
          section_key: string
          slot_key: string
          sort_order?: number
          template_key: string
        }
        Update: {
          aspect_hint?: string | null
          asset_role?: string | null
          default_asset_key?: string | null
          default_kind?: string | null
          default_text?: string | null
          id?: string
          kind?: string
          label?: string
          module_key?: string | null
          module_view?: string | null
          repeatable?: boolean
          section_key?: string
          slot_key?: string
          sort_order?: number
          template_key?: string
        }
        Relationships: [
          {
            foreignKeyName: "template_slots_template_key_fkey"
            columns: ["template_key"]
            isOneToOne: false
            referencedRelation: "templates"
            referencedColumns: ["key"]
          },
        ]
      }
      templates: {
        Row: {
          created_at: string
          key: string
          name: string
          sections: Json
          status: string
          tags: Json
          tokens: Json
          updated_at: string | null
        }
        Insert: {
          created_at?: string
          key: string
          name: string
          sections?: Json
          status?: string
          tags?: Json
          tokens?: Json
          updated_at?: string | null
        }
        Update: {
          created_at?: string
          key?: string
          name?: string
          sections?: Json
          status?: string
          tags?: Json
          tokens?: Json
          updated_at?: string | null
        }
        Relationships: []
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
      site_content_vertical_defaults: {
        Row: {
          created_at: string
          id: string
          region_key: string
          template_key: string
          updated_at: string | null
          value: string
          vertical_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          region_key: string
          template_key: string
          updated_at?: string | null
          value: string
          vertical_id: string
        }
        Update: {
          created_at?: string
          id?: string
          region_key?: string
          template_key?: string
          updated_at?: string | null
          value?: string
          vertical_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "site_content_vertical_defaults_vertical_id_fkey"
            columns: ["vertical_id"]
            isOneToOne: false
            referencedRelation: "verticals"
            referencedColumns: ["key"]
          },
        ]
      }
      tenant_modules: {
        Row: {
          activated_at: string | null
          config: Json
          created_at: string
          id: string
          module_key: string
          state: string
          tenant_id: string
          updated_at: string | null
        }
        Insert: {
          activated_at?: string | null
          config?: Json
          created_at?: string
          id?: string
          module_key: string
          state?: string
          tenant_id: string
          updated_at?: string | null
        }
        Update: {
          activated_at?: string | null
          config?: Json
          created_at?: string
          id?: string
          module_key?: string
          state?: string
          tenant_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "tenant_modules_module_key_fkey"
            columns: ["module_key"]
            isOneToOne: false
            referencedRelation: "modules"
            referencedColumns: ["key"]
          },
          {
            foreignKeyName: "tenant_modules_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      tenant_settings: {
        Row: {
          billing_model: string
          branding: Json
          created_at: string
          flat_monthly_fee_cents: number
          id: string
          payment_mode: string
          payments_enabled: boolean
          per_booking_fee_cents: number
          service_fee_type: string
          service_fee_value: number
          settings: Json
          setup_fee_cents: number
          tenant_id: string
          updated_at: string | null
        }
        Insert: {
          billing_model?: string
          branding?: Json
          created_at?: string
          flat_monthly_fee_cents?: number
          id?: string
          payment_mode?: string
          payments_enabled?: boolean
          per_booking_fee_cents?: number
          service_fee_type?: string
          service_fee_value?: number
          settings?: Json
          setup_fee_cents?: number
          tenant_id: string
          updated_at?: string | null
        }
        Update: {
          billing_model?: string
          branding?: Json
          created_at?: string
          flat_monthly_fee_cents?: number
          id?: string
          payment_mode?: string
          payments_enabled?: boolean
          per_booking_fee_cents?: number
          service_fee_type?: string
          service_fee_value?: number
          settings?: Json
          setup_fee_cents?: number
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
          city: string | null
          created_at: string
          id: string
          name: string
          plan: string
          slug: string
          status: string
          stripe_account_id: string | null
          stripe_charges_enabled: boolean
          stripe_details_submitted: boolean
          stripe_payouts_enabled: boolean
          updated_at: string | null
          vertical_id: string | null
        }
        Insert: {
          city?: string | null
          created_at?: string
          id?: string
          name: string
          plan?: string
          slug: string
          status?: string
          stripe_account_id?: string | null
          stripe_charges_enabled?: boolean
          stripe_details_submitted?: boolean
          stripe_payouts_enabled?: boolean
          updated_at?: string | null
          vertical_id?: string | null
        }
        Update: {
          city?: string | null
          created_at?: string
          id?: string
          name?: string
          plan?: string
          slug?: string
          status?: string
          stripe_account_id?: string | null
          stripe_charges_enabled?: boolean
          stripe_details_submitted?: boolean
          stripe_payouts_enabled?: boolean
          updated_at?: string | null
          vertical_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "tenants_vertical_id_fkey"
            columns: ["vertical_id"]
            isOneToOne: false
            referencedRelation: "verticals"
            referencedColumns: ["key"]
          },
        ]
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
          full_name: string | null
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
          full_name?: string | null
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
          full_name?: string | null
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
      verticals: {
        Row: {
          created_at: string
          default_modules: Json
          default_template: string | null
          key: string
          name: string
          rules: Json
          terminology: Json
          updated_at: string | null
        }
        Insert: {
          created_at?: string
          default_modules?: Json
          default_template?: string | null
          key: string
          name: string
          rules?: Json
          terminology?: Json
          updated_at?: string | null
        }
        Update: {
          created_at?: string
          default_modules?: Json
          default_template?: string | null
          key?: string
          name?: string
          rules?: Json
          terminology?: Json
          updated_at?: string | null
        }
        Relationships: []
      }
      working_hour_slots: {
        Row: {
          active: boolean
          created_at: string
          id: string
          location_id: string | null
          staff_id: string
          start_time: string
          tenant_id: string
          updated_at: string | null
          weekday: number
        }
        Insert: {
          active?: boolean
          created_at?: string
          id?: string
          location_id?: string | null
          staff_id: string
          start_time: string
          tenant_id: string
          updated_at?: string | null
          weekday: number
        }
        Update: {
          active?: boolean
          created_at?: string
          id?: string
          location_id?: string | null
          staff_id?: string
          start_time?: string
          tenant_id?: string
          updated_at?: string | null
          weekday?: number
        }
        Relationships: [
          {
            foreignKeyName: "working_hour_slots_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "working_hour_slots_staff_id_fkey"
            columns: ["staff_id"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "working_hour_slots_tenant_id_fkey"
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
      check_rate_limit: {
        Args: { p_key: string; p_max: number; p_window_secs: number }
        Returns: boolean
      }
      create_public_booking: {
        Args: {
          p_customer?: string
          p_guest_email?: string
          p_guest_name?: string
          p_guest_phone?: string
          p_location?: string
          p_note?: string
          p_service: string
          p_staff: string
          p_start: string
          p_tenant_slug: string
        }
        Returns: string
      }
      custom_access_token_hook: { Args: { event: Json }; Returns: Json }
      customer_contact_hash: {
        Args: { p_email: string; p_phone: string; p_tenant: string }
        Returns: string
      }
      expire_abandoned_pending_bookings: {
        Args: { p_ttl_min?: number }
        Returns: number
      }
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
      get_customer_contact: {
        Args: { p_after_h?: number; p_before_h?: number; p_customer: string }
        Returns: {
          display_name: string
          email: string
          full_name: string
          phone: string
          pii_visible: boolean
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
          payment_status: string
          payments_enabled: boolean
          price_cents: number
          service_name: string
          staff_title: string
          start_ts: string
          status: string
          stripe_charges_enabled: boolean
          tenant_name: string
          tenant_slug: string
        }[]
      }
      resolve_tenant_by_domain: { Args: { p_host: string }; Returns: string }
      seed_explicit_slots_from_hours: {
        Args: { p_staff: string; p_step?: number }
        Returns: number
      }
      set_primary_location: { Args: { p_location: string }; Returns: undefined }
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
