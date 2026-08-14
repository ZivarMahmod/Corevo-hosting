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
          slug: string
          sort_order: number
          status: string
          tag: string | null
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
          slug: string
          sort_order?: number
          status?: string
          tag?: string | null
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
          slug?: string
          sort_order?: number
          status?: string
          tag?: string | null
          tenant_id?: string
          title?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "blog_posts_asset_tenant_fkey"
            columns: ["cover_asset_id", "tenant_id"]
            isOneToOne: false
            referencedRelation: "media_assets"
            referencedColumns: ["id", "tenant_id"]
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
          cancelled_at: string | null
          cancelled_by: string | null
          created_at: string
          customer_id: string | null
          customer_profile_id: string | null
          end_ts: string
          id: string
          location_id: string
          note: string | null
          price_cents: number | null
          reminded_at: string | null
          reminder_claim_token: string | null
          reminder_claimed_at: string | null
          request_id: string | null
          requires_online_payment: boolean
          service_id: string
          staff_id: string
          start_ts: string
          status: string
          tenant_id: string
          updated_at: string | null
        }
        Insert: {
          cancelled_at?: string | null
          cancelled_by?: string | null
          created_at?: string
          customer_id?: string | null
          customer_profile_id?: string | null
          end_ts: string
          id?: string
          location_id: string
          note?: string | null
          price_cents?: number | null
          reminded_at?: string | null
          reminder_claim_token?: string | null
          reminder_claimed_at?: string | null
          request_id?: string | null
          requires_online_payment?: boolean
          service_id: string
          staff_id: string
          start_ts: string
          status?: string
          tenant_id: string
          updated_at?: string | null
        }
        Update: {
          cancelled_at?: string | null
          cancelled_by?: string | null
          created_at?: string
          customer_id?: string | null
          customer_profile_id?: string | null
          end_ts?: string
          id?: string
          location_id?: string
          note?: string | null
          price_cents?: number | null
          reminded_at?: string | null
          reminder_claim_token?: string | null
          reminder_claimed_at?: string | null
          request_id?: string | null
          requires_online_payment?: boolean
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
      contact_messages: {
        Row: {
          created_at: string
          email: string | null
          id: string
          message: string
          name: string
          phone: string | null
          status: string
          subject: string | null
          tenant_id: string
        }
        Insert: {
          created_at?: string
          email?: string | null
          id?: string
          message: string
          name: string
          phone?: string | null
          status?: string
          subject?: string | null
          tenant_id: string
        }
        Update: {
          created_at?: string
          email?: string | null
          id?: string
          message?: string
          name?: string
          phone?: string | null
          status?: string
          subject?: string | null
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "contact_messages_tenant_id_fkey"
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
            foreignKeyName: "content_slots_asset_tenant_fkey"
            columns: ["asset_id", "tenant_id"]
            isOneToOne: false
            referencedRelation: "media_assets"
            referencedColumns: ["id", "tenant_id"]
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
          location_id: string | null
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
          location_id?: string | null
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
          location_id?: string | null
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
            foreignKeyName: "customer_notes_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "locations"
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
      customer_notification_prefs: {
        Row: {
          created_at: string
          customer_id: string
          email_enabled: boolean
          marketing_consent: boolean
          marketing_consent_at: string | null
          marketing_consent_source: string | null
          preferred_channel: string | null
          push_enabled: boolean
          sms_enabled: boolean
          tenant_id: string
          updated_at: string
          want_offers: boolean
          want_open_slots: boolean
          want_recommendations: boolean
          want_reminders: boolean
        }
        Insert: {
          created_at?: string
          customer_id: string
          email_enabled?: boolean
          marketing_consent?: boolean
          marketing_consent_at?: string | null
          marketing_consent_source?: string | null
          preferred_channel?: string | null
          push_enabled?: boolean
          sms_enabled?: boolean
          tenant_id: string
          updated_at?: string
          want_offers?: boolean
          want_open_slots?: boolean
          want_recommendations?: boolean
          want_reminders?: boolean
        }
        Update: {
          created_at?: string
          customer_id?: string
          email_enabled?: boolean
          marketing_consent?: boolean
          marketing_consent_at?: string | null
          marketing_consent_source?: string | null
          preferred_channel?: string | null
          push_enabled?: boolean
          sms_enabled?: boolean
          tenant_id?: string
          updated_at?: string
          want_offers?: boolean
          want_open_slots?: boolean
          want_recommendations?: boolean
          want_reminders?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "customer_notification_prefs_customer_tenant_fkey"
            columns: ["customer_id", "tenant_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id", "tenant_id"]
          },
          {
            foreignKeyName: "customer_notification_prefs_tenant_id_fkey"
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
          hidden_at: string | null
          id: string
          last_seen_at: string
          name_hidden: boolean
          phone: string | null
          self_book: boolean
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
          hidden_at?: string | null
          id?: string
          last_seen_at?: string
          name_hidden?: boolean
          phone?: string | null
          self_book?: boolean
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
          hidden_at?: string | null
          id?: string
          last_seen_at?: string
          name_hidden?: boolean
          phone?: string | null
          self_book?: boolean
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
      event_registrations: {
        Row: {
          cancellation_reason: string | null
          cancelled_at: string | null
          cancelled_by: string | null
          created_at: string
          email: string | null
          event_id: string
          id: string
          idempotency_key: string
          lifecycle_version: number
          message: string | null
          name: string
          order_item_id: string | null
          party_size: number
          phone: string | null
          status: string
          tenant_id: string
        }
        Insert: {
          cancellation_reason?: string | null
          cancelled_at?: string | null
          cancelled_by?: string | null
          created_at?: string
          email?: string | null
          event_id: string
          id?: string
          idempotency_key?: string
          lifecycle_version?: number
          message?: string | null
          name: string
          order_item_id?: string | null
          party_size?: number
          phone?: string | null
          status?: string
          tenant_id: string
        }
        Update: {
          cancellation_reason?: string | null
          cancelled_at?: string | null
          cancelled_by?: string | null
          created_at?: string
          email?: string | null
          event_id?: string
          id?: string
          idempotency_key?: string
          lifecycle_version?: number
          message?: string | null
          name?: string
          order_item_id?: string | null
          party_size?: number
          phone?: string | null
          status?: string
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "event_registrations_event_tenant_fkey"
            columns: ["event_id", "tenant_id"]
            isOneToOne: false
            referencedRelation: "tenant_events"
            referencedColumns: ["id", "tenant_id"]
          },
          {
            foreignKeyName: "event_registrations_order_item_id_fkey"
            columns: ["order_item_id"]
            isOneToOne: false
            referencedRelation: "shop_order_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_registrations_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      gallery_items: {
        Row: {
          active: boolean
          alt_override: string | null
          aspect_ratio: string | null
          asset_id: string | null
          caption: string | null
          created_at: string
          decorative: boolean
          id: string
          sort_order: number
          tag: string | null
          tenant_id: string
          year_label: string | null
        }
        Insert: {
          active?: boolean
          alt_override?: string | null
          aspect_ratio?: string | null
          asset_id?: string | null
          caption?: string | null
          created_at?: string
          decorative?: boolean
          id?: string
          sort_order?: number
          tag?: string | null
          tenant_id: string
          year_label?: string | null
        }
        Update: {
          active?: boolean
          alt_override?: string | null
          aspect_ratio?: string | null
          asset_id?: string | null
          caption?: string | null
          created_at?: string
          decorative?: boolean
          id?: string
          sort_order?: number
          tag?: string | null
          tenant_id?: string
          year_label?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "gallery_items_asset_tenant_fkey"
            columns: ["asset_id", "tenant_id"]
            isOneToOne: false
            referencedRelation: "media_assets"
            referencedColumns: ["id", "tenant_id"]
          },
          {
            foreignKeyName: "gallery_items_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      gift_card_entries: {
        Row: {
          actor_user_id: string | null
          amount_cents: number
          balance_after_cents: number
          created_at: string
          currency: string
          entry_type: string
          gift_card_id: string
          id: string
          idempotency_key: string | null
          reason: string | null
          request_hash: string | null
          reversal_of: string | null
          source_id: string | null
          source_type: string
          tenant_id: string
        }
        Insert: {
          actor_user_id?: string | null
          amount_cents: number
          balance_after_cents: number
          created_at?: string
          currency: string
          entry_type: string
          gift_card_id: string
          id?: string
          idempotency_key?: string | null
          reason?: string | null
          request_hash?: string | null
          reversal_of?: string | null
          source_id?: string | null
          source_type: string
          tenant_id: string
        }
        Update: {
          actor_user_id?: string | null
          amount_cents?: number
          balance_after_cents?: number
          created_at?: string
          currency?: string
          entry_type?: string
          gift_card_id?: string
          id?: string
          idempotency_key?: string | null
          reason?: string | null
          request_hash?: string | null
          reversal_of?: string | null
          source_id?: string | null
          source_type?: string
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "gift_card_entries_card_tenant_fkey"
            columns: ["gift_card_id", "tenant_id"]
            isOneToOne: false
            referencedRelation: "gift_cards"
            referencedColumns: ["id", "tenant_id"]
          },
          {
            foreignKeyName: "gift_card_entries_reversal_tenant_fkey"
            columns: ["reversal_of", "tenant_id"]
            isOneToOne: false
            referencedRelation: "gift_card_entries"
            referencedColumns: ["id", "tenant_id"]
          },
          {
            foreignKeyName: "gift_card_entries_tenant_id_fkey"
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
          code_hash: string
          code_last_four: string
          code_version: string
          created_at: string
          currency: string
          delivery_mode: string | null
          emailed_at: string | null
          expires_at: string | null
          id: string
          initial_amount_cents: number
          issued_at: string | null
          message: string | null
          order_id: string | null
          order_item_id: string | null
          recipient_email: string | null
          recipient_name: string | null
          status: string
          tenant_id: string
          updated_at: string | null
        }
        Insert: {
          balance_cents?: number
          code: string
          code_hash: string
          code_last_four: string
          code_version: string
          created_at?: string
          currency?: string
          delivery_mode?: string | null
          emailed_at?: string | null
          expires_at?: string | null
          id?: string
          initial_amount_cents?: number
          issued_at?: string | null
          message?: string | null
          order_id?: string | null
          order_item_id?: string | null
          recipient_email?: string | null
          recipient_name?: string | null
          status?: string
          tenant_id: string
          updated_at?: string | null
        }
        Update: {
          balance_cents?: number
          code?: string
          code_hash?: string
          code_last_four?: string
          code_version?: string
          created_at?: string
          currency?: string
          delivery_mode?: string | null
          emailed_at?: string | null
          expires_at?: string | null
          id?: string
          initial_amount_cents?: number
          issued_at?: string | null
          message?: string | null
          order_id?: string | null
          order_item_id?: string | null
          recipient_email?: string | null
          recipient_name?: string | null
          status?: string
          tenant_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "gift_cards_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "shop_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "gift_cards_order_item_id_fkey"
            columns: ["order_item_id"]
            isOneToOne: false
            referencedRelation: "shop_order_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "gift_cards_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      location_closures: {
        Row: {
          created_at: string
          created_by: string | null
          end_ts: string
          id: string
          location_id: string
          reason: string | null
          start_ts: string
          tenant_id: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          end_ts: string
          id?: string
          location_id: string
          reason?: string | null
          start_ts: string
          tenant_id: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          end_ts?: string
          id?: string
          location_id?: string
          reason?: string | null
          start_ts?: string
          tenant_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "location_closures_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "location_closures_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "location_closures_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      location_opening_hours: {
        Row: {
          confirmed_at: string | null
          confirmed_by: string | null
          created_at: string
          end_time: string
          id: string
          location_id: string
          source: string
          start_time: string
          tenant_id: string
          updated_at: string | null
          weekday: number
        }
        Insert: {
          confirmed_at?: string | null
          confirmed_by?: string | null
          created_at?: string
          end_time: string
          id?: string
          location_id: string
          source: string
          start_time: string
          tenant_id: string
          updated_at?: string | null
          weekday: number
        }
        Update: {
          confirmed_at?: string | null
          confirmed_by?: string | null
          created_at?: string
          end_time?: string
          id?: string
          location_id?: string
          source?: string
          start_time?: string
          tenant_id?: string
          updated_at?: string | null
          weekday?: number
        }
        Relationships: [
          {
            foreignKeyName: "location_opening_hours_confirmed_by_fkey"
            columns: ["confirmed_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "location_opening_hours_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "location_opening_hours_tenant_id_fkey"
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
          max_advance_days: number
          min_notice_min: number
          name: string
          slot_step_min: number
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
          max_advance_days?: number
          min_notice_min?: number
          name: string
          slot_step_min?: number
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
          max_advance_days?: number
          min_notice_min?: number
          name?: string
          slot_step_min?: number
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
      loyalty_ledger: {
        Row: {
          actor_user_id: string | null
          balance_after_points: number | null
          booking_id: string | null
          created_at: string
          customer_id: string
          id: string
          idempotency_key: string | null
          note: string | null
          points_delta: number
          reason: string
          request_hash: string | null
          reversal_of: string | null
          source_id: string | null
          source_type: string | null
          tenant_id: string
        }
        Insert: {
          actor_user_id?: string | null
          balance_after_points?: number | null
          booking_id?: string | null
          created_at?: string
          customer_id: string
          id?: string
          idempotency_key?: string | null
          note?: string | null
          points_delta: number
          reason: string
          request_hash?: string | null
          reversal_of?: string | null
          source_id?: string | null
          source_type?: string | null
          tenant_id: string
        }
        Update: {
          actor_user_id?: string | null
          balance_after_points?: number | null
          booking_id?: string | null
          created_at?: string
          customer_id?: string
          id?: string
          idempotency_key?: string | null
          note?: string | null
          points_delta?: number
          reason?: string
          request_hash?: string | null
          reversal_of?: string | null
          source_id?: string | null
          source_type?: string | null
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
            foreignKeyName: "loyalty_ledger_reversal_tenant_fkey"
            columns: ["reversal_of", "tenant_id"]
            isOneToOne: false
            referencedRelation: "loyalty_ledger"
            referencedColumns: ["id", "tenant_id"]
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
      loyalty_members: {
        Row: {
          customer_id: string
          id: string
          joined_at: string
          plan_id: string | null
          source: string
          status: string
          tenant_id: string
        }
        Insert: {
          customer_id: string
          id?: string
          joined_at?: string
          plan_id?: string | null
          source?: string
          status?: string
          tenant_id: string
        }
        Update: {
          customer_id?: string
          id?: string
          joined_at?: string
          plan_id?: string | null
          source?: string
          status?: string
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "loyalty_members_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "loyalty_members_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "loyalty_plans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "loyalty_members_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      loyalty_plans: {
        Row: {
          active: boolean
          created_at: string
          featured: boolean
          id: string
          interval: string
          name: string
          perks: Json
          price_cents: number
          sort_order: number
          tenant_id: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          featured?: boolean
          id?: string
          interval?: string
          name: string
          perks?: Json
          price_cents?: number
          sort_order?: number
          tenant_id: string
        }
        Update: {
          active?: boolean
          created_at?: string
          featured?: boolean
          id?: string
          interval?: string
          name?: string
          perks?: Json
          price_cents?: number
          sort_order?: number
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "loyalty_plans_tenant_id_fkey"
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
          deleted_at: string | null
          height: number | null
          id: string
          last_error: string | null
          library_item_id: string | null
          lifecycle_version: number
          published: boolean
          r2_key: string
          reserved_at: string
          size_bytes: number
          source: string
          status: string
          tenant_id: string
          type: string
          updated_at: string | null
          url: string | null
          variants: Json
          width: number | null
        }
        Insert: {
          alt?: string | null
          content_hash?: string | null
          created_at?: string
          deleted_at?: string | null
          height?: number | null
          id?: string
          last_error?: string | null
          library_item_id?: string | null
          lifecycle_version?: number
          published?: boolean
          r2_key: string
          reserved_at?: string
          size_bytes?: number
          source?: string
          status?: string
          tenant_id: string
          type?: string
          updated_at?: string | null
          url?: string | null
          variants?: Json
          width?: number | null
        }
        Update: {
          alt?: string | null
          content_hash?: string | null
          created_at?: string
          deleted_at?: string | null
          height?: number | null
          id?: string
          last_error?: string | null
          library_item_id?: string | null
          lifecycle_version?: number
          published?: boolean
          r2_key?: string
          reserved_at?: string
          size_bytes?: number
          source?: string
          status?: string
          tenant_id?: string
          type?: string
          updated_at?: string | null
          url?: string | null
          variants?: Json
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
      notifications_outbox: {
        Row: {
          attempt_count: number
          available_at: string
          booking_id: string | null
          category: string
          chosen_channel: string | null
          consent_state: Json | null
          cost_currency: string | null
          cost_ore: number | null
          created_at: string
          customer_id: string | null
          delivered_at: string | null
          event_key: string
          event_type: string
          fallback_channel: string | null
          id: string
          last_error: string | null
          lease_expires_at: string | null
          lease_token: string | null
          max_attempts: number
          partner_id: string | null
          parts: number | null
          payload: Json
          provider_ref: string | null
          sent_at: string | null
          skip_reason: string | null
          staff_id: string | null
          status: string
          tenant_id: string
          updated_at: string
        }
        Insert: {
          attempt_count?: number
          available_at?: string
          booking_id?: string | null
          category: string
          chosen_channel?: string | null
          consent_state?: Json | null
          cost_currency?: string | null
          cost_ore?: number | null
          created_at?: string
          customer_id?: string | null
          delivered_at?: string | null
          event_key?: string
          event_type: string
          fallback_channel?: string | null
          id?: string
          last_error?: string | null
          lease_expires_at?: string | null
          lease_token?: string | null
          max_attempts?: number
          partner_id?: string | null
          parts?: number | null
          payload?: Json
          provider_ref?: string | null
          sent_at?: string | null
          skip_reason?: string | null
          staff_id?: string | null
          status?: string
          tenant_id: string
          updated_at?: string
        }
        Update: {
          attempt_count?: number
          available_at?: string
          booking_id?: string | null
          category?: string
          chosen_channel?: string | null
          consent_state?: Json | null
          cost_currency?: string | null
          cost_ore?: number | null
          created_at?: string
          customer_id?: string | null
          delivered_at?: string | null
          event_key?: string
          event_type?: string
          fallback_channel?: string | null
          id?: string
          last_error?: string | null
          lease_expires_at?: string | null
          lease_token?: string | null
          max_attempts?: number
          partner_id?: string | null
          parts?: number | null
          payload?: Json
          provider_ref?: string | null
          sent_at?: string | null
          skip_reason?: string | null
          staff_id?: string | null
          status?: string
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_outbox_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_outbox_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_outbox_partner_id_fkey"
            columns: ["partner_id"]
            isOneToOne: false
            referencedRelation: "partners"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_outbox_staff_id_fkey"
            columns: ["staff_id"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_outbox_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
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
          lifecycle_version: number
          message: string | null
          mode: string
          note: string | null
          payment_status: string
          reply_content_hash: string | null
          reply_delivery_state: string
          reply_error_code: string | null
          reply_outbox_id: string | null
          reply_pending_message: string | null
          reply_requested_by: string | null
          reply_requested_version: number | null
          replied_at: string | null
          reply_message: string | null
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
          lifecycle_version?: number
          message?: string | null
          mode?: string
          note?: string | null
          payment_status?: string
          reply_content_hash?: string | null
          reply_delivery_state?: string
          reply_error_code?: string | null
          reply_outbox_id?: string | null
          reply_pending_message?: string | null
          reply_requested_by?: string | null
          reply_requested_version?: number | null
          replied_at?: string | null
          reply_message?: string | null
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
          lifecycle_version?: number
          message?: string | null
          mode?: string
          note?: string | null
          payment_status?: string
          reply_content_hash?: string | null
          reply_delivery_state?: string
          reply_error_code?: string | null
          reply_outbox_id?: string | null
          reply_pending_message?: string | null
          reply_requested_by?: string | null
          reply_requested_version?: number | null
          replied_at?: string | null
          reply_message?: string | null
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
      partner_license_months: {
        Row: {
          closed_at: string | null
          created_at: string
          month: string
          partner_id: string
          qualified_at: string
          tenant_id: string
          unit_price_ore: number
          updated_at: string
        }
        Insert: {
          closed_at?: string | null
          created_at?: string
          month: string
          partner_id: string
          qualified_at: string
          tenant_id: string
          unit_price_ore: number
          updated_at?: string
        }
        Update: {
          closed_at?: string | null
          created_at?: string
          month?: string
          partner_id?: string
          qualified_at?: string
          tenant_id?: string
          unit_price_ore?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "partner_license_months_partner_id_fkey"
            columns: ["partner_id"]
            isOneToOne: false
            referencedRelation: "partners"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "partner_license_months_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      partner_license_price_events: {
        Row: {
          actor_user_id: string | null
          created_at: string
          effective_at: string
          id: string
          new_price_ore: number
          old_price_ore: number | null
          partner_id: string
        }
        Insert: {
          actor_user_id?: string | null
          created_at?: string
          effective_at?: string
          id?: string
          new_price_ore: number
          old_price_ore?: number | null
          partner_id: string
        }
        Update: {
          actor_user_id?: string | null
          created_at?: string
          effective_at?: string
          id?: string
          new_price_ore?: number
          old_price_ore?: number | null
          partner_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "partner_license_price_events_partner_id_fkey"
            columns: ["partner_id"]
            isOneToOne: false
            referencedRelation: "partners"
            referencedColumns: ["id"]
          },
        ]
      }
      partner_members: {
        Row: {
          created_at: string
          invited_at: string
          joined_at: string | null
          partner_id: string
          role: string
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          invited_at?: string
          joined_at?: string | null
          partner_id: string
          role?: string
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          invited_at?: string
          joined_at?: string | null
          partner_id?: string
          role?: string
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "partner_members_partner_id_fkey"
            columns: ["partner_id"]
            isOneToOne: false
            referencedRelation: "partners"
            referencedColumns: ["id"]
          },
        ]
      }
      partner_sms_configs: {
        Row: {
          callback_secret_id: string | null
          configured_at: string | null
          created_at: string
          enabled: boolean
          partner_id: string
          password_secret_id: string | null
          provider_key: string
          sender: string | null
          updated_at: string
          username_secret_id: string | null
        }
        Insert: {
          callback_secret_id?: string | null
          configured_at?: string | null
          created_at?: string
          enabled?: boolean
          partner_id: string
          password_secret_id?: string | null
          provider_key?: string
          sender?: string | null
          updated_at?: string
          username_secret_id?: string | null
        }
        Update: {
          callback_secret_id?: string | null
          configured_at?: string | null
          created_at?: string
          enabled?: boolean
          partner_id?: string
          password_secret_id?: string | null
          provider_key?: string
          sender?: string | null
          updated_at?: string
          username_secret_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "partner_sms_configs_partner_id_fkey"
            columns: ["partner_id"]
            isOneToOne: true
            referencedRelation: "partners"
            referencedColumns: ["id"]
          },
        ]
      }
      partner_tenant_events: {
        Row: {
          actor_user_id: string | null
          created_at: string
          event_type: string
          id: string
          occurred_at: string
          partner_id: string
          tenant_id: string
          tenant_status: string
        }
        Insert: {
          actor_user_id?: string | null
          created_at?: string
          event_type: string
          id?: string
          occurred_at?: string
          partner_id: string
          tenant_id: string
          tenant_status: string
        }
        Update: {
          actor_user_id?: string | null
          created_at?: string
          event_type?: string
          id?: string
          occurred_at?: string
          partner_id?: string
          tenant_id?: string
          tenant_status?: string
        }
        Relationships: [
          {
            foreignKeyName: "partner_tenant_events_partner_id_fkey"
            columns: ["partner_id"]
            isOneToOne: false
            referencedRelation: "partners"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "partner_tenant_events_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      partners: {
        Row: {
          country_code: string
          created_at: string
          currency: string
          id: string
          license_price_ore: number
          name: string
          slug: string
          status: string
          timezone: string
          updated_at: string
        }
        Insert: {
          country_code: string
          created_at?: string
          currency: string
          id?: string
          license_price_ore: number
          name: string
          slug: string
          status?: string
          timezone?: string
          updated_at?: string
        }
        Update: {
          country_code?: string
          created_at?: string
          currency?: string
          id?: string
          license_price_ore?: number
          name?: string
          slug?: string
          status?: string
          timezone?: string
          updated_at?: string
        }
        Relationships: []
      }
      payment_disputes: {
        Row: {
          amount_cents: number | null
          created_at: string
          currency: string
          dispute_status: string | null
          id: string
          payment_id: string | null
          reason: string | null
          stripe_charge_id: string | null
          stripe_dispute_id: string
          tenant_id: string
          updated_at: string | null
        }
        Insert: {
          amount_cents?: number | null
          created_at?: string
          currency?: string
          dispute_status?: string | null
          id?: string
          payment_id?: string | null
          reason?: string | null
          stripe_charge_id?: string | null
          stripe_dispute_id: string
          tenant_id: string
          updated_at?: string | null
        }
        Update: {
          amount_cents?: number | null
          created_at?: string
          currency?: string
          dispute_status?: string | null
          id?: string
          payment_id?: string | null
          reason?: string | null
          stripe_charge_id?: string | null
          stripe_dispute_id?: string
          tenant_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "payment_disputes_payment_id_fkey"
            columns: ["payment_id"]
            isOneToOne: false
            referencedRelation: "payments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_disputes_tenant_id_fkey"
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
          booking_id: string | null
          created_at: string
          currency: string
          id: string
          order_id: string | null
          status: string
          stripe_checkout_session_id: string | null
          stripe_connected_account_id: string | null
          stripe_payment_intent_id: string | null
          tenant_id: string
          updated_at: string | null
        }
        Insert: {
          amount_cents: number
          booking_id?: string | null
          created_at?: string
          currency?: string
          id?: string
          order_id?: string | null
          status?: string
          stripe_checkout_session_id?: string | null
          stripe_connected_account_id?: string | null
          stripe_payment_intent_id?: string | null
          tenant_id: string
          updated_at?: string | null
        }
        Update: {
          amount_cents?: number
          booking_id?: string | null
          created_at?: string
          currency?: string
          id?: string
          order_id?: string | null
          status?: string
          stripe_checkout_session_id?: string | null
          stripe_connected_account_id?: string | null
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
            foreignKeyName: "payments_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "shop_orders"
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
      push_subscriptions: {
        Row: {
          auth: string
          created_at: string
          customer_id: string
          endpoint: string
          id: string
          last_seen_at: string
          p256dh: string
          revoked_at: string | null
          tenant_id: string
          user_agent: string | null
        }
        Insert: {
          auth: string
          created_at?: string
          customer_id: string
          endpoint: string
          id?: string
          last_seen_at?: string
          p256dh: string
          revoked_at?: string | null
          tenant_id: string
          user_agent?: string | null
        }
        Update: {
          auth?: string
          created_at?: string
          customer_id?: string
          endpoint?: string
          id?: string
          last_seen_at?: string
          p256dh?: string
          revoked_at?: string | null
          tenant_id?: string
          user_agent?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "push_subscriptions_customer_tenant_fkey"
            columns: ["customer_id", "tenant_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id", "tenant_id"]
          },
          {
            foreignKeyName: "push_subscriptions_tenant_id_fkey"
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
          badge: string | null
          buffer_min: number | null
          category: string | null
          created_at: string
          description: string | null
          duration_min: number
          id: string
          image_url: string | null
          location_id: string | null
          name: string
          price_cents: number
          sale_price_cents: number | null
          slot_step_min: number | null
          sort_order: number
          tenant_id: string
          updated_at: string | null
        }
        Insert: {
          active?: boolean
          badge?: string | null
          buffer_min?: number | null
          category?: string | null
          created_at?: string
          description?: string | null
          duration_min: number
          id?: string
          image_url?: string | null
          location_id?: string | null
          name: string
          price_cents?: number
          sale_price_cents?: number | null
          slot_step_min?: number | null
          sort_order?: number
          tenant_id: string
          updated_at?: string | null
        }
        Update: {
          active?: boolean
          badge?: string | null
          buffer_min?: number | null
          category?: string | null
          created_at?: string
          description?: string | null
          duration_min?: number
          id?: string
          image_url?: string | null
          location_id?: string | null
          name?: string
          price_cents?: number
          sale_price_cents?: number | null
          slot_step_min?: number | null
          sort_order?: number
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
      shop_order_counters: {
        Row: {
          next_no: number
          tenant_id: string
        }
        Insert: {
          next_no?: number
          tenant_id: string
        }
        Update: {
          next_no?: number
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "shop_order_counters_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: true
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      shop_order_items: {
        Row: {
          created_at: string
          event_id: string | null
          event_registration_id: string | null
          gift_card_id: string | null
          gift_delivery_mode: string | null
          gift_message: string | null
          gift_recipient_email: string | null
          gift_recipient_name: string | null
          id: string
          item_type: string
          order_id: string
          product_id: string | null
          product_name: string
          quantity: number
          tax_cents: number
          tax_rate: number
          tenant_id: string
          unit_price_cents: number
          variant_id: string | null
        }
        Insert: {
          created_at?: string
          event_id?: string | null
          event_registration_id?: string | null
          gift_card_id?: string | null
          gift_delivery_mode?: string | null
          gift_message?: string | null
          gift_recipient_email?: string | null
          gift_recipient_name?: string | null
          id?: string
          item_type?: string
          order_id: string
          product_id?: string | null
          product_name: string
          quantity?: number
          tax_cents?: number
          tax_rate?: number
          tenant_id: string
          unit_price_cents?: number
          variant_id?: string | null
        }
        Update: {
          created_at?: string
          event_id?: string | null
          event_registration_id?: string | null
          gift_card_id?: string | null
          gift_delivery_mode?: string | null
          gift_message?: string | null
          gift_recipient_email?: string | null
          gift_recipient_name?: string | null
          id?: string
          item_type?: string
          order_id?: string
          product_id?: string | null
          product_name?: string
          quantity?: number
          tax_cents?: number
          tax_rate?: number
          tenant_id?: string
          unit_price_cents?: number
          variant_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "shop_order_items_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "tenant_events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shop_order_items_event_registration_id_fkey"
            columns: ["event_registration_id"]
            isOneToOne: false
            referencedRelation: "event_registrations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shop_order_items_gift_card_id_fkey"
            columns: ["gift_card_id"]
            isOneToOne: false
            referencedRelation: "gift_cards"
            referencedColumns: ["id"]
          },
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
          {
            foreignKeyName: "shop_order_items_variant_id_fkey"
            columns: ["variant_id"]
            isOneToOne: false
            referencedRelation: "shop_product_variants"
            referencedColumns: ["id"]
          },
        ]
      }
      shop_orders: {
        Row: {
          carrier: string | null
          created_at: string
          currency: string
          customer_email: string | null
          customer_id: string | null
          customer_name: string | null
          customer_phone: string | null
          discount_cents: number
          expires_at: string | null
          fulfilment: string
          id: string
          note: string | null
          order_no: string | null
          payment_method: string | null
          payment_status: string
          pickup_by: string | null
          pickup_location_id: string | null
          ready_at: string | null
          session_token: string | null
          ship_address: string | null
          shipped_at: string | null
          shipping_cents: number
          shipping_option_id: string | null
          status: string
          stock_committed: boolean
          subtotal_cents: number
          tax_cents: number
          tenant_id: string
          total_cents: number
          tracking_number: string | null
          updated_at: string | null
        }
        Insert: {
          carrier?: string | null
          created_at?: string
          currency?: string
          customer_email?: string | null
          customer_id?: string | null
          customer_name?: string | null
          customer_phone?: string | null
          discount_cents?: number
          expires_at?: string | null
          fulfilment?: string
          id?: string
          note?: string | null
          order_no?: string | null
          payment_method?: string | null
          payment_status?: string
          pickup_by?: string | null
          pickup_location_id?: string | null
          ready_at?: string | null
          session_token?: string | null
          ship_address?: string | null
          shipped_at?: string | null
          shipping_cents?: number
          shipping_option_id?: string | null
          status?: string
          stock_committed?: boolean
          subtotal_cents?: number
          tax_cents?: number
          tenant_id: string
          total_cents?: number
          tracking_number?: string | null
          updated_at?: string | null
        }
        Update: {
          carrier?: string | null
          created_at?: string
          currency?: string
          customer_email?: string | null
          customer_id?: string | null
          customer_name?: string | null
          customer_phone?: string | null
          discount_cents?: number
          expires_at?: string | null
          fulfilment?: string
          id?: string
          note?: string | null
          order_no?: string | null
          payment_method?: string | null
          payment_status?: string
          pickup_by?: string | null
          pickup_location_id?: string | null
          ready_at?: string | null
          session_token?: string | null
          ship_address?: string | null
          shipped_at?: string | null
          shipping_cents?: number
          shipping_option_id?: string | null
          status?: string
          stock_committed?: boolean
          subtotal_cents?: number
          tax_cents?: number
          tenant_id?: string
          total_cents?: number
          tracking_number?: string | null
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
            foreignKeyName: "shop_orders_shipping_option_id_fkey"
            columns: ["shipping_option_id"]
            isOneToOne: false
            referencedRelation: "shop_shipping_options"
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
      shop_product_variants: {
        Row: {
          active: boolean
          created_at: string
          currency: string
          id: string
          image_asset_id: string | null
          name: string
          price_cents: number
          product_id: string
          reserved_qty: number
          sku: string | null
          sort_order: number
          stock: number | null
          tenant_id: string
          updated_at: string | null
        }
        Insert: {
          active?: boolean
          created_at?: string
          currency?: string
          id?: string
          image_asset_id?: string | null
          name?: string
          price_cents?: number
          product_id: string
          reserved_qty?: number
          sku?: string | null
          sort_order?: number
          stock?: number | null
          tenant_id: string
          updated_at?: string | null
        }
        Update: {
          active?: boolean
          created_at?: string
          currency?: string
          id?: string
          image_asset_id?: string | null
          name?: string
          price_cents?: number
          product_id?: string
          reserved_qty?: number
          sku?: string | null
          sort_order?: number
          stock?: number | null
          tenant_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "shop_product_variants_asset_tenant_fkey"
            columns: ["image_asset_id", "tenant_id"]
            isOneToOne: false
            referencedRelation: "media_assets"
            referencedColumns: ["id", "tenant_id"]
          },
          {
            foreignKeyName: "shop_product_variants_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "shop_products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shop_product_variants_tenant_id_fkey"
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
          badge: string | null
          category: string | null
          compare_at_price_cents: number | null
          created_at: string
          currency: string
          description: string | null
          id: string
          image_asset_id: string | null
          name: string
          price_cents: number
          price_from: boolean
          slug: string | null
          sort_order: number
          stock: number | null
          tenant_id: string
          updated_at: string | null
        }
        Insert: {
          active?: boolean
          badge?: string | null
          category?: string | null
          compare_at_price_cents?: number | null
          created_at?: string
          currency?: string
          description?: string | null
          id?: string
          image_asset_id?: string | null
          name: string
          price_cents?: number
          price_from?: boolean
          slug?: string | null
          sort_order?: number
          stock?: number | null
          tenant_id: string
          updated_at?: string | null
        }
        Update: {
          active?: boolean
          badge?: string | null
          category?: string | null
          compare_at_price_cents?: number | null
          created_at?: string
          currency?: string
          description?: string | null
          id?: string
          image_asset_id?: string | null
          name?: string
          price_cents?: number
          price_from?: boolean
          slug?: string | null
          sort_order?: number
          stock?: number | null
          tenant_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "shop_products_asset_tenant_fkey"
            columns: ["image_asset_id", "tenant_id"]
            isOneToOne: false
            referencedRelation: "media_assets"
            referencedColumns: ["id", "tenant_id"]
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
      shop_shipping_options: {
        Row: {
          active: boolean
          cost_cents: number
          created_at: string
          description: string | null
          id: string
          key: string
          name: string
          sort_order: number
          tenant_id: string
          updated_at: string | null
        }
        Insert: {
          active?: boolean
          cost_cents?: number
          created_at?: string
          description?: string | null
          id?: string
          key: string
          name: string
          sort_order?: number
          tenant_id: string
          updated_at?: string | null
        }
        Update: {
          active?: boolean
          cost_cents?: number
          created_at?: string
          description?: string | null
          id?: string
          key?: string
          name?: string
          sort_order?: number
          tenant_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "shop_shipping_options_tenant_id_fkey"
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
      site_revisions: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          lock_version: number
          published_at: string | null
          published_by: string | null
          snapshot: Json
          source_revision_id: string | null
          status: string
          tenant_id: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          lock_version?: number
          published_at?: string | null
          published_by?: string | null
          snapshot: Json
          source_revision_id?: string | null
          status?: string
          tenant_id: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          lock_version?: number
          published_at?: string | null
          published_by?: string | null
          snapshot?: Json
          source_revision_id?: string | null
          status?: string
          tenant_id?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "site_revisions_source_revision_id_fkey"
            columns: ["source_revision_id"]
            isOneToOne: false
            referencedRelation: "site_revisions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "site_revisions_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      slot_holds: {
        Row: {
          created_at: string
          end_ts: string
          expires_at: string
          id: string
          service_id: string | null
          session_token: string
          staff_id: string
          start_ts: string
          tenant_id: string
        }
        Insert: {
          created_at?: string
          end_ts: string
          expires_at: string
          id?: string
          service_id?: string | null
          session_token: string
          staff_id: string
          start_ts: string
          tenant_id: string
        }
        Update: {
          created_at?: string
          end_ts?: string
          expires_at?: string
          id?: string
          service_id?: string | null
          session_token?: string
          staff_id?: string
          start_ts?: string
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "slot_holds_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "services"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "slot_holds_staff_id_fkey"
            columns: ["staff_id"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "slot_holds_tenant_id_fkey"
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
          avatar_url: string | null
          bio: string | null
          buffer_min: number | null
          color: string | null
          created_at: string
          id: string
          location_id: string | null
          profile_id: string | null
          short_name: string | null
          show_on_site: boolean
          slot_step_min: number | null
          specialties: string | null
          tenant_id: string
          title: string | null
          updated_at: string | null
        }
        Insert: {
          active?: boolean
          avatar_url?: string | null
          bio?: string | null
          buffer_min?: number | null
          color?: string | null
          created_at?: string
          id?: string
          location_id?: string | null
          profile_id?: string | null
          short_name?: string | null
          show_on_site?: boolean
          slot_step_min?: number | null
          specialties?: string | null
          tenant_id: string
          title?: string | null
          updated_at?: string | null
        }
        Update: {
          active?: boolean
          avatar_url?: string | null
          bio?: string | null
          buffer_min?: number | null
          color?: string | null
          created_at?: string
          id?: string
          location_id?: string | null
          profile_id?: string | null
          short_name?: string | null
          show_on_site?: boolean
          slot_step_min?: number | null
          specialties?: string | null
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
      template_required_modules: {
        Row: {
          module_key: string
          template_key: string
        }
        Insert: {
          module_key: string
          template_key: string
        }
        Update: {
          module_key?: string
          template_key?: string
        }
        Relationships: [
          {
            foreignKeyName: "template_required_modules_module_key_fkey"
            columns: ["module_key"]
            isOneToOne: false
            referencedRelation: "modules"
            referencedColumns: ["key"]
          },
          {
            foreignKeyName: "template_required_modules_template_key_fkey"
            columns: ["template_key"]
            isOneToOne: false
            referencedRelation: "templates"
            referencedColumns: ["key"]
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
            foreignKeyName: "template_slots_module_key_fkey"
            columns: ["module_key"]
            isOneToOne: false
            referencedRelation: "modules"
            referencedColumns: ["key"]
          },
          {
            foreignKeyName: "template_slots_template_key_fkey"
            columns: ["template_key"]
            isOneToOne: false
            referencedRelation: "templates"
            referencedColumns: ["key"]
          },
        ]
      }
      template_verticals: {
        Row: {
          template_key: string
          vertical_key: string
        }
        Insert: {
          template_key: string
          vertical_key: string
        }
        Update: {
          template_key?: string
          vertical_key?: string
        }
        Relationships: [
          {
            foreignKeyName: "template_verticals_template_key_fkey"
            columns: ["template_key"]
            isOneToOne: false
            referencedRelation: "templates"
            referencedColumns: ["key"]
          },
          {
            foreignKeyName: "template_verticals_vertical_key_fkey"
            columns: ["vertical_key"]
            isOneToOne: false
            referencedRelation: "verticals"
            referencedColumns: ["key"]
          },
        ]
      }
      templates: {
        Row: {
          contract_version: number
          created_at: string
          key: string
          name: string
          owner: string
          replacement_key: string | null
          sections: Json
          selectable: boolean
          status: string
          tags: Json
          tokens: Json
          updated_at: string | null
        }
        Insert: {
          contract_version?: number
          created_at?: string
          key: string
          name: string
          owner?: string
          replacement_key?: string | null
          sections?: Json
          selectable?: boolean
          status?: string
          tags?: Json
          tokens?: Json
          updated_at?: string | null
        }
        Update: {
          contract_version?: number
          created_at?: string
          key?: string
          name?: string
          owner?: string
          replacement_key?: string | null
          sections?: Json
          selectable?: boolean
          status?: string
          tags?: Json
          tokens?: Json
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "templates_replacement_key_fkey"
            columns: ["replacement_key"]
            isOneToOne: false
            referencedRelation: "templates"
            referencedColumns: ["key"]
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
      tenant_events: {
        Row: {
          cancellation_reason: string | null
          cancelled_at: string | null
          cancelled_by: string | null
          capacity: number
          created_at: string
          description: string | null
          duration_min: number
          id: string
          lifecycle_version: number
          price_cents: number
          reserved_qty: number
          starts_at: string
          status: string
          tenant_id: string
          title: string
          updated_at: string | null
        }
        Insert: {
          cancellation_reason?: string | null
          cancelled_at?: string | null
          cancelled_by?: string | null
          capacity: number
          created_at?: string
          description?: string | null
          duration_min?: number
          id?: string
          lifecycle_version?: number
          price_cents?: number
          reserved_qty?: number
          starts_at: string
          status?: string
          tenant_id: string
          title: string
          updated_at?: string | null
        }
        Update: {
          cancellation_reason?: string | null
          cancelled_at?: string | null
          cancelled_by?: string | null
          capacity?: number
          created_at?: string
          description?: string | null
          duration_min?: number
          id?: string
          lifecycle_version?: number
          price_cents?: number
          reserved_qty?: number
          starts_at?: string
          status?: string
          tenant_id?: string
          title?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "tenant_events_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      tenant_member_permissions: {
        Row: {
          can_edit_site: boolean
          can_manage_customers: boolean
          can_view_all_calendars: boolean
          can_view_daily_metrics: boolean
          id: string
          notify_booking_changes: boolean
          notify_daily_reminder: boolean
          notify_new_booking: boolean
          operational_role: string
          staff_id: string
          tenant_id: string
          updated_at: string
        }
        Insert: {
          can_edit_site?: boolean
          can_manage_customers?: boolean
          can_view_all_calendars?: boolean
          can_view_daily_metrics?: boolean
          id?: string
          notify_booking_changes?: boolean
          notify_daily_reminder?: boolean
          notify_new_booking?: boolean
          operational_role?: string
          staff_id: string
          tenant_id: string
          updated_at?: string
        }
        Update: {
          can_edit_site?: boolean
          can_manage_customers?: boolean
          can_view_all_calendars?: boolean
          can_view_daily_metrics?: boolean
          id?: string
          notify_booking_changes?: boolean
          notify_daily_reminder?: boolean
          notify_new_booking?: boolean
          operational_role?: string
          staff_id?: string
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "tenant_member_permissions_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tenant_member_permissions_tenant_id_staff_id_fkey"
            columns: ["tenant_id", "staff_id"]
            isOneToOne: true
            referencedRelation: "staff"
            referencedColumns: ["tenant_id", "id"]
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
          country_code: string
          created_at: string
          currency: string
          default_timezone: string
          flat_monthly_fee_cents: number
          id: string
          locale: string
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
          country_code?: string
          created_at?: string
          currency?: string
          default_timezone?: string
          flat_monthly_fee_cents?: number
          id?: string
          locale?: string
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
          country_code?: string
          created_at?: string
          currency?: string
          default_timezone?: string
          flat_monthly_fee_cents?: number
          id?: string
          locale?: string
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
          partner_id: string | null
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
          partner_id?: string | null
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
          partner_id?: string | null
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
            foreignKeyName: "tenants_partner_id_fkey"
            columns: ["partner_id"]
            isOneToOne: false
            referencedRelation: "partners"
            referencedColumns: ["id"]
          },
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
          kind: string
          location_id: string | null
          reason: string | null
          series_id: string | null
          staff_id: string
          start_ts: string
          tenant_id: string
        }
        Insert: {
          created_at?: string
          end_ts: string
          id?: string
          kind?: string
          location_id?: string | null
          reason?: string | null
          series_id?: string | null
          staff_id: string
          start_ts: string
          tenant_id: string
        }
        Update: {
          created_at?: string
          end_ts?: string
          id?: string
          kind?: string
          location_id?: string | null
          reason?: string | null
          series_id?: string | null
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
      user_location_access: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          location_id: string
          tenant_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          location_id: string
          tenant_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          location_id?: string
          tenant_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_location_access_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_location_access_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_location_access_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_location_access_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      users: {
        Row: {
          access_scope: string
          created_at: string
          email: string | null
          full_name: string | null
          id: string
          phone: string | null
          primary_location_id: string | null
          role_id: string | null
          status: string
          tenant_id: string | null
          updated_at: string | null
        }
        Insert: {
          access_scope?: string
          created_at?: string
          email?: string | null
          full_name?: string | null
          id: string
          phone?: string | null
          primary_location_id?: string | null
          role_id?: string | null
          status?: string
          tenant_id?: string | null
          updated_at?: string | null
        }
        Update: {
          access_scope?: string
          created_at?: string
          email?: string | null
          full_name?: string | null
          id?: string
          phone?: string | null
          primary_location_id?: string | null
          role_id?: string | null
          status?: string
          tenant_id?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "users_primary_location_id_fkey"
            columns: ["primary_location_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["id"]
          },
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
          default_copy: Json
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
          default_copy?: Json
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
          default_copy?: Json
          default_modules?: Json
          default_template?: string | null
          key?: string
          name?: string
          rules?: Json
          terminology?: Json
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "verticals_default_template_fkey"
            columns: ["default_template"]
            isOneToOne: false
            referencedRelation: "templates"
            referencedColumns: ["key"]
          },
        ]
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
      _commit_shop_order_stock: {
        Args: { p_order_id: string }
        Returns: undefined
      }
      _generate_gift_code: {
        Args: { p_prefix?: string; p_tenant: string }
        Returns: string
      }
      ack_customer_erasure_auth_cleanup: {
        Args: {
          p_auth_user: string
          p_claim_token: string
          p_cleanup_id: string
        }
        Returns: boolean
      }
      ack_notification_outbox: {
        Args: {
          p_cost_currency?: string | null
          p_cost_ore: number | null
          p_id: string
          p_lease_token: string
          p_parts?: number | null
          p_provider_ref: string | null
          p_skip_reason: string | null
          p_status: string
        }
        Returns: boolean
      }
      admin_customer_rows: {
        Args: { p_customer?: string; p_tenant: string }
        Returns: {
          display_name: string
          first_seen_at: string
          full_name: string
          hidden_at: string
          id: string
          last_seen_at: string
          last_visit_ts: string
          loyalty_points: number
          name_hidden: boolean
          status: string
          visits: number
        }[]
      }
      admin_loyalty_members: {
        Args: { p_tenant: string }
        Returns: {
          customer_id: string
          last_activity_at: string | null
          points_balance: number
          rewarded_visits: number
        }[]
      }
      adjust_gift_card: {
        Args: {
          p_delta_cents: number
          p_gift_card: string
          p_idempotency_key: string
          p_reason: string
          p_tenant: string
        }
        Returns: Json
      }
      archive_corevo_job: { Args: { p_msg_id: number }; Returns: boolean }
      atomic_erase_self_customer_account: {
        Args: { p_auth_user: string; p_tenant: string }
        Returns: {
          auth_user_id: string
          erased_bookings: number
          status: string
        }[]
      }
      atomic_erase_tenant_customer: {
        Args: { p_actor: string; p_customer: string; p_tenant: string }
        Returns: {
          auth_user_id: string
          erased_bookings: number
          status: string
        }[]
      }
      begin_notification_delivery: {
        Args: { p_id: string; p_lease_token: string }
        Returns: boolean
      }
      begin_payment_refund_delivery: {
        Args: { p_id: string; p_lease_token: string }
        Returns: boolean
      }
      booking_payment_event_matches: {
        Args: {
          p_booking: string
          p_connected_account: string
          p_payment_intent: string
          p_tenant: string
        }
        Returns: boolean
      }
      cancel_booking_verification: {
        Args: {
          p_challenge: string
          p_session_token: string
          p_tenant_slug: string
        }
        Returns: boolean
      }
      cancel_verified_customer_booking: {
        Args: {
          p_booking: string
          p_customer: string | null
          p_customer_profile: string | null
          p_tenant: string
        }
        Returns: {
          booking_status: string
          outcome: string
          refund_job_id: string | null
        }[]
      }
      cancel_media_upload: {
        Args: {
          p_asset: string
          p_cleanup_required: boolean
          p_error: string
          p_tenant: string
        }
        Returns: {
          asset_id: string
          outcome: string
          status: string
        }[]
      }
      check_rate_limit: {
        Args: { p_key: string; p_max: number; p_window_secs: number }
        Returns: boolean
      }
      claim_customer_account: {
        Args: { p_purpose: string; p_tenant: string; p_token_hash: string }
        Returns: {
          customer_id: string
          merged: boolean
          status: string
        }[]
      }
      claim_customer_erasure_auth_cleanup: {
        Args: {
          p_auth_user: string
          p_claim_token: string
          p_lease_seconds?: number
        }
        Returns: {
          auth_user_id: string
          cleanup_id: string
          customer_id: string
          erase_status: string
          erased_bookings: number
          tenant_id: string
        }[]
      }
      claim_due_booking_reminders: {
        Args: {
          p_claim: string
          p_horizon: string
          p_limit?: number
          p_now: string
        }
        Returns: string[]
      }
      claim_media_cleanup_jobs: {
        Args: { p_lease_seconds: number; p_limit: number }
        Returns: {
          asset_id: string
          attempt: number
          job_id: string
          lease_token: string
          r2_keys: string[]
          tenant_id: string
        }[]
      }
      claim_notification_outbox: {
        Args: {
          p_lease_seconds: number
          p_lease_token: string
          p_limit: number
          p_now: string
        }
        Returns: {
          attempt_count: number
          available_at: string
          booking_id: string | null
          category: string
          chosen_channel: string | null
          consent_state: Json | null
          cost_currency: string | null
          cost_ore: number | null
          created_at: string
          customer_id: string | null
          delivered_at: string | null
          event_key: string
          event_type: string
          fallback_channel: string | null
          id: string
          last_error: string | null
          lease_expires_at: string | null
          lease_token: string | null
          max_attempts: number
          partner_id: string | null
          parts: number | null
          payload: Json
          provider_ref: string | null
          sent_at: string | null
          skip_reason: string | null
          staff_id: string | null
          status: string
          tenant_id: string
          updated_at: string
        }[]
        SetofOptions: {
          from: "*"
          to: "notifications_outbox"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      claim_notification_outbox_by_id: {
        Args: {
          p_id: string
          p_lease_seconds: number
          p_lease_token: string
          p_now: string
        }
        Returns: {
          attempt_count: number
          available_at: string
          booking_id: string | null
          category: string
          chosen_channel: string | null
          consent_state: Json | null
          cost_currency: string | null
          cost_ore: number | null
          created_at: string
          customer_id: string | null
          delivered_at: string | null
          event_key: string
          event_type: string
          fallback_channel: string | null
          id: string
          last_error: string | null
          lease_expires_at: string | null
          lease_token: string | null
          max_attempts: number
          partner_id: string | null
          parts: number | null
          payload: Json
          provider_ref: string | null
          sent_at: string | null
          skip_reason: string | null
          staff_id: string | null
          status: string
          tenant_id: string
          updated_at: string
        }[]
        SetofOptions: {
          from: "*"
          to: "notifications_outbox"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      claim_payment_refund_job_by_id: {
        Args: {
          p_id: string
          p_lease_seconds: number
          p_lease_token: string
          p_now: string
        }
        Returns: {
          attempt_count: number
          booking_id: string
          connected_account_id: string
          id: string
          lease_token: string
          payment_id: string
          payment_intent_id: string
          provider_idempotency_key: string
          tenant_id: string
        }[]
      }
      claim_payment_refund_jobs: {
        Args: {
          p_lease_seconds: number
          p_lease_token: string
          p_limit: number
          p_now: string
        }
        Returns: {
          attempt_count: number
          booking_id: string
          connected_account_id: string
          id: string
          lease_token: string
          payment_id: string
          payment_intent_id: string
          provider_idempotency_key: string
          tenant_id: string
        }[]
      }
      claim_sms_notification_outbox: {
        Args: {
          p_lease_seconds: number
          p_lease_token: string
          p_limit: number
          p_now: string
        }
        Returns: {
          attempt_count: number
          available_at: string
          booking_id: string | null
          category: string
          chosen_channel: string | null
          consent_state: Json | null
          cost_currency: string | null
          cost_ore: number | null
          created_at: string
          customer_id: string | null
          delivered_at: string | null
          event_key: string
          event_type: string
          fallback_channel: string | null
          id: string
          last_error: string | null
          lease_expires_at: string | null
          lease_token: string | null
          max_attempts: number
          partner_id: string | null
          parts: number | null
          payload: Json
          provider_ref: string | null
          sent_at: string | null
          skip_reason: string | null
          staff_id: string | null
          status: string
          tenant_id: string
          updated_at: string
        }[]
        SetofOptions: {
          from: "*"
          to: "notifications_outbox"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      compensate_customer_booking_rebook: {
        Args: {
          p_customer: string | null
          p_customer_profile: string
          p_new_booking: string
          p_old_booking: string
          p_tenant: string
        }
        Returns: Json
      }
      complete_media_cleanup_job: {
        Args: { p_job: string; p_lease_token: string }
        Returns: boolean
      }
      complete_payment_refund_job: {
        Args: { p_id: string; p_lease_token: string; p_provider_ref: string }
        Returns: boolean
      }
      confirm_booking_payment: {
        Args: {
          p_booking: string
          p_connected_account: string
          p_payment_intent: string
          p_tenant: string
        }
        Returns: Json
      }
      confirm_shop_order: {
        Args: {
          p_customer?: string
          p_guest_email?: string
          p_guest_name?: string
          p_guest_phone?: string
          p_note?: string
          p_order_id: string
          p_payment_method?: string
          p_pickup_location?: string
          p_ship_address?: string
          p_shipping_option?: string
          p_token: string
        }
        Returns: {
          order_id: string
          requires_payment: boolean
        }[]
      }
      confirm_shop_order_payment: {
        Args: {
          p_connected_account: string
          p_order: string
          p_payment_intent: string
          p_tenant: string
        }
        Returns: Json
      }
      complete_shop_payment_event: {
        Args: {
          p_error_code?: string
          p_event: string
          p_outcome: string
        }
        Returns: Json
      }
      contain_staff_invite_profile: {
        Args: { p_auth_user: string; p_role: string; p_tenant: string }
        Returns: string
      }
      create_admin_booking: {
        Args: {
          p_customer_id?: string
          p_guest_email?: string
          p_guest_name?: string
          p_guest_phone?: string
          p_location?: string
          p_note?: string
          p_request_id: string
          p_service: string
          p_staff: string
          p_start: string
        }
        Returns: Json
      }
      create_admin_time_off: {
        Args: {
          p_end: string
          p_kind: string
          p_location: string
          p_reason?: string
          p_series_id?: string
          p_staff: string
          p_start: string
        }
        Returns: string
      }
      create_admin_time_off_series: {
        Args: {
          p_kind: string
          p_location: string
          p_occurrences: Json
          p_reason?: string
          p_series_id?: string
          p_staff: string
        }
        Returns: string[]
      }
      create_customer_account_claim: {
        Args: {
          p_customer: string
          p_expires_at: string
          p_purpose: string
          p_tenant: string
          p_token_hash: string
        }
        Returns: string
      }
      create_my_time_off: {
        Args: {
          p_end: string
          p_location: string
          p_reason?: string
          p_staff: string
          p_start: string
        }
        Returns: string
      }
      create_onsite_event_registration: {
        Args: {
          p_email: string
          p_event: string
          p_idempotency_key: string
          p_message: string
          p_name: string
          p_party_size: number
          p_phone: string
          p_tenant: string
        }
        Returns: Json
      }
      create_public_booking: {
        Args: {
          p_customer?: string
          p_guest_email?: string
          p_guest_name?: string
          p_guest_phone?: string
          p_location?: string
          p_note?: string
          p_request_id?: string
          p_service: string
          p_staff: string
          p_start: string
          p_tenant_slug: string
        }
        Returns: string
      }
      create_staff_walk_in: {
        Args: {
          p_location: string
          p_name?: string
          p_service: string
          p_staff: string
          p_start: string
        }
        Returns: string
      }
      create_staff_with_defaults: {
        Args: { p_location?: string; p_profile?: string; p_title: string }
        Returns: string
      }
      create_storefront_booking: {
        Args: {
          p_guest_email?: string
          p_guest_name?: string
          p_guest_phone?: string
          p_location?: string
          p_note?: string
          p_request_id?: string
          p_service: string
          p_staff: string
          p_start: string
          p_tenant_slug: string
        }
        Returns: string
      }
      create_storefront_booking_with_release: {
        Args: {
          p_guest_email?: string
          p_guest_name?: string
          p_guest_phone?: string
          p_location?: string
          p_note?: string
          p_online_payment_released?: boolean
          p_request_id?: string
          p_service: string
          p_staff: string
          p_start: string
          p_tenant_slug: string
        }
        Returns: {
          booking_id: string
          booking_status: string
          requires_payment: boolean
        }[]
      }
      custom_access_token_hook: { Args: { event: Json }; Returns: Json }
      customer_contact_hash: {
        Args: { p_email: string; p_phone: string; p_tenant: string }
        Returns: string
      }
      customer_loyalty_totals: {
        Args: { p_customer: string; p_tenant: string }
        Returns: {
          balance: number
          entry_count: number
          lifetime: number
        }[]
      }
      customer_portal_cancel_booking: {
        Args: {
          p_booking_public_id: string
          p_expected_cutoff_hours: number
          p_idempotency_key: string
          p_secret_digest: string
          p_session_public_id: string
        }
        Returns: {
          booking_status: string
          outcome: string
          refund_job_id: string | null
        }[]
      }
      customer_portal_contact_change_context: {
        Args: {
          p_flow_public_id: string
          p_flow_subject_digest: string
          p_secret_digest: string
          p_session_public_id: string
        }
        Returns: {
          action: string
          outcome: string
        }[]
      }
      customer_portal_create_challenge: {
        Args: {
          p_channel: string
          p_code_digest: string
          p_contact_digest: string
          p_customer: string
          p_expires_at: string
          p_key_version: number
          p_public_id: string
          p_purpose: string
          p_subject_digest: string
          p_tenant: string
        }
        Returns: {
          challenge_public_id: string
          outcome: string
          should_deliver: boolean
        }[]
      }
      customer_portal_exchange_link: {
        Args: {
          p_existing_session_digest?: string
          p_existing_session_public_id?: string
          p_key_version: number
          p_link_public_id: string
          p_new_session_digest: string
          p_new_session_public_id: string
          p_token_digest: string
        }
        Returns: {
          booking_id: string | null
          outcome: string
          session_public_id: string | null
          tenant_slug: string | null
        }[]
      }
      customer_portal_finalize_contact_change: {
        Args: {
          p_code_digest: string
          p_current_contact_digest: string
          p_current_destination: string
          p_flow_public_id: string
          p_flow_subject_digest: string
          p_key_version: number
          p_new_session_digest: string
          p_new_session_public_id: string
          p_secret_digest: string
          p_session_public_id: string
        }
        Returns: {
          action: string
          attempts_remaining: number
          outcome: string
        }[]
      }
      customer_portal_gdpr_scrub: {
        Args: { p_customer: string; p_tenant: string }
        Returns: number
      }
      customer_portal_get_booking: {
        Args: {
          p_booking_public_id: string
          p_secret_digest: string
          p_session_public_id: string
        }
        Returns: Json
      }
      customer_portal_list_bookings: {
        Args: {
          p_cursor_id?: string
          p_cursor_start?: string
          p_page_size?: number
          p_scope?: string
          p_secret_digest: string
          p_session_public_id: string
        }
        Returns: Json
      }
      customer_portal_mint_link: {
        Args: {
          p_customer: string
          p_delivery_intent_id?: string
          p_expires_at: string
          p_key_version: number
          p_purpose: string
          p_tenant: string
          p_token_digest: string
        }
        Returns: {
          expires_at: string
          link_public_id: string
        }[]
      }
      customer_portal_prepare_contact_change_destination: {
        Args: {
          p_code_digest: string
          p_current_contact_digest: string
          p_current_destination: string
          p_expires_at: string
          p_flow_public_id: string
          p_flow_subject_digest: string
          p_key_version: number
          p_new_booking_contact_digest: string
          p_new_channel: string
          p_new_contact_digest: string
          p_new_contact_masked: string
          p_new_destination: string
          p_secret_digest: string
          p_session_public_id: string
        }
        Returns: {
          channel: string
          delivery_destination: string
          expires_at: string
          masked_destination: string
          outcome: string
          tenant_name: string
        }[]
      }
      customer_portal_prepare_recovery_delivery: {
        Args: {
          p_code_digest: string
          p_current_booking_contact_digest: string
          p_current_contact_digest: string
          p_current_destination: string
          p_lease_token: string
          p_outbox_id: string
        }
        Returns: string
      }
      customer_portal_prepare_recovery_resend: {
        Args: { p_challenge_public_id: string; p_subject_digest: string }
        Returns: {
          booking_contact_digest: string
          channel: string
          contact_digest: string
          delivery_destination: string
          outcome: string
          tenant_name: string
          tenant_slug: string
        }[]
      }
      customer_portal_profile_snapshot: {
        Args: { p_secret_digest: string; p_session_public_id: string }
        Returns: {
          outcome: string
          profile: Json
          recovery_tenant_slug: string
        }[]
      }
      customer_portal_record_challenge_delivery: {
        Args: {
          p_challenge_public_id: string
          p_delivered: boolean
          p_subject_digest: string
        }
        Returns: string
      }
      customer_portal_record_contact_change_delivery: {
        Args: {
          p_code_digest: string
          p_delivered: boolean
          p_flow_public_id: string
          p_flow_subject_digest: string
          p_secret_digest: string
          p_session_public_id: string
          p_stage: string
        }
        Returns: string
      }
      customer_portal_record_recovery_delivery: {
        Args: {
          p_booking_contact_digest: string
          p_challenge_public_id: string
          p_delivered: boolean
          p_subject_digest: string
        }
        Returns: string
      }
      customer_portal_record_recovery_outbox_delivery: {
        Args: {
          p_delivered: boolean
          p_lease_token: string
          p_outbox_id: string
        }
        Returns: string
      }
      customer_portal_recovery_delivery_target: {
        Args: { p_lease_token: string; p_outbox_id: string }
        Returns: {
          booking_contact_digest: string
          challenge_public_id: string
          channel: string
          contact_digest: string
          delivery_destination: string
          expires_at: string
          outcome: string
          tenant_name: string
        }[]
      }
      customer_portal_recovery_outbox_candidates: {
        Args: { p_limit: number; p_now: string }
        Returns: {
          id: string
        }[]
      }
      customer_portal_recovery_state: {
        Args: { p_challenge_public_id: string; p_subject_digest: string }
        Returns: {
          attempts_remaining: number
          outcome: string
          resend_after: string
          tenant_slug: string
        }[]
      }
      customer_portal_resend_contact_change: {
        Args: {
          p_code_digest: string
          p_current_contact_digest: string
          p_current_destination: string
          p_expires_at: string
          p_flow_public_id: string
          p_flow_subject_digest: string
          p_secret_digest: string
          p_session_public_id: string
          p_stage: string
        }
        Returns: {
          channel: string
          delivery_destination: string
          expires_at: string
          masked_destination: string
          outcome: string
          retry_after_seconds: number
          tenant_name: string
        }[]
      }
      customer_portal_resend_recovery: {
        Args: {
          p_challenge_public_id: string
          p_expires_at: string
          p_key_version: number
          p_new_code_digest: string
          p_new_public_id: string
          p_new_subject_digest: string
          p_subject_digest: string
        }
        Returns: {
          challenge_public_id: string
          created: boolean
          outbox_id: string
          outcome: string
        }[]
      }
      customer_portal_revoke_booking_trusts: {
        Args: {
          p_secret_digest: string
          p_session_public_id: string
          p_trust_public_id?: string
        }
        Returns: number
      }
      customer_portal_revoke_other_sessions: {
        Args: { p_secret_digest: string; p_session_public_id: string }
        Returns: number
      }
      customer_portal_revoke_session: {
        Args: { p_secret_digest: string; p_session_public_id: string }
        Returns: string
      }
      customer_portal_security_snapshot: {
        Args: { p_secret_digest: string; p_session_public_id: string }
        Returns: {
          outcome: string
          recovery_tenant_slug: string
          security: Json
        }[]
      }
      customer_portal_session_snapshot: {
        Args: {
          p_rotated_key_version?: number
          p_rotated_secret_digest?: string
          p_secret_digest: string
          p_session_public_id: string
        }
        Returns: {
          outcome: string
          recovery_tenant_slug: string
          snapshot: Json
        }[]
      }
      customer_portal_start_contact_change: {
        Args: {
          p_action: string
          p_code_digest: string
          p_current_contact_digest: string
          p_current_contact_masked: string
          p_current_destination: string
          p_expires_at: string
          p_flow_public_id: string
          p_flow_subject_digest: string
          p_key_version: number
          p_secret_digest: string
          p_session_public_id: string
        }
        Returns: {
          channel: string
          delivery_destination: string
          expires_at: string
          flow_public_id: string
          masked_destination: string
          outcome: string
          tenant_name: string
        }[]
      }
      customer_portal_start_recovery: {
        Args: {
          p_booking_contact_digest: string
          p_code_digest: string
          p_contact_digest: string
          p_expires_at: string
          p_key_version: number
          p_lookup: string
          p_public_id: string
          p_subject_digest: string
          p_tenant_slug: string
        }
        Returns: {
          challenge_public_id: string
          created: boolean
          outbox_id: string
          outcome: string
        }[]
      }
      customer_portal_update_name: {
        Args: {
          p_display_name: string
          p_secret_digest: string
          p_session_public_id: string
        }
        Returns: string
      }
      customer_portal_verify_challenge: {
        Args: {
          p_challenge_public_id: string
          p_code_digest: string
          p_subject_digest: string
        }
        Returns: {
          attempts_remaining: number
          customer_id: string
          outcome: string
        }[]
      }
      customer_portal_verify_contact_change_current: {
        Args: {
          p_code_digest: string
          p_flow_public_id: string
          p_flow_subject_digest: string
          p_secret_digest: string
          p_session_public_id: string
        }
        Returns: {
          attempts_remaining: number
          outcome: string
        }[]
      }
      customer_portal_verify_recovery_and_mint_session: {
        Args: {
          p_challenge_public_id: string
          p_code_digest: string
          p_key_version: number
          p_new_session_digest: string
          p_new_session_public_id: string
          p_subject_digest: string
        }
        Returns: {
          attempts_remaining: number
          outcome: string
          tenant_slug: string
        }[]
      }
      delete_admin_time_off: {
        Args: { p_delete_series?: boolean; p_time_off: string }
        Returns: number
      }
      delete_my_time_off: { Args: { p_time_off: string }; Returns: boolean }
      delete_offert_request: {
        Args: {
          p_expected_version: number
          p_request: string
          p_tenant: string
        }
        Returns: {
          outcome: string
          version: number
        }[]
      }
      discard_site_draft: {
        Args: { p_expected_lock_version: number; p_tenant: string }
        Returns: string
      }
      enqueue_corevo_job: { Args: { p_job: Json }; Returns: number }
      enqueue_offert_reply: {
        Args: {
          p_expected_version: number
          p_reply: string
          p_request: string
          p_tenant: string
        }
        Returns: {
          delivery_state: string
          outbox_id: string
          outcome: string
          version: number
        }[]
      }
      enqueue_notification: {
        Args: {
          p_booking: string | null
          p_category: string
          p_channel: string
          p_consent_state: Json | null
          p_customer: string | null
          p_event_key: string
          p_event_type: string
          p_fallback_channel: string | null
          p_max_attempts: number
          p_payload: Json | null
          p_staff: string | null
          p_tenant: string
        }
        Returns: {
          id: string
          inserted: boolean
        }[]
      }
      event_seats_left: { Args: { p_event: string }; Returns: number }
      expire_abandoned_pending_bookings: {
        Args: { p_ttl_min?: number }
        Returns: number
      }
      fail_corevo_job_for_review: {
        Args: { p_msg_id: number; p_reason: string }
        Returns: boolean
      }
      fail_customer_erasure_auth_cleanup: {
        Args: {
          p_auth_user: string
          p_claim_token: string
          p_cleanup_id: string
          p_error_code: string
        }
        Returns: boolean
      }
      finalize_customer_booking_rebook: {
        Args: {
          p_customer: string | null
          p_customer_profile: string
          p_new_booking: string
          p_old_booking: string
          p_tenant: string
        }
        Returns: Json
      }
      finalize_offert_reply: {
        Args: {
          p_outbox: string
          p_request: string
          p_tenant: string
        }
        Returns: {
          delivery_state: string
          error_code: string
          offert_status: string
          outcome: string
          version: number
        }[]
      }
      finalize_media_upload: {
        Args: {
          p_asset: string
          p_published: boolean
          p_tenant: string
          p_url: string
          p_variants: Json
        }
        Returns: {
          asset_id: string
          outcome: string
          status: string
          url: string
          variants: Json
        }[]
      }
      finalize_verified_storefront_booking: {
        Args: {
          p_challenge: string
          p_contact_digest: string
          p_guest_email?: string
          p_guest_name?: string
          p_guest_phone?: string
          p_location?: string
          p_note?: string
          p_online_payment_released?: boolean
          p_pin_digest: string
          p_request_id?: string
          p_service: string
          p_session_token: string
          p_staff: string
          p_start: string
          p_tenant_slug: string
        }
        Returns: {
          attempts_remaining: number
          booking_id: string
          booking_status: string
          outbox_id: string
          outcome: string
          requires_payment: boolean
        }[]
      }
      get_admin_time_off_impacts: {
        Args: { p_time_off: string }
        Returns: {
          booking_id: string
          customer_email: string
          customer_name: string
          customer_phone: string
          end_ts: string
          handled: boolean
          resolution: string
          service_name: string
          start_ts: string
          status: string
        }[]
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
      get_public_bookable_starts: {
        Args: {
          p_location: string
          p_service: string
          p_staff_ids: string[]
          p_starts: string[]
          p_tenant: string
        }
        Returns: {
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
      get_public_shop_order: {
        Args: { p_id: string; p_token: string }
        Returns: Json
      }
      get_public_tenant_module_states: {
        Args: { p_tenant: string }
        Returns: {
          module_key: string
          state: string
        }[]
      }
      get_scheduler_health: {
        Args: {
          p_max_age_seconds?: number
          p_now: string
          p_scheduler_name: string
        }
        Returns: Json
      }
      inspect_customer_account_claim: {
        Args: { p_purpose: string; p_tenant: string; p_token_hash: string }
        Returns: boolean
      }
      gift_card_reconciliation: {
        Args: { p_tenant: string }
        Returns: {
          cached_balance_cents: number
          card_count: number
          currency: string
          ledger_balance_cents: number
          mismatch_count: number
          pending_outbox: number
        }[]
      }
      issue_gift_card: {
        Args: {
          p_amount_cents: number
          p_code_hash: string
          p_code_last_four: string
          p_currency: string
          p_expires_at: string | null
          p_idempotency_key: string
          p_message: string | null
          p_recipient_email: string | null
          p_recipient_name: string | null
          p_tenant: string
        }
        Returns: Json
      }
      join_loyalty_club: {
        Args: {
          p_email: string
          p_name?: string
          p_plan?: string
          p_tenant_slug: string
        }
        Returns: Json
      }
      loyalty_reconciliation: {
        Args: { p_tenant: string }
        Returns: {
          command_metadata_gap_count: number
          customer_count: number
          duplicate_reversal_count: number
          missing_completion_earn_count: number
          negative_customer_count: number
          pending_outbox: number
          total_balance_points: number
        }[]
      }
      mark_admin_time_off_booking_handled: {
        Args: {
          p_booking: string
          p_note?: string
          p_resolution: string
          p_time_off: string
        }
        Returns: undefined
      }
      mark_shop_order_paid: { Args: { p_order_id: string }; Returns: undefined }
      offert_reply_delivery_target: {
        Args: { p_lease_token: string; p_outbox: string }
        Returns: {
          customer_email: string
          customer_name: string
          estimate_cents: number
          outcome: string
          reply_message: string
          subject: string
          tenant_id: string
          tenant_name: string
        }[]
      }
      partner_update_tenant_user: {
        Args: {
          p_access_scope: string
          p_role: string
          p_status: string
          p_tenant: string
          p_user: string
        }
        Returns: undefined
      }
      payment_refund_health: { Args: never; Returns: Json }
      redeem_gift_card: {
        Args: {
          p_amount_cents: number
          p_code_hash: string
          p_currency: string
          p_idempotency_key: string
          p_source_id?: string | null
          p_source_type?: string
          p_tenant: string
        }
        Returns: Json
      }
      restore_gift_card_redemption: {
        Args: {
          p_idempotency_key: string
          p_reason: string
          p_redemption_entry: string
          p_tenant: string
        }
        Returns: Json
      }
      reverse_loyalty_spend: {
        Args: {
          p_idempotency_key: string
          p_reason: string
          p_spend_entry: string
          p_tenant: string
        }
        Returns: Json
      }
      place_slot_hold: {
        Args: {
          p_service: string
          p_staff: string
          p_start: string
          p_tenant_slug: string
          p_token: string
          p_ttl_min?: number
        }
        Returns: string
      }
      platform_booking_stats: {
        Args: never
        Returns: {
          completed: number
          last_at: string
          tenant_id: string
          total: number
        }[]
      }
      platform_create_customer: {
        Args: {
          p_email?: string
          p_full_name: string
          p_phone?: string
          p_tenant: string
        }
        Returns: string
      }
      platform_cron_health: {
        Args: never
        Returns: {
          active: boolean
          jobname: string
          last_duration_ms: number
          last_message: string
          last_start: string
          last_status: string
          schedule: string
        }[]
      }
      platform_customer_safe_rows: {
        Args: {
          p_customer?: string
          p_limit?: number
          p_query?: string
          p_tenant?: string
        }
        Returns: {
          auth_user_id: string
          display_name: string
          first_seen_at: string
          full_name: string
          has_email: boolean
          has_phone: boolean
          id: string
          last_seen_at: string
          masked_email: string
          masked_phone: string
          name_hidden: boolean
          status: string
          tenant_id: string
          tenant_name: string
          tenant_slug: string
          visits: number
        }[]
      }
      platform_drift_health: {
        Args: { p_tenant?: string }
        Returns: {
          attempting_count: number
          delivery_started_count: number
          failed_24h_count: number
          oldest_ready_at: string | null
          queued_count: number
          routing_count: number
          scheduler_age_seconds: number | null
          scheduler_healthy: boolean
          scheduler_last_error_code: string | null
          scheduler_last_failed_at: string | null
          scheduler_last_started_at: string | null
          scheduler_last_status: string | null
          scheduler_last_succeeded_at: string | null
          scheduler_name: string | null
          scheduler_updated_at: string | null
          stalled_count: number
          tenant_id: string | null
        }[]
      }
      platform_outbox_rows: {
        Args: {
          p_category?: string
          p_channel?: string
          p_limit?: number
          p_status?: string
          p_tenant?: string
        }
        Returns: {
          category: string
          chosen_channel: string | null
          cost_ore: number | null
          created_at: string
          delivered_at: string | null
          event_type: string
          id: string
          provider_ref: string | null
          sent_at: string | null
          skip_reason: string | null
          status: string
          tenant_id: string
          tenant_name: string
          tenant_slug: string
        }[]
      }
      platform_outbox_summary: {
        Args: never
        Returns: {
          customers_total: number
          failed_30d: number
          name: string
          prefs_rows: number
          push_subs_active: number
          sent_30d: number
          skipped_30d: number
          slug: string
          sms_cost_ore_30d: number
          tenant_id: string
        }[]
      }
      platform_partner_summaries: {
        Args: never
        Returns: {
          active_tenants: number
          country_code: string
          currency: string
          license_month: string
          license_price_ore: number
          license_total_ore: number
          licensed_tenants: number
          member_email: string
          member_joined_at: string
          member_status: string
          partner_id: string
          partner_name: string
          partner_slug: string
          partner_status: string
          sms_cost_currency: string
          sms_cost_ore: number
          sms_provider_enabled: boolean
          sms_provider_key: string
          timezone: string
        }[]
      }
      platform_replace_service_staff: {
        Args: { p_service: string; p_staff_ids?: string[]; p_tenant: string }
        Returns: number
      }
      platform_replace_staff_schedule: {
        Args: { p_rows?: Json; p_staff: string; p_tenant: string }
        Returns: number
      }
      platform_replace_staff_services: {
        Args: { p_service_ids?: string[]; p_staff: string; p_tenant: string }
        Returns: number
      }
      platform_save_tenant_billing: {
        Args: {
          p_billing_model: string
          p_flat_monthly_fee_cents: number
          p_per_booking_fee_cents: number
          p_setup_fee_cents: number
          p_tenant: string
        }
        Returns: undefined
      }
      platform_set_contact_message_status: {
        Args: { p_message: string; p_status: string; p_tenant: string }
        Returns: boolean
      }
      prepare_booking_checkout_payment: {
        Args: {
          p_amount_cents: number
          p_booking: string
          p_checkout_session: string
          p_connected_account: string
          p_currency: string
          p_tenant: string
        }
        Returns: boolean
      }
      prepare_shop_order_payment: {
        Args: {
          p_account_scope: string
          p_order: string
          p_provider: string
          p_tenant: string
        }
        Returns: Json
      }
      prepare_staff_invite_cleanup: {
        Args: { p_auth_user: string; p_role: string; p_tenant: string }
        Returns: string
      }
      preview_admin_time_off_impacts: {
        Args: {
          p_end: string
          p_location: string
          p_staff: string
          p_start: string
        }
        Returns: {
          booking_id: string
          customer_email: string
          customer_name: string
          customer_phone: string
          end_ts: string
          handled: boolean
          resolution: string
          service_name: string
          start_ts: string
          status: string
        }[]
      }
      prune_contact_messages: { Args: { p_months?: number }; Returns: number }
      prune_expired_shop_reserves: { Args: never; Returns: number }
      prune_expired_slot_holds: { Args: never; Returns: number }
      publish_site_draft: {
        Args: { p_expected_lock_version: number; p_tenant: string }
        Returns: {
          lock_version: number
          revision_id: string
          snapshot: Json
        }[]
      }
      publish_tenant: { Args: { p_tenant: string }; Returns: Json }
      reconcile_customer_account_claim: {
        Args: {
          p_auth_user: string
          p_purpose: string
          p_tenant: string
          p_token_hash: string
        }
        Returns: boolean
      }
      read_corevo_jobs: {
        Args: never
        Returns: {
          enqueued_at: string
          message: Json
          msg_id: number
          read_ct: number
          vt: string
        }[]
      }
      record_booking_verification_delivery: {
        Args: { p_challenge: string; p_session_token: string }
        Returns: boolean
      }
      record_payment_refund_webhook: {
        Args: {
          p_connected_account: string
          p_payment_intent: string
          p_provider_ref: string
          p_tenant: string
        }
        Returns: Json
      }
      record_scheduler_heartbeat: {
        Args: {
          p_error_code: string
          p_observed_at: string
          p_phase: string
          p_run_id: string
          p_scheduler_name: string
        }
        Returns: boolean
      }
      record_shop_order_refund: {
        Args: { p_order_id: string }
        Returns: boolean
      }
      record_shop_payment_order_reference: {
        Args: {
          p_payment: string
          p_provider: string
          p_reference: string
        }
        Returns: Json
      }
      record_sms_delivery: {
        Args: {
          p_delivered_at: string | null
          p_partner?: string
          p_provider_ref: string
          p_status: string
        }
        Returns: string
      }
      refresh_partner_license_month: {
        Args: { p_month?: string }
        Returns: number
      }
      register_shop_payment_event: {
        Args: {
          p_account_scope: string
          p_amount_cents?: number | null
          p_currency?: string | null
          p_event_type: string
          p_order: string | null
          p_payload?: Json
          p_provider: string
          p_provider_event_id: string
          p_provider_reference_id: string
          p_tenant?: string | null
        }
        Returns: Json
      }
      release_shop_order: {
        Args: { p_order_id: string; p_status?: string; p_token?: string }
        Returns: undefined
      }
      release_slot_hold: {
        Args: { p_staff: string; p_start: string; p_token: string }
        Returns: undefined
      }
      request_media_delete: {
        Args: { p_asset: string; p_tenant: string }
        Returns: {
          asset_id: string
          outcome: string
          status: string
        }[]
      }
      reorder_gallery_items: {
        Args: { p_ids: string[]; p_tenant: string }
        Returns: {
          item_count: number
          outcome: string
        }[]
      }
      replace_staff_services: {
        Args: { p_services: string[]; p_staff: string }
        Returns: undefined
      }
      reschedule_admin_absence_booking: {
        Args: {
          p_booking: string
          p_expected_staff: string
          p_expected_start: string
          p_location: string
          p_service: string
          p_staff: string
          p_start: string
          p_time_off: string
        }
        Returns: Json
      }
      reschedule_admin_booking: {
        Args: {
          p_booking: string
          p_expected_staff: string
          p_expected_start: string
          p_location: string
          p_service: string
          p_staff: string
          p_start: string
        }
        Returns: Json
      }
      reserve_media_upload: {
        Args: {
          p_content_hash: string
          p_size_bytes: number
          p_source: string
          p_tenant: string
        }
        Returns: {
          asset_id: string
          outcome: string
          published: boolean
          r2_key: string
          status: string
          url: string | null
          variants: Json
        }[]
      }
      reserve_shop_order: {
        Args: {
          p_fulfilment?: string
          p_items: Json
          p_reserve_request_id?: string
          p_tenant_slug: string
          p_token?: string
          p_ttl_min?: number
        }
        Returns: string
      }
      resolve_partner_sms_callback: {
        Args: { p_partner: string }
        Returns: string
      }
      resolve_partner_sms_config: {
        Args: { p_tenant: string }
        Returns: {
          callback_secret: string
          callback_username: string
          cost_currency: string
          password: string
          provider_key: string
          sender: string
          username: string
        }[]
      }
      resolve_tenant_by_domain: { Args: { p_host: string }; Returns: string }
      restore_schedule_backup: { Args: never; Returns: undefined }
      restore_site_revision: {
        Args: {
          p_expected_lock_version?: number
          p_source_revision_id: string
          p_tenant: string
        }
        Returns: {
          lock_version: number
          revision_id: string
        }[]
      }
      retry_media_cleanup_job: {
        Args: {
          p_error: string
          p_job: string
          p_lease_token: string
          p_retry_after_seconds: number
        }
        Returns: boolean
      }
      retry_notification_outbox: {
        Args: {
          p_error: string
          p_id: string
          p_lease_token: string
          p_retry_at: string
        }
        Returns: string | null
      }
      retry_payment_refund_job: {
        Args: {
          p_id: string
          p_lease_token: string
          p_reason: string
          p_retry_at: string
        }
        Returns: string
      }
      review_payment_refund_job: {
        Args: { p_id: string; p_lease_token: string; p_reason: string }
        Returns: boolean
      }
      route_booking_notification: {
        Args: {
          p_allow: boolean
          p_booking: string
          p_category: string
          p_event_key: string
          p_event_type: string
          p_expected_statuses: string[]
          p_outbox_id: string | null
          p_payload: Json
          p_skip_reason: string | null
          p_staff: string | null
          p_tenant: string
          p_type_opt_in: string | null
        }
        Returns: {
          chosen_channel: string | null
          id: string
          inserted: boolean
          skip_reason: string | null
          status: string
        }[]
      }
      save_location_booking_settings: {
        Args: {
          p_hours: Json
          p_location: string
          p_max_advance_days: number
          p_min_notice_min: number
          p_slot_step_min: number
        }
        Returns: undefined
      }
      save_partner_sms_config: {
        Args: {
          p_callback_secret?: string
          p_enabled?: boolean
          p_partner: string
          p_password?: string
          p_provider_key: string
          p_sender: string
          p_username?: string
        }
        Returns: undefined
      }
      save_site_draft: {
        Args: {
          p_expected_lock_version?: number
          p_snapshot: Json
          p_tenant: string
        }
        Returns: {
          lock_version: number
          revision_id: string
        }[]
      }
      scrub_customer_account_claims: {
        Args: { p_customer_ids: string[] }
        Returns: number
      }
      scrub_notification_outbox_customer: {
        Args: { p_booking_ids: string[]; p_customer_ids: string[] }
        Returns: number
      }
      seed_explicit_slots_from_hours: {
        Args: { p_staff: string; p_step?: number }
        Returns: number
      }
      service_booking_counts: {
        Args: { p_tenant: string }
        Returns: {
          cnt: number
          service_id: string
        }[]
      }
      set_admin_booking_status: {
        Args: { p_booking: string; p_status: string }
        Returns: Json
      }
      set_blog_post_status: {
        Args: { p_post: string; p_status: string; p_tenant: string }
        Returns: {
          blog_status: string
          first_published_at: string | null
          outcome: string
        }[]
      }
      set_event_registration_status: {
        Args: {
          p_reason?: string
          p_registration: string
          p_status: string
          p_tenant: string
        }
        Returns: {
          outcome: string
          registration_status: string
          version: number
        }[]
      }
      set_tenant_event_status: {
        Args: {
          p_event: string
          p_reason?: string
          p_status: string
          p_tenant: string
        }
        Returns: {
          event_status: string
          outcome: string
          version: number
        }[]
      }
      set_my_notification_preferences: {
        Args: {
          p_notify_booking_changes: boolean
          p_notify_daily_reminder: boolean
          p_notify_new_booking: boolean
        }
        Returns: undefined
      }
      set_my_primary_location: {
        Args: { p_location: string }
        Returns: undefined
      }
      set_primary_location: { Args: { p_location: string }; Returns: undefined }
      set_customer_portal_mode: {
        Args: { p_mode: string; p_tenant: string }
        Returns: { mode: string }[]
      }
      set_staff_active: {
        Args: { p_active: boolean; p_staff: string }
        Returns: boolean
      }
      set_tenant_member_permissions: {
        Args: {
          p_can_edit_site: boolean
          p_can_manage_customers: boolean
          p_can_view_all_calendars: boolean
          p_can_view_daily_metrics: boolean
          p_operational_role: string
          p_staff: string
        }
        Returns: undefined
      }
      settle_shop_payment_event: {
        Args: { p_event: string }
        Returns: Json
      }
      spend_loyalty_points: {
        Args: {
          p_customer: string
          p_idempotency_key: string
          p_note?: string | null
          p_points: number
          p_source_id?: string | null
          p_source_type?: string
          p_tenant: string
        }
        Returns: Json
      }
      start_booking_verification: {
        Args: {
          p_channel: string
          p_contact_digest: string
          p_contact_masked: string
          p_pin_digest: string
          p_previous_challenge?: string
          p_service: string
          p_session_token: string
          p_staff: string
          p_start: string
          p_tenant_slug: string
        }
        Returns: {
          challenge_id: string
          expires_at: string
          hold_id: string
          pin_outbox_id: string
          resend_after: string
        }[]
      }
      sweep_customer_portal_contact_changes: {
        Args: { p_now?: string }
        Returns: number
      }
      switch_tenant_theme: {
        Args: {
          p_copy: Json
          p_expected_settings: Json
          p_expected_vertical: string | null
          p_tenant: string
          p_theme: string
        }
        Returns: undefined
      }
      sync_partner_license_open_month: {
        Args: { p_partner?: string }
        Returns: number
      }
      tenant_launch_readiness: { Args: { p_tenant: string }; Returns: Json }
      tenant_module_readiness: { Args: { p_tenant: string }; Returns: Json }
      tenant_storage_usage: { Args: { p_tenant: string }; Returns: number }
      update_offert_request: {
        Args: {
          p_estimate_cents: number | null
          p_expected_version: number
          p_note: string | null
          p_request: string
          p_status: string
          p_tenant: string
        }
        Returns: {
          offert_status: string
          outcome: string
          version: number
        }[]
      }
      update_booking_operational_settings: {
        Args: {
          p_external_cta_urls: Json
          p_external_url: string | null
          p_provider: string
          p_tenant: string
          p_verification_mode?: string | null
        }
        Returns: Json
      }
      update_media_alt: {
        Args: { p_alt: string; p_asset: string; p_tenant: string }
        Returns: {
          asset_id: string
          outcome: string
        }[]
      }
      void_gift_card: {
        Args: {
          p_gift_card: string
          p_idempotency_key: string
          p_reason: string
          p_tenant: string
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
