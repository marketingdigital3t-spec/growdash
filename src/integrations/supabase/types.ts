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
      account_balance_events: {
        Row: {
          ad_account_id: string
          delta: number
          event_at: string
          id: string
          new_balance: number | null
          source: string
        }
        Insert: {
          ad_account_id: string
          delta: number
          event_at?: string
          id?: string
          new_balance?: number | null
          source?: string
        }
        Update: {
          ad_account_id?: string
          delta?: number
          event_at?: string
          id?: string
          new_balance?: number | null
          source?: string
        }
        Relationships: [
          {
            foreignKeyName: "account_balance_events_ad_account_id_fkey"
            columns: ["ad_account_id"]
            isOneToOne: false
            referencedRelation: "ad_accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      account_lead_action: {
        Row: {
          ad_account_id: string
          lp_lead_action: string
          scope: string
          updated_at: string
        }
        Insert: {
          ad_account_id: string
          lp_lead_action: string
          scope?: string
          updated_at?: string
        }
        Update: {
          ad_account_id?: string
          lp_lead_action?: string
          scope?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "account_lead_action_ad_account_id_fkey"
            columns: ["ad_account_id"]
            isOneToOne: false
            referencedRelation: "ad_accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      account_lp_config: {
        Row: {
          action_type: string | null
          ad_account_id: string
          pixel_id: string | null
          updated_at: string
        }
        Insert: {
          action_type?: string | null
          ad_account_id: string
          pixel_id?: string | null
          updated_at?: string
        }
        Update: {
          action_type?: string | null
          ad_account_id?: string
          pixel_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "account_lp_config_ad_account_id_fkey"
            columns: ["ad_account_id"]
            isOneToOne: true
            referencedRelation: "ad_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "account_lp_config_pixel_id_fkey"
            columns: ["pixel_id"]
            isOneToOne: false
            referencedRelation: "ad_account_pixel"
            referencedColumns: ["id"]
          },
        ]
      }
      account_utm_mapping: {
        Row: {
          ad_account_id: string
          adset_utm: string
          campaign_utm: string
          created_at: string
          creative_utm: string
          id: string
          match_strategy: string
          platform_utm: string
          updated_at: string
        }
        Insert: {
          ad_account_id: string
          adset_utm?: string
          campaign_utm?: string
          created_at?: string
          creative_utm?: string
          id?: string
          match_strategy?: string
          platform_utm?: string
          updated_at?: string
        }
        Update: {
          ad_account_id?: string
          adset_utm?: string
          campaign_utm?: string
          created_at?: string
          creative_utm?: string
          id?: string
          match_strategy?: string
          platform_utm?: string
          updated_at?: string
        }
        Relationships: []
      }
      ad_account_pixel: {
        Row: {
          ad_account_id: string
          created_at: string
          id: string
          last_synced_at: string
          name: string
          pixel_id: string
        }
        Insert: {
          ad_account_id: string
          created_at?: string
          id?: string
          last_synced_at?: string
          name: string
          pixel_id: string
        }
        Update: {
          ad_account_id?: string
          created_at?: string
          id?: string
          last_synced_at?: string
          name?: string
          pixel_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ad_account_pixel_ad_account_id_fkey"
            columns: ["ad_account_id"]
            isOneToOne: false
            referencedRelation: "ad_accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      ad_accounts: {
        Row: {
          access_token: string
          account_id: string
          connection_status: string
          created_at: string
          daily_budget: number | null
          id: string
          last_sync_attempt_at: string | null
          last_sync_error: string | null
          last_sync_error_code: number | null
          last_sync_success_at: string | null
          min_spend_threshold: number
          name: string
          remaining_balance: number | null
          target_cpl: number | null
          updated_at: string
          user_id: string
        }
        Insert: {
          access_token: string
          account_id: string
          connection_status?: string
          created_at?: string
          daily_budget?: number | null
          id?: string
          last_sync_attempt_at?: string | null
          last_sync_error?: string | null
          last_sync_error_code?: number | null
          last_sync_success_at?: string | null
          min_spend_threshold?: number
          name: string
          remaining_balance?: number | null
          target_cpl?: number | null
          updated_at?: string
          user_id: string
        }
        Update: {
          access_token?: string
          account_id?: string
          connection_status?: string
          created_at?: string
          daily_budget?: number | null
          id?: string
          last_sync_attempt_at?: string | null
          last_sync_error?: string | null
          last_sync_error_code?: number | null
          last_sync_success_at?: string | null
          min_spend_threshold?: number
          name?: string
          remaining_balance?: number | null
          target_cpl?: number | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      ads: {
        Row: {
          adset_id: string
          created_at: string
          creative_id: string | null
          id: string
          last_activated_at: string | null
          name: string
          previous_status: string | null
          status: string | null
          thumbnail_url: string | null
          updated_at: string
        }
        Insert: {
          adset_id: string
          created_at?: string
          creative_id?: string | null
          id: string
          last_activated_at?: string | null
          name: string
          previous_status?: string | null
          status?: string | null
          thumbnail_url?: string | null
          updated_at?: string
        }
        Update: {
          adset_id?: string
          created_at?: string
          creative_id?: string | null
          id?: string
          last_activated_at?: string | null
          name?: string
          previous_status?: string | null
          status?: string | null
          thumbnail_url?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "ads_adset_id_fkey"
            columns: ["adset_id"]
            isOneToOne: false
            referencedRelation: "adsets"
            referencedColumns: ["id"]
          },
        ]
      }
      adsets: {
        Row: {
          campaign_id: string
          created_at: string
          daily_budget: number | null
          destination_type: string | null
          id: string
          last_activated_at: string | null
          name: string
          previous_status: string | null
          status: string | null
          updated_at: string
        }
        Insert: {
          campaign_id: string
          created_at?: string
          daily_budget?: number | null
          destination_type?: string | null
          id: string
          last_activated_at?: string | null
          name: string
          previous_status?: string | null
          status?: string | null
          updated_at?: string
        }
        Update: {
          campaign_id?: string
          created_at?: string
          daily_budget?: number | null
          destination_type?: string | null
          id?: string
          last_activated_at?: string | null
          name?: string
          previous_status?: string | null
          status?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "adsets_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
        ]
      }
      alerts: {
        Row: {
          ad_id: string | null
          alert_type: string
          created_at: string
          id: string
          is_read: boolean | null
          message: string
          severity: string
          user_id: string
        }
        Insert: {
          ad_id?: string | null
          alert_type: string
          created_at?: string
          id?: string
          is_read?: boolean | null
          message: string
          severity: string
          user_id: string
        }
        Update: {
          ad_id?: string | null
          alert_type?: string
          created_at?: string
          id?: string
          is_read?: boolean | null
          message?: string
          severity?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "alerts_ad_id_fkey"
            columns: ["ad_id"]
            isOneToOne: false
            referencedRelation: "ads"
            referencedColumns: ["id"]
          },
        ]
      }
      campaign_changes: {
        Row: {
          campaign_id: string
          change_type: string
          changed_at: string
          created_by: string | null
          entity_id: string | null
          entity_type: string
          field: string | null
          id: string
          new_value: string | null
          note: string | null
          old_value: string | null
        }
        Insert: {
          campaign_id: string
          change_type: string
          changed_at?: string
          created_by?: string | null
          entity_id?: string | null
          entity_type?: string
          field?: string | null
          id?: string
          new_value?: string | null
          note?: string | null
          old_value?: string | null
        }
        Update: {
          campaign_id?: string
          change_type?: string
          changed_at?: string
          created_by?: string | null
          entity_id?: string | null
          entity_type?: string
          field?: string | null
          id?: string
          new_value?: string | null
          note?: string | null
          old_value?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "campaign_changes_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
        ]
      }
      campaign_targets: {
        Row: {
          campaign_id: string
          created_at: string
          target_cpl: number
          updated_at: string
        }
        Insert: {
          campaign_id: string
          created_at?: string
          target_cpl: number
          updated_at?: string
        }
        Update: {
          campaign_id?: string
          created_at?: string
          target_cpl?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "campaign_targets_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: true
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
        ]
      }
      campaigns: {
        Row: {
          ad_account_id: string
          created_at: string
          id: string
          last_activated_at: string | null
          name: string
          objective: string | null
          previous_status: string | null
          status: string | null
          updated_at: string
        }
        Insert: {
          ad_account_id: string
          created_at?: string
          id: string
          last_activated_at?: string | null
          name: string
          objective?: string | null
          previous_status?: string | null
          status?: string | null
          updated_at?: string
        }
        Update: {
          ad_account_id?: string
          created_at?: string
          id?: string
          last_activated_at?: string | null
          name?: string
          objective?: string | null
          previous_status?: string | null
          status?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "campaigns_ad_account_id_fkey"
            columns: ["ad_account_id"]
            isOneToOne: false
            referencedRelation: "ad_accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      custom_metrics: {
        Row: {
          created_at: string
          denominator_action: string | null
          denominator_field: string | null
          format: string
          id: string
          is_default_lead: boolean
          kind: string
          name: string
          numerator_action: string | null
          position: number
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          denominator_action?: string | null
          denominator_field?: string | null
          format?: string
          id?: string
          is_default_lead?: boolean
          kind: string
          name: string
          numerator_action?: string | null
          position?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          denominator_action?: string | null
          denominator_field?: string | null
          format?: string
          id?: string
          is_default_lead?: boolean
          kind?: string
          name?: string
          numerator_action?: string | null
          position?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      dashboard_view_state: {
        Row: {
          context_key: string
          updated_at: string
          user_id: string
          view_id: string
        }
        Insert: {
          context_key: string
          updated_at?: string
          user_id: string
          view_id: string
        }
        Update: {
          context_key?: string
          updated_at?: string
          user_id?: string
          view_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "dashboard_view_state_view_id_fkey"
            columns: ["view_id"]
            isOneToOne: false
            referencedRelation: "dashboard_views"
            referencedColumns: ["id"]
          },
        ]
      }
      dashboard_views: {
        Row: {
          ad_account_id: string | null
          created_at: string
          id: string
          is_default: boolean
          is_system: boolean
          layout: Json
          name: string
          scope: string
          updated_at: string
          user_id: string
          widgets: Json
        }
        Insert: {
          ad_account_id?: string | null
          created_at?: string
          id?: string
          is_default?: boolean
          is_system?: boolean
          layout?: Json
          name: string
          scope?: string
          updated_at?: string
          user_id: string
          widgets?: Json
        }
        Update: {
          ad_account_id?: string | null
          created_at?: string
          id?: string
          is_default?: boolean
          is_system?: boolean
          layout?: Json
          name?: string
          scope?: string
          updated_at?: string
          user_id?: string
          widgets?: Json
        }
        Relationships: []
      }
      event_class_history: {
        Row: {
          action: string
          actor_id: string | null
          created_at: string
          description: string | null
          event_class_id: string
          id: string
          metadata: Json | null
        }
        Insert: {
          action: string
          actor_id?: string | null
          created_at?: string
          description?: string | null
          event_class_id: string
          id?: string
          metadata?: Json | null
        }
        Update: {
          action?: string
          actor_id?: string | null
          created_at?: string
          description?: string | null
          event_class_id?: string
          id?: string
          metadata?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "event_class_history_event_class_id_fkey"
            columns: ["event_class_id"]
            isOneToOne: false
            referencedRelation: "event_classes"
            referencedColumns: ["id"]
          },
        ]
      }
      event_class_members: {
        Row: {
          event_class_id: string
          id: string
          last_synced_at: string | null
          linked_at: string
          linked_by: string | null
          member_type: string
          rd_deal_id: string
        }
        Insert: {
          event_class_id: string
          id?: string
          last_synced_at?: string | null
          linked_at?: string
          linked_by?: string | null
          member_type: string
          rd_deal_id: string
        }
        Update: {
          event_class_id?: string
          id?: string
          last_synced_at?: string | null
          linked_at?: string
          linked_by?: string | null
          member_type?: string
          rd_deal_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "event_class_members_event_class_id_fkey"
            columns: ["event_class_id"]
            isOneToOne: false
            referencedRelation: "event_classes"
            referencedColumns: ["id"]
          },
        ]
      }
      event_classes: {
        Row: {
          ad_account_id: string
          allowed_model_patient_stage_ids: string[]
          allowed_student_stage_ids: string[]
          created_at: string
          date_end: string | null
          date_start: string
          has_model_patients: boolean
          id: string
          location: string | null
          max_model_patients: number
          max_people: number
          max_students: number
          notes: string | null
          rd_funnel_id: string
          rd_model_patient_funnel_id: string | null
          status: string
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          ad_account_id: string
          allowed_model_patient_stage_ids?: string[]
          allowed_student_stage_ids?: string[]
          created_at?: string
          date_end?: string | null
          date_start: string
          has_model_patients?: boolean
          id?: string
          location?: string | null
          max_model_patients?: number
          max_people?: number
          max_students?: number
          notes?: string | null
          rd_funnel_id: string
          rd_model_patient_funnel_id?: string | null
          status?: string
          title: string
          updated_at?: string
          user_id: string
        }
        Update: {
          ad_account_id?: string
          allowed_model_patient_stage_ids?: string[]
          allowed_student_stage_ids?: string[]
          created_at?: string
          date_end?: string | null
          date_start?: string
          has_model_patients?: boolean
          id?: string
          location?: string | null
          max_model_patients?: number
          max_people?: number
          max_students?: number
          notes?: string | null
          rd_funnel_id?: string
          rd_model_patient_funnel_id?: string | null
          status?: string
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      funnels: {
        Row: {
          ad_account_id: string | null
          campaign_ids: string[] | null
          connections: Json
          created_at: string
          funnel_type: string
          id: string
          name: string
          nodes: Json
          updated_at: string
          user_id: string
        }
        Insert: {
          ad_account_id?: string | null
          campaign_ids?: string[] | null
          connections?: Json
          created_at?: string
          funnel_type?: string
          id?: string
          name?: string
          nodes?: Json
          updated_at?: string
          user_id: string
        }
        Update: {
          ad_account_id?: string | null
          campaign_ids?: string[] | null
          connections?: Json
          created_at?: string
          funnel_type?: string
          id?: string
          name?: string
          nodes?: Json
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "funnels_ad_account_id_fkey"
            columns: ["ad_account_id"]
            isOneToOne: false
            referencedRelation: "ad_accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      insight_actions: {
        Row: {
          action_type: string
          ad_id: string
          created_at: string
          date: string
          value: number
          value_amount: number | null
        }
        Insert: {
          action_type: string
          ad_id: string
          created_at?: string
          date: string
          value?: number
          value_amount?: number | null
        }
        Update: {
          action_type?: string
          ad_id?: string
          created_at?: string
          date?: string
          value?: number
          value_amount?: number | null
        }
        Relationships: []
      }
      insights: {
        Row: {
          ad_id: string
          clicks: number | null
          conversion_rate: number | null
          cpl: number | null
          cpm: number | null
          created_at: string
          ctr: number | null
          date: string
          efficiency_rate: number | null
          frequency: number | null
          health_score: number | null
          id: string
          impressions: number | null
          leads: number | null
          reach: number | null
          spend: number | null
        }
        Insert: {
          ad_id: string
          clicks?: number | null
          conversion_rate?: number | null
          cpl?: number | null
          cpm?: number | null
          created_at?: string
          ctr?: number | null
          date: string
          efficiency_rate?: number | null
          frequency?: number | null
          health_score?: number | null
          id?: string
          impressions?: number | null
          leads?: number | null
          reach?: number | null
          spend?: number | null
        }
        Update: {
          ad_id?: string
          clicks?: number | null
          conversion_rate?: number | null
          cpl?: number | null
          cpm?: number | null
          created_at?: string
          ctr?: number | null
          date?: string
          efficiency_rate?: number | null
          frequency?: number | null
          health_score?: number | null
          id?: string
          impressions?: number | null
          leads?: number | null
          reach?: number | null
          spend?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "insights_ad_id_fkey"
            columns: ["ad_id"]
            isOneToOne: false
            referencedRelation: "ads"
            referencedColumns: ["id"]
          },
        ]
      }
      insights_breakdowns: {
        Row: {
          breakdown_type: string
          campaign_id: string
          clicks: number | null
          created_at: string
          date: string
          id: string
          impressions: number | null
          leads: number | null
          segment_key: string
          spend: number | null
        }
        Insert: {
          breakdown_type: string
          campaign_id: string
          clicks?: number | null
          created_at?: string
          date: string
          id?: string
          impressions?: number | null
          leads?: number | null
          segment_key: string
          spend?: number | null
        }
        Update: {
          breakdown_type?: string
          campaign_id?: string
          clicks?: number | null
          created_at?: string
          date?: string
          id?: string
          impressions?: number | null
          leads?: number | null
          segment_key?: string
          spend?: number | null
        }
        Relationships: []
      }
      insights_hourly: {
        Row: {
          ad_account_id: string
          ad_id: string
          campaign_id: string | null
          clicks: number
          date: string
          hour: number
          leads: number
          spend: number
          updated_at: string
        }
        Insert: {
          ad_account_id: string
          ad_id: string
          campaign_id?: string | null
          clicks?: number
          date: string
          hour: number
          leads?: number
          spend?: number
          updated_at?: string
        }
        Update: {
          ad_account_id?: string
          ad_id?: string
          campaign_id?: string | null
          clicks?: number
          date?: string
          hour?: number
          leads?: number
          spend?: number
          updated_at?: string
        }
        Relationships: []
      }
      integrations: {
        Row: {
          api_token: string | null
          created_at: string
          id: string
          is_active: boolean | null
          provider: string
          updated_at: string
          user_id: string
          webhook_secret: string | null
        }
        Insert: {
          api_token?: string | null
          created_at?: string
          id?: string
          is_active?: boolean | null
          provider?: string
          updated_at?: string
          user_id: string
          webhook_secret?: string | null
        }
        Update: {
          api_token?: string | null
          created_at?: string
          id?: string
          is_active?: boolean | null
          provider?: string
          updated_at?: string
          user_id?: string
          webhook_secret?: string | null
        }
        Relationships: []
      }
      pixel_event: {
        Row: {
          action_type: string
          created_at: string
          event_name: string
          id: string
          is_custom: boolean
          pixel_id: string
        }
        Insert: {
          action_type: string
          created_at?: string
          event_name: string
          id?: string
          is_custom?: boolean
          pixel_id: string
        }
        Update: {
          action_type?: string
          created_at?: string
          event_name?: string
          id?: string
          is_custom?: boolean
          pixel_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "pixel_event_pixel_id_fkey"
            columns: ["pixel_id"]
            isOneToOne: false
            referencedRelation: "ad_account_pixel"
            referencedColumns: ["id"]
          },
        ]
      }
      platform_announcements: {
        Row: {
          active: boolean
          alt: string
          created_at: string
          created_by: string | null
          id: string
          image_data_url: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          alt?: string
          created_at?: string
          created_by?: string | null
          id?: string
          image_data_url: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          alt?: string
          created_at?: string
          created_by?: string | null
          id?: string
          image_data_url?: string
          updated_at?: string
        }
        Relationships: []
      }
      platform_rules: {
        Row: {
          created_at: string
          id: string
          is_active: boolean
          is_fallback: boolean
          match_field: string
          match_mode: string
          parent_platform: string | null
          pattern: string
          platform: string
          priority: number
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean
          is_fallback?: boolean
          match_field: string
          match_mode?: string
          parent_platform?: string | null
          pattern: string
          platform: string
          priority?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean
          is_fallback?: boolean
          match_field?: string
          match_mode?: string
          parent_platform?: string | null
          pattern?: string
          platform?: string
          priority?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      products: {
        Row: {
          created_at: string
          id: string
          name: string
          price: number
          tax_rate: number | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          price?: number
          tax_rate?: number | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          price?: number
          tax_rate?: number | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string
          email: string | null
          email_alerts_enabled: boolean | null
          full_name: string | null
          id: string
          lp_lead_action: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          email?: string | null
          email_alerts_enabled?: boolean | null
          full_name?: string | null
          id?: string
          lp_lead_action?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          email?: string | null
          email_alerts_enabled?: boolean | null
          full_name?: string | null
          id?: string
          lp_lead_action?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      rd_deal_touches: {
        Row: {
          ad_account_id: string
          created_at: string
          id: string
          is_first: boolean
          is_last: boolean
          matched_campaign_id: string | null
          rd_deal_id: string
          source: string | null
          touch_at: string
          touch_order: number
          user_id: string
          utm_campaign: string | null
          utm_content: string | null
          utm_medium: string | null
          utm_source: string | null
          utm_term: string | null
        }
        Insert: {
          ad_account_id: string
          created_at?: string
          id?: string
          is_first?: boolean
          is_last?: boolean
          matched_campaign_id?: string | null
          rd_deal_id: string
          source?: string | null
          touch_at: string
          touch_order?: number
          user_id: string
          utm_campaign?: string | null
          utm_content?: string | null
          utm_medium?: string | null
          utm_source?: string | null
          utm_term?: string | null
        }
        Update: {
          ad_account_id?: string
          created_at?: string
          id?: string
          is_first?: boolean
          is_last?: boolean
          matched_campaign_id?: string | null
          rd_deal_id?: string
          source?: string | null
          touch_at?: string
          touch_order?: number
          user_id?: string
          utm_campaign?: string | null
          utm_content?: string | null
          utm_medium?: string | null
          utm_source?: string | null
          utm_term?: string | null
        }
        Relationships: []
      }
      rd_deals: {
        Row: {
          ad_account_id: string
          amount_total: number | null
          closed_at: string | null
          contact_email: string | null
          contact_name: string | null
          created_at: string
          deal_owner_name: string | null
          first_touch_utm_campaign: string | null
          id: string
          last_touch_utm_campaign: string | null
          lead_city: string | null
          lead_created_at: string | null
          lead_state: string | null
          lost_reason: string | null
          raw: Json | null
          rd_deal_id: string
          rd_funnel_id: string
          rd_product_name: string | null
          rd_stage_id: string | null
          rd_stage_name: string | null
          rd_stage_order: number | null
          stage_bucket: string
          stage_updated_at: string | null
          touch_count: number
          updated_at: string
          user_id: string
          utm_campaign: string | null
          utm_content: string | null
          utm_medium: string | null
          utm_source: string | null
          utm_term: string | null
          win: boolean
        }
        Insert: {
          ad_account_id: string
          amount_total?: number | null
          closed_at?: string | null
          contact_email?: string | null
          contact_name?: string | null
          created_at?: string
          deal_owner_name?: string | null
          first_touch_utm_campaign?: string | null
          id?: string
          last_touch_utm_campaign?: string | null
          lead_city?: string | null
          lead_created_at?: string | null
          lead_state?: string | null
          lost_reason?: string | null
          raw?: Json | null
          rd_deal_id: string
          rd_funnel_id: string
          rd_product_name?: string | null
          rd_stage_id?: string | null
          rd_stage_name?: string | null
          rd_stage_order?: number | null
          stage_bucket?: string
          stage_updated_at?: string | null
          touch_count?: number
          updated_at?: string
          user_id: string
          utm_campaign?: string | null
          utm_content?: string | null
          utm_medium?: string | null
          utm_source?: string | null
          utm_term?: string | null
          win?: boolean
        }
        Update: {
          ad_account_id?: string
          amount_total?: number | null
          closed_at?: string | null
          contact_email?: string | null
          contact_name?: string | null
          created_at?: string
          deal_owner_name?: string | null
          first_touch_utm_campaign?: string | null
          id?: string
          last_touch_utm_campaign?: string | null
          lead_city?: string | null
          lead_created_at?: string | null
          lead_state?: string | null
          lost_reason?: string | null
          raw?: Json | null
          rd_deal_id?: string
          rd_funnel_id?: string
          rd_product_name?: string | null
          rd_stage_id?: string | null
          rd_stage_name?: string | null
          rd_stage_order?: number | null
          stage_bucket?: string
          stage_updated_at?: string | null
          touch_count?: number
          updated_at?: string
          user_id?: string
          utm_campaign?: string | null
          utm_content?: string | null
          utm_medium?: string | null
          utm_source?: string | null
          utm_term?: string | null
          win?: boolean
        }
        Relationships: []
      }
      rd_funnel_stages: {
        Row: {
          ad_account_id: string
          created_at: string
          id: string
          is_lost: boolean
          is_won: boolean
          name: string
          nickname: string | null
          order: number
          rd_funnel_id: string
          rd_stage_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          ad_account_id: string
          created_at?: string
          id?: string
          is_lost?: boolean
          is_won?: boolean
          name: string
          nickname?: string | null
          order?: number
          rd_funnel_id: string
          rd_stage_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          ad_account_id?: string
          created_at?: string
          id?: string
          is_lost?: boolean
          is_won?: boolean
          name?: string
          nickname?: string | null
          order?: number
          rd_funnel_id?: string
          rd_stage_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      rd_funnels: {
        Row: {
          ad_account_id: string
          created_at: string
          expert_name: string | null
          id: string
          is_active: boolean
          name: string
          rd_funnel_id: string | null
          updated_at: string
          user_id: string
          utm_campaign_pattern: string | null
        }
        Insert: {
          ad_account_id: string
          created_at?: string
          expert_name?: string | null
          id?: string
          is_active?: boolean
          name: string
          rd_funnel_id?: string | null
          updated_at?: string
          user_id: string
          utm_campaign_pattern?: string | null
        }
        Update: {
          ad_account_id?: string
          created_at?: string
          expert_name?: string | null
          id?: string
          is_active?: boolean
          name?: string
          rd_funnel_id?: string | null
          updated_at?: string
          user_id?: string
          utm_campaign_pattern?: string | null
        }
        Relationships: []
      }
      realtime_sync_state: {
        Row: {
          created_at: string
          id: string
          last_error: string | null
          last_finished_at: string | null
          last_started_at: string | null
          last_success_at: string | null
          locked_until: string | null
          provider: string
          scope_key: string
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          last_error?: string | null
          last_finished_at?: string | null
          last_started_at?: string | null
          last_success_at?: string | null
          locked_until?: string | null
          provider: string
          scope_key: string
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          last_error?: string | null
          last_finished_at?: string | null
          last_started_at?: string | null
          last_success_at?: string | null
          locked_until?: string | null
          provider?: string
          scope_key?: string
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      sales: {
        Row: {
          ad_account_id: string | null
          ad_id: string | null
          adset_id: string | null
          campaign_ids: string[] | null
          chargeback_amount: number | null
          contact_email: string | null
          contact_name: string | null
          contact_phone: string | null
          created_at: string
          gross_revenue: number
          id: string
          lead_city: string | null
          lead_entry_date: string | null
          lead_formation: string | null
          lead_state: string | null
          manual_ad_id: string | null
          manual_adset_id: string | null
          manual_campaign_id: string | null
          manual_override: boolean
          manual_platform: string | null
          match_method: string | null
          matched_campaign_id: string | null
          net_revenue: number
          notes: string | null
          payment_method: string
          product_id: string | null
          quantity: number
          rd_campaign_name: string | null
          rd_deal_id: string | null
          rd_funnel_id: string | null
          rd_product_name: string | null
          refund_amount: number | null
          sale_date: string
          status: string
          tax_amount: number | null
          updated_at: string
          user_id: string
          utm_campaign: string | null
          utm_content: string | null
          utm_medium: string | null
          utm_source: string | null
          utm_term: string | null
        }
        Insert: {
          ad_account_id?: string | null
          ad_id?: string | null
          adset_id?: string | null
          campaign_ids?: string[] | null
          chargeback_amount?: number | null
          contact_email?: string | null
          contact_name?: string | null
          contact_phone?: string | null
          created_at?: string
          gross_revenue?: number
          id?: string
          lead_city?: string | null
          lead_entry_date?: string | null
          lead_formation?: string | null
          lead_state?: string | null
          manual_ad_id?: string | null
          manual_adset_id?: string | null
          manual_campaign_id?: string | null
          manual_override?: boolean
          manual_platform?: string | null
          match_method?: string | null
          matched_campaign_id?: string | null
          net_revenue?: number
          notes?: string | null
          payment_method?: string
          product_id?: string | null
          quantity?: number
          rd_campaign_name?: string | null
          rd_deal_id?: string | null
          rd_funnel_id?: string | null
          rd_product_name?: string | null
          refund_amount?: number | null
          sale_date?: string
          status?: string
          tax_amount?: number | null
          updated_at?: string
          user_id: string
          utm_campaign?: string | null
          utm_content?: string | null
          utm_medium?: string | null
          utm_source?: string | null
          utm_term?: string | null
        }
        Update: {
          ad_account_id?: string | null
          ad_id?: string | null
          adset_id?: string | null
          campaign_ids?: string[] | null
          chargeback_amount?: number | null
          contact_email?: string | null
          contact_name?: string | null
          contact_phone?: string | null
          created_at?: string
          gross_revenue?: number
          id?: string
          lead_city?: string | null
          lead_entry_date?: string | null
          lead_formation?: string | null
          lead_state?: string | null
          manual_ad_id?: string | null
          manual_adset_id?: string | null
          manual_campaign_id?: string | null
          manual_override?: boolean
          manual_platform?: string | null
          match_method?: string | null
          matched_campaign_id?: string | null
          net_revenue?: number
          notes?: string | null
          payment_method?: string
          product_id?: string | null
          quantity?: number
          rd_campaign_name?: string | null
          rd_deal_id?: string | null
          rd_funnel_id?: string | null
          rd_product_name?: string | null
          refund_amount?: number | null
          sale_date?: string
          status?: string
          tax_amount?: number | null
          updated_at?: string
          user_id?: string
          utm_campaign?: string | null
          utm_content?: string | null
          utm_medium?: string | null
          utm_source?: string | null
          utm_term?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "sales_ad_account_id_fkey"
            columns: ["ad_account_id"]
            isOneToOne: false
            referencedRelation: "ad_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      sync_runs: {
        Row: {
          contacts_fetched: number
          created_count: number
          deals_fetched: number
          details_fetched: number
          duration_ms: number | null
          error_message: string | null
          errors_total: number
          finished_at: string | null
          funnel_id: string | null
          id: string
          provider: string
          retries_total: number
          skipped_count: number
          started_at: string
          status: string
          trigger_source: string | null
          updated_count: number
          user_id: string
        }
        Insert: {
          contacts_fetched?: number
          created_count?: number
          deals_fetched?: number
          details_fetched?: number
          duration_ms?: number | null
          error_message?: string | null
          errors_total?: number
          finished_at?: string | null
          funnel_id?: string | null
          id?: string
          provider?: string
          retries_total?: number
          skipped_count?: number
          started_at?: string
          status?: string
          trigger_source?: string | null
          updated_count?: number
          user_id: string
        }
        Update: {
          contacts_fetched?: number
          created_count?: number
          deals_fetched?: number
          details_fetched?: number
          duration_ms?: number | null
          error_message?: string | null
          errors_total?: number
          finished_at?: string | null
          funnel_id?: string | null
          id?: string
          provider?: string
          retries_total?: number
          skipped_count?: number
          started_at?: string
          status?: string
          trigger_source?: string | null
          updated_count?: number
          user_id?: string
        }
        Relationships: []
      }
      user_ad_account_access: {
        Row: {
          ad_account_id: string
          created_at: string
          user_id: string
        }
        Insert: {
          ad_account_id: string
          created_at?: string
          user_id: string
        }
        Update: {
          ad_account_id?: string
          created_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_permissions: {
        Row: {
          can_campaigns: boolean
          can_classes: boolean
          can_dashboard: boolean
          can_funnels: boolean
          created_at: string
          updated_at: string
          user_id: string
          username: string
        }
        Insert: {
          can_campaigns?: boolean
          can_classes?: boolean
          can_dashboard?: boolean
          can_funnels?: boolean
          created_at?: string
          updated_at?: string
          user_id: string
          username: string
        }
        Update: {
          can_campaigns?: boolean
          can_classes?: boolean
          can_dashboard?: boolean
          can_funnels?: boolean
          created_at?: string
          updated_at?: string
          user_id?: string
          username?: string
        }
        Relationships: []
      }
      user_rd_funnel_access: {
        Row: {
          created_at: string
          rd_funnel_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          rd_funnel_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          rd_funnel_id?: string
          user_id?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_master: { Args: { _user_id: string }; Returns: boolean }
      is_platform_owner: { Args: { _user_id: string }; Returns: boolean }
      user_can_access_ad: {
        Args: { _ad_id: string; _user_id: string }
        Returns: boolean
      }
      user_can_access_campaign: {
        Args: { _campaign_id: string; _user_id: string }
        Returns: boolean
      }
      user_has_page: {
        Args: { _page: string; _user_id: string }
        Returns: boolean
      }
      user_owns_ad_account: {
        Args: { _ad_account_id: string; _user_id: string }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin" | "user" | "master" | "gestor" | "usuario"
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
    Enums: {
      app_role: ["admin", "user", "master", "gestor", "usuario"],
    },
  },
} as const
