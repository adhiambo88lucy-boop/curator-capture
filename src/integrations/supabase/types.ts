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
      buyer_profiles: {
        Row: {
          business_name: string | null
          city: string | null
          contact_name: string | null
          country: string | null
          created_at: string
          id: string
          phone: string | null
          updated_at: string
        }
        Insert: {
          business_name?: string | null
          city?: string | null
          contact_name?: string | null
          country?: string | null
          created_at?: string
          id: string
          phone?: string | null
          updated_at?: string
        }
        Update: {
          business_name?: string | null
          city?: string | null
          contact_name?: string | null
          country?: string | null
          created_at?: string
          id?: string
          phone?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      capture_sessions: {
        Row: {
          created_at: string
          created_by: string | null
          ended_at: string | null
          id: string
          notes: string | null
          started_at: string
          status: Database["public"]["Enums"]["session_status"]
          supplier_id: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          ended_at?: string | null
          id?: string
          notes?: string | null
          started_at?: string
          status?: Database["public"]["Enums"]["session_status"]
          supplier_id?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          ended_at?: string | null
          id?: string
          notes?: string | null
          started_at?: string
          status?: Database["public"]["Enums"]["session_status"]
          supplier_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "capture_sessions_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
        ]
      }
      categories: {
        Row: {
          created_at: string
          id: string
          name: string
          slug: string
          sort_order: number
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          slug: string
          sort_order?: number
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          slug?: string
          sort_order?: number
        }
        Relationships: []
      }
      favorites: {
        Row: {
          created_at: string
          id: string
          product_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          product_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          product_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "favorites_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      group_buy_reservations: {
        Row: {
          buyer_id: string
          created_at: string
          id: string
          listing_id: string
          notes: string | null
          quantity: number
          status: Database["public"]["Enums"]["reservation_status"]
          updated_at: string
        }
        Insert: {
          buyer_id: string
          created_at?: string
          id?: string
          listing_id: string
          notes?: string | null
          quantity: number
          status?: Database["public"]["Enums"]["reservation_status"]
          updated_at?: string
        }
        Update: {
          buyer_id?: string
          created_at?: string
          id?: string
          listing_id?: string
          notes?: string | null
          quantity?: number
          status?: Database["public"]["Enums"]["reservation_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "group_buy_reservations_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "listings"
            referencedColumns: ["id"]
          },
        ]
      }
      listings: {
        Row: {
          available_qty: number | null
          code: string
          created_at: string
          created_by: string | null
          group_buy_deadline: string | null
          group_buy_enabled: boolean
          id: string
          moq: number | null
          product_id: string
          publish_status: Database["public"]["Enums"]["listing_publish_status"]
          supplier_id: string
          supplier_price_rmb: number | null
          updated_at: string
        }
        Insert: {
          available_qty?: number | null
          code?: string
          created_at?: string
          created_by?: string | null
          group_buy_deadline?: string | null
          group_buy_enabled?: boolean
          id?: string
          moq?: number | null
          product_id: string
          publish_status?: Database["public"]["Enums"]["listing_publish_status"]
          supplier_id: string
          supplier_price_rmb?: number | null
          updated_at?: string
        }
        Update: {
          available_qty?: number | null
          code?: string
          created_at?: string
          created_by?: string | null
          group_buy_deadline?: string | null
          group_buy_enabled?: boolean
          id?: string
          moq?: number | null
          product_id?: string
          publish_status?: Database["public"]["Enums"]["listing_publish_status"]
          supplier_id?: string
          supplier_price_rmb?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "listings_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "listings_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
        ]
      }
      product_colours: {
        Row: {
          created_at: string
          id: string
          name: string
          product_id: string
          sort_order: number
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          product_id: string
          sort_order?: number
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          product_id?: string
          sort_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "product_colours_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      product_media: {
        Row: {
          colour_id: string
          created_at: string
          id: string
          kind: Database["public"]["Enums"]["media_kind"]
          product_id: string
          sort_order: number
          storage_path: string
          url: string
        }
        Insert: {
          colour_id: string
          created_at?: string
          id?: string
          kind?: Database["public"]["Enums"]["media_kind"]
          product_id: string
          sort_order?: number
          storage_path: string
          url: string
        }
        Update: {
          colour_id?: string
          created_at?: string
          id?: string
          kind?: Database["public"]["Enums"]["media_kind"]
          product_id?: string
          sort_order?: number
          storage_path?: string
          url?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_media_colour_id_fkey"
            columns: ["colour_id"]
            isOneToOne: false
            referencedRelation: "product_colours"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_media_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      product_sizes: {
        Row: {
          id: string
          product_id: string
          size: string
          sort_order: number
        }
        Insert: {
          id?: string
          product_id: string
          size: string
          sort_order?: number
        }
        Update: {
          id?: string
          product_id?: string
          size?: string
          sort_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "product_sizes_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      products: {
        Row: {
          capture_session_id: string | null
          category: string
          category_id: string | null
          created_at: string
          created_by: string | null
          description: string | null
          discovery_date: string
          id: string
          internal_code: string
          internal_notes: string | null
          material: string | null
          name: string
          status: Database["public"]["Enums"]["product_status"]
          subcategory_id: string | null
          supplier_id: string | null
          tags: string[]
          updated_at: string
        }
        Insert: {
          capture_session_id?: string | null
          category: string
          category_id?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          discovery_date?: string
          id?: string
          internal_code?: string
          internal_notes?: string | null
          material?: string | null
          name: string
          status?: Database["public"]["Enums"]["product_status"]
          subcategory_id?: string | null
          supplier_id?: string | null
          tags?: string[]
          updated_at?: string
        }
        Update: {
          capture_session_id?: string | null
          category?: string
          category_id?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          discovery_date?: string
          id?: string
          internal_code?: string
          internal_notes?: string | null
          material?: string | null
          name?: string
          status?: Database["public"]["Enums"]["product_status"]
          subcategory_id?: string | null
          supplier_id?: string | null
          tags?: string[]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "products_capture_session_id_fkey"
            columns: ["capture_session_id"]
            isOneToOne: false
            referencedRelation: "capture_sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "products_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "products_subcategory_id_fkey"
            columns: ["subcategory_id"]
            isOneToOne: false
            referencedRelation: "subcategories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "products_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
        ]
      }
      subcategories: {
        Row: {
          category_id: string
          created_at: string
          id: string
          name: string
          slug: string
          sort_order: number
        }
        Insert: {
          category_id: string
          created_at?: string
          id?: string
          name: string
          slug: string
          sort_order?: number
        }
        Update: {
          category_id?: string
          created_at?: string
          id?: string
          name?: string
          slug?: string
          sort_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "subcategories_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
        ]
      }
      suppliers: {
        Row: {
          booth: string | null
          building: string | null
          city: string | null
          contact_person: string | null
          country: string | null
          created_at: string
          created_by: string | null
          floor: string | null
          id: string
          market: string | null
          name: string
          notes: string | null
          phone: string | null
          province: string | null
          status: Database["public"]["Enums"]["supplier_status"]
          updated_at: string
          wechat: string | null
        }
        Insert: {
          booth?: string | null
          building?: string | null
          city?: string | null
          contact_person?: string | null
          country?: string | null
          created_at?: string
          created_by?: string | null
          floor?: string | null
          id?: string
          market?: string | null
          name: string
          notes?: string | null
          phone?: string | null
          province?: string | null
          status?: Database["public"]["Enums"]["supplier_status"]
          updated_at?: string
          wechat?: string | null
        }
        Update: {
          booth?: string | null
          building?: string | null
          city?: string | null
          contact_person?: string | null
          country?: string | null
          created_at?: string
          created_by?: string | null
          floor?: string | null
          id?: string
          market?: string | null
          name?: string
          notes?: string | null
          phone?: string | null
          province?: string | null
          status?: Database["public"]["Enums"]["supplier_status"]
          updated_at?: string
          wechat?: string | null
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
      get_group_buy_progress: { Args: { _listing_id: string }; Returns: number }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin" | "buyer"
      listing_publish_status: "draft" | "published" | "archived"
      media_kind: "photo" | "video"
      product_status:
        | "discovered"
        | "watchlist"
        | "draft"
        | "published"
        | "archived"
      reservation_status: "pending" | "confirmed" | "cancelled"
      session_status: "active" | "ended"
      supplier_status: "active" | "inactive" | "blacklisted"
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
      app_role: ["admin", "buyer"],
      listing_publish_status: ["draft", "published", "archived"],
      media_kind: ["photo", "video"],
      product_status: [
        "discovered",
        "watchlist",
        "draft",
        "published",
        "archived",
      ],
      reservation_status: ["pending", "confirmed", "cancelled"],
      session_status: ["active", "ended"],
      supplier_status: ["active", "inactive", "blacklisted"],
    },
  },
} as const
