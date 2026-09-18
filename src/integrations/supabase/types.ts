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
      ad_spend_imports: {
        Row: {
          campaign: string | null
          clicks: number
          conversions: number
          created_at: string
          id: string
          impressions: number
          platform: string
          raw: Json
          revenue: number
          spend: number
          spend_date: string
        }
        Insert: {
          campaign?: string | null
          clicks?: number
          conversions?: number
          created_at?: string
          id?: string
          impressions?: number
          platform: string
          raw?: Json
          revenue?: number
          spend?: number
          spend_date: string
        }
        Update: {
          campaign?: string | null
          clicks?: number
          conversions?: number
          created_at?: string
          id?: string
          impressions?: number
          platform?: string
          raw?: Json
          revenue?: number
          spend?: number
          spend_date?: string
        }
        Relationships: []
      }
      production_batches: {
        Row: {
          batch_code: string
          batch_date: string
          created_at: string
          created_by: string | null
          downtime_minutes: number
          id: string
          line_id: string | null
          notes: string | null
          product_id: string | null
          protein_pct: number | null
          qc_status: string
          rejects: number
          units_planned: number
          units_produced: number
          updated_at: string
        }
        Insert: {
          batch_code: string
          batch_date?: string
          created_at?: string
          created_by?: string | null
          downtime_minutes?: number
          id?: string
          line_id?: string | null
          notes?: string | null
          product_id?: string | null
          protein_pct?: number | null
          qc_status?: string
          rejects?: number
          units_planned?: number
          units_produced?: number
          updated_at?: string
        }
        Update: {
          batch_code?: string
          batch_date?: string
          created_at?: string
          created_by?: string | null
          downtime_minutes?: number
          id?: string
          line_id?: string | null
          notes?: string | null
          product_id?: string | null
          protein_pct?: number | null
          qc_status?: string
          rejects?: number
          units_planned?: number
          units_produced?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "production_batches_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "production_batches_line_id_fkey"
            columns: ["line_id"]
            isOneToOne: false
            referencedRelation: "production_lines"
            referencedColumns: ["id"]
          },
        ]
      }
      inventory_items: {
        Row: {
          created_at: string
          expiry_date: string | null
          id: string
          item_type: string
          name: string
          product_id: string | null
          reorder_level: number
          sku: string
          stock: number
          unit: string
          unit_cost: number | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          expiry_date?: string | null
          id?: string
          item_type?: string
          name: string
          product_id?: string | null
          reorder_level?: number
          sku: string
          stock?: number
          unit?: string
          unit_cost?: number | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          expiry_date?: string | null
          id?: string
          item_type?: string
          name?: string
          product_id?: string | null
          reorder_level?: number
          sku?: string
          stock?: number
          unit?: string
          unit_cost?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "inventory_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      expenses: {
        Row: {
          amount: number
          category: string
          created_at: string
          due_date: string | null
          expense_date: string
          gst_amount: number
          id: string
          is_cogs: boolean
          notes: string | null
          status: string
          vendor: string | null
        }
        Insert: {
          amount?: number
          category: string
          created_at?: string
          due_date?: string | null
          expense_date?: string
          gst_amount?: number
          id?: string
          is_cogs?: boolean
          notes?: string | null
          status?: string
          vendor?: string | null
        }
        Update: {
          amount?: number
          category?: string
          created_at?: string
          due_date?: string | null
          expense_date?: string
          gst_amount?: number
          id?: string
          is_cogs?: boolean
          notes?: string | null
          status?: string
          vendor?: string | null
        }
        Relationships: []
      }
      invoices: {
        Row: {
          amount: number
          created_at: string
          customer: string
          due_date: string | null
          gst_amount: number
          id: string
          invoice_no: string
          issue_date: string
          notes: string | null
          paid_on: string | null
          status: string
        }
        Insert: {
          amount?: number
          created_at?: string
          customer: string
          due_date?: string | null
          gst_amount?: number
          id?: string
          invoice_no: string
          issue_date?: string
          notes?: string | null
          paid_on?: string | null
          status?: string
        }
        Update: {
          amount?: number
          created_at?: string
          customer?: string
          due_date?: string | null
          gst_amount?: number
          id?: string
          invoice_no?: string
          issue_date?: string
          notes?: string | null
          paid_on?: string | null
          status?: string
        }
        Relationships: []
      }
      crm_contacts: {
        Row: {
          city: string | null
          company: string | null
          contact_type: string
          created_at: string
          deal_value: number
          email: string | null
          id: string
          name: string
          next_follow_up: string | null
          notes: string | null
          owner_id: string | null
          phone: string | null
          stage: string
          updated_at: string
        }
        Insert: {
          city?: string | null
          company?: string | null
          contact_type?: string
          created_at?: string
          deal_value?: number
          email?: string | null
          id?: string
          name: string
          next_follow_up?: string | null
          notes?: string | null
          owner_id?: string | null
          phone?: string | null
          stage?: string
          updated_at?: string
        }
        Update: {
          city?: string | null
          company?: string | null
          contact_type?: string
          created_at?: string
          deal_value?: number
          email?: string | null
          id?: string
          name?: string
          next_follow_up?: string | null
          notes?: string | null
          owner_id?: string | null
          phone?: string | null
          stage?: string
          updated_at?: string
        }
        Relationships: []
      }
      team_members: {
        Row: {
          attendance: string
          created_at: string
          department: string | null
          email: string | null
          id: string
          is_active: boolean
          joined_on: string | null
          kpi_score: number
          monthly_target: number | null
          name: string
          phone: string | null
          role: string | null
          updated_at: string
        }
        Insert: {
          attendance?: string
          created_at?: string
          department?: string | null
          email?: string | null
          id?: string
          is_active?: boolean
          joined_on?: string | null
          kpi_score?: number
          monthly_target?: number | null
          name: string
          phone?: string | null
          role?: string | null
          updated_at?: string
        }
        Update: {
          attendance?: string
          created_at?: string
          department?: string | null
          email?: string | null
          id?: string
          is_active?: boolean
          joined_on?: string | null
          kpi_score?: number
          monthly_target?: number | null
          name?: string
          phone?: string | null
          role?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      data_sources: {
        Row: {
          config: Json
          created_at: string
          id: string
          kind: string
          label: string
          last_synced_at: string | null
          status: string
          updated_at: string
        }
        Insert: {
          config?: Json
          created_at?: string
          id?: string
          kind: string
          label: string
          last_synced_at?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          config?: Json
          created_at?: string
          id?: string
          kind?: string
          label?: string
          last_synced_at?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      production_lines: {
        Row: {
          capacity_per_day: number | null
          created_at: string
          id: string
          name: string
          notes: string | null
          status: string
          updated_at: string
        }
        Insert: {
          capacity_per_day?: number | null
          created_at?: string
          id?: string
          name: string
          notes?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          capacity_per_day?: number | null
          created_at?: string
          id?: string
          name?: string
          notes?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      products: {
        Row: {
          category: string | null
          created_at: string
          id: string
          is_active: boolean
          name: string
          retail_price: number | null
          sku: string
          unit_cost: number | null
          updated_at: string
        }
        Insert: {
          category?: string | null
          created_at?: string
          id?: string
          is_active?: boolean
          name: string
          retail_price?: number | null
          sku: string
          unit_cost?: number | null
          updated_at?: string
        }
        Update: {
          category?: string | null
          created_at?: string
          id?: string
          is_active?: boolean
          name?: string
          retail_price?: number | null
          sku?: string
          unit_cost?: number | null
          updated_at?: string
        }
        Relationships: []
      }
      sales_imports: {
        Row: {
          channel: string | null
          created_at: string
          currency: string
          external_id: string | null
          id: string
          order_date: string
          orders: number
          raw: Json
          revenue: number
          source: string
        }
        Insert: {
          channel?: string | null
          created_at?: string
          currency?: string
          external_id?: string | null
          id?: string
          order_date: string
          orders?: number
          raw?: Json
          revenue?: number
          source: string
        }
        Update: {
          channel?: string | null
          created_at?: string
          currency?: string
          external_id?: string | null
          id?: string
          order_date?: string
          orders?: number
          raw?: Json
          revenue?: number
          source?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
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
    }
    Enums: {
      app_role: "ceo" | "salesperson"
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
      app_role: ["ceo", "salesperson"],
    },
  },
} as const
