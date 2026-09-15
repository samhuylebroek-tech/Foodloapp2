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
      aankopen: {
        Row: {
          bedrag_cent: number
          created_at: string
          extra_gerechten: number
          id: string
          provider: string
          provider_ref: string | null
          soort: string
          status: string
          updated_at: string
          user_id: string
          valuta: string
        }
        Insert: {
          bedrag_cent?: number
          created_at?: string
          extra_gerechten?: number
          id?: string
          provider?: string
          provider_ref?: string | null
          soort?: string
          status?: string
          updated_at?: string
          user_id: string
          valuta?: string
        }
        Update: {
          bedrag_cent?: number
          created_at?: string
          extra_gerechten?: number
          id?: string
          provider?: string
          provider_ref?: string | null
          soort?: string
          status?: string
          updated_at?: string
          user_id?: string
          valuta?: string
        }
        Relationships: []
      }
      admin_audit_log: {
        Row: {
          action: string
          actor_id: string | null
          actor_role: Database["public"]["Enums"]["admin_role"] | null
          created_at: string
          details: Json
          entity_id: string | null
          entity_type: string
          id: string
          ip: string | null
          user_agent: string | null
        }
        Insert: {
          action: string
          actor_id?: string | null
          actor_role?: Database["public"]["Enums"]["admin_role"] | null
          created_at?: string
          details?: Json
          entity_id?: string | null
          entity_type?: string
          id?: string
          ip?: string | null
          user_agent?: string | null
        }
        Update: {
          action?: string
          actor_id?: string | null
          actor_role?: Database["public"]["Enums"]["admin_role"] | null
          created_at?: string
          details?: Json
          entity_id?: string | null
          entity_type?: string
          id?: string
          ip?: string | null
          user_agent?: string | null
        }
        Relationships: []
      }
      admin_rate_limits: {
        Row: {
          action: string
          admin_id: string
          created_at: string
          id: string
        }
        Insert: {
          action: string
          admin_id: string
          created_at?: string
          id?: string
        }
        Update: {
          action?: string
          admin_id?: string
          created_at?: string
          id?: string
        }
        Relationships: []
      }
      admin_sessions: {
        Row: {
          aal: string | null
          admin_id: string
          id: string
          ip: string | null
          last_seen_at: string
          started_at: string
          user_agent: string | null
        }
        Insert: {
          aal?: string | null
          admin_id: string
          id?: string
          ip?: string | null
          last_seen_at?: string
          started_at?: string
          user_agent?: string | null
        }
        Update: {
          aal?: string | null
          admin_id?: string
          id?: string
          ip?: string | null
          last_seen_at?: string
          started_at?: string
          user_agent?: string | null
        }
        Relationships: []
      }
      admin_users: {
        Row: {
          active: boolean
          can_view_private_content: boolean
          created_at: string
          created_by: string | null
          mfa_required: boolean
          note: string
          read_only: boolean
          role: Database["public"]["Enums"]["admin_role"]
          user_id: string
        }
        Insert: {
          active?: boolean
          can_view_private_content?: boolean
          created_at?: string
          created_by?: string | null
          mfa_required?: boolean
          note?: string
          read_only?: boolean
          role?: Database["public"]["Enums"]["admin_role"]
          user_id: string
        }
        Update: {
          active?: boolean
          can_view_private_content?: boolean
          created_at?: string
          created_by?: string | null
          mfa_required?: boolean
          note?: string
          read_only?: boolean
          role?: Database["public"]["Enums"]["admin_role"]
          user_id?: string
        }
        Relationships: []
      }
      ai_cache: {
        Row: {
          created_at: string
          expires_at: string | null
          feature: string
          hits: number
          input_hash: string
          model: string
          prompt_version: number
          result: Json
        }
        Insert: {
          created_at?: string
          expires_at?: string | null
          feature: string
          hits?: number
          input_hash: string
          model?: string
          prompt_version?: number
          result: Json
        }
        Update: {
          created_at?: string
          expires_at?: string | null
          feature?: string
          hits?: number
          input_hash?: string
          model?: string
          prompt_version?: number
          result?: Json
        }
        Relationships: []
      }
      ai_events: {
        Row: {
          created_at: string
          duration_ms: number
          error: string | null
          id: string
          kind: string
          model: string
          ok: boolean
        }
        Insert: {
          created_at?: string
          duration_ms?: number
          error?: string | null
          id?: string
          kind?: string
          model?: string
          ok?: boolean
        }
        Update: {
          created_at?: string
          duration_ms?: number
          error?: string | null
          id?: string
          kind?: string
          model?: string
          ok?: boolean
        }
        Relationships: []
      }
      ai_usage: {
        Row: {
          cache_hit: boolean
          created_at: string
          credits: number
          duration_ms: number
          feature: string
          id: string
          model: string
          ok: boolean
          user_id: string | null
        }
        Insert: {
          cache_hit?: boolean
          created_at?: string
          credits?: number
          duration_ms?: number
          feature: string
          id?: string
          model?: string
          ok?: boolean
          user_id?: string | null
        }
        Update: {
          cache_hit?: boolean
          created_at?: string
          credits?: number
          duration_ms?: number
          feature?: string
          id?: string
          model?: string
          ok?: boolean
          user_id?: string | null
        }
        Relationships: []
      }
      announcements: {
        Row: {
          active: boolean
          body: string
          created_at: string
          created_by: string | null
          ends_at: string | null
          id: string
          level: string
          starts_at: string
          title: string
        }
        Insert: {
          active?: boolean
          body?: string
          created_at?: string
          created_by?: string | null
          ends_at?: string | null
          id?: string
          level?: string
          starts_at?: string
          title: string
        }
        Update: {
          active?: boolean
          body?: string
          created_at?: string
          created_by?: string | null
          ends_at?: string | null
          id?: string
          level?: string
          starts_at?: string
          title?: string
        }
        Relationships: []
      }
      credit_costs: {
        Row: {
          credit_cost: number
          enabled: boolean
          feature: string
          label: string
          max_per_dag: number
          model: string
          updated_at: string
        }
        Insert: {
          credit_cost?: number
          enabled?: boolean
          feature: string
          label?: string
          max_per_dag?: number
          model?: string
          updated_at?: string
        }
        Update: {
          credit_cost?: number
          enabled?: boolean
          feature?: string
          label?: string
          max_per_dag?: number
          model?: string
          updated_at?: string
        }
        Relationships: []
      }
      credit_packs: {
        Row: {
          actief: boolean
          bonus: number
          created_at: string
          credits: number
          id: string
          naam: string
          prijs_cent: number
          valuta: string
          volgorde: number
        }
        Insert: {
          actief?: boolean
          bonus?: number
          created_at?: string
          credits: number
          id?: string
          naam: string
          prijs_cent: number
          valuta?: string
          volgorde?: number
        }
        Update: {
          actief?: boolean
          bonus?: number
          created_at?: string
          credits?: number
          id?: string
          naam?: string
          prijs_cent?: number
          valuta?: string
          volgorde?: number
        }
        Relationships: []
      }
      credit_requests: {
        Row: {
          aantal: number
          admin_note: string
          bericht: string
          created_at: string
          handled_at: string | null
          handled_by: string | null
          id: string
          status: string
          toegekend: number
          user_id: string
        }
        Insert: {
          aantal?: number
          admin_note?: string
          bericht?: string
          created_at?: string
          handled_at?: string | null
          handled_by?: string | null
          id?: string
          status?: string
          toegekend?: number
          user_id: string
        }
        Update: {
          aantal?: number
          admin_note?: string
          bericht?: string
          created_at?: string
          handled_at?: string | null
          handled_by?: string | null
          id?: string
          status?: string
          toegekend?: number
          user_id?: string
        }
        Relationships: []
      }
      credit_transactions: {
        Row: {
          amount: number
          balance_after: number
          created_at: string
          feature: string | null
          id: string
          reference_id: string | null
          status: string
          type: string
          user_id: string
        }
        Insert: {
          amount: number
          balance_after: number
          created_at?: string
          feature?: string | null
          id?: string
          reference_id?: string | null
          status?: string
          type: string
          user_id: string
        }
        Update: {
          amount?: number
          balance_after?: number
          created_at?: string
          feature?: string | null
          id?: string
          reference_id?: string | null
          status?: string
          type?: string
          user_id?: string
        }
        Relationships: []
      }
      favorites: {
        Row: {
          created_at: string
          recipe_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          recipe_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          recipe_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "favorites_recipe_id_fkey"
            columns: ["recipe_id"]
            isOneToOne: false
            referencedRelation: "recipes"
            referencedColumns: ["id"]
          },
        ]
      }
      feedback: {
        Row: {
          admin_note: string
          assigned_to: string | null
          created_at: string
          id: string
          kind: string
          message: string
          page: string | null
          rating: number | null
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          admin_note?: string
          assigned_to?: string | null
          created_at?: string
          id?: string
          kind?: string
          message: string
          page?: string | null
          rating?: number | null
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          admin_note?: string
          assigned_to?: string | null
          created_at?: string
          id?: string
          kind?: string
          message?: string
          page?: string | null
          rating?: number | null
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      group_members: {
        Row: {
          created_at: string
          group_id: string
          id: string
          planner_edit: boolean
          planner_view: boolean
          recipes_edit: boolean
          recipes_view: boolean
          rol: string
          shopping_edit: boolean
          shopping_view: boolean
          user_id: string
        }
        Insert: {
          created_at?: string
          group_id: string
          id?: string
          planner_edit?: boolean
          planner_view?: boolean
          recipes_edit?: boolean
          recipes_view?: boolean
          rol?: string
          shopping_edit?: boolean
          shopping_view?: boolean
          user_id: string
        }
        Update: {
          created_at?: string
          group_id?: string
          id?: string
          planner_edit?: boolean
          planner_view?: boolean
          recipes_edit?: boolean
          recipes_view?: boolean
          rol?: string
          shopping_edit?: boolean
          shopping_view?: boolean
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "group_members_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
        ]
      }
      groups: {
        Row: {
          created_at: string
          id: string
          naam: string
          owner_id: string
          token: string
        }
        Insert: {
          created_at?: string
          id?: string
          naam?: string
          owner_id: string
          token?: string
        }
        Update: {
          created_at?: string
          id?: string
          naam?: string
          owner_id?: string
          token?: string
        }
        Relationships: []
      }
      loyalty_cards: {
        Row: {
          created_at: string
          favoriet: boolean
          formaat: string
          gedeeld: boolean
          id: string
          kaartnaam: string
          nummer: string
          store_slug: string | null
          updated_at: string
          user_id: string
          winkel_naam: string
        }
        Insert: {
          created_at?: string
          favoriet?: boolean
          formaat?: string
          gedeeld?: boolean
          id?: string
          kaartnaam?: string
          nummer: string
          store_slug?: string | null
          updated_at?: string
          user_id: string
          winkel_naam: string
        }
        Update: {
          created_at?: string
          favoriet?: boolean
          formaat?: string
          gedeeld?: boolean
          id?: string
          kaartnaam?: string
          nummer?: string
          store_slug?: string | null
          updated_at?: string
          user_id?: string
          winkel_naam?: string
        }
        Relationships: []
      }
      loyalty_scan_events: {
        Row: {
          created_at: string
          formaat: string | null
          id: string
          methode: string
          ok: boolean
          reden: string | null
          store_slug: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string
          formaat?: string | null
          id?: string
          methode: string
          ok?: boolean
          reden?: string | null
          store_slug?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string
          formaat?: string | null
          id?: string
          methode?: string
          ok?: boolean
          reden?: string | null
          store_slug?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      loyalty_stores: {
        Row: {
          actief: boolean
          created_at: string
          kleur: string
          naam: string
          slug: string
          standaard_formaat: string
          volgorde: number
        }
        Insert: {
          actief?: boolean
          created_at?: string
          kleur?: string
          naam: string
          slug: string
          standaard_formaat?: string
          volgorde?: number
        }
        Update: {
          actief?: boolean
          created_at?: string
          kleur?: string
          naam?: string
          slug?: string
          standaard_formaat?: string
          volgorde?: number
        }
        Relationships: []
      }
      meal_plan: {
        Row: {
          created_at: string
          custom_title: string | null
          id: string
          meal_type: string
          plan_date: string
          recipe_id: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          custom_title?: string | null
          id?: string
          meal_type?: string
          plan_date: string
          recipe_id?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          custom_title?: string | null
          id?: string
          meal_type?: string
          plan_date?: string
          recipe_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "meal_plan_recipe_id_fkey"
            columns: ["recipe_id"]
            isOneToOne: false
            referencedRelation: "recipes"
            referencedColumns: ["id"]
          },
        ]
      }
      platform_settings: {
        Row: {
          description: string
          key: string
          updated_at: string
          updated_by: string | null
          value: Json
        }
        Insert: {
          description?: string
          key: string
          updated_at?: string
          updated_by?: string | null
          value?: Json
        }
        Update: {
          description?: string
          key?: string
          updated_at?: string
          updated_by?: string | null
          value?: Json
        }
        Relationships: []
      }
      profiles: {
        Row: {
          admin_note: string
          blocked_at: string | null
          created_at: string
          display_name: string
          handle: string | null
          id: string
          momenten: string[]
          onboarding_klaar: boolean
          taal: string
          thema: string
        }
        Insert: {
          admin_note?: string
          blocked_at?: string | null
          created_at?: string
          display_name?: string
          handle?: string | null
          id: string
          momenten?: string[]
          onboarding_klaar?: boolean
          taal?: string
          thema?: string
        }
        Update: {
          admin_note?: string
          blocked_at?: string | null
          created_at?: string
          display_name?: string
          handle?: string | null
          id?: string
          momenten?: string[]
          onboarding_klaar?: boolean
          taal?: string
          thema?: string
        }
        Relationships: []
      }
      recipe_import_jobs: {
        Row: {
          ai_used: boolean
          cache_hit: boolean
          canonical_url: string | null
          created_at: string
          credits_used: number
          duration_ms: number
          error_code: string | null
          error_message: string | null
          extraction_method: string | null
          fields_found: string[]
          fields_missing: string[]
          id: string
          platform: string
          source_url: string | null
          status: string
          user_id: string | null
        }
        Insert: {
          ai_used?: boolean
          cache_hit?: boolean
          canonical_url?: string | null
          created_at?: string
          credits_used?: number
          duration_ms?: number
          error_code?: string | null
          error_message?: string | null
          extraction_method?: string | null
          fields_found?: string[]
          fields_missing?: string[]
          id?: string
          platform?: string
          source_url?: string | null
          status?: string
          user_id?: string | null
        }
        Update: {
          ai_used?: boolean
          cache_hit?: boolean
          canonical_url?: string | null
          created_at?: string
          credits_used?: number
          duration_ms?: number
          error_code?: string | null
          error_message?: string | null
          extraction_method?: string | null
          fields_found?: string[]
          fields_missing?: string[]
          id?: string
          platform?: string
          source_url?: string | null
          status?: string
          user_id?: string | null
        }
        Relationships: []
      }
      recipe_ingredients: {
        Row: {
          created_at: string
          id: string
          name: string
          position: number
          quantity: number | null
          recipe_id: string
          unit: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          position?: number
          quantity?: number | null
          recipe_id: string
          unit?: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          position?: number
          quantity?: number | null
          recipe_id?: string
          unit?: string
        }
        Relationships: [
          {
            foreignKeyName: "recipe_ingredients_recipe_id_fkey"
            columns: ["recipe_id"]
            isOneToOne: false
            referencedRelation: "recipes"
            referencedColumns: ["id"]
          },
        ]
      }
      recipe_ratings: {
        Row: {
          created_at: string
          id: string
          recipe_id: string
          stars: number
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          recipe_id: string
          stars?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          recipe_id?: string
          stars?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "recipe_ratings_recipe_id_fkey"
            columns: ["recipe_id"]
            isOneToOne: false
            referencedRelation: "recipes"
            referencedColumns: ["id"]
          },
        ]
      }
      recipes: {
        Row: {
          category: string
          cook_minutes: number
          created_at: string
          deleted_at: string | null
          description: string
          difficulty: string
          id: string
          image_url: string | null
          instructions: string[]
          prep_minutes: number
          servings: number
          source_url: string | null
          tags: string[]
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          category?: string
          cook_minutes?: number
          created_at?: string
          deleted_at?: string | null
          description?: string
          difficulty?: string
          id?: string
          image_url?: string | null
          instructions?: string[]
          prep_minutes?: number
          servings?: number
          source_url?: string | null
          tags?: string[]
          title: string
          updated_at?: string
          user_id: string
        }
        Update: {
          category?: string
          cook_minutes?: number
          created_at?: string
          deleted_at?: string | null
          description?: string
          difficulty?: string
          id?: string
          image_url?: string | null
          instructions?: string[]
          prep_minutes?: number
          servings?: number
          source_url?: string | null
          tags?: string[]
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      shares: {
        Row: {
          accepted_at: string | null
          created_at: string
          id: string
          invited_email: string | null
          invited_name: string
          member_id: string | null
          owner_id: string
          planner_edit: boolean
          planner_view: boolean
          recipes_edit: boolean
          recipes_view: boolean
          shopping_edit: boolean
          shopping_view: boolean
          status: string
          token: string
        }
        Insert: {
          accepted_at?: string | null
          created_at?: string
          id?: string
          invited_email?: string | null
          invited_name?: string
          member_id?: string | null
          owner_id: string
          planner_edit?: boolean
          planner_view?: boolean
          recipes_edit?: boolean
          recipes_view?: boolean
          shopping_edit?: boolean
          shopping_view?: boolean
          status?: string
          token?: string
        }
        Update: {
          accepted_at?: string | null
          created_at?: string
          id?: string
          invited_email?: string | null
          invited_name?: string
          member_id?: string | null
          owner_id?: string
          planner_edit?: boolean
          planner_view?: boolean
          recipes_edit?: boolean
          recipes_view?: boolean
          shopping_edit?: boolean
          shopping_view?: boolean
          status?: string
          token?: string
        }
        Relationships: []
      }
      shopping_items: {
        Row: {
          checked: boolean
          created_at: string
          id: string
          list_id: string | null
          name: string
          quantity: number | null
          recipe_id: string | null
          unit: string
          user_id: string
        }
        Insert: {
          checked?: boolean
          created_at?: string
          id?: string
          list_id?: string | null
          name: string
          quantity?: number | null
          recipe_id?: string | null
          unit?: string
          user_id: string
        }
        Update: {
          checked?: boolean
          created_at?: string
          id?: string
          list_id?: string | null
          name?: string
          quantity?: number | null
          recipe_id?: string | null
          unit?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "shopping_items_list_id_fkey"
            columns: ["list_id"]
            isOneToOne: false
            referencedRelation: "shopping_lists"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shopping_items_recipe_id_fkey"
            columns: ["recipe_id"]
            isOneToOne: false
            referencedRelation: "recipes"
            referencedColumns: ["id"]
          },
        ]
      }
      shopping_lists: {
        Row: {
          created_at: string
          id: string
          name: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          name?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      site_content: {
        Row: {
          body: string
          key: string
          published: boolean
          title: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          body?: string
          key: string
          published?: boolean
          title?: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          body?: string
          key?: string
          published?: boolean
          title?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      usage_events: {
        Row: {
          created_at: string
          event: string
          id: string
          path: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string
          event: string
          id?: string
          path?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string
          event?: string
          id?: string
          path?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      user_credits: {
        Row: {
          balance: number
          created_at: string
          gebruikt_totaal: number
          gekocht_totaal: number
          gratis_totaal: number
          updated_at: string
          user_id: string
        }
        Insert: {
          balance?: number
          created_at?: string
          gebruikt_totaal?: number
          gekocht_totaal?: number
          gratis_totaal?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          balance?: number
          created_at?: string
          gebruikt_totaal?: number
          gekocht_totaal?: number
          gratis_totaal?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      accept_share: { Args: { _token: string }; Returns: string }
      admin_login_stats: {
        Args: { _user: string }
        Returns: {
          aantal: number
          eerste: string
          laatste: string
        }[]
      }
      claim_first_admin: { Args: never; Returns: boolean }
      credits_account: {
        Args: { _user: string }
        Returns: {
          balance: number
          created_at: string
          gebruikt_totaal: number
          gekocht_totaal: number
          gratis_totaal: number
          updated_at: string
          user_id: string
        }
        SetofOptions: {
          from: "*"
          to: "user_credits"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      credits_afronden: { Args: { _txn: string }; Returns: undefined }
      credits_reserveren: {
        Args: { _feature: string; _user: string }
        Returns: Json
      }
      credits_terugstorten: { Args: { _txn: string }; Returns: undefined }
      credits_toekennen: {
        Args: { _amount: number; _ref: string; _type: string; _user: string }
        Returns: number
      }
      decline_share: { Args: { _token: string }; Returns: boolean }
      groep_naam: { Args: { _token: string }; Returns: string }
      groep_recht: {
        Args: { _owner: string; _perm: string; _viewer: string }
        Returns: boolean
      }
      has_admin_role: {
        Args: {
          _role: Database["public"]["Enums"]["admin_role"]
          _user_id: string
        }
        Returns: boolean
      }
      has_share: {
        Args: { _owner: string; _perm: string; _viewer: string }
        Returns: boolean
      }
      in_groep: { Args: { _group: string; _user: string }; Returns: boolean }
      is_admin: { Args: { _user_id: string }; Returns: boolean }
      join_group: { Args: { _token: string }; Returns: string }
      samen_in_groep: { Args: { _a: string; _b: string }; Returns: boolean }
      zoek_gebruiker: {
        Args: { _term: string }
        Returns: {
          display_name: string
          handle: string
          id: string
        }[]
      }
    }
    Enums: {
      admin_role:
        | "super_admin"
        | "admin"
        | "support"
        | "content_manager"
        | "analyst"
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
  public: {
    Enums: {
      admin_role: [
        "super_admin",
        "admin",
        "support",
        "content_manager",
        "analyst",
      ],
    },
  },
} as const
