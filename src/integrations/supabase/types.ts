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
      account_transactions: {
        Row: {
          ad_account_id: string
          amount: number
          billing_reason: string | null
          currency: string | null
          id: string
          inserted_at: string
          payment_method: string | null
          raw: Json | null
          reference: string | null
          status: string | null
          time: string
          updated_at: string
        }
        Insert: {
          ad_account_id: string
          amount?: number
          billing_reason?: string | null
          currency?: string | null
          id: string
          inserted_at?: string
          payment_method?: string | null
          raw?: Json | null
          reference?: string | null
          status?: string | null
          time: string
          updated_at?: string
        }
        Update: {
          ad_account_id?: string
          amount?: number
          billing_reason?: string | null
          currency?: string | null
          id?: string
          inserted_at?: string
          payment_method?: string | null
          raw?: Json | null
          reference?: string | null
          status?: string | null
          time?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "account_transactions_ad_account_id_fkey"
            columns: ["ad_account_id"]
            isOneToOne: false
            referencedRelation: "ad_accounts"
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
          attribution_window: string
          business_unit_id: string | null
          connection_status: string
          created_at: string
          currency: string | null
          daily_budget: number | null
          funding_display: string | null
          funding_type: string | null
          id: string
          last_sync_attempt_at: string | null
          last_sync_error: string | null
          last_sync_error_code: number | null
          last_sync_success_at: string | null
          metadata: Json
          min_spend_threshold: number
          name: string
          oauth_checked_at: string | null
          oauth_health_status: string
          oauth_permissions: Json
          provider_account_id: string | null
          rd_fields_last_discovered_at: string | null
          remaining_balance: number | null
          target_cpl: number | null
          timezone_name: string | null
          timezone_offset_hours_utc: number | null
          updated_at: string
          user_id: string
          workspace_id: string | null
        }
        Insert: {
          access_token: string
          account_id: string
          attribution_window?: string
          business_unit_id?: string | null
          connection_status?: string
          created_at?: string
          currency?: string | null
          daily_budget?: number | null
          funding_display?: string | null
          funding_type?: string | null
          id?: string
          last_sync_attempt_at?: string | null
          last_sync_error?: string | null
          last_sync_error_code?: number | null
          last_sync_success_at?: string | null
          metadata?: Json
          min_spend_threshold?: number
          name: string
          oauth_checked_at?: string | null
          oauth_health_status?: string
          oauth_permissions?: Json
          provider_account_id?: string | null
          rd_fields_last_discovered_at?: string | null
          remaining_balance?: number | null
          target_cpl?: number | null
          timezone_name?: string | null
          timezone_offset_hours_utc?: number | null
          updated_at?: string
          user_id: string
          workspace_id?: string | null
        }
        Update: {
          access_token?: string
          account_id?: string
          attribution_window?: string
          business_unit_id?: string | null
          connection_status?: string
          created_at?: string
          currency?: string | null
          daily_budget?: number | null
          funding_display?: string | null
          funding_type?: string | null
          id?: string
          last_sync_attempt_at?: string | null
          last_sync_error?: string | null
          last_sync_error_code?: number | null
          last_sync_success_at?: string | null
          metadata?: Json
          min_spend_threshold?: number
          name?: string
          oauth_checked_at?: string | null
          oauth_health_status?: string
          oauth_permissions?: Json
          provider_account_id?: string | null
          rd_fields_last_discovered_at?: string | null
          remaining_balance?: number | null
          target_cpl?: number | null
          timezone_name?: string | null
          timezone_offset_hours_utc?: number | null
          updated_at?: string
          user_id?: string
          workspace_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ad_accounts_business_unit_id_fkey"
            columns: ["business_unit_id"]
            isOneToOne: false
            referencedRelation: "business_units"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ad_accounts_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      ad_metrics: {
        Row: {
          account_id: string | null
          clicks: number | null
          created_at: string | null
          id: string
          impressions: number | null
          leads: number | null
          metric_date: string | null
          provider: string
          purchases: number | null
          revenue: number | null
          spend: number | null
          user_id: string | null
        }
        Insert: {
          account_id?: string | null
          clicks?: number | null
          created_at?: string | null
          id?: string
          impressions?: number | null
          leads?: number | null
          metric_date?: string | null
          provider: string
          purchases?: number | null
          revenue?: number | null
          spend?: number | null
          user_id?: string | null
        }
        Update: {
          account_id?: string | null
          clicks?: number | null
          created_at?: string | null
          id?: string
          impressions?: number | null
          leads?: number | null
          metric_date?: string | null
          provider?: string
          purchases?: number | null
          revenue?: number | null
          spend?: number | null
          user_id?: string | null
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
      budget_pacing_alerts: {
        Row: {
          ad_account_id: string
          alert_key: string
          details: Json
          first_seen_at: string
          id: string
          last_seen_at: string
          message: string
          resolved_at: string | null
          severity: string
          status: string
          workspace_id: string
        }
        Insert: {
          ad_account_id: string
          alert_key: string
          details?: Json
          first_seen_at?: string
          id?: string
          last_seen_at?: string
          message: string
          resolved_at?: string | null
          severity: string
          status?: string
          workspace_id: string
        }
        Update: {
          ad_account_id?: string
          alert_key?: string
          details?: Json
          first_seen_at?: string
          id?: string
          last_seen_at?: string
          message?: string
          resolved_at?: string | null
          severity?: string
          status?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "budget_pacing_alerts_ad_account_id_fkey"
            columns: ["ad_account_id"]
            isOneToOne: false
            referencedRelation: "ad_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "budget_pacing_alerts_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      budget_pacing_snapshots: {
        Row: {
          account_timezone: string
          ad_account_id: string
          captured_at: string
          daily_budget: number
          expected_spend: number
          id: string
          metadata: Json
          pacing_ratio: number | null
          projected_spend: number | null
          spend_today: number
          workspace_id: string
        }
        Insert: {
          account_timezone: string
          ad_account_id: string
          captured_at: string
          daily_budget?: number
          expected_spend?: number
          id?: string
          metadata?: Json
          pacing_ratio?: number | null
          projected_spend?: number | null
          spend_today?: number
          workspace_id: string
        }
        Update: {
          account_timezone?: string
          ad_account_id?: string
          captured_at?: string
          daily_budget?: number
          expected_spend?: number
          id?: string
          metadata?: Json
          pacing_ratio?: number | null
          projected_spend?: number | null
          spend_today?: number
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "budget_pacing_snapshots_ad_account_id_fkey"
            columns: ["ad_account_id"]
            isOneToOne: false
            referencedRelation: "ad_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "budget_pacing_snapshots_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      business_units: {
        Row: {
          created_at: string
          id: string
          is_active: boolean
          kind: string
          name: string
          updated_at: string
          workspace_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean
          kind: string
          name: string
          updated_at?: string
          workspace_id: string
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean
          kind?: string
          name?: string
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "business_units_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      campaign_change_snapshots: {
        Row: {
          actor_id: string | null
          after_state: Json
          before_state: Json
          created_at: string
          draft_id: string | null
          entity_external_id: string
          entity_type: string
          external_request_id: string | null
          id: string
          reason: string | null
          rollback_of: string | null
          workspace_id: string
        }
        Insert: {
          actor_id?: string | null
          after_state?: Json
          before_state?: Json
          created_at?: string
          draft_id?: string | null
          entity_external_id: string
          entity_type: string
          external_request_id?: string | null
          id?: string
          reason?: string | null
          rollback_of?: string | null
          workspace_id: string
        }
        Update: {
          actor_id?: string | null
          after_state?: Json
          before_state?: Json
          created_at?: string
          draft_id?: string | null
          entity_external_id?: string
          entity_type?: string
          external_request_id?: string | null
          id?: string
          reason?: string | null
          rollback_of?: string | null
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "campaign_change_snapshots_draft_id_fkey"
            columns: ["draft_id"]
            isOneToOne: false
            referencedRelation: "campaign_drafts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "campaign_change_snapshots_rollback_of_fkey"
            columns: ["rollback_of"]
            isOneToOne: false
            referencedRelation: "campaign_change_snapshots"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "campaign_change_snapshots_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
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
      campaign_drafts: {
        Row: {
          action: string
          ad_account_id: string | null
          approved_by: string | null
          business_unit_id: string | null
          created_at: string
          created_by: string | null
          entity_external_id: string | null
          entity_type: string
          external_request_id: string | null
          id: string
          payload: Json
          published_at: string | null
          status: string
          updated_at: string
          validation_result: Json
          workspace_id: string
        }
        Insert: {
          action: string
          ad_account_id?: string | null
          approved_by?: string | null
          business_unit_id?: string | null
          created_at?: string
          created_by?: string | null
          entity_external_id?: string | null
          entity_type: string
          external_request_id?: string | null
          id?: string
          payload?: Json
          published_at?: string | null
          status?: string
          updated_at?: string
          validation_result?: Json
          workspace_id: string
        }
        Update: {
          action?: string
          ad_account_id?: string | null
          approved_by?: string | null
          business_unit_id?: string | null
          created_at?: string
          created_by?: string | null
          entity_external_id?: string | null
          entity_type?: string
          external_request_id?: string | null
          id?: string
          payload?: Json
          published_at?: string | null
          status?: string
          updated_at?: string
          validation_result?: Json
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "campaign_drafts_ad_account_id_fkey"
            columns: ["ad_account_id"]
            isOneToOne: false
            referencedRelation: "ad_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "campaign_drafts_business_unit_id_fkey"
            columns: ["business_unit_id"]
            isOneToOne: false
            referencedRelation: "business_units"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "campaign_drafts_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
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
          daily_budget: number | null
          id: string
          last_activated_at: string | null
          lifetime_budget: number | null
          name: string
          objective: string | null
          previous_status: string | null
          status: string | null
          updated_at: string
        }
        Insert: {
          ad_account_id: string
          created_at?: string
          daily_budget?: number | null
          id: string
          last_activated_at?: string | null
          lifetime_budget?: number | null
          name: string
          objective?: string | null
          previous_status?: string | null
          status?: string | null
          updated_at?: string
        }
        Update: {
          ad_account_id?: string
          created_at?: string
          daily_budget?: number | null
          id?: string
          last_activated_at?: string | null
          lifetime_budget?: number | null
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
      companies: {
        Row: {
          business_unit_id: string | null
          created_at: string
          expert_name: string | null
          id: string
          legal_name: string | null
          metadata: Json
          name: string
          status: string
          tax_id: string | null
          updated_at: string
          workspace_id: string
        }
        Insert: {
          business_unit_id?: string | null
          created_at?: string
          expert_name?: string | null
          id?: string
          legal_name?: string | null
          metadata?: Json
          name: string
          status?: string
          tax_id?: string | null
          updated_at?: string
          workspace_id: string
        }
        Update: {
          business_unit_id?: string | null
          created_at?: string
          expert_name?: string | null
          id?: string
          legal_name?: string | null
          metadata?: Json
          name?: string
          status?: string
          tax_id?: string | null
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "companies_business_unit_id_fkey"
            columns: ["business_unit_id"]
            isOneToOne: false
            referencedRelation: "business_units"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "companies_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
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
      Dashboard: {
        Row: {
          created_at: string
          id: number
        }
        Insert: {
          created_at?: string
          id?: number
        }
        Update: {
          created_at?: string
          id?: number
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
      financial_accounts: {
        Row: {
          account_type: string
          balance: number | null
          business_unit_id: string | null
          company_id: string | null
          consent_expires_at: string | null
          created_at: string
          currency: string
          external_id: string | null
          id: string
          institution_name: string | null
          last_four: string | null
          last_synced_at: string | null
          metadata: Json
          name: string
          provider: string | null
          status: string
          updated_at: string
          workspace_id: string
        }
        Insert: {
          account_type: string
          balance?: number | null
          business_unit_id?: string | null
          company_id?: string | null
          consent_expires_at?: string | null
          created_at?: string
          currency?: string
          external_id?: string | null
          id?: string
          institution_name?: string | null
          last_four?: string | null
          last_synced_at?: string | null
          metadata?: Json
          name: string
          provider?: string | null
          status?: string
          updated_at?: string
          workspace_id: string
        }
        Update: {
          account_type?: string
          balance?: number | null
          business_unit_id?: string | null
          company_id?: string | null
          consent_expires_at?: string | null
          created_at?: string
          currency?: string
          external_id?: string | null
          id?: string
          institution_name?: string | null
          last_four?: string | null
          last_synced_at?: string | null
          metadata?: Json
          name?: string
          provider?: string | null
          status?: string
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "financial_accounts_business_unit_id_fkey"
            columns: ["business_unit_id"]
            isOneToOne: false
            referencedRelation: "business_units"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "financial_accounts_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "financial_accounts_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      financial_categories: {
        Row: {
          color: string
          created_at: string
          entry_type: string
          id: string
          is_active: boolean
          name: string
          workspace_id: string
        }
        Insert: {
          color?: string
          created_at?: string
          entry_type: string
          id?: string
          is_active?: boolean
          name: string
          workspace_id: string
        }
        Update: {
          color?: string
          created_at?: string
          entry_type?: string
          id?: string
          is_active?: boolean
          name?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "financial_categories_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      financial_entries: {
        Row: {
          amount: number
          business_unit_id: string | null
          category_id: string | null
          competence_date: string
          created_at: string
          description: string
          due_date: string | null
          entry_type: string
          id: string
          notes: string | null
          paid_at: string | null
          recurrence: string
          status: string
          updated_at: string
          user_id: string
          workspace_id: string
        }
        Insert: {
          amount: number
          business_unit_id?: string | null
          category_id?: string | null
          competence_date?: string
          created_at?: string
          description: string
          due_date?: string | null
          entry_type: string
          id?: string
          notes?: string | null
          paid_at?: string | null
          recurrence?: string
          status?: string
          updated_at?: string
          user_id: string
          workspace_id: string
        }
        Update: {
          amount?: number
          business_unit_id?: string | null
          category_id?: string | null
          competence_date?: string
          created_at?: string
          description?: string
          due_date?: string | null
          entry_type?: string
          id?: string
          notes?: string | null
          paid_at?: string | null
          recurrence?: string
          status?: string
          updated_at?: string
          user_id?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "financial_entries_business_unit_id_fkey"
            columns: ["business_unit_id"]
            isOneToOne: false
            referencedRelation: "business_units"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "financial_entries_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "financial_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "financial_entries_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      financial_transactions: {
        Row: {
          amount: number
          business_unit_id: string | null
          category: string | null
          created_at: string
          description: string
          external_id: string
          financial_account_id: string
          id: string
          match_confidence: number | null
          matched_entry_id: string | null
          metadata: Json
          occurred_at: string
          transaction_type: string
          updated_at: string
          workspace_id: string
        }
        Insert: {
          amount: number
          business_unit_id?: string | null
          category?: string | null
          created_at?: string
          description: string
          external_id: string
          financial_account_id: string
          id?: string
          match_confidence?: number | null
          matched_entry_id?: string | null
          metadata?: Json
          occurred_at: string
          transaction_type: string
          updated_at?: string
          workspace_id: string
        }
        Update: {
          amount?: number
          business_unit_id?: string | null
          category?: string | null
          created_at?: string
          description?: string
          external_id?: string
          financial_account_id?: string
          id?: string
          match_confidence?: number | null
          matched_entry_id?: string | null
          metadata?: Json
          occurred_at?: string
          transaction_type?: string
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "financial_transactions_business_unit_id_fkey"
            columns: ["business_unit_id"]
            isOneToOne: false
            referencedRelation: "business_units"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "financial_transactions_financial_account_id_fkey"
            columns: ["financial_account_id"]
            isOneToOne: false
            referencedRelation: "financial_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "financial_transactions_matched_entry_id_fkey"
            columns: ["matched_entry_id"]
            isOneToOne: false
            referencedRelation: "financial_entries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "financial_transactions_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
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
          account_id: string | null
          account_name: string | null
          action_values: Json
          actions: Json
          ad_account_id: string | null
          ad_id: string | null
          ad_name: string | null
          adset_id: string | null
          adset_name: string | null
          campaign_id: string | null
          campaign_name: string | null
          clicks: number | null
          conversion_rate: number | null
          cpc: number
          cpl: number | null
          cpm: number | null
          created_at: string
          ctr: number | null
          currency: string | null
          date: string
          date_start: string | null
          date_stop: string | null
          dedupe_key: string | null
          efficiency_rate: number | null
          frequency: number | null
          health_score: number | null
          id: string
          impressions: number | null
          inline_link_clicks: number
          last_synced_at: string | null
          leads: number | null
          level: string
          purchase_roas: Json
          raw_payload: Json | null
          reach: number | null
          spend: number | null
          sync_error: string | null
          sync_status: string
          timezone_name: string | null
          unique_inline_link_clicks: number
          updated_at: string
        }
        Insert: {
          account_id?: string | null
          account_name?: string | null
          action_values?: Json
          actions?: Json
          ad_account_id?: string | null
          ad_id?: string | null
          ad_name?: string | null
          adset_id?: string | null
          adset_name?: string | null
          campaign_id?: string | null
          campaign_name?: string | null
          clicks?: number | null
          conversion_rate?: number | null
          cpc?: number
          cpl?: number | null
          cpm?: number | null
          created_at?: string
          ctr?: number | null
          currency?: string | null
          date: string
          date_start?: string | null
          date_stop?: string | null
          dedupe_key?: string | null
          efficiency_rate?: number | null
          frequency?: number | null
          health_score?: number | null
          id?: string
          impressions?: number | null
          inline_link_clicks?: number
          last_synced_at?: string | null
          leads?: number | null
          level?: string
          purchase_roas?: Json
          raw_payload?: Json | null
          reach?: number | null
          spend?: number | null
          sync_error?: string | null
          sync_status?: string
          timezone_name?: string | null
          unique_inline_link_clicks?: number
          updated_at?: string
        }
        Update: {
          account_id?: string | null
          account_name?: string | null
          action_values?: Json
          actions?: Json
          ad_account_id?: string | null
          ad_id?: string | null
          ad_name?: string | null
          adset_id?: string | null
          adset_name?: string | null
          campaign_id?: string | null
          campaign_name?: string | null
          clicks?: number | null
          conversion_rate?: number | null
          cpc?: number
          cpl?: number | null
          cpm?: number | null
          created_at?: string
          ctr?: number | null
          currency?: string | null
          date?: string
          date_start?: string | null
          date_stop?: string | null
          dedupe_key?: string | null
          efficiency_rate?: number | null
          frequency?: number | null
          health_score?: number | null
          id?: string
          impressions?: number | null
          inline_link_clicks?: number
          last_synced_at?: string | null
          leads?: number | null
          level?: string
          purchase_roas?: Json
          raw_payload?: Json | null
          reach?: number | null
          spend?: number | null
          sync_error?: string | null
          sync_status?: string
          timezone_name?: string | null
          unique_inline_link_clicks?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "insights_ad_account_id_fkey"
            columns: ["ad_account_id"]
            isOneToOne: false
            referencedRelation: "ad_accounts"
            referencedColumns: ["id"]
          },
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
      instagram_oauth_states: {
        Row: {
          created_at: string
          expires_at: string
          state_hash: string
          user_id: string
        }
        Insert: {
          created_at?: string
          expires_at: string
          state_hash: string
          user_id: string
        }
        Update: {
          created_at?: string
          expires_at?: string
          state_hash?: string
          user_id?: string
        }
        Relationships: []
      }
      integrations: {
        Row: {
          api_token: string | null
          created_at: string
          id: string
          is_active: boolean | null
          last_health_error: string | null
          last_permission_check_at: string | null
          permission_health: string
          provider: string
          provider_account_id: string | null
          token_expires_at: string | null
          updated_at: string
          user_id: string
          webhook_secret: string | null
        }
        Insert: {
          api_token?: string | null
          created_at?: string
          id?: string
          is_active?: boolean | null
          last_health_error?: string | null
          last_permission_check_at?: string | null
          permission_health?: string
          provider?: string
          provider_account_id?: string | null
          token_expires_at?: string | null
          updated_at?: string
          user_id: string
          webhook_secret?: string | null
        }
        Update: {
          api_token?: string | null
          created_at?: string
          id?: string
          is_active?: boolean | null
          last_health_error?: string | null
          last_permission_check_at?: string | null
          permission_health?: string
          provider?: string
          provider_account_id?: string | null
          token_expires_at?: string | null
          updated_at?: string
          user_id?: string
          webhook_secret?: string | null
        }
        Relationships: []
      }
      intelligence_agent_configs: {
        Row: {
          ad_account_id: string | null
          business_unit_id: string | null
          config: Json
          created_at: string
          funnel_stage: string | null
          id: string
          last_run_at: string | null
          name: string
          objective: string | null
          owner_id: string | null
          specialty: string
          status: string
          updated_at: string
          workspace_id: string
        }
        Insert: {
          ad_account_id?: string | null
          business_unit_id?: string | null
          config?: Json
          created_at?: string
          funnel_stage?: string | null
          id?: string
          last_run_at?: string | null
          name: string
          objective?: string | null
          owner_id?: string | null
          specialty: string
          status?: string
          updated_at?: string
          workspace_id: string
        }
        Update: {
          ad_account_id?: string | null
          business_unit_id?: string | null
          config?: Json
          created_at?: string
          funnel_stage?: string | null
          id?: string
          last_run_at?: string | null
          name?: string
          objective?: string | null
          owner_id?: string | null
          specialty?: string
          status?: string
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "intelligence_agent_configs_ad_account_id_fkey"
            columns: ["ad_account_id"]
            isOneToOne: false
            referencedRelation: "ad_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "intelligence_agent_configs_business_unit_id_fkey"
            columns: ["business_unit_id"]
            isOneToOne: false
            referencedRelation: "business_units"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "intelligence_agent_configs_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      intelligence_snapshots: {
        Row: {
          account_timezone: string
          ad_account_id: string | null
          anomalies: Json
          attribution_window: string
          business_unit_id: string | null
          executive_summary: string | null
          forecast: Json
          generated_at: string
          id: string
          model: string | null
          snapshot_date: string
          source_freshness: Json
          unified_metrics: Json
          workspace_id: string
        }
        Insert: {
          account_timezone?: string
          ad_account_id?: string | null
          anomalies?: Json
          attribution_window?: string
          business_unit_id?: string | null
          executive_summary?: string | null
          forecast?: Json
          generated_at?: string
          id?: string
          model?: string | null
          snapshot_date: string
          source_freshness?: Json
          unified_metrics?: Json
          workspace_id: string
        }
        Update: {
          account_timezone?: string
          ad_account_id?: string | null
          anomalies?: Json
          attribution_window?: string
          business_unit_id?: string | null
          executive_summary?: string | null
          forecast?: Json
          generated_at?: string
          id?: string
          model?: string | null
          snapshot_date?: string
          source_freshness?: Json
          unified_metrics?: Json
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "intelligence_snapshots_ad_account_id_fkey"
            columns: ["ad_account_id"]
            isOneToOne: false
            referencedRelation: "ad_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "intelligence_snapshots_business_unit_id_fkey"
            columns: ["business_unit_id"]
            isOneToOne: false
            referencedRelation: "business_units"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "intelligence_snapshots_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      job_runs: {
        Row: {
          created_at: string
          error_message: string | null
          finished_at: string | null
          id: string
          job_name: string
          metadata: Json | null
          processed_count: number
          started_at: string
          status: string
          trigger_source: string
        }
        Insert: {
          created_at?: string
          error_message?: string | null
          finished_at?: string | null
          id?: string
          job_name: string
          metadata?: Json | null
          processed_count?: number
          started_at?: string
          status?: string
          trigger_source?: string
        }
        Update: {
          created_at?: string
          error_message?: string | null
          finished_at?: string | null
          id?: string
          job_name?: string
          metadata?: Json | null
          processed_count?: number
          started_at?: string
          status?: string
          trigger_source?: string
        }
        Relationships: []
      }
      meta_breakdown_insights: {
        Row: {
          ad_account_id: string
          attribution_window: string
          breakdown_key: string
          breakdown_type: string
          clicks: number
          conversions: number
          entity_external_id: string
          entity_level: string
          id: string
          impressions: number
          insight_date: string
          leads: number
          metrics: Json
          reach: number
          revenue: number
          spend: number
          synced_at: string
          workspace_id: string
        }
        Insert: {
          ad_account_id: string
          attribution_window?: string
          breakdown_key: string
          breakdown_type: string
          clicks?: number
          conversions?: number
          entity_external_id: string
          entity_level: string
          id?: string
          impressions?: number
          insight_date: string
          leads?: number
          metrics?: Json
          reach?: number
          revenue?: number
          spend?: number
          synced_at?: string
          workspace_id: string
        }
        Update: {
          ad_account_id?: string
          attribution_window?: string
          breakdown_key?: string
          breakdown_type?: string
          clicks?: number
          conversions?: number
          entity_external_id?: string
          entity_level?: string
          id?: string
          impressions?: number
          insight_date?: string
          leads?: number
          metrics?: Json
          reach?: number
          revenue?: number
          spend?: number
          synced_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "meta_breakdown_insights_ad_account_id_fkey"
            columns: ["ad_account_id"]
            isOneToOne: false
            referencedRelation: "ad_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "meta_breakdown_insights_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      meta_leads: {
        Row: {
          ad_account_id: string
          ad_id: string | null
          adset_id: string | null
          campaign_id: string | null
          created_at: string
          created_time: string
          email: string | null
          field_data: Json | null
          form_id: string | null
          full_name: string | null
          id: string
          lead_city: string | null
          lead_state: string | null
          lead_state_source: string | null
          meta_lead_id: string
          phone: string | null
          raw: Json | null
        }
        Insert: {
          ad_account_id: string
          ad_id?: string | null
          adset_id?: string | null
          campaign_id?: string | null
          created_at?: string
          created_time: string
          email?: string | null
          field_data?: Json | null
          form_id?: string | null
          full_name?: string | null
          id?: string
          lead_city?: string | null
          lead_state?: string | null
          lead_state_source?: string | null
          meta_lead_id: string
          phone?: string | null
          raw?: Json | null
        }
        Update: {
          ad_account_id?: string
          ad_id?: string | null
          adset_id?: string | null
          campaign_id?: string | null
          created_at?: string
          created_time?: string
          email?: string | null
          field_data?: Json | null
          form_id?: string | null
          full_name?: string | null
          id?: string
          lead_city?: string | null
          lead_state?: string | null
          lead_state_source?: string | null
          meta_lead_id?: string
          phone?: string | null
          raw?: Json | null
        }
        Relationships: []
      }
      meta_oauth_states: {
        Row: {
          created_at: string
          expires_at: string
          state_hash: string
          user_id: string
        }
        Insert: {
          created_at?: string
          expires_at: string
          state_hash: string
          user_id: string
        }
        Update: {
          created_at?: string
          expires_at?: string
          state_hash?: string
          user_id?: string
        }
        Relationships: []
      }
      meta_video_insights: {
        Row: {
          ad_account_id: string
          ad_external_id: string
          attribution_window: string
          avg_watch_time_seconds: number | null
          cost_per_thruplay: number | null
          id: string
          insight_date: string
          metrics: Json
          synced_at: string
          thruplay: number
          video_100: number
          video_25: number
          video_3s: number
          video_50: number
          video_75: number
          video_95: number
          video_plays: number
          workspace_id: string
        }
        Insert: {
          ad_account_id: string
          ad_external_id: string
          attribution_window?: string
          avg_watch_time_seconds?: number | null
          cost_per_thruplay?: number | null
          id?: string
          insight_date: string
          metrics?: Json
          synced_at?: string
          thruplay?: number
          video_100?: number
          video_25?: number
          video_3s?: number
          video_50?: number
          video_75?: number
          video_95?: number
          video_plays?: number
          workspace_id: string
        }
        Update: {
          ad_account_id?: string
          ad_external_id?: string
          attribution_window?: string
          avg_watch_time_seconds?: number | null
          cost_per_thruplay?: number | null
          id?: string
          insight_date?: string
          metrics?: Json
          synced_at?: string
          thruplay?: number
          video_100?: number
          video_25?: number
          video_3s?: number
          video_50?: number
          video_75?: number
          video_95?: number
          video_plays?: number
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "meta_video_insights_ad_account_id_fkey"
            columns: ["ad_account_id"]
            isOneToOne: false
            referencedRelation: "ad_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "meta_video_insights_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      oauth_health_events: {
        Row: {
          ad_account_id: string | null
          checked_at: string
          created_at: string
          details: Json
          id: string
          integration_id: string | null
          missing_permissions: Json
          provider: string
          status: string
          workspace_id: string
        }
        Insert: {
          ad_account_id?: string | null
          checked_at?: string
          created_at?: string
          details?: Json
          id?: string
          integration_id?: string | null
          missing_permissions?: Json
          provider: string
          status: string
          workspace_id: string
        }
        Update: {
          ad_account_id?: string | null
          checked_at?: string
          created_at?: string
          details?: Json
          id?: string
          integration_id?: string | null
          missing_permissions?: Json
          provider?: string
          status?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "oauth_health_events_ad_account_id_fkey"
            columns: ["ad_account_id"]
            isOneToOne: false
            referencedRelation: "ad_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "oauth_health_events_integration_id_fkey"
            columns: ["integration_id"]
            isOneToOne: false
            referencedRelation: "integrations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "oauth_health_events_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
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
      plan_catalog: {
        Row: {
          code: string
          description: string
          entitlements: Json
          is_active: boolean
          monthly_price: number
          name: string
          sort_order: number
        }
        Insert: {
          code: string
          description: string
          entitlements?: Json
          is_active?: boolean
          monthly_price: number
          name: string
          sort_order?: number
        }
        Update: {
          code?: string
          description?: string
          entitlements?: Json
          is_active?: boolean
          monthly_price?: number
          name?: string
          sort_order?: number
        }
        Relationships: []
      }
      platform_announcements: {
        Row: {
          active: boolean
          alt: string
          created_at: string
          created_by: string | null
          dismissible: boolean
          ends_at: string | null
          id: string
          image_data_url: string
          link_url: string | null
          priority: number
          starts_at: string
          target_paths: string[]
          title: string | null
          updated_at: string
        }
        Insert: {
          active?: boolean
          alt?: string
          created_at?: string
          created_by?: string | null
          dismissible?: boolean
          ends_at?: string | null
          id?: string
          image_data_url: string
          link_url?: string | null
          priority?: number
          starts_at?: string
          target_paths?: string[]
          title?: string | null
          updated_at?: string
        }
        Update: {
          active?: boolean
          alt?: string
          created_at?: string
          created_by?: string | null
          dismissible?: boolean
          ends_at?: string | null
          id?: string
          image_data_url?: string
          link_url?: string | null
          priority?: number
          starts_at?: string
          target_paths?: string[]
          title?: string | null
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
          avatar_url: string | null
          created_at: string
          density: string
          email: string | null
          email_alerts_enabled: boolean | null
          full_name: string | null
          gender: string | null
          id: string
          job_title: string | null
          lp_lead_action: string | null
          notification_preferences: Json
          phone: string | null
          theme: string
          updated_at: string
          user_id: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          density?: string
          email?: string | null
          email_alerts_enabled?: boolean | null
          full_name?: string | null
          gender?: string | null
          id?: string
          job_title?: string | null
          lp_lead_action?: string | null
          notification_preferences?: Json
          phone?: string | null
          theme?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          density?: string
          email?: string | null
          email_alerts_enabled?: boolean | null
          full_name?: string | null
          gender?: string | null
          id?: string
          job_title?: string | null
          lp_lead_action?: string | null
          notification_preferences?: Json
          phone?: string | null
          theme?: string
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
          amount_monthly: number | null
          amount_total: number | null
          amount_total_effective: number | null
          amount_total_manual: number | null
          amount_total_original: number | null
          amount_unique: number | null
          campaign: string | null
          closed_at: string | null
          contact_email: string | null
          contact_name: string | null
          contact_phone: string | null
          created_at: string
          created_at_rd: string | null
          custom_fields: Json
          deal_owner_name: string | null
          deal_pipeline_id: string | null
          deal_pipeline_name: string | null
          deal_stage_id: string | null
          deal_stage_name: string | null
          deal_status: string | null
          first_touch_utm_campaign: string | null
          id: string
          integration_id: string | null
          last_synced_at: string | null
          last_touch_utm_campaign: string | null
          lead_city: string | null
          lead_created_at: string | null
          lead_state: string | null
          lead_state_source: string | null
          lost: boolean
          lost_reason: string | null
          manual_override_at: string | null
          manual_override_by: string | null
          manual_override_enabled: boolean
          manual_override_reason: string | null
          name: string | null
          owner_id: string | null
          owner_name: string | null
          raw: Json | null
          raw_payload: Json | null
          rd_deal_id: string
          rd_funnel_id: string
          rd_product_name: string | null
          rd_stage_id: string | null
          rd_stage_name: string | null
          rd_stage_order: number | null
          source: string | null
          stage_bucket: string
          stage_updated_at: string | null
          touch_count: number
          updated_at: string
          updated_at_rd: string | null
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
          amount_monthly?: number | null
          amount_total?: number | null
          amount_total_effective?: number | null
          amount_total_manual?: number | null
          amount_total_original?: number | null
          amount_unique?: number | null
          campaign?: string | null
          closed_at?: string | null
          contact_email?: string | null
          contact_name?: string | null
          contact_phone?: string | null
          created_at?: string
          created_at_rd?: string | null
          custom_fields?: Json
          deal_owner_name?: string | null
          deal_pipeline_id?: string | null
          deal_pipeline_name?: string | null
          deal_stage_id?: string | null
          deal_stage_name?: string | null
          deal_status?: string | null
          first_touch_utm_campaign?: string | null
          id?: string
          integration_id?: string | null
          last_synced_at?: string | null
          last_touch_utm_campaign?: string | null
          lead_city?: string | null
          lead_created_at?: string | null
          lead_state?: string | null
          lead_state_source?: string | null
          lost?: boolean
          lost_reason?: string | null
          manual_override_at?: string | null
          manual_override_by?: string | null
          manual_override_enabled?: boolean
          manual_override_reason?: string | null
          name?: string | null
          owner_id?: string | null
          owner_name?: string | null
          raw?: Json | null
          raw_payload?: Json | null
          rd_deal_id: string
          rd_funnel_id: string
          rd_product_name?: string | null
          rd_stage_id?: string | null
          rd_stage_name?: string | null
          rd_stage_order?: number | null
          source?: string | null
          stage_bucket?: string
          stage_updated_at?: string | null
          touch_count?: number
          updated_at?: string
          updated_at_rd?: string | null
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
          amount_monthly?: number | null
          amount_total?: number | null
          amount_total_effective?: number | null
          amount_total_manual?: number | null
          amount_total_original?: number | null
          amount_unique?: number | null
          campaign?: string | null
          closed_at?: string | null
          contact_email?: string | null
          contact_name?: string | null
          contact_phone?: string | null
          created_at?: string
          created_at_rd?: string | null
          custom_fields?: Json
          deal_owner_name?: string | null
          deal_pipeline_id?: string | null
          deal_pipeline_name?: string | null
          deal_stage_id?: string | null
          deal_stage_name?: string | null
          deal_status?: string | null
          first_touch_utm_campaign?: string | null
          id?: string
          integration_id?: string | null
          last_synced_at?: string | null
          last_touch_utm_campaign?: string | null
          lead_city?: string | null
          lead_created_at?: string | null
          lead_state?: string | null
          lead_state_source?: string | null
          lost?: boolean
          lost_reason?: string | null
          manual_override_at?: string | null
          manual_override_by?: string | null
          manual_override_enabled?: boolean
          manual_override_reason?: string | null
          name?: string | null
          owner_id?: string | null
          owner_name?: string | null
          raw?: Json | null
          raw_payload?: Json | null
          rd_deal_id?: string
          rd_funnel_id?: string
          rd_product_name?: string | null
          rd_stage_id?: string | null
          rd_stage_name?: string | null
          rd_stage_order?: number | null
          source?: string | null
          stage_bucket?: string
          stage_updated_at?: string | null
          touch_count?: number
          updated_at?: string
          updated_at_rd?: string | null
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
      rd_field_configs: {
        Row: {
          ad_account_id: string
          created_at: string
          field_type: string
          id: string
          key: string
          label: string
          options: Json
          rd_field_aliases: string[]
          rd_field_label: string
          rd_source: string
          show_in_dashboard: boolean
          updated_at: string
          user_id: string
        }
        Insert: {
          ad_account_id: string
          created_at?: string
          field_type?: string
          id?: string
          key: string
          label: string
          options?: Json
          rd_field_aliases?: string[]
          rd_field_label: string
          rd_source?: string
          show_in_dashboard?: boolean
          updated_at?: string
          user_id: string
        }
        Update: {
          ad_account_id?: string
          created_at?: string
          field_type?: string
          id?: string
          key?: string
          label?: string
          options?: Json
          rd_field_aliases?: string[]
          rd_field_label?: string
          rd_source?: string
          show_in_dashboard?: boolean
          updated_at?: string
          user_id?: string
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
      rd_metrics: {
        Row: {
          created_at: string | null
          id: string
          leads: number | null
          metric_date: string | null
          opportunities: number | null
          revenue: number | null
          sales: number | null
          user_id: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          leads?: number | null
          metric_date?: string | null
          opportunities?: number | null
          revenue?: number | null
          sales?: number | null
          user_id?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          leads?: number | null
          metric_date?: string | null
          opportunities?: number | null
          revenue?: number | null
          sales?: number | null
          user_id?: string | null
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
      reconciliation_items: {
        Row: {
          confidence: number | null
          created_at: string
          evidence: Json
          id: string
          meta_lead_id: string | null
          rd_lead_id: string | null
          run_id: string
          sale_id: string | null
          status: string
          workspace_id: string
        }
        Insert: {
          confidence?: number | null
          created_at?: string
          evidence?: Json
          id?: string
          meta_lead_id?: string | null
          rd_lead_id?: string | null
          run_id: string
          sale_id?: string | null
          status: string
          workspace_id: string
        }
        Update: {
          confidence?: number | null
          created_at?: string
          evidence?: Json
          id?: string
          meta_lead_id?: string | null
          rd_lead_id?: string | null
          run_id?: string
          sale_id?: string | null
          status?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "reconciliation_items_run_id_fkey"
            columns: ["run_id"]
            isOneToOne: false
            referencedRelation: "reconciliation_runs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reconciliation_items_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      reconciliation_runs: {
        Row: {
          business_unit_id: string | null
          created_at: string
          finished_at: string | null
          id: string
          period_end: string
          period_start: string
          started_at: string | null
          started_by: string | null
          status: string
          summary: Json
          workspace_id: string
        }
        Insert: {
          business_unit_id?: string | null
          created_at?: string
          finished_at?: string | null
          id?: string
          period_end: string
          period_start: string
          started_at?: string | null
          started_by?: string | null
          status?: string
          summary?: Json
          workspace_id: string
        }
        Update: {
          business_unit_id?: string | null
          created_at?: string
          finished_at?: string | null
          id?: string
          period_end?: string
          period_start?: string
          started_at?: string | null
          started_by?: string | null
          status?: string
          summary?: Json
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "reconciliation_runs_business_unit_id_fkey"
            columns: ["business_unit_id"]
            isOneToOne: false
            referencedRelation: "business_units"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reconciliation_runs_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      sales: {
        Row: {
          ad_account_id: string | null
          ad_id: string | null
          adset_id: string | null
          business_unit_id: string | null
          campaign_ids: string[] | null
          chargeback_amount: number | null
          contact_email: string | null
          contact_name: string | null
          contact_phone: string | null
          created_at: string
          custom_fields: Json
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
          payment_method_source: string
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
          workspace_id: string | null
        }
        Insert: {
          ad_account_id?: string | null
          ad_id?: string | null
          adset_id?: string | null
          business_unit_id?: string | null
          campaign_ids?: string[] | null
          chargeback_amount?: number | null
          contact_email?: string | null
          contact_name?: string | null
          contact_phone?: string | null
          created_at?: string
          custom_fields?: Json
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
          payment_method_source?: string
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
          workspace_id?: string | null
        }
        Update: {
          ad_account_id?: string | null
          ad_id?: string | null
          adset_id?: string | null
          business_unit_id?: string | null
          campaign_ids?: string[] | null
          chargeback_amount?: number | null
          contact_email?: string | null
          contact_name?: string | null
          contact_phone?: string | null
          created_at?: string
          custom_fields?: Json
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
          payment_method_source?: string
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
          workspace_id?: string | null
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
            foreignKeyName: "sales_business_unit_id_fkey"
            columns: ["business_unit_id"]
            isOneToOne: false
            referencedRelation: "business_units"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      sales_goals: {
        Row: {
          ad_account_id: string
          business_unit_id: string
          created_at: string
          created_by: string | null
          goal_month: string
          id: string
          target_revenue: number
          updated_at: string
          workspace_id: string
        }
        Insert: {
          ad_account_id: string
          business_unit_id: string
          created_at?: string
          created_by?: string | null
          goal_month: string
          id?: string
          target_revenue: number
          updated_at?: string
          workspace_id: string
        }
        Update: {
          ad_account_id?: string
          business_unit_id?: string
          created_at?: string
          created_by?: string | null
          goal_month?: string
          id?: string
          target_revenue?: number
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "sales_goals_ad_account_id_fkey"
            columns: ["ad_account_id"]
            isOneToOne: false
            referencedRelation: "ad_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_goals_business_unit_id_fkey"
            columns: ["business_unit_id"]
            isOneToOne: false
            referencedRelation: "business_units"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_goals_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      saved_table_views: {
        Row: {
          config: Json
          created_at: string
          id: string
          is_shared: boolean
          name: string
          scope: string
          updated_at: string
          user_id: string
          workspace_id: string
        }
        Insert: {
          config?: Json
          created_at?: string
          id?: string
          is_shared?: boolean
          name: string
          scope: string
          updated_at?: string
          user_id: string
          workspace_id: string
        }
        Update: {
          config?: Json
          created_at?: string
          id?: string
          is_shared?: boolean
          name?: string
          scope?: string
          updated_at?: string
          user_id?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "saved_table_views_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      social_accounts: {
        Row: {
          connection_status: string
          created_at: string
          display_name: string
          followers_count: number
          id: string
          last_error: string | null
          last_sync_at: string | null
          media_count: number
          profile_picture_url: string | null
          provider: string
          provider_account_id: string
          updated_at: string
          user_id: string
          username: string | null
          workspace_id: string | null
        }
        Insert: {
          connection_status?: string
          created_at?: string
          display_name: string
          followers_count?: number
          id?: string
          last_error?: string | null
          last_sync_at?: string | null
          media_count?: number
          profile_picture_url?: string | null
          provider: string
          provider_account_id: string
          updated_at?: string
          user_id: string
          username?: string | null
          workspace_id?: string | null
        }
        Update: {
          connection_status?: string
          created_at?: string
          display_name?: string
          followers_count?: number
          id?: string
          last_error?: string | null
          last_sync_at?: string | null
          media_count?: number
          profile_picture_url?: string | null
          provider?: string
          provider_account_id?: string
          updated_at?: string
          user_id?: string
          username?: string | null
          workspace_id?: string | null
        }
        Relationships: []
      }
      social_insights_daily: {
        Row: {
          follower_delta: number
          followers: number
          id: string
          impressions: number
          insight_date: string
          interactions: number
          profile_views: number
          reach: number
          social_account_id: string
          website_clicks: number
        }
        Insert: {
          follower_delta?: number
          followers?: number
          id?: string
          impressions?: number
          insight_date: string
          interactions?: number
          profile_views?: number
          reach?: number
          social_account_id: string
          website_clicks?: number
        }
        Update: {
          follower_delta?: number
          followers?: number
          id?: string
          impressions?: number
          insight_date?: string
          interactions?: number
          profile_views?: number
          reach?: number
          social_account_id?: string
          website_clicks?: number
        }
        Relationships: [
          {
            foreignKeyName: "social_insights_daily_social_account_id_fkey"
            columns: ["social_account_id"]
            isOneToOne: false
            referencedRelation: "social_accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      social_media: {
        Row: {
          caption: string | null
          comments: number
          engagement_rate: number
          id: string
          impressions: number
          interactions: number
          likes: number
          media_type: string
          media_url: string | null
          permalink: string | null
          provider_media_id: string
          published_at: string | null
          raw_metrics: Json
          reach: number
          saves: number
          shares: number
          social_account_id: string
          synced_at: string
          thumbnail_url: string | null
          video_views: number
        }
        Insert: {
          caption?: string | null
          comments?: number
          engagement_rate?: number
          id?: string
          impressions?: number
          interactions?: number
          likes?: number
          media_type?: string
          media_url?: string | null
          permalink?: string | null
          provider_media_id: string
          published_at?: string | null
          raw_metrics?: Json
          reach?: number
          saves?: number
          shares?: number
          social_account_id: string
          synced_at?: string
          thumbnail_url?: string | null
          video_views?: number
        }
        Update: {
          caption?: string | null
          comments?: number
          engagement_rate?: number
          id?: string
          impressions?: number
          interactions?: number
          likes?: number
          media_type?: string
          media_url?: string | null
          permalink?: string | null
          provider_media_id?: string
          published_at?: string | null
          raw_metrics?: Json
          reach?: number
          saves?: number
          shares?: number
          social_account_id?: string
          synced_at?: string
          thumbnail_url?: string | null
          video_views?: number
        }
        Relationships: [
          {
            foreignKeyName: "social_media_social_account_id_fkey"
            columns: ["social_account_id"]
            isOneToOne: false
            referencedRelation: "social_accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      sync_logs: {
        Row: {
          created_at: string
          error_message: string | null
          error_payload: Json | null
          finished_at: string | null
          id: string
          integration_id: string | null
          metadata: Json
          pages_fetched: number
          provider: string
          records_fetched: number
          records_inserted: number
          records_updated: number
          started_at: string
          status: string
          sync_type: string
          user_id: string | null
        }
        Insert: {
          created_at?: string
          error_message?: string | null
          error_payload?: Json | null
          finished_at?: string | null
          id?: string
          integration_id?: string | null
          metadata?: Json
          pages_fetched?: number
          provider: string
          records_fetched?: number
          records_inserted?: number
          records_updated?: number
          started_at?: string
          status: string
          sync_type: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          error_message?: string | null
          error_payload?: Json | null
          finished_at?: string | null
          id?: string
          integration_id?: string | null
          metadata?: Json
          pages_fetched?: number
          provider?: string
          records_fetched?: number
          records_inserted?: number
          records_updated?: number
          started_at?: string
          status?: string
          sync_type?: string
          user_id?: string | null
        }
        Relationships: []
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
          processed_count: number
          provider: string
          retries_total: number
          skipped_count: number
          started_at: string
          status: string
          total_expected: number | null
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
          processed_count?: number
          provider?: string
          retries_total?: number
          skipped_count?: number
          started_at?: string
          status?: string
          total_expected?: number | null
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
          processed_count?: number
          provider?: string
          retries_total?: number
          skipped_count?: number
          started_at?: string
          status?: string
          total_expected?: number | null
          trigger_source?: string | null
          updated_count?: number
          user_id?: string
        }
        Relationships: []
      }
      traffic_investment_contributions: {
        Row: {
          ad_account_id: string
          amount: number
          business_unit_id: string
          contributed_at: string
          created_at: string
          created_by: string | null
          id: string
          notes: string | null
          plan_id: string | null
          platform: string
          workspace_id: string
        }
        Insert: {
          ad_account_id: string
          amount: number
          business_unit_id: string
          contributed_at: string
          created_at?: string
          created_by?: string | null
          id?: string
          notes?: string | null
          plan_id?: string | null
          platform: string
          workspace_id: string
        }
        Update: {
          ad_account_id?: string
          amount?: number
          business_unit_id?: string
          contributed_at?: string
          created_at?: string
          created_by?: string | null
          id?: string
          notes?: string | null
          plan_id?: string | null
          platform?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "traffic_investment_contributions_ad_account_id_fkey"
            columns: ["ad_account_id"]
            isOneToOne: false
            referencedRelation: "ad_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "traffic_investment_contributions_business_unit_id_fkey"
            columns: ["business_unit_id"]
            isOneToOne: false
            referencedRelation: "business_units"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "traffic_investment_contributions_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "traffic_investment_plans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "traffic_investment_contributions_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      traffic_investment_plans: {
        Row: {
          ad_account_id: string
          business_unit_id: string
          company_id: string | null
          created_at: string
          created_by: string | null
          id: string
          meta_percentage: number
          plan_month: string
          planned_monthly: number
          target_cpl: number | null
          updated_at: string
          workspace_id: string
        }
        Insert: {
          ad_account_id: string
          business_unit_id: string
          company_id?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          meta_percentage?: number
          plan_month: string
          planned_monthly?: number
          target_cpl?: number | null
          updated_at?: string
          workspace_id: string
        }
        Update: {
          ad_account_id?: string
          business_unit_id?: string
          company_id?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          meta_percentage?: number
          plan_month?: string
          planned_monthly?: number
          target_cpl?: number | null
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "traffic_investment_plans_ad_account_id_fkey"
            columns: ["ad_account_id"]
            isOneToOne: false
            referencedRelation: "ad_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "traffic_investment_plans_business_unit_id_fkey"
            columns: ["business_unit_id"]
            isOneToOne: false
            referencedRelation: "business_units"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "traffic_investment_plans_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "traffic_investment_plans_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      traffic_playbooks: {
        Row: {
          business_unit_id: string | null
          config: Json
          created_at: string
          created_by: string | null
          id: string
          name: string
          objective: string
          progress: Json
          status: string
          template_key: string
          updated_at: string
          workspace_id: string
        }
        Insert: {
          business_unit_id?: string | null
          config?: Json
          created_at?: string
          created_by?: string | null
          id?: string
          name: string
          objective: string
          progress?: Json
          status?: string
          template_key: string
          updated_at?: string
          workspace_id: string
        }
        Update: {
          business_unit_id?: string | null
          config?: Json
          created_at?: string
          created_by?: string | null
          id?: string
          name?: string
          objective?: string
          progress?: Json
          status?: string
          template_key?: string
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "traffic_playbooks_business_unit_id_fkey"
            columns: ["business_unit_id"]
            isOneToOne: false
            referencedRelation: "business_units"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "traffic_playbooks_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
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
      webhook_events: {
        Row: {
          created_at: string
          error_message: string | null
          event_type: string | null
          headers: Json
          id: string
          payload: Json
          processed_at: string | null
          provider: string
          source_id: string | null
          status: string
          user_id: string | null
        }
        Insert: {
          created_at?: string
          error_message?: string | null
          event_type?: string | null
          headers?: Json
          id?: string
          payload?: Json
          processed_at?: string | null
          provider: string
          source_id?: string | null
          status?: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          error_message?: string | null
          event_type?: string | null
          headers?: Json
          id?: string
          payload?: Json
          processed_at?: string | null
          provider?: string
          source_id?: string | null
          status?: string
          user_id?: string | null
        }
        Relationships: []
      }
      whatsapp_report_schedules: {
        Row: {
          ad_account_id: string | null
          alert_only: boolean
          business_unit_id: string | null
          created_at: string
          created_by: string | null
          enabled: boolean
          id: string
          include_metrics: string[]
          last_error: string | null
          last_sent_at: string | null
          last_status: string | null
          local_time: string
          name: string
          next_run_at: string | null
          phone_e164: string
          timezone: string
          updated_at: string
          weekdays: number[]
          workspace_id: string
        }
        Insert: {
          ad_account_id?: string | null
          alert_only?: boolean
          business_unit_id?: string | null
          created_at?: string
          created_by?: string | null
          enabled?: boolean
          id?: string
          include_metrics?: string[]
          last_error?: string | null
          last_sent_at?: string | null
          last_status?: string | null
          local_time?: string
          name?: string
          next_run_at?: string | null
          phone_e164: string
          timezone?: string
          updated_at?: string
          weekdays?: number[]
          workspace_id: string
        }
        Update: {
          ad_account_id?: string | null
          alert_only?: boolean
          business_unit_id?: string | null
          created_at?: string
          created_by?: string | null
          enabled?: boolean
          id?: string
          include_metrics?: string[]
          last_error?: string | null
          last_sent_at?: string | null
          last_status?: string | null
          local_time?: string
          name?: string
          next_run_at?: string | null
          phone_e164?: string
          timezone?: string
          updated_at?: string
          weekdays?: number[]
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "whatsapp_report_schedules_ad_account_id_fkey"
            columns: ["ad_account_id"]
            isOneToOne: false
            referencedRelation: "ad_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "whatsapp_report_schedules_business_unit_id_fkey"
            columns: ["business_unit_id"]
            isOneToOne: false
            referencedRelation: "business_units"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "whatsapp_report_schedules_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      workspace_files: {
        Row: {
          bucket_id: string | null
          business_unit_id: string | null
          checksum: string | null
          created_at: string
          deleted_at: string | null
          entity_id: string | null
          entity_type: string | null
          external_url: string | null
          id: string
          metadata: Json
          mime_type: string | null
          module: string
          object_path: string | null
          original_name: string
          owner_id: string | null
          size_bytes: number
          source: string
          status: string
          updated_at: string
          workspace_id: string
        }
        Insert: {
          bucket_id?: string | null
          business_unit_id?: string | null
          checksum?: string | null
          created_at?: string
          deleted_at?: string | null
          entity_id?: string | null
          entity_type?: string | null
          external_url?: string | null
          id?: string
          metadata?: Json
          mime_type?: string | null
          module?: string
          object_path?: string | null
          original_name: string
          owner_id?: string | null
          size_bytes?: number
          source?: string
          status?: string
          updated_at?: string
          workspace_id: string
        }
        Update: {
          bucket_id?: string | null
          business_unit_id?: string | null
          checksum?: string | null
          created_at?: string
          deleted_at?: string | null
          entity_id?: string | null
          entity_type?: string | null
          external_url?: string | null
          id?: string
          metadata?: Json
          mime_type?: string | null
          module?: string
          object_path?: string | null
          original_name?: string
          owner_id?: string | null
          size_bytes?: number
          source?: string
          status?: string
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "workspace_files_business_unit_id_fkey"
            columns: ["business_unit_id"]
            isOneToOne: false
            referencedRelation: "business_units"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "workspace_files_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      workspace_members: {
        Row: {
          created_at: string
          role: string
          status: string
          user_id: string
          workspace_id: string
        }
        Insert: {
          created_at?: string
          role?: string
          status?: string
          user_id: string
          workspace_id: string
        }
        Update: {
          created_at?: string
          role?: string
          status?: string
          user_id?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "workspace_members_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      workspace_subscriptions: {
        Row: {
          created_at: string
          current_period_ends_at: string | null
          plan_code: string
          provider: string | null
          provider_customer_id: string | null
          provider_subscription_id: string | null
          status: string
          trial_ends_at: string | null
          updated_at: string
          workspace_id: string
        }
        Insert: {
          created_at?: string
          current_period_ends_at?: string | null
          plan_code: string
          provider?: string | null
          provider_customer_id?: string | null
          provider_subscription_id?: string | null
          status?: string
          trial_ends_at?: string | null
          updated_at?: string
          workspace_id: string
        }
        Update: {
          created_at?: string
          current_period_ends_at?: string | null
          plan_code?: string
          provider?: string | null
          provider_customer_id?: string | null
          provider_subscription_id?: string | null
          status?: string
          trial_ends_at?: string | null
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "workspace_subscriptions_plan_code_fkey"
            columns: ["plan_code"]
            isOneToOne: false
            referencedRelation: "plan_catalog"
            referencedColumns: ["code"]
          },
          {
            foreignKeyName: "workspace_subscriptions_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: true
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      workspace_usage_monthly: {
        Row: {
          id: string
          metric: string
          period: string
          quantity: number
          updated_at: string
          workspace_id: string
        }
        Insert: {
          id?: string
          metric: string
          period: string
          quantity?: number
          updated_at?: string
          workspace_id: string
        }
        Update: {
          id?: string
          metric?: string
          period?: string
          quantity?: number
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "workspace_usage_monthly_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      workspaces: {
        Row: {
          created_at: string
          currency: string
          id: string
          name: string
          owner_id: string
          slug: string
          timezone: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          currency?: string
          id?: string
          name: string
          owner_id: string
          slug: string
          timezone?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          currency?: string
          id?: string
          name?: string
          owner_id?: string
          slug?: string
          timezone?: string
          updated_at?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      _normalize_uf: { Args: { _raw: string }; Returns: string }
      can_access_workspace_object: {
        Args: { _name: string; _user_id?: string }
        Returns: boolean
      }
      can_manage_finance: {
        Args: { _user_id?: string; _workspace_id: string }
        Returns: boolean
      }
      can_manage_workspace: {
        Args: { _user_id?: string; _workspace_id: string }
        Returns: boolean
      }
      ensure_current_workspace: { Args: never; Returns: string }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      infer_uf_from_phone: { Args: { _phone: string }; Returns: string }
      is_master: { Args: { _user_id: string }; Returns: boolean }
      is_platform_owner: { Args: { _user_id: string }; Returns: boolean }
      is_workspace_member: {
        Args: { _user_id?: string; _workspace_id: string }
        Returns: boolean
      }
      user_can_access_ad: {
        Args: { _ad_id: string; _user_id: string }
        Returns: boolean
      }
      user_can_access_campaign: {
        Args: { _campaign_id: string; _user_id: string }
        Returns: boolean
      }
      user_can_view_ad: {
        Args: { _ad_id: string; _user_id: string }
        Returns: boolean
      }
      user_can_view_ad_account: {
        Args: { _ad_account_id: string; _user_id: string }
        Returns: boolean
      }
      user_can_view_campaign: {
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
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {
      app_role: ["admin", "user", "master", "gestor", "usuario"],
    },
  },
} as const
