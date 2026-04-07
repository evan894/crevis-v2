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
      // NOTE: custom_roles, delivery_orders, store_members added for migration 0009.
      // Regenerate with: npx supabase gen types typescript --project-id <id> > types/database.types.ts
      custom_roles: {
        Row: {
          created_at: string
          id: string
          name: string
          permissions: Json
          seller_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          permissions?: Json
          seller_id: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          permissions?: Json
          seller_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "custom_roles_seller_id_fkey"
            columns: ["seller_id"]
            isOneToOne: false
            referencedRelation: "sellers"
            referencedColumns: ["id"]
          },
        ]
      }
      delivery_orders: {
        Row: {
          agent_id: string | null
          created_at: string
          delivered_at: string | null
          failure_reason: string | null
          id: string
          order_id: string
          otp: string | null
          otp_attempts: number
          otp_generated_at: string | null
          packed_at: string | null
          picked_up_at: string | null
          status: string
          updated_at: string
        }
        Insert: {
          agent_id?: string | null
          created_at?: string
          delivered_at?: string | null
          failure_reason?: string | null
          id?: string
          order_id: string
          otp?: string | null
          otp_attempts?: number
          otp_generated_at?: string | null
          packed_at?: string | null
          picked_up_at?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          agent_id?: string | null
          created_at?: string
          delivered_at?: string | null
          failure_reason?: string | null
          id?: string
          order_id?: string
          otp?: string | null
          otp_attempts?: number
          otp_generated_at?: string | null
          packed_at?: string | null
          picked_up_at?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "delivery_orders_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: true
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "delivery_orders_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      store_members: {
        Row: {
          added_by: string | null
          created_at: string
          custom_role_id: string | null
          id: string
          is_active: boolean
          role: string
          seller_id: string
          user_id: string
        }
        Insert: {
          added_by?: string | null
          created_at?: string
          custom_role_id?: string | null
          id?: string
          is_active?: boolean
          role: string
          seller_id: string
          user_id: string
        }
        Update: {
          added_by?: string | null
          created_at?: string
          custom_role_id?: string | null
          id?: string
          is_active?: boolean
          role?: string
          seller_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "store_members_seller_id_fkey"
            columns: ["seller_id"]
            isOneToOne: false
            referencedRelation: "sellers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "store_members_custom_role_id_fkey"
            columns: ["custom_role_id"]
            isOneToOne: false
            referencedRelation: "custom_roles"
            referencedColumns: ["id"]
          },
        ]
      }
      buyers: {
        Row: {
          created_at: string
          first_name: string | null
          id: string
          telegram_id: string
          username: string | null
        }
        Insert: {
          created_at?: string
          first_name?: string | null
          id?: string
          telegram_id: string
          username?: string | null
        }
        Update: {
          created_at?: string
          first_name?: string | null
          id?: string
          telegram_id?: string
          username?: string | null
        }
        Relationships: []
      }
      coupons: {
        Row: {
          active: boolean
          code: string
          created_at: string
          credits_value: number
          id: string
          max_uses: number | null
          uses_so_far: number
        }
        Insert: {
          active?: boolean
          code: string
          created_at?: string
          credits_value: number
          id?: string
          max_uses?: number | null
          uses_so_far?: number
        }
        Update: {
          active?: boolean
          code?: string
          created_at?: string
          credits_value?: number
          id?: string
          max_uses?: number | null
          uses_so_far?: number
        }
        Relationships: []
      }
      credit_ledger: {
        Row: {
          action: string
          created_at: string
          credits_delta: number
          id: string
          note: string | null
          order_id: string | null
          order_value: number | null
          seller_id: string
        }
        Insert: {
          action: string
          created_at?: string
          credits_delta: number
          id?: string
          note?: string | null
          order_id?: string | null
          order_value?: number | null
          seller_id: string
        }
        Update: {
          action?: string
          created_at?: string
          credits_delta?: number
          id?: string
          note?: string | null
          order_id?: string | null
          order_value?: number | null
          seller_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "credit_ledger_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "credit_ledger_seller_id_fkey"
            columns: ["seller_id"]
            isOneToOne: false
            referencedRelation: "sellers"
            referencedColumns: ["id"]
          },
        ]
      }
      credit_purchases: {
        Row: {
          amount_paid: number
          created_at: string
          credits_added: number
          id: string
          razorpay_order_id: string | null
          razorpay_payment_id: string | null
          seller_id: string
          status: string
        }
        Insert: {
          amount_paid: number
          created_at?: string
          credits_added: number
          id?: string
          razorpay_order_id?: string | null
          razorpay_payment_id?: string | null
          seller_id: string
          status?: string
        }
        Update: {
          amount_paid?: number
          created_at?: string
          credits_added?: number
          id?: string
          razorpay_order_id?: string | null
          razorpay_payment_id?: string | null
          seller_id?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "credit_purchases_seller_id_fkey"
            columns: ["seller_id"]
            isOneToOne: false
            referencedRelation: "sellers"
            referencedColumns: ["id"]
          },
        ]
      }
      orders: {
        Row: {
          amount: number
          buyer_name: string
          buyer_telegram_id: string
          created_at: string
          credits_deducted: number
          id: string
          platform_fee: number
          product_id: string | null
          razorpay_payment_id: string | null
          seller_id: string
          status: string
        }
        Insert: {
          amount: number
          buyer_name: string
          buyer_telegram_id: string
          created_at?: string
          credits_deducted: number
          id?: string
          platform_fee: number
          product_id?: string | null
          razorpay_payment_id?: string | null
          seller_id: string
          status?: string
        }
        Update: {
          amount?: number
          buyer_name?: string
          buyer_telegram_id?: string
          created_at?: string
          credits_deducted?: number
          id?: string
          platform_fee?: number
          product_id?: string | null
          razorpay_payment_id?: string | null
          seller_id?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "orders_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_seller_id_fkey"
            columns: ["seller_id"]
            isOneToOne: false
            referencedRelation: "sellers"
            referencedColumns: ["id"]
          },
        ]
      }
      products: {
        Row: {
          active: boolean
          boosted: boolean
          category: string
          created_at: string
          description: string | null
          id: string
          name: string
          photo_url: string
          photo_urls: string[]
          price: number
          seller_id: string
          stock: number
        }
        Insert: {
          active?: boolean
          boosted?: boolean
          category: string
          created_at?: string
          description?: string | null
          id?: string
          name: string
          photo_url: string
          photo_urls?: string[]
          price: number
          seller_id: string
          stock?: number
        }
        Update: {
          active?: boolean
          boosted?: boolean
          category?: string
          created_at?: string
          description?: string | null
          id?: string
          name?: string
          photo_url?: string
          photo_urls?: string[]
          price?: number
          seller_id?: string
          stock?: number
        }
        Relationships: [
          {
            foreignKeyName: "products_seller_id_fkey"
            columns: ["seller_id"]
            isOneToOne: false
            referencedRelation: "sellers"
            referencedColumns: ["id"]
          },
        ]
      }
      sellers: {
        Row: {
          category: string
          created_at: string
          credit_balance: number
          id: string
          qr_code_url: string | null
          shop_name: string
          shop_slug: string | null
          slack_access_token: string | null
          slack_user_id: string | null
          user_id: string
        }
        Insert: {
          category: string
          created_at?: string
          credit_balance?: number
          id?: string
          qr_code_url?: string | null
          shop_name: string
          shop_slug?: string | null
          slack_access_token?: string | null
          slack_user_id?: string | null
          user_id: string
        }
        Update: {
          category?: string
          created_at?: string
          credit_balance?: number
          id?: string
          qr_code_url?: string | null
          shop_name?: string
          shop_slug?: string | null
          slack_access_token?: string | null
          slack_user_id?: string | null
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      add_credits: {
        Args: {
          p_action: string
          p_amount: number
          p_note?: string
          p_seller_id: string
        }
        Returns: number
      }
      deactivate_seller_listings: {
        Args: { p_seller_id: string }
        Returns: number
      }
      deduct_credits: {
        Args: {
          p_action: string
          p_amount: number
          p_note?: string
          p_order_id?: string
          p_order_value?: number
          p_seller_id: string
        }
        Returns: number
      }
      generate_shop_slug: {
        Args: { shop_name: string }
        Returns: string
      }
      redeem_coupon: {
        Args: { p_code: string; p_seller_id: string }
        Returns: number
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
